import {t as trUi} from './i18n.mjs';
export function apiOrigin(value){if(typeof value!=='string'||!value.trim())return null;const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw new Error(trUi('Укажите точный HTTPS origin без пути'));return u.origin;}
export class ApiError extends Error{constructor(status,retryAfter=0,path=''){super(status===429?trUi('Слишком много запросов (HTTP 429). Повторите через ')+Math.max(1,Math.ceil(retryAfter/1000))+trUi(' сек.'):status===0?trUi('Сеть или CORS недоступны'):'API HTTP '+status);this.status=status;this.retryAfter=retryAfter;this.path=path}}
export function retryAfterMs(value,now=Date.now()){if(value===null||value===undefined||!String(value).trim())return 30000;const raw=String(value).trim();if(/^\d+$/.test(raw)){const n=Number(raw)*1000;return Number.isFinite(n)?Math.max(1000,n):30000}const date=Date.parse(raw);return Number.isFinite(date)?Math.max(1000,date-now):30000}
function abortable(promise,signal){if(!signal)return promise;if(signal.aborted)return Promise.reject(signal.reason);return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))})}

function client(origin,fetcher){
 const base=apiOrigin(origin);if(!base)throw Error(trUi('API origin не настроен'));const cooldowns=new Map();
 return async(path,{query,body,token,signal,method='GET',credentials='omit',headers={}}={})=>{
 if(signal?.aborted)throw signal.reason;const route=method+' '+path;const remaining=(cooldowns.get(route)??0)-Date.now();if(remaining>0)throw new ApiError(429,remaining,path);cooldowns.delete(route);
 const url=new URL(path,base);for(const [key,value] of Object.entries(query??{}))if(value!==null&&value!==undefined)url.searchParams.set(key,String(value));
 let response;try{response=await fetcher(url.toString(),{method,signal,credentials,cache:'no-store',redirect:'error',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})}catch(e){if(signal?.aborted)throw e;throw new ApiError(0,0,path);}
 if(!response.ok){const wait=response.status===429?retryAfterMs(response.headers.get('retry-after')):0;if(wait)cooldowns.set(route,Date.now()+wait);const error=new ApiError(response.status,wait,path);error.lyricsProvenance=response.headers.get('x-anyminus-lyrics-provenance');throw error}if(response.status===204)return null;return response.json();
 };
}
export function mediaUrl(origin,pairId,role,value){const u=new URL(value,origin);if(!/^[0-9a-f-]{36}$/i.test(pairId)||!['instrumental','vocals','artwork','lyrics'].includes(role)||u.origin!==origin||u.pathname!=='/demo/catalog/media/'+pairId+'/'+role||u.search||u.hash||u.username||u.password)throw Error(trUi('Недопустимый адрес медиа'));return u.toString()}
export function createDemoApi(origin,fetcher=fetch){
 const call=client(origin,fetcher);let session=null,inflight=null;
 function auth(signal){if(signal?.aborted)return Promise.reject(signal.reason);if(session&&session.expires>Date.now()+30000)return Promise.resolve(session.value);if(!inflight){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);inflight=call('/demo/auth',{method:'POST',body:{},signal:controller.signal}).then(value=>{if(typeof value?.accessToken!=='string'||!Number.isFinite(value.expiresIn)||value.expiresIn<=0)throw Error(trUi('Некорректный ответ авторизации'));session={value,expires:Date.now()+value.expiresIn*1000};return value}).finally(()=>{clearTimeout(timer);inflight=null})}return abortable(inflight,signal)}

 return {
 search:(q,signal,telegramToken=undefined)=>{const text=q.trim();if(text.length<2||text.length>200)throw Error(trUi('Поиск: 2–200 символов'));return call('/demo/search',{query:{q:text,limit:20},token:telegramToken,signal})},
 /** @param {string} name @param {AbortSignal} signal @param {string} [artistId] @param {string} [cursor] */
 artistPopular:(name,signal,artistId=undefined,cursor=undefined)=>{const text=name.trim();if(!text||text.length>200)throw Error(trUi('Некорректное имя артиста'));if((artistId!==undefined&&!/^\d{1,20}$/.test(artistId))||(cursor!==undefined&&(!/^(20|40|60|80)$/.test(cursor)||!artistId)))throw Error(trUi('Некорректная страница артиста'));return call('/demo/artists/popular',{query:artistId===undefined?{name:text}:{artistId,cursor},signal})},
 /** @param {string[]} ids @param {AbortSignal} [signal] */
 trackArtists:(ids,signal)=>{if(!ids.length||ids.length>20||ids.some(id=>!/^\d{1,20}$/.test(id)))throw Error(trUi('Некорректные ID песен'));return call('/demo/track-artists',{query:{ids:ids.join(',')},signal})},
 /** @param {string|null} cursor @param {AbortSignal} [signal] @param {string} [seed] */
 catalog:(cursor,signal,seed=undefined)=>call('/demo/catalog',{query:{limit:100,cursor,seed},signal}),
 auth,
 invalidateAuth:()=>{session=null},
 telegram:(initData,signal)=>call('/v1/auth/telegram',{method:'POST',body:{initData},signal}),
 telegramStart:(challenge,signal)=>call('/v1/auth/telegram/start',{method:'POST',body:{challenge},signal}),
 telegramExchange:(code,state,verifier,signal)=>call('/v1/auth/telegram/exchange',{method:'POST',body:{code,state,verifier},signal}),
 metadata:(id,token,signal)=>call('/demo/track-metadata/'+encodeURIComponent(id),{token,signal}),
 lyrics:(id,durationMs,signal,telegramToken)=>call('/demo/lyrics',{query:{id,format:'LRC',durationMs},signal,token:telegramToken}),
 /** @param {string[]} trackIds @param {string} token @param {AbortSignal} [signal] */
 readyTicket:(trackIds,token,signal)=>call('/demo/notifications/ticket',{method:'POST',body:{trackIds},token,signal}),
 status:(providerTrackId,token,signal)=>call('/demo/karaoke/status',{query:{providerTrackId},token,signal}),
 statusByOperation:(operationId,token,signal)=>call('/demo/karaoke/status-by-operation',{query:{operationId},token,signal}),
 enqueue:(track,token,signal)=>{if(!token)throw Error(trUi('Требуется сессия'));if(!/^\d{1,20}$/.test(track.providerTrackId)||!Number.isSafeInteger(track.durationMs)||track.durationMs<1000||track.durationMs>900000)throw Error(trUi('Некорректные метаданные песни'));return call('/demo/karaoke',{method:'POST',body:{providerTrackId:track.providerTrackId,title:track.title,artist:track.artist,durationMs:track.durationMs},token,signal})},
 playback:(pairId,providerTrackId,token,signal)=>call('/demo/catalog/playback',{method:'POST',body:{pairOperationId:pairId,providerTrackId,mediaTicket:true},token,signal,credentials:'include'}),
 storedLyrics:(pairId,token,signal,mediaTicket=undefined)=>call('/demo/catalog/media/'+encodeURIComponent(pairId)+'/lyrics',{token,signal,credentials:'include',headers:mediaTicket?{'X-AnyMinus-Media-Ticket':mediaTicket}:{}}),
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
export function validPairId(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
/** @param {unknown} raw */
export function normalizeArtistCredits(raw){const seen=new Set();return Array.isArray(raw)?raw.slice(0,20).flatMap(a=>{if(!a||typeof a.author_id!=='string'||!/^\d{1,20}$/.test(a.author_id)||seen.has(a.author_id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>512)return [];seen.add(a.author_id);return [{author_id:a.author_id,name:a.name}]}):[]}
/** @param {any} t */
export function providerLyricsHint(t){if(t.providerLyricsFormat==='TEXT'||t.providerLyricsFormat==='LRC'||t.providerLyricsFormat==='NONE')return t.providerLyricsFormat;if(t.lyricsSyncAvailable===true)return 'LRC';if(t.lyricsSyncAvailable===false&&t.lyricsTextAvailable===true)return 'TEXT';if(t.lyricsSyncAvailable===false&&t.lyricsTextAvailable===false&&t.lyricsAvailable!==true)return 'NONE';return undefined}
export function normalizeTracks(payload,ready=false){if(!payload||!Array.isArray(payload.items))throw Error(trUi('Неверный ответ каталога'));return payload.items.flatMap(t=>{if(!t||typeof t.providerTrackId!=='string'||!/^\d{1,20}$/.test(t.providerTrackId)||typeof t.title!=='string'||typeof t.artist!=='string')return [];const durationMs=ready?Math.round(t.durationSeconds*1000):t.durationMs;const status=t.karaokeStatus;const pair=ready?t.pairOperationId:status?.state==='ready'?status.pairOperationId:null;return [{providerTrackId:t.providerTrackId,title:t.title,artist:t.artist,providerLyricsFormat:providerLyricsHint(t),lyricsFormat:t.lyricsFormat==='TEXT'||t.lyricsFormat==='LRC'||t.lyricsFormat==='NONE'?t.lyricsFormat:t.lyricsFormat===null?null:undefined,artistCredits:Array.isArray(t.artistCredits)?normalizeArtistCredits(t.artistCredits):undefined,durationMs:Number.isFinite(durationMs)&&durationMs>0?Math.round(durationMs):null,pairOperationId:validPairId(pair)?pair:null,coverUrl:typeof t.coverUrl==='string'||t.coverUrl===null?t.coverUrl:typeof t.artworkUrl==='string'?t.artworkUrl:undefined}];});}
export function normalizeJob(payload){if(!payload||!['none','queued','running','ready','failed'].includes(payload.state))throw Error(trUi('Неизвестный статус караоке'));return {state:payload.state,pairOperationId:typeof payload.pairOperationId==='string'?payload.pairOperationId:null,retryable:payload.retryable===true,...(payload.state==='ready'&&(['TEXT','LRC','NONE'].includes(payload.lyricsFormat)||payload.lyricsFormat===null)?{lyricsFormat:payload.lyricsFormat}:{})};}
