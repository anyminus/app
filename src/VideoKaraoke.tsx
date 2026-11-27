import {useEffect,useImperativeHandle,useRef,useState,type RefObject,type Ref} from 'react';
import {Video,Square,Download,X,Share2} from 'lucide-react';
import {RemoteAudio,playbackSession} from './RemoteAudio';
type Phase='idle'|'permission'|'preview'|'starting'|'recording'|'finishing'|'result';
export type VideoTransport={toggle:()=>void};
type Props={ref:Ref<VideoTransport>;onTransportReady:(ready:boolean)=>void;audio:RefObject<RemoteAudio|null>;playing:boolean;title:string;disabled:boolean;onMode:(active:boolean)=>void;onPrepare:()=>Promise<void>;onStart:()=>Promise<boolean|undefined>;onStop:()=>void};
const formats=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'];
export function VideoKaraoke(props:Props){
 const [phase,setPhase]=useState<Phase>('idle'),[error,setError]=useState(''),[result,setResult]=useState<{url:string;file:File}|null>(null);
 const latest=useRef(props);latest.current=props;
 const mounted=useRef(false),generation=useRef(0),camera=useRef<MediaStream|null>(null),preview=useRef<HTMLVideoElement|null>(null),recorder=useRef<MediaRecorder|null>(null),mix=useRef<Awaited<ReturnType<RemoteAudio['createRecordingMix']>>|null>(null),url=useRef(''),chunks=useRef<Blob[]>([]),bytes=useRef(0),stopReason=useRef(''),starting=useRef(false);
 function release(){mix.current?.close();mix.current=null;camera.current?.getTracks().forEach(t=>t.stop());camera.current=null;playbackSession();}
 function clearResult(){if(url.current)URL.revokeObjectURL(url.current);url.current='';setResult(null);}
 function finish(reason=''){if(reason)stopReason.current=reason;const r=recorder.current;if(r&&r.state!=='inactive'){setPhase('finishing');r.stop();latest.current.onStop();}}
 function cancel(){generation.current++;starting.current=false;release();latest.current.onMode(false);setPhase('idle');}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;const r=recorder.current;if(r){r.ondataavailable=null;r.onstop=null;r.onerror=null;if(r.state!=='inactive')r.stop();}release();if(url.current)URL.revokeObjectURL(url.current);}},[]);
 useImperativeHandle(props.ref,()=>({toggle:()=>{if(phase==='preview')void start();else if(phase==='recording')finish();}}));
 useEffect(()=>{latest.current.onTransportReady(phase==='preview'||phase==='recording');},[phase]);
 useEffect(()=>{if(preview.current&&camera.current)preview.current.srcObject=camera.current;},[phase]);
 useEffect(()=>{if(phase==='recording'&&!props.playing)finish();},[phase,props.playing]);
 useEffect(()=>{const hidden=()=>{if(!document.hidden)return;if(recorder.current?.state==='recording')finish('Запись остановлена: приложение свернули.');else if(camera.current){cancel();setError('Камера отключена: приложение свернули.');}};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 async function enable(){
  setError('');clearResult();if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('В этом браузере видеозапись недоступна. Откройте AnyMinus в Safari или Chrome.');return;}
  const id=++generation.current;setPhase('permission');props.onMode(true);
  try{await props.onPrepare();if(!mounted.current||generation.current!==id)return;playbackSession('play-and-record');
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
   if(!mounted.current||generation.current!==id||document.hidden){stream.getTracks().forEach(t=>t.stop());if(mounted.current&&generation.current===id)cancel();return;}camera.current=stream;
   for(const t of stream.getTracks())t.addEventListener('ended',()=>{if(!mounted.current||camera.current!==stream)return;if(recorder.current?.state==='recording')finish('Камера или микрофон отключились.');else{cancel();setError('Камера или микрофон отключились.');}},{once:true});
   setPhase('preview');
  }catch(e){if(!mounted.current||generation.current!==id)return;cancel();setError(e instanceof DOMException&&e.name==='NotAllowedError'?'Разрешите доступ к камере и микрофону.':'Не удалось включить камеру или микрофон.');}
 }
 async function start(){
  if(!camera.current||!props.audio.current||recorder.current||starting.current)return;starting.current=true;const id=generation.current;const source=camera.current;setError('');setPhase('starting');chunks.current=[];bytes.current=0;stopReason.current='';
  try{
   const prepared=await props.audio.current.createRecordingMix(source);
   if(!mounted.current||generation.current!==id||camera.current!==source){prepared.close();return;}mix.current=prepared;
   const stream=new MediaStream([...source.getVideoTracks(),...prepared.stream.getAudioTracks()]);
   const mimeType=formats.find(type=>MediaRecorder.isTypeSupported(type));
   const r=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:2000000,audioBitsPerSecond:128000});recorder.current=r;
   r.ondataavailable=e=>{if(e.data.size){chunks.current.push(e.data);bytes.current+=e.data.size;if(bytes.current>=180*1024*1024&&r.state==='recording')finish('Достигнут предел размера записи.');}};
   r.onerror=()=>{stopReason.current='Ошибка записи видео.';if(r.state!=='inactive')finish(stopReason.current);};
   r.onstop=()=>{
    const type=r.mimeType||chunks.current[0]?.type||'video/webm';const parts=chunks.current;chunks.current=[];recorder.current=null;release();if(!mounted.current)return;
    latest.current.onStop();latest.current.onMode(false);setError(stopReason.current);
    if(!parts.length){setPhase('idle');setError(stopReason.current||'Видео не записалось. Попробуйте снова.');return;}
    const name=(latest.current.title.replace(/[^\p{L}\p{N} ._-]/gu,'_').slice(0,80)||'AnyMinus')+'-'+Date.now()+(type.includes('mp4')?'.mp4':'.webm');const file=new File(parts,name,{type});url.current=URL.createObjectURL(file);setResult({url:url.current,file});setPhase('result');
   };
   r.start(1000);const ok=await props.onStart();if(!mounted.current||recorder.current!==r||r.state!=='recording')return;if(!ok){finish('Не удалось запустить музыку. Закройте результат и повторите запись.');return;}setPhase('recording');
   }catch(e){if(!mounted.current||generation.current!==id)return;const r=recorder.current;if(r&&r.state!=='inactive'){finish('Не удалось начать запись.');return;}recorder.current=null;mix.current?.close();mix.current=null;setPhase('preview');setError(e instanceof Error?e.message:'Не удалось начать запись. Повторите попытку.');}finally{if(generation.current===id)starting.current=false;}
 }
 async function share(){if(!result)return;try{await navigator.share({files:[result.file],title:props.title});}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError('Не удалось поделиться. Сохраните видео как файл.');}}
 const active=phase==='preview'||phase==='starting'||phase==='recording'||phase==='finishing';
 return <div className="video-karaoke" aria-label="Видеокараоке">
  {phase==='idle'&&<button className="video-karaoke-trigger" type="button" disabled={props.disabled} onClick={()=>void enable()}><Video size={16}/>Записать видео <span>β</span></button>}
  {phase==='permission'&&<div className="video-karaoke-actions"><span role="status">Разрешите камеру и микрофон…</span><button type="button" onClick={cancel}>Отмена</button></div>}
  {active&&<div className="video-karaoke-panel"><div className="video-karaoke-preview"><video ref={preview} autoPlay muted playsInline aria-label="Предпросмотр камеры"/>{phase==='recording'&&<span className="video-karaoke-rec">● REC</span>}</div><div className="video-karaoke-actions">
   {phase==='preview'?<><button type="button" className="video-karaoke-start" onClick={()=>void start()}><Video size={16}/>Начать запись</button><span>С начала песни · лучше в наушниках</span><button type="button" onClick={cancel}><X size={14}/>Отмена</button></>:phase==='finishing'?<span role="status">Сохраняем видео…</span>:<><button type="button" className="video-karaoke-start" disabled={phase==='starting'} onClick={()=>finish()}><Square size={14}/>Остановить</button><span role="status">{phase==='starting'?'Запуск…':'Идёт запись · локально'}</span></>}
  </div></div>}
  {phase==='result'&&result&&<div className="video-karaoke-panel"><video className="video-karaoke-result" src={result.url} controls playsInline preload="metadata" aria-label="Записанное видео"/><div className="video-karaoke-actions"><a href={result.url} download={result.file.name}><Download size={16}/>Сохранить видео</a>{navigator.canShare?.({files:[result.file]})&&<button type="button" onClick={()=>void share()}><Share2 size={15}/>Поделиться</button>}<button type="button" onClick={()=>{clearResult();setPhase('idle');setError('')}}><X size={14}/>Закрыть</button><span>Видео не отправляется на сервер</span></div></div>}
  {error&&<p className="video-karaoke-error" role="alert">{error}</p>}
 </div>;
}
