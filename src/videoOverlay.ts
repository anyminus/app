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
function layout(ctx:CanvasRenderingContext2D,text:string,width:number,base:number,weight:number){
 let size=base,rows:string[]=[];
 for(;size>=Math.floor(base*.65);size--){ctx.font=weight+' '+size+'px system-ui, sans-serif';rows=wrap(ctx,text,width);if(rows.length<=2)break;}
 if(rows.length>2){rows=rows.slice(0,2);while(rows[1]&&ctx.measureText(rows[1]+'…').width>width)rows[1]=rows[1].slice(0,-1);rows[1]+='…';}
 return {size:Math.max(size,Math.floor(base*.65)),rows,weight};
}
export function drawKaraokeFrame(canvas:HTMLCanvasElement,video:HTMLVideoElement,lines:readonly TimedLine[],seconds:number){
 if(video.readyState<2||!video.videoWidth||!video.videoHeight)return false;
 const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
 const w=Math.max(2,Math.round(video.videoWidth*scale/2)*2),h=Math.max(2,Math.round(video.videoHeight*scale/2)*2);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return false;
 ctx.drawImage(video,0,0,w,h);
 let index=-1;for(let i=0;i<lines.length&&lines[i].startMs<=seconds*1000;i++)index=i;
 const current=lines[index]?.text??'',next=lines[index+1]?.text??'';
 if(!current&&!next)return true;
 const unit=Math.min(w,h),margin=Math.round(unit*.045),gap=Math.round(unit*.016),width=w-margin*2;
 const a=layout(ctx,current,width,Math.round(unit*.055),750),b=layout(ctx,next,width,Math.round(unit*.042),550);
 const aStep=a.size*1.23,bStep=b.size*1.24,total=a.rows.length*aStep+b.rows.length*bStep+(a.rows.length&&b.rows.length?gap:0);
 const bottom=h-margin,top=bottom-total-margin;
 const shade=ctx.createLinearGradient(0,Math.max(0,top-margin*2),0,h);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.4,'rgba(0,0,0,.65)');shade.addColorStop(1,'rgba(0,0,0,.88)');
 ctx.fillStyle=shade;ctx.fillRect(0,Math.max(0,top-margin*2),w,h);
 ctx.textAlign='center';ctx.textBaseline='top';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=Math.max(1,unit*.006);
 let y=bottom-total;
 function paint(item:typeof a,color:string,step:number){ctx.font=item.weight+' '+item.size+'px system-ui, sans-serif';ctx.fillStyle=color;for(const row of item.rows){ctx.fillText(row,w/2,y,width);y+=step;}}
 paint(a,'#e2caff',aStep);if(a.rows.length&&b.rows.length)y+=gap;paint(b,'#ffffff',bStep);ctx.shadowBlur=0;
 return true;
}
