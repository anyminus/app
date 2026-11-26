export const defaults={music:100,vocals:15};
export function clampVolume(n){return Math.max(0,Math.min(100,Number.isFinite(n)?n:0))}
export function formatTime(seconds){const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
export function parseRoute(hash){const [page,id]=hash.replace(/^#\/?/,'').split('/');return {page:['home','search','favorites','profile','history','settings','collection','track','artist','player','prepare','playlists','playlist','live'].includes(page)?page:'home',id:(()=>{try{return decodeURIComponent(id||'')}catch{return ''}})()}}
