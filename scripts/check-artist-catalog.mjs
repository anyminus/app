import {matchesArtist} from '../src/model.mjs';
const origin=process.env.VITE_DEMO_API_ORIGIN||'https://anyminus-demo-search-dev.demo-search.workers.dev';const base=new URL(origin);
if(base.protocol!=='https:'||base.origin!==origin)throw Error('Invalid API origin');
const headers={Origin:'https://anyminus.github.io'},artist='Дельфин';let cursor=null,count=0,pages=0,complete=false;const seen=new Set(),matches=[];
try{
 for(let i=0;i<12;i++){
  const url=new URL('/demo/catalog',base);url.searchParams.set('limit','100');if(cursor)url.searchParams.set('cursor',cursor);
  const r=await fetch(url,{headers,signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw Error('Catalog HTTP '+r.status);const p=await r.json();if(!Array.isArray(p.items))throw Error('Invalid catalog');
  pages++;count+=p.items.length;for(const t of p.items)if(matchesArtist(t.artist,artist)&&typeof t.pairOperationId==='string')matches.push({id:t.providerTrackId,title:t.title,artist:t.artist});
  if(!p.nextCursor){complete=true;break}if(typeof p.nextCursor!=='string'||!/^\d{1,20}$/.test(p.nextCursor)||seen.has(p.nextCursor))throw Error('Invalid cursor');cursor=p.nextCursor;seen.add(cursor);
 }
}catch(e){console.log('Artist catalog diagnostic error:',e.message)}
console.log('ARTIST_CATALOG '+JSON.stringify({artist,pages,count,complete,matches}));
try{const r=await fetch(new URL('/demo/search?q='+encodeURIComponent(artist)+'&limit=20',base),{headers,signal:AbortSignal.timeout(12000),redirect:'error'});const p=await r.json();console.log('ARTIST_SEARCH '+JSON.stringify({status:r.status,items:Array.isArray(p.items)?p.items.length:0,matches:Array.isArray(p.items)?p.items.filter(t=>matchesArtist(t.artist,artist)).map(t=>({id:t.providerTrackId,title:t.title,artist:t.artist,state:t.karaokeStatus?.state??null})):[]}))}catch(e){console.log('Artist search diagnostic error:',e.message)}
