// One occurrence per actual playback, with distinct media coverage.
export function createPlaybackOccurrence(mode,trackId,emit,idFactory=()=>globalThis.crypto.randomUUID()){
 let id=null,baseline=null,covered=[],completed=false;
 function send(kind){try{emit({playbackId:id,trackId,mode,kind})}catch{/* telemetry never affects playback */}}
 function reset(){id=null;baseline=null;covered=[];completed=false}
 function resume(position,now=performance.now()){
  if(!Number.isFinite(position)||position<0)return;
  if(!id){try{id=idFactory()}catch{return}send('start')}
  baseline={position,now};
 }
 function discontinuity(){baseline=null}
 function sample(position,duration,speed=1,now=performance.now()){
  if(!id||!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0||!Number.isFinite(now))return;
  position=Math.max(0,Math.min(duration,position));
  const prev=baseline;baseline={position,now};
  if(!prev||completed)return;
  const dt=(now-prev.now)/1000,delta=position-prev.position;
  // Long scheduling gaps, backward jumps and forward seeks never inflate coverage.
  if(dt<=0||dt>3||delta<=0||delta>dt*Math.min(2,Math.max(.5,speed))+.25)return;
  const range=[Math.max(0,Math.min(duration,prev.position)),position];
  covered.push(range);covered.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const r of covered){const last=merged[merged.length-1];if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r)}
  covered=merged;
  const seconds=covered.reduce((sum,r)=>sum+r[1]-r[0],0);
  if(seconds>=duration*.7){completed=true;send('complete')}
 }
 return {resume,sample,discontinuity,reset};
}
