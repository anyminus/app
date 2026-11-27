import {test,expect} from '@playwright/test';
import {mockApi} from './fixture';
import {delayedClock,resolveDelay,type ClockSample,type AudioDiagnostics} from '../../src/recordingSync';
test.use({launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['camera','microphone']});
test('local video capture stays above lyrics and exports a file',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const api=await mockApi(page);
 await page.goto('/');
 await page.getByRole('button',{name:'Test song one',exact:true}).click();
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();
 const camera=page.getByLabel('Предпросмотр камеры');
 await expect(camera).toBeVisible();
 const top=await camera.boundingBox(),lyrics=await page.getByLabel('Текст песни',{exact:true}).boundingBox();
 expect(top).not.toBeNull();expect(lyrics).not.toBeNull();
 expect(top!.height).toBeLessThanOrEqual(100);expect(top!.y+top!.height).toBeLessThanOrEqual(lyrics!.y);
 const play=page.getByRole('button',{name:'Воспроизвести',exact:true});await expect(play).toBeEnabled();await play.click();
 await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled();
 await page.waitForTimeout(1300);
 await page.getByRole('button',{name:'Остановить',exact:true}).click();
 const save=page.getByRole('link',{name:'Сохранить видео'});
 await expect(save).toBeVisible();
 const href=await save.getAttribute('href');expect(href).toMatch(/^blob:/);
 expect(await page.evaluate(async u=>(await (await fetch(u!)).blob()).size,href)).toBeGreaterThan(1000);
 await expect(page.getByLabel('Предпросмотр камеры')).toHaveCount(0);
 expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});
test('camera denial restores ordinary playback',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{throw new DOMException('denied','NotAllowedError')}})});
 await mockApi(page);await page.goto('/');
 await page.getByRole('button',{name:'Test song one',exact:true}).click();
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();
 await expect(page.getByText('Разрешите доступ к камере и микрофону.')).toBeVisible();
 await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
});

test('video recording recovers after initial audio start fails',async({page})=>{
 await page.addInitScript(()=>{const original=AudioBufferSourceNode.prototype.start;let first=true;AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){if(first){first=false;throw new DOMException('Автовоспроизведение заблокировано','NotAllowedError')}return original.apply(this,args)}});
 const api=await mockApi(page);await page.goto('/');
 await page.getByRole('button',{name:'Test song one',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Автовоспроизведение заблокировано');
 await page.getByRole('button',{name:/Записать видео/}).click();
 await expect(page.getByLabel('Предпросмотр камеры')).toBeVisible();
 await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();
 await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 await page.waitForTimeout(1200);
 await page.getByRole('button',{name:'Пауза',exact:true}).click();
 await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
 expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

test('video recording survives timeline, lyric and ten-second jumps',async({page})=>{
 await page.addInitScript(()=>{const start=MediaRecorder.prototype.start,stop=MediaRecorder.prototype.stop;Reflect.set(window,'__videoStarts',0);Reflect.set(window,'__videoStops',0);MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){Reflect.set(window,'__videoStarts',Number(Reflect.get(window,'__videoStarts'))+1);return start.apply(this,args)};MediaRecorder.prototype.stop=function(){Reflect.set(window,'__videoStops',Number(Reflect.get(window,'__videoStops'))+1);return stop.call(this)}});
 await mockApi(page);
 const pair='00000000-0000-4000-8000-000000000001',duration=30,bytes=duration*48000,wav=Buffer.alloc(44+bytes);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
 for(let i=0;i<duration*24000;i++)wav.writeInt16LE(Math.round(8000*Math.sin(2*Math.PI*440*i/24000)),44+i*2);
 let media=0;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/playback$/,r=>r.request().method()==='OPTIONS'?r.fallback():r.fulfill({json:{pairOperationId:pair,durationSeconds:duration,instrumental:'/demo/catalog/media/'+pair+'/instrumental',vocals:'/demo/catalog/media/'+pair+'/vocals'},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/(instrumental|vocals)$/,r=>{media++;return r.fulfill({body:wav,contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}})});
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'First verse',startMs:0,endMs:5000,startOrigin:'source'},{text:'Second verse',startMs:5000,endMs:20000,startOrigin:'source'},{text:'Final verse',startMs:20000,endMs:29000,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();
 const slider=page.getByRole('slider',{name:'Позиция песни'}),second=page.getByRole('button',{name:'Second verse',exact:true}),rec=page.getByText('● REC',{exact:true});
 await expect(slider).toBeEnabled();await second.click();await expect(slider).toHaveValue('5');
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect.poll(async()=>await rec.isVisible()?'recording':(await page.locator('.video-karaoke-error,.karaoke-error').allTextContents()).join(' | ')||'starting',{timeout:10000}).toBe('recording');
 const position=async()=>Number(await slider.inputValue());
 await expect.poll(position).toBeGreaterThan(5);
 await page.getByRole('button',{name:'Вперёд 10 секунд',exact:true}).click();await expect.poll(position).toBeGreaterThan(15);
 await page.getByRole('button',{name:'Назад 10 секунд',exact:true}).click();await expect.poll(position).toBeLessThan(10);
 await slider.press('Home');await expect.poll(position).toBeLessThan(2);
 await second.click();await expect(second).toHaveAttribute('aria-current','true');await expect.poll(position).toBeGreaterThan(5);await expect(rec).toBeVisible();
 expect(await page.evaluate(()=>[Reflect.get(window,'__videoStarts'),Reflect.get(window,'__videoStops')])).toEqual([1,0]);
 await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
 expect(await page.evaluate(()=>[Reflect.get(window,'__videoStarts'),Reflect.get(window,'__videoStops')])).toEqual([1,1]);expect(media).toBe(2);
 await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeVisible();
});

test('timed lyrics are drawn into the captured video canvas and follow a seek',async({page})=>{
 await page.addInitScript(()=>{
  const draw=CanvasRenderingContext2D.prototype.fillText,capture=HTMLCanvasElement.prototype.captureStream,start=MediaRecorder.prototype.start;
  Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:8});Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(c:MediaStreamConstraints)=>{Reflect.set(window,'__videoRequest',c.video);const stream=await get(c);const video=stream.getVideoTracks()[0];const settings=video.getSettings.bind(video);Object.defineProperty(video,'getSettings',{value:()=>({...settings(),frameRate:30})});Object.defineProperty(video,'getCapabilities',{value:()=>({frameRate:{min:1,max:30}})});return stream}});
  Reflect.set(window,'__overlayText',[]);Reflect.set(window,'__overlayPositions',{});Reflect.set(window,'__overlayTrack',null);Reflect.set(window,'__recordedCanvas',false);
  CanvasRenderingContext2D.prototype.fillText=function(...args:Parameters<CanvasRenderingContext2D['fillText']>){if(this.canvas.classList.contains('video-overlay')){const rows=Reflect.get(window,'__overlayText') as string[];rows.push(args[0]);if(rows.length>150)rows.shift();const size=Number(this.font.match(/([0-9.]+)px/)?.[1]);if(args[0]==='Alpha'||args[0]==='Bravo'){Reflect.get(window,'__overlayPositions')[args[0]]={center:args[2]+size*1.24/2,unit:Math.min(this.canvas.width,this.canvas.height)};}}return draw.apply(this,args)};
  HTMLCanvasElement.prototype.captureStream=function(rate?:number){const stream=capture.call(this,rate);if(this.classList.contains('video-overlay')){Reflect.set(window,'__overlayTrack',stream.getVideoTracks()[0]);Reflect.set(window,'__captureRate',rate);}return stream;};
  MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){Reflect.set(window,'__recordedCanvas',this.stream.getVideoTracks()[0]===Reflect.get(window,'__overlayTrack'));return start.apply(this,args)};
 });
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'Alpha',startMs:0,endMs:3000,startOrigin:'source'},{text:'Bravo',startMs:3000,endMs:6000,startOrigin:'source'},{text:'Charlie',startMs:6000,endMs:7900,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Alpha',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();
 const checkbox=page.getByRole('checkbox',{name:'Текст на видео'});await expect(checkbox).toBeChecked();
 await checkbox.uncheck();await expect(page.locator('canvas.video-overlay')).not.toHaveClass(/visible/);await checkbox.check();await page.getByRole('button',{name:'Alpha',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__overlayText') as string[])).toEqual(expect.arrayContaining(['Alpha','Test song one','Test artist','AnyMinus']));
 await expect.poll(()=>page.evaluate(()=>{const p=Reflect.get(window,'__overlayPositions');if(!p.Alpha||!p.Bravo)return 100;const u=p.Alpha.unit;const nominal=(Math.round(u*.066)+Math.round(u*.0504))*1.24+Math.max(1,Math.round(u*.016));return Math.abs((p.Bravo.center-p.Alpha.center)/nominal-.6);})).toBeLessThan(.02);
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect.poll(async()=>await page.getByText('● REC',{exact:true}).isVisible()?'recording':(await page.locator('.video-karaoke-error,.karaoke-error').allTextContents()).join(' | ')||'starting',{timeout:10000}).toBe('recording');
 expect(await page.evaluate(()=>Reflect.get(window,'__recordedCanvas'))).toBe(true);
 expect(await page.evaluate(()=>Reflect.get(window,'__captureRate'))).toBe(30);
 expect(await page.evaluate(()=>Reflect.get(window,'__videoRequest').frameRate)).toEqual({ideal:30,max:30});
 await page.evaluate(()=>{(Reflect.get(window,'__overlayText') as string[]).length=0;});
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__overlayText') as string[])).toEqual(expect.arrayContaining(['Test song one','Test artist','AnyMinus']));
 await page.getByRole('button',{name:'Bravo',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__overlayText') as string[])).toContain('Charlie');
 await page.waitForTimeout(600);await page.getByRole('button',{name:'Остановить',exact:true}).click();const save=page.getByRole('link',{name:'Сохранить видео'});await expect(save).toBeVisible();
 expect(await page.evaluate(()=>(Reflect.get(window,'__overlayTrack') as MediaStreamTrack).readyState)).toBe('ended');const href=await save.getAttribute('href');expect(await page.evaluate(async u=>(await (await fetch(u!)).blob()).size,href)).toBeGreaterThan(1000);expect(api.media).toBe(2);
});

test('opening camera retains playing position and recording resumes both stems from that offset',async({page})=>{
 await page.addInitScript(()=>{const original=AudioBufferSourceNode.prototype.start;const offsets:number[]=[];Reflect.set(window,'__recordingOffsets',offsets);AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){offsets.push(args[1]??0);return original.apply(this,args)}});
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 const slider=page.getByRole('slider',{name:'Позиция песни'});const position=async()=>Number(await slider.inputValue());
 await expect.poll(position).toBeGreaterThan(1.5);
 const before=await position();await page.getByRole('button',{name:/Записать видео/}).click();
 await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();await expect(slider).toBeEnabled();
 const held=await position();expect(held).toBeGreaterThanOrEqual(before-.15);expect(held).toBeLessThan(before+1.5);
 await page.waitForTimeout(400);expect(await position()).toBe(held);
 const overlay=page.getByRole('checkbox',{name:'Текст на видео'});if(await overlay.isEnabled())await overlay.uncheck();
 await page.evaluate(()=>{(Reflect.get(window,'__recordingOffsets') as number[]).length=0;});
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 const offsets=await page.evaluate(()=>Reflect.get(window,'__recordingOffsets') as number[]);
 expect(offsets).toHaveLength(2);for(const offset of offsets)expect(Math.abs(offset-held)).toBeLessThan(.15);
 await expect.poll(position).toBeGreaterThan(held+.1);await page.getByRole('button',{name:'Остановить',exact:true}).click();
 await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();expect(api.media).toBe(2);
});

test('unsupported recorder leaves normal karaoke available without requesting camera',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'MediaRecorder',{configurable:true,value:undefined});Reflect.set(window,'__cameraCalls',0);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{Reflect.set(window,'__cameraCalls',1);throw Error('unexpected camera request')}})});
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();
 await expect(page.getByRole('button',{name:/Записать видео/})).toBeDisabled();
 await expect(page.getByText(/Ваш телефон или браузер не поддерживает видеокараоке/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>Reflect.get(window,'__cameraCalls'))).toBe(0);
});
test('Android camera fallback and raw recording when canvas is unsupported',async({page})=>{
 await page.addInitScript(()=>{
 Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Linux; Android 14) Chrome/134.0.0.0 Mobile Safari/537.36'});
 Object.defineProperty(HTMLCanvasElement.prototype,'captureStream',{configurable:true,value:undefined});
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);Reflect.set(window,'__cameraCalls',0);
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(c:MediaStreamConstraints)=>{const count=Number(Reflect.get(window,'__cameraCalls'))+1;Reflect.set(window,'__cameraCalls',count);if(count===1)throw new DOMException('unsupported constraints','OverconstrainedError');return get(c)}});
 const start=MediaRecorder.prototype.start;MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){Reflect.set(window,'__androidMime',this.mimeType);return start.apply(this,args)};
 });
 await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'Android line',startMs:0,endMs:5000,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Android line',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('checkbox',{name:'Текст на видео'})).toBeDisabled();await expect(page.getByText('Наложение не поддерживается',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'__cameraCalls'))).toBe(2);
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'__androidMime'))).toMatch(/video\/webm/);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
});

test('native Apple recording prefers MP4 and shares only the actual file with manual fallback',async({page})=>{
 await page.addInitScript(()=>{
 Object.defineProperty(navigator,'platform',{configurable:true,value:'iPhone'});
 const supports=MediaRecorder.isTypeSupported.bind(MediaRecorder);Reflect.set(window,'__codecAttempts',[]);
 MediaRecorder.isTypeSupported=(type:string)=>{(Reflect.get(window,'__codecAttempts') as string[]).push(type);return supports(type);};
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
 Object.defineProperty(navigator,'share',{configurable:true,value:(data:ShareData)=>{const file=data.files?.[0];Reflect.set(window,'__shareData',{keys:Object.keys(data),name:file?.name,type:file?.type,size:file?.size});return new Promise<void>((_,reject)=>{Reflect.set(window,'__rejectShare',()=>reject(new DOMException('Test failure','DataError')));});}});
 });
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();const overlay=page.getByRole('checkbox',{name:'Текст на видео'});if(await overlay.isEnabled())await overlay.uncheck();
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 expect((await page.evaluate(()=>Reflect.get(window,'__codecAttempts') as string[])).every(type=>type.startsWith('video/mp4'))).toBe(true);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();const save=page.getByRole('link',{name:'Сохранить видео'});await expect(save).toBeVisible();
 await page.getByRole('button',{name:'Поделиться',exact:true}).click();await expect(page.getByRole('button',{name:'Открыто меню отправки…'})).toBeDisabled();await expect(save).toBeVisible();
 const payload=await page.evaluate(()=>Reflect.get(window,'__shareData') as {keys:string[];name:string;type:string;size:number});
 expect(payload.keys).toEqual(['files']);expect(payload.type).toBe('video/mp4');expect(payload.name).toMatch(/^AnyMinus-\d+\.mp4$/);expect(payload.name.endsWith(payload.type.split('/')[1])).toBe(true);expect(payload.size).toBeGreaterThan(1000);
 await page.evaluate(()=>Reflect.get(window,'__rejectShare')());await expect(page.getByText('Не удалось передать файл. Сохраните видео и прикрепите его в мессенджере.')).toBeVisible();await expect(save).toBeVisible();await expect(page.getByRole('button',{name:'Поделиться',exact:true})).toBeEnabled();
});

test('iPhone without MP4 support never opens camera or falls back to WebM',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'platform',{configurable:true,value:'iPhone'});MediaRecorder.isTypeSupported=(type:string)=>type.startsWith('video/webm');Reflect.set(window,'__cameraCalls',0);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{Reflect.set(window,'__cameraCalls',1);throw Error('unexpected camera request')}})});
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();
 await expect(page.getByRole('button',{name:/Записать видео/})).toBeDisabled();await expect(page.getByText(/недоступна запись MP4/)).toBeVisible();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>Reflect.get(window,'__cameraCalls'))).toBe(0);
});
test('iPhone failed MP4 encoder never tries WebM or default encoding',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'platform',{configurable:true,value:'iPhone'});const Native=MediaRecorder;Reflect.set(window,'__attemptedFormats',[]);class RejectMP4 extends Native{static isTypeSupported(){return true;}constructor(stream:MediaStream,options?:MediaRecorderOptions){(Reflect.get(window,'__attemptedFormats') as string[]).push(options?.mimeType??'default');throw new DOMException('Test encoder unavailable','NotSupportedError');}}Object.defineProperty(window,'MediaRecorder',{configurable:true,value:RejectMP4});});
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();const overlay=page.getByRole('checkbox',{name:'Текст на видео'});if(await overlay.isEnabled())await overlay.uncheck();
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText(/не удалось запустить запись MP4/)).toBeVisible();await expect(page.getByRole('button',{name:/Записать видео/})).toBeDisabled();await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeEnabled();
 const attempts=await page.evaluate(()=>Reflect.get(window,'__attemptedFormats') as string[]);expect(attempts.length).toBeGreaterThan(0);expect(attempts.every(type=>type.startsWith('video/mp4'))).toBe(true);
});

test('video mixer changes live stem gain without restarting the recording',async({page})=>{
 await page.addInitScript(()=>{
  const start=MediaRecorder.prototype.start,stop=MediaRecorder.prototype.stop,target=AudioParam.prototype.setTargetAtTime;
  Reflect.set(window,'__mixerRecorderStarts',0);Reflect.set(window,'__mixerRecorderStops',0);Reflect.set(window,'__mixerGainChanges',[]);
  MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){Reflect.set(window,'__mixerRecorderStarts',Number(Reflect.get(window,'__mixerRecorderStarts'))+1);return start.apply(this,args)};
  MediaRecorder.prototype.stop=function(){Reflect.set(window,'__mixerRecorderStops',Number(Reflect.get(window,'__mixerRecorderStops'))+1);return stop.call(this)};
  AudioParam.prototype.setTargetAtTime=function(...args:Parameters<AudioParam['setTargetAtTime']>){(Reflect.get(window,'__mixerGainChanges') as number[]).push(args[0]);return target.apply(this,args)};
 });
 const api=await mockApi(page);await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 const mixer=page.getByRole('region',{name:'Микшер',exact:true}),open=page.getByRole('button',{name:'Показать микшер',exact:true}),close=page.getByRole('button',{name:'Свернуть микшер',exact:true});
 await expect(mixer).toHaveCount(0);await open.click();await expect(mixer).toBeVisible();await expect(close).toHaveAttribute('aria-expanded','true');
 const music=mixer.getByRole('slider',{name:'Музыка',exact:true}),vocals=mixer.getByRole('slider',{name:'Голос артиста',exact:true});
 await music.fill('65');await expect(music).toHaveValue('65');await close.click();await expect(mixer).toHaveCount(0);
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();const rec=page.getByText('● REC',{exact:true});await expect(rec).toBeVisible();
 await open.click();await expect(mixer).toBeVisible();await expect(music).toHaveValue('65');
 await page.evaluate(()=>{(Reflect.get(window,'__mixerGainChanges') as number[]).length=0;});
 await music.fill('37');await expect(music).toHaveValue('37');await vocals.fill('42');await expect(vocals).toHaveValue('42');
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__mixerGainChanges') as number[])).toEqual(expect.arrayContaining([.37,.42]));
 await mixer.getByRole('button',{name:'Приглушить: Голос артиста'}).click();await expect(vocals).toBeDisabled();await expect(vocals).toHaveValue('0');
 await close.click();await expect(mixer).toHaveCount(0);await expect(rec).toBeVisible();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled();
 expect(await page.evaluate(()=>[Reflect.get(window,'__mixerRecorderStarts'),Reflect.get(window,'__mixerRecorderStops')])).toEqual([1,0]);
 await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
 expect(await page.evaluate(()=>[Reflect.get(window,'__mixerRecorderStarts'),Reflect.get(window,'__mixerRecorderStops')])).toEqual([1,1]);expect(api.media).toBe(2);
});

test('video canvas animates natural lyric transition and snaps on a seek without compensation',async({page})=>{
 await page.addInitScript(()=>{
 localStorage.setItem('anyminus.video.sync.v1',JSON.stringify({mode:'off',manualMs:150}));
 const draw=CanvasRenderingContext2D.prototype.fillText;Reflect.set(window,'__motionFrames',[]);
 CanvasRenderingContext2D.prototype.fillText=function(...args:Parameters<CanvasRenderingContext2D['fillText']>){if(this.canvas.classList.contains('video-overlay')&&document.querySelector('.video-karaoke-rec')){const size=Number(this.font.match(/([0-9.]+)px/)?.[1]);const frames=Reflect.get(window,'__motionFrames') as {text:string;size:number;y:number;alpha:number}[];frames.push({text:args[0],size,y:args[2],alpha:this.globalAlpha});}return draw.apply(this,args)};
 });
 await mockApi(page);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'Alpha',startMs:0,endMs:2500,startOrigin:'source'},{text:'Bravo',startMs:2500,endMs:5500,startOrigin:'source'},{text:'Charlie',startMs:5500,endMs:7900,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Alpha',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await page.getByRole('button',{name:'Alpha',exact:true}).click();await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 const frames=()=>page.evaluate(()=>Reflect.get(window,'__motionFrames') as {text:string;size:number;y:number;alpha:number}[]);
 await expect.poll(async()=>new Set((await frames()).filter(f=>f.text==='Bravo').map(f=>f.size)).size,{timeout:5500}).toBeGreaterThan(2);
 await expect.poll(async()=>(await frames()).some(f=>f.text==='Alpha'&&f.alpha>0&&f.alpha<1)).toBe(true);
 const before=await page.getByRole('slider',{name:'Позиция песни'}).inputValue();expect(Number(before)).toBeGreaterThan(2);
 await page.getByRole('button',{name:'Charlie',exact:true}).click();await expect(page.getByRole('button',{name:'Charlie',exact:true})).toHaveAttribute('aria-current','true');
 await page.evaluate(()=>{(Reflect.get(window,'__motionFrames') as unknown[]).length=0;});
 await expect.poll(async()=>(await frames()).some(f=>f.text==='Charlie'&&f.alpha===1)).toBe(true);
 expect((await frames()).filter(f=>f.text==='Charlie').every(f=>f.alpha===1)).toBe(true);
 await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
});

test('video pitch and tempo use a continuous recording audio bus',async({page})=>{
 await page.addInitScript(()=>{
  const connect=AudioNode.prototype.connect,start=MediaRecorder.prototype.start,stop=MediaRecorder.prototype.stop,sourceStart=AudioBufferSourceNode.prototype.start;
  Reflect.set(window,'__pitchVideoStarts',0);Reflect.set(window,'__pitchVideoStops',0);Reflect.set(window,'__pitchVideoRates',[]);
  AudioNode.prototype.connect=function(this:AudioNode,...args:unknown[]){const result=Reflect.apply(connect,this,args);if(this instanceof GainNode&&args[0] instanceof MediaStreamAudioDestinationNode&&Math.abs(this.gain.value-.55)<.001){const analyser=this.context.createAnalyser();analyser.fftSize=8192;Reflect.apply(connect,this,[analyser]);Reflect.set(window,'__recordingMusicAnalyser',analyser);}return result} as typeof connect;
  MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){Reflect.set(window,'__pitchVideoStarts',Number(Reflect.get(window,'__pitchVideoStarts'))+1);Reflect.set(window,'__pitchVideoTrack',this.stream.getAudioTracks()[0]);return start.apply(this,args)};
  MediaRecorder.prototype.stop=function(){Reflect.set(window,'__pitchVideoStops',Number(Reflect.get(window,'__pitchVideoStops'))+1);return stop.call(this)};
  AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){(Reflect.get(window,'__pitchVideoRates') as number[]).push(this.playbackRate.value);return sourceStart.apply(this,args)};
 });
 const api=await mockApi(page);await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Показать микшер',exact:true}).click();const pitch=page.getByLabel('Тональность в полутонах'),speed=page.getByLabel('Скорость воспроизведения'),slider=page.getByRole('slider',{name:'Позиция песни'});
 await expect(pitch).toHaveText('0');await expect(speed).toHaveText('1.0×');await slider.press('Home');await expect(slider).toHaveValue('0');
 const overlay=page.getByRole('checkbox',{name:'Текст на видео'});if(await overlay.isEnabled())await overlay.uncheck();
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 const frequency=()=>page.evaluate(()=>{const a=Reflect.get(window,'__recordingMusicAnalyser') as AnalyserNode;if(!a)return 0;const bins=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(bins);let peak=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[peak])peak=i;return bins[peak]>-70?peak*a.context.sampleRate/a.fftSize:0;});
 await expect.poll(async()=>Math.abs(await frequency()-440),{timeout:3000}).toBeLessThan(15);
 await page.getByRole('button',{name:'Повысить тональность'}).click();await expect(pitch).toHaveText('+1',{timeout:10000});
 await page.getByRole('button',{name:'Повысить тональность'}).click();await expect(pitch).toHaveText('+2');
 await expect.poll(async()=>Math.abs(await frequency()-493.883),{timeout:4000}).toBeLessThan(15);
 await page.getByRole('button',{name:'Увеличить скорость'}).click();await expect(speed).toHaveText('1.1×');await expect(page.getByRole('button',{name:'Увеличить скорость'})).toBeEnabled();
 expect(await page.evaluate(()=>((Reflect.get(window,'__pitchVideoRates') as number[]).slice(-2)).map(n=>Math.round(n*10)))).toEqual([11,11]);
 await expect.poll(async()=>Math.abs(await frequency()-493.883),{timeout:3000}).toBeLessThan(15);
 await expect(page.getByText('● REC',{exact:true})).toBeVisible();expect(await page.evaluate(()=>[Reflect.get(window,'__pitchVideoStarts'),Reflect.get(window,'__pitchVideoStops'),(Reflect.get(window,'__pitchVideoTrack') as MediaStreamTrack).readyState])).toEqual([1,0,'live']);
 await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();expect(api.media).toBe(2);
 expect(await page.evaluate(()=>[Reflect.get(window,'__pitchVideoStarts'),Reflect.get(window,'__pitchVideoStops')])).toEqual([1,1]);
});

test('karaoke microphone requests music-friendly audio and recording has independent gain paths',async({page})=>{
 await page.addInitScript(()=>{
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),connect=AudioNode.prototype.connect;
 Reflect.set(window,'__micConstraints',[]);Reflect.set(window,'__recordingGraph',[]);
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(c:MediaStreamConstraints)=>{const calls=Reflect.get(window,'__micConstraints') as unknown[];calls.push(c.audio);if(calls.length===1)throw new DOMException('camera constraints','OverconstrainedError');return get(c)}});
 AudioNode.prototype.connect=function(this:AudioNode,...args:unknown[]){const result=Reflect.apply(connect,this,args);const dest=args[0];if(dest instanceof AudioNode)(Reflect.get(window,'__recordingGraph') as [AudioNode,AudioNode][]).push([this,dest]);return result} as typeof connect;
 });
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 const constraints={echoCancellation:false,noiseSuppression:false,autoGainControl:false};expect(await page.evaluate(()=>Reflect.get(window,'__micConstraints'))).toEqual([constraints,constraints]);
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 const graph=await page.evaluate(()=>{const edges=Reflect.get(window,'__recordingGraph') as [AudioNode,AudioNode][];const inputs=edges.filter(([,to])=>to instanceof MediaStreamAudioDestinationNode);const sources=inputs.map(([from])=>from);const upstream=sources.map(source=>edges.filter(([,to])=>to===source).map(([from])=>from));return {inputs:sources.length,gains:sources.map(s=>s instanceof GainNode?s.gain.value:0).sort(),independent:upstream.length===2&&upstream.every(a=>a.length===1&&a[0] instanceof DynamicsCompressorNode)&&upstream[0][0]!==upstream[1][0]};});
 expect(graph.inputs).toBe(2);expect(graph.gains[0]).toBeCloseTo(.45,3);expect(graph.gains[1]).toBeCloseTo(.55,3);expect(graph.independent).toBe(true);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
});

test('second iPhone take after sharing rebuilds audio output and finishes',async({page})=>{
 await page.addInitScript(()=>{
 Object.defineProperty(navigator,'platform',{configurable:true,value:'iPhone'});
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
 const start=AudioBufferSourceNode.prototype.start;Reflect.set(window,'__takeContexts',[]);
 AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){(Reflect.get(window,'__takeContexts') as BaseAudioContext[]).push(this.context);return start.apply(this,args)};
 });
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 for(let i=0;i<2;i++){
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 const overlay=page.getByRole('checkbox',{name:'Текст на видео'});if(await overlay.isEnabled())await overlay.uncheck();
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
 await page.getByRole('button',{name:'Поделиться',exact:true}).click();await expect(page.getByRole('button',{name:'Закрыть',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 }
 expect(await page.evaluate(()=>{const contexts=Reflect.get(window,'__takeContexts') as BaseAudioContext[];return contexts.length>=6&&contexts[contexts.length-1]!==contexts[contexts.length-3];})).toBe(true);expect(api.media).toBe(2);
});
test('missing recorder stop event does not strand player and camera',async({page})=>{
 await page.addInitScript(()=>{const stop=MediaRecorder.prototype.stop;MediaRecorder.prototype.stop=function(){this.onstop=null;return stop.call(this)};});
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();await page.waitForTimeout(1100);
 await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByText('Сохраняем видео…',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible({timeout:8000});await expect(page.getByText(/Сохранена доступная часть записи/)).toBeVisible();await expect(page.getByLabel('Предпросмотр камеры')).toHaveCount(0);await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
});

test('Android recording adapts to camera frame rate and conservative device budget',async({page})=>{
 await page.addInitScript(()=>{
 Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 (Linux; Android 14) Chrome/134.0.0.0 Mobile Safari/537.36'});
 Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:4});Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:2});
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),capture=HTMLCanvasElement.prototype.captureStream;
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(c:MediaStreamConstraints)=>{Reflect.set(window,'__adaptiveRequest',c.video);const stream=await get(c);const track=stream.getVideoTracks()[0];Object.defineProperty(track,'getSettings',{value:()=>({frameRate:15,width:640,height:480})});Object.defineProperty(track,'getCapabilities',{value:()=>({frameRate:{min:1,max:20}})});return stream}});
 HTMLCanvasElement.prototype.captureStream=function(rate?:number){if(this.classList.contains('video-overlay'))Reflect.set(window,'__adaptiveRate',rate);return capture.call(this,rate)};
 });
 await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'Adaptive line',startMs:0,endMs:7900,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Adaptive line',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'__adaptiveRequest'))).toMatchObject({width:{ideal:960},height:{ideal:540},frameRate:{ideal:24,max:24}});
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'__adaptiveRate'))).toBe(15);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
});

test('compact preview follows camera aspect ratio instead of fixed landscape frame',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();
 const video=page.getByLabel('Предпросмотр камеры');await expect(video).toBeVisible();
 await expect.poll(()=>video.evaluate(el=>(el as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
 const setDimensions=(width:number,height:number)=>video.evaluate((el,dimensions)=>{Object.defineProperty(el,'videoWidth',{configurable:true,value:dimensions.width});Object.defineProperty(el,'videoHeight',{configurable:true,value:dimensions.height});el.dispatchEvent(new Event('resize'));},{width,height});
 const frame=page.locator('.video-karaoke-preview');
 const ratio=()=>frame.evaluate(el=>{const rect=el.getBoundingClientRect();return rect.width/rect.height});
 await setDimensions(720,1280);await expect.poll(async()=>Math.abs(await ratio()-9/16)).toBeLessThan(.02);
 await expect(video).toHaveCSS('object-fit','contain');
 const portrait=await frame.boundingBox();expect(portrait!.height).toBeLessThanOrEqual(100);expect(portrait!.width).toBeLessThan(portrait!.height);
 await setDimensions(1280,720);await expect.poll(async()=>Math.abs(await ratio()-16/9)).toBeLessThan(.02);
 await page.getByRole('button',{name:'Отмена',exact:true}).click();
 await expect(frame).toHaveCount(0);
});

test('microphone processing is verified and preview contains only the camera track',async({page})=>{
 await page.addInitScript(()=>{
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),connect=AudioNode.prototype.connect;
 Reflect.set(window,'__rawMicApplied',[]);Reflect.set(window,'__speakerNodes',[]);
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(c:MediaStreamConstraints)=>{const stream=await get(c);const track=stream.getAudioTracks()[0];let enabled=true;
 const settings=track.getSettings.bind(track);Object.defineProperty(track,'getSettings',{value:()=>({...settings(),echoCancellation:enabled,noiseSuppression:false,autoGainControl:false})});
 Object.defineProperty(track,'applyConstraints',{value:async(c:MediaTrackConstraints)=>{(Reflect.get(window,'__rawMicApplied') as unknown[]).push(c);enabled=false;}});
 return stream;}});
 AudioNode.prototype.connect=function(this:AudioNode,...args:unknown[]){const result=Reflect.apply(connect,this,args);if(this instanceof GainNode&&args[0]===this.context.destination)(Reflect.get(window,'__speakerNodes') as GainNode[]).push(this);return result} as typeof connect;
 });
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 const speaker=()=>page.evaluate(()=>{const nodes=Reflect.get(window,'__speakerNodes') as GainNode[];return nodes.map(n=>n.gain.value)});
 expect(await speaker()).toEqual([1]);
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'__rawMicApplied'))).toEqual([{echoCancellation:{exact:false}}]);
 expect(await page.getByLabel('Предпросмотр камеры').evaluate(el=>((el as HTMLVideoElement).srcObject as MediaStream).getAudioTracks().length)).toBe(0);
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();expect(await speaker()).toEqual([1]);
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
});

test('video sync settings use browser estimates, persist manual mode and delay only recording music',async({page})=>{
 await page.addInitScript(()=>{
 Object.defineProperty(AudioContext.prototype,'outputLatency',{configurable:true,get:()=>.15});Object.defineProperty(AudioContext.prototype,'baseLatency',{configurable:true,get:()=>.02});
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),connect=AudioNode.prototype.connect;
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async(c:MediaStreamConstraints)=>{const stream=await get(c);const track=stream.getAudioTracks()[0],settings=track.getSettings.bind(track);Object.defineProperty(track,'label',{value:'Test microphone'});Object.defineProperty(track,'getSettings',{value:()=>({...settings(),latency:.01})});return stream;}});
 Reflect.set(window,'__syncEdges',[]);
 AudioNode.prototype.connect=function(this:AudioNode,...args:unknown[]){const result=Reflect.apply(connect,this,args);if(args[0] instanceof AudioNode)(Reflect.get(window,'__syncEdges') as [AudioNode,AudioNode][]).push([this,args[0]]);return result} as typeof connect;
 });
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Настройки звука',exact:true}).click();const panel=page.getByRole('region',{name:'Настройки звука видеозаписи'});await expect(panel).toBeVisible();
 await expect(panel.getByText('Test microphone',{exact:true})).toBeVisible();await expect(panel.locator('output')).toHaveText('180 мс');
 await panel.getByRole('button',{name:'Выкл.',exact:true}).click();await expect(panel.locator('output')).toHaveText('0 мс');
 await panel.getByRole('button',{name:'Вручную',exact:true}).click();await panel.getByRole('button',{name:'200',exact:true}).click();await expect(panel.locator('output')).toHaveText('200 мс');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('anyminus.video.sync.v1')!))).toEqual({mode:'manual',manualMs:200});
 await panel.getByRole('button',{name:'Закрыть настройки звука'}).click();await expect(panel).toHaveCount(0);
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect(page.getByText('● REC',{exact:true})).toBeVisible();await expect(page.getByText('Компенсация: 200 мс')).toBeVisible();
 const graph=await page.evaluate(()=>{const edges=Reflect.get(window,'__syncEdges') as [AudioNode,AudioNode][];const link=edges.find(([,to])=>to instanceof DelayNode);if(!link)return null;const [bus,delay]=link;return {delay:(delay as DelayNode).delayTime.value,unity:(bus as GainNode).gain.value,speaker:edges.some(([from,to])=>from===bus&&to===bus.context.destination),toLimiter:edges.some(([from,to])=>from===delay&&to instanceof DynamicsCompressorNode),directSpeaker:edges.some(([from,to])=>from===delay&&to===delay.context.destination)};});
 expect(graph).not.toBeNull();expect(graph!.delay).toBeCloseTo(.2,3);expect(graph).toMatchObject({unity:1,speaker:true,toLimiter:true,directSpeaker:false});
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();await expect(page.getByRole('link',{name:'Сохранить видео'})).toBeVisible();
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.getByRole('button',{name:/Записать видео/}).click();await expect(page.getByRole('button',{name:'Начать запись',exact:true})).toBeVisible();await page.getByRole('button',{name:'Настройки звука',exact:true}).click();await expect(panel.locator('output')).toHaveText('200 мс');await expect(panel.getByRole('button',{name:'Вручную',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('compensated canvas clock delays seek boundaries without interpolating across them',()=>{
 const history:ClockSample[]=[];
 const tick=(time:number,position:number,revision:number,delay=200)=>delayedClock(history,{time,position,revision},delay);
 expect(tick(0,1,0).position).toBe(1);
 tick(100,1.1,0);tick(200,1.2,0);
 expect(tick(250,5,1)).toMatchObject({position:1.05,revision:0});
 const before=tick(400,5.15,1);expect(before.position).toBeCloseTo(1.2,6);expect(before.revision).toBe(0);
 const boundary=tick(450,5.2,1);expect(boundary.position).toBe(5);expect(boundary.revision).toBe(1);
 const after=tick(500,5.25,1);expect(after.position).toBeCloseTo(5.05,6);expect(after.revision).toBe(1);
 expect(tick(510,7,2,0)).toEqual({time:510,position:7,revision:2});expect(history).toHaveLength(0);
});
test('automatic recording compensation uses reported latency and does not guess from microphone label',()=>{
 const info:AudioDiagnostics={micLabel:'AirPods',inputMs:10,baseMs:20,outputMs:null,sampleRate:48000,micRate:48000,channels:1,sinkId:null};
 expect(resolveDelay({mode:'auto',manualMs:150},info)).toBe(0);
 expect(resolveDelay({mode:'auto',manualMs:150},{...info,outputMs:150})).toBe(180);
 expect(resolveDelay({mode:'auto',manualMs:150},{...info,baseMs:5,inputMs:0,outputMs:10})).toBe(0);
 expect(resolveDelay({mode:'auto',manualMs:150},{...info,outputMs:900})).toBe(500);
 expect(resolveDelay({mode:'manual',manualMs:200},info)).toBe(200);
 expect(resolveDelay({mode:'off',manualMs:200},{...info,outputMs:150})).toBe(0);
});
