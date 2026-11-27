import {t as trUi} from './i18n.mjs';
import {readAudioOutputMode,type AudioOutputMode} from './audioOutputMode';
export type SyncMode='auto'|'manual'|'off';
export type SyncSettings={mode:SyncMode;manualMs:number};
export type AudioDiagnostics={micLabel:string;inputMs:number|null;baseMs:number|null;outputMs:number|null;sampleRate:number|null;micRate:number|null;channels:number|null;sinkId:string|null;outputMode?:AudioOutputMode};
export const defaultSync:SyncSettings={mode:'auto',manualMs:150};
const validMs=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.round(value*1000):null;
export function boundedDelay(ms:number){return Number.isFinite(ms)?Math.max(0,Math.min(500,Math.round(ms/10)*10)):0;}
export function readAudioDiagnostics(ctx:AudioContext|null,track?:MediaStreamTrack,outputMode:AudioOutputMode='standard'):AudioDiagnostics{
 let s:MediaTrackSettings&{latency?:number}={};try{s=track?.getSettings()??{};}catch{}
 const sink=(ctx as (AudioContext&{sinkId?:unknown})|null)?.sinkId;
 return {outputMode,micLabel:track?.label||trUi('Не определён'),inputMs:validMs(s.latency),baseMs:validMs(ctx?.baseLatency),outputMs:validMs(ctx?.outputLatency),sampleRate:ctx?.sampleRate??null,micRate:s.sampleRate??null,channels:s.channelCount??null,sinkId:typeof sink==='string'&&sink!==''&&sink!=='default'&&sink!=='communications'?sink:null};
}
export const defaultCarPlayDelay=300;
export function usesCarPlayEstimate(info:AudioDiagnostics){return info.outputMode==='carplay'&&(info.outputMs===null||info.outputMs<40);}
export function resolveDelay(settings:SyncSettings,info:AudioDiagnostics){
 if(settings.mode==='off')return 0;
 if(settings.mode==='manual')return boundedDelay(settings.manualMs);
 // A known output estimate is necessary; neither mic type nor device name
 // proves that headphones are in use. Ignore very small estimates.
 // Explicitly selected compatibility mode is not proof of physical CarPlay.
 // A tiny/missing estimate in this mode may omit transport latency; use the
 // user's saved calibration, never present it as a measured route delay.
 if(usesCarPlayEstimate(info))return boundedDelay(settings.manualMs);
 if(info.outputMs===null||info.outputMs===0)return 0;
 const total=info.outputMs+(info.baseMs??0)+(info.inputMs??0);
 return total<40?0:boundedDelay(total);
}
const syncKey=(mode:AudioOutputMode)=>mode==='carplay'?'anyminus.video.sync.carplay.v1':'anyminus.video.sync.v1';
export function loadSync(mode=readAudioOutputMode()):SyncSettings{try{const s=JSON.parse(localStorage.getItem(syncKey(mode))??'null');if(s&&['auto','manual','off'].includes(s.mode)&&typeof s.manualMs==='number'&&Number.isFinite(s.manualMs))return {mode:s.mode,manualMs:boundedDelay(s.manualMs)};}catch{}return {...defaultSync,manualMs:mode==='carplay'?defaultCarPlayDelay:defaultSync.manualMs};}
export function saveSync(settings:SyncSettings,mode=readAudioOutputMode()){try{localStorage.setItem(syncKey(mode),JSON.stringify(settings));}catch{}}
export type ClockSample={time:number;position:number;revision:number};
export function delayedClock(history:ClockSample[],sample:ClockSample,delayMs:number){
 if(!delayMs){history.length=0;return sample;}
 history.push(sample);const target=sample.time-delayMs;
 while(history.length>1&&history[1].time<=target)history.shift();
 const a=history[0],b=history[1];
 if(!b||a.time>=target||a.revision!==b.revision)return a;
 const f=Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time||1)));
 return {...a,position:a.position+(b.position-a.position)*f};
}

export type RecordingLevels={music:number;voice:number};
export const defaultRecordingLevels:RecordingLevels={music:55,voice:100};
export function boundedLevel(value:unknown,fallback:number){return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):fallback;}
export function recordingGains(levels:RecordingLevels){
 const music=boundedLevel(levels.music,55)/100,voice=boundedLevel(levels.voice,100)/100;
 // Static headroom for summing two full-scale branches. No signal-dependent ducking.
 const divisor=Math.max(1,music+voice);return {music:music/divisor,voice:voice/divisor};
}
export function loadRecordingLevels():RecordingLevels{try{const v=JSON.parse(localStorage.getItem('anyminus.video.levels.v1')??'null');if(v)return {music:boundedLevel(v.music,55),voice:boundedLevel(v.voice,100)};}catch{}return {...defaultRecordingLevels};}
export function saveRecordingLevels(value:RecordingLevels){try{localStorage.setItem('anyminus.video.levels.v1',JSON.stringify(value));}catch{}}

export const monitorBoostGain=Math.pow(10,3/20);
const monitorBoostKey='anyminus.video.monitor-boost.v1';
export function loadMonitorBoost(){try{return localStorage.getItem(monitorBoostKey)==='true'}catch{return false}}
export function saveMonitorBoost(value:boolean){try{localStorage.setItem(monitorBoostKey,String(value))}catch{}}
