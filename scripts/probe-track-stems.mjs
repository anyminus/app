// Read-only production incident probe. No enqueue, no secrets or media bytes in logs.
const origin='https://anyminus.github.io';
const api=new URL(process.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev');
if(api.protocol!=='https:'||api.href!==api.origin+'/')throw Error('Bad API origin');
const id='108591168';
async function call(path,opts={}){
 const start=Date.now(),headers={Origin:origin,...(opts.headers||{})};
 try{const r=await fetch(new URL(path,api),{method:opts.method||'GET',headers,body:opts.body,redirect:'error',signal:AbortSignal.timeout(15000)});
 const type=r.headers.get('content-type')||'';
 const cookie=r.headers.get('set-cookie');
 const log={path,status:r.status,ms:Date.now()-start,type,cors:r.headers.get('access-control-allow-origin'),credentials:r.headers.get('access-control-allow-credentials'),length:r.headers.get('content-length'),range:r.headers.get('content-range'),cookiePresent:Boolean(cookie)};
 let data=null;
 if(type.includes('json')){data=await r.json();log.errorCode=data?.error?.code??null;log.diagnostic=data?.diagnostic?{stage:data.diagnostic.stage,reason:data.diagnostic.reason,upstream_status:data.diagnostic.upstream_status}:undefined;}
 else if(r.body){const reader=r.body.getReader();const first=await reader.read();log.firstBytes=first.value?.length??0;await reader.cancel();}
 console.log(JSON.stringify(log));return {data,cookie,status:r.status};
 }catch(e){console.log(JSON.stringify({path,error:e.name,ms:Date.now()-start}));return {};}
}
const auth=await call('/demo/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
const token=auth.data?.accessToken;
const headers=typeof token==='string'?{Authorization:'Bearer '+token}:{};
const [status,metadata]=await Promise.all([call('/demo/karaoke/status?providerTrackId='+id,{headers}),call('/demo/track-metadata/'+id,{headers})]);
let pair=status.data?.pairOperationId??metadata.data?.pairOperationId??metadata.data?.karaokeStatus?.pairOperationId;
if(!pair){
 let cursor=null;const seen=new Set();
 for(let n=0;n<12;n++){
  const query=new URLSearchParams({limit:'100'});if(cursor)query.set('cursor',cursor);
  const page=await call('/demo/catalog?'+query);
  pair=page.data?.items?.find(t=>t.providerTrackId===id)?.pairOperationId;
  if(pair)break;cursor=page.data?.nextCursor;
  if(!cursor||seen.has(cursor))break;seen.add(cursor);
 }
}
if(typeof pair!=='string'||!/^[0-9a-f-]{36}$/i.test(pair)){console.log('No verified pair found for target');process.exit(0)}
console.log('Verified pair available; status='+String(status.data?.state??'unknown'));
for(const authenticated of [false,true]){
 if(authenticated&&!token)continue;
 const playback=await call('/demo/catalog/playback',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?headers:{})},body:JSON.stringify({pairOperationId:pair,providerTrackId:id})});
 if(playback.status!==200||!playback.cookie)continue;
 const cookie=playback.cookie.split(';')[0];
 for(const role of ['instrumental','vocals']){
  const path=playback.data?.[role];
  if(path!==('/demo/catalog/media/'+playback.data?.pairOperationId+'/'+role))continue;
  await call(path,{headers:{Cookie:cookie,Range:'bytes=0-1023'}});
 }
 break;
}
