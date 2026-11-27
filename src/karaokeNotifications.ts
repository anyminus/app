import {useEffect,useRef} from 'react';
import {api,origin,isTrackId,type LiveTrack} from './catalog';
import {normalizeJob,validPairId} from './api.mjs';
export type KaraokeNotice={track:LiveTrack;state:'waiting'|'ready'|'failed';requestedAt:number};
export type KaraokeNotices=Record<string,KaraokeNotice>;
const MAX_AGE=24*60*60*1000;
const PROTOCOL='anyminus.ready.v1';
// One foreground socket for this tab's pending tracks; hints never make a track
// ready on their own. The existing status API remains the source of truth.
export function useKaraokeWatch(entries:KaraokeNotices,currentTrackId:string|null,getToken:()=>string|null,update:(id:string,state:'ready'|'failed',track?:LiveTrack)=>void){
 const latest=useRef({entries,getToken,update});latest.current={entries,getToken,update};
 const key=Object.values(entries).filter(e=>e?.state==='waiting'&&isTrackId(e.track?.providerTrackId)&&e.track.providerTrackId!==currentTrackId).map(e=>e.track.providerTrackId).sort().slice(0,50).join(',');
 const nextIndex=useRef(0);
 useEffect(()=>{
  if(!key)return;
  const ids=key.split(','),allowed=new Set(ids),priority=new Set<string>();
  let stopped=false,busy=false,healthy=false,connecting=false;let socket:WebSocket|null=null,controller:AbortController|null=null,ticketAbort:AbortController|null=null;
  let last=0,nextConnect=0,reconnectDelay=10000,lastPong=0,lastPing=0,opened=0;
  let timer:number|undefined,followup:number|undefined;
  const foreground=()=>document.visibilityState!=='hidden';
  async function check(force=false){
   if(stopped||busy||!foreground())return;
   if(!force&&!priority.size&&Date.now()-last<(healthy?60000:10000))return;
   const pending=ids.map(id=>latest.current.entries[id]).filter(e=>e?.state==='waiting');
   if(!pending.length)return;
   busy=true;last=Date.now();
   try{
    const urgent=pending.filter(e=>priority.has(e.track.providerTrackId));
    const selected=urgent.slice(0,3);
    const count=Math.min(pending.length,3);
    for(let i=0;i<count&&selected.length<3;i++){
      const entry=pending[(nextIndex.current+i)%pending.length];
      if(!selected.includes(entry))selected.push(entry);
    }
    nextIndex.current=(nextIndex.current+count)%pending.length;
    for(const entry of selected){
     if(stopped)break;
     const id=entry.track.providerTrackId;priority.delete(id);
     if(Date.now()-entry.requestedAt>MAX_AGE){latest.current.update(id,'failed');continue}
     const c=new AbortController();controller=c;const deadline=window.setTimeout(()=>c.abort(),12000);
     try{
      const token=latest.current.getToken()??(await api.auth(c.signal)).accessToken;
      const raw=await api.status(id,token,c.signal);const job=normalizeJob(raw);
      if(stopped||c.signal.aborted||latest.current.entries[id]?.state!=='waiting')continue;
      if(job.state==='ready'&&validPairId(job.pairOperationId)){
       const duration=Number(raw.durationSeconds);
       latest.current.update(id,'ready',{...entry.track,pairOperationId:job.pairOperationId,lyricsFormat:job.lyricsFormat,durationMs:Number.isFinite(duration)&&duration>0?Math.round(duration*1000):entry.track.durationMs});
      }else if(job.state==='failed'||(job.state==='none'&&Date.now()-entry.requestedAt>120000))latest.current.update(id,'failed');
     }catch(e){if(!stopped&&e instanceof Error&&'status' in e&&e.status===401)api.invalidateAuth()}
     finally{clearTimeout(deadline)}
    }
   }finally{busy=false;if(priority.size&&!stopped&&foreground())followup=window.setTimeout(()=>void check(true),0)}
  }
  function offline(){
   healthy=false;connecting=false;nextConnect=Date.now()+reconnectDelay;reconnectDelay=Math.min(reconnectDelay*2,60000);
   if(socket){const previous=socket;socket=null;try{previous.close()}catch{}}
   if(!stopped)void check();
  }
  async function connect(){
   if(stopped||!foreground()||typeof WebSocket==='undefined'||connecting||socket||Date.now()<nextConnect)return;
   connecting=true;const c=new AbortController();ticketAbort=c;const deadline=window.setTimeout(()=>c.abort(),10000);
   try{
    const token=latest.current.getToken()??(await api.auth(c.signal)).accessToken;
    const response=await api.readyTicket(ids,token,c.signal);
    if(stopped||c.signal.aborted)return;
    if(typeof response?.ticket!=='string'||response.ticket.length>2200||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(response.ticket))throw Error('invalid ticket');
    const url=new URL('/demo/notifications/ws',origin);url.protocol='wss:';
    const ws=new WebSocket(url.toString(),[PROTOCOL,response.ticket]);socket=ws;opened=Date.now();
    ws.onopen=()=>{if(stopped||socket!==ws)return;opened=Date.now();lastPong=Date.now();lastPing=0};
    ws.onmessage=e=>{
     if(stopped||socket!==ws||typeof e.data!=='string'||e.data.length>512)return;
     if(e.data==='pong'){lastPong=Date.now();return}
     let message;try{message=JSON.parse(e.data)}catch{return}
     if(message?.v!==1)return;
     if(message.type==='subscribed'){healthy=true;reconnectDelay=10000;lastPong=Date.now();void check(true);return}
     if(message.type==='karaoke.ready'&&allowed.has(message.trackId)&&latest.current.entries[message.trackId]?.state==='waiting'){
      priority.add(message.trackId);void check(true);
     }
    };
    ws.onerror=()=>{if(socket===ws)offline()};ws.onclose=()=>{if(socket===ws)offline()};
   }catch{if(!stopped)offline()}
   finally{clearTimeout(deadline);connecting=false}
  }
  function tick(){
   if(stopped||!foreground())return;
   const now=Date.now();
   if(socket){
    if(!healthy&&now-opened>12000)offline();
    else if(healthy&&now-lastPong>70000)offline();
    else if(healthy&&now-lastPing>30000){lastPing=now;try{socket.send('ping')}catch{offline()}}
   }
   void connect();void check();
  }
  const initial=window.setTimeout(tick,750);timer=window.setInterval(tick,5000);
  function visible(){if(foreground()){tick();void check(true)}}
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
  return()=>{stopped=true;controller?.abort();ticketAbort?.abort();clearTimeout(initial);clearTimeout(followup);clearInterval(timer);const old=socket;socket=null;try{old?.close()}catch{}document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible)};
 },[key]);
}
