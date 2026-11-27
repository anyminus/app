export type AudioOutputMode='auto'|'standard'|'carplay';
export const audioOutputKey='anyminus:audio-output-mode';
let memoryMode:AudioOutputMode='auto';
export function readAudioOutputMode():AudioOutputMode{try{const value=localStorage.getItem(audioOutputKey);if(value==='auto'||value==='standard'||value==='carplay')return value;}catch{}return memoryMode;}
export function saveAudioOutputMode(value:string):AudioOutputMode{const mode:AudioOutputMode=value==='standard'||value==='carplay'?value:'auto';memoryMode=mode;try{localStorage.setItem(audioOutputKey,mode)}catch{}return mode;}
export function audioSessionAvailable(){try{return !!(navigator as Navigator&{audioSession?:{type:string}}).audioSession}catch{return false}}
