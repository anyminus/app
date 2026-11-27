import {useEffect,useRef} from 'react';
import {api,isTrackId,type LiveTrack} from './catalog';
import {normalizeJob,validPairId} from './api.mjs';
export type KaraokeNotice={track:LiveTrack;state:'waiting'|'ready'|'failed';requestedAt:number};
export type KaraokeNotices=Record<string,KaraokeNotice>;
const MAX_AGE=24*60*60*1000;
// Foreground-only status polling; never enqueue or fetch audio/lyrics.
// The current song is handled by its own polling and onReady callback.
export function useKaraokeWatch(entries:KaraokeNotices,currentTrackId:string|null,getToken:()=>string|null,update:(id:string,state:'ready'|'failed',track?:LiveTrack)=>void){
 const latest=useRef({entries,getToken,update});latest.current={entries,getToken,update};
 const waiting=Object.values(entries).some(e=>e?.state==='waiting'&&isTrackId(e.track?.providerTrackId)&&e.track.providerTrackId!==currentTrackId);
 const nextIndex=useRef(0);
 useEffect(()=>{
  if(!waiting)return;
  let stopped=false,busy=false;let controller:AbortController|null=null;let timer:number|undefined;let last=0;
  async function check(){
   if(stopped||busy||document.visibilityState==='hidden'||Date.now()-last<10000)return;
   const pending=Object.values(latest.current.entries).filter(e=>e?.state==='waiting'&&isTrackId(e.track?.providerTrackId)&&e.track.providerTrackId!==currentTrackId);
   if(!pending.length)return;
   busy=true;last=Date.now();
   try{
    const count=Math.min(pending.length,3);
    for(let i=0;i<count&&!stopped;i++){
     const entry=pending[(nextIndex.current+i)%pending.length],id=entry.track.providerTrackId;
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
    nextIndex.current=(nextIndex.current+count)%pending.length;
   }finally{busy=false}
  }
  function tick(){void check()}
  const initial=window.setTimeout(tick,750);timer=window.setInterval(tick,10000);
  document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);
  return()=>{stopped=true;controller?.abort();clearTimeout(initial);clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('focus',tick)};
 },[waiting,currentTrackId]);
}
