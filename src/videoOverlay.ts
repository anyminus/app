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
export function drawKaraokeFrame(canvas:HTMLCanvasElement,video:HTMLVideoElement,lines:readonly TimedLine[],seconds:number,metadata:VideoMetadata,template:VideoTemplate=classicVideoTemplate){
 if(video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
 const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
 const w=Math.max(2,Math.round(video.videoWidth*scale/2)*2),h=Math.max(2,Math.round(video.videoHeight*scale/2)*2);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const context=canvas.getContext('2d');if(!context)return false;const ctx:CanvasRenderingContext2D=context;
 ctx.drawImage(video,0,0,w,h);
 let index=-1;for(let i=0;i<lines.length&&lines[i].startMs<=seconds*1000;i++)index=i;
 const current=lines[index]?.text??'',next=lines[index+1]?.text??'';
 const unit=Math.min(w,h),margin=Math.max(1,Math.round(unit*template.margin)),gap=Math.max(1,Math.round(unit*template.gap)),width=Math.max(1,w-margin*2);
 const font=(weight:number,size:number)=>weight+' '+size+'px '+template.fontFamily;
 const x=(align:CanvasTextAlign)=>align==='left'?margin:align==='right'?w-margin:w/2;
 function singleLine(text:string,size:number,weight:number,color:string,align:CanvasTextAlign,y:number){
  ctx.font=font(weight,size);ctx.textAlign=align;ctx.textBaseline='top';ctx.fillStyle=color;
  let value=text.trim().replace(/\s+/gu,' ');if(ctx.measureText(value).width>width){const chars=Array.from(value);while(chars.length&&ctx.measureText(chars.join('')+'…').width>width)chars.pop();value=chars.join('')+'…';}
  if(value)ctx.fillText(value,x(align),y,width);
 }
 const titleSize=Math.max(1,Math.round(unit*template.header.titleSize)),artistSize=Math.max(1,Math.round(unit*template.header.artistSize)),markSize=Math.max(1,Math.round(unit*template.watermark.size));
 const headerEnd=margin+titleSize*1.25+artistSize*1.25+gap+margin;
 const headerShade=ctx.createLinearGradient(0,0,0,headerEnd+margin);headerShade.addColorStop(0,'rgba(0,0,0,'+template.header.shadeOpacity+')');headerShade.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=headerShade;ctx.fillRect(0,0,w,headerEnd+margin);
 singleLine(metadata.title,titleSize,750,template.header.titleColor,template.header.align,margin);
 singleLine(metadata.artist,artistSize,500,template.header.artistColor,template.header.align,margin+titleSize*1.25+gap/2);
 const a=layout(ctx,current,width,Math.max(1,Math.round(unit*template.lyrics.currentSize)),750,template.fontFamily),b=layout(ctx,next,width,Math.max(1,Math.round(unit*template.lyrics.nextSize)),550,template.fontFamily);
 const aStep=a.size*1.23,bStep=b.size*1.24,total=a.rows.length*aStep+b.rows.length*bStep+(a.rows.length&&b.rows.length?gap:0);
 const markY=h-margin-markSize*1.2,bottom=markY-gap,top=bottom-total-margin;
 const shade=ctx.createLinearGradient(0,Math.max(0,top-margin*2),0,h);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.4,'rgba(0,0,0,.65)');shade.addColorStop(1,'rgba(0,0,0,'+template.lyrics.shadeOpacity+')');
 ctx.fillStyle=shade;ctx.fillRect(0,Math.max(0,top-margin*2),w,h);
 ctx.textAlign=template.lyrics.align;ctx.textBaseline='top';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=Math.max(1,unit*.006);
 let y=bottom-total;
 function paint(item:typeof a,color:string,step:number){ctx.font=font(item.weight,item.size);ctx.fillStyle=color;for(const row of item.rows){ctx.fillText(row,x(template.lyrics.align),y,width);y+=step;}}
 paint(a,template.lyrics.currentColor,aStep);if(a.rows.length&&b.rows.length)y+=gap;paint(b,template.lyrics.nextColor,bStep);ctx.shadowBlur=0;
 singleLine(template.watermark.text,markSize,650,template.watermark.color,template.watermark.align,markY);
 return true;
}
