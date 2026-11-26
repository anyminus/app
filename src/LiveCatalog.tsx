import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,Heart,Share2,Maximize2,Minimize2,MicVocal,Pause,Play,RefreshCw,SkipBack,SkipForward} from 'lucide-react';
import {normalizeJob,mediaUrl} from './api.mjs';
import {api,origin,coverFor,type LiveTrack} from './catalog';
import {RemoteAudio} from './RemoteAudio';
import {normalizeStoredLyrics,retryLyricsStatus} from './lyrics.mjs';
import {Mixer,Artwork,IconButton} from './components';
import {effectiveVolume} from './mixer.mjs';
import {formatTime} from './model.mjs';
type Job={state:string;pairOperationId:string|null;retryable:boolean};
type Line={text:string;startMs:number;endMs:number|null};
type Props={onBack:()=>void;track:LiveTrack;liked:boolean;onLike:()=>void;onShare:()=>void;onArtist:()=>void;onPlayed:()=>void;font:number;autoScroll:boolean;music:number;vocals:number;musicMuted:boolean;vocalsMuted:boolean;onMusic:(n:number)=>void;onVocals:(n:number)=>void;onToggleMusic:()=>void;onToggleVocals:()=>void};
const statusText:Record<string,string>={none:'Караоке ещё не создано',queued:'В очереди',running:'Обработка дорожек',ready:'Караоке готово',failed:'Обработка не удалась'};
export function LiveCatalog({onBack,track:selected,liked,onLike,onShare,onArtist,onPlayed,font,autoScroll,...mixer}:Props){
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [job,setJob]=useState<Job|null>(()=>selected.pairOperationId?{state:'ready',pairOperationId:selected.pairOperationId,retryable:false}:null);const [lyrics,setLyrics]=useState<Line[]>([]);const [lyricState,setLyricState]=useState('');const [plainLyrics,setPlainLyrics]=useState('');const [lyricPair,setLyricPair]=useState('');const [lyricRetry,setLyricRetry]=useState(0);const [lyricLoading,setLyricLoading]=useState(false);const [position,setPosition]=useState(0);const [length,setLength]=useState(0);const [playing,setPlaying]=useState(false);const [playerReady,setPlayerReady]=useState(false);const [loadingAudio,setLoadingAudio]=useState(false);
 const token=useRef<{value:string;expires:number}|null>(null);const audio=useRef<RemoteAudio|null>(null);const selectionAbort=useRef<AbortController|null>(null);const polling=useRef<number>(0);const playLock=useRef(false);const selectionVersion=useRef(0);
 function showError(e:unknown){setError(e instanceof Error&&'status' in e&&e.status===429?'Слишком много запросов. Повторите поиск позже':e instanceof Error?e.message:'API недоступен');}
 useEffect(()=>()=>{selectionVersion.current++;selectionAbort.current?.abort();clearTimeout(polling.current);audio.current?.dispose();token.current=null},[]);
 async function session(signal:AbortSignal){if(!api)throw Error('Нет API');if(token.current&&token.current.expires>Date.now()+30000)return token.current.value;const r=await api.auth(signal);if(typeof r.accessToken!=='string'||!Number.isFinite(r.expiresIn)||r.expiresIn<=0)throw Error('Некорректный ответ авторизации');token.current={value:r.accessToken,expires:Date.now()+r.expiresIn*1000};return token.current.value;}
 async function getStatus(){if(!api||!selected)return;const version=selectionVersion.current;const c=new AbortController();selectionAbort.current?.abort();selectionAbort.current=c;setBusy(true);setError('');try{const key=await session(c.signal);const next=normalizeJob(await api.status(selected.providerTrackId,key,c.signal));if(version===selectionVersion.current){setJob(next);if(next.state==='queued'||next.state==='running')poll(selected,key,c,version);}}catch(e){if(!c.signal.aborted)showError(e)}finally{if(version===selectionVersion.current)setBusy(false)}}
 function poll(t:LiveTrack,key:string,c:AbortController,version:number){clearTimeout(polling.current);polling.current=window.setTimeout(async()=>{try{const next=normalizeJob(await api!.status(t.providerTrackId,key,c.signal));if(c.signal.aborted||version!==selectionVersion.current)return;setJob(next);if(next.state==='queued'||next.state==='running'||next.state==='none')poll(t,key,c,version);}catch(e){if(!c.signal.aborted&&version===selectionVersion.current)showError(e)}},3000)}
 async function enqueue(){if(!api||!selected||busy||playLock.current)return;const version=selectionVersion.current;playLock.current=true;const c=new AbortController();selectionAbort.current?.abort();selectionAbort.current=c;setBusy(true);setError('');try{const key=await session(c.signal);let t=selected;if(!t.durationMs){const meta=await api.metadata(t.providerTrackId,key,c.signal);t={...t,durationMs:meta.durationMs,title:meta.title,artist:meta.artist};}const existing=normalizeJob(await api.status(t.providerTrackId,key,c.signal));const next=existing.state==='none'||(existing.state==='failed'&&existing.retryable)?normalizeJob(await api.enqueue(t,key,c.signal)):existing;if(version!==selectionVersion.current)return;setJob(next);if(next.state==='queued'||next.state==='running')poll(t,key,c,version);}catch(e){if(!c.signal.aborted)showError(e)}finally{playLock.current=false;if(version===selectionVersion.current)setBusy(false)}}
 async function openPlayer(){if(!api||!selected||!job?.pairOperationId||loadingAudio)return;const version=selectionVersion.current;setLoadingAudio(true);setError('');const c=new AbortController();selectionAbort.current?.abort();selectionAbort.current=c;const a=new RemoteAudio();audio.current?.dispose();audio.current=a;try{a.prepare();const r=await api.playback(job.pairOperationId,selected.providerTrackId,token.current?.value,c.signal);const pair=r.pairOperationId;const urls=[mediaUrl(origin,pair,'instrumental',r.instrumental),mediaUrl(origin,pair,'vocals',r.vocals)];await a.load(urls,r.durationSeconds,c.signal);if(version!==selectionVersion.current||c.signal.aborted){a.dispose();return;}a.setVolumes(effectiveVolume(mixer.music,mixer.musicMuted),effectiveVolume(mixer.vocals,mixer.vocalsMuted));setLength(a.length);setPlayerReady(true);setPosition(0);setLyricPair(pair);}catch(e){a.dispose();if(!c.signal.aborted)showError(e)}finally{if(version===selectionVersion.current)setLoadingAudio(false)}}
 useEffect(()=>{
 if(!playerReady||!lyricPair)return;
 let disposed=false;let timer:number|undefined;let controller:AbortController|null=null;let attempts=0;
 async function load(){attempts++;controller=new AbortController();const c=controller;const deadline=window.setTimeout(()=>c.abort(),8000);setLyricLoading(true);
 let retryable=false;
 try{const payload=await api!.storedLyrics(lyricPair,undefined,c.signal);if(disposed)return;const result=normalizeStoredLyrics(payload,Math.round(length*1000));
 if(result.lines.length||result.text){setLyrics(result.lines);setPlainLyrics(result.text);setLyricState('');}
 else if(result.state==='absent'){setLyricState('Текст песни не найден в источнике');}
 else if(result.state==='transient_error'){retryable=true;setLyricState('Текст ещё готовится или временно недоступен');}
 else setLyricState('API не вернул строки или обычный текст');
 }catch(e){if(disposed)return;const status=e instanceof Error&&'status' in e?Number(e.status):c.signal.aborted?408:0;retryable=retryLyricsStatus(status);setLyricState(status===401||status===403?'Нет доступа к тексту (HTTP '+status+'). Откройте караоке заново.':status===404?'Текст не найден (HTTP 404)':status===0?'Не удалось загрузить текст: сеть или CORS':status===408?'Время ожидания текста истекло':'Текст временно недоступен (HTTP '+status+')');}
 finally{clearTimeout(deadline);if(!disposed){setLyricLoading(false);if(retryable&&attempts<10)timer=window.setTimeout(()=>void load(),15000);}}
 }
 setLyricState('');void load();
 return()=>{disposed=true;controller?.abort();clearTimeout(timer);};
 },[playerReady,lyricPair,selected.providerTrackId,length,lyricRetry]);
 useEffect(()=>{audio.current?.setVolumes(effectiveVolume(mixer.music,mixer.musicMuted),effectiveVolume(mixer.vocals,mixer.vocalsMuted))},[mixer.music,mixer.vocals,mixer.musicMuted,mixer.vocalsMuted]);
 useEffect(()=>{if(!playing)return;const t=setInterval(()=>{const a=audio.current;if(!a)return;setPosition(a.position);if(a.interrupted){a.pause();setPlaying(false);setError('Воспроизведение прервано системой. Нажмите воспроизведение ещё раз.');}else if(a.position>=a.length){a.pause();setPlaying(false)}},80);return()=>clearInterval(t)},[playing]);
 let active=-1;for(let i=0;i<lyrics.length;i++)if(lyrics[i].startMs<=position*1000)active=i;

 const lyricRef=useRef<HTMLDivElement>(null);const [focus,setFocus]=useState(false);
 // Lock the page itself. Only the independent lyrics viewport may scroll.
 useLayoutEffect(()=>{if(!playerReady)return;document.body.classList.add('karaoke-open');window.scrollTo(0,0);return()=>document.body.classList.remove('karaoke-open')},[playerReady]);
 function centerLine(smooth:boolean){
   const viewport=lyricRef.current, line=viewport?.querySelector<HTMLElement>('[data-active="true"]');
   if(!viewport||!line)return;
   const delta=line.getBoundingClientRect().top-viewport.getBoundingClientRect().top+(line.offsetHeight-viewport.clientHeight)/2;
   viewport.scrollTo({top:Math.max(0,viewport.scrollTop+delta),behavior:smooth&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
 }
 useLayoutEffect(()=>{if(playerReady&&autoScroll)centerLine(false)},[playerReady,focus,lyrics,autoScroll,font]);
 useEffect(()=>{if(playerReady&&autoScroll)centerLine(true)},[active]);
 useEffect(()=>{const el=lyricRef.current;if(!playerReady||!autoScroll||!el||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>centerLine(false));observer.observe(el);return()=>observer.disconnect()},[playerReady,autoScroll]);

 async function toggle(){const a=audio.current;if(!a)return;try{if(playing){a.pause();setPlaying(false)}else{a.setVolumes(effectiveVolume(mixer.music,mixer.musicMuted),effectiveVolume(mixer.vocals,mixer.vocalsMuted));await a.play();setError('');setPlaying(true);onPlayed()}}catch(e){showError(e)}}
 async function seek(n:number){try{const target=Math.max(0,Math.min(length,n));await audio.current?.seek(target);setPosition(target);if(target>=length)setPlaying(false)}catch(e){showError(e)}}
 if(playerReady)return <section className={'karaoke-screen'+(focus?' karaoke-focus':'')} aria-label="Плеер караоке">
 <header className="karaoke-header">
 <IconButton label="Назад" onClick={onBack}><ArrowLeft/></IconButton>
 <div className="karaoke-heading"><h1 title={selected.title}>{selected.title}</h1><button className="artist-link" onClick={onArtist} title={selected.artist}>{selected.artist}</button></div>
 <IconButton label={liked?'Убрать из любимого':'В любимое'} active={liked} onClick={onLike}><Heart size={21} fill={liked?'currentColor':'none'}/></IconButton>
 <button className="icon-button karaoke-focus-toggle" type="button" aria-label={focus?'Показать плеер':'Только текст'} aria-pressed={focus} title={focus?'Обычный режим':'Полноэкранный текст'} onClick={()=>setFocus(v=>!v)}>{focus?<Minimize2 size={21}/>:<Maximize2 size={21}/>}</button>
 </header>
 <div className={'karaoke-lyrics'+(lyrics.length?' timed':'')} ref={lyricRef} aria-label="Текст песни" style={{'--lyric-size':font+'px'} as React.CSSProperties}>
 {lyrics.length?lyrics.map((l,i)=><button type="button" className={'lyric '+(i===active?'current':i<active?'past':'future')} data-active={i===active} aria-current={i===active?'true':undefined} key={i} onClick={()=>void seek(l.startMs/1000)}>{l.text}</button>):plainLyrics?<><p className="metadata">Текст без синхронизации</p><p className="plain-lyrics">{plainLyrics}</p></>:<div className="karaoke-lyrics-empty"><p className="metadata" role="status">{lyricState||'Загрузка текста…'}</p>{lyricState&&<button className="text-button" disabled={lyricLoading} onClick={()=>setLyricRetry(n=>n+1)}>Повторить загрузку текста</button>}</div>}
 </div>
 <div className="karaoke-dock">
 <div className="karaoke-timeline"><div className="time-label"><span>{formatTime(position)}</span><span>{formatTime(length)}</span></div><input type="range" min="0" max={length} step=".1" value={position} aria-label="Позиция песни" style={{'--progress':(length?position/length*100:0)+'%'} as React.CSSProperties} onChange={e=>void seek(+e.target.value)}/></div>
 <div className="karaoke-transport"><IconButton label="Поделиться песней" onClick={onShare}><Share2 size={19}/></IconButton><IconButton label="Назад 10 секунд" onClick={()=>void seek(position-10)}><SkipBack size={22}/></IconButton><button type="button" className="play-main" aria-label={playing?'Пауза':'Воспроизвести'} onClick={()=>void toggle()}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button><IconButton label="Вперёд 10 секунд" onClick={()=>void seek(position+10)}><SkipForward size={22}/></IconButton><button type="button" className="icon-button" aria-label={focus?'Показать микшер':'Свернуть микшер'} title={focus?'Показать микшер':'Свернуть микшер'} onClick={()=>setFocus(v=>!v)}><MicVocal size={21}/></button></div>
 {!focus&&<Mixer {...mixer}/>}
 {effectiveVolume(mixer.music,mixer.musicMuted)===0&&effectiveVolume(mixer.vocals,mixer.vocalsMuted)===0&&<button type="button" className="karaoke-sound-warning" onClick={()=>{mixer.onMusic(100);if(mixer.musicMuted)mixer.onToggleMusic()}}>Звук выключен · Включить музыку</button>}
 {error&&<p role="alert" className="karaoke-error">{error}</p>}
 </div>
 </section>;
 return <>
 <header className="screen-header"><IconButton label="Назад" onClick={onBack}><ArrowLeft/></IconButton><strong>Песня</strong><IconButton label="Поделиться песней" onClick={onShare}><Share2/></IconButton></header>
 <Artwork title={selected.title} color="#7961bd" large src={coverFor(selected.providerTrackId)}/><div className="detail-title"><div><h1>{selected.title}</h1><button className="artist-link accent" onClick={onArtist}>{selected.artist}</button></div><IconButton label={liked?'Убрать из любимого':'В любимое'} active={liked} onClick={onLike}><Heart fill={liked?'currentColor':'none'}/></IconButton></div><p className="metadata">{selected.durationMs?formatTime(selected.durationMs/1000):'—'}</p>{job&&<p className="metadata" role="status">{statusText[job.state]}</p>}
 {job?.state==='ready'?<button className="primary" disabled={loadingAudio} onClick={()=>void openPlayer()}><Play/>{loadingAudio?'Загружаем дорожки…':'Открыть караоке'}</button>:<><button className="primary" disabled={busy||job?.state==='queued'||job?.state==='running'||(job?.state==='failed'&&!job.retryable)} onClick={()=>void enqueue()}><MicVocal/>{busy?'Запрос…':job?.state==='failed'?'Повторить':job?.state==='queued'||job?.state==='running'?'Обработка…':'Создать караоке'}</button><button className="secondary" disabled={busy} onClick={()=>void getStatus()}><RefreshCw size={18}/>Проверить статус</button></>}
 {error&&<p role="alert" className="live-error">{error}</p>}

 </>;
}
