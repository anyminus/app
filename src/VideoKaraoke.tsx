import {useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type RefObject,type Ref,type CSSProperties} from 'react';
import {Video,Square,Download,X,Share2} from 'lucide-react';
import {RemoteAudio,playbackSession} from './RemoteAudio';
import {drawKaraokeFrame,overlaySupported,resetVideoMotion,type TimedLine} from './videoOverlay';
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
   recorder.start(1000);if(recorder.state!=='recording')throw Error('Кодировщик не запустился');return recorder;
  }catch(e){last=e;}
 }
 throw Error((appleMobile()?'Не удалось запустить MP4 на iPhone/iPad: ':'Не удалось запустить кодирование видео: ')+(last instanceof Error?last.message:'нет доступного формата'));
}
export function VideoKaraoke(props:Props){
 const [cameraRatio,setCameraRatio]=useState(16/9);
 const frameStyle={'--camera-ratio':cameraRatio} as CSSProperties;
 function updateCameraRatio(video:HTMLVideoElement){if(video.videoWidth>0&&video.videoHeight>0)setCameraRatio(video.videoWidth/video.videoHeight);}
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState(''),[result,setResult]=useState<{url:string;file:File}|null>(null);
 const [micProcessingWarning,setMicProcessingWarning]=useState(false);
 const videoOnlyPreview=useRef<MediaStream|null>(null);
 const [sharing,setSharing]=useState(false),[shareHint,setShareHint]=useState('');const shareBusy=useRef(false),shareAttempt=useRef(0);
 const [includeLyrics,setIncludeLyrics]=useState(true),[recordOverlay,setRecordOverlay]=useState(false);const [overlayFailed,setOverlayFailed]=useState(false),[unsupported,setUnsupported]=useState(false);const apple=appleMobile(),missingMP4=apple&&!mp4Available();const supported=basicSupport()&&!unsupported&&!missingMP4;
 const previewResult=useRef<HTMLVideoElement|null>(null);const canvas=useRef<HTMLCanvasElement|null>(null),canvasStream=useRef<MediaStream|null>(null);
 const finishTimer=useRef<number|undefined>(undefined),finalizing=useRef(false),captureUsed=useRef(false);
 const canOverlay=overlaySupported()&&!overlayFailed&&props.lyrics.length>0;
 const showOverlay=phase==='preview'?includeLyrics&&canOverlay:recordOverlay;
 const profile=useRef<CaptureProfile>(standardProfile);
 const latest=useRef(props);latest.current=props;
 const mounted=useRef(false),generation=useRef(0),camera=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement|null>(null),recorder=useRef<MediaRecorder|null>(null),mix=useRef<Awaited<ReturnType<RemoteAudio['createRecordingMix']>>|null>(null),url=useRef(''),chunks=useRef<Blob[]>([]),bytes=useRef(0),stopReason=useRef(''),starting=useRef(false);
 function releaseCanvas(){resetVideoMotion(canvas.current);canvasStream.current?.getTracks().forEach(t=>t.stop());canvasStream.current=null;}
 function release(){releaseCanvas();const hadMix=!!mix.current;mix.current?.close();mix.current=null;const stream=camera.current;camera.current=null;videoOnlyPreview.current=null;if(preview.current)preview.current.srcObject=null;stream?.getTracks().forEach(t=>t.stop());playbackSession();if((hadMix||stream)&&appleMobile())latest.current.audio.current?.markOutputStalled();}
 function clearResult(){shareAttempt.current++;shareBusy.current=false;setSharing(false);setShareHint('');if(url.current)URL.revokeObjectURL(url.current);url.current='';setResult(null);}
 function complete(r:MediaRecorder,timedOut=false){
  if(recorder.current!==r)return;
  clearTimeout(finishTimer.current);finishTimer.current=undefined;finalizing.current=false;recorder.current=null;
  r.ondataavailable=null;r.onstop=null;r.onerror=null;
  const type=(chunks.current.find(b=>b.type)?.type||r.mimeType||'').split(';')[0].trim().toLowerCase(),parts=chunks.current;chunks.current=[];bytes.current=0;
  latest.current.onStop();release();if(!mounted.current)return;
  setRecordOverlay(false);latest.current.onMode(false);setError(stopReason.current);
  if(!parts.length){setPhase('idle');setError(timedOut?'Браузер не завершил запись. Начните новый дубль.':stopReason.current||'Видео не записалось. Попробуйте снова.');return;}
  if(type!=='video/mp4'&&type!=='video/webm'){setPhase('idle');setError('Не удалось определить формат записанного видео.');return;}
  if(timedOut)setError('Сохранена доступная часть записи. Браузер не завершил файл — он может не открываться. Можно начать новый дубль.');
  else if(appleMobile()&&type!=='video/mp4')setError('Браузер неожиданно вернул WebM вместо MP4. Этот файл можно сохранить для конвертации, но он может не открываться на iPhone.');
  try{const file=new File(parts,'AnyMinus-'+Date.now()+(type==='video/mp4'?'.mp4':'.webm'),{type});url.current=URL.createObjectURL(file);setResult({url:url.current,file});setPhase('result');}
  catch{setPhase('idle');setError('Не удалось создать видеофайл. Начните новый дубль.');}
 }
 function finish(reason=''){
  const r=recorder.current;if(!r)return;if(reason&&!stopReason.current)stopReason.current=reason;
  if(finalizing.current)return;finalizing.current=true;setPhase('finishing');latest.current.onStop();
  finishTimer.current=window.setTimeout(()=>{if(recorder.current!==r)return;try{if(r.state!=='inactive')r.stop();}catch{}complete(r,true);},5000);
  try{if(r.state!=='inactive')r.stop();}catch{complete(r,true);}
 }
 function cancel(){if(recorder.current){finish('Запись остановлена.');return;}clearTimeout(finishTimer.current);finalizing.current=false;setRecordOverlay(false);generation.current++;starting.current=false;release();latest.current.onMode(false);setPhase('idle');}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;clearTimeout(finishTimer.current);const r=recorder.current;recorder.current=null;if(r){r.ondataavailable=null;r.onstop=null;r.onerror=null;try{if(r.state!=='inactive')r.stop();}catch{}}release();if(url.current)URL.revokeObjectURL(url.current);}},[]);
 useImperativeHandle(props.ref,()=>({toggle:()=>{if(phase==='preview')void start();else if(phase==='recording')finish();}}));
 useLayoutEffect(()=>{latest.current.onTransportReady(phase==='preview'||phase==='recording');},[phase]);
 useEffect(()=>{const video=preview.current,stream=videoOnlyPreview.current;if(video&&stream&&video.srcObject!==stream){video.srcObject=stream;void video.play().catch(()=>{});}},[phase]);
 useEffect(()=>{if(phase==='recording'&&!props.playing)finish();},[phase,props.playing]);
 useEffect(()=>{
  if(!showOverlay||!(phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing')){resetVideoMotion(canvas.current);return;}
  let raf=0,nextFrame=0;const period=1000/profile.current.fps;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  // Keep an absolute cadence instead of accumulating rAF quantization error.
  function tick(now:number){if(now+1>=nextFrame){nextFrame=nextFrame===0?now+period:nextFrame+Math.max(1,Math.floor((now+1-nextFrame)/period)+1)*period;const cv=canvas.current,vid=preview.current,p=latest.current;if(cv&&vid)try{drawKaraokeFrame(cv,vid,p.lyrics,p.audio.current?.position??0,{title:p.title,artist:p.artist},undefined,p.seekRevision.current,now,p.playing&&!reduced.matches);}catch{/* temporary missing camera frame */}}raf=requestAnimationFrame(tick);}
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[showOverlay,phase]);
 useEffect(()=>{const hidden=()=>{if(!document.hidden)return;if(recorder.current)finish('Запись остановлена: приложение свернули.');else if(camera.current){cancel();setError('Камера отключена: приложение свернули.');}};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 async function enable(){
  setError('');setMicProcessingWarning(false);clearResult();if(!supported){setError('Ваш телефон или браузер не поддерживает видеокараоке. Откройте AnyMinus в актуальном Chrome или Safari.');return;}
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
   for(const t of stream.getTracks())t.addEventListener('ended',()=>{if(!mounted.current||camera.current!==stream)return;if(recorder.current)finish('Камера или микрофон отключились.');else{cancel();setError('Камера или микрофон отключились.');}},{once:true});
   const processing=await verifyRawMicrophone(stream.getAudioTracks().find(t=>t.readyState==='live')!);
   if(!mounted.current||generation.current!==id||camera.current!==stream)return;
   setMicProcessingWarning(processing);setPhase('preview');
  }catch(e){if(!mounted.current||generation.current!==id)return;cancel();const name=e instanceof Error?e.name:'';
   if(name==='NotSupportedError'||name==='NotFoundError'){setUnsupported(true);setError('Ваш телефон или браузер не поддерживает видеокараоке: камера или микрофон недоступны.');}
   else if(name==='NotAllowedError'||name==='SecurityError')setError('Разрешите доступ к камере и микрофону.');else if(name==='NotReadableError'||name==='AbortError')setError('Камера или микрофон заняты либо недоступны. Закройте другие приложения и повторите.');else setError('Не удалось включить камеру или микрофон. Попробуйте открыть сайт в Chrome или Safari.');}
 }
 async function start(){
  if(props.disabled||!camera.current||!props.audio.current||recorder.current||starting.current)return;starting.current=true;const id=generation.current;const source=camera.current;const withText=includeLyrics&&canOverlay;setRecordOverlay(withText);setError('');setPhase('starting');chunks.current=[];bytes.current=0;stopReason.current='';
  try{
   if(apple&&captureUsed.current)props.audio.current.markOutputStalled();
   const prepared=await props.audio.current.createRecordingMix(source);
   if(!mounted.current||generation.current!==id||camera.current!==source){prepared.close();return;}mix.current=prepared;captureUsed.current=true;
   let videoTracks=source.getVideoTracks();
   if(withText){
    const cv=canvas.current,vid=preview.current;
    if(!cv||!vid)throw Error('Предпросмотр камеры недоступен.');
    // Permission resolution is not proof that a decoded camera frame exists.
    const deadline=performance.now()+2500;
    while(!drawKaraokeFrame(cv,vid,latest.current.lyrics,props.audio.current?.position??0,{title:latest.current.title,artist:latest.current.artist},undefined,latest.current.seekRevision.current,performance.now(),false)){
     if(!mounted.current||generation.current!==id||camera.current!==source)return;
     if(performance.now()>=deadline)throw Error('Камера не передала первый кадр. Повторите запуск записи.');
     await new Promise<void>(resolve=>window.setTimeout(resolve,50));
    }
    if(!mounted.current||generation.current!==id||camera.current!==source)return;
    try{canvasStream.current=cv.captureStream(profile.current.fps);videoTracks=canvasStream.current.getVideoTracks();if(!videoTracks.some(t=>t.readyState==='live'))throw Error('Canvas track unavailable');drawKaraokeFrame(cv,vid,latest.current.lyrics,props.audio.current?.position??0,{title:latest.current.title,artist:latest.current.artist},undefined,latest.current.seekRevision.current,performance.now(),false);}
    catch{releaseCanvas();setOverlayFailed(true);setIncludeLyrics(false);throw Error('Наложение текста недоступно в этом браузере. Можно записать видео без текста.');}
    for(const track of videoTracks)track.addEventListener('ended',()=>{if(mounted.current&&recorder.current?.state==='recording')finish('Видеопоток с текстом прерван.');},{once:true});
   }
   const stream=new MediaStream([...videoTracks,...prepared.stream.getAudioTracks()]);
   let r:MediaRecorder;try{r=startRecorder(stream,withText,profile.current);}catch(e){if(withText){setOverlayFailed(true);setIncludeLyrics(false);throw Error(apple?'Запись MP4 с текстом недоступна. Попробуйте обычную видеозапись без текста.':'Не удалось запустить запись с текстом. Попробуйте обычную видеозапись.');}if(apple){cancel();setUnsupported(true);setError('На этом iPhone/iPad не удалось запустить запись MP4. Видеокараоке недоступно в текущем браузере.');return;}throw e;}recorder.current=r;
   r.ondataavailable=e=>{if(recorder.current===r&&e.data.size){chunks.current.push(e.data);bytes.current+=e.data.size;if(bytes.current>=180*1024*1024&&r.state==='recording')finish('Достигнут предел размера записи.');}};
   r.onerror=e=>{const detail=(e as Event&{error?:DOMException}).error;stopReason.current='Ошибка записи видео'+(detail?': '+detail.name+' — '+detail.message:'.');finish(stopReason.current);};
   r.onstop=()=>complete(r);
   const ok=await props.onStart();if(!mounted.current||recorder.current!==r||finalizing.current)return;if(!ok||r.state!=='recording'){finish('Не удалось запустить музыку. Начните новый дубль.');return;}setPhase('recording');
   }catch(e){if(!mounted.current||generation.current!==id)return;const r=recorder.current;if(r){finish('Не удалось начать запись.');return;}recorder.current=null;releaseCanvas();mix.current?.close();mix.current=null;setRecordOverlay(false);setPhase('preview');setError(e instanceof Error?e.name+': '+e.message:'Не удалось начать запись. Повторите попытку.');}finally{if(generation.current===id)starting.current=false;}
 }
 async function share(){
  if(!result||shareBusy.current)return;
  if((apple&&result.file.type!=='video/mp4')||!canShareFile(result.file)){setShareHint('Отправка этого формата недоступна. Сохраните видео и прикрепите его в мессенджере.');return;}
  const player=previewResult.current;player?.pause();shareBusy.current=true;setSharing(true);setShareHint('Если отправка зависнет, закройте системное окно и прикрепите сохранённый файл в Telegram.');
  const attempt=++shareAttempt.current;
  try{await navigator.share({files:[result.file]});}
  catch(e){if(mounted.current&&shareAttempt.current===attempt&&!(e instanceof DOMException&&e.name==='AbortError'))setShareHint('Не удалось передать файл. Сохраните видео и прикрепите его в мессенджере.');}
  finally{if(mounted.current&&shareAttempt.current===attempt){shareBusy.current=false;setSharing(false);}}
 }
 const active=phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing';
 return <div className="video-karaoke" aria-label="Видеокараоке">
  {phase==='idle'&&<><button className="video-karaoke-trigger" type="button" disabled={props.disabled||!supported} onClick={()=>void enable()}><Video size={16}/>Записать видео <span>β</span></button>{!supported&&!error&&<p className="video-karaoke-error" role="status">{missingMP4?'В этом браузере iPhone/iPad недоступна запись MP4. Видеокараоке отключено.':'Ваш телефон или браузер не поддерживает видеокараоке. Попробуйте Chrome или Safari.'}</p>}</>}
  {phase==='permission'&&<div className="video-karaoke-actions"><span role="status">Разрешите камеру и микрофон…</span><button type="button" onClick={cancel}>Отмена</button></div>}
  {active&&<div className="video-karaoke-panel"><div className="video-karaoke-preview" style={frameStyle}><video ref={preview} autoPlay muted playsInline onLoadedMetadata={e=>updateCameraRatio(e.currentTarget)} onResize={e=>updateCameraRatio(e.currentTarget)} aria-label="Предпросмотр камеры"/><canvas ref={canvas} className={showOverlay?'video-overlay visible':'video-overlay'} aria-label="Текст в видео" aria-hidden={!showOverlay}/>{phase==='recording'&&<span className="video-karaoke-rec">● REC</span>}</div><div className="video-karaoke-actions">
   {phase==='preview'?<><button type="button" className="video-karaoke-start" disabled={props.disabled} onClick={()=>void start()}><Video size={16}/>Начать запись</button><label className="video-overlay-option"><input type="checkbox" checked={includeLyrics&&canOverlay} disabled={!canOverlay} onChange={e=>setIncludeLyrics(e.target.checked)}/>Текст на видео</label><span>{!canOverlay?(overlayFailed||!overlaySupported()?'Наложение не поддерживается':'Нужен синхронный текст'):'Лучше в наушниках'}</span><button type="button" onClick={cancel}><X size={14}/>Отмена</button></>:phase==='finishing'?<><span role="status">Сохраняем видео…</span><button type="button" onClick={()=>{const r=recorder.current;if(r)complete(r,true)}}>Завершить принудительно</button></>:<><button type="button" className="video-karaoke-start" disabled={phase==='starting'} onClick={()=>finish()}><Square size={14}/>Остановить</button><span role="status">{phase==='starting'?'Запуск…':'Идёт запись · локально'}</span></>}
  </div></div>}
  {phase==='result'&&result&&<div className="video-karaoke-panel"><video ref={previewResult} className="video-karaoke-result" style={frameStyle} src={result.url} controls playsInline preload="metadata" onLoadedMetadata={e=>updateCameraRatio(e.currentTarget)} onResize={e=>updateCameraRatio(e.currentTarget)} aria-label="Записанное видео"/><div className="video-karaoke-actions"><a href={result.url} download={result.file.name}><Download size={16}/>Сохранить видео</a>{(!apple||result.file.type==='video/mp4')&&canShareFile(result.file)&&<button type="button" disabled={sharing} onClick={()=>void share()}><Share2 size={15}/>{sharing?'Открыто меню отправки…':'Поделиться'}</button>}<button type="button" disabled={sharing} onClick={()=>{clearResult();setPhase('idle');setError('')}}><X size={14}/>Закрыть</button><span>{result.file.type==='video/mp4'?'MP4':'WebM'} · {(result.file.size/1048576).toFixed(1)} МБ</span><span>Видео не отправляется на сервер</span><span role="status">{shareHint||(!canShareFile(result.file)?'Сохраните файл и прикрепите его в мессенджере.':appleMobile()&&result.file.type==='video/webm'?'WebM: для Telegram надёжнее сохранить и прикрепить файл вручную.':'Если Telegram зависнет, сохраните файл и прикрепите его из чата.')}</span></div></div>}
  {active&&micProcessingWarning&&<p className="video-karaoke-error" role="status">Браузер оставил обработку микрофона включённой. Звучание может отличаться.</p>}
  {error&&<p className="video-karaoke-error" role="alert">{error}</p>}
 </div>;
}
