import {tracks} from './model.mjs';
export const initialPlaylists=[{id:'top',name:'Топ караоке',trackIds:tracks.map(t=>t.id)},...['Поп','Лирика','Рок'].map(name=>({id:name,name,trackIds:tracks.filter(t=>t.genre===name).map(t=>t.id)}))];
export function registerProfileTap(previous,now){return previous.count===0||now-previous.startedAt>4000?{count:1,startedAt:now}:{count:Math.min(5,previous.count+1),startedAt:previous.startedAt}}
export function normalizeName(name){return name.trim().slice(0,60)}
export function addPlaylist(list,id,name){const clean=normalizeName(name);return clean&&!list.some(p=>p.id===id)?[...list,{id,name:clean,trackIds:[]}]:list}
export function renamePlaylist(list,id,name){const clean=normalizeName(name);return clean?list.map(p=>p.id===id?{...p,name:clean}:p):list}
export function deletePlaylist(list,id){return list.filter(p=>p.id!==id)}
export function addTrack(list,id,trackId){if(!tracks.some(t=>t.id===trackId))return list;return list.map(p=>p.id===id&&!p.trackIds.includes(trackId)?{...p,trackIds:[...p.trackIds,trackId]}:p)}
export function removeTrack(list,id,trackId){return list.map(p=>p.id===id?{...p,trackIds:p.trackIds.filter(t=>t!==trackId)}:p)}
