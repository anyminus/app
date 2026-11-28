/** @param {string} origin @param {string} id @param {string | null} [provided] */
export function trackArtworkUrl(origin,id,provided){
 if(typeof id!=='string'||!/^\d{1,20}$/.test(id))return null;
 try{
  const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin)return null;
  const expected=new URL('/demo/artwork/'+id,base);
  if(provided===null)return expected.href;
  if(typeof provided==='string'){
   try{const u=new URL(provided,base);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&((u.origin===base.origin&&u.pathname===expected.pathname)||(['avatars.yandex.net','avatars.mds.yandex.net','avatars-fast.yandex.net'].includes(u.hostname)&&u.pathname.startsWith('/get-music-content/')&&!u.port)))return u.href}catch{}
   return null;
  }
  return expected.href;
 }catch{return null}
}

/** @param {string} origin @param {string} id */
export function artistArtworkUrl(origin,id){
 if(typeof id!=='string'||!/^\d{1,20}$/.test(id))return null;
 try{const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin)return null;return new URL('/demo/artist-artwork/'+id,base).href}catch{return null}
}

/** @param {string} origin @param {string} id @param {boolean} [artist] */
export function originalArtworkUrl(origin,id,artist=false){const src=artist?artistArtworkUrl(origin,id):trackArtworkUrl(origin,id);if(!src)return null;const u=new URL(src);u.searchParams.set('size','orig');return u.href;}
