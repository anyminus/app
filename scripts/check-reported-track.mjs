// Incident diagnostic: only read requests and anonymous session bootstrap; never enqueue.
const base=new URL(process.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev');
if(base.protocol!=='https:'||base.origin!==base.href.slice(0,-1))throw Error('Invalid API origin');
const id='108591168',origin='https://anyminus.github.io';
async function request(path,{method='GET',token,body}={}){
 const started=Date.now();
 try{
  const r=await fetch(new URL(path,base),{method,headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),redirect:'error'});
  console.log(JSON.stringify({path,status:r.status,ms:Date.now()-started,cors:r.headers.get('access-control-allow-origin')}));
  if(!r.ok){await r.body?.cancel();return null;}
  return await r.json();
 }catch(e){console.log(JSON.stringify({path,error:e.name,ms:Date.now()-started}));return null;}
}
const catalog=await request('/demo/catalog?limit=100');
console.log('Target present on first page:',Boolean(catalog?.items?.some(t=>t.providerTrackId===id)));
const auth=await request('/demo/auth',{method:'POST',body:{}});
if(typeof auth?.accessToken==='string'){
 const [meta,status]=await Promise.all([request('/demo/track-metadata/'+id,{token:auth.accessToken}),request('/demo/karaoke/status?providerTrackId='+id,{token:auth.accessToken})]);
 console.log(JSON.stringify({metadataPresent:typeof meta?.title==='string',status:typeof status?.state==='string'?status.state:'unknown',readyPairPresent:typeof status?.pairOperationId==='string'}));
}
