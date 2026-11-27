import {classicVideoTemplate,type VideoTemplate} from './videoTemplate';
export type VideoMetadata={title:string;artist:string};
export type TimedLine={text:string;startMs:number;endMs:number|null};

export function overlaySupported(){return typeof HTMLCanvasElement!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function';}

function wrap(ctx:CanvasRenderingContext2D,text:string,width:number){
 const rows:string[]=[];let row='';
 for(const word of text.trim().split(/\s+/u)){
  if(!word)continue;
  if(row&&ctx.measureText(row+' '+word).width>width){rows.push(row);row='';}
  if(ctx.measureText(word).width>width){for(const letter of Array.from(word)){if(row&&ctx.measureText(row+letter).width>width){rows.push(row);row='';}row+=letter;}}
  else row+=(row?' ':'')+word;
 }
 if(row)rows.push(row);return rows;
}
function layout(ctx:CanvasRenderingContext2D,text:string,width:number,base:number,weight:number,fontFamily:string){
 let size=base,rows:string[]=[];
 for(;size>=Math.floor(base*.65);size--){ctx.font=weight+' '+size+'px '+fontFamily;rows=wrap(ctx,text,width);if(rows.length<=2)break;}
 if(rows.length>2){rows=rows.slice(0,2);while(rows[1]&&ctx.measureText(rows[1]+'…').width>width)rows[1]=rows[1].slice(0,-1);rows[1]+='…';}
 return {size:Math.max(size,Math.floor(base*.65)),rows,weight};
}
type Motion={lines:readonly TimedLine[];index:number;previous:number;started:number;revision:number;seconds:number;now:number};
const motionByCanvas=new WeakMap<HTMLCanvasElement,Motion>();
const layoutsByCanvas=new WeakMap<HTMLCanvasElement,Map<string,ReturnType<typeof layout>>>();
const labelsByCanvas=new WeakMap<HTMLCanvasElement,Map<string,string>>();
function cached<K,V>(cache:Map<K,V>,key:K,compute:()=>V){const hit=cache.get(key);if(hit!==undefined)return hit;const value=compute();if(cache.size>=256){const first=cache.keys().next();if(!first.done)cache.delete(first.value);}cache.set(key,value);return value;}
export function resetVideoMotion(canvas:HTMLCanvasElement|null){if(canvas){motionByCanvas.delete(canvas);layoutsByCanvas.delete(canvas);labelsByCanvas.delete(canvas);}}
function blendColor(a:string,b:string,t:number){if(!/^#[0-9a-f]{6}$/i.test(a)||!/^#[0-9a-f]{6}$/i.test(b))return t<.5?a:b;const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return 'rgb('+[16,8,0].map(shift=>Math.round(((x>>shift)&255)*(1-t)+((y>>shift)&255)*t)).join(',')+')';}
export function drawKaraokeFrame(canvas:HTMLCanvasElement,video:HTMLVideoElement,lines:readonly TimedLine[],seconds:number,metadata:VideoMetadata,template:VideoTemplate=classicVideoTemplate,revision=0,now=performance.now(),animate=true){
 if(video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
 const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
 const w=Math.max(2,Math.round(video.videoWidth*scale/2)*2),h=Math.max(2,Math.round(video.videoHeight*scale/2)*2);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;resetVideoMotion(canvas);}
 const context=canvas.getContext('2d');if(!context)return false;const ctx:CanvasRenderingContext2D=context;
 ctx.drawImage(video,0,0,w,h);
 let index=-1;for(let i=0;i<lines.length&&lines[i].startMs<=seconds*1000;i++)index=i;
 let motion=motionByCanvas.get(canvas);
 const duration=Math.max(0,template.lyrics.transitionMs);
 if(!motion||motion.lines!==lines||motion.revision!==revision||seconds<motion.seconds-.05||seconds-motion.seconds>Math.max(.25,(now-motion.now)/1000*2.5+.15)||!animate||duration===0){
  motion={lines,index,previous:index,started:now,revision,seconds,now};motionByCanvas.set(canvas,motion);
 }else if(motion.index!==index){motion.previous=index===motion.index+1?motion.index:index;motion.index=index;motion.started=now;}
 motion.seconds=seconds;motion.now=now;
 const elapsed=Math.min(1,Math.max(0,(now-motion.started)/Math.max(1,duration)));
 const progress=motion.previous===index?1:elapsed*elapsed*(3-2*elapsed);
 if(progress===1)motion.previous=index;
 const unit=Math.min(w,h),margin=Math.max(1,Math.round(unit*template.margin)),gap=Math.max(1,Math.round(unit*template.gap)),width=Math.max(1,w-margin*2);
 const layouts=layoutsByCanvas.get(canvas)??new Map<string,ReturnType<typeof layout>>();layoutsByCanvas.set(canvas,layouts);
 const labels=labelsByCanvas.get(canvas)??new Map<string,string>();labelsByCanvas.set(canvas,labels);
 const font=(weight:number,size:number)=>weight+' '+size+'px '+template.fontFamily;
 const x=(align:CanvasTextAlign)=>align==='left'?margin:align==='right'?w-margin:w/2;
 function singleLine(text:string,size:number,weight:number,color:string,align:CanvasTextAlign,y:number){
  ctx.font=font(weight,size);ctx.textAlign=align;ctx.textBaseline='top';ctx.fillStyle=color;
  const value=cached(labels,JSON.stringify([text,width,ctx.font]),()=>{let value=text.trim().replace(/\s+/gu,' ');if(ctx.measureText(value).width>width){const chars=Array.from(value);while(chars.length&&ctx.measureText(chars.join('')+'…').width>width)chars.pop();value=chars.join('')+'…';}return value;});
  if(value)ctx.fillText(value,x(align),y,width);
 }
 const titleSize=Math.max(1,Math.round(unit*template.header.titleSize)),artistSize=Math.max(1,Math.round(unit*template.header.artistSize)),markSize=Math.max(1,Math.round(unit*template.watermark.size));
 const headerTop=Math.max(margin,h*template.header.safeTop);
 const headerEnd=headerTop+titleSize*1.25+artistSize*1.25+gap+margin;
 const headerShade=ctx.createLinearGradient(0,0,0,headerEnd+margin);headerShade.addColorStop(0,'rgba(0,0,0,'+template.header.shadeOpacity+')');headerShade.addColorStop(Math.min(.8,headerTop/(headerEnd+margin)),'rgba(0,0,0,'+template.header.shadeOpacity+')');headerShade.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=headerShade;ctx.fillRect(0,0,w,headerEnd+margin);
 singleLine(metadata.title,titleSize,750,template.header.titleColor,template.header.align,headerTop);
 singleLine(metadata.artist,artistSize,500,template.header.artistColor,template.header.align,headerTop+titleSize*1.25+gap/2);
 const markY=h-margin-markSize*1.2,bottom=Math.min(markY-gap,h*(1-template.lyrics.safeBottom));
 const activeSize=Math.max(1,Math.round(unit*template.lyrics.currentSize)),nextSize=Math.max(1,Math.round(unit*template.lyrics.nextSize));
 const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
 const line=(i:number,size:number,weight:number)=>{
  const text=lines[i]?.text??'',px=Math.max(1,Math.round(size)),bold=Math.round(weight/50)*50;
  return cached(layouts,JSON.stringify([text,width,px,bold,template.fontFamily]),()=>layout(ctx,text,width,px,bold,template.fontFamily));
 };
 const height=(item:ReturnType<typeof layout>)=>item.rows.length*item.size*1.24;
 // Compact drum spacing for single lines; preserve clearance for wrapped rows.
 const nominalStep=(activeSize+nextSize)*1.24+gap;
 const minimumStep=(a:ReturnType<typeof layout>,b:ReturnType<typeof layout>)=>(height(a)+height(b))/2+gap*.6;
 const pairStep=(a:ReturnType<typeof layout>,b:ReturnType<typeof layout>)=>Math.max(nominalStep*template.lyrics.spacingScale,minimumStep(a,b));
 const currentLine=line(index,activeSize,750),nextLine=line(index+1,nextSize,550);
 const previousLine=line(index-1,activeSize,750),previousNext=line(index,nextSize,550);
 const step=pairStep(currentLine,nextLine),oldStep=pairStep(previousLine,previousNext);
 const nextCenter=bottom-nextSize*1.24,activeCenter=nextCenter-step;
 const clipTop=Math.max(headerEnd,nextCenter-Math.max(step,progress<1?oldStep:step)-activeSize*1.24-gap);
 const clipBottom=Math.min(markY-gap,bottom+gap);
 const shadeStart=Math.max(0,clipTop-margin*2);
 const shade=ctx.createLinearGradient(0,shadeStart,0,h);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.4,'rgba(0,0,0,.65)');shade.addColorStop(1,'rgba(0,0,0,'+template.lyrics.shadeOpacity+')');
 ctx.fillStyle=shade;ctx.fillRect(0,shadeStart,w,h);
 ctx.save();ctx.beginPath();ctx.rect(0,clipTop,w,Math.max(0,clipBottom-clipTop));ctx.clip();
 ctx.textAlign=template.lyrics.align;ctx.textBaseline='top';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=Math.max(1,unit*.004);
 function paint(item:ReturnType<typeof layout>,color:string,center:number,alpha:number){
  if(alpha<=0||!item.rows.length)return;
  const fade=Math.min(1,Math.max(0,(center-clipTop)/(activeSize*1.24)),Math.max(0,(clipBottom-center)/(nextSize*1.24)));
  ctx.globalAlpha=alpha*fade;ctx.font=font(item.weight,item.size);ctx.fillStyle=color;
  let y=center-height(item)/2;for(const row of item.rows){ctx.fillText(row,x(template.lyrics.align),y,width);y+=item.size*1.24;}
 }
 if(progress<1){
  const outgoing=line(index-1,lerp(activeSize,nextSize,progress),lerp(750,550,progress));
  const incoming=line(index,lerp(nextSize,activeSize,progress),lerp(550,750,progress));
  const center=nextCenter-step*progress;
  const outgoingCenter=Math.min(nextCenter-oldStep-step*progress,center-minimumStep(outgoing,incoming));
  const nextEnteringCenter=Math.max(nextCenter+step*(1-progress),center+minimumStep(incoming,nextLine));
  paint(outgoing,blendColor(template.lyrics.currentColor,template.lyrics.nextColor,progress),outgoingCenter,1-progress);
  paint(incoming,blendColor(template.lyrics.nextColor,template.lyrics.currentColor,progress),center,lerp(template.lyrics.nextOpacity,1,progress));
  paint(nextLine,template.lyrics.nextColor,nextEnteringCenter,template.lyrics.nextOpacity*progress);
 }else{
  paint(currentLine,template.lyrics.currentColor,activeCenter,1);
  paint(nextLine,template.lyrics.nextColor,nextCenter,template.lyrics.nextOpacity);
 }
 ctx.restore();
 singleLine(template.watermark.text,markSize,650,template.watermark.color,template.watermark.align,markY);
 return true;
}
