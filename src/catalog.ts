import {useEffect,useRef,useState} from 'react';
import {apiOrigin,createDemoApi,normalizeTracks} from './api.mjs';
import {trackArtworkUrl} from './artwork.mjs';
export const origin=apiOrigin(import.meta.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev')!;
export const api=createDemoApi(origin);
export const coverFor=(id:string)=>trackArtworkUrl(origin,id);
export type LiveTrack={providerTrackId:string;title:string;artist:string;durationMs:number|null;pairOperationId:string|null};
export function isTrackId(id:unknown):id is string{return typeof id==='string'&&/^\d{1,20}$/.test(id)}
export function useCatalog(query:string|null){
 const [items,setItems]=useState<LiveTrack[]>([]),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const ctrl=useRef<AbortController|null>(null);
 useEffect(()=>{const c=new AbortController();ctrl.current=c;setItems([]);setCursor(null);setError('');if(query!==null&&query.trim().length<2){setLoading(false);return()=>{c.abort();ctrl.current?.abort()}}setLoading(true);const t=window.setTimeout(async()=>{try{const r=query===null?await api.catalog(null,c.signal):await api.search(query,c.signal);if(!c.signal.aborted){setItems(normalizeTracks(r,query===null));setCursor(query===null&&typeof r.nextCursor==='string'?r.nextCursor:null);}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}},query===null?0:650);return()=>{clearTimeout(t);c.abort();ctrl.current?.abort()}},[query,retry]);
 async function more(){if(query!==null||!cursor||loading)return;const c=new AbortController();ctrl.current=c;setLoading(true);setError('');try{const r=await api.catalog(cursor,c.signal);if(!c.signal.aborted){setItems(old=>{const seen=new Set(old.map(t=>t.providerTrackId));return [...old,...(normalizeTracks(r,true) as LiveTrack[]).filter(t=>!seen.has(t.providerTrackId))]});setCursor(typeof r.nextCursor==='string'?r.nextCursor:null)}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'API недоступен')}finally{if(!c.signal.aborted)setLoading(false)}}
 return {items,cursor,error,loading,retry:()=>setRetry(v=>v+1),more};
}
export async function lookupTrack(id:string,signal:AbortSignal):Promise<LiveTrack>{if(!isTrackId(id))throw Error('Песня не найдена');const auth=await api.auth(signal);if(typeof auth.accessToken!=='string')throw Error('Не удалось авторизоваться');const meta=await api.metadata(id,auth.accessToken,signal);const track=normalizeTracks({items:[{...meta,providerTrackId:id}]})[0];if(!track)throw Error('Песня не найдена');return track;}
