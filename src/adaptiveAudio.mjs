// Clock stalls are evidence of an output fault, not a CarPlay identification.
export function nextAudioProfile(mode,profile,confirmedStall,sessionAvailable){
 if(mode!=='auto'||!confirmedStall)return profile;
 if(profile==='normal')return 'alternate';
 if(profile==='alternate'&&sessionAvailable)return 'compatibility';
 return profile;
}
export function createOutputWatchdog(){
 let last=null,started=null,stalledAt=null,shortStalls=[];
 function reset(){last=null;started=null;stalledAt=null;shortStalls=[]}
 function sample(position,now,eligible=true){
  if(!eligible||!Number.isFinite(position)||!Number.isFinite(now)){reset();return false}
  if(!last||now-last.now>500||now<=last.now||position<last.position-.01){reset();last={position,now};started=now;return false}
  const delta=position-last.position;
  last={position,now};
  if(now-started<1200)return false;
  shortStalls=shortStalls.filter(at=>now-at<=12000);
  if(delta>.005){
   if(stalledAt!==null&&now-stalledAt>=240)shortStalls.push(now);
   stalledAt=null;
   if(shortStalls.length>=2){reset();return true}
  }else{
   if(stalledAt===null)stalledAt=now;
   if(now-stalledAt>=1800){reset();return true}
  }
  return false;
 }
 return {sample,reset};
}
