import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('system media controls publish metadata, seek both stems, pause, resume and clean up',async({page})=>{
 await page.addInitScript(()=>{
  const handlers:Record<string,((details:Record<string,unknown>)=>void)|null>={};
  const session={metadata:null as MediaMetadata|null,playbackState:'none',position:null as MediaPositionState|null,setActionHandler(action:string,handler:typeof handlers[string]){handlers[action]=handler},setPositionState(value?:MediaPositionState){this.position=value??null}};
  Object.defineProperty(navigator,'mediaSession',{configurable:true,value:session});
  Object.defineProperty(window,'__systemMedia',{value:{session,handlers}});
 });
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 const state=()=>page.evaluate(()=>{const {session,handlers}=(window as any).__systemMedia;return {title:session.metadata?.title,artist:session.metadata?.artist,artwork:session.metadata?.artwork[0]?.src,playback:session.playbackState,position:session.position,actions:Object.keys(handlers).filter(k=>handlers[k])}});
 await expect.poll(async()=> (await state()).title).toBe('Test song one');expect((await state()).artist).toBe('Test artist');expect((await state()).artwork).toMatch(/\/demo\/artwork\/101$/);expect((await state()).position.duration).toBeCloseTo(8,3);
 const action=async(name:string,details:Record<string,unknown>={})=>page.evaluate(({name,details})=>(window as any).__systemMedia.handlers[name](details),{name,details});
 await action('pause');await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeVisible();await expect.poll(async()=>(await state()).playback).toBe('paused');
 await action('seekto',{seekTime:4});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('4');await expect.poll(async()=>(await state()).position.position).toBe(4);
 await action('seekbackward',{seekOffset:2});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('2');
 await action('seekforward',{seekOffset:1});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('3');
 await action('previoustrack');await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('0');
 await action('nexttrack');
 // Decoded audio may end a fraction of a sample before 8 s; the range
 // snaps to its 0.1s step, but Media Session must retain the exact end.
 await expect(page.getByText('Песня закончилась',{exact:true})).toBeVisible();
 await expect.poll(async()=>{const p=(await state()).position;return Math.abs(p.position-p.duration)}).toBeLessThan(.001);
 await action('seekto',{seekTime:3,fastSeek:true});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('3');
 await page.evaluate(()=>{(window as any).__systemMedia.session.position=null;document.dispatchEvent(new Event('visibilitychange'))});await expect.poll(async()=>(await state()).position?.position).toBe(3);
 await action('play');await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect.poll(async()=>(await state()).playback).toBe('playing');
 await action('seekto',{seekTime:5});await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Позиция песни'}).inputValue())).toBeGreaterThanOrEqual(5);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();await expect.poll(async()=>(await state()).actions).toEqual([]);expect((await state()).playback).toBe('none');expect((await state()).title).toBeUndefined();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

test('CarPlay mode persists and requests play-and-record without microphone access',async({page})=>{
 await page.addInitScript(()=>{
 const session={type:'auto'};Object.defineProperty(navigator,'audioSession',{configurable:true,value:session});
 Reflect.set(window,'__captureRequests',0);
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{Reflect.set(window,'__captureRequests',Number(Reflect.get(window,'__captureRequests'))+1);throw Error('No capture expected')}});
 });
 await mockApi(page);await page.goto('/#/profile');const mode=page.getByRole('combobox',{name:'Режим аудиовыхода'});await expect(mode).toHaveValue('auto');await mode.selectOption('carplay');await page.reload();await expect(mode).toHaveValue('carplay');
 await page.getByRole('navigation').getByRole('button',{name:'Главная',exact:true}).click();await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 const session=()=>page.evaluate(()=>(navigator as Navigator&{audioSession:{type:string}}).audioSession.type);await expect.poll(session).toBe('play-and-record');
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('slider',{name:'Позиция песни'}).fill('3');await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect.poll(session).toBe('play-and-record');await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(await page.evaluate(()=>Reflect.get(window,'__captureRequests'))).toBe(0);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Профиль',exact:true}).click();await mode.selectOption('standard');await page.getByRole('navigation').getByRole('button',{name:'Главная',exact:true}).click();await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect.poll(session).toBe('playback');
});
