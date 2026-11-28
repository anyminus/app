// Origin-local, bounded application cache. Never stores credentials or signed URLs.
export const CACHE_LIMIT=300_000_000, STEM_LIMIT=19_000_000, CACHE_TTL=7*24*60*60*1000;
const MAX_ENTRIES=120, DB='anyminus-stems-v1', STORE='stems';
type Entry={key:string;data:Blob;total:number|null;done:boolean;used:number};
const validKey=(key:string)=>{try{const u=new URL(key);return u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password&&/^\/demo\/catalog\/media\/[0-9a-f-]{36}\/(?:instrumental|vocals)$/i.test(u.pathname)}catch{return false}};
const valid=(e:Entry,now:number)=>!!e&&validKey(e.key)&&e.data instanceof Blob&&e.data.size>0&&e.data.size<=STEM_LIMIT&&Number.isFinite(e.used)&&e.used<=now+60_000&&now-e.used<CACHE_TTL&&(e.total===null||Number.isSafeInteger(e.total)&&e.total>=e.data.size&&e.total<=STEM_LIMIT)&&(!e.done||e.total===e.data.size);
let dbPromise:Promise<IDBDatabase|null>|null=null;
function openCache(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise<IDBDatabase|null>(resolve=>{
  let settled=false;const finish=(db:IDBDatabase|null)=>{if(settled){db?.close();return}settled=true;clearTimeout(timer);resolve(db)};
  const timer=window.setTimeout(()=>finish(null),1500);
  try{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'})};req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();dbPromise=null};finish(db)};req.onerror=()=>finish(null);req.onblocked=()=>finish(null)}catch{finish(null)}
 });return dbPromise;
}
async function transact<T>(fallback:T,work:(store:IDBObjectStore,set:(v:T)=>void)=>void):Promise<T>{
 const db=await openCache();if(!db)return fallback;
 return new Promise<T>(resolve=>{
  let tx:IDBTransaction;try{tx=db.transaction(STORE,'readwrite')}catch{dbPromise=null;resolve(fallback);return}
  let result=fallback;const timer=window.setTimeout(()=>{try{tx.abort()}catch{}},3000);
  tx.oncomplete=()=>{clearTimeout(timer);resolve(result)};tx.onabort=()=>{clearTimeout(timer);resolve(fallback)};tx.onerror=()=>{ /* transaction abort handles failure */ };
  try{work(tx.objectStore(STORE),v=>{result=v})}catch{try{tx.abort()}catch{clearTimeout(timer);resolve(fallback)}}
 });
}
function trim(store:IDBObjectStore,entries:Entry[],now:number,keep?:string){
 const live:Entry[]=[];for(const entry of entries){if(valid(entry,now))live.push(entry);else store.delete(entry.key)}
 live.sort((a,b)=>b.used-a.used);
 if(keep){const at=live.findIndex(e=>e.key===keep);if(at>0)live.unshift(...live.splice(at,1))}
 let bytes=0,count=0;for(const entry of live){if(count>=MAX_ENTRIES||bytes+entry.data.size>CACHE_LIMIT){store.delete(entry.key);continue}bytes+=entry.data.size;count++}
 return {bytes,count};
}
export async function readStem(key:string):Promise<Entry|null>{
 if(!validKey(key))return null;
 return transact<Entry|null>(null,(store,set)=>{const request=store.get(key);request.onsuccess=()=>{const entry=request.result as Entry|undefined;if(!entry)return;const now=Date.now();if(!valid(entry,now)){store.delete(key);return}entry.used=now;store.put(entry);set(entry)}});
}
export async function writeStem(key:string,parts:Uint8Array<ArrayBuffer>[],total:number|null,done:boolean){
 if(!validKey(key)||!parts.length)return;
 let data:Blob;try{data=new Blob(parts)}catch{return}
 const entry:Entry={key,data,total,done,used:Date.now()};if(!valid(entry,entry.used))return;
 await transact(false,(store,set)=>{const request=store.getAll();request.onsuccess=()=>{
  const all=request.result as Entry[],old=all.find(e=>e.key===key);
  // Concurrent tabs can retain a longer prefix of the same immutable stem.
  if(old&&valid(old,entry.used)&&(old.done||old.data.size>entry.data.size)&&(!entry.done||old.done)){old.used=entry.used;store.put(old);trim(store,all,entry.used,key);}
  else{store.put(entry);trim(store,[...all.filter(e=>e.key!==key),entry],entry.used,key)}
  set(true);
 }});
}
export async function removeStem(key:string){await transact(false,(store,set)=>{store.delete(key);set(true)})}
export async function cacheStats(){return transact({bytes:0,count:0},(store,set)=>{const req=store.getAll();req.onsuccess=()=>set(trim(store,req.result as Entry[],Date.now()))})}
export async function clearStemCache(){return transact(false,(store,set)=>{store.clear();set(true)})}
