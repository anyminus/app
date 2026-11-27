// Browser UI and OS accessibility magnification remain outside page control.
export function installZoomLock(){
 const prevent=(event:Event)=>{if(event.cancelable)event.preventDefault()};
 // Safari may ignore the viewport zoom cap; cancel its proprietary pinch events.
 for(const type of ['gesturestart','gesturechange','gestureend']){
  document.addEventListener(type,prevent,{capture:true,passive:false});
 }
 document.addEventListener('touchmove',event=>{
  if(event.touches.length>1)prevent(event);
 },{capture:true,passive:false});
 // Trackpad pinch is exposed as a modified wheel event in Chromium.
 document.addEventListener('wheel',event=>{
  if(event.ctrlKey||event.metaKey)prevent(event);
 },{capture:true,passive:false});
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&['+','=','-','0','Add','Subtract'].includes(event.key))prevent(event);
 },{capture:true});
}
