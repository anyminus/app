import {useEffect,useState} from 'react';
import {publishedUpgrade} from './release-version.mjs';
/** Global foreground update notification, independent of route and karaoke watches. */
export function useReleaseNotice(current:string){
 const [available,setAvailable]=useState<string|null>(null),[dismissed,setDismissed]=useState<string|null>(null);
 useEffect(()=>{
  let stopped=false;let inFlight:AbortController|null=null;let last=0;
  async function check(){
   if(stopped||inFlight||document.visibilityState==='hidden'||Date.now()-last<3000)return;
   last=Date.now();const c=new AbortController();inFlight=c;const deadline=window.setTimeout(()=>c.abort(),8000);
   try{
    const url=new URL('./version.json',document.baseURI);url.searchParams.set('_',String(Date.now()));
    const r=await fetch(url,{cache:'no-store',credentials:'same-origin',redirect:'error',signal:c.signal});
    if(!r.ok||!r.headers.get('content-type')?.toLowerCase().includes('application/json'))return;
    const payload=await r.json();const next=publishedUpgrade(current,payload);
    if(!stopped&&!c.signal.aborted&&next)setAvailable(old=>!old||publishedUpgrade(old,{schemaVersion:1,version:next})?next:old);
   }catch{/* Network/partial deployments do not interrupt playback or show a false notice. */}
   finally{clearTimeout(deadline);if(inFlight===c)inFlight=null}
  }
  const tick=()=>void check();
  const first=window.setTimeout(tick,1000),timer=window.setInterval(tick,30000);
  document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);window.addEventListener('online',tick);
  return()=>{stopped=true;inFlight?.abort();clearTimeout(first);clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('focus',tick);window.removeEventListener('online',tick)};
 },[current]);
 return {version:available!==dismissed?available:null,dismiss:()=>setDismissed(available),reload:()=>window.location.reload()};
}
