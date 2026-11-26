export function apiOrigin(value){if(typeof value!=='string'||!value.trim())return null;const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw new Error('Укажите точный HTTPS origin без пути');return u.origin;}
export class ApiError extends Error{constructor(status){super(status===0?'Сеть или CORS недоступны':'API HTTP '+status);this.status=status}}
function client(origin,fetcher){
 const base=apiOrigin(origin);if(!base)throw Error('API origin не настроен');
 return async(path,{query,body,token,signal,method='GET',credentials='omit',headers={}}={})=>{
 const url=new URL(path,base);for(const [key,value] of Object.entries(query??{}))if(value!==null&&value!==undefined)url.searchParams.set(key,String(value));
 let response;try{response=await fetcher(url.toString(),{method,signal,credentials,cache:'no-store',redirect:'error',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}catch(e){if(signal?.aborted)throw e;throw new ApiError(0);}
 if(!response.ok)throw new ApiError(response.status);if(response.status===204)return null;return response.json();
 };
}
export function mediaUrl(origin,pairId,role,value){const u=new URL(value,origin);if(!/^[0-9a-f-]{36}$/i.test(pairId)||!['instrumental','vocals','artwork','lyrics'].includes(role)||u.origin!==origin||u.pathname!=='/demo/catalog/media/'+pairId+'/'+role||u.search||u.hash||u.username||u.password)throw Error('Недопустимый адрес медиа');return u.toString()}
export function createDemoApi(origin,fetcher=fetch){
 const call=client(origin,fetcher);
 return {
 search:(q,signal,telegramToken)=>{const text=q.trim();if(text.length<2||text.length>200)throw Error('Поиск: 2–200 символов');return call('/demo/search',{query:{q:text,limit:20},token:telegramToken,signal})},
 catalog:(cursor,signal,seed)=>call('/demo/catalog',{query:{limit:100,cursor,seed},signal}),
 auth:(signal)=>call('/demo/auth',{method:'POST',body:{},signal}),
 telegram:(initData,signal)=>call('/v1/auth/telegram',{method:'POST',body:{initData},signal}),
 metadata:(id,token,signal)=>call('/demo/track-metadata/'+encodeURIComponent(id),{token,signal}),
 lyrics:(id,durationMs,signal,telegramToken)=>call('/demo/lyrics',{query:{id,format:'LRC',durationMs},signal,token:telegramToken}),
 status:(providerTrackId,token,signal)=>call('/demo/karaoke/status',{query:{providerTrackId},token,signal}),
 statusByOperation:(operationId,token,signal)=>call('/demo/karaoke/status-by-operation',{query:{operationId},token,signal}),
 enqueue:(track,token,signal)=>{if(!token)throw Error('Требуется сессия');if(!/^\d{1,20}$/.test(track.providerTrackId)||!Number.isSafeInteger(track.durationMs)||track.durationMs<1000||track.durationMs>900000)throw Error('Некорректные метаданные песни');return call('/demo/karaoke',{method:'POST',body:{providerTrackId:track.providerTrackId,title:track.title,artist:track.artist,durationMs:track.durationMs},token,signal})},
 playback:(pairId,providerTrackId,token,signal)=>call('/demo/catalog/playback',{method:'POST',body:{pairOperationId:pairId,providerTrackId},token,signal,credentials:'include'}),
 storedLyrics:(pairId,token,signal)=>call('/demo/catalog/media/'+encodeURIComponent(pairId)+'/lyrics',{token,signal,credentials:'include'}),
 artwork:(id)=>/^\d{1,20}$/.test(id)?origin+'/demo/artwork/'+id:null
 };
}
export function createControlApi(origin,fetcher=fetch){
 const call=client(origin,fetcher);
 return {
 telegram:(initData,key,signal)=>call('/v1/auth/telegram',{method:'POST',body:{initData,bootstrapIdempotencyKey:key},credentials:'include',signal}),
 refresh:(csrf,signal)=>call('/v1/auth/refresh',{method:'POST',headers:{'X-CSRF-Token':csrf},credentials:'include',signal}),
 logout:(csrf,signal)=>call('/v1/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrf},credentials:'include',signal}),
 search:(q,token,cursor,signal)=>call('/v1/search',{query:{q,cursor,limit:20},token,signal}),
 library:(token,cursor,signal)=>call('/v1/library',{query:{cursor,limit:20},token,signal}),
 add:(track,token,key,signal)=>call('/v1/library',{method:'POST',body:{providerTrackId:track.providerTrackId,...(track.albumId?{albumId:track.albumId}:{})},token,headers:{'Idempotency-Key':key},signal}),
 remove:(id,token,signal)=>call('/v1/library/'+encodeURIComponent(id),{method:'DELETE',token,signal}),
 enqueue:(id,token,key,signal)=>call('/v1/library/'+encodeURIComponent(id)+'/karaoke',{method:'POST',body:{},token,headers:{'Idempotency-Key':key},signal}),
 job:(id,token,signal)=>call('/v1/jobs/'+encodeURIComponent(id),{token,signal}),
 ticket:(id,role,method,token,signal)=>call('/v1/playback-sessions/'+encodeURIComponent(id)+'/media-ticket',{method:'POST',body:{role,method},token,signal})
 };
}
export function normalizeTracks(payload,ready=false){if(!payload||!Array.isArray(payload.items))throw Error('Неверный ответ каталога');return payload.items.flatMap(t=>{if(!t||typeof t.providerTrackId!=='string'||!/^\d{1,20}$/.test(t.providerTrackId)||typeof t.title!=='string'||typeof t.artist!=='string')return [];const durationMs=ready?Math.round(t.durationSeconds*1000):t.durationMs;return [{providerTrackId:t.providerTrackId,title:t.title,artist:t.artist,durationMs:Number.isFinite(durationMs)&&durationMs>0?Math.round(durationMs):null,pairOperationId:ready&&typeof t.pairOperationId==='string'?t.pairOperationId:null}];});}
export function normalizeJob(payload){if(!payload||!['none','queued','running','ready','failed'].includes(payload.state))throw Error('Неизвестный статус караоке');return {state:payload.state,pairOperationId:typeof payload.pairOperationId==='string'?payload.pairOperationId:null,retryable:payload.retryable===true};}
