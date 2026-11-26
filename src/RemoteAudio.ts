export class RemoteAudio {
 private context:AudioContext|null=null;private buffers:AudioBuffer[]=[];private gains:GainNode[]=[];private sources:AudioBufferSourceNode[]=[];private offset=0;private start=0;private running=false;private levels=[100,15];private duration=0;
 get position(){return Math.max(0,Math.min(this.duration,this.running&&this.context?this.offset+this.context.currentTime-this.start:this.offset));}
 get length(){return this.duration;}
 get playing(){return this.running;}
 async load(urls:string[],duration:number,signal:AbortSignal){
  if(!Number.isFinite(duration)||duration<=0||duration>900)throw Error('Неподдерживаемая длительность');
  const ctx=new AudioContext({sampleRate:24000});this.context=ctx;await ctx.resume();
  try{const buffers=await Promise.all(urls.map(async url=>{const res=await fetch(url,{credentials:'include',cache:'no-store',redirect:'error',signal});if(!res.ok||!res.body)throw Error('Дорожки недоступны: проверьте media cookie и CORS');const reader=res.body.getReader();const parts:Uint8Array<ArrayBuffer>[]=[];let total=0;try{while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>19000000){await reader.cancel();throw Error('Дорожка превышает 19 МБ')}parts.push(new Uint8Array(chunk.value));}}finally{reader.releaseLock();}const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return ctx.decodeAudioData(bytes.buffer);}));
  if(signal.aborted)throw Error('Отменено');if(buffers.length!==2||buffers.some(b=>Math.abs(b.duration-duration)>1)||Math.abs(buffers[0].duration-buffers[1].duration)>0.1)throw Error('Длительности дорожек не совпадают');
  this.buffers=buffers;this.duration=Math.min(duration,...buffers.map(b=>b.duration));this.gains=buffers.map((_,i)=>{const gain=ctx.createGain();gain.gain.value=this.levels[i]/100;gain.connect(ctx.destination);return gain;});
  }catch(e){this.dispose();throw e;}
 }
 setVolumes(music:number,vocals:number){this.levels=[music,vocals];this.gains.forEach((g,i)=>g.gain.setTargetAtTime(this.levels[i]/100,this.context!.currentTime,.015));}
 async play(){const ctx=this.context;if(!ctx||this.buffers.length!==2)throw Error('Аудио не загружено');await ctx.resume();if(this.running)return;if(this.offset>=this.duration)this.offset=0;this.start=ctx.currentTime+.04;this.sources=this.buffers.map((buffer,i)=>{const source=ctx.createBufferSource();source.buffer=buffer;source.connect(this.gains[i]);source.start(this.start,this.offset);return source});this.running=true;}
 pause(){if(!this.running)return;this.offset=this.position;this.running=false;for(const source of this.sources){try{source.stop()}catch{}source.disconnect()}this.sources=[];}
 async seek(t:number){const resume=this.running;this.pause();this.offset=Math.max(0,Math.min(t,this.duration));if(resume&&this.offset<this.duration)await this.play();}
 dispose(){this.pause();const ctx=this.context;this.context=null;this.buffers=[];this.gains=[];if(ctx&&ctx.state!=='closed')void ctx.close();}
}
