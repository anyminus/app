import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,Bell,Heart,Send,Share2,Maximize2,Minimize2,MicVocal,Pause,Play,RefreshCw,SkipBack,SkipForward} from 'lucide-react';
import {normalizeJob,mediaUrl,providerLyricsHint} from './api.mjs';
import {api,origin,coverFor,type LiveTrack} from './catalog';
import {RemoteAudio} from './RemoteAudio';
import {useSystemMedia} from './useSystemMedia';
import {normalizeStoredLyrics,retryLyricsStatus,lyricScrollEase,introCountdown} from './lyrics.mjs';
import {Mixer,Artwork,IconButton,ArtistLinks,KaraokeReadyStatus,ProviderLyricsStatus} from './components';
import {effectiveVolume} from './mixer.mjs';
import {formatTime} from './model.mjs';
type Job={state:string;pairOperationId:string|null;retryable:boolean;lyricsFormat?:LiveTrack['lyricsFormat']};
type Line={text:string;startMs:number;endMs:number|null};
type Props={telegramAuthorized:boolean;telegramBusy:boolean;telegramError:string;getTelegramToken:()=>string|null;onTelegramLogin:()=>void;onTelegramLogout:()=>void;lyricsSubscribed:boolean;onToggleLyricsSubscription:()=>void;onLyricsAvailable:(format?:'TEXT'|'LRC'|'NONE')=>void;onBack:()=>void;track:LiveTrack;takeLaunch:(id:string)=>{id:string;audio:RemoteAudio|null}|null;onReady:(pair:string,format?:LiveTrack['lyricsFormat'])=>void;onKaraokeRequested?:(track:LiveTrack)=>void;liked:boolean;onLike:()=>void;onShare:()=>void;onArtist:(credit?:{author_id:string;name:string})=>void;onPlayed:()=>void;font:number;autoScroll:boolean;music:number;vocals:number;musicMuted:boolean;vocalsMuted:boolean;onMusic:(n:number)=>void;onVocals:(n:number)=>void;onToggleMusic:()=>void;onToggleVocals:()=>void};
// Temporary owner-approved DEV rollback; restore after verified browser login.
const TELEGRAM_CREATION_REQUIRED=false;
const statusText:Record<string,string>={none:'Караоке ещё не создано',queued:'В очереди',running:'Обработка дорожек',ready:'Караоке готово',failed:'Обработка не удалась'};
export function LiveCatalog({telegramAuthorized,telegramBusy,telegramError,getTelegramToken,onTelegramLogin,onTelegramLogout,lyricsSubscribed,onToggleLyricsSubscription,onLyricsAvailable,onBack,track:selected,takeLaunch,onReady,onKaraokeRequested,liked,onLike,onShare,onArtist,onPlayed,font,autoScroll,...mixer}:Props){
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [job,setJob]=useState<Job|null>(()=>selected.pairOperationId?{state:'ready',pairOperationId:selected.pairOperationId,retryable:false,lyricsFormat:selected.lyricsFormat}:null);const [resolvedFormat,setResolvedFormat]=useState<LiveTrack['lyricsFormat']>(selected.lyricsFormat);const [previewFormat,setPreviewFormat]=useState<LiveTrack['providerLyricsFormat']>(selected.providerLyricsFormat);const [previewChecking,setPreviewChecking]=useState(!selected.pairOperationId&&!selected.providerLyricsFormat);const [lyrics,setLyrics]=useState<Line[]>([]);const [lyricState,setLyricState]=useState('');const [canSubscribe,setCanSubscribe]=useState(false);const [plainLyrics,setPlainLyrics]=useState('');const [lyricPair,setLyricPair]=useState('');const [lyricRetry,setLyricRetry]=useState(0);const [lyricLoading,setLyricLoading]=useState(false);const [position,setPosition]=useState(0);const [length,setLength]=useState(0);const [playing,setPlaying]=useState(false);const [playerReady,setPlayerReady]=useState(false);const [loadingAudio,setLoadingAudio]=useState(false);
 const token=useRef<{value:string;expires:number}|null>(null);const audio=useRef<RemoteAudio|null>(null);const selectionAbort=useRef<AbortController|null>(null);const polling=useRef<number>(0);const playLock=useRef(false);const selectionVersion=useRef(0);const opening=useRef(false);const mixerRef=useRef(mixer);mixerRef.current=mixer;
 function showError(e:unknown){if(e instanceof Error&&'status' in e&&e.status===401){token.current=null;api.invalidateAuth()}setError(e instanceof Error?e.message:'API недоступен');}
 useEffect(()=>()=>{selectionVersion.current++;selectionAbort.current?.abort();clearTimeout(polling.current);audio.current?.dispose();token.current=null},[]);
 async function session(signal:AbortSignal){if(!api)throw Error('Нет API');const authenticated=getTelegramToken();if(authenticated)return authenticated;if(token.current&&token.current.expires>Date.now()+30000)return token.current.value;const r=await api.auth(signal);if(typeof r.accessToken!=='string'||!Number.isFinite(r.expiresIn)||r.expiresIn<=0)throw Error('Некорректный ответ авторизации');token.current={value:r.accessToken,expires:Date.now()+r.expiresIn*1000};return token.current.value;}
 function warmAudio(){if(audio.current)return audio.current;const a=new RemoteAudio();try{a.prepare();audio.current=a;return a}catch{a.dispose();return null}}
 function releaseAudio(){audio.current?.dispose();audio.current=null}
 function checkedJob(payload:unknown):Job{const next=normalizeJob(payload);if(next.state==='ready'&&!next.pairOperationId)throw Error('API не вернул идентификатор готового караоке');return next}
 async function acceptJob(next:Job,t:LiveTrack,key:string,c:AbortController,version:number,keepQueued=false){
 if(c.signal.aborted||version!==selectionVersion.current)return;
 if(keepQueued&&next.state==='none'){poll(t,key,c,version);return}
 setJob(next);setError('');
 if(next.state==='ready'&&next.pairOperationId){setResolvedFormat(next.lyricsFormat??(t.pairOperationId===next.pairOperationId?t.lyricsFormat:undefined));onReady(next.pairOperationId,next.lyricsFormat);await openPlayer(next.pairOperationId,audio.current)}
 else if(next.state==='queued'||next.state==='running')poll(t,key,c,version);
 else releaseAudio();
 }
 async function getStatus(){if(!api||!selected)return;const version=selectionVersion.current;const c=new AbortController();selectionAbort.current?.abort();clearTimeout(polling.current);selectionAbort.current=c;setBusy(true);setError('');try{const key=await session(c.signal);const next=checkedJob(await api.status(selected.providerTrackId,key,c.signal));await acceptJob(next,selected,key,c,version)}catch(e){if(!c.signal.aborted&&version===selectionVersion.current){releaseAudio();showError(e)}}finally{if(version===selectionVersion.current)setBusy(false)}}
 function poll(t:LiveTrack,key:string,c:AbortController,version:number){clearTimeout(polling.current);polling.current=window.setTimeout(async()=>{try{const next=checkedJob(await api.status(t.providerTrackId,key,c.signal));await acceptJob(next,t,key,c,version,true)}catch(e){if(!c.signal.aborted&&version===selectionVersion.current)showError(e)}},3000)}
 async function enqueue(){if(!api||!selected||busy||previewChecking||playLock.current||!(job?.state==='none'||(job?.state==='failed'&&job.retryable)))return;const telegramToken=getTelegramToken();if(TELEGRAM_CREATION_REQUIRED&&!telegramToken){onTelegramLogin();return}warmAudio();const version=selectionVersion.current;playLock.current=true;const c=new AbortController();selectionAbort.current?.abort();clearTimeout(polling.current);selectionAbort.current=c;setBusy(true);setError('');try{const key=telegramToken??await session(c.signal);let t=selected;if(!t.durationMs){const meta=await api.metadata(t.providerTrackId,key,c.signal);t={...t,durationMs:meta.durationMs,title:meta.title,artist:meta.artist};}const existing=checkedJob(await api.status(t.providerTrackId,key,c.signal));if((telegramToken!==null&&getTelegramToken()!==key)||(TELEGRAM_CREATION_REQUIRED&&!getTelegramToken()))throw Error('Войдите через Telegram снова');let next=existing;if(existing.state==='none'||(existing.state==='failed'&&existing.retryable)){onKaraokeRequested?.(t);next=checkedJob(await api.enqueue(t,key,c.signal))}else if(existing.state==='queued'||existing.state==='running')onKaraokeRequested?.(t);await acceptJob(next,t,key,c,version)}catch(e){if(!c.signal.aborted&&version===selectionVersion.current){if(e instanceof Error&&'status' in e&&e.status===401&&telegramToken!==null&&getTelegramToken()===telegramToken)onTelegramLogout();releaseAudio();showError(e)}}finally{playLock.current=false;if(version===selectionVersion.current)setBusy(false)}}
 async function openPlayer(pairId=job?.pairOperationId,warmed:RemoteAudio|null=null){if(!api||!selected||!pairId||opening.current){warmed?.dispose();return}opening.current=true;const version=selectionVersion.current;setLoadingAudio(true);setError('');const c=new AbortController();selectionAbort.current?.abort();selectionAbort.current=c;const a=warmed||new RemoteAudio();if(audio.current!==a)audio.current?.dispose();audio.current=a;try{a.prepare();const r=await api.playback(pairId,selected.providerTrackId,getTelegramToken()??token.current?.value,c.signal);const pair=r.pairOperationId;const urls=[mediaUrl(origin,pair,'instrumental',r.instrumental),mediaUrl(origin,pair,'vocals',r.vocals)];await a.load(urls,r.durationSeconds,c.signal);if(version!==selectionVersion.current||c.signal.aborted){a.dispose();return;}const m=mixerRef.current;a.setVolumes(effectiveVolume(m.music,m.musicMuted),effectiveVolume(m.vocals,m.vocalsMuted));setLength(a.length);setPlayerReady(true);setPosition(0);setLyricPair(pair);onReady(pair);try{await a.play();if(version!==selectionVersion.current||c.signal.aborted){a.dispose();return}setPlaying(a.playing);if(a.playing)onPlayed()}catch(e){if(version===selectionVersion.current&&!c.signal.aborted){setPlaying(false);showError(e)}}}catch(e){a.dispose();if(!c.signal.aborted)showError(e)}finally{opening.current=false;if(version===selectionVersion.current)setLoadingAudio(false)}}
 // Read only: check an unknown provider capability before enabling creation.
 useEffect(()=>{
  if(selected.pairOperationId||job?.state==='ready'){setPreviewChecking(false);return}
  if(selected.providerLyricsFormat){setPreviewFormat(selected.providerLyricsFormat);setPreviewChecking(false);return}
  // Resolve readiness first: a ready track does not need a provider preview.
  if(!job||!(job.state==='none'||job.state==='failed'))return;
  const c=new AbortController();let disposed=false;
  setPreviewChecking(true);
  const deadline=window.setTimeout(()=>{c.abort();if(!disposed)setPreviewChecking(false)},10000);
  void (async()=>{try{const key=await session(c.signal);const meta=await api.metadata(selected.providerTrackId,key,c.signal);if(!disposed&&!c.signal.aborted&&meta?.providerTrackId===selected.providerTrackId)setPreviewFormat(providerLyricsHint(meta))}catch{/* unknown is not absent */}finally{clearTimeout(deadline);if(!disposed)setPreviewChecking(false)}})();
  return()=>{disposed=true;c.abort();clearTimeout(deadline)};
 },[selected.providerTrackId,selected.pairOperationId,selected.providerLyricsFormat,job?.state]);
 // Consume only an explicit click's launch intent, after StrictMode's first cleanup.
 useEffect(()=>{const timer=window.setTimeout(()=>{const launch=takeLaunch(selected.providerTrackId);if(launch)audio.current=launch.audio;if(selected.pairOperationId)void openPlayer(selected.pairOperationId,audio.current);else void getStatus()},0);return()=>clearTimeout(timer)},[selected.providerTrackId,takeLaunch]);

 useEffect(()=>{
 if(!playerReady||!lyricPair)return;
 let disposed=false;let timer:number|undefined;let controller:AbortController|null=null;let attempts=0;
 async function load(){attempts++;controller=new AbortController();const c=controller;const deadline=window.setTimeout(()=>c.abort(),18000);setLyricLoading(true);
 let retryable=false;
 try{const payload=await api!.storedLyrics(lyricPair,undefined,c.signal);if(disposed)return;const result=normalizeStoredLyrics(payload,Math.round(length*1000));
 if(result.lines.length||result.text){setLyrics(result.lines);setPlainLyrics(result.text);setLyricState('');setCanSubscribe(false);setResolvedFormat(result.lines.length?'LRC':'TEXT');onLyricsAvailable(result.lines.length?'LRC':'TEXT');}
 else if(result.state==='absent'){setResolvedFormat('NONE');onLyricsAvailable('NONE');setCanSubscribe(true);setLyricState('Текст отсутствует в базе');}
 else if(result.state==='transient_error'){retryable=true;setCanSubscribe(true);setLyricState('Текст пока не готов');}
 else setLyricState('API не вернул строки или обычный текст');
 }catch(e){if(disposed)return;const status=e instanceof Error&&'status' in e?Number(e.status):c.signal.aborted?408:0;retryable=retryLyricsStatus(status);const pending=e instanceof Error&&'lyricsProvenance' in e&&e.lyricsProvenance==='pending';setCanSubscribe(pending||status===503);setLyricState(pending?'Текст отсутствует в базе':status===401||status===403?'Нет доступа к тексту (HTTP '+status+'). Откройте караоке заново.':status===404?'Не удалось найти текст (HTTP 404)':status===0?'Не удалось загрузить текст: сеть или CORS':status===408?'Время ожидания текста истекло':'Не удалось проверить наличие текста (HTTP '+status+')');}
 finally{clearTimeout(deadline);if(!disposed){setLyricLoading(false);if(retryable&&attempts<10)timer=window.setTimeout(()=>void load(),15000);}}
 }
 setLyricState('');setCanSubscribe(false);void load();
 return()=>{disposed=true;controller?.abort();clearTimeout(timer);};
 },[playerReady,lyricPair,selected.providerTrackId,length,lyricRetry]);
 useEffect(()=>{audio.current?.setVolumes(effectiveVolume(mixer.music,mixer.musicMuted),effectiveVolume(mixer.vocals,mixer.vocalsMuted))},[mixer.music,mixer.vocals,mixer.musicMuted,mixer.vocalsMuted]);
 useEffect(()=>{if(!playing)return;let last=audio.current?.position??0,lastAdvance=performance.now();const t=setInterval(()=>{const a=audio.current;if(!a)return;const now=performance.now(),position=a.position;setPosition(position);if(a.interrupted){a.markOutputStalled();setPlaying(false);setError('Воспроизведение прервано системой. Нажмите воспроизведение ещё раз.');}else if(position>=a.length){a.pause();setPlaying(false)}else if(document.hidden||Math.abs(position-last)>.005){last=position;lastAdvance=now}else if(now-lastAdvance>1800){a.markOutputStalled();setPlaying(false);setError('Аудиовыход остановился. Нажмите воспроизведение ещё раз.');}},80);return()=>clearInterval(t)},[playing]);
 let active=-1;for(let i=0;i<lyrics.length;i++)if(lyrics[i].startMs<=position*1000)active=i;
 const longIntro=lyrics.length>0&&lyrics[0].startMs>10000;
 const introRemaining=playerReady?introCountdown(lyrics[0]?.startMs,position):null;

 const lyricRef=useRef<HTMLDivElement>(null);const [focus,setFocus]=useState(false);
 // Lock the page itself. Only the independent lyrics viewport may scroll.
 const playerVisible=playerReady||loadingAudio||job?.state==='ready';useLayoutEffect(()=>{if(!playerVisible)return;document.body.classList.add('karaoke-open');window.scrollTo(0,0);return()=>document.body.classList.remove('karaoke-open')},[playerVisible]);
 const lyricFrame=useRef<number|null>(null);
 function stopLyricMotion(){if(lyricFrame.current!==null){cancelAnimationFrame(lyricFrame.current);lyricFrame.current=null}}
 function centerLine(smooth:boolean){
   stopLyricMotion();
   const viewport=lyricRef.current,line=viewport?.querySelector<HTMLElement>('[data-active="true"]');
   if(!viewport)return;
   if(!line){if(longIntro)viewport.scrollTop=0;return;}
   // Measure the unscaled button, not the transformed text. Wrapped lines keep stable geometry.
   const delta=line.getBoundingClientRect().top-viewport.getBoundingClientRect().top+(line.offsetHeight-viewport.clientHeight)/2;
   const target=Math.max(0,Math.min(viewport.scrollHeight-viewport.clientHeight,viewport.scrollTop+delta));
   const from=viewport.scrollTop;
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
   if(!smooth||reduced.matches||Math.abs(target-from)<1){viewport.scrollTop=target;return}
   const duration=480;
   let started:number|null=null;
   const tick=(now:number)=>{
     if(!viewport.isConnected||reduced.matches){lyricFrame.current=null;if(viewport.isConnected)viewport.scrollTop=target;return}
     if(started===null)started=now;
     const progress=Math.min(1,(now-started)/duration);
     viewport.scrollTop=from+(target-from)*lyricScrollEase(progress);
     if(progress<1)lyricFrame.current=requestAnimationFrame(tick);
     else{viewport.scrollTop=target;lyricFrame.current=null}
   };
   lyricFrame.current=requestAnimationFrame(tick);
 }
 useLayoutEffect(()=>{if(playerReady&&autoScroll)centerLine(false);else stopLyricMotion()},[playerReady,focus,lyrics,autoScroll,font]);
 useEffect(()=>{if(playerReady&&autoScroll)centerLine(true);return stopLyricMotion},[active,playerReady,autoScroll]);
 useEffect(()=>{
   const el=lyricRef.current;if(!playerReady||!autoScroll||!el)return;
   let width=el.clientWidth,height=el.clientHeight;
   const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(width===el.clientWidth&&height===el.clientHeight)return;width=el.clientWidth;height=el.clientHeight;centerLine(false)});
   observer?.observe(el);
   el.addEventListener('wheel',stopLyricMotion,{passive:true});el.addEventListener('touchstart',stopLyricMotion,{passive:true});
   return()=>{observer?.disconnect();el.removeEventListener('wheel',stopLyricMotion);el.removeEventListener('touchstart',stopLyricMotion);stopLyricMotion()};
 },[playerReady,autoScroll]);

 // Use the same two-stem clock for the screen and operating-system controls.
 async function startPlayback(){const a=audio.current;if(!a||!playerReady||loadingAudio)return;try{if(a.playing)return;const version=selectionVersion.current;const m=mixerRef.current;a.setVolumes(effectiveVolume(m.music,m.musicMuted),effectiveVolume(m.vocals,m.vocalsMuted));await a.play(true);if(audio.current!==a||version!==selectionVersion.current)return;setError('');setPlaying(a.playing);setPosition(a.position);if(a.playing)onPlayed()}catch(e){if(audio.current===a){setPlaying(false);showError(e)}}}
 function pausePlayback(){const a=audio.current;if(!a)return;a.pause();setPosition(a.position);setPlaying(false)}
 async function toggle(){if(playing)pausePlayback();else await startPlayback()}
 const seekQueue=useRef<Promise<void>>(Promise.resolve());
 function seek(n:number){const a=audio.current;if(!a||!playerReady||!Number.isFinite(n))return Promise.resolve();const version=selectionVersion.current;const target=Math.max(0,Math.min(a.length,n));const task=async()=>{if(audio.current!==a||version!==selectionVersion.current)return;try{await a.seek(target);if(audio.current!==a||version!==selectionVersion.current)return;setPosition(target);setPlaying(a.playing);if('mediaSession' in navigator)try{navigator.mediaSession.setPositionState({duration:a.length,playbackRate:1,position:target})}catch{}}catch(e){showError(e)}};seekQueue.current=seekQueue.current.then(task,task);return seekQueue.current}
 useSystemMedia({ready:playerReady&&!loadingAudio,title:selected.title,artist:selected.artist,artwork:coverFor(selected.providerTrackId,selected.coverUrl),playing,length,position,play:()=>void startPlayback(),pause:pausePlayback,seek:n=>void seek(n),currentTime:()=>audio.current?.position??0});
 if(playerVisible)return <section className={'karaoke-screen'+(focus?' karaoke-focus':'')} aria-label="Плеер караоке">
 <header className="karaoke-header">
 <IconButton label="Назад" onClick={onBack}><ArrowLeft/></IconButton>
 <div className="karaoke-cover"><Artwork title={selected.title} color="#7961bd" src={coverFor(selected.providerTrackId,selected.coverUrl)}/></div>
 <div className="karaoke-heading"><h1 title={selected.title}>{selected.title}</h1>{selected.metadataUnavailable?<span className="metadata">Уточняем название и исполнителя…</span>:<ArtistLinks artist={selected.artist} credits={selected.artistCredits} onArtist={onArtist}/>}<KaraokeReadyStatus format={resolvedFormat} className="song-lyrics-status" announce/></div>
 <IconButton label={liked?'Убрать из любимого':'В любимое'} active={liked} onClick={onLike}><Heart size={21} fill={liked?'currentColor':'none'}/></IconButton>
 <button className="icon-button karaoke-focus-toggle" type="button" aria-label={focus?'Показать плеер':'Только текст'} aria-pressed={focus} title={focus?'Обычный режим':'Полноэкранный текст'} onClick={()=>setFocus(v=>!v)}>{focus?<Minimize2 size={21}/>:<Maximize2 size={21}/>}</button>
 </header>
 <div className={'karaoke-lyrics'+(lyrics.length?' timed':'')+(longIntro?' has-long-intro':'')} ref={lyricRef} aria-label="Текст песни" style={{'--lyric-size':font+'px'} as React.CSSProperties}>
 {longIntro&&<div className="karaoke-intro-spacer">{introRemaining!==null&&<div className="karaoke-intro-countdown" role="timer" aria-label="До начала текста"><span className="intro-label">До начала текста</span><strong>{formatTime(introRemaining)}</strong><span className="intro-hint">Приготовьтесь петь</span></div>}</div>}
 {lyrics.length?lyrics.map((l,i)=><button type="button" className={'lyric '+(i===active?'current':i<active?'past':'future')} data-active={i===active} aria-current={i===active?'true':undefined} key={i} onClick={()=>void seek(l.startMs/1000)}><span className="lyric-text">{l.text}</span></button>):plainLyrics?<><p className="metadata">Текст без синхронизации</p><p className="plain-lyrics">{plainLyrics}</p></>:<div className="karaoke-lyrics-empty"><p className="metadata" role="status">{!playerReady?(error&&!loadingAudio?'Не удалось загрузить дорожки':'Загружаем дорожки…'):lyricState||'Загрузка текста…'}</p>{!playerReady&&error&&!loadingAudio&&<button className="secondary" onClick={()=>void openPlayer()}>Повторить загрузку дорожек</button>}{playerReady&&canSubscribe&&<><button className="secondary lyric-subscribe" aria-pressed={lyricsSubscribed} onClick={onToggleLyricsSubscription}><Bell size={18}/>{lyricsSubscribed?'Вы подписаны · отменить':'Подписаться на обновление'}</button><p className="metadata lyric-subscribe-note">{lyricsSubscribed?'Сообщим в ANYMINUS, когда текст появится. Проверка при открытом сайте.':'Уведомим в ANYMINUS, когда текст будет доступен.'}</p></>}{playerReady&&lyricState&&lyricState!=='Текст отсутствует в базе'&&<button className="text-button" disabled={lyricLoading} onClick={()=>setLyricRetry(n=>n+1)}>Повторить загрузку текста</button>}</div>}
 </div>
 <div className="karaoke-dock">
 <div className="karaoke-timeline"><div className="time-label"><span>{formatTime(position)}</span><span>{formatTime(length||((selected.durationMs??0)/1000))}</span></div><input disabled={!playerReady||loadingAudio} type="range" min="0" max={length} step=".1" value={position} aria-label="Позиция песни" style={{'--progress':(length?position/length*100:0)+'%'} as React.CSSProperties} onChange={e=>void seek(+e.target.value)}/></div>
 <div className="karaoke-transport"><IconButton label="Поделиться песней" onClick={onShare}><Share2 size={19}/></IconButton><IconButton label="Назад 10 секунд" onClick={()=>{if(playerReady&&!loadingAudio)void seek(position-10)}}><SkipBack size={22}/></IconButton><button type="button" className="play-main" disabled={!playerReady||loadingAudio} aria-label={loadingAudio?'Загрузка дорожек':playing?'Пауза':'Воспроизвести'} onClick={()=>void toggle()}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button><IconButton label="Вперёд 10 секунд" onClick={()=>{if(playerReady&&!loadingAudio)void seek(position+10)}}><SkipForward size={22}/></IconButton><button type="button" className="icon-button" aria-label={focus?'Показать микшер':'Свернуть микшер'} title={focus?'Показать микшер':'Свернуть микшер'} onClick={()=>setFocus(v=>!v)}><MicVocal size={21}/></button></div>
 {!focus&&<Mixer {...mixer}/>}
 {effectiveVolume(mixer.music,mixer.musicMuted)===0&&effectiveVolume(mixer.vocals,mixer.vocalsMuted)===0&&<button type="button" className="karaoke-sound-warning" onClick={()=>{mixer.onMusic(100);if(mixer.musicMuted)mixer.onToggleMusic()}}>Звук выключен · Включить музыку</button>}
 {error&&<p role="alert" className="karaoke-error">{error}</p>}
 </div>
 </section>;
 return <>
 <header className="screen-header"><IconButton label="Назад" onClick={onBack}><ArrowLeft/></IconButton><strong>Песня</strong><IconButton label="Поделиться песней" onClick={onShare}><Share2/></IconButton></header>
 <Artwork title={selected.title} color="#7961bd" large src={coverFor(selected.providerTrackId,selected.coverUrl)}/><div className="detail-title"><div><h1>{selected.title}</h1><ArtistLinks artist={selected.artist} credits={selected.artistCredits} onArtist={onArtist} accent/></div><IconButton label={liked?'Убрать из любимого':'В любимое'} active={liked} onClick={onLike}><Heart fill={liked?'currentColor':'none'}/></IconButton></div><p className="metadata">{selected.durationMs?formatTime(selected.durationMs/1000):'—'}</p>{job&&(job.state==='ready'?<KaraokeReadyStatus format={resolvedFormat} className="song-lyrics-status" announce/>:<p className="metadata" role="status">{statusText[job.state]}</p>)}{job?.state!=='ready'&&<div className="song-lyrics-preview" aria-live="polite">{previewFormat?<ProviderLyricsStatus format={previewFormat} className="song-lyrics-status"/>:<p className="metadata">{previewChecking?'Проверяем наличие текста…':'Наличие текста не подтверждено'}</p>}{previewFormat==='NONE'&&<p className="metadata">По данным Яндекс Музыки, караоке будет без текста.</p>}{previewFormat==='TEXT'&&<p className="metadata">Текст будет без автоматической синхронизации.</p>}</div>}
 {!job?<>{error&&!busy?<button className="secondary" onClick={()=>{warmAudio();void getStatus()}}><RefreshCw size={18}/>Повторить загрузку</button>:<div className="karaoke-checking" role="status"><span className="karaoke-spinner" aria-hidden="true"/>Проверяем наличие караоке…</div>}</>:job.state==='queued'||job.state==='running'?<><div className="karaoke-checking"><span className="karaoke-spinner" aria-hidden="true"/>Караоке готовится…</div>{!previewFormat&&<p className="metadata song-lyrics-pending">Формат текста уточняется…</p>}{error&&<button className="secondary" disabled={busy} onClick={()=>{warmAudio();void getStatus()}}><RefreshCw size={18}/>Повторить загрузку</button>}</>:job.state==='failed'&&!job.retryable?<p className="metadata">Повторное создание пока недоступно.</p>:(!TELEGRAM_CREATION_REQUIRED||telegramAuthorized)?<button className="primary" disabled={busy||previewChecking} onClick={()=>void enqueue()}><MicVocal/>{busy?'Запрос…':job.state==='failed'?'Повторить создание':'Создать караоке'}</button>:<div className="telegram-login-panel"><p className="metadata">Для создания караоке войдите через Telegram.</p><button className="telegram-login" disabled={telegramBusy} onClick={onTelegramLogin}><Send size={20}/>{telegramBusy?'Вход…':'Войти через Telegram'}</button>{telegramError&&<p role="alert" className="live-error">{telegramError}</p>}</div>}
 {error&&<p role="alert" className="live-error">{error}</p>}

 </>;
}
