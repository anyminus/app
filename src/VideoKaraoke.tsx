import {useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type RefObject,type Ref} from 'react';
import {Video,Square,Download,X,Share2} from 'lucide-react';
import {RemoteAudio,playbackSession} from './RemoteAudio';
import {drawKaraokeFrame,overlaySupported,type TimedLine} from './videoOverlay';
type Phase='idle'|'permission'|'preview'|'starting'|'recording'|'finishing'|'result';
export type VideoTransport={toggle:()=>void};
type Props={ref:Ref<VideoTransport>;onTransportReady:(ready:boolean)=>void;audio:RefObject<RemoteAudio|null>;lyrics:readonly TimedLine[];playing:boolean;title:string;artist:string;disabled:boolean;onMode:(active:boolean)=>void;onPrepare:()=>Promise<void>;onStart:()=>Promise<boolean|undefined>;onStop:()=>void};
const mp4=['video/mp4','video/mp4;codecs=avc1.42E01E,mp4a.40.2'];
function appleMobile(){return /iPhone|iPad|iPod/i.test(navigator.platform)||(/Mac/i.test(navigator.platform)&&navigator.maxTouchPoints>1)||(/Apple/i.test(navigator.vendor)&&/iPhone|iPad|iPod/i.test(navigator.userAgent));}
function canShareFile(file:File){try{return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch{return false;}}
const webm=['video/webm;codecs=vp8,opus','video/webm'];
// Feature detection, not a phone model or OS allowlist.
function basicSupport(){
 return window.isSecureContext&&typeof navigator.mediaDevices?.getUserMedia==='function'&&typeof MediaRecorder==='function'&&typeof MediaStream==='function'&&typeof AudioContext==='function'&&typeof AudioContext.prototype.createMediaStreamDestination==='function'&&typeof AudioContext.prototype.createMediaStreamSource==='function'&&typeof HTMLVideoElement.prototype.play==='function';
}
// Android Chromium generally prefers WebM; Safari can use MP4. A positive
// isTypeSupported does not guarantee available hardware/resources at start().
function startRecorder(stream:MediaStream,overlay:boolean){
 let last:unknown;
 for(const mimeType of [...(!appleMobile()&&(overlay||/Android/i.test(navigator.userAgent))?[...webm,...mp4]:[...mp4,...webm]),'']){
  try{
   if(mimeType&&typeof MediaRecorder.isTypeSupported==='function'&&!MediaRecorder.isTypeSupported(mimeType))continue;
   const recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:2000000,audioBitsPerSecond:128000});
   recorder.start(1000);return recorder;
  }catch(e){last=e;}
 }
 throw Error('Не удалось запустить кодирование видео: '+(last instanceof Error?last.message:'нет доступного формата'));
}
export function VideoKaraoke(props:Props){
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState(''),[result,setResult]=useState<{url:string;file:File}|null>(null);
 const [sharing,setSharing]=useState(false),[shareHint,setShareHint]=useState('');const shareBusy=useRef(false),shareAttempt=useRef(0);
 const [includeLyrics,setIncludeLyrics]=useState(true),[recordOverlay,setRecordOverlay]=useState(false);const [overlayFailed,setOverlayFailed]=useState(false),[unsupported,setUnsupported]=useState(false);const supported=basicSupport()&&!unsupported;
 const canvas=useRef<HTMLCanvasElement|null>(null),canvasStream=useRef<MediaStream|null>(null);
 const canOverlay=overlaySupported()&&!overlayFailed&&props.lyrics.length>0;
 const showOverlay=phase==='preview'?includeLyrics&&canOverlay:recordOverlay;
 const latest=useRef(props);latest.current=props;
 const mounted=useRef(false),generation=useRef(0),camera=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement|null>(null),recorder=useRef<MediaRecorder|null>(null),mix=useRef<Awaited<ReturnType<RemoteAudio['createRecordingMix']>>|null>(null),url=useRef(''),chunks=useRef<Blob[]>([]),bytes=useRef(0),stopReason=useRef(''),starting=useRef(false);
 function releaseCanvas(){canvasStream.current?.getTracks().forEach(t=>t.stop());canvasStream.current=null;}
 function release(){releaseCanvas();mix.current?.close();mix.current=null;camera.current?.getTracks().forEach(t=>t.stop());camera.current=null;playbackSession();}
 function clearResult(){shareAttempt.current++;shareBusy.current=false;setSharing(false);setShareHint('');if(url.current)URL.revokeObjectURL(url.current);url.current='';setResult(null);}
 function finish(reason=''){if(reason)stopReason.current=reason;const r=recorder.current;if(r&&r.state!=='inactive'){setPhase('finishing');r.stop();latest.current.onStop();}}
 function cancel(){setRecordOverlay(false);generation.current++;starting.current=false;release();latest.current.onMode(false);setPhase('idle');}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;const r=recorder.current;if(r){r.ondataavailable=null;r.onstop=null;r.onerror=null;if(r.state!=='inactive')r.stop();}release();if(url.current)URL.revokeObjectURL(url.current);}},[]);
 useImperativeHandle(props.ref,()=>({toggle:()=>{if(phase==='preview')void start();else if(phase==='recording')finish();}}));
 useLayoutEffect(()=>{latest.current.onTransportReady(phase==='preview'||phase==='recording');},[phase]);
 useEffect(()=>{const video=preview.current,stream=camera.current;if(video&&stream&&video.srcObject!==stream){video.srcObject=stream;void video.play().catch(()=>{});}},[phase]);
 useEffect(()=>{if(phase==='recording'&&!props.playing)finish();},[phase,props.playing]);
 useEffect(()=>{
  if(!showOverlay||!(phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing'))return;
  let raf=0,last=-Infinity;
  function tick(now:number){if(now-last>=1000/24-2){last=now;const cv=canvas.current,vid=preview.current,p=latest.current;if(cv&&vid)try{drawKaraokeFrame(cv,vid,p.lyrics,p.audio.current?.position??0,{title:p.title,artist:p.artist});}catch{/* temporary missing camera frame */}}raf=requestAnimationFrame(tick);}
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[showOverlay,phase]);
 useEffect(()=>{const hidden=()=>{if(!document.hidden)return;if(recorder.current?.state==='recording')finish('Запись остановлена: приложение свернули.');else if(camera.current){cancel();setError('Камера отключена: приложение свернули.');}};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 async function enable(){
  setError('');clearResult();if(!supported){setError('Ваш телефон или браузер не поддерживает видеокараоке. Откройте AnyMinus в актуальном Chrome или Safari.');return;}
  const id=++generation.current;setPhase('permission');props.onMode(true);
  try{await props.onPrepare();if(!mounted.current||generation.current!==id)return;playbackSession('play-and-record');
   let stream:MediaStream;
   try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});}
   catch(e){if(!(e instanceof DOMException)||!['OverconstrainedError','NotSupportedError','TypeError'].includes(e.name))throw e;if(!mounted.current||generation.current!==id)return;stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});}
   if(!stream.getVideoTracks().some(t=>t.readyState==='live')||!stream.getAudioTracks().some(t=>t.readyState==='live')){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Camera or microphone unavailable','NotFoundError');}
   if(!mounted.current||generation.current!==id||document.hidden){stream.getTracks().forEach(t=>t.stop());if(mounted.current&&generation.current===id)cancel();return;}camera.current=stream;
   for(const t of stream.getTracks())t.addEventListener('ended',()=>{if(!mounted.current||camera.current!==stream)return;if(recorder.current?.state==='recording')finish('Камера или микрофон отключились.');else{cancel();setError('Камера или микрофон отключились.');}},{once:true});
   setPhase('preview');
  }catch(e){if(!mounted.current||generation.current!==id)return;cancel();const name=e instanceof Error?e.name:'';
   if(name==='NotSupportedError'||name==='NotFoundError'){setUnsupported(true);setError('Ваш телефон или браузер не поддерживает видеокараоке: камера или микрофон недоступны.');}
   else if(name==='NotAllowedError'||name==='SecurityError')setError('Разрешите доступ к камере и микрофону.');else if(name==='NotReadableError'||name==='AbortError')setError('Камера или микрофон заняты либо недоступны. Закройте другие приложения и повторите.');else setError('Не удалось включить камеру или микрофон. Попробуйте открыть сайт в Chrome или Safari.');}
 }
 async function start(){
  if(!camera.current||!props.audio.current||recorder.current||starting.current)return;starting.current=true;const id=generation.current;const source=camera.current;const withText=includeLyrics&&canOverlay;setRecordOverlay(withText);setError('');setPhase('starting');chunks.current=[];bytes.current=0;stopReason.current='';
  try{
   const prepared=await props.audio.current.createRecordingMix(source);
   if(!mounted.current||generation.current!==id||camera.current!==source){prepared.close();return;}mix.current=prepared;
   let videoTracks=source.getVideoTracks();
   if(withText){
    const cv=canvas.current,vid=preview.current;
    if(!cv||!vid)throw Error('Предпросмотр камеры недоступен.');
    // Permission resolution is not proof that a decoded camera frame exists.
    const deadline=performance.now()+2500;
    while(!drawKaraokeFrame(cv,vid,latest.current.lyrics,props.audio.current?.position??0,{title:latest.current.title,artist:latest.current.artist})){
     if(!mounted.current||generation.current!==id||camera.current!==source)return;
     if(performance.now()>=deadline)throw Error('Камера не передала первый кадр. Повторите запуск записи.');
     await new Promise<void>(resolve=>window.setTimeout(resolve,50));
    }
    if(!mounted.current||generation.current!==id||camera.current!==source)return;
    try{canvasStream.current=cv.captureStream(24);videoTracks=canvasStream.current.getVideoTracks();if(!videoTracks.some(t=>t.readyState==='live'))throw Error('Canvas track unavailable');drawKaraokeFrame(cv,vid,latest.current.lyrics,props.audio.current?.position??0,{title:latest.current.title,artist:latest.current.artist});}
    catch{releaseCanvas();setOverlayFailed(true);setIncludeLyrics(false);throw Error('Наложение текста недоступно в этом браузере. Можно записать видео без текста.');}
    for(const track of videoTracks)track.addEventListener('ended',()=>{if(mounted.current&&recorder.current?.state==='recording')finish('Видеопоток с текстом прерван.');},{once:true});
   }
   const stream=new MediaStream([...videoTracks,...prepared.stream.getAudioTracks()]);
   let r:MediaRecorder;try{r=startRecorder(stream,withText);}catch(e){if(withText){setOverlayFailed(true);setIncludeLyrics(false);throw Error('Не удалось запустить запись с текстом. Попробуйте обычную видеозапись.');}throw e;}recorder.current=r;
   r.ondataavailable=e=>{if(e.data.size){chunks.current.push(e.data);bytes.current+=e.data.size;if(bytes.current>=180*1024*1024&&r.state==='recording')finish('Достигнут предел размера записи.');}};
   r.onerror=e=>{const detail=(e as Event&{error?:DOMException}).error;stopReason.current='Ошибка записи видео'+(detail?': '+detail.name+' — '+detail.message:'.');if(r.state!=='inactive')finish(stopReason.current);};
   r.onstop=()=>{
    const type=(chunks.current.find(b=>b.type)?.type||r.mimeType||'').split(';')[0].trim().toLowerCase();const parts=chunks.current;chunks.current=[];recorder.current=null;release();if(!mounted.current)return;setRecordOverlay(false);
    latest.current.onStop();latest.current.onMode(false);setError(stopReason.current);
    if(!parts.length){setPhase('idle');setError(stopReason.current||'Видео не записалось. Попробуйте снова.');return;}
    if(type!=='video/mp4'&&type!=='video/webm'){setPhase('idle');setError('Не удалось определить формат записанного видео.');return;}
    const name='AnyMinus-'+Date.now()+(type==='video/mp4'?'.mp4':'.webm');const file=new File(parts,name,{type});url.current=URL.createObjectURL(file);setResult({url:url.current,file});setPhase('result');
   };
   const ok=await props.onStart();if(!mounted.current||recorder.current!==r||r.state!=='recording')return;if(!ok){finish('Не удалось запустить музыку. Закройте результат и повторите запись.');return;}setPhase('recording');
   }catch(e){if(!mounted.current||generation.current!==id)return;const r=recorder.current;if(r&&r.state!=='inactive'){finish('Не удалось начать запись.');return;}recorder.current=null;releaseCanvas();mix.current?.close();mix.current=null;setRecordOverlay(false);setPhase('preview');setError(e instanceof Error?e.name+': '+e.message:'Не удалось начать запись. Повторите попытку.');}finally{if(generation.current===id)starting.current=false;}
 }
 async function share(){
  if(!result||shareBusy.current)return;
  if(!canShareFile(result.file)){setShareHint('Отправка этого формата недоступна. Сохраните видео и прикрепите его в мессенджере.');return;}
  shareBusy.current=true;setSharing(true);setShareHint('Если отправка зависнет, закройте системное окно и прикрепите сохранённый файл в Telegram.');
  const attempt=++shareAttempt.current;
  try{await navigator.share({files:[result.file]});}
  catch(e){if(mounted.current&&shareAttempt.current===attempt&&!(e instanceof DOMException&&e.name==='AbortError'))setShareHint('Не удалось передать файл. Сохраните видео и прикрепите его в мессенджере.');}
  finally{if(mounted.current&&shareAttempt.current===attempt){shareBusy.current=false;setSharing(false);}}
 }
 const active=phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing';
 return <div className="video-karaoke" aria-label="Видеокараоке">
  {phase==='idle'&&<><button className="video-karaoke-trigger" type="button" disabled={props.disabled||!supported} onClick={()=>void enable()}><Video size={16}/>Записать видео <span>β</span></button>{!supported&&!error&&<p className="video-karaoke-error" role="status">Ваш телефон или браузер не поддерживает видеокараоке. Попробуйте Chrome или Safari.</p>}</>}
  {phase==='permission'&&<div className="video-karaoke-actions"><span role="status">Разрешите камеру и микрофон…</span><button type="button" onClick={cancel}>Отмена</button></div>}
  {active&&<div className="video-karaoke-panel"><div className="video-karaoke-preview"><video ref={preview} autoPlay muted playsInline aria-label="Предпросмотр камеры"/><canvas ref={canvas} className={showOverlay?'video-overlay visible':'video-overlay'} aria-label="Текст в видео" aria-hidden={!showOverlay}/>{phase==='recording'&&<span className="video-karaoke-rec">● REC</span>}</div><div className="video-karaoke-actions">
   {phase==='preview'?<><button type="button" className="video-karaoke-start" onClick={()=>void start()}><Video size={16}/>Начать запись</button><label className="video-overlay-option"><input type="checkbox" checked={includeLyrics&&canOverlay} disabled={!canOverlay} onChange={e=>setIncludeLyrics(e.target.checked)}/>Текст на видео</label><span>{!canOverlay?(overlayFailed||!overlaySupported()?'Наложение не поддерживается':'Нужен синхронный текст'):'Лучше в наушниках'}</span><button type="button" onClick={cancel}><X size={14}/>Отмена</button></>:phase==='finishing'?<span role="status">Сохраняем видео…</span>:<><button type="button" className="video-karaoke-start" disabled={phase==='starting'} onClick={()=>finish()}><Square size={14}/>Остановить</button><span role="status">{phase==='starting'?'Запуск…':'Идёт запись · локально'}</span></>}
  </div></div>}
  {phase==='result'&&result&&<div className="video-karaoke-panel"><video className="video-karaoke-result" src={result.url} controls playsInline preload="metadata" aria-label="Записанное видео"/><div className="video-karaoke-actions"><a href={result.url} download={result.file.name}><Download size={16}/>Сохранить видео</a>{canShareFile(result.file)&&<button type="button" disabled={sharing} onClick={()=>void share()}><Share2 size={15}/>{sharing?'Открыто меню отправки…':'Поделиться'}</button>}<button type="button" disabled={sharing} onClick={()=>{clearResult();setPhase('idle');setError('')}}><X size={14}/>Закрыть</button><span>{result.file.type==='video/mp4'?'MP4':'WebM'} · {(result.file.size/1048576).toFixed(1)} МБ</span><span>Видео не отправляется на сервер</span><span role="status">{shareHint||(!canShareFile(result.file)?'Сохраните файл и прикрепите его в мессенджере.':appleMobile()&&result.file.type==='video/webm'?'WebM: для Telegram надёжнее сохранить и прикрепить файл вручную.':'Если Telegram зависнет, сохраните файл и прикрепите его из чата.')}</span></div></div>}
  {error&&<p className="video-karaoke-error" role="alert">{error}</p>}
 </div>;
}
