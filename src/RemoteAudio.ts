import type {StretchNode} from 'signalsmith-stretch';
import {StemDownload,type DownloadProgress} from './stemDownload';
import {defaultSync,readAudioDiagnostics,resolveDelay,recordingGains,defaultRecordingLevels,type RecordingLevels,type SyncSettings} from './recordingSync';
type MediaSessionNavigator=Navigator&{audioSession?:{type:string}};
export function playbackSession(type='playback'){try{const session=(navigator as MediaSessionNavigator).audioSession;if(session&&session.type!==type)session.type=type}catch{/* Optional Safari API; ordinary playback still works. */}}
export class RemoteAudio {
 private context:AudioContext|null=null;private capturing=false;private playEpoch=0;private buffers:AudioBuffer[]=[];private gains:GainNode[]=[];private output:GainNode|null=null;private sources:AudioBufferSourceNode[]=[];private offset=0;private start=0;private running=false;private levels=[100,15];private duration=0;private starting:Promise<void>|null=null;private needsRecovery=false;private semitones=0;private rate=1;private pitchNode:StretchNode|null=null;private pitchGate:GainNode|null=null;private pitchLatency=0;
 get position(){return Math.max(0,Math.min(this.duration,this.running&&this.context?this.offset+Math.max(0,this.context.currentTime-this.start)*this.rate:this.offset));}
 get length(){return this.duration;}
 get pitch(){return this.semitones;}
 get speed(){return this.rate;}
 // BufferSource speed also changes pitch. Counteract it in the shared live DSP.
 private compensatedPitch(semitones=this.semitones,rate=this.rate){return semitones-12*Math.log2(rate);}
 get pitchSupported(){return !!this.context?.audioWorklet&&typeof AudioWorkletNode!=='undefined';}
 get playing(){return this.running&&this.context?.state==='running';}
 get interrupted(){return this.running&&this.context?.state!=='running';}
 prepare(sessionType='playback'){if(this.context)return;playbackSession(sessionType);const ctx=new AudioContext({latencyHint:'playback'});this.context=ctx;void ctx.resume().catch(()=>{});}
 async load(urls:string[],duration:number,signal:AbortSignal,download=new StemDownload(urls),onProgress:(p:DownloadProgress)=>void=()=>{},refresh:()=>Promise<void>=async()=>{}){
  if(!Number.isFinite(duration)||duration<=0||duration>900||urls.length!==2||!download.matches(urls))throw Error('Неподдерживаемая длительность или дорожки');
  this.prepare();const ctx=this.context!;
  try{const bytes=await download.fetchAll(signal,onProgress,refresh);
   let buffers:AudioBuffer[];try{buffers=await Promise.all(bytes.map(b=>ctx.decodeAudioData(b.buffer)));if(buffers.some(b=>Math.abs(b.duration-duration)>1)||Math.abs(buffers[0].duration-buffers[1].duration)>0.1)throw Error('Длительности дорожек не совпадают');}catch(e){download.clear();throw e}
   if(signal.aborted||this.context!==ctx)throw Error('Отменено');this.buffers=buffers;this.duration=Math.min(duration,...buffers.map(b=>b.duration));this.connectGains(ctx);
  }catch(e){this.dispose();throw e;}
 }
 setVolumes(music:number,vocals:number){this.levels=[music,vocals].map(n=>Number.isFinite(n)?Math.max(0,Math.min(100,n)):0);this.gains.forEach((g,i)=>g.gain.setTargetAtTime(this.levels[i]/100,this.context!.currentTime,.015));}
 // One stereo processor AFTER both independent gains keeps the stems in lockstep.
 private async createPitch(ctx:AudioContext,semitones:number){
  if(!ctx.audioWorklet||typeof AudioWorkletNode==='undefined')throw Error('Изменение тональности не поддерживается браузером');
  let expired=false,timer:number|undefined,node:StretchNode|null=null;
  const init=async()=>{const {default:factory}=await import('signalsmith-stretch');if(expired||this.context!==ctx)throw Error('Аудиовыход изменился');
   // Use the unbundled, same-origin upstream worklet. The factory's default
   // Blob serializes functions, which a bundler/minifier can break.
   factory.moduleUrl=new URL('./signalsmith-worklet.js',document.baseURI).href;
   const n=await factory(ctx,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});node=n;
   if(expired||this.context!==ctx){n.disconnect();n.port.close();throw Error('Аудиовыход изменился')}
   const latency=await n.latency();if(!Number.isFinite(latency)||latency<0||latency>.8)throw Error('Недопустимая задержка аудио');
   await n.schedule({active:true,rate:1,semitones,output:ctx.currentTime+latency});
   if(expired||this.context!==ctx)throw Error('Аудиовыход изменился');return {node:n,latency};
  };
  try{return await Promise.race([init(),new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(Error('Не удалось загрузить обработчик тональности')),5000)})]);}
  catch(e){expired=true;const failed=node as StretchNode|null;if(failed){failed.disconnect();failed.port.close()}throw e}
  finally{clearTimeout(timer)}
 }
 private attachPitch(ctx:AudioContext,node:StretchNode,latency:number){
  const gate=ctx.createGain();gate.gain.value=0;node.connect(gate);gate.connect(this.output!);
  for(const gain of this.gains){gain.disconnect();gain.connect(node)}
  this.pitchNode=node;this.pitchGate=gate;this.pitchLatency=latency;
 }
 private clearPitch(){this.pitchNode?.disconnect();this.pitchNode?.port.close();this.pitchGate?.disconnect();this.pitchNode=null;this.pitchGate=null;this.pitchLatency=0}
 // Apply a validated link preset in one operation before the first source starts.
 async configureInitialPlayback(pitch:number,speed:number){
  if(!Number.isInteger(pitch)||pitch< -6||pitch>6||!Number.isFinite(speed)||speed<.5||speed>2)throw Error('Некорректные настройки ссылки');
  if(this.running||this.starting||this.pitchNode)throw Error('Аудиовыход уже запущен');
  const ctx=this.context;if(!ctx||this.buffers.length!==2)throw Error('Аудио не загружено');
  if(pitch!==0||speed!==1){
   const prepared=await this.createPitch(ctx,this.compensatedPitch(pitch,speed));
   if(this.context!==ctx){prepared.node.disconnect();prepared.node.port.close();throw Error('Аудиовыход изменился')}
   this.attachPitch(ctx,prepared.node,prepared.latency);
  }
  this.semitones=pitch;this.rate=speed;
 }
 async setPitch(value:number){
  if(!Number.isInteger(value)||value< -6||value>6)throw Error('Недопустимая тональность');
  if(value===this.semitones)return;
  if(this.starting)await this.starting;
  const ctx=this.context;if(!ctx||this.buffers.length!==2)throw Error('Аудио не загружено');
  if(this.pitchNode){
   await this.pitchNode.schedule({active:true,rate:1,semitones:this.compensatedPitch(value),output:ctx.currentTime+this.pitchLatency});
   if(this.context!==ctx)throw Error('Аудиовыход изменился');this.semitones=value;return;
  }
  if(value===0){this.semitones=0;return}
  const epoch=this.playEpoch;const prepared=await this.createPitch(ctx,this.compensatedPitch(value));
  if(this.context!==ctx||epoch!==this.playEpoch){prepared.node.disconnect();prepared.node.port.close();if(this.context!==ctx)throw Error('Аудиовыход изменился');return;}
  const resume=this.running;this.pause();this.attachPitch(ctx,prepared.node,prepared.latency);this.semitones=value;
  if(resume&&this.offset<this.duration)await this.play();
 }
 async setSpeed(value:number){
  if(!Number.isFinite(value)||value<.5||value>2)throw Error('Недопустимая скорость');
  if(value===this.rate)return;
  if(this.starting)await this.starting;
  const ctx=this.context;if(!ctx||this.buffers.length!==2)throw Error('Аудио не загружено');
  // Prepare the DSP before stopping dry playback, so failed setup leaves the
  // current position, speed and audio unchanged.
  const epoch=this.playEpoch;const prepared=this.pitchNode?null:await this.createPitch(ctx,this.compensatedPitch(this.semitones,value));
  if(this.context!==ctx||epoch!==this.playEpoch){prepared?.node.disconnect();prepared?.node.port.close();if(this.context!==ctx)throw Error('Аудиовыход изменился');return;}
  const resume=this.running;this.pause();const resumeEpoch=this.playEpoch;
  if(prepared)this.attachPitch(ctx,prepared.node,prepared.latency);
  else{
   try{await this.pitchNode!.schedule({active:true,rate:1,semitones:this.compensatedPitch(this.semitones,value),output:ctx.currentTime+this.pitchLatency})}
   catch(e){if(this.context===ctx)this.markOutputStalled();throw e}
  }
  if(this.context!==ctx)throw Error('Аудиовыход изменился');
  this.rate=value;
  if(resume&&resumeEpoch===this.playEpoch&&this.offset<this.duration)await this.play();
 }
 private connectGains(ctx:AudioContext){const output=ctx.createGain();output.connect(ctx.destination);this.output=output;this.gains=this.buffers.map((_,i)=>{const gain=ctx.createGain();gain.gain.value=this.levels[i]/100;gain.connect(output);return gain;});}
 // A running state alone is not proof that WebKit's render clock is advancing.
 // Keep decoded stems and position; rebuild the audio output only on explicit Play.
 markOutputStalled(){this.pause();this.needsRecovery=true;}
 private rebuildOutput(sessionType='playback'){this.pause();this.starting=null;const old=this.context;for(const gain of this.gains)try{gain.disconnect()}catch{}this.gains=[];this.clearPitch();this.output?.disconnect();this.output=null;this.context=null;if(old&&old.state!=='closed')void old.close().catch(()=>{});this.prepare(sessionType);this.connectGains(this.context!);this.needsRecovery=false;}
 private async waitForClock(ctx:AudioContext){const deadline=performance.now()+1800;while(this.context===ctx&&this.running){if(ctx.state==='running'&&ctx.currentTime>this.start+.02)return;if(performance.now()>=deadline)break;await new Promise<void>(resolve=>window.setTimeout(resolve,60))}if(this.context!==ctx||!this.running)return;throw Error('Аудиовыход не запустился. Нажмите воспроизведение ещё раз.');}
 async play(userInitiated=false){if(this.starting)return this.starting;if(!this.context||this.buffers.length!==2)throw Error('Аудио не загружено');playbackSession(this.capturing?'play-and-record':'playback');
 if(userInitiated&&(this.needsRecovery||this.interrupted||String(this.context.state)==='interrupted')){if(this.capturing)throw Error('Аудиовыход прерван. Повторите запись.');this.rebuildOutput();}
 const ctx=this.context!,epoch=this.playEpoch;
 const start=async()=>{let timeout:number|undefined;try{await Promise.race([ctx.resume(),new Promise<never>((_,reject)=>{timeout=window.setTimeout(()=>reject(Error('Браузер заблокировал звук. Нажмите воспроизведение ещё раз.')),4000)})]);}finally{clearTimeout(timeout)}
 if(epoch!==this.playEpoch)return;
 if(this.context!==ctx||ctx.state!=='running')throw Error('Аудиовыход недоступен. Нажмите воспроизведение ещё раз.');
 if(this.running)return;if(this.offset>=this.duration)this.offset=0;
 if((this.semitones!==0||this.rate!==1)&&!this.pitchNode){const prepared=await this.createPitch(ctx,this.compensatedPitch());if(this.context!==ctx||epoch!==this.playEpoch){prepared.node.disconnect();prepared.node.port.close();if(epoch!==this.playEpoch)return;throw Error('Аудиовыход изменился')}this.attachPitch(ctx,prepared.node,prepared.latency)}
 const inputStart=ctx.currentTime+.04;this.start=inputStart+this.pitchLatency;
 if(this.pitchGate){this.pitchGate.gain.cancelScheduledValues(ctx.currentTime);this.pitchGate.gain.setValueAtTime(0,ctx.currentTime);this.pitchGate.gain.setValueAtTime(1,this.start)}
 this.sources=this.buffers.map((buffer,i)=>{const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=this.rate;source.connect(this.gains[i]);source.start(inputStart,this.offset);return source});this.running=true;await this.waitForClock(ctx);};
 const pending=start();this.starting=pending;try{await pending}catch(e){if(epoch!==this.playEpoch)return;if(this.context===ctx)this.markOutputStalled();throw e}finally{if(this.starting===pending)this.starting=null}
 }
 pause(){this.playEpoch++;if(!this.running)return;this.offset=this.position;this.running=false;if(this.pitchGate&&this.context){this.pitchGate.gain.cancelScheduledValues(this.context.currentTime);this.pitchGate.gain.setValueAtTime(0,this.context.currentTime)}for(const source of this.sources){try{source.stop()}catch{}source.disconnect()}this.sources=[];}
 async seek(t:number){const resume=this.running;this.pause();this.offset=Math.max(0,Math.min(t,this.duration));if(resume&&this.offset<this.duration)await this.play();}
 recordingDiagnostics(track?:MediaStreamTrack){return readAudioDiagnostics(this.context,track);}
 async createRecordingMix(microphone:MediaStream,settings:SyncSettings=defaultSync,levels:RecordingLevels=defaultRecordingLevels){
 if(!this.context||this.capturing||this.buffers.length!==2||!microphone.getAudioTracks().some(t=>t.readyState==='live'))throw Error('Аудиовыход не готов к записи');
 // The camera permission can interrupt Safari's old playback context. Recover
 // synchronously on the explicit recording gesture, BEFORE attaching the mic.
 playbackSession('play-and-record');
 if(this.needsRecovery||this.context.state!=='running')this.rebuildOutput('play-and-record');
 const ctx=this.context!;let timeout:number|undefined;
 try{
  await Promise.race([ctx.resume(),new Promise<never>((_,reject)=>{timeout=window.setTimeout(()=>reject(Error('Safari не запустил звук. Нажмите Начать запись ещё раз.')),4000)})]);
  if(this.context!==ctx||ctx.state!=='running')throw Error('Аудиовыход недоступен. Повторите запись.');
  if((this.semitones!==0||this.rate!==1)&&!this.pitchNode){const prepared=await this.createPitch(ctx,this.compensatedPitch());if(this.context!==ctx){prepared.node.disconnect();prepared.node.port.close();throw Error('Аудиовыход изменился')}this.attachPitch(ctx,prepared.node,prepared.latency)}
  if(!microphone.getAudioTracks().some(t=>t.readyState==='live'))throw Error('Микрофон отключён');
 }catch(e){if(this.context===ctx)this.markOutputStalled();throw e}finally{clearTimeout(timeout)}
 const destination=ctx.createMediaStreamDestination(),music=ctx.createGain(),voice=ctx.createGain(),mic=ctx.createMediaStreamSource(microphone);
 // Independent peak protection: singing cannot trigger accompaniment gain reduction.
 // Leave headroom when summing the two branches; never monitor the microphone.
 const musicLimiter=ctx.createDynamicsCompressor(),voiceLimiter=ctx.createDynamicsCompressor();
 for(const limiter of [musicLimiter,voiceLimiter]){limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.08;}
 const initialGains=recordingGains(levels);music.gain.value=initialGains.music;voice.gain.value=initialGains.voice;
 const setLevels=(value:RecordingLevels)=>{const gains=recordingGains(value);for(const [node,level] of [[music,gains.music],[voice,gains.voice]] as const){node.gain.cancelScheduledValues(ctx.currentTime);node.gain.setTargetAtTime(level,ctx.currentTime,.015)}};
 const output=this.output!;
 const diagnostics=this.recordingDiagnostics(microphone.getAudioTracks()[0]),delayMs=resolveDelay(settings,diagnostics);
 const delay=delayMs>0?ctx.createDelay(.5):null;
 if(delay){delay.delayTime.value=delayMs/1000;output.connect(delay);delay.connect(musicLimiter);}else output.connect(musicLimiter);musicLimiter.connect(music);music.connect(destination);mic.connect(voiceLimiter);voiceLimiter.connect(voice);voice.connect(destination);this.capturing=true;
 let closed=false;return {stream:destination.stream,delayMs,diagnostics,setLevels,close:()=>{if(closed)return;closed=true;this.capturing=false;try{output.disconnect(delay??musicLimiter)}catch{}delay?.disconnect();musicLimiter.disconnect();music.disconnect();mic.disconnect();voiceLimiter.disconnect();voice.disconnect();destination.stream.getTracks().forEach(t=>t.stop());}};
 }
 dispose(){this.pause();const ctx=this.context;this.clearPitch();this.output?.disconnect();this.output=null;this.context=null;this.buffers=[];this.gains=[];this.semitones=0;this.rate=1;this.needsRecovery=false;if(ctx&&ctx.state!=='closed')void ctx.close().catch(()=>{});}
}
