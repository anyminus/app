import {Capacitor, registerPlugin} from '@capacitor/core';
interface AudioLabPlugin {
 begin(options:{bytes:number}):Promise<void>;
 append(options:{data:string}):Promise<void>;
 open(options:{title:string}):Promise<void>;
 cancel():Promise<void>;
}
const lab=registerPlugin<AudioLabPlugin>('AnyMinusAudioLab');
export const nativeLabAvailable=()=>Capacitor.getPlatform()==='ios'&&Capacitor.isPluginAvailable('AnyMinusAudioLab');
const LIMIT=128*1024*1024;
const CHUNK_FRAMES=16384;
function encode(bytes:Uint8Array){let raw='';for(let i=0;i<bytes.length;i+=4096)raw+=String.fromCharCode(...bytes.subarray(i,i+4096));return btoa(raw);}
export async function openNativeLab(buffer:AudioBuffer,title:string,signal:AbortSignal){
 const channels=Math.min(buffer.numberOfChannels,2),frames=buffer.length,rate=buffer.sampleRate;
 const size=frames*channels*2;
 if(!Number.isSafeInteger(size)||size<=0||size+44>LIMIT)throw Error('Фонограмма слишком большая для iOS-теста');
 const header=new Uint8Array(44),v=new DataView(header.buffer);
 const ascii=(at:number,value:string)=>{for(let i=0;i<value.length;i++)header[at+i]=value.charCodeAt(i)};
 ascii(0,'RIFF');v.setUint32(4,size+36,true);ascii(8,'WAVE');ascii(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,size,true);
 signal.throwIfAborted();
 await lab.begin({bytes:size+44});
 try{
  await lab.append({data:encode(header)});
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  for(let at=0;at<frames;at+=CHUNK_FRAMES){
   signal.throwIfAborted();
   const n=Math.min(CHUNK_FRAMES,frames-at),bytes=new Uint8Array(n*channels*2),out=new DataView(bytes.buffer);
   for(let i=0;i<n;i++)for(let c=0;c<channels;c++){
    const sample=Math.max(-1,Math.min(1,data[c][at+i]||0));
    out.setInt16((i*channels+c)*2,Math.round(sample<0?sample*32768:sample*32767),true);
   }
   await lab.append({data:encode(bytes)});
  }
  signal.throwIfAborted();
  await lab.open({title:title.slice(0,200)});
 }finally{await lab.cancel().catch(()=>{});}
}
