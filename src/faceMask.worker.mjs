import pico from './vendor/pico.mjs';
import lploc from './vendor/lploc.mjs';
let classify,localize;
async function load(url,size){
 const response=await fetch(url);
 if(!response.ok)throw Error('Model unavailable');
 const bytes=new Int8Array(await response.arrayBuffer());
 if(bytes.length!==size)throw Error('Invalid model size');
 return bytes;
}
self.onmessage=async ({data})=>{
 try{
  if(data.kind==='init'){
   const [face,eyes]=await Promise.all([load(data.face,239632),load(data.eyes,1228416)]);
   classify=pico.unpack_cascade(face);localize=lploc.unpack_localizer(eyes);
   self.postMessage({kind:'ready'});return;
  }
  if(data.kind!=='frame'||!classify||!localize)return;
  const {width:w,height:h,pixels,at}=data;
  const rgba=new Uint8ClampedArray(pixels),gray=new Uint8Array(w*h);
  for(let i=0,j=0;i<gray.length;i++,j+=4)gray[i]=(2*rgba[j]+7*rgba[j+1]+rgba[j+2])/10;
  const image={pixels:gray,nrows:h,ncols:w,ldim:w};
  const detections=pico.cluster_detections(pico.run_cascade(image,classify,{shiftfactor:.12,minsize:Math.max(36,Math.min(w,h)*.22),maxsize:Math.min(w,h),scalefactor:1.12}),.2);
  const face=detections.filter(d=>d[3]>25).sort((a,b)=>b[2]-a[2])[0];
  let points=null;
  if(face){
   const [r,c,s]=face;
   const left=localize(r-.075*s,c-.175*s,.35*s,9,image);
   const right=localize(r-.075*s,c+.175*s,.35*s,9,image);
   const span=Math.hypot(right[1]-left[1],right[0]-left[0]);
   if([...left,...right].every(Number.isFinite)&&left[1]>=0&&right[1]<w&&left[0]>=0&&right[0]>=0&&left[0]<h&&right[0]<h&&right[1]>left[1]&&span>.17*s&&span<.65*s&&Math.abs(right[0]-left[0])<.35*s)
    points=[left[1]/w,left[0]/h,right[1]/w,right[0]/h];
  }
  self.postMessage({kind:'result',points,at});
 }catch{self.postMessage({kind:'error'});}
};
