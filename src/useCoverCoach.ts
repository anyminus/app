import {useEffect,useState} from 'react';

const KEY='anyminus:cover-background-coach-v1';
let seenInSession=false;
function hasSeen(){try{return seenInSession||localStorage.getItem(KEY)==='true'}catch{return seenInSession}}
function markSeen(){seenInSession=true;try{localStorage.setItem(KEY,'true')}catch{/* private storage may be unavailable */}}

export function useCoverCoach(eligible:boolean){
 const [dismissed,setDismissed]=useState(hasSeen);
 const visible=eligible&&!dismissed;
 function dismiss(){markSeen();setDismissed(true)}
 useEffect(()=>{
  if(!visible)return;
  // Record the first actual impression, not opening a loading/broken player.
  markSeen();
  const timeout=window.setTimeout(()=>setDismissed(true),10000);
  return ()=>window.clearTimeout(timeout);
 },[visible]);
 return {visible,dismiss};
}
