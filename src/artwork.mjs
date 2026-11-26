/** @param {string} origin @param {string} id @param {string | null} [provided] */
export function trackArtworkUrl(origin,id,provided){
 if(typeof id!=='string'||!/^\d{1,20}$/.test(id))return null;
 try{const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin)return null;const expected=new URL('/demo/artwork/'+id,base);if(typeof provided==='string'){try{const u=new URL(provided,base);if(u.href===expected.href)return u.href}catch{}}return expected.href}catch{return null}
}
