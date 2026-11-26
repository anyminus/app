import {useEffect,useRef,useState} from 'react';
import {apiOrigin,createDemoApi,normalizeTracks,normalizeJob,ApiError} from './api.mjs';
import {trackArtworkUrl} from './artwork.mjs';
import {matchesArtist} from './model.mjs';
export const origin=apiOrigin(import.meta.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev')!;
export const api=createDemoApi(origin);
export const coverFor=(id:string,provided?:string|null)=>trackArtworkUrl(origin,id,provided);
export type LiveTrack={providerTrackId:string;title:string;artist:string;durationMs:number|null;pairOperationId:string|null;metadataUnavailable?:boolean;coverUrl?:string|null};
export function isTrackId(id:unknown):id is string{return typeof id==='string'&&/^\d{1,20}$/.test(id)}
export function useCatalog(query:string|null,artist:string|null=null){
 const [items,setItems]=useState<LiveTrack[]>([]),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const ctrl=useRef<AbortController|null>(null);
 // Follow every catalog cursor automatically and publish matching tracks as each page arrives.
 // No parallel requests, no per-track status calls, and abort immediately on navigation.
 async function loadArtist(signal:AbortSignal){
  let next:string|null=null;const seen=new Set<string>(),ids=new Set<string>();
  do{
   if(signal.aborted)throw signal.reason;
   const page=await api.catalog(next,signal);
   if(signal.aborted)throw signal.reason;
   const matches=(normalizeTracks(page,true) as LiveTrack[]).filter(t=>{
    if(!t.pairOperationId||!matchesArtist(t.artist,artist)||ids.has(t.providerTrackId))return false;
    ids.add(t.providerTrackId);return true;
   });
   if(matches.length)setItems(old=>[...old,...matches]);
   const candidate=page.nextCursor;
   if(candidate===null||candidate===undefined)break;
   if(typeof candidate!=='string'||!isTrackId(candidate)||seen.has(candidate))throw Error('Некорректная пагинация каталога');
   seen.add(candidate);next=candidate;
  }while(true);
 }
 useEffect(()=>{const c=new AbortController();ctrl.current=c;setItems([]);setCursor(null);setError('');if(artist===null&&query!==null&&query.trim().length<2){setLoading(false);return()=>{c.abort();ctrl.current?.abort()}}setLoading(true);const t=window.setTimeout(async()=>{try{if(artist!==null){await loadArtist(c.signal);return}const r=query===null?await api.catalog(null,c.signal):await api.search(query,c.signal);if(!c.signal.aborted){setItems(normalizeTracks(r,query===null));setCursor(query===null&&typeof r.nextCursor==='string'?r.nextCursor:null);}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}},artist!==null||query===null?0:650);return()=>{clearTimeout(t);c.abort();ctrl.current?.abort()}},[query,artist,retry]);
 async function more(){if(artist!==null||query!==null||!cursor||loading)return;const c=new AbortController();ctrl.current=c;setLoading(true);setError('');try{const r=await api.catalog(cursor,c.signal);if(!c.signal.aborted){setItems(old=>{const seen=new Set(old.map(t=>t.providerTrackId));return [...old,...(normalizeTracks(r,true) as LiveTrack[]).filter(t=>!seen.has(t.providerTrackId))]});setCursor(typeof r.nextCursor==='string'?r.nextCursor:null)}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}}
 return {items,cursor,error,loading,retry:()=>setRetry(v=>v+1),more};
}
function transient(e:unknown){return e instanceof ApiError&&(e.status===0||e.status===408||[500,502,503,504].includes(e.status))}
function delay(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(signal.reason);return}const abort=()=>{clearTimeout(timer);reject(signal.reason)};const timer=window.setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},ms);signal.addEventListener('abort',abort,{once:true})})}
async function retryRead<T>(read:()=>Promise<T>,signal:AbortSignal):Promise<T>{try{return await read()}catch(e){if(signal.aborted||!transient(e))throw e;await delay(700,signal);return read()}}
// Bounded public catalog lookup: never request every page without a limit.
async function findCatalogTrack(id:string,signal:AbortSignal,maxPages=8):Promise<LiveTrack|undefined>{
 let cursor:string|null=null;const seen=new Set<string>();
 for(let i=0;i<maxPages;i++){
  if(signal.aborted)throw signal.reason;
  const page=await api.catalog(cursor,signal);
  const match=(normalizeTracks(page,true) as LiveTrack[]).find(t=>t.providerTrackId===id&&t.pairOperationId);
  if(match)return match;
  const next=page.nextCursor;
  if(typeof next!=='string'||!/^\d{1,20}$/.test(next)||seen.has(next))break;
  seen.add(next);cursor=next;
 }
}
async function providerMetadata(id:string,signal:AbortSignal):Promise<LiveTrack>{
 const auth=await api.auth(signal);
 const raw=await api.metadata(id,auth.accessToken,signal);
 const match=normalizeTracks({items:[{...raw,providerTrackId:id}]})[0] as LiveTrack|undefined;
 if(!match||!match.title.trim()||!match.artist.trim())throw Error('Метаданные песни недоступны');
 return match;
}
export async function recoverTrackMetadata(id:string,signal:AbortSignal):Promise<LiveTrack>{
 if(!isTrackId(id))throw Error('Песня не найдена');
 // Prefer the stored catalog; the provider is a fallback.
 try{const track=await findCatalogTrack(id,signal);if(track)return track}catch(e){if(signal.aborted||e instanceof ApiError&&e.status===429)throw e}
 return providerMetadata(id,signal);
}
export async function lookupTrack(id:string,signal:AbortSignal):Promise<LiveTrack>{
 if(!isTrackId(id))throw Error('Песня не найдена');
 let catalogUnavailable=false;
 try{const ready=await findCatalogTrack(id,signal);if(ready)return ready}catch(e){if(signal.aborted||e instanceof ApiError&&e.status===429)throw e;catalogUnavailable=true}
 // Session creation is safe to retry once for a transient gateway failure,
 // but never retry a rate limit or enqueue a karaoke job here.
 const auth=await retryRead(()=>api.auth(signal),signal);
 if(!auth||typeof auth!=='object'||!('accessToken' in auth)||typeof auth.accessToken!=='string')throw Error('Не удалось авторизоваться');
 const accessToken=auth.accessToken;
 try{
  const meta=await retryRead(()=>api.metadata(id,accessToken,signal),signal);
  const track=normalizeTracks({items:[{...meta,providerTrackId:id}]})[0] as LiveTrack|undefined;
  if(track&&track.title.trim()&&track.artist.trim())return track;
  throw Error('Метаданные песни недоступны');
 }catch(e){
  if(signal.aborted)throw e;
  if(e instanceof ApiError&&![0,404,408,429,500,502,503,504].includes(e.status))throw e;
  // A verified ready pair can be played even if metadata is missing.
  const raw=await retryRead(()=>api.status(id,accessToken,signal),signal);
  const job=normalizeJob(raw);
  if(job.state!=='ready'||!job.pairOperationId)throw e;
  let fromCatalog:LiveTrack|undefined;
  if(catalogUnavailable)try{fromCatalog=await findCatalogTrack(id,signal)}catch(cause){if(signal.aborted)throw cause}
  if(signal.aborted)throw signal.reason;
  const duration=Number(raw.durationSeconds);
  return {providerTrackId:id,title:fromCatalog?.title??'Караоке',artist:fromCatalog?.artist??'',durationMs:fromCatalog?.durationMs??(Number.isFinite(duration)&&duration>0?Math.round(duration*1000):null),pairOperationId:job.pairOperationId,metadataUnavailable:!fromCatalog,coverUrl:fromCatalog?.coverUrl??null};
 }
}

 // Separate SDK-backed list. Never infer popularity from general search or ready catalog.
 export function useArtistPopular(name:string|null){
  const [result,setResult]=useState<{name:string|null;items:LiveTrack[];error:string;loading:boolean}>({name:null,items:[],error:'',loading:false});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
   if(name===null)return;
   const c=new AbortController();
   setResult({name,items:[],error:'',loading:true});
   const timer=window.setTimeout(async()=>{
    const deadline=window.setTimeout(()=>{setResult({name,items:[],error:'Время ожидания популярных песен истекло',loading:false});c.abort()},20000);
    try{
     const payload=await api.artistPopular(name,c.signal);
     const seen=new Set<string>();const items=(normalizeTracks(payload) as LiveTrack[]).filter(t=>{if(seen.has(t.providerTrackId))return false;seen.add(t.providerTrackId);return true});
     if(!c.signal.aborted)setResult({name,items,error:'',loading:false});
    }catch(e){
     if(!c.signal.aborted)setResult({name,items:[],error:e instanceof ApiError&&[404,501].includes(e.status)?'Популярные песни пока недоступны: требуется обновление API.':e instanceof Error?e.message:'Не удалось загрузить популярные песни',loading:false});
    }finally{clearTimeout(deadline)}
   },0);
   return()=>{clearTimeout(timer);c.abort()};
  },[name,retry]);
  const current=result.name===name?result:{name,items:[],error:'',loading:name!==null};
  return {...current,retry:()=>setRetry(v=>v+1)};
 }
