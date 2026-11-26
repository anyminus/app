import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('audio session is prepared for playback and gain graph emits a nonzero signal',async({page})=>{
 await page.addInitScript(()=>{
 const session={type:'auto'};Object.defineProperty(navigator,'audioSession',{configurable:true,value:session});
 const state={session,contexts:[] as AudioContext[],meters:[] as AnalyserNode[]};
 Object.defineProperty(window,'__audioTest',{value:state});
 const original=AudioContext.prototype.createGain;
 AudioContext.prototype.createGain=function(){const gain=original.call(this);const meter=this.createAnalyser();meter.fftSize=256;gain.connect(meter);state.meters.push(meter);if(!state.contexts.includes(this))state.contexts.push(this);return gain};
 });
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Открыть караоке'}).click();
 await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeVisible();
 expect(await page.evaluate(()=> (window as any).__audioTest.session.type)).toBe('playback');
 await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>{const t=(window as any).__audioTest;return t.meters.map((m:AnalyserNode)=>{const data=new Float32Array(m.fftSize);m.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs))}).some((peak:number)=>peak>0.01)}),{intervals:[25,50,100],timeout:1500}).toBe(true);
 await page.getByRole('button',{name:'Приглушить: Музыка'}).click();await page.getByRole('button',{name:'Приглушить: Голос артиста'}).click();await expect(page.getByRole('button',{name:'Звук выключен · Включить музыку'})).toBeVisible();await page.getByRole('button',{name:'Звук выключен · Включить музыку'}).click();await expect(page.getByRole('slider',{name:'Музыка'})).toHaveValue('100');expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});
