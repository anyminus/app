export function trackArtworkUrl(origin,id){
 if(typeof id!=='string'||!/^\d{1,20}$/.test(id))return null;
 try{const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin)return null;return new URL('/demo/artwork/'+id,base).href}catch{return null}
}
