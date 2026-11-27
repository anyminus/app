import {t as trUi} from './i18n.mjs';
import {readStem,writeStem,removeStem,STEM_LIMIT} from './stemCache';
const LIMIT=STEM_LIMIT,IDLE_MS=45000,CHECKPOINT_BYTES=256*1024,CHECKPOINT_MS=2000;
export type DownloadPhase='connecting'|'loading'|'waiting'|'retrying'|'done'|'decoding';
export type StemProgress={received:number;total:number|null;phase:DownloadPhase;cached?:number};
export type DownloadProgress={stems:StemProgress[];phase:DownloadPhase};
type Checkpoint={parts:Uint8Array<ArrayBuffer>[];total:number|null;done:boolean};
type Stem={pending?:Checkpoint;writing:boolean;parts:Uint8Array<ArrayBuffer>[];received:number;total:number|null;done:boolean;phase:DownloadPhase;cached:number;saved:number;savedAt:number;write:Promise<void>};
const available=()=>!document.hidden&&navigator.onLine!==false;
const check=(signal:AbortSignal)=>{if(signal.aborted)throw signal.reason??new DOMException(trUi('Отменено'),'AbortError')};
class PermanentError extends Error{}
function wait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{check(signal);const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve()};const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason)};const timer=window.setTimeout(finish,ms);signal.addEventListener('abort',abort,{once:true})})}
export async function waitForForeground(signal:AbortSignal){
 check(signal);if(available())return;
 await new Promise<void>((resolve,reject)=>{
  const cleanup=()=>{document.removeEventListener('visibilitychange',change);window.removeEventListener('online',change);signal.removeEventListener('abort',abort)};
  const change=()=>{if(available()){cleanup();resolve()}};
  const abort=()=>{cleanup();reject(signal.reason)};
  document.addEventListener('visibilitychange',change);window.addEventListener('online',change);signal.addEventListener('abort',abort,{once:true});change();
 });
}
function reset(s:Stem){s.parts=[];s.received=0;s.total=null;s.done=false;s.cached=0;s.saved=0;s.savedAt=0}
export class StemDownload {
 readonly urls:string[];
 private stems:Stem[];private restored=false;
 private mediaTicket:string|undefined;
 setMediaTicket(ticket:unknown){this.mediaTicket=typeof ticket==='string'&&ticket.length<=8192&&/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/.test(ticket)?ticket:undefined;}
 constructor(urls:string[]){this.urls=[...urls];this.stems=urls.map(()=>({parts:[],received:0,total:null,done:false,phase:'connecting',cached:0,saved:0,savedAt:0,writing:false,write:Promise.resolve()}));}
 matches(urls:string[]){return urls.length===this.urls.length&&urls.every((u,i)=>u===this.urls[i])}
 async clear(){await Promise.all(this.stems.map((s,i)=>this.discard(s,this.urls[i])));}
 private async discard(s:Stem,url:string){reset(s);await s.write;await removeStem(url);}
 private checkpoint(s:Stem,url:string,force=false){
  if(!s.received||(!force&&s.saved>0&&s.received-s.saved<CHECKPOINT_BYTES&&Date.now()-s.savedAt<CHECKPOINT_MS))return s.write;
  const parts=s.parts.slice(),total=s.total,done=s.done;s.saved=s.received;s.savedAt=Date.now();
  s.pending={parts,total,done};if(!s.writing){s.writing=true;s.write=(async()=>{try{while(s.pending){const next=s.pending;s.pending=undefined;await writeStem(url,next.parts,next.total,next.done)}}catch{}finally{s.writing=false}})()}return s.write;
 }
 private async restore(signal:AbortSignal){if(this.restored)return;this.restored=true;await Promise.all(this.stems.map(async(s,i)=>{if(s.received)return;try{const entry=await readStem(this.urls[i]);if(!entry||signal.aborted)return;const bytes=new Uint8Array(await entry.data.arrayBuffer());if(signal.aborted||bytes.byteLength!==entry.data.size)return;s.parts=[bytes];s.received=bytes.byteLength;s.total=entry.total;s.done=entry.done;s.cached=s.received;s.saved=s.received;s.savedAt=Date.now();s.phase=s.done?'done':'loading'}catch{}}));check(signal);}
 snapshot(phase?:DownloadPhase):DownloadProgress{
  const stems=this.stems.map(({received,total,phase,cached})=>({received,total,phase,cached}));
  return {stems,phase:phase??(stems.some(s=>s.phase==='waiting')?'waiting':stems.some(s=>s.phase==='retrying')?'retrying':stems.every(s=>s.phase==='done')?'done':'loading')};
 }
 async fetchAll(signal:AbortSignal,publish:(progress:DownloadProgress)=>void,refresh:()=>Promise<void>){
  const group=new AbortController();const abort=()=>group.abort(signal.reason);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  let renewal:Promise<void>|null=null,renewed=0;
  const renew=()=>{if(renewal)return renewal;if(Date.now()-renewed<2000)return Promise.resolve();renewal=refresh().then(()=>{renewed=Date.now()}).finally(()=>{renewal=null});return renewal};
  let firstError:unknown;let lastUpdate=0,timer:number|undefined;
  const emit=(force=false)=>{if(group.signal.aborted)return;if(force||performance.now()-lastUpdate>=100){clearTimeout(timer);timer=undefined;lastUpdate=performance.now();publish(this.snapshot())}else if(timer===undefined)timer=window.setTimeout(()=>{timer=undefined;emit(true)},100)};
  try{
   await this.restore(group.signal);emit(true);
   const tasks=this.stems.map((stem,i)=>this.download(stem,this.urls[i],group.signal,emit,renew).catch(e=>{if(!group.signal.aborted){firstError=e;group.abort(e)}throw e}));
   const outcomes=await Promise.allSettled(tasks);check(signal);
   if(firstError!==undefined)throw firstError;
   if(outcomes.some(o=>o.status==='rejected'))throw Error(trUi('Загрузка прервана'));
   clearTimeout(timer);publish(this.snapshot('decoding'));
   return this.stems.map(s=>{const bytes=new Uint8Array(s.received);let offset=0;for(const part of s.parts){bytes.set(part,offset);offset+=part.byteLength}return bytes});
  }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);group.abort()}
 }
 private async download(s:Stem,url:string,signal:AbortSignal,emit:(force?:boolean)=>void,renew:()=>Promise<void>){
  if(s.done){s.phase='done';emit(true);return}
  let failures=0,needsRenew=false;
  while(!s.done){
   check(signal);
   if(!available()){s.phase='waiting';emit(true);await waitForForeground(signal);needsRenew=true}
   if(failures){s.phase='retrying';emit(true);await wait(Math.min(4000,500*2**(failures-1)),signal)}
   check(signal);
   const attempt=new AbortController();let timer:number|undefined,paused=false;
   const cancel=()=>attempt.abort(signal.reason);
   const background=()=>{if(!available()){paused=true;attempt.abort()}};
   const arm=()=>{clearTimeout(timer);timer=window.setTimeout(()=>attempt.abort(),IDLE_MS)};
   signal.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',background);window.addEventListener('offline',background);
   if(signal.aborted)cancel();background();
   let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
   try{
    if(needsRenew){await renew();needsRenew=false;check(signal);if(attempt.signal.aborted)throw Error(trUi('Загрузка приостановлена'))}
    arm();const offset=s.received;s.phase=offset?'retrying':'loading';emit(true);
    const res=await fetch(url,{credentials:'include',cache:'no-store',redirect:'error',signal:attempt.signal,headers:{...(offset?{Range:'bytes='+offset+'-'}:{}),...(this.mediaTicket?{'X-AnyMinus-Media-Ticket':this.mediaTicket}:{})}});
    if(!res.ok||!res.body){await res.body?.cancel().catch(()=>{});if(res.status===416&&offset&&s.total===offset){await this.discard(s,url);throw Error(trUi('Проверяем полноту дорожки повторно'))}if(res.status>=400&&res.status<500&&![401,403,404,408,429].includes(res.status))throw new PermanentError(trUi('Дорожка недоступна (HTTP ')+res.status+')');throw Error(trUi('Сервер не отдал дорожку (HTTP ')+res.status+')')}
    reader=res.body.getReader();
    let expectedEnd:number|null=null;
    const lengthValue=res.headers.get('content-length');const size=lengthValue&&/^\d+$/.test(lengthValue)?Number(lengthValue):null;
    if(res.status===206){
     const match=res.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
     if(!match)throw new PermanentError(trUi('Сервер вернул неверный диапазон дорожки'));
     const [from,to,total]=match.slice(1).map(Number);
     if(from!==offset||to<from||to>=total||!Number.isSafeInteger(total)||total>LIMIT||(size!==null&&size!==to-from+1)||(s.total!==null&&s.total!==total)){await this.discard(s,url);throw new PermanentError(trUi('Размер или диапазон дорожки изменился. Повторите загрузку.'))}
     s.total=total;expectedEnd=to+1;
    }else if(res.status===200){
     // Server ignored Range; discard old prefix, never append a full response.
     if(offset)await this.discard(s,url);s.total=size;expectedEnd=size;
     if(size!==null&&(!Number.isSafeInteger(size)||size<=0||size>LIMIT))throw new PermanentError(trUi('Дорожка превышает допустимый размер 19 МБ'));
    }else throw new PermanentError(trUi('Некорректный ответ сервера'));
    s.phase='loading';emit(true);
    while(true){
     arm();const chunk=await reader.read();check(signal);if(attempt.signal.aborted)throw Error(trUi('Загрузка прервана'));if(chunk.done)break;
     const next=s.received+chunk.value.byteLength;
     if(next>LIMIT||(expectedEnd!==null&&next>expectedEnd)){await this.discard(s,url);throw new PermanentError(trUi('Некорректный размер дорожки'))}
     if(chunk.value.byteLength){s.parts.push(new Uint8Array(chunk.value));s.received=next;failures=0;void this.checkpoint(s,url);emit()}
    }
    if(expectedEnd!==null&&s.received!==expectedEnd)throw Error(trUi('Дорожка получена не полностью'));
    if(s.total!==null&&s.received<s.total){failures=0;continue}
    if(!s.received)throw Error(trUi('Пустая дорожка'));s.total=s.received;s.done=true;s.phase='done';await this.checkpoint(s,url,true);emit(true);
   }catch(e){
    await this.checkpoint(s,url,true);check(signal);
    if(e instanceof PermanentError)throw e;
    needsRenew=true;
    if(paused||!available()){s.phase='waiting';emit(true);continue}
    failures++;if(failures>=4)throw Error(trUi('Связь прервана. Повторите загрузку — полученные данные сохранены.'));
    s.phase='retrying';emit(true);
   }finally{clearTimeout(timer);attempt.abort();signal.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',background);window.removeEventListener('offline',background);if(reader){void reader.cancel().catch(()=>{});reader.releaseLock()}}
  }
 }
}
