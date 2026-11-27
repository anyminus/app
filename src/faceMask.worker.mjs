import {createDetector} from './faceMaskDetector.mjs';
let detect;
self.onmessage=async ({data})=>{
 try{
  if(data.kind==='init'){detect=await createDetector(data.face,data.eyes);self.postMessage({kind:'ready'});return;}
  if(data.kind!=='frame'||!detect)return;
  const {width,height,pixels,at}=data;
  self.postMessage({kind:'result',...detect(new Uint8ClampedArray(pixels),width,height),at});
 }catch(e){self.postMessage({kind:'error',message:e instanceof Error?e.message:String(e)});}
};
