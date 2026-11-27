import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('karaoke fits the viewport, follows lyrics without page scroll, keeps controls in focus and landscape',async({page})=>{
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,async r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:Array.from({length:20},(_,i)=>({text:'Test lyric '+i+' with a long line to wrap',startMs:i*45,endMs:(i+1)*45,startOrigin:'source'}))},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const screen=page.getByRole('region',{name:'Плеер караоке'}), lyrics=page.getByLabel('Текст песни',{exact:true}),play=page.getByRole('button',{name:'Воспроизвести',exact:true}),slider=page.getByRole('slider',{name:'Позиция песни'}),mixer=page.getByRole('region',{name:'Микшер'});await expect(screen).toBeVisible();await expect(lyrics.getByRole('button')).toHaveCount(20);const hint=page.getByText('Нажмите на любую строку, чтобы перейти к ней',{exact:true});await expect(hint).toBeVisible();await expect(lyrics).toHaveAttribute('aria-describedby','lyric-seek-hint');
 async function fits(locator:typeof screen){await expect(locator).toBeInViewport({ratio:0.99});const b=await locator.boundingBox();const v=page.viewportSize()!;expect(b!.x).toBeGreaterThanOrEqual(-1);expect(b!.x+b!.width).toBeLessThanOrEqual(v.width+1);expect(b!.y).toBeGreaterThanOrEqual(-1);expect(b!.y+b!.height).toBeLessThanOrEqual(v.height+1)}
 const favorite=page.getByRole('button',{name:'В любимое',exact:true}),share=page.getByRole('button',{name:'Поделиться песней',exact:true});await expect(page.locator('.karaoke-header').getByRole('button',{name:'В любимое',exact:true})).toHaveCount(0);await expect(page.locator('.transport-left > button').nth(1)).toHaveAttribute('aria-label','В любимое');await expect(page.locator('.karaoke-header .karaoke-focus-toggle')).toHaveCount(0);await expect(page.getByRole('button',{name:'Только текст',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Свернуть микшер',exact:true})).toHaveAttribute('aria-expanded','true');await fits(favorite);await fits(share);await fits(screen);await fits(play);await fits(slider);await fits(mixer);await fits(hint);await expect(page.getByRole('navigation')).toBeHidden();
 const cover=page.locator('.karaoke-header .karaoke-cover .artwork'),heading=page.locator('.karaoke-heading');
 async function checkHeader(){const record=page.locator('.karaoke-header').getByRole('button',{name:'Записать видео',exact:true});await expect(record).toBeVisible();const label=record.locator('.video-trigger-label'),camera=record.locator('svg');await expect(label).toHaveText('Записать видео');await expect(label).toBeVisible();await expect(record.locator('.video-trigger-beta')).toHaveCount(0);await expect(camera).toBeVisible();const lb=await label.boundingBox(),cb=await camera.boundingBox();expect(cb!.width).toBeCloseTo(22,0);expect(cb!.height).toBeCloseTo(22,0);expect(cb!.x+cb!.width).toBeLessThanOrEqual(lb!.x+1);const lineHeight=await label.evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));expect(lb!.height/lineHeight).toBeCloseTo(2,1);expect((await record.boundingBox())!.width).toBeLessThan(100);await expect(page.locator('.video-karaoke .video-karaoke-trigger')).toHaveCount(0);await fits(record);const r=await record.boundingBox(),headingBox=await heading.boundingBox();expect(r!.x).toBeGreaterThanOrEqual(headingBox!.x+headingBox!.width-1);await expect(cover).toBeVisible();await expect(cover.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await expect(heading.locator('.song-lyrics-status')).toHaveCount(0);const a=await cover.boundingBox(),b=await heading.boundingBox();expect(Math.abs(a!.height-b!.height)).toBeLessThan(1);expect(Math.abs(a!.width-a!.height)).toBeLessThan(1);expect(Math.abs(a!.y-b!.y)).toBeLessThan(1)}
 await checkHeader();
 const adjustments=screen.locator('.karaoke-pitch .pitch-buttons button');
 await expect(adjustments).toHaveCount(4);
 const palette=(el:Element)=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color]};
 const defaultPalette=await adjustments.first().evaluate(palette);
 const playPalette=await play.evaluate(palette);
 expect(defaultPalette).not.toEqual(playPalette);
 await cover.click();await expect(screen).toHaveClass(/karaoke-cover-background-on/);
 for(const button of await adjustments.all()){
  const appearance=await button.evaluate(el=>{
   const s=getComputedStyle(el),canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const ctx=canvas.getContext('2d')!;ctx.fillStyle=s.backgroundColor;ctx.fillRect(0,0,1,1);
   const alpha=ctx.getImageData(0,0,1,1).data[3]/255;
   return {alpha,color:s.color,textColor:getComputedStyle(el.closest('.app')!).color};
  });
  expect(appearance.alpha).toBeCloseTo(.45,2);expect(appearance.color).toBe(appearance.textColor);
 }
 await cover.click();await expect(screen).not.toHaveClass(/karaoke-cover-background-on/);
 for(const button of await adjustments.all())expect(await button.evaluate(palette)).toEqual(defaultPalette);
 await slider.fill('0.8');await expect.poll(()=>lyrics.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.scrollY)).toBe(0);await fits(play);
 await page.getByRole('button',{name:'Свернуть микшер',exact:true}).click();await expect(mixer).toHaveCount(0);await expect(page.getByRole('button',{name:'Показать микшер',exact:true})).toHaveAttribute('aria-expanded','false');await fits(play);await fits(slider);await fits(screen);await fits(hint);await fits(favorite);await checkHeader();
 await page.getByRole('button',{name:'Показать микшер',exact:true}).click();await fits(mixer);await checkHeader();
 for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);await fits(screen);await fits(play);await fits(slider);await fits(mixer);await fits(hint);await fits(favorite);await fits(share);await checkHeader();expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height+1)}
 await page.getByRole('button',{name:'Свернуть микшер',exact:true}).click();await fits(play);await fits(slider);await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();await expect(page.locator('body')).not.toHaveClass(/karaoke-open/);
});

test('active and immediate adjacent lyrics scale to 100 percent and distant lyrics to 75 percent',async({page})=>{
 await mockApi(page);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,async r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:Array.from({length:7},(_,i)=>({text:'Motion line '+i,startMs:i*1000,endMs:(i+1)*1000,startOrigin:'source'}))},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const lines=page.locator('.karaoke-lyrics .lyric');await expect(lines).toHaveCount(7);const slider=page.getByRole('slider',{name:'Позиция песни'});await slider.fill('0');await expect(lines.nth(0)).toHaveAttribute('aria-current','true');
 const scale=(i:number)=>lines.nth(i).locator('.lyric-text').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)/parseFloat(getComputedStyle(el.parentElement!).fontSize));
 await expect.poll(()=>scale(0)).toBeCloseTo(1,2);await expect.poll(()=>scale(1)).toBeCloseTo(1,2);await expect.poll(()=>scale(2)).toBeCloseTo(.75,2);
 expect(await lines.nth(0).locator('.lyric-text').evaluate(el=>getComputedStyle(el).transitionDuration)).not.toBe('0s');
 await slider.fill('4');await expect(lines.nth(4)).toHaveAttribute('aria-current','true');await expect.poll(()=>scale(4)).toBeCloseTo(1,2);await expect.poll(()=>scale(3)).toBeCloseTo(1,2);await expect.poll(()=>scale(5)).toBeCloseTo(1,2);await expect.poll(()=>scale(2)).toBeCloseTo(.75,2);await expect.poll(()=>scale(6)).toBeCloseTo(.75,2);await expect.poll(()=>scale(0)).toBeCloseTo(.75,2);
 await expect.poll(()=>page.locator('.karaoke-lyrics').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 await page.emulateMedia({reducedMotion:'reduce'});await slider.fill('2');await expect(lines.nth(2)).toHaveAttribute('aria-current','true');await expect.poll(()=>scale(2)).toBeCloseTo(1,2);await expect(lines.nth(2).locator('.lyric-text')).toHaveCSS('transition-duration','0s');
});

test('player heading keeps collaborating artists and punctuation on a single line',async({page})=>{
 await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>r.fulfill({json:{items:[{providerTrackId:'101',title:'Collaboration',artist:'Kai Angel, 9mice',artistCredits:[{author_id:'16509384',name:'Kai Angel'},{author_id:'13739916',name:'9mice'}],durationSeconds:8,pairOperationId:'00000000-0000-4000-8000-000000000001'}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Collaboration',exact:true}).click();
 const heading=page.locator('.karaoke-heading'),artists=heading.locator('.artist-credits');await expect(artists).toHaveText('Kai Angel, 9mice');await expect(artists.getByRole('button')).toHaveCount(2);
 for(const width of [390,320,540]){await page.setViewportSize({width,height:664});const first=await artists.getByRole('button',{name:'Kai Angel',exact:true}).boundingBox();const second=await artists.getByRole('button',{name:'9mice',exact:true}).boundingBox();expect(first&&second).toBeTruthy();expect(Math.abs(first!.y-second!.y)).toBeLessThan(2);expect(second!.x).toBeGreaterThan(first!.x);await expect(artists).toHaveCSS('white-space','nowrap');}
 await artists.getByRole('button',{name:'9mice',exact:true}).click();await expect(page).toHaveURL(/#\/artist\/9mice\?author_id=13739916$/);
});

test('stalled Web Audio clock after creating a song recovers on explicit play without new downloads',async({page})=>{
 await page.addInitScript(()=>{const Native=window.AudioContext;Reflect.set(window,'__freezeTestAudioClock',true);Reflect.set(window,'__testAudioContexts',0);class TestContext extends Native{constructor(options?:AudioContextOptions){super(options);Reflect.set(window,'__testAudioContexts',Number(Reflect.get(window,'__testAudioContexts'))+1);if(Reflect.get(window,'__freezeTestAudioClock'))Object.defineProperty(this,'currentTime',{configurable:true,get:()=>0})}}Object.defineProperty(window,'AudioContext',{configurable:true,value:TestContext})});
 const api=await mockApi(page);
 await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song');await page.getByRole('button',{name:'Test song two',exact:true}).click();await page.getByRole('button',{name:'Создать караоке'}).click();
 await expect(page.getByText('Аудиовыход не запустился. Нажмите воспроизведение ещё раз.',{exact:true})).toBeVisible({timeout:15000});
 const play=page.getByRole('button',{name:'Воспроизвести',exact:true});await expect(play).toBeEnabled();expect(api.media).toBe(2);expect(api.enqueued).toBe(1);
 const before=await page.evaluate(()=>Number(Reflect.get(window,'__testAudioContexts')));await page.evaluate(()=>Reflect.set(window,'__freezeTestAudioClock',false));await play.click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Позиция песни'}).inputValue())).toBeGreaterThan(.2);expect(await page.evaluate(()=>Number(Reflect.get(window,'__testAudioContexts')))).toBe(before+1);
 expect(api.media).toBe(2);expect(api.enqueued).toBe(1);
});

test('long intro counts down from the media position, pauses, disappears and returns on rewind',async({page})=>{
 await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';const duration=20,bytes=duration*48000;const wav=Buffer.alloc(44+bytes);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/playback$/,r=>r.request().method()==='OPTIONS'?r.fallback():r.fulfill({json:{pairOperationId:pair,durationSeconds:duration,instrumental:'/demo/catalog/media/'+pair+'/instrumental',vocals:'/demo/catalog/media/'+pair+'/vocals'},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/(instrumental|vocals)$/,r=>r.fulfill({body:wav,contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'First timed line',startMs:15000,endMs:18000,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const slider=page.getByRole('slider',{name:'Позиция песни'}),timer=page.getByRole('timer',{name:'До начала текста'});await expect.poll(async()=>Number(await slider.getAttribute('max'))).toBeCloseTo(20,2);await expect(timer).toBeVisible();await expect(slider).toBeEnabled();
 // Exercise actual user controls rather than range.fill's synthetic input event.
 await slider.press('Home');await expect(slider).toHaveValue('0');await expect(timer.locator('strong')).toHaveText('15');const hint=page.getByText('Нажмите на любую строку, чтобы перейти к ней',{exact:true});await expect(hint).toBeInViewport();
 await page.getByRole('button',{name:'Вперёд 10 секунд',exact:true}).click();await expect(slider).toHaveValue('10');await expect(timer.locator('strong')).toHaveText('5');await expect(timer).toBeInViewport();await page.waitForTimeout(1100);await expect(timer.locator('strong')).toHaveText('5');
 await slider.press('ArrowRight');await expect(slider).toHaveValue('10.1');await expect(timer.locator('strong')).toHaveText('5');
 await page.getByRole('button',{name:'First timed line',exact:true}).click();await expect(slider).toHaveValue('15');await expect(timer).toHaveCount(0);await expect(hint).toBeInViewport();await expect(page.getByRole('button',{name:'First timed line'})).toHaveAttribute('aria-current','true');
 await slider.press('Home');await expect(slider).toHaveValue('0');await expect(timer.locator('strong')).toHaveText('15');await expect(timer).toBeInViewport();expect(await page.evaluate(()=>window.scrollY)).toBe(0);
});

test('shared pitch shifter changes actual output frequency without changing duration or downloading stems again',async({page})=>{
 await page.addInitScript(()=>{const native=AudioNode.prototype.connect;AudioNode.prototype.connect=function(this:AudioNode,...args:unknown[]){const result=Reflect.apply(native,this,args);if(args[0]===this.context.destination&&this instanceof GainNode){const analyser=this.context.createAnalyser();analyser.fftSize=8192;Reflect.apply(native,this,[analyser]);Reflect.set(window,'__pitchAnalyser',analyser)}return result} as typeof native;});
 const api=await mockApi(page);await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const panel=page.getByRole('region',{name:'Тональность',exact:true});const plus=panel.getByRole('button',{name:'Повысить тональность'});const minus=panel.getByRole('button',{name:'Понизить тональность'});const value=panel.getByLabel('Тональность в полутонах');const slider=page.getByRole('slider',{name:'Позиция песни'});
 await expect(value).toHaveText('0');await expect(plus).toBeEnabled();const duration=Number(await slider.getAttribute('max'));await slider.press('Home');
 await plus.click();await expect(value, 'Pitch initialization: '+(await page.locator('.karaoke-error').allTextContents()).join(' ')).toHaveText('+1',{timeout:10000});await plus.click();await expect(value).toHaveText('+2');await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 const frequency=()=>page.evaluate(()=>{const a=Reflect.get(window,'__pitchAnalyser') as AnalyserNode;if(!a)return 0;const bins=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(bins);let peak=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[peak])peak=i;return bins[peak]>-70?peak*a.context.sampleRate/a.fftSize:0});
 // Fixture contains 440 Hz in both stems, +2 semitones should be about 494 Hz.
 await expect.poll(async()=>Math.abs(await frequency()-493.883),{timeout:5000}).toBeLessThan(15);
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await expect(slider).toBeEnabled();expect(Number(await slider.getAttribute('max'))).toBeCloseTo(duration,3);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
 await minus.click();await expect(value).toHaveText('+1');await minus.click();await expect(value).toHaveText('0');
 for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);await expect(panel).toBeInViewport({ratio:.95})}
});


test('tempo controls keep pitch, change source clock and both stem rates, and preserve seek',async({page})=>{
 await page.addInitScript(()=>{
  const connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
  AudioNode.prototype.connect=function(this:AudioNode,...args:unknown[]){const result=Reflect.apply(connect,this,args);if(args[0]===this.context.destination&&this instanceof GainNode){const analyser=this.context.createAnalyser();analyser.fftSize=8192;Reflect.apply(connect,this,[analyser]);Reflect.set(window,'__tempoAnalyser',analyser)}return result} as typeof connect;
  AudioBufferSourceNode.prototype.start=function(this:AudioBufferSourceNode,...args:Parameters<AudioBufferSourceNode['start']>){const rates=(Reflect.get(window,'__tempoRates')??[]) as number[];rates.push(this.playbackRate.value);Reflect.set(window,'__tempoRates',rates);return Reflect.apply(start,this,args)};
 });
 const api=await mockApi(page);await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const panel=page.getByRole('region',{name:'Скорость',exact:true}),value=panel.getByLabel('Скорость воспроизведения'),plus=panel.getByRole('button',{name:'Увеличить скорость'}),minus=panel.getByRole('button',{name:'Уменьшить скорость'}),slider=page.getByRole('slider',{name:'Позиция песни'});
 await expect(value).toHaveText('1.0×');await slider.press('Home');
 await plus.click();await expect(value).toHaveText('1.1×',{timeout:10000});await plus.click();await expect(value).toHaveText('1.2×');
 await expect(page.getByLabel('Тональность в полутонах')).toHaveText('0');await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 const rates=await page.evaluate(()=>Reflect.get(window,'__tempoRates').slice(-2));expect(rates[0]).toBeCloseTo(1.2,3);expect(rates[1]).toBeCloseTo(1.2,3);
 const frequency=()=>page.evaluate(()=>{const a=Reflect.get(window,'__tempoAnalyser') as AnalyserNode;if(!a)return 0;const bins=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(bins);let peak=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[peak])peak=i;return bins[peak]>-70?peak*a.context.sampleRate/a.fftSize:0});
 await expect.poll(async()=>Math.abs(await frequency()-440),{timeout:4000}).toBeLessThan(15);
 const p0=Number(await slider.inputValue());await page.waitForTimeout(800);const p1=Number(await slider.inputValue());expect(p1-p0).toBeGreaterThan(.65);expect(p1-p0).toBeLessThan(1.35);
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await slider.press('Home');await expect(slider).toHaveValue('0');
 await minus.click();await expect(value).toHaveText('1.1×');await minus.click();await expect(value).toHaveText('1.0×');expect(api.media).toBe(2);
 for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);await expect(panel).toBeInViewport({ratio:.95})}
});

test('song ending offers artist navigation and playback can be rewound',async({page})=>{await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).click();const slider=page.getByRole('slider',{name:'Позиция песни'});await slider.press('End');const ending=page.getByRole('heading',{name:'Выбрать другую песню исполнителя'});await expect(ending).toBeVisible();await slider.press('Home');await expect(ending).toHaveCount(0);await slider.press('End');await expect(ending).toBeVisible();await page.locator('.karaoke-end-panel button').first().click();await expect(page).toHaveURL(/#\/artist\//);});


test('song ending opens global search without restarting playback',async({page})=>{await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('slider',{name:'Позиция песни'}).press('End');await page.getByRole('button',{name:'Перейти в глобальный поиск',exact:true}).click();await expect(page).toHaveURL(/#\/search$/);await expect(page.getByRole('textbox',{name:'Поиск песни'})).toHaveValue('');await expect(page.locator('.karaoke-end-panel')).toHaveCount(0)});

test('inactive lyrics use their real smaller size to fit more words on a line',async({page})=>{
 await mockApi(page);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'Intro',startMs:0,endMs:1500,startOrigin:'source'},{text:'Adjacent',startMs:1500,endMs:3000,startOrigin:'source'},{text:'Karaoke melody night',startMs:3000,endMs:6000,startOrigin:'source'},{text:'End',startMs:6000,endMs:7900,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 // Deterministic fixture typography: twenty monospaced characters fit at
 // 24px but not 32px within the real 390px mobile player. Keep production
 // font-size, width, and wrapping rules under test.
 await page.addStyleTag({content:'.karaoke-lyrics{--lyric-size:32px!important}.karaoke-lyrics .lyric-text{font-family:monospace;letter-spacing:0}'});
 const slider=page.getByRole('slider',{name:'Позиция песни'});await slider.fill('0');const line=page.getByRole('button',{name:'Karaoke melody night',exact:true});await expect(line).toBeVisible();
 const span=line.locator('.lyric-text');
 await expect(span).toHaveCSS('font-size','24px');
 const widths=await span.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const previous=el.style.whiteSpace;el.style.whiteSpace='nowrap';const actual=range.getBoundingClientRect().width;el.style.whiteSpace=previous;return {actual,available:el.clientWidth};});
 expect(widths.actual).toBeLessThan(widths.available);
 expect(widths.actual/0.75).toBeGreaterThan(widths.available);
 const rows=()=>span.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return new Set(Array.from(range.getClientRects(),rect=>Math.round(rect.top))).size;});
 await expect.poll(rows).toBe(1);await line.click();await expect(line).toHaveAttribute('aria-current','true');await expect(span).toHaveCSS('font-size','32px');await expect.poll(rows).toBeGreaterThan(1);
 await slider.fill('0');await expect.poll(rows).toBe(1);
});

test('instrumental countdown appears only for gaps over ten seconds and uses active lyric typography',async({page})=>{
 await mockApi(page);await page.emulateMedia({reducedMotion:'reduce'});
 const pair='00000000-0000-4000-8000-000000000001',duration=35,bytes=duration*48000,wav=Buffer.alloc(44+bytes);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/playback$/,r=>r.request().method()==='OPTIONS'?r.fallback():r.fulfill({json:{pairOperationId:pair,durationSeconds:duration,instrumental:'/demo/catalog/media/'+pair+'/instrumental',vocals:'/demo/catalog/media/'+pair+'/vocals'},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/(instrumental|vocals)$/,r=>r.fulfill({body:wav,contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:[{text:'First verse',startMs:0,endMs:3000,startOrigin:'source'},{text:'Second verse',startMs:15000,endMs:17000,startOrigin:'source'},{text:'Third verse',startMs:27000,endMs:30000,startOrigin:'source'}]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const first=page.getByRole('button',{name:'First verse',exact:true}),second=page.getByRole('button',{name:'Second verse',exact:true}),third=page.getByRole('button',{name:'Third verse',exact:true}),slider=page.getByRole('slider',{name:'Позиция песни'}),timer=page.getByRole('timer',{name:'До следующей строки'});
 await first.click();await expect(first).toHaveAttribute('aria-current','true');
 const typography=async(locator:typeof first)=>locator.locator('.lyric-text').evaluate(el=>{const s=getComputedStyle(el);return [s.fontSize,s.fontWeight,s.fontFamily,s.color]});
 const activeStyle=await typography(first);
 await slider.fill('3');await expect(timer).toHaveText('12');await expect(timer).toBeInViewport();expect(await typography(timer)).toEqual(activeStyle);await expect(first).not.toHaveAttribute('aria-current','true');
 await slider.fill('14');await expect(timer).toHaveText('1');await page.waitForTimeout(1100);await expect(timer).toHaveText('1');
 await second.click();await expect(timer).toHaveCount(0);await expect(second).toHaveAttribute('aria-current','true');
 await slider.fill('20');await expect(timer).toHaveCount(0);
 await third.click();await expect(third).toHaveAttribute('aria-current','true');await slider.fill('32');await expect(timer).toHaveCount(0);
 await slider.fill('5');await expect(timer).toHaveText('10');await expect(timer).toBeInViewport();
});


test('pitch and speed stepper buttons stay inside their own panels across viewport widths and labels',async({page})=>{
 await mockApi(page);await page.goto('/#/track/101');await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});
 for(const size of [{width:320,height:568},{width:360,height:640},{width:375,height:667},{width:390,height:664},{width:430,height:932},{width:540,height:800},{width:667,height:375}]){
  await page.setViewportSize(size);
  for(const label of ['PITCH','TONALITÄT','TONALIDAD','ТОНАЛЬНОСТЬ']){
   const panels=page.locator('.karaoke-mix-tools > .karaoke-pitch');await expect(panels).toHaveCount(2);
   const pitchBox=await panels.nth(0).boundingBox(),speedBox=await panels.nth(1).boundingBox();expect(pitchBox&&speedBox).toBeTruthy();expect(Math.abs(pitchBox!.width-speedBox!.width),`equal control panels at ${size.width}px`).toBeLessThan(1);
   await panels.first().locator('.mixer-title').evaluate((el,value)=>{el.textContent=value},label);
   // A title must fit entirely on one line, not just have wrapping disabled.
   const titleFit=await panels.first().locator('.mixer-title').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const rects=Array.from(range.getClientRects());const bounds=el.getBoundingClientRect();return rects.length===1&&rects[0].left>=bounds.left-1&&rects[0].right<=bounds.right+1;});expect(titleFit,`full title ${label} fits at ${size.width}px`).toBe(true);
   for(const panel of await panels.all()){
    const box=await panel.boundingBox();const buttons=await panel.locator('.pitch-buttons > button').all();const left=await buttons[0].boundingBox(),right=await buttons[1].boundingBox();
    expect(box&&left&&right).toBeTruthy();expect(left!.x).toBeGreaterThanOrEqual(box!.x-1);expect(right!.x+right!.width).toBeLessThanOrEqual(box!.x+box!.width+1);expect(left!.x+left!.width).toBeLessThanOrEqual(right!.x+1);expect(Math.abs(left!.y-right!.y)).toBeLessThan(2);expect(Math.abs(left!.width-right!.width)).toBeLessThan(2);
   }
  }
 }
});
