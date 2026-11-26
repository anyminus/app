export const tracks = [
{id:'city',title:'Город огней',artist:'SING Originals',artistId:'sing',durationSeconds:96,ready:true,genre:'Поп',color:'#8767df'},
{id:'fly',title:'Лети со мной',artist:'Luna North',artistId:'luna',durationSeconds:96,ready:false,genre:'Лирика',color:'#368fa1'},
{id:'more',title:'Дальше — больше',artist:'Neon Waves',artistId:'neon',durationSeconds:96,ready:true,genre:'Рок',color:'#c36593'},
{id:'wind',title:'Тёплый ветер',artist:'MIRA',artistId:'mira',durationSeconds:96,ready:true,genre:'Лирика',color:'#c19459'},
{id:'rhythm',title:'В ритме ночи',artist:'SING Originals',artistId:'sing',durationSeconds:96,ready:true,genre:'Поп',color:'#6857c5'},
{id:'lines',title:'Между строк',artist:'Luna North',artistId:'luna',durationSeconds:96,ready:false,genre:'Лирика',color:'#557abc'},
{id:'clouds',title:'Выше облаков',artist:'MIRA',artistId:'mira',durationSeconds:96,ready:true,genre:'Поп',color:'#d1a878'},
{id:'dawn',title:'До рассвета',artist:'Neon Waves',artistId:'neon',durationSeconds:96,ready:true,genre:'Рок',color:'#cd798a'}];
export const artists=[{id:'sing',name:'SING Originals',genre:'Поп · Танцевальная музыка',bio:'Мелодии большого города и песни для вечерних выступлений.',color:'#8767df'},{id:'luna',name:'Luna North',genre:'Поп · Лирика',bio:'Атмосферные мелодии и тихие истории.',color:'#368fa1'},{id:'neon',name:'Neon Waves',genre:'Рок · Поп',bio:'Гитарная энергия и песни для компании.',color:'#c36593'},{id:'mira',name:'MIRA',genre:'Лирика · Поп',bio:'Тёплые мелодии и спокойное звучание.',color:'#c19459'}];
export const lyrics=['Ночь зажигает огни','Мы растворяемся в небе','Там, где звучат наши песни','Там, где никто не один','Свет отражается в окнах','Город зовёт нас с собой','Слышишь, как сердце бьётся','Этот момент только твой','Дальше по улицам света','Вместе встречаем рассвет','Снова звучит эта песня','И растворяется след'].map((text,i)=>({text,startMs:i*8000,endMs:(i+1)*8000}));
export const defaults={music:100,vocals:15};
export function clampVolume(n){return Math.max(0,Math.min(100,Number.isFinite(n)?n:0))}
export function activeLine(ms){return Math.max(0,Math.min(lyrics.length-1,Math.floor(ms/8000)))}
export function searchTracks(q){const s=q.trim().toLocaleLowerCase('ru');return tracks.filter(t=>(t.title+' '+t.artist+' '+t.genre).toLocaleLowerCase('ru').includes(s)||(t.id==='city'&&lyrics.some(l=>l.text.toLocaleLowerCase('ru').includes(s))))}
export function formatTime(seconds){const n=Math.max(0,Math.floor(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
export function parseRoute(hash){const [page,id]=hash.replace(/^#\/?/,'').split('/');return {page:['home','search','favorites','profile','history','settings','collection','track','artist','player','prepare'].includes(page)?page:'home',id:(()=>{try{return decodeURIComponent(id||'')}catch{return ''}})()}}
