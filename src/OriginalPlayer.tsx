import {t as trUi} from './i18n.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Play,Pause,X,SkipBack,SkipForward,LoaderCircle} from 'lucide-react';
import {Artwork} from './components';
import {origin,isTrackId,coverFor,type LiveTrack} from './catalog';
import {formatTime} from './model.mjs';
import {playbackSession} from './RemoteAudio';
import {useSystemMedia} from './useSystemMedia';
import {createPlaybackOccurrence} from './playbackAnalytics.mjs';
import {enqueuePlaybackEvent} from './analytics';

export function useOriginalPlayer(){
 const audio=useRef<HTMLAudioElement>(null),active=useRef<LiveTrack|null>(null),operation=useRef(0);
 const analytics=useRef<ReturnType<typeof createPlaybackOccurrence>|null>(null);
 const analyticsResume=()=>{const el=audio.current;if(el&&active.current&&!el.paused){analytics.current?.resume(el.currentTime)}};
 const analyticsBreak=()=>analytics.current?.discontinuity();
 const analyticsEnd=()=>{const el=audio.current;if(el)analytics.current?.sample(el.currentTime,el.duration,el.playbackRate);analytics.current?.reset()};
 const [track,setTrack]=useState<LiveTrack|null>(null),[playing,setPlaying]=useState(false),[waiting,setWaiting]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState('');
 const pause=useCallback(()=>{operation.current++;analytics.current?.discontinuity();audio.current?.pause();setPlaying(false);setWaiting(false)},[]);
 const close=useCallback(()=>{operation.current++;analytics.current=null;active.current=null;const el=audio.current;if(el){el.pause();el.removeAttribute('src');el.load()}setTrack(null);setPlaying(false);setWaiting(false);setPosition(0);setDuration(0);setError('')},[]);
 const play=useCallback(async()=>{const el=audio.current;if(!el||!active.current)return;const id=++operation.current;setError('');setWaiting(true);playbackSession();try{if(el.error){el.load()}if(el.ended){analytics.current?.reset();el.currentTime=0;}await el.play();if(id===operation.current&&active.current)setPlaying(!el.paused)}catch{if(id===operation.current&&active.current){setPlaying(false);setWaiting(false);setError(trUi('Оригинал недоступен. Нажмите Play для повторной попытки.'))}}},[]);
 function toggle(t:LiveTrack){const el=audio.current;if(!el||!isTrackId(t.providerTrackId))return;if(active.current?.providerTrackId===t.providerTrackId){if(!el.paused||waiting)pause();else void play();return}operation.current++;el.pause();active.current=t;analytics.current=createPlaybackOccurrence('original',t.providerTrackId,enqueuePlaybackEvent);setTrack(t);setPlaying(false);setPosition(0);setDuration((t.durationMs??0)/1000);setError('');el.src=new URL('/demo/audio/'+encodeURIComponent(t.providerTrackId),origin).href;void play();}
 function seek(value:number){const el=audio.current;if(!el||!active.current||!Number.isFinite(value))return;const length=Number.isFinite(el.duration)&&el.duration>0?el.duration:duration;try{analytics.current?.discontinuity();el.currentTime=Math.max(0,Math.min(length,value));setPosition(el.currentTime)}catch{}}
 const update=()=>{const el=audio.current;if(!el||!active.current)return;if(!el.paused&&!el.seeking&&el.readyState>=3)analytics.current?.sample(el.currentTime,el.duration,el.playbackRate);setPosition(el.currentTime||0);if(Number.isFinite(el.duration)&&el.duration>0)setDuration(el.duration)};
 useEffect(()=>()=>{operation.current++;audio.current?.pause()},[]);
 useSystemMedia({ready:!!track,title:track?.title??'',artist:track?.artist??'',artwork:track?coverFor(track.providerTrackId,track.coverUrl):null,playing,length:duration,position,speed:1,play:()=>void play(),pause,seek,currentTime:()=>audio.current?.currentTime??0,isPlaying:()=>!!audio.current&&!audio.current.paused});
 return {track,playing,waiting,position,duration,error,toggle,close,pause,play,seek,audio,update,setPlaying,setWaiting,setError,active,analyticsResume,analyticsBreak,analyticsEnd};
}
export type OriginalPlayer=ReturnType<typeof useOriginalPlayer>;
export function OriginalAudio({player:p}:{player:OriginalPlayer}){
 return <audio ref={p.audio} crossOrigin="anonymous" preload="none" onTimeUpdate={p.update} onLoadedMetadata={p.update} onDurationChange={p.update} onPlaying={()=>{if(p.active.current){p.analyticsResume();p.setPlaying(true);p.setWaiting(false)}}} onPause={()=>{p.analyticsBreak();if(p.audio.current?.paused)p.setPlaying(false)}} onSeeking={p.analyticsBreak} onWaiting={()=>{p.analyticsBreak();if(p.active.current&&!p.audio.current?.paused)p.setWaiting(true)}} onCanPlay={()=>p.setWaiting(false)} onEnded={()=>{p.analyticsEnd();p.setPlaying(false);p.setWaiting(false);p.update()}} onError={()=>{if(p.active.current&&p.audio.current?.error){p.setPlaying(false);p.setWaiting(false);p.setError(trUi('Оригинальная дорожка недоступна. Повторите воспроизведение.'))}}}/>;
}
export function OriginalMiniPlayer({player:p,onOpen}:{player:OriginalPlayer;onOpen:(track:LiveTrack)=>void}){
 const t=p.track;if(!t)return null;
 return <section className="original-mini" aria-label={trUi("Плеер оригинала")}>
  <div className="original-mini-row"><button type="button" className="original-mini-song" onClick={()=>onOpen(t)} aria-label={trUi('Открыть песню: ')+t.title}><Artwork title={t.title} color="#7961bd" src={coverFor(t.providerTrackId,t.coverUrl)} trackId={t.providerTrackId}/><span><strong>{t.title}</strong><small>{t.artist}</small></span></button>
  <button type="button" className="original-mini-skip" aria-label={trUi("Оригинал: назад 10 секунд")} onClick={()=>p.seek(p.position-10)}><SkipBack size={17}/></button>
  <button type="button" className="original-mini-play" aria-label={p.playing||p.waiting?trUi('Пауза оригинала'):trUi('Воспроизвести оригинал')} onClick={()=>p.playing||p.waiting?p.pause():void p.play()}>{p.waiting?<LoaderCircle size={20} className="original-spin"/>:p.playing?<Pause size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}</button>
  <button type="button" className="original-mini-skip" aria-label={trUi("Оригинал: вперёд 10 секунд")} onClick={()=>p.seek(p.position+10)}><SkipForward size={17}/></button>
  <button type="button" className="original-mini-close" aria-label={trUi("Закрыть плеер оригинала")} onClick={p.close}><X size={19}/></button></div>
  <div className="original-mini-progress"><span>{formatTime(p.position)}</span><input type="range" aria-label={trUi("Позиция оригинала")} min="0" max={p.duration||0} step=".1" value={Math.min(p.position,p.duration||0)} disabled={!p.duration} onChange={e=>p.seek(Number(e.target.value))} style={{'--progress':(p.duration?p.position/p.duration*100:0)+'%'} as React.CSSProperties}/><span>{formatTime(p.duration)}</span></div>
  {p.error&&<p className="original-mini-error" role="alert">{trUi(p.error)}</p>}
 </section>;
}
