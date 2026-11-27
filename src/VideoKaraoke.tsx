import {t as trUi} from './i18n.mjs';
import {useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type RefObject,type Ref,type CSSProperties} from 'react';
import {Video,Square,Download,X,Share2,Settings2,Play,Music2,MicVocal} from 'lucide-react';
import {RemoteAudio,playbackSession} from './RemoteAudio';
import {loadSync,saveSync,loadMonitorBoost,saveMonitorBoost,resolveDelay,usesCarPlayEstimate,boundedDelay,delayedClock,loadRecordingLevels,saveRecordingLevels,boundedLevel,type RecordingLevels,type SyncSettings,type SyncMode,type AudioDiagnostics,type ClockSample} from './recordingSync';
import {drawKaraokeFrame,overlaySupported,resetVideoMotion,type TimedLine} from './videoOverlay';
const noVideoLyrics:readonly TimedLine[]=[];
type Phase='idle'|'permission'|'preview'|'starting'|'recording'|'finishing'|'result';
export type VideoTransport={toggle:()=>void};
type Props={ref:Ref<VideoTransport>;onTransportReady:(ready:boolean)=>void;audio:RefObject<RemoteAudio|null>;lyrics:readonly TimedLine[];seekRevision:RefObject<number>;playing:boolean;title:string;artist:string;disabled:boolean;onMode:(active:boolean)=>void;onPrepare:()=>Promise<void>;onStart:()=>Promise<boolean|undefined>;onStop:()=>void};
type CaptureProfile={fps:number;width:number;height:number;bitrate:number};
const standardProfile:CaptureProfile={fps:30,width:1280,height:720,bitrate:2800000};
const mp4=['video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'];
function appleMobile(){return /iPhone|iPad|iPod/i.test(navigator.platform)||(/Mac/i.test(navigator.platform)&&navigator.maxTouchPoints>1)||(/Apple/i.test(navigator.vendor)&&/iPhone|iPad|iPod/i.test(navigator.userAgent));}
function requestedProfile():CaptureProfile{
 if(appleMobile())return {...standardProfile};
 const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
 const cores=navigator.hardwareConcurrency;
 const constrained=(typeof memory==='number'&&memory<=3)||(cores>0&&cores<=4);
 return constrained?{fps:24,width:960,height:540,bitrate:1600000}:{...standardProfile};
}
function cameraProfile(track:MediaStreamTrack,requested:CaptureProfile):CaptureProfile{
 if(appleMobile())return requested;
 let settings:MediaTrackSettings={},capabilities:MediaTrackCapabilities={};
 try{settings=track.getSettings();}catch{}
 try{capabilities=track.getCapabilities?.()??{};}catch{}
 const rates=[settings.frameRate,capabilities.frameRate?.max].filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0);
 const fps=Math.max(1,Math.min(requested.fps,...rates));
 const actualPixels=(settings.width||requested.width)*(settings.height||requested.height);
 const pixels=Math.min(actualPixels,requested.width*requested.height);
 const bitrate=Math.round(Math.max(500000,Math.min(requested.bitrate,2800000*pixels/(1280*720)*fps/30))/1000)*1000;
 return {...requested,fps,bitrate};
}
const rawMicPreferences:MediaTrackConstraints={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
const voiceProcessingKeys=['echoCancellation','noiseSuppression','autoGainControl'] as const;
// A plain false is an ideal constraint. If a browser reports it ignored
// that request, try an exact false on the affected track only.
async function verifyRawMicrophone(track:MediaStreamTrack){
 const enabled=()=>{try{const settings=track.getSettings();return voiceProcessingKeys.filter(key=>settings[key]===true);}catch{return [];}};
 const initial=enabled();if(!initial.length)return false;
 let timer:number|undefined;
 try{const constraints=Object.fromEntries(initial.map(key=>[key,{exact:false}])) as MediaTrackConstraints;
  await Promise.race([track.applyConstraints(constraints),new Promise<void>(resolve=>{timer=window.setTimeout(resolve,1500)})]);
 }catch{/* Some platforms cannot disable voice processing. */}finally{clearTimeout(timer)}
 return enabled().length>0;
}
function mp4Available(){try{return typeof MediaRecorder==='function'&&(typeof MediaRecorder.isTypeSupported!=='function'||mp4.some(type=>MediaRecorder.isTypeSupported(type)));}catch{return false;}}
function canShareFile(file:File){try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch{return false;}}
const webm=['video/webm;codecs=vp8,opus','video/webm'];
// Feature detection, not a phone model or OS allowlist.
function basicSupport(){
 return window.isSecureContext&&typeof navigator.mediaDevices?.getUserMedia==='function'&&typeof MediaRecorder==='function'&&typeof MediaStream==='function'&&typeof AudioContext==='function'&&typeof AudioContext.prototype.createMediaStreamDestination==='function'&&typeof AudioContext.prototype.createMediaStreamSource==='function'&&typeof HTMLVideoElement.prototype.play==='function';
}
// Android Chromium generally prefers WebM; Safari can use MP4. A positive
// isTypeSupported does not guarantee available hardware/resources at start().
function startRecorder(stream:MediaStream,overlay:boolean,profile:CaptureProfile){
 let last:unknown;
 for(const mimeType of (appleMobile()?mp4:[...(overlay||/Android/i.test(navigator.userAgent)?[...webm,...mp4]:[...mp4,...webm]),''])){
  try{
   if(mimeType&&typeof MediaRecorder.isTypeSupported==='function'&&!MediaRecorder.isTypeSupported(mimeType))continue;
   const recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:profile.bitrate,audioBitsPerSecond:128000});
   recorder.start(1000);if(recorder.state!=='recording')throw Error(trUi('Кодировщик не запустился'));return recorder;
  }catch(e){last=e;}
 }
 throw Error((appleMobile()?trUi('Не удалось запустить MP4 на iPhone/iPad: '):trUi('Не удалось запустить кодирование видео: '))+(last instanceof Error?last.message:trUi('нет доступного формата')));
}
export function VideoKaraoke(props:Props){
 const [cameraRatio,setCameraRatio]=useState(16/9);
 const frameStyle={'--camera-ratio':cameraRatio} as CSSProperties;
 function updateCameraRatio(video:HTMLVideoElement){if(video.videoWidth>0&&video.videoHeight>0)setCameraRatio(video.videoWidth/video.videoHeight);}
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState(''),[result,setResult]=useState<{url:string;file:File}|null>(null);
 const [viewOpen,setViewOpen]=useState(false);
 const viewer=useRef<HTMLDialogElement|null>(null),viewButton=useRef<HTMLButtonElement|null>(null);
 const [levels,setLevels]=useState<RecordingLevels>(loadRecordingLevels);
 const [monitorBoost,setMonitorBoost]=useState(loadMonitorBoost);
 function updateMonitorBoost(value:boolean){try{mix.current?.setMonitorBoost(value);setMonitorBoost(value);saveMonitorBoost(value)}catch{setError(trUi('Не удалось изменить усиление прослушивания.'))}}
 function updateLevels(value:RecordingLevels){setLevels(value);saveRecordingLevels(value);mix.current?.setLevels(value);}
 const [micProcessingWarning,setMicProcessingWarning]=useState(false);
 const [syncOpen,setSyncOpen]=useState(false),[syncSettings,setSyncSettings]=useState<SyncSettings>(loadSync);
 const [diagnostics,setDiagnostics]=useState<AudioDiagnostics|null>(null),[outputName,setOutputName]=useState(trUi('Не определён браузером')),[appliedDelay,setAppliedDelay]=useState(0);
 const clockHistory=useRef<ClockSample[]>([]),recordDelay=useRef(0),tailTimer=useRef<number|undefined>(undefined);
 function updateSync(value:SyncSettings){setSyncSettings(value);saveSync(value);}
 function refreshDiagnostics(){const audio=latest.current.audio.current,track=camera.current?.getAudioTracks()[0];if(!audio||!track)return;setDiagnostics(audio.recordingDiagnostics(track));}
 useEffect(()=>{if(phase!=='preview')return;refreshDiagnostics();const refresh=()=>refreshDiagnostics();const timer=window.setInterval(refresh,1000);navigator.mediaDevices?.addEventListener?.('devicechange',refresh);return()=>{clearInterval(timer);navigator.mediaDevices?.removeEventListener?.('devicechange',refresh);};},[phase]);
 useEffect(()=>{let live=true;setOutputName(trUi('Не определён браузером'));const id=diagnostics?.sinkId;if(id&&syncOpen){void navigator.mediaDevices?.enumerateDevices?.().then(devices=>{if(live)setOutputName(devices.find(device=>device.kind==='audiooutput'&&device.deviceId===id)?.label||trUi('Системное устройство'));}).catch(()=>{});}return()=>{live=false};},[diagnostics?.sinkId,syncOpen]);
 const videoOnlyPreview=useRef<MediaStream|null>(null);
 const [sharing,setSharing]=useState(false),[shareHint,setShareHint]=useState('');const shareBusy=useRef(false),shareAttempt=useRef(0);
 const [includeLyrics,setIncludeLyrics]=useState(true);const recordLyrics=useRef(false);const [unsupported,setUnsupported]=useState(false);const apple=appleMobile(),missingMP4=apple&&!mp4Available(),missingCanvas=!overlaySupported();const supported=basicSupport()&&!unsupported&&!missingMP4&&!missingCanvas;
 const previewResult=useRef<HTMLVideoElement|null>(null);const canvas=useRef<HTMLCanvasElement|null>(null),canvasStream=useRef<MediaStream|null>(null);
 const finishTimer=useRef<number|undefined>(undefined),finalizing=useRef(false),captureUsed=useRef(false);
 const canIncludeLyrics=props.lyrics.length>0;
 const showOverlay=!missingCanvas;
 const visibleLyrics=(p:Props,previewPhase:boolean)=>(previewPhase?includeLyrics:recordLyrics.current)?p.lyrics:noVideoLyrics;
 const profile=useRef<CaptureProfile>(standardProfile);
 const latest=useRef(props);latest.current=props;
 const mounted=useRef(false),generation=useRef(0),camera=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement|null>(null),recorder=useRef<MediaRecorder|null>(null),mix=useRef<Awaited<ReturnType<RemoteAudio['createRecordingMix']>>|null>(null),url=useRef(''),chunks=useRef<Blob[]>([]),bytes=useRef(0),stopReason=useRef(''),starting=useRef(false);
 function releaseCanvas(){resetVideoMotion(canvas.current);canvasStream.current?.getTracks().forEach(t=>t.stop());canvasStream.current=null;}
 function release(){clearTimeout(tailTimer.current);tailTimer.current=undefined;clockHistory.current=[];recordDelay.current=0;releaseCanvas();const hadMix=!!mix.current;mix.current?.close();mix.current=null;const stream=camera.current;camera.current=null;videoOnlyPreview.current=null;if(preview.current)preview.current.srcObject=null;stream?.getTracks().forEach(t=>t.stop());const audio=latest.current.audio.current;if(audio)audio.restorePlaybackSession();else playbackSession();if((hadMix||stream)&&appleMobile())audio?.markOutputStalled(false);}
 function closeViewer(){previewResult.current?.pause();setViewOpen(false);}
 useEffect(()=>{if(!viewOpen)return;const dialog=viewer.current;if(!dialog)return;dialog.showModal();return()=>{previewResult.current?.pause();if(dialog.open)dialog.close();viewButton.current?.focus();};},[viewOpen]);
 function clearResult(){closeViewer();shareAttempt.current++;shareBusy.current=false;setSharing(false);setShareHint('');if(url.current)URL.revokeObjectURL(url.current);url.current='';setResult(null);}
 function complete(r:MediaRecorder,timedOut=false){
  if(recorder.current!==r)return;
  clearTimeout(finishTimer.current);clearTimeout(tailTimer.current);tailTimer.current=undefined;finishTimer.current=undefined;finalizing.current=false;recorder.current=null;
  r.ondataavailable=null;r.onstop=null;r.onerror=null;
  const type=(chunks.current.find(b=>b.type)?.type||r.mimeType||'').split(';')[0].trim().toLowerCase(),parts=chunks.current;chunks.current=[];bytes.current=0;
  latest.current.onStop();release();if(!mounted.current)return;
  recordLyrics.current=false;latest.current.onMode(false);setError(stopReason.current);
  if(!parts.length){setPhase('idle');setError(timedOut?trUi('Браузер не завершил запись. Начните новый дубль.'):stopReason.current||trUi('Видео не записалось. Попробуйте снова.'));return;}
  if(type!=='video/mp4'&&type!=='video/webm'){setPhase('idle');setError(trUi('Не удалось определить формат записанного видео.'));return;}
  if(timedOut)setError(trUi('Сохранена доступная часть записи. Браузер не завершил файл — он может не открываться. Можно начать новый дубль.'));
  else if(appleMobile()&&type!=='video/mp4')setError(trUi('Браузер неожиданно вернул WebM вместо MP4. Этот файл можно сохранить для конвертации, но он может не открываться на iPhone.'));
  try{const file=new File(parts,'AnyMinus-'+Date.now()+(type==='video/mp4'?'.mp4':'.webm'),{type});url.current=URL.createObjectURL(file);setResult({url:url.current,file});setPhase('result');}
  catch{setPhase('idle');setError(trUi('Не удалось создать видеофайл. Начните новый дубль.'));}
 }
 function finish(reason=''){
  const r=recorder.current;if(!r)return;if(reason&&!stopReason.current)stopReason.current=reason;
  if(finalizing.current){if(reason&&tailTimer.current!==undefined){clearTimeout(tailTimer.current);tailTimer.current=undefined;try{if(r.state!=='inactive')r.stop();}catch{complete(r,true);}}return;}
  finalizing.current=true;setSyncOpen(false);setPhase('finishing');latest.current.onStop();
  const stop=()=>{tailTimer.current=undefined;if(recorder.current!==r)return;try{if(r.state!=='inactive')r.stop();}catch{complete(r,true);}};
  // Keep the recorder open for the delayed music tail on normal stop.
  const tail=!reason&&!document.hidden&&r.state==='recording'?recordDelay.current:0;
  finishTimer.current=window.setTimeout(()=>{if(recorder.current!==r)return;stop();complete(r,true);},5000+tail);
  if(tail>0)tailTimer.current=window.setTimeout(stop,tail+40);else stop();
 }
 function cancel(){if(recorder.current){finish(trUi('Запись остановлена.'));return;}clearTimeout(finishTimer.current);finalizing.current=false;recordLyrics.current=false;generation.current++;starting.current=false;release();latest.current.onMode(false);setPhase('idle');}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;clearTimeout(finishTimer.current);clearTimeout(tailTimer.current);const r=recorder.current;recorder.current=null;if(r){r.ondataavailable=null;r.onstop=null;r.onerror=null;try{if(r.state!=='inactive')r.stop();}catch{}}release();if(url.current)URL.revokeObjectURL(url.current);}},[]);
 useImperativeHandle(props.ref,()=>({toggle:()=>{if(phase==='preview')void start();else if(phase==='recording')finish();}}));
 useLayoutEffect(()=>{latest.current.onTransportReady(phase==='preview'||phase==='recording');},[phase]);
 useEffect(()=>{const video=preview.current,stream=videoOnlyPreview.current;if(video&&stream&&video.srcObject!==stream){video.srcObject=stream;void video.play().catch(()=>{});}},[phase]);
 useEffect(()=>{if(phase==='recording'&&!props.playing)finish();},[phase,props.playing]);
 useEffect(()=>{
  if(!showOverlay||!(phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing')){resetVideoMotion(canvas.current);return;}
  let raf=0,nextFrame=0;const period=1000/profile.current.fps;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  // Keep an absolute cadence instead of accumulating rAF quantization error.
  function tick(now:number){if(now+1>=nextFrame){nextFrame=nextFrame===0?now+period:nextFrame+Math.max(1,Math.floor((now+1-nextFrame)/period)+1)*period;const cv=canvas.current,vid=preview.current,p=latest.current;if(cv&&vid)try{const sample=delayedClock(clockHistory.current,{time:now,position:p.audio.current?.position??0,revision:p.seekRevision.current},phase==='preview'?0:recordDelay.current);drawKaraokeFrame(cv,vid,visibleLyrics(p,phase==='preview'),sample.position,{title:p.title,artist:p.artist},undefined,sample.revision,now,(p.playing||phase==='finishing')&&!reduced.matches);}catch{/* temporary missing camera frame */}}raf=requestAnimationFrame(tick);}
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[showOverlay,phase,includeLyrics]);
 useEffect(()=>{const hidden=()=>{if(!document.hidden)return;if(recorder.current)finish(trUi('Запись остановлена: приложение свернули.'));else if(camera.current){cancel();setError(trUi('Камера отключена: приложение свернули.'));}};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 async function enable(){
  setError('');setMicProcessingWarning(false);setSyncOpen(false);setDiagnostics(null);setAppliedDelay(0);clearResult();if(!supported){setError(trUi('Ваш телефон или браузер не поддерживает видеокараоке. Откройте AnyMinus в актуальном Chrome или Safari.'));return;}
  const id=++generation.current;setCameraRatio(16/9);setPhase('permission');props.onMode(true);
  try{await props.onPrepare();if(!mounted.current||generation.current!==id)return;playbackSession('play-and-record');
   let stream:MediaStream;const requested=requestedProfile();
   // Music capture rather than voice-call processing. These are preferences;
   // browsers may ignore unsupported constraints or impose OS audio routing.
   const audioConstraints=rawMicPreferences;
   try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:requested.width},height:{ideal:requested.height},frameRate:{ideal:requested.fps,max:requested.fps}},audio:audioConstraints});}
   catch(e){if(!(e instanceof DOMException)||!['OverconstrainedError','NotSupportedError','TypeError'].includes(e.name))throw e;if(!mounted.current||generation.current!==id)return;stream=await navigator.mediaDevices.getUserMedia({video:true,audio:audioConstraints});}
   if(!stream.getVideoTracks().some(t=>t.readyState==='live')||!stream.getAudioTracks().some(t=>t.readyState==='live')){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Camera or microphone unavailable','NotFoundError');}
   if(!mounted.current||generation.current!==id||document.hidden){stream.getTracks().forEach(t=>t.stop());if(mounted.current&&generation.current===id)cancel();return;}camera.current=stream;profile.current=cameraProfile(stream.getVideoTracks()[0],requested);
   videoOnlyPreview.current=new MediaStream(stream.getVideoTracks());
   for(const t of stream.getTracks())t.addEventListener('ended',()=>{if(!mounted.current||camera.current!==stream)return;if(recorder.current)finish(trUi('Камера или микрофон отключились.'));else{cancel();setError(trUi('Камера или микрофон отключились.'));}},{once:true});
   const processing=await verifyRawMicrophone(stream.getAudioTracks().find(t=>t.readyState==='live')!);
   if(!mounted.current||generation.current!==id||camera.current!==stream)return;
   setMicProcessingWarning(processing);setPhase('preview');
  }catch(e){if(!mounted.current||generation.current!==id)return;cancel();const name=e instanceof Error?e.name:'';
   if(name==='NotSupportedError'||name==='NotFoundError'){setUnsupported(true);setError(trUi('Ваш телефон или браузер не поддерживает видеокараоке: камера или микрофон недоступны.'));}
   else if(name==='NotAllowedError'||name==='SecurityError')setError(trUi('Разрешите доступ к камере и микрофону.'));else if(name==='NotReadableError'||name==='AbortError')setError(trUi('Камера или микрофон заняты либо недоступны. Закройте другие приложения и повторите.'));else setError(trUi('Не удалось включить камеру или микрофон. Попробуйте открыть сайт в Chrome или Safari.'));}
 }
 async function start(){
  if(props.disabled||!camera.current||!props.audio.current||recorder.current||starting.current)return;starting.current=true;const id=generation.current;const source=camera.current;recordLyrics.current=includeLyrics&&canIncludeLyrics;setError('');setPhase('starting');chunks.current=[];bytes.current=0;stopReason.current='';
  try{
   if(apple&&captureUsed.current)props.audio.current.markOutputStalled(false);
   const prepared=await props.audio.current.createRecordingMix(source,syncSettings,levels,monitorBoost);
   if(!mounted.current||generation.current!==id||camera.current!==source){prepared.close();return;}mix.current=prepared;captureUsed.current=true;recordDelay.current=prepared.delayMs;clockHistory.current=[];setAppliedDelay(prepared.delayMs);setDiagnostics(prepared.diagnostics);setSyncOpen(false);
   let videoTracks:MediaStreamTrack[];
   {
    const cv=canvas.current,vid=preview.current;
    if(!cv||!vid)throw Error(trUi('Предпросмотр камеры недоступен.'));
    // Permission resolution is not proof that a decoded camera frame exists.
    const deadline=performance.now()+2500;
    while(!drawKaraokeFrame(cv,vid,visibleLyrics(latest.current,false),props.audio.current?.position??0,{title:latest.current.title,artist:latest.current.artist},undefined,latest.current.seekRevision.current,performance.now(),false)){
     if(!mounted.current||generation.current!==id||camera.current!==source)return;
     if(performance.now()>=deadline)throw Error(trUi('Камера не передала первый кадр. Повторите запуск записи.'));
     await new Promise<void>(resolve=>window.setTimeout(resolve,50));
    }
    if(!mounted.current||generation.current!==id||camera.current!==source)return;
    try{canvasStream.current=cv.captureStream(profile.current.fps);videoTracks=canvasStream.current.getVideoTracks();if(!videoTracks.some(t=>t.readyState==='live'))throw Error('Canvas track unavailable');drawKaraokeFrame(cv,vid,visibleLyrics(latest.current,false),props.audio.current?.position??0,{title:latest.current.title,artist:latest.current.artist},undefined,latest.current.seekRevision.current,performance.now(),false);}
    catch{releaseCanvas();throw Error(trUi('Не удалось создать видеопоток с оформлением. Повторите запись.'));}
    for(const track of videoTracks)track.addEventListener('ended',()=>{if(mounted.current&&recorder.current?.state==='recording')finish(trUi('Видеопоток с текстом прерван.'));},{once:true});
   }
   const stream=new MediaStream([...videoTracks,...prepared.stream.getAudioTracks()]);
   let r:MediaRecorder;try{r=startRecorder(stream,true,profile.current);}catch(e){if(apple){cancel();setUnsupported(true);setError(trUi('На этом iPhone/iPad не удалось запустить запись MP4. Видеокараоке недоступно в текущем браузере.'));return;}throw e;}recorder.current=r;
   r.ondataavailable=e=>{if(recorder.current===r&&e.data.size){chunks.current.push(e.data);bytes.current+=e.data.size;if(bytes.current>=180*1024*1024&&r.state==='recording')finish(trUi('Достигнут предел размера записи.'));}};
   r.onerror=e=>{const detail=(e as Event&{error?:DOMException}).error;stopReason.current=trUi('Ошибка записи видео')+(detail?': '+detail.name+' — '+detail.message:'.');finish(stopReason.current);};
   r.onstop=()=>complete(r);
   const ok=await props.onStart();if(!mounted.current||recorder.current!==r||finalizing.current)return;if(!ok||r.state!=='recording'){finish(trUi('Не удалось запустить музыку. Начните новый дубль.'));return;}setPhase('recording');
   }catch(e){if(!mounted.current||generation.current!==id)return;const r=recorder.current;if(r){finish(trUi('Не удалось начать запись.'));return;}recorder.current=null;releaseCanvas();mix.current?.close();mix.current=null;recordDelay.current=0;clockHistory.current=[];recordLyrics.current=false;setPhase('preview');setError(e instanceof Error?e.name+': '+e.message:trUi('Не удалось начать запись. Повторите попытку.'));}finally{if(generation.current===id)starting.current=false;}
 }
 async function share(){
  if(!result||shareBusy.current)return;
  if((apple&&result.file.type!=='video/mp4')||!canShareFile(result.file)){setShareHint(trUi('Отправка этого формата недоступна. Сохраните видео и прикрепите его в мессенджере.'));return;}
  const player=previewResult.current;player?.pause();shareBusy.current=true;setSharing(true);setShareHint(trUi('Если отправка зависнет, закройте системное окно и прикрепите сохранённый файл в Telegram.'));
  const attempt=++shareAttempt.current;
  try{await navigator.share({files:[result.file]});}
  catch(e){if(mounted.current&&shareAttempt.current===attempt&&!(e instanceof DOMException&&e.name==='AbortError'))setShareHint(trUi('Не удалось передать файл. Сохраните видео и прикрепите его в мессенджере.'));}
  finally{if(mounted.current&&shareAttempt.current===attempt){shareBusy.current=false;setSharing(false);}}
 }
 const active=phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing';
 return <div className="video-karaoke" aria-label={trUi("Видеокараоке")}>
  {phase==='idle'&&<><button className="video-karaoke-trigger" type="button" disabled={props.disabled||!supported} onClick={()=>void enable()}><Video size={16}/>{trUi("Записать видео ")}<span>β</span></button>{!supported&&!error&&<p className="video-karaoke-error" role="status">{missingMP4?trUi('В этом браузере iPhone/iPad недоступна запись MP4. Видеокараоке отключено.'):missingCanvas?trUi('Браузер не поддерживает запись видео с оформлением.'):trUi('Ваш телефон или браузер не поддерживает видеокараоке. Попробуйте Chrome или Safari.')}</p>}</>}
  {phase==='permission'&&<div className="video-karaoke-actions"><span role="status">{trUi("Разрешите камеру и микрофон…")}</span><button type="button" onClick={cancel}>{trUi("Отмена")}</button></div>}
  {active&&<div className="video-karaoke-panel"><div className="video-karaoke-preview" style={frameStyle}><video ref={preview} autoPlay muted playsInline onLoadedMetadata={e=>updateCameraRatio(e.currentTarget)} onResize={e=>updateCameraRatio(e.currentTarget)} aria-label={trUi("Предпросмотр камеры")}/><canvas ref={canvas} className={showOverlay?'video-overlay visible':'video-overlay'} aria-label={trUi("Текст в видео")} aria-hidden={!showOverlay}/>{phase==='recording'&&<span className="video-karaoke-rec">● REC</span>}</div><div className="video-karaoke-actions">
   {phase==='preview'?<><button type="button" className="video-karaoke-start" disabled={props.disabled} onClick={()=>void start()}><Video size={16}/>{trUi("Начать запись")}</button><label className="video-overlay-option"><input type="checkbox" checked={includeLyrics&&canIncludeLyrics} disabled={!canIncludeLyrics} onChange={e=>setIncludeLyrics(e.target.checked)}/>{trUi("Текст на видео")}</label><span>{!canIncludeLyrics?trUi('Без таймкодов: название, артист и логотип сохраняются.'):trUi('Лучше в наушниках')}</span><button type="button" onClick={()=>{refreshDiagnostics();setSyncOpen(o=>!o)}} aria-expanded={syncOpen} aria-controls="video-sync-settings"><Settings2 size={14}/>{trUi("Настройки звука")}</button><button type="button" onClick={cancel}><X size={14}/>{trUi("Отмена")}</button></>:phase==='finishing'?<><span role="status">{trUi("Сохраняем видео…")}</span><button type="button" onClick={()=>{const r=recorder.current;if(r){try{if(r.state!=='inactive')r.stop();}catch{}complete(r,true)}}}>{trUi("Завершить принудительно")}</button></>:<><button type="button" className="video-karaoke-start" disabled={phase==='starting'} onClick={()=>finish()}><Square size={14}/>{trUi("Остановить")}</button><span role="status">{phase==='starting'?trUi('Запуск…'):trUi('Идёт запись · локально')}</span>{phase==='recording'&&<span>{trUi("Компенсация: ")}{appliedDelay}{trUi(" мс")}</span>}{phase==='recording'&&<button type="button" aria-expanded={syncOpen} aria-controls="video-sync-settings" onClick={()=>setSyncOpen(o=>!o)}><Settings2 size={14}/>{trUi("Настройки звука")}</button>}</>}
  </div></div>}
  {(phase==='preview'||phase==='recording')&&syncOpen&&<section id="video-sync-settings" className="video-sync-settings" aria-label={trUi("Настройки звука видеозаписи")}>
   <div className="video-sync-heading"><strong>{trUi("Настройки звука")}</strong><button type="button" onClick={()=>setSyncOpen(false)} aria-label={trUi("Закрыть настройки звука")}><X size={15}/></button></div>
   <fieldset className="video-recording-levels"><legend>{trUi("Громкость в записи")}</legend>{([{key:'music',label:trUi('Музыка в записи'),Icon:Music2},{key:'voice',label:trUi('Голос в записи'),Icon:MicVocal}] as const).map(({key,label,Icon})=><label key={key} className="video-recording-level"><Icon size={18}/><span>{label}<strong>{levels[key]}%</strong></span><input type="range" aria-label={label} min="0" max="100" step="1" value={levels[key]} style={{'--progress':levels[key]+'%'} as CSSProperties} onChange={e=>updateLevels({...levels,[key]:boundedLevel(Number(e.target.value),levels[key])})}/></label>)}</fieldset>
   {phase==='preview'&&<>
   <fieldset className="video-sync-compensation"><legend>{trUi("Компенсация задержки ")}<output className="video-sync-value">{diagnostics?resolveDelay(syncSettings,diagnostics):syncSettings.mode==='manual'?syncSettings.manualMs:0}{trUi(" мс")}</output></legend><div className="video-sync-modes">{(['auto','manual','off'] as SyncMode[]).map(mode=><button type="button" key={mode} aria-pressed={syncSettings.mode===mode} onClick={()=>updateSync({...syncSettings,mode})}>{mode==='auto'?trUi('Авто'):mode==='manual'?trUi('Вручную'):trUi('Выкл.')}</button>)}</div>
   {syncSettings.mode==='manual'&&<><input aria-label={trUi("Компенсация задержки в миллисекундах")} type="range" min="0" max="500" step="10" value={syncSettings.manualMs} style={{'--progress':syncSettings.manualMs/5+'%'} as CSSProperties} onChange={e=>updateSync({...syncSettings,manualMs:boundedDelay(Number(e.target.value))})}/><div className="video-sync-presets">{(diagnostics?.outputMode==='carplay'?[0,100,200,300,400,500]:[0,100,150,200,300]).map(ms=><button type="button" key={ms} aria-pressed={syncSettings.manualMs===ms} onClick={()=>updateSync({...syncSettings,manualMs:ms})}>{ms}</button>)}</div></>}
   <p>{syncSettings.mode==='auto'?(diagnostics&&usesCarPlayEstimate(diagnostics)?trUi('CarPlay: примерная задержка, не измерение. Уточните вручную — значение запомнится для этого режима.'):diagnostics?.outputMs?trUi('Оценка по данным браузера, не измеренная калибровка.'):trUi('Браузер не сообщает задержку выхода. При рассинхроне выберите вручную.')):syncSettings.mode==='off'?trUi('Дополнительная задержка отключена.'):trUi('Если голос отстаёт, увеличьте задержку музыки.')}</p></fieldset><details className="video-sync-diagnostics"><summary>{trUi("Параметры аудиоустройств")}</summary><dl><dt>{trUi("Микрофон")}</dt><dd>{diagnostics?.micLabel??trUi('Не определён')}</dd><dt>{trUi("Аудиовыход")}</dt><dd>{trUi(outputName)}</dd><dt>{trUi("Задержка выхода")}</dt><dd>{diagnostics?.outputMs!=null?diagnostics.outputMs+trUi(' мс'):trUi('Нет данных')}</dd><dt>{trUi("Задержка аудиодвижка")}</dt><dd>{diagnostics?.baseMs!=null?diagnostics.baseMs+trUi(' мс'):trUi('Нет данных')}</dd><dt>{trUi("Задержка микрофона")}</dt><dd>{diagnostics?.inputMs!=null?diagnostics.inputMs+trUi(' мс'):trUi('Нет данных')}</dd><dt>{trUi("Частота аудио")}</dt><dd>{diagnostics?.sampleRate?diagnostics.sampleRate/1000+trUi(' кГц'):trUi('Нет данных')}{diagnostics?.channels?trUi(' · микрофон ')+diagnostics.channels+trUi(' кан.'):''}</dd></dl></details></>}
   <label className="video-monitor-boost"><input type="checkbox" checked={monitorBoost} onChange={e=>updateMonitorBoost(e.target.checked)}/><span>{trUi("Компенсировать приглушение музыки")} <strong>+3 dB</strong></span></label><p>{trUi("Усиление только при прослушивании во время записи. Системное снижение громкости может сохраниться.")}</p>
   <p className="video-sync-note">{trUi("Ползунки записи меняют только звук видео. Запас уровня защищает от перегрузки.")}</p>
  </section>}
  {phase==='result'&&result&&<div className="video-karaoke-panel"><button type="button" className="video-result-thumb" aria-label={trUi("Открыть просмотр видео")} onClick={()=>setViewOpen(true)}><video className="video-karaoke-result" style={frameStyle} src={result.url} muted playsInline preload="metadata" disablePictureInPicture onLoadedMetadata={e=>updateCameraRatio(e.currentTarget)} onResize={e=>updateCameraRatio(e.currentTarget)} aria-label={trUi("Записанное видео")}/><span><Play size={20} fill="currentColor"/></span></button><div className="video-karaoke-actions"><button ref={viewButton} type="button" disabled={sharing} onClick={()=>setViewOpen(true)}><Play size={16}/>{trUi("Просмотреть")}</button><a href={result.url} download={result.file.name}><Download size={16}/>{trUi("Сохранить видео")}</a>{(!apple||result.file.type==='video/mp4')&&canShareFile(result.file)&&<button type="button" disabled={sharing} onClick={()=>void share()}><Share2 size={15}/>{sharing?trUi('Открыто меню отправки…'):trUi('Поделиться')}</button>}<button type="button" disabled={sharing} onClick={()=>{clearResult();setPhase('idle');setError('')}}><X size={14}/>{trUi("Закрыть")}</button><span>{result.file.type==='video/mp4'?'MP4':'WebM'} · {(result.file.size/1048576).toFixed(1)}{trUi(" МБ")}</span><span>{trUi("Видео не отправляется на сервер")}</span><span role="status">{shareHint||(!canShareFile(result.file)?trUi('Сохраните файл и прикрепите его в мессенджере.'):appleMobile()&&result.file.type==='video/webm'?trUi('WebM: для Telegram надёжнее сохранить и прикрепить файл вручную.'):trUi('Если Telegram зависнет, сохраните файл и прикрепите его из чата.'))}</span></div></div>}
  {result&&viewOpen&&<dialog ref={viewer} className="video-result-dialog" aria-label={trUi("Просмотр записи")} onCancel={e=>{e.preventDefault();closeViewer()}} onClick={e=>{if(e.target===e.currentTarget)closeViewer()}}><div className="video-result-viewer"><header><strong>{trUi("Просмотр видео")}</strong><button type="button" autoFocus aria-label={trUi("Закрыть просмотр видео")} onClick={closeViewer}><X size={24}/></button></header><video ref={previewResult} src={result.url} controls playsInline disablePictureInPicture preload="metadata" aria-label={trUi("Видео для просмотра")}/></div></dialog>}
  {active&&micProcessingWarning&&<p className="video-karaoke-error" role="status">{trUi("Браузер оставил обработку микрофона включённой. Звучание может отличаться.")}</p>}
  {error&&<p className="video-karaoke-error" role="alert">{trUi(error)}</p>}
 </div>;
}
