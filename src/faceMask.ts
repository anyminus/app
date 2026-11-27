import {eyeGeometry,smoothEyes} from './faceMaskGeometry.mjs';
export type MaskStatus='loading'|'searching'|'eyes'|'face'|'error';
type Eyes=number[];
type Detection={points:Eyes|null;quality:string};
export type FaceMask={draw:(ctx:CanvasRenderingContext2D,video:HTMLVideoElement,w:number,h:number,now:number)=>void;dispose:()=>void};
export function createFaceMask(status:(value:MaskStatus)=>void):FaceMask{
 let worker:Worker|null=null,ready=false,busy=false,disposed=false,lastSent=-Infinity,lastValid=-Infinity,points:Eyes|null=null,display:Eyes|null=null;
 let scratch:HTMLCanvasElement|null=null,read:CanvasRenderingContext2D|null=null;
 let loadTimer:number|undefined,frameTimer:number|undefined;
 let local:((rgba:Uint8ClampedArray,w:number,h:number)=>Detection)|null=null,attemptedFallback=false,currentStatus:MaskStatus='loading';
 const urls={face:new URL('face-models/facefinder.bin',document.baseURI).href,eyes:new URL('face-models/puploc.bin',document.baseURI).href};
 function report(next:MaskStatus){if(next!==currentStatus){currentStatus=next;status(next);}}
 function stopWorker(){clearTimeout(loadTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;busy=false;}
 function dispose(){if(disposed)return;disposed=true;stopWorker();points=null;display=null;scratch=null;read=null;local=null;}
 function fail(){if(disposed)return;dispose();report('error');}
 function accept(result:Detection){
  clearTimeout(frameTimer);busy=false;
  const next=smoothEyes(null,result.points);
  if(next){points=next;lastValid=performance.now();report(result.quality==='eyes'?'eyes':'face');}
  else if(!points||performance.now()-lastValid>550){points=null;display=null;report('searching');}
 }
 async function fallback(){
  if(disposed||attemptedFallback)return;attemptedFallback=true;stopWorker();ready=false;report('loading');
  try{
   const {createDetector}=await import('./faceMaskDetector.mjs');
   const detect=await createDetector(urls.face,urls.eyes);
   if(disposed)return;local=detect;ready=true;report('searching');
  }catch{fail();}
 }
 try{
  status('loading');
  scratch=document.createElement('canvas');read=scratch.getContext('2d',{willReadFrequently:true});
  if(!read)throw Error('Canvas unavailable');
  try{
   worker=new Worker(new URL('./faceMask.worker.mjs',import.meta.url),{type:'module'});
   worker.onerror=()=>void fallback();worker.onmessageerror=()=>void fallback();
   worker.onmessage=({data})=>{
    if(disposed||!worker)return;
    if(data.kind==='ready'){clearTimeout(loadTimer);ready=true;report('searching');}
    else if(data.kind==='result')accept(data);
    else if(data.kind==='error')void fallback();
   };
   loadTimer=window.setTimeout(()=>void fallback(),12000);
   worker.postMessage({kind:'init',...urls});
  }catch{void fallback();}
 }catch{fail();}
 return {dispose,draw(ctx,video,w,h,now){
  if(disposed||!ready||!scratch||!read)return;
  if(!busy&&now-lastSent>=(local?250:120)&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){
   try{
    const scale=Math.min(1,(local?320:480)/Math.max(video.videoWidth,video.videoHeight));
    const sw=Math.max(2,Math.round(video.videoWidth*scale)),sh=Math.max(2,Math.round(video.videoHeight*scale));
    if(scratch.width!==sw||scratch.height!==sh){scratch.width=sw;scratch.height=sh;points=null;display=null;}
    read.drawImage(video,0,0,sw,sh);
    const rgba=read.getImageData(0,0,sw,sh).data;
    busy=true;lastSent=now;
    if(local)accept(local(rgba,sw,sh));
    else if(worker){frameTimer=window.setTimeout(()=>void fallback(),3000);worker.postMessage({kind:'frame',width:sw,height:sh,pixels:rgba.buffer,at:now},[rgba.buffer]);}
    else busy=false;
   }catch{if(local)fail();else void fallback();return;}
  }
  if(!points||performance.now()-lastValid>650){display=null;if(ready)report('searching');return;}
  display=smoothEyes(display,points,.48);
  const g=eyeGeometry(display,w,h);if(!g)return;
  ctx.save();
  ctx.font='bold '+Math.round(g.size)+'px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#d8b4fe';ctx.strokeStyle='#30154b';ctx.lineWidth=Math.max(2,g.size*.075);ctx.lineJoin='round';
  for(const [x,y] of [[g.x1,g.y1],[g.x2,g.y2]]){ctx.save();ctx.translate(x,y);ctx.rotate(g.angle);ctx.strokeText('♪',0,0);ctx.fillText('♪',0,0);ctx.restore();}
  ctx.restore();
 }};
}
