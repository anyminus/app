const base=new URL(process.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev');
const id='137761446';
for(const format of ['LRC','TEXT']){
 try{const url=new URL('/demo/lyrics',base);url.searchParams.set('id',id);url.searchParams.set('format',format);const r=await fetch(url,{headers:{Origin:'https://anyminus.github.io'},signal:AbortSignal.timeout(20000),redirect:'error'});const p=await r.json();console.log('SDK_LYRICS '+JSON.stringify({id,requested:format,http:r.status,state:p.state??null,format:p.format??null,timing:p.timing??null,lines:Array.isArray(p.lines)?p.lines.length:0,textPresent:typeof p.text==='string'&&!!p.text.trim(),code:p.code??null}));}catch(e){console.log('SDK_LYRICS '+JSON.stringify({id,requested:format,error:e.name}));}
}
