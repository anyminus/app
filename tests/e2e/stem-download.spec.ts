import {test,expect} from '@playwright/test';
import {mockApi} from './fixture';
test('stem progress survives background interruption and resumes the byte range',async({page})=>{
 await page.addInitScript(()=>{
  const fetchOriginal=window.fetch.bind(window);let injected=false;
  Reflect.set(window,'__stemRanges',[]);Reflect.set(window,'__stemHidden',false);
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>Reflect.get(window,'__stemHidden')});
  window.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(!/\/demo\/catalog\/media\/[^/]+\/vocals$/.test(url))return fetchOriginal(input,init);
   const range=new Headers(init?.headers).get('Range');(Reflect.get(window,'__stemRanges') as (string|null)[]).push(range);
   const response=await fetchOriginal(input,init);
   if(injected)return response;injected=true;
   const bytes=new Uint8Array(await response.arrayBuffer());
   return new Response(new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,100000));Reflect.set(window,'__breakStem',()=>{Reflect.set(window,'__stemHidden',true);document.dispatchEvent(new Event('visibilitychange'));controller.error(new TypeError('Load failed'));});}}),{headers:{'content-length':String(bytes.length)}});
  };
 });
 await mockApi(page);
 const wav=Buffer.alloc(44+384000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(384000,40);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/vocals$/,async r=>{
  const headers={'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'range','Access-Control-Expose-Headers':'Content-Range','Accept-Ranges':'bytes'};
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  const range=r.request().headers().range;if(range){const start=Number(range.match(/^bytes=(\d+)-$/)?.[1]);expect(start).toBe(100000);return r.fulfill({status:206,body:wav.subarray(start),contentType:'audio/wav',headers:{...headers,'Content-Range':'bytes '+start+'-'+(wav.length-1)+'/'+wav.length,'Content-Length':String(wav.length-start)}})}
  return r.fulfill({body:wav,contentType:'audio/wav',headers:{...headers,'Content-Length':String(wav.length)}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();
 const panel=page.getByRole('region',{name:'Загрузка аудиодорожек'}),voice=panel.getByRole('progressbar',{name:'Загрузка голоса'});
 await expect(voice).toHaveAttribute('value','100000');await expect(panel).toContainText('0,10 МБ / 0,38 МБ');
 await page.evaluate(()=>Reflect.get(window,'__breakStem')());await expect(page.getByText('Загрузка приостановлена',{exact:true})).toBeVisible();
 await expect(voice).toHaveAttribute('value','100000');expect(await page.evaluate(()=>Reflect.get(window,'__stemRanges'))).toEqual([null]);
 await page.evaluate(()=>{Reflect.set(window,'__stemHidden',false);document.dispatchEvent(new Event('visibilitychange'))});
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible({timeout:15000});await expect(panel).toHaveCount(0);
 expect(await page.evaluate(()=>Reflect.get(window,'__stemRanges'))).toEqual([null,'bytes=100000-']);
});

test('completed stems survive reload, still require playback grant, and profile can clear cache',async({page})=>{
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();const slider=page.getByRole('slider',{name:'Позиция песни'});await expect(slider).toBeEnabled({timeout:15000});expect(api.media).toBe(2);
 const grants=api.requests.filter(p=>p==='/demo/catalog/playback').length;
 await page.reload();await expect(slider).toBeEnabled({timeout:15000});expect(api.media).toBe(2);expect(api.requests.filter(p=>p==='/demo/catalog/playback').length).toBeGreaterThan(grants);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Профиль',exact:true}).click();
 const clear=page.getByRole('button',{name:'Очистить кеш',exact:true});await expect(clear).toBeEnabled();await clear.click();await expect(clear).toBeDisabled();
 await page.getByRole('navigation').getByRole('button',{name:'Главная',exact:true}).click();await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(slider).toBeEnabled({timeout:15000});expect(api.media).toBe(4);
});

test('partial stem checkpoint survives page reload and resumes missing bytes',async({page})=>{
 await page.addInitScript(()=>{
  const fetchOriginal=window.fetch.bind(window);let injected=sessionStorage.getItem('partial-injected')==='1';
  Reflect.set(window,'__stemRanges',[]);Reflect.set(window,'__stemHidden',false);
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>Reflect.get(window,'__stemHidden')});
  window.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(!/\/demo\/catalog\/media\/[^/]+\/vocals$/.test(url))return fetchOriginal(input,init);
   const range=new Headers(init?.headers).get('Range');(Reflect.get(window,'__stemRanges') as (string|null)[]).push(range);
   const response=await fetchOriginal(input,init);
   if(injected)return response;injected=true;sessionStorage.setItem('partial-injected','1');
   const bytes=new Uint8Array(await response.arrayBuffer());
   return new Response(new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,100000));Reflect.set(window,'__breakStem',()=>{Reflect.set(window,'__stemHidden',true);document.dispatchEvent(new Event('visibilitychange'));controller.error(new TypeError('Load failed'));});}}),{headers:{'content-length':String(bytes.length)}});
  };
 });
 await mockApi(page);
 const wav=Buffer.alloc(44+384000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(384000,40);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/vocals$/,async r=>{
  const headers={'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'range','Access-Control-Expose-Headers':'Content-Range','Accept-Ranges':'bytes'};
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  const range=r.request().headers().range;if(range){const start=Number(range.match(/^bytes=(\d+)-$/)?.[1]);expect(start).toBe(100000);return r.fulfill({status:206,body:wav.subarray(start),contentType:'audio/wav',headers:{...headers,'Content-Range':'bytes '+start+'-'+(wav.length-1)+'/'+wav.length,'Content-Length':String(wav.length-start)}})}
  return r.fulfill({body:wav,contentType:'audio/wav',headers:{...headers,'Content-Length':String(wav.length)}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();
 const panel=page.getByRole('region',{name:'Загрузка аудиодорожек'}),voice=panel.getByRole('progressbar',{name:'Загрузка голоса'});
 await expect(voice).toHaveAttribute('value','100000');await expect(panel).toContainText('0,10 МБ / 0,38 МБ');

 await expect.poll(()=>page.evaluate(async()=>new Promise<number>(resolve=>{const req=indexedDB.open('anyminus-stems-v1',1);req.onerror=()=>resolve(0);req.onsuccess=()=>{const db=req.result;try{const tx=db.transaction('stems','readonly'),all=tx.objectStore('stems').getAll();all.onsuccess=()=>{resolve(all.result.find((e:{key:string})=>e.key.endsWith('/vocals'))?.data.size??0);db.close()};all.onerror=()=>{db.close();resolve(0)}}catch{db.close();resolve(0)}}}))).toBe(100000);
 await page.reload();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});expect(await page.evaluate(()=>Reflect.get(window,'__stemRanges'))).toEqual(['bytes=100000-']);
});
