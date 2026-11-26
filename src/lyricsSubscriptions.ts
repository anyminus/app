import {useEffect,useRef} from 'react';
import {api,type LiveTrack} from './catalog';
import {validPairId} from './api.mjs';
import {normalizeStoredLyrics} from './lyrics.mjs';
export type LyricsSubscription={track:LiveTrack;state:'waiting'|'ready'};
export type LyricsSubscriptions=Record<string,LyricsSubscription>;
// Foreground-only polling. No lyric generation, no audio fetch and no bearer or cookie persistence.
export function useLyricsWatch(subscriptions:LyricsSubscriptions,activePlayer:boolean,complete:(id:string)=>void){
 const latest=useRef({subscriptions,complete});latest.current={subscriptions,complete};
 const waiting=Object.values(subscriptions).some(s=>s.state==='waiting');
 const nextIndex=useRef(0),lastCheck=useRef(0);
 useEffect(()=>{
  if(!waiting||activePlayer)return;
  let disposed=false,busy=false;let controller:AbortController|null=null;let timer:number|undefined;
  async function check(){
   if(disposed||busy||document.visibilityState==='hidden')return;
   if(Date.now()-lastCheck.current<300000)return;
   const entries=Object.values(latest.current.subscriptions).filter(s=>s.state==='waiting'&&validPairId(s.track.pairOperationId));
   if(!entries.length)return;
   busy=true;lastCheck.current=Date.now();
   try{
    const n=Math.min(entries.length,3);
    for(let i=0;i<n&&!disposed;i++){
     const entry=entries[(nextIndex.current+i)%entries.length],t=entry.track;
     const c=new AbortController();controller=c;const deadline=window.setTimeout(()=>c.abort(),22000);
     try{
      const session=await api.playback(t.pairOperationId!,t.providerTrackId,undefined,c.signal);
      if(session.pairOperationId!==t.pairOperationId)continue;
      const payload=await api.storedLyrics(t.pairOperationId!,undefined,c.signal);
      const duration=Math.round(Number(session.durationSeconds)*1000);
      if(!Number.isSafeInteger(duration)||duration<=0)continue;
      const result=normalizeStoredLyrics(payload,duration);
      if(!disposed&&!c.signal.aborted&&(result.lines.length||result.text))latest.current.complete(t.providerTrackId);
     }catch{/* Missing and temporarily unavailable remain subscribed. */}finally{clearTimeout(deadline)}
    }
    nextIndex.current=(nextIndex.current+n)%entries.length;
   }finally{busy=false}
  }
  function tick(){void check()}
  timer=window.setInterval(tick,30000);document.addEventListener('visibilitychange',tick);
  const initial=window.setTimeout(tick,1000);
  return()=>{disposed=true;controller?.abort();clearTimeout(initial);clearInterval(timer);document.removeEventListener('visibilitychange',tick)};
 },[waiting,activePlayer]);
}
