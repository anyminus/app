import {test,expect} from '@playwright/test';
import {mockApi} from './fixture';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['camera','microphone']});
test('Pico detects real face and draws notes on captured canvas',async({page,request})=>{
 test.setTimeout(60000);
 const image=await request.get('https://raw.githubusercontent.com/nenadmarkus/picojs/afffa50ec4134a47005f2cbf8112eaa69f65f37e/examples/img.jpg');
 expect(image.ok()).toBeTruthy();
 const src='data:image/jpeg;base64,'+(await image.body()).toString('base64');
 await page.addInitScript(src=>{
  const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const text=CanvasRenderingContext2D.prototype.fillText,capture=HTMLCanvasElement.prototype.captureStream,start=MediaRecorder.prototype.start;
  let recorded:MediaStreamTrack|null=null,recording=false;
  Reflect.set(window,'__maskPreviewNotes',0);Reflect.set(window,'__maskRecordNotes',0);
  HTMLCanvasElement.prototype.captureStream=function(rate?:number){const s=capture.call(this,rate);if(this.classList.contains('video-overlay'))recorded=s.getVideoTracks()[0];return s;};
  MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){if(this.stream.getVideoTracks()[0]===recorded)recording=true;return start.apply(this,args);};
  CanvasRenderingContext2D.prototype.fillText=function(...args:Parameters<CanvasRenderingContext2D['fillText']>){if(this.canvas.classList.contains('video-overlay')&&args[0]==='♪'){const key=recording?'__maskRecordNotes':'__maskPreviewNotes';Reflect.set(window,key,Number(Reflect.get(window,key))+1);}return text.apply(this,args);};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(constraints:MediaStreamConstraints)=>{
   if(!constraints.video)return native(constraints);
   const audio=await native({audio:constraints.audio||true,video:false});
   const img=new Image();img.src=src;await img.decode();
   const cv=document.createElement('canvas');cv.width=480;cv.height=640;
   const ctx=cv.getContext('2d')!;const draw=()=>ctx.drawImage(img,60,0,360,360,0,80,480,480);
   draw();const stream=capture.call(cv,15);const track=stream.getVideoTracks()[0];const timer=setInterval(()=>{if(track.readyState==='ended')clearInterval(timer);else draw();},66);
   return new MediaStream([track,...audio.getAudioTracks()]);
  }});
 },src);
 await mockApi(page);await page.goto('/#/track/101');await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled();
 await page.getByRole('button',{name:/Записать видео/}).click();const mask=page.getByRole('checkbox',{name:/Маска: ноты/});await expect(mask).toBeChecked();
 await expect(page.locator('[data-mask-state]')).toHaveAttribute('data-mask-state',/eyes|face/,{timeout:25000});
 await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'__maskPreviewNotes')))).toBeGreaterThan(1);
 await mask.uncheck();await expect(mask).not.toBeChecked();await expect(page.locator('[data-mask-state]')).toHaveCount(0);
 await page.waitForTimeout(150);const before=await page.evaluate(()=>Number(Reflect.get(window,'__maskPreviewNotes')));await page.waitForTimeout(250);expect(await page.evaluate(()=>Number(Reflect.get(window,'__maskPreviewNotes')))).toBe(before);
 await mask.check();await expect(page.locator('[data-mask-state]')).toHaveAttribute('data-mask-state',/eyes|face/,{timeout:25000});
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Number(Reflect.get(window,'__maskRecordNotes'))),{timeout:5000}).toBeGreaterThan(1);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
});
