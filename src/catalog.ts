import {useEffect,useRef,useState} from 'react';
import {apiOrigin,createDemoApi,normalizeTracks,normalizeJob,ApiError} from './api.mjs';
import {trackArtworkUrl} from './artwork.mjs';
export const origin=apiOrigin(import.meta.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev')!;
export const api=createDemoApi(origin);
export const coverFor=(id:string)=>trackArtworkUrl(origin,id);
export type LiveTrack={providerTrackId:string;title:string;artist:string;durationMs:number|null;pairOperationId:string|null;metadataUnavailable?:boolean};
export function isTrackId(id:unknown):id is string{return typeof id==='string'&&/^\d{1,20}$/.test(id)}
export function useCatalog(query:string|null){
 const [items,setItems]=useState<LiveTrack[]>([]),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const ctrl=useRef<AbortController|null>(null);
 useEffect(()=>{const c=new AbortController();ctrl.current=c;setItems([]);setCursor(null);setError('');if(query!==null&&query.trim().length<2){setLoading(false);return()=>{c.abort();ctrl.current?.abort()}}setLoading(true);const t=window.setTimeout(async()=>{try{const r=query===null?await api.catalog(null,c.signal):await api.search(query,c.signal);if(!c.signal.aborted){setItems(normalizeTracks(r,query===null));setCursor(query===null&&typeof r.nextCursor==='string'?r.nextCursor:null);}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}},query===null?0:650);return()=>{clearTimeout(t);c.abort();ctrl.current?.abort()}},[query,retry]);
 async function more(){if(query!==null||!cursor||loading)return;const c=new AbortController();ctrl.current=c;setLoading(true);setError('');try{const r=await api.catalog(cursor,c.signal);if(!c.signal.aborted){setItems(old=>{const seen=new Set(old.map(t=>t.providerTrackId));return [...old,...(normalizeTracks(r,true) as LiveTrack[]).filter(t=>!seen.has(t.providerTrackId))]});setCursor(typeof r.nextCursor==='string'?r.nextCursor:null)}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}}
 return {items,cursor,error,loading,retry:()=>setRetry(v=>v+1),more};
}
function transient(e:unknown){return e instanceof ApiError&&(e.status===0||e.status===408||[500,502,503,504].includes(e.status))}
function delay(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(signal.reason);return}const abort=()=>{clearTimeout(timer);reject(signal.reason)};const timer=window.setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},ms);signal.addEventListener('abort',abort,{once:true})})}
async function retryRead<T>(read:()=>Promise<T>,signal:AbortSignal):Promise<T>{try{return await read()}catch(e){if(signal.aborted||!transient(e))throw e;await delay(700,signal);return read()}}
export async function lookupTrack(id:string,signal:AbortSignal):Promise<LiveTrack>{
 if(!isTrackId(id))throw Error('Песня не найдена');
 const auth=await api.auth(signal);if(typeof auth.accessToken!=='string')throw Error('Не удалось авторизоваться');
 try{
 const meta=await retryRead(()=>api.metadata(id,auth.accessToken,signal),signal);
 const track=normalizeTracks({items:[{...meta,providerTrackId:id}]})[0];if(!track)throw Error('Песня не найдена');return track;
 }catch(e){
 if(signal.aborted||!transient(e))throw e;
 // Ready audio must not depend on the availability of upstream song metadata.
 // Check the authoritative ready status and recover actual metadata from the public catalog when available.
 const raw=await retryRead(()=>api.status(id,auth.accessToken,signal),signal);
 const job=normalizeJob(raw);
 if(job.state!=='ready'||!job.pairOperationId)throw e;
 let fromCatalog:LiveTrack|undefined;
 try{const catalog=await api.catalog(null,signal);fromCatalog=(normalizeTracks(catalog,true) as LiveTrack[]).find(t=>t.providerTrackId===id)}catch(cause){if(signal.aborted)throw cause}
 if(signal.aborted)throw signal.reason;
 const duration=Number(raw.durationSeconds);
 return {providerTrackId:id,title:fromCatalog?.title??'Песня '+id,artist:fromCatalog?.artist??'',durationMs:fromCatalog?.durationMs??(Number.isFinite(duration)&&duration>0?Math.round(duration*1000):null),pairOperationId:job.pairOperationId,metadataUnavailable:!fromCatalog};
 }
}
