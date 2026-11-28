import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {CircleHelp,ChevronLeft,X} from 'lucide-react';
import {t as trUi} from './i18n.mjs';

const KEY='anyminus:player-coach-v1';
const COVER_KEY='anyminus:cover-background-coach-v1';
const STEPS=[
  {
    "id": "cover",
    "selector": ".karaoke-cover",
    "title": "Фон из обложки",
    "message": "Нажмите на обложку, чтобы изменить фон плеера."
  },
  {
    "id": "artist",
    "selector": ".karaoke-heading",
    "title": "Исполнитель",
    "message": "Нажмите на имя исполнителя, чтобы найти другие его песни."
  },
  {
    "id": "lyrics",
    "selector": ".karaoke-lyrics",
    "title": "Текст песни",
    "message": "Нажмите на строку, чтобы перейти к ней. Цифры показывают время до начала пения или следующего куплета."
  },
  {
    "id": "plain",
    "selector": ".karaoke-lyrics",
    "title": "Текст песни",
    "message": "Если текст без таймкодов, прокручивайте его вручную."
  },
  {
    "id": "transport",
    "selector": ".karaoke-transport",
    "title": "Управление воспроизведением",
    "message": "Запускайте и ставьте песню на паузу центральной кнопкой. Стрелки перемещают на 10 секунд."
  },
  {
    "id": "timeline",
    "selector": ".karaoke-timeline",
    "title": "Позиция песни",
    "message": "Передвигайте ползунок, чтобы перейти к любому моменту песни."
  },
  {
    "id": "mixer",
    "selector": ".karaoke-mix-tools .mixer",
    "title": "Микшер",
    "message": "Настройте громкость музыки и голоса артиста отдельно. Нажмите на иконку дорожки, чтобы выключить или вернуть её звук."
  },
  {
    "id": "pitch",
    "selector": ".karaoke-pitch:not(.karaoke-speed)",
    "title": "Тональность",
    "message": "Кнопками + и − подберите тональность под свой голос, не меняя скорость песни."
  },
  {
    "id": "speed",
    "selector": ".karaoke-speed",
    "title": "Скорость",
    "message": "Замедлите сложный фрагмент или ускорьте песню. Тональность при этом сохраняется."
  },
  {
    "id": "focus",
    "selector": ".transport-right .icon-button:last-child",
    "title": "Показать микшер",
    "message": "Нажмите на микрофон, чтобы скрыть микшер и оставить больше места для текста. Повторное нажатие вернёт настройки."
  },
  {
    "id": "favorite",
    "selector": ".transport-left .icon-button:nth-child(2)",
    "title": "Любимое",
    "message": "Нажмите на сердечко, чтобы добавить песню в любимое или убрать её оттуда."
  },
  {
    "id": "share",
    "selector": ".transport-left .icon-button:first-child",
    "title": "Поделиться песней",
    "message": "Отправьте другу ссылку на песню с текущими настройками плеера."
  },
  {
    "id": "video",
    "selector": ".video-karaoke-trigger",
    "title": "Записать видео",
    "message": "Запишите своё исполнение с камерой и микрофоном. Можно начать запись с текущего места песни."
  },
  {
    "id": "video-options",
    "selector": ".video-karaoke-trigger",
    "title": "Настройки звука",
    "message": "Перед записью можно включить маску из нот и текст на видео, настроить музыку, голос, эффекты и компенсацию задержки. Лучше использовать наушники."
  },
  {
    "id": "video-result",
    "selector": ".video-karaoke-trigger",
    "title": "Сохранить видео",
    "message": "После остановки записи можно просмотреть, сохранить или поделиться видео. Оно не отправляется на сервер."
  },
  {
    "id": "back",
    "selector": ".karaoke-header>.icon-button:first-child",
    "title": "Назад",
    "message": "Вернитесь к списку песен, чтобы выбрать следующее караоке."
  }
] as const;
type StepId=typeof STEPS[number]['id'];
type Saved={seen:StepId[];skipped:boolean};
let memory:Saved={seen:[],skipped:false};
function read():Saved{
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&Array.isArray(raw.seen))memory={seen:raw.seen.filter((id:unknown)=>STEPS.some(s=>s.id===id)),skipped:raw.skipped===true};
 if(localStorage.getItem(COVER_KEY)==='true'&&!memory.seen.includes('cover'))memory={...memory,seen:[...memory.seen,'cover']};
 }catch{/* storage is optional */}
 return memory;
}
function persist(value:Saved){memory=value;try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}}
type Props={ready:boolean;playing:boolean;recording:boolean;coverCoachVisible:boolean;hasCover:boolean;timed:boolean;plain:boolean;pitchAvailable:boolean;focus:boolean;ended:boolean};
type Geometry={left:number;top:number;width:number;maxHeight:number;helpTop:number;helpRight:number};
export function PlayerCoach({ready,playing,recording,coverCoachVisible,hasCover,timed,plain,pitchAvailable,focus,ended}:Props){
 const host=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null);
 const [saved,setSaved]=useState(read),[manual,setManual]=useState(false),[manualIndex,setManualIndex]=useState(0),[closed,setClosed]=useState(false);
 const [geometry,setGeometry]=useState<Geometry|null>(null),[targetAvailable,setTargetAvailable]=useState(false),[videoAvailable,setVideoAvailable]=useState(false);
 const eligible=ready&&!recording&&!ended;
 const steps=STEPS.filter(step=>step.id==='cover'?hasCover:step.id==='lyrics'?timed:step.id==='plain'?plain&&!timed:step.id==='mixer'?!focus:step.id==='pitch'||step.id==='speed'?pitchAvailable&&!focus:step.id.startsWith('video')?videoAvailable:true);
 const active=manual?steps[Math.min(manualIndex,steps.length-1)]:!saved.skipped&&!closed&&!playing&&!coverCoachVisible?steps.find(step=>step.id!=='cover'&&!saved.seen.includes(step.id)):undefined;
 const visible=eligible&&!!active&&!coverCoachVisible;
 function update(value:Saved){persist(value);setSaved(value)}
 function mark(id:StepId){if(!saved.seen.includes(id))update({...saved,seen:[...saved.seen,id]})}
 function next(){if(!active)return;mark(active.id);if(manual){if(manualIndex>=steps.length-1){setManual(false);setClosed(true)}else setManualIndex(n=>n+1)}}
 function close(){setManual(false);setClosed(true)}
 function skip(){update({...saved,skipped:true});close()}
 function restart(){setManualIndex(0);setManual(true);setClosed(false)}
 useLayoutEffect(()=>{
  if(!eligible)return;
  const root=host.current?.closest<HTMLElement>('.karaoke-screen');if(!root)return;
  const check=()=>{const button=root.querySelector<HTMLButtonElement>('.video-karaoke-trigger');setVideoAvailable(!!button&&!button.disabled)};
  check();const observer=new MutationObserver(check);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});return()=>observer.disconnect();
 },[eligible]);
 useLayoutEffect(()=>{
  if(!eligible)return;
  const root=host.current?.closest<HTMLElement>('.karaoke-screen');if(!root)return;
  const target=visible&&active?root.querySelector<HTMLElement>(active.selector):null;
  if(target)target.setAttribute('data-player-coach-target','true');
  setTargetAvailable(!!target);
  function measure(){
   if(!root)return;const r=root.getBoundingClientRect(),lyrics=root.querySelector('.karaoke-lyrics')?.getBoundingClientRect(),b=target?.getBoundingClientRect();
   if(!lyrics)return;
   const left=Math.max(8,lyrics.left-r.left),right=Math.min(r.width-8,lyrics.right-r.left),available=Math.max(0,right-left);
   const width=Math.min(available,320),height=Math.min(panel.current?.offsetHeight??150,Math.max(0,lyrics.height-8));
   const anchor=b?b.top-r.top:lyrics.top-r.top;
   const top=Math.max(lyrics.top-r.top+4,Math.min(lyrics.bottom-r.top-height-4,anchor-height-10));
   setGeometry({left:left+(available-width)/2,top,width,maxHeight:Math.max(0,lyrics.height-8),helpTop:lyrics.top-r.top+3,helpRight:r.right-lyrics.right+3});
  }
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(root);const lyrics=root.querySelector('.karaoke-lyrics');if(lyrics)observer?.observe(lyrics);if(panel.current)observer?.observe(panel.current);if(target)observer?.observe(target);
  window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);target?.removeAttribute('data-player-coach-target')};
 },[eligible,visible,active?.id,focus]);
 useEffect(()=>{if(recording||ended)setManual(false)},[recording,ended]);
 const index=active?steps.findIndex(step=>step.id===active.id):-1;
 const last=manual?index===steps.length-1:!steps.some(step=>step.id!=='cover'&&step.id!==active?.id&&!saved.seen.includes(step.id));
 return <div ref={host} className="player-coach-layer">
 {eligible&&geometry&&!coverCoachVisible&&!(visible&&targetAvailable)&&<button type="button" className="player-coach-help" aria-label={trUi('Подсказки плеера')} title={trUi('Подсказки плеера')} style={{top:geometry.helpTop,right:geometry.helpRight}} onClick={restart}><CircleHelp size={21}/></button>}
 {visible&&active&&geometry&&targetAvailable&&<aside ref={panel} className="player-coach-panel" aria-label={trUi('Подсказки плеера')} data-step={active.id} style={{left:geometry.left,top:geometry.top,width:geometry.width,maxHeight:geometry.maxHeight} as CSSProperties}>
 <div className="player-coach-heading"><span>{trUi('Подсказки плеера')} · {index+1}/{steps.length}</span><button type="button" aria-label={trUi('Закрыть подсказки')} onClick={close}><X size={18}/></button></div>
 <strong>{trUi(active.title)}</strong><p role="status">{trUi(active.message)}</p>
 <div className="player-coach-actions">{manual&&index>0&&<button type="button" aria-label={trUi('Предыдущая подсказка')} onClick={()=>setManualIndex(n=>n-1)}><ChevronLeft size={20}/></button>}<button type="button" onClick={skip}>{trUi('Пропустить обучение')}</button><button type="button" className="player-coach-next" onClick={next}>{trUi(last?'Завершить обучение':'Далее')}</button></div>
 </aside>}
 </div>
}
