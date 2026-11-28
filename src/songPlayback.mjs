import {validateSharedPlayback} from './sharedPlayback.mjs';
/** @typedef {import('./sharedPlayback.mjs').PlaybackSettings} PlaybackSettings */
/** @returns {PlaybackSettings} */
export function defaultSongPlayback(){return {music:100,vocals:15,musicMuted:false,vocalsMuted:false,pitch:0,speed:1};}
/** @param {string} id */
export function songPlaybackKey(id){return /^\d{1,20}$/.test(id)?'anyminus:song-playback-v1:'+id:null;}
/** @param {string} id @param {boolean} enabled @param {unknown} shared @param {Pick<Storage,'getItem'>} [storage] @returns {PlaybackSettings} */
export function readSongPlayback(id,enabled,shared,storage){
 const explicit=validateSharedPlayback(shared);if(explicit)return explicit;
 const key=songPlaybackKey(id);
 if(enabled&&key){try{const raw=(storage??localStorage).getItem(key);const saved=validateSharedPlayback(JSON.parse(raw??'null'));if(saved)return saved}catch{}}
 return defaultSongPlayback();
}
/** @param {string} id @param {boolean} enabled @param {unknown} value @param {Pick<Storage,'setItem'>} [storage] */
export function saveSongPlayback(id,enabled,value,storage){
 const key=songPlaybackKey(id),settings=validateSharedPlayback(value);
 if(!enabled||!key||!settings)return false;
 try{(storage??localStorage).setItem(key,JSON.stringify(settings));return true}catch{return false}
}
