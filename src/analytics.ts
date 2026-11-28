import {api} from './catalog';
type Event={playbackId:string;trackId:string;mode:'original'|'karaoke';kind:'start'|'complete'};
const pending:Event[]=[];
let timer:ReturnType<typeof setTimeout>|undefined,flushing=false,delay=1000;
let tokenProvider:()=>string|null=()=>null;
export function setAnalyticsTokenProvider(provider:()=>string|null){tokenProvider=provider;return()=>{if(tokenProvider===provider)tokenProvider=()=>null}}
function schedule(ms:number){if(timer!==undefined||flushing||!pending.length)return;timer=setTimeout(()=>{timer=undefined;void flush()},ms)}
async function flush(){
 if(flushing||!pending.length)return;
 flushing=true;
 const batch=pending.slice(0,20);
 const signal=AbortSignal.timeout(15000);
 try{
  const telegram=tokenProvider();
  const token=telegram??(await api.auth(signal)).accessToken;
  await api.analytics(batch,token,signal);
  pending.splice(0,batch.length);delay=1000;
 }catch(e){
  const status=typeof e==='object'&&e&&'status' in e?Number(e.status):0;
  if(status===400||status===404){pending.splice(0,batch.length);delay=1000}
  else {if(status===401)api.invalidateAuth();delay=Math.min(60000,Math.max(5000,delay*2,typeof e==='object'&&e&&'retryAfter' in e?Number(e.retryAfter)||0:0))}
 }finally{flushing=false;schedule(delay)}
}
export function enqueuePlaybackEvent(event:Event){if(pending.length>=100)return;pending.push(event);schedule(1000)}
if(typeof window!=='undefined')window.addEventListener('online',()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined}schedule(1000)});
