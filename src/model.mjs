import {readSharedPlayback,readSharedTime} from './sharedPlayback.mjs';
export const defaults={music:100,vocals:15};
export function clampVolume(n){return Math.max(0,Math.min(100,Number.isFinite(n)?n:0))}
export function formatTime(seconds){const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
export function parseRoute(hash){const raw=hash.replace(/^#\/?/,'');const [path,query]=raw.split('?',2);const [page,id]=path.split('/');const params=new URLSearchParams(query||'');const author=params.get('author_id');const settings=page==='track'?readSharedPlayback(params):null;const time=page==='track'?readSharedTime(params):null;return {page:['home','search','favorites','profile','history','settings','collection','track','artist','player','prepare','playlists','playlist','live'].includes(page)?page:'home',id:(()=>{try{return decodeURIComponent(id||'')}catch{return ''}})(),...(page==='artist'&&author&&/^\d{1,20}$/.test(author)?{author_id:author}:{}),...(settings?{settings}:{}),...(time!==null?{time}:{})}}

export function matchesArtist(credit,name){if(typeof credit!=='string'||typeof name!=='string')return false;const norm=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');const target=norm(name);return !!target&&(norm(credit)===target||credit.split(',').some(part=>norm(part)===target))}

/** @param {string} name @param {string} [authorId] */
export function artistPath(name,authorId){return '/artist/'+encodeURIComponent(name)+(authorId&&/^\d{1,20}$/.test(authorId)?'?author_id='+authorId:'')}

// Exact artist suggestions from the current search payload, not song titles.
/** @param {string} query @param {readonly {artist:string;artistCredits?:readonly {author_id:string;name:string}[]}[]} tracks @returns {{name:string;author_id?:string}[]} */
export function exactSearchArtists(query,tracks){
 const norm=s=>typeof s==='string'?s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е'):'';
 const target=norm(query);if(target.length<2)return [];
 const verified=new Map();let fallback=null;
 for(const track of tracks){
  if(track.artistCredits?.length){for(const credit of track.artistCredits){if(norm(credit.name)===target&&typeof credit.author_id==='string'&&/^\d{1,20}$/.test(credit.author_id)&&!verified.has(credit.author_id))verified.set(credit.author_id,{name:credit.name,author_id:credit.author_id});}}
  else if(!fallback&&norm(track.artist)===target)fallback={name:track.artist};
 }
 return verified.size?[...verified.values()]:fallback?[fallback]:[];
}
