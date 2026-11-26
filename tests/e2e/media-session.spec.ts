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
 await expect.poll(async()=> (await state()).title).toBe('Test song one');expect((await state()).artist).toBe('Test artist');expect((await state()).artwork).toMatch(/\/demo\/artwork\/101$/);expect((await state()).position.duration).toBe(8);
 const action=async(name:string,details:Record<string,unknown>={})=>page.evaluate(({name,details})=>(window as any).__systemMedia.handlers[name](details),{name,details});
 await action('pause');await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeVisible();await expect.poll(async()=>(await state()).playback).toBe('paused');
 await action('seekto',{seekTime:4});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('4');await expect.poll(async()=>(await state()).position.position).toBe(4);
 await action('seekbackward',{seekOffset:2});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('2');
 await action('seekforward',{seekOffset:1});await expect(page.getByRole('slider',{name:'Позиция песни'})).toHaveValue('3');
 await action('play');await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect.poll(async()=>(await state()).playback).toBe('playing');
 await action('seekto',{seekTime:5});await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Позиция песни'}).inputValue())).toBeGreaterThanOrEqual(5);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();await expect.poll(async()=>(await state()).actions).toEqual([]);expect((await state()).playback).toBe('none');expect((await state()).title).toBeUndefined();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});
