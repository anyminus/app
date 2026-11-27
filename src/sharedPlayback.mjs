/** @typedef {{music:number,vocals:number,musicMuted:boolean,vocalsMuted:boolean,pitch:number,speed:number}} PlaybackSettings */
/** @param {unknown} value @returns {PlaybackSettings|null} */
export function validateSharedPlayback(value){
 if(!value||typeof value!=='object')return null;
 const s=/** @type {Partial<PlaybackSettings>} */(value);
 if(typeof s.music!=='number'||!Number.isInteger(s.music)||s.music<0||s.music>100||
 typeof s.vocals!=='number'||!Number.isInteger(s.vocals)||s.vocals<0||s.vocals>100||
 typeof s.musicMuted!=='boolean'||typeof s.vocalsMuted!=='boolean'||
 typeof s.pitch!=='number'||!Number.isInteger(s.pitch)||s.pitch< -6||s.pitch>6||
 typeof s.speed!=='number'||!Number.isFinite(s.speed)||s.speed<.5||s.speed>2||Math.abs(s.speed*10-Math.round(s.speed*10))>1e-8)return null;
 return {music:s.music,vocals:s.vocals,musicMuted:s.musicMuted,vocalsMuted:s.vocalsMuted,pitch:s.pitch,speed:s.speed};
}
/** @param {URLSearchParams} params */
export function readSharedPlayback(params){
 const names=['music','vocals','musicMuted','vocalsMuted','pitch','speed'];
 if(names.some(k=>params.getAll(k).length!==1))return null;
 const music=params.get('music')??'',vocals=params.get('vocals')??'',pitch=params.get('pitch')??'',speed=params.get('speed')??'',mm=params.get('musicMuted'),vm=params.get('vocalsMuted');
 if(!/^\d{1,3}$/.test(music)||!/^\d{1,3}$/.test(vocals)||! /^-?\d{1,2}$/.test(pitch)||! /^\d(?:\.\d)?$/.test(speed)||!(mm==='0'||mm==='1')||!(vm==='0'||vm==='1'))return null;
 return validateSharedPlayback({music:Number(music),vocals:Number(vocals),pitch:Number(pitch),speed:Number(speed),musicMuted:mm==='1',vocalsMuted:vm==='1'});
}
/** Whole source-media seconds, independent of playback speed. @param {unknown} value @returns {number|null} */
export function validateSharedTime(value){return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=900?value:null;}
/** @param {URLSearchParams} params */
export function readSharedTime(params){const values=params.getAll('t');if(values.length!==1||!/^\d{1,3}$/.test(values[0]))return null;return validateSharedTime(Number(values[0]));}
/** @param {string} id @param {PlaybackSettings|null} [settings] @param {number|null} [time] */
export function sharedTrackPath(id,settings=null,time=null){
 const path='/track/'+encodeURIComponent(id),s=validateSharedPlayback(settings);
 const q=new URLSearchParams(s?{music:String(s.music),vocals:String(s.vocals),musicMuted:s.musicMuted?'1':'0',vocalsMuted:s.vocalsMuted?'1':'0',pitch:String(s.pitch),speed:s.speed.toFixed(1)}:undefined);
 const start=validateSharedTime(time);if(start!==null)q.set('t',String(start));
 return q.size?path+'?'+q:path;
}
