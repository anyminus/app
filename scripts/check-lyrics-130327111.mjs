// Read-only diagnosis of timing metadata. Never log lyric text or playback cookies.
const origin=process.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev';
const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin)throw Error('Invalid API origin');
const id='130327111',headers={Origin:'https://anyminus.github.io'};
async function request(path,init={}){return fetch(new URL(path,base),{...init,headers:{...headers,...init.headers},redirect:'error',signal:AbortSignal.timeout(12000)})}
async function summarize(label,r,duration){
 let p;try{p=await r.json()}catch{p=null}
 const lines=Array.isArray(p?.lines)?p.lines:[];
 const timed=lines.filter(l=>Number.isSafeInteger(l?.startMs)&&l.startMs>=0);
 console.log(JSON.stringify({label,status:r.status,state:p?.state??null,format:p?.format??null,timing:p?.timing??null,lines:lines.length,timed:timed.length,sourceTimed:timed.filter(l=>l.startOrigin==='source').length,acceptedTimed:timed.filter(l=>l.startOrigin==='source'&&typeof l.text==='string'&&l.text.trim()&&(!duration||l.startMs<duration)).length,plainTextPresent:typeof p?.text==='string'&&!!p.text.trim(),provenance:r.headers.get('x-anyminus-lyrics-provenance'),requestId:r.headers.get('x-request-id')}));
}
let track=null;
try{
 let cursor=null;
 for(let page=0;page<5;page++){
  const r=await request('/demo/catalog?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  if(!r.ok){console.log('Catalog HTTP',r.status);break}
  const p=await r.json();track=p.items?.find(t=>t.providerTrackId===id)||null;if(track||!p.nextCursor||p.nextCursor===cursor)break;cursor=p.nextCursor;
 }
 console.log(JSON.stringify({trackId:id,foundInCatalog:!!track,durationSeconds:track?.durationSeconds??null}));
}catch(e){console.log('Catalog lookup failed',e.name)}
const duration=track?.durationSeconds>0?Math.round(track.durationSeconds*1000):null;
try{await summarize('provider LRC',await request('/demo/lyrics?id='+id+'&format=LRC'+(duration?'&durationMs='+duration:'')),duration)}catch(e){console.log('Provider LRC request failed',e.name)}
if(track&&/^[0-9a-f-]{36}$/i.test(track.pairOperationId)){
 try{
  const r=await request('/demo/catalog/playback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pairOperationId:track.pairOperationId,providerTrackId:id})});
  console.log('Playback session HTTP',r.status);
  if(r.ok){
   const cookie=r.headers.getSetCookie().map(s=>s.split(';',1)[0]).join('; ');
   const p=await r.json();
   if(cookie&&p.pairOperationId===track.pairOperationId)await summarize('stored lyrics',await request('/demo/catalog/media/'+p.pairOperationId+'/lyrics',{headers:{Cookie:cookie}}),duration);
   else console.log('No usable playback session');
  }
 }catch(e){console.log('Stored lyrics request failed',e.name)}
}
