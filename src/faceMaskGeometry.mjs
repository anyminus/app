// Normalized camera coordinates are shared by the preview and recorded canvas.
export function smoothEyes(previous,next,alpha=.45){
 if(!Array.isArray(next)||next.length!==4||!next.every(v=>Number.isFinite(v)&&v>=0&&v<=1))return null;
 return previous?next.map((v,i)=>previous[i]+(v-previous[i])*alpha):next.slice();
}
export function eyeGeometry(points,width,height){
 if(!points||width<=0||height<=0)return null;
 const [x1,y1,x2,y2]=points.map((v,i)=>v*(i%2?height:width));
 const distance=Math.hypot(x2-x1,y2-y1);
 if(distance<2)return null;
 return {x1,y1,x2,y2,angle:Math.atan2(y2-y1,x2-x1),size:Math.min(Math.min(width,height)*.24,distance*.7)};
}
