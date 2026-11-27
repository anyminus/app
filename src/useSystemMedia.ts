import {useEffect,useRef} from 'react';
type Props={ready:boolean;title:string;artist:string;artwork:string|null;playing:boolean;length:number;position:number;speed?:number;play:()=>void;pause:()=>void;seek:(seconds:number)=>void;currentTime:()=>number;isPlaying:()=>boolean};
export function useSystemMedia(props:Props){
 const latest=useRef(props);latest.current=props;
 function publish(){
  const p=latest.current;if(!p.ready||!('mediaSession' in navigator))return;
  const session=navigator.mediaSession;
  try{session.playbackState=p.isPlaying()?'playing':'paused'}catch{}
  try{if(Number.isFinite(p.length)&&p.length>0){const time=p.currentTime(),rate=p.speed??1;session.setPositionState({duration:p.length,playbackRate:Number.isFinite(rate)&&rate>0?rate:1,position:Math.max(0,Math.min(p.length,Number.isFinite(time)?time:0))})}}catch{}
 }
 useEffect(()=>{
  if(!props.ready||!('mediaSession' in navigator))return;
  const session=navigator.mediaSession;
  const jump=(direction:number,offset?:number)=>{const amount=typeof offset==='number'&&Number.isFinite(offset)&&offset>0?offset:10;latest.current.seek(latest.current.currentTime()+direction*amount)};
  const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={
   play:()=>latest.current.play(),
   pause:()=>latest.current.pause(),
   stop:()=>{latest.current.pause();latest.current.seek(0)},
   seekbackward:details=>jump(-1,details.seekOffset),
   seekforward:details=>jump(1,details.seekOffset),
   seekto:details=>{if(typeof details.seekTime==='number'&&Number.isFinite(details.seekTime))latest.current.seek(details.seekTime)},
   // Some system surfaces expose track arrows rather than skip controls.
   // Karaoke plays a single song, so these arrows seek within that song.
   previoustrack:()=>jump(-1),
   nexttrack:()=>jump(1)
  };
  const registered:MediaSessionAction[]=[];
  for(const action of Object.keys(handlers) as MediaSessionAction[]){try{session.setActionHandler(action,handlers[action]!);registered.push(action)}catch{/* Not every browser supports every action. */}}
  const refresh=()=>publish();
  document.addEventListener('visibilitychange',refresh);window.addEventListener('pageshow',refresh);
  return()=>{document.removeEventListener('visibilitychange',refresh);window.removeEventListener('pageshow',refresh);for(const action of registered){try{session.setActionHandler(action,null)}catch{}}try{session.metadata=null;session.playbackState='none';session.setPositionState()}catch{}};
 },[props.ready]);
 useEffect(()=>{
  if(!props.ready||!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;
  try{navigator.mediaSession.metadata=new MediaMetadata({title:props.title,artist:props.artist,artwork:props.artwork?[{src:props.artwork}]:[]})}catch{}
 },[props.ready,props.title,props.artist,props.artwork]);
 const second=Math.floor(props.position);
 useEffect(()=>{publish()},[props.ready,props.playing,props.length,props.speed,second]);
}
