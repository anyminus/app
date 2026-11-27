import {useEffect,useRef} from 'react';
type Props={ready:boolean;title:string;artist:string;artwork:string|null;playing:boolean;length:number;position:number;speed?:number;play:()=>void;pause:()=>void;seek:(seconds:number)=>void;currentTime:()=>number};
export function useSystemMedia(props:Props){
 const latest=useRef(props);latest.current=props;
 useEffect(()=>{
  if(!props.ready||!('mediaSession' in navigator))return;
  const session=navigator.mediaSession;
  const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={
   play:()=>latest.current.play(),
   pause:()=>latest.current.pause(),
   stop:()=>{latest.current.pause();latest.current.seek(0)},
   seekbackward:details=>latest.current.seek(latest.current.currentTime()-(details.seekOffset??10)),
   seekforward:details=>latest.current.seek(latest.current.currentTime()+(details.seekOffset??10)),
   seekto:details=>{if(typeof details.seekTime==='number'&&Number.isFinite(details.seekTime))latest.current.seek(details.seekTime)}
  };
  const registered:MediaSessionAction[]=[];
  for(const action of Object.keys(handlers) as MediaSessionAction[]){try{session.setActionHandler(action,handlers[action]!);registered.push(action)}catch{/* Not every browser supports every action. */}}
  return()=>{for(const action of registered){try{session.setActionHandler(action,null)}catch{}}try{session.metadata=null;session.playbackState='none';session.setPositionState()}catch{}};
 },[props.ready]);
 useEffect(()=>{
  if(!props.ready||!('mediaSession' in navigator)||typeof MediaMetadata==='undefined')return;
  try{navigator.mediaSession.metadata=new MediaMetadata({title:props.title,artist:props.artist,artwork:props.artwork?[{src:props.artwork}]:[]})}catch{}
 },[props.ready,props.title,props.artist,props.artwork]);
 const second=Math.floor(props.position);
 useEffect(()=>{
  if(!props.ready||!('mediaSession' in navigator))return;
  const session=navigator.mediaSession;
  try{session.playbackState=props.playing?'playing':'paused'}catch{}
  try{if(Number.isFinite(props.length)&&props.length>0){const time=latest.current.currentTime();session.setPositionState({duration:props.length,playbackRate:props.speed??1,position:Math.max(0,Math.min(props.length,Number.isFinite(time)?time:0))})}}catch{}
 },[props.ready,props.playing,props.length,props.speed,second]);
}
