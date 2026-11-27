import {eyeGeometry,smoothEyes} from './faceMaskGeometry.mjs';
export type MaskStatus='loading'|'ready'|'error';
type Eyes=number[];
export type FaceMask={draw:(ctx:CanvasRenderingContext2D,video:HTMLVideoElement,w:number,h:number,now:number)=>void;dispose:()=>void};
export function createFaceMask(status:(value:MaskStatus)=>void):FaceMask{
 let worker:Worker|null=null,ready=false,busy=false,disposed=false,lastSent=-Infinity,lastResult=-Infinity,points:Eyes|null=null,display:Eyes|null=null;
 let scratch:HTMLCanvasElement|null=null,read:CanvasRenderingContext2D|null=null;
 let loadTimer:number|undefined,frameTimer:number|undefined;
 function dispose(){if(disposed)return;disposed=true;clearTimeout(loadTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;points=null;display=null;scratch=null;read=null;}
 function fail(){if(disposed)return;dispose();status('error');}
 try{
  status('loading');
  scratch=document.createElement('canvas');read=scratch.getContext('2d',{willReadFrequently:true});
  if(!read)throw Error('Canvas unavailable');
  worker=new Worker(new URL('./faceMask.worker.mjs',import.meta.url),{type:'module'});
  worker.onerror=fail;worker.onmessageerror=fail;
  worker.onmessage=({data})=>{
   if(disposed)return;
   if(data.kind==='ready'){clearTimeout(loadTimer);ready=true;status('ready');}
   else if(data.kind==='result'){clearTimeout(frameTimer);busy=false;lastResult=data.at;points=smoothEyes(null,data.points);if(!points)display=null;}
   else if(data.kind==='error')fail();
  };
  loadTimer=window.setTimeout(fail,15000);
  worker.postMessage({kind:'init',face:new URL('face-models/facefinder.bin',document.baseURI).href,eyes:new URL('face-models/puploc.bin',document.baseURI).href});
 }catch{fail();}
 return {dispose,draw(ctx,video,w,h,now){
  if(disposed||!ready||!scratch||!read||!worker)return;
  if(!busy&&now-lastSent>=100&&video.readyState>=2){
   try{
    const scale=Math.min(1,320/Math.max(video.videoWidth,video.videoHeight));
    const sw=Math.max(2,Math.round(video.videoWidth*scale)),sh=Math.max(2,Math.round(video.videoHeight*scale));
    if(scratch.width!==sw||scratch.height!==sh){scratch.width=sw;scratch.height=sh;points=null;display=null;}
    read.drawImage(video,0,0,sw,sh);
    const pixels=read.getImageData(0,0,sw,sh).data.buffer;
    busy=true;lastSent=now;frameTimer=window.setTimeout(fail,2000);
    worker.postMessage({kind:'frame',width:sw,height:sh,pixels,at:now},[pixels]);
   }catch{fail();return;}
  }
  if(!points||now-lastResult>450){display=null;return;}
  display=smoothEyes(display,points,.45);
  const g=eyeGeometry(display,w,h);if(!g)return;
  ctx.save();
  ctx.font='bold '+Math.round(g.size)+'px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#d8b4fe';ctx.strokeStyle='#30154b';ctx.lineWidth=Math.max(2,g.size*.075);ctx.lineJoin='round';
  for(const [x,y] of [[g.x1,g.y1],[g.x2,g.y2]]){
   ctx.save();ctx.translate(x,y);ctx.rotate(g.angle);ctx.strokeText('♪',0,0);ctx.fillText('♪',0,0);ctx.restore();
  }
  ctx.restore();
 }};
}
