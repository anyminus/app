export const defaults={music:100,vocals:15};
export function clampVolume(n){return Math.max(0,Math.min(100,Number.isFinite(n)?n:0))}
export function formatTime(seconds){const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
export function parseRoute(hash){const raw=hash.replace(/^#\/?/,'');const [path,query]=raw.split('?',2);const [page,id]=path.split('/');const author=new URLSearchParams(query||'').get('author_id');return {page:['home','search','favorites','profile','history','settings','collection','track','artist','player','prepare','playlists','playlist','live'].includes(page)?page:'home',id:(()=>{try{return decodeURIComponent(id||'')}catch{return ''}})(),...(page==='artist'&&author&&/^\d{1,20}$/.test(author)?{author_id:author}:{})}}

export function matchesArtist(credit,name){if(typeof credit!=='string'||typeof name!=='string')return false;const norm=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');const target=norm(name);return !!target&&(norm(credit)===target||credit.split(',').some(part=>norm(part)===target))}

/** @param {string} name @param {string} [authorId] */
export function artistPath(name,authorId){return '/artist/'+encodeURIComponent(name)+(authorId&&/^\d{1,20}$/.test(authorId)?'?author_id='+authorId:'')}
