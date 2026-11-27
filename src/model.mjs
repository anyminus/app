import {readSharedPlayback,readSharedTime} from './sharedPlayback.mjs';
export const defaults={music:100,vocals:15};
export function clampVolume(n){return Math.max(0,Math.min(100,Number.isFinite(n)?n:0))}
export function formatTime(seconds){const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
export function parseRoute(hash){const raw=hash.replace(/^#\/?/,'');const [path,query]=raw.split('?',2);const [page,id]=path.split('/');const params=new URLSearchParams(query||'');const author=params.get('author_id');const settings=page==='track'?readSharedPlayback(params):null;const time=page==='track'?readSharedTime(params):null;return {page:['home','search','favorites','profile','history','settings','collection','track','artist','player','prepare','playlists','playlist','live'].includes(page)?page:'home',id:(()=>{try{return decodeURIComponent(id||'')}catch{return ''}})(),...(page==='artist'&&author&&/^\d{1,20}$/.test(author)?{author_id:author}:{}),...(settings?{settings}:{}),...(time!==null?{time}:{})}}

export function matchesArtist(credit,name){if(typeof credit!=='string'||typeof name!=='string')return false;const norm=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');const target=norm(name);return !!target&&(norm(credit)===target||credit.split(',').some(part=>norm(part)===target))}

/** @param {string} name @param {string} [authorId] */
export function artistPath(name,authorId){return '/artist/'+encodeURIComponent(name)+(authorId&&/^\d{1,20}$/.test(authorId)?'?author_id='+authorId:'')}

// Suggestions use verified artist IDs, not song titles. Strict matching for
// artist pages themselves stays unchanged.
/** @param {string} query @param {readonly {artist:string;artistCredits?:readonly {author_id:string;name:string}[]}[]} tracks @param {readonly {author_id:string;name:string}[]} [artists] @returns {{name:string;author_id?:string}[]} */
export function exactSearchArtists(query,tracks,artists=[]){
 const norm=s=>typeof s==='string'?s.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
 const target=norm(query);if(target.length<2)return [];
 const words=target.split(' ');
 function oneEdit(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}
  return edits+a.length-i+b.length-j<=1;
 }
 function score(name){
  const n=norm(name);if(n===target)return 1000;
  const parts=n.split(' ');if(words.length>parts.length||words.some(w=>w.length<3))return 0;
  const used=new Set();let points=0;
  // Match exact words first, then prefixes, then a single edit per word.
  const pending=[];for(const w of words){const i=parts.findIndex((p,i)=>!used.has(i)&&p===w);if(i>=0){used.add(i);points+=30}else pending.push(w)}
  for(const w of pending){let i=parts.findIndex((p,i)=>!used.has(i)&&p.startsWith(w));if(i>=0){used.add(i);points+=20;continue}
   i=parts.findIndex((p,i)=>!used.has(i)&&p.length>=3&&oneEdit(w,p)&&(words.length>1||w.length>=5));
   if(i<0)return 0;used.add(i);points+=10;
  }
  return 100+points+(words.length===parts.length?30:0);
 }
 const verified=new Map();let fallback=null;
 function add(credit){if(!credit||typeof credit.author_id!=='string'||!/^\d{1,20}$/.test(credit.author_id)||typeof credit.name!=='string'||verified.has(credit.author_id))return;const rank=score(credit.name);if(rank)verified.set(credit.author_id,{artist:{name:credit.name,author_id:credit.author_id},rank})}
 for(const credit of artists)add(credit);
 for(const track of tracks){
  if(track.artistCredits?.length)for(const credit of track.artistCredits)add(credit);
  else if(!fallback&&norm(track.artist)===target)fallback={name:track.artist};
 }
 const ranked=[...verified.values()].sort((a,b)=>b.rank-a.rank).slice(0,3).map(x=>x.artist);
 return ranked.length?ranked:fallback?[fallback]:[];
}
