import {test,expect} from '@playwright/test';
import {mockApi} from './fixture';
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
  Reflect.set(window,'__overlayText',[]);Reflect.set(window,'__overlayTrack',null);Reflect.set(window,'__recordedCanvas',false);
  CanvasRenderingContext2D.prototype.fillText=function(...args:Parameters<CanvasRenderingContext2D['fillText']>){if(this.canvas.classList.contains('video-overlay')){const rows=Reflect.get(window,'__overlayText') as string[];rows.push(args[0]);if(rows.length>150)rows.shift();}return draw.apply(this,args)};
  HTMLCanvasElement.prototype.captureStream=function(rate?:number){const stream=capture.call(this,rate);if(this.classList.contains('video-overlay'))Reflect.set(window,'__overlayTrack',stream.getVideoTracks()[0]);return stream;};
  MediaRecorder.prototype.start=function(...args:Parameters<MediaRecorder['start']>){Reflect.set(window,'__recordedCanvas',this.stream.getVideoTracks()[0]===Reflect.get(window,'__overlayTrack'));return start.apply(this,args)};
 });
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'Alpha',startMs:0,endMs:3000,startOrigin:'source'},{text:'Bravo',startMs:3000,endMs:6000,startOrigin:'source'},{text:'Charlie',startMs:6000,endMs:7900,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Alpha',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Записать видео/}).click();
 const checkbox=page.getByRole('checkbox',{name:'Текст на видео'});await expect(checkbox).toBeChecked();
 await checkbox.uncheck();await expect(page.locator('canvas.video-overlay')).not.toHaveClass(/visible/);await checkbox.check();
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__overlayText') as string[])).toEqual(expect.arrayContaining(['Alpha','Test song one','Test artist','AnyMinus']));
 await page.getByRole('button',{name:'Начать запись',exact:true}).click();await expect.poll(async()=>await page.getByText('● REC',{exact:true}).isVisible()?'recording':(await page.locator('.video-karaoke-error,.karaoke-error').allTextContents()).join(' | ')||'starting',{timeout:10000}).toBe('recording');
 expect(await page.evaluate(()=>Reflect.get(window,'__recordedCanvas'))).toBe(true);
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
 expect((await page.evaluate(()=>Reflect.get(window,'__codecAttempts') as string[]))[0]).toBe('video/mp4');
 await page.waitForTimeout(1100);await page.getByRole('button',{name:'Остановить',exact:true}).click();const save=page.getByRole('link',{name:'Сохранить видео'});await expect(save).toBeVisible();
 await page.getByRole('button',{name:'Поделиться',exact:true}).click();await expect(page.getByRole('button',{name:'Открыто меню отправки…'})).toBeDisabled();await expect(save).toBeVisible();
 const payload=await page.evaluate(()=>Reflect.get(window,'__shareData') as {keys:string[];name:string;type:string;size:number});
 expect(payload.keys).toEqual(['files']);expect(payload.type).toMatch(/^video\/(mp4|webm)$/);expect(payload.name).toMatch(/^AnyMinus-\d+\.(mp4|webm)$/);expect(payload.name.endsWith(payload.type.split('/')[1])).toBe(true);expect(payload.size).toBeGreaterThan(1000);
 await page.evaluate(()=>Reflect.get(window,'__rejectShare')());await expect(page.getByText('Не удалось передать файл. Сохраните видео и прикрепите его в мессенджере.')).toBeVisible();await expect(save).toBeVisible();await expect(page.getByRole('button',{name:'Поделиться',exact:true})).toBeEnabled();
});
