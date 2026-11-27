import pico from './vendor/pico.mjs';
import lploc from './vendor/lploc.mjs';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
async function load(url,size){
 const response=await fetch(url);
 if(!response.ok)throw Error('Model HTTP '+response.status);
 const bytes=new Int8Array(await response.arrayBuffer());
 if(bytes.length!==size)throw Error('Unexpected model size: '+bytes.length);
 return bytes;
}
export async function createDetector(faceUrl,eyeUrl){
 const classify=pico.unpack_cascade(await load(faceUrl,239632));
 let localize=null;
 try{localize=lploc.unpack_localizer(await load(eyeUrl,1228416));}catch{}
 let previous=null,misses=0;
 return function detect(rgba,w,h){
  const pad=Math.round(Math.min(w,h)*.28),pw=w+2*pad,ph=h+2*pad,gray=new Uint8Array(pw*ph);
  for(let y=0;y<ph;y++){
   const sy=clamp(y-pad,0,h-1);
   for(let x=0;x<pw;x++){
    const i=(sy*w+clamp(x-pad,0,w-1))*4;
    gray[y*pw+x]=(2*rgba[i]+7*rgba[i+1]+rgba[i+2])/10;
   }
  }
  const image={pixels:gray,nrows:ph,ncols:pw,ldim:pw},shortest=Math.min(w,h),maxsize=Math.min(pw,ph)*.98;
  function candidates(shiftfactor,scalefactor,minsize){
   return pico.cluster_detections(pico.run_cascade(image,classify,{shiftfactor,minsize,maxsize,scalefactor}),.2).filter(([r,c,s,q])=>q>4&&r>=pad&&r<pad+h&&c>=pad&&c<pad+w&&s>=shortest*.17);
  }
  let faces=candidates(.12,1.15,Math.max(28,shortest*.22));
  if(!faces.length)faces=candidates(.08,1.10,Math.max(24,shortest*.18));
  const score=d=>d[3]+(previous&&Math.hypot(d[0]-previous[0],d[1]-previous[1])<d[2]*.3?3:0);
  faces.sort((a,b)=>score(b)-score(a));
  const found=faces[0];
  if(!found){if(++misses>2)previous=null;return {points:null,quality:'searching'};}
  misses=0;previous=found;
  const [r,c,s]=found,anchorY=r-.075*s,anchorX=.175*s;
  let left=[anchorY,c-anchorX],right=[anchorY,c+anchorX],quality='face';
  if(localize)try{
   const a=localize(anchorY,c-anchorX,.35*s,15,image),b=localize(anchorY,c+anchorX,.35*s,15,image);
   const span=Math.hypot(b[1]-a[1],b[0]-a[0]);
   if([...a,...b].every(Number.isFinite)&&b[1]>a[1]&&span>.13*s&&span<.7*s&&Math.abs(b[0]-a[0])<.38*s&&Math.hypot(a[0]-anchorY,a[1]-(c-anchorX))<.27*s&&Math.hypot(b[0]-anchorY,b[1]-(c+anchorX))<.27*s){left=a;right=b;quality='eyes';}
  }catch{}
  const points=[(left[1]-pad)/w,(left[0]-pad)/h,(right[1]-pad)/w,(right[0]-pad)/h];
  if(!points.every(v=>Number.isFinite(v)&&v>=0&&v<=1))return {points:null,quality:'searching'};
  return {points,quality};
 };
}
