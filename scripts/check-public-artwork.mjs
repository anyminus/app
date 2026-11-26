// Read-only smoke probe; never authenticate, create jobs, or log response bodies.
const origin=process.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev';
const base=new URL(origin);
if(base.protocol!=='https:'||base.origin!==origin)throw Error('Invalid configured API origin');
const headers={Origin:'https://anyminus.github.io'};
try{
 const response=await fetch(new URL('/demo/catalog?limit=100',base),{headers,signal:AbortSignal.timeout(12000),redirect:'error'});
 console.log('Catalog HTTP',response.status);
 if(!response.ok)throw Error('Catalog unavailable');
 const json=await response.json();
 const ids=[...new Set((Array.isArray(json.items)?json.items:[]).map(t=>t.providerTrackId).filter(id=>typeof id==='string'&&/^\d{1,20}$/.test(id)))].slice(0,4);
 if(!ids.length)throw Error('No valid catalog IDs');
 for(const id of ids){
  try{
   const r=await fetch(new URL('/demo/artwork/'+id,base),{headers,signal:AbortSignal.timeout(18000),redirect:'error'});
   const type=r.headers.get('content-type')||'';
   const cache=r.headers.get('cache-control')||'';
   const cors=r.headers.get('access-control-allow-origin')||'(absent)';
   let bytes=0;let magic='';
   if(r.ok&&type.startsWith('image/')){
    const reader=r.body?.getReader();
    if(reader){const chunk=await reader.read();bytes=chunk.value?.length||0;magic=Buffer.from(chunk.value??[]).subarray(0,12).toString('hex');await reader.cancel()}
   }else await r.body?.cancel();
   console.log(JSON.stringify({trackId:id,status:r.status,type,cache,cors,firstChunkBytes:bytes,signature:magic}));
  }catch(e){console.log(JSON.stringify({trackId:id,error:e instanceof Error?e.name:'request_failed'}))}
 }
}catch(e){console.log('Artwork diagnostic unavailable:',e instanceof Error?e.message:'request_failed')}
