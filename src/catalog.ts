import {useEffect,useRef,useState} from 'react';
import {apiOrigin,createDemoApi,normalizeTracks,normalizeArtistCredits,normalizeJob,ApiError} from './api.mjs';
import {trackArtworkUrl} from './artwork.mjs';
import {matchesArtist} from './model.mjs';
export const origin=apiOrigin(import.meta.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev')!;
export const api=createDemoApi(origin);
export const coverFor=(id:string,provided?:string|null)=>trackArtworkUrl(origin,id,provided);
export type ArtistCredit={author_id:string;name:string};
export type LiveTrack={providerLyricsFormat?:'TEXT'|'LRC'|'NONE';lyricsFormat?:'TEXT'|'LRC'|'NONE'|null;providerTrackId:string;title:string;artist:string;artistCredits?:ArtistCredit[];durationMs:number|null;pairOperationId:string|null;metadataUnavailable?:boolean;coverUrl?:string|null};
export function isTrackId(id:unknown):id is string{return typeof id==='string'&&/^\d{1,20}$/.test(id)}
export function useCatalog(query:string|null,artist:string|null=null,authorId?:string){
 const [items,setItems]=useState<LiveTrack[]>([]),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const ctrl=useRef<AbortController|null>(null);
 // The server hashes this seed against every ready track before pagination.
 // Keep one seed for the current home traversal, never shuffle individual pages.
 const homeSeed=useRef<string|undefined>(undefined);
 const seenHomeCursors=useRef(new Set<string>());
 const moreBusy=useRef(false);
 // Follow every catalog cursor automatically and publish matching tracks as each page arrives.
 // No parallel requests, no per-track status calls, and abort immediately on navigation.
 async function loadArtist(signal:AbortSignal){
  let next:string|null=null;const seen=new Set<string>(),ids=new Set<string>();
  do{
   if(signal.aborted)throw signal.reason;
   const page=await api.catalog(next,signal);
   if(signal.aborted)throw signal.reason;
   const matches=(normalizeTracks(page,true) as LiveTrack[]).filter(t=>{
    if(!t.pairOperationId||ids.has(t.providerTrackId)||!(authorId&&t.artistCredits?.length?t.artistCredits.some(a=>a.author_id===authorId):matchesArtist(t.artist,artist)))return false;
    ids.add(t.providerTrackId);return true;
   });
   if(authorId){
    const missing=matches.filter(t=>!t.artistCredits?.length);
    const credits=new Map<string,ArtistCredit[]>();
    for(let i=0;i<missing.length;i+=20){
     const batch=missing.slice(i,i+20).map(t=>t.providerTrackId);
     const payload=await api.trackArtists(batch,signal);
     if(signal.aborted)throw signal.reason;
     for(const row of Array.isArray(payload?.items)?payload.items:[])if(batch.includes(row?.providerTrackId))credits.set(row.providerTrackId,normalizeArtistCredits(row.artistCredits));
    }
    const verified=matches.map(t=>({...t,artistCredits:t.artistCredits?.length?t.artistCredits:credits.get(t.providerTrackId)})).filter(t=>t.artistCredits?.some(a=>a.author_id===authorId));
    if(verified.length)setItems(old=>[...old,...verified]);
   }else if(matches.length)setItems(old=>[...old,...matches]);
   const candidate=page.nextCursor;
   if(candidate===null||candidate===undefined)break;
   if(typeof candidate!=='string'||!isTrackId(candidate)||seen.has(candidate))throw Error('Некорректная пагинация каталога');
   seen.add(candidate);next=candidate;
  }while(true);
 }
 useEffect(()=>{const c=new AbortController();ctrl.current=c;moreBusy.current=false;seenHomeCursors.current.clear();homeSeed.current=query===null&&artist===null?crypto.randomUUID():undefined;const seed=homeSeed.current;setItems([]);setCursor(null);setError('');if(artist===null&&query!==null&&query.trim().length<2){setLoading(false);return()=>{c.abort();ctrl.current?.abort()}}setLoading(true);const t=window.setTimeout(async()=>{try{if(artist!==null){await loadArtist(c.signal);return}const r=query===null?await api.catalog(null,c.signal,seed):await api.search(query,c.signal);if(!c.signal.aborted){setItems(normalizeTracks(r,query===null));setCursor(query===null&&typeof r.nextCursor==='string'?r.nextCursor:null);}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}},artist!==null||query===null?0:650);return()=>{clearTimeout(t);c.abort();ctrl.current?.abort()}},[query,artist,authorId,retry]);
 async function more(){if(artist!==null||query!==null||!cursor||loading||moreBusy.current)return;moreBusy.current=true;const seed=homeSeed.current;const c=new AbortController();ctrl.current=c;setLoading(true);setError('');try{const r=await api.catalog(cursor,c.signal,seed);if(!c.signal.aborted){setItems(old=>{const seen=new Set(old.map(t=>t.providerTrackId));return [...old,...(normalizeTracks(r,true) as LiveTrack[]).filter(t=>{if(seen.has(t.providerTrackId))return false;seen.add(t.providerTrackId);return true})]});seenHomeCursors.current.add(cursor);const next=typeof r.nextCursor==='string'&&isTrackId(r.nextCursor)&&!seenHomeCursors.current.has(r.nextCursor)?r.nextCursor:null;setCursor(next)}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(ctrl.current===c){moreBusy.current=false;if(!c.signal.aborted)setLoading(false)}}}
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
 type ArtistPopularResult={name:string|null;artistId:string|null;items:LiveTrack[];cursor:string|null;error:string;loading:boolean};
 const emptyArtist=(name:string|null,loading=false):ArtistPopularResult=>({name,artistId:null,items:[],cursor:null,error:'',loading});
 export function useArtistPopular(name:string|null,authorId?:string){
  const [result,setResult]=useState<ArtistPopularResult>(emptyArtist(null));
  const active=useRef<AbortController|null>(null),busy=useRef(false);
  async function load(c:AbortController,artistName:string,previous:ArtistPopularResult){
   if(c.signal.aborted||busy.current)return;
   busy.current=true;setResult({...previous,error:'',loading:true});
   const deadline=window.setTimeout(()=>{if(active.current===c&&!c.signal.aborted){c.abort();busy.current=false;setResult({...previous,error:'Время ожидания популярных песен истекло',loading:false})}},20000);
   try{
    const cursor=previous.cursor;
    const payload=await api.artistPopular(artistName,c.signal,previous.artistId??authorId,cursor??undefined);
    if(!isTrackId(payload.artistId)||((previous.artistId??authorId)&&(previous.artistId??authorId)!==payload.artistId))throw Error('Некорректный ответ артиста');
    const seen=new Set(previous.items.map(t=>t.providerTrackId));
    const items=(normalizeTracks(payload) as LiveTrack[]).filter(t=>{if(seen.has(t.providerTrackId))return false;seen.add(t.providerTrackId);return true});
    const next=payload.nextCursor;
    if(next!==undefined&&next!==null&&(typeof next!=='string'||!['20','40','60','80'].includes(next)||Number(next)!==Number(cursor??0)+20))throw Error('Некорректная пагинация артиста');
    if(!c.signal.aborted&&active.current===c)setResult({name:artistName,artistId:payload.artistId,items:[...previous.items,...items],cursor:typeof next==='string'?next:null,error:'',loading:false});
   }catch(e){
    if(!c.signal.aborted&&active.current===c)setResult({...previous,error:e instanceof ApiError&&[404,501].includes(e.status)?'Популярные песни пока недоступны: требуется обновление API.':e instanceof Error?e.message:'Не удалось загрузить популярные песни',loading:false});
   }finally{clearTimeout(deadline);if(active.current===c)busy.current=false}
  }
  useEffect(()=>{
   active.current?.abort();busy.current=false;
   if(name===null){setResult(emptyArtist(null));return}
   const c=new AbortController();active.current=c;setResult(emptyArtist(name,true));
   const timer=window.setTimeout(()=>void load(c,name,emptyArtist(name)),0);
   return()=>{clearTimeout(timer);active.current?.abort();busy.current=false};
  },[name,authorId]);
  const current=result.name===name&&(!authorId||!result.artistId||result.artistId===authorId)?result:emptyArtist(name,name!==null);
  function more(){if(!name||busy.current||current.loading||!current.cursor)return;const c=new AbortController();active.current=c;void load(c,name,current)}
  function retry(){if(!name||busy.current||current.loading)return;const c=new AbortController();active.current=c;void load(c,name,current)}
  return {...current,more,retry};
 }
