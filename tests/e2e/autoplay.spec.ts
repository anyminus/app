import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('one tap opens the loading player, then plays exactly two stems',async({page})=>{
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('region',{name:'Плеер караоке'})).toBeVisible();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Открыть караоке'})).toHaveCount(0);
 expect(api.requests.filter(p=>p==='/demo/catalog/playback')).toHaveLength(1);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();
 await page.getByRole('button',{name:'Открыть Test song two',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(4);
});
test('if automatic start fails, loaded audio can be started by a manual tap without refetching',async({page})=>{
 await page.addInitScript(()=>{const original=AudioBufferSourceNode.prototype.start;let first=true;AudioBufferSourceNode.prototype.start=function(...args:Parameters<AudioBufferSourceNode['start']>){if(first){first=false;throw new DOMException('Автовоспроизведение заблокировано','NotAllowedError')}return original.apply(this,args)}});
 const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Автовоспроизведение заблокировано');await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);
});

test('media loading error offers retry rather than a redundant open button',async({page})=>{
 const api=await mockApi(page);let fails=true;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/playback$/,async r=>{if(fails){fails=false;await r.fulfill({status:503,json:{},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}})}else await r.fallback()});
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Повторить загрузку дорожек'})).toBeVisible();await expect(page.getByRole('button',{name:'Открыть караоке'})).toHaveCount(0);await page.getByRole('button',{name:'Повторить загрузку дорожек'}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

test('track rows retain artwork, title, artist, favorite and share without duplicate play action',async({page})=>{await mockApi(page);await page.goto('/');const row=page.locator('.track-row').first();await expect(row.getByRole('button',{name:'Test song one',exact:true})).toBeVisible();await expect(row.getByRole('button',{name:'Открыть Test song one',exact:true})).toBeVisible();await expect(row.getByRole('button',{name:'Test artist',exact:true})).toBeVisible();await expect(row.getByRole('button',{name:'В любимое',exact:true})).toBeVisible();await expect(row.getByRole('button',{name:'Поделиться Test song one',exact:true})).toBeVisible();await expect(row.getByRole('button',{name:/^Петь /})).toHaveCount(0);await expect(row.getByRole('button')).toHaveCount(5)});
