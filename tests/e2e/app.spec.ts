import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('catalog, artist, sharing and favorite persistence with real IDs',async({page})=>{await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'В любимое',exact:true}).click();await page.getByRole('button',{name:'Поделиться песней',exact:true}).click();await expect(page.getByRole('textbox',{name:'Ссылка для отправки'})).toHaveValue(/#\/track\/101$/);await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.getByRole('button',{name:'Test artist',exact:true}).click();await expect(page.getByRole('heading',{name:'Test artist',exact:true})).toBeVisible();await page.getByRole('button',{name:'Test song one',exact:true}).waitFor();await page.getByRole('navigation').getByRole('button',{name:'Любимое'}).click();await page.reload();await expect(page.getByRole('button',{name:'Test song one',exact:true})).toBeVisible()});
test('shared track link loads both stems from API without local cache',async({page})=>{const api=await mockApi(page);await page.goto('/#/track/101');await expect(page.getByRole('heading',{name:'Test song one'})).toBeVisible();await expect.poll(()=>api.media).toBe(2);await expect(page.getByRole('region',{name:'Плеер караоке'})).toBeVisible();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:10000});await expect(page.getByRole('button',{name:'Открыть караоке'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Проверить статус'})).toHaveCount(0)});

test('shared ready link survives persistent upstream metadata HTTP 502',async({page})=>{
 const api=await mockApi(page);let attempts=0;let firstCatalog=true;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,async route=>{if(firstCatalog){firstCatalog=false;await route.fulfill({status:503,json:{},headers:{'Access-Control-Allow-Origin':'*'}})}else await route.fallback()});
 await page.route(/^https:\/\/[^/]+\/demo\/track-metadata\/101$/,async route=>{attempts++;await route.fulfill({status:502,json:{error:{code:'provider_unavailable'}},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.goto('/#/track/101');await expect(page.getByRole('heading',{name:'Test song one'})).toBeVisible({timeout:15000});await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});expect(attempts).toBe(2);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});
test('transient 502 on a shared link recovers with one retry',async({page})=>{
 const api=await mockApi(page);let attempts=0;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,route=>route.fulfill({json:{items:[],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/track-metadata\/101$/,async route=>{attempts++;if(attempts===1)await route.fulfill({status:502,json:{},headers:{'Access-Control-Allow-Origin':'*'}});else await route.fallback()});
 await page.goto('/#/track/101');await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});expect(attempts).toBe(2);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

test('shared ready link opens without auth even when auth is rate limited',async({page})=>{
 const api=await mockApi(page);let auth=0;await page.route(/^https:\/\/[^/]+\/demo\/auth$/,async route=>{auth++;await route.fulfill({status:429,json:{},headers:{'Access-Control-Allow-Origin':'*','Retry-After':'30'}})});
 await page.goto('/#/track/101');await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});expect(auth).toBe(0);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);expect(api.requests.filter(p=>p.startsWith('/demo/track-metadata/'))).toHaveLength(0);
});
test('rate limited cold link does not issue repeated auth requests before cooldown',async({page})=>{
 await mockApi(page);let auth=0;await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,route=>route.fulfill({json:{items:[],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/auth$/,async route=>{if(route.request().method()==='OPTIONS'){await route.fallback();return}auth++;await route.fulfill({status:429,json:{},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Retry-After','Retry-After':'30'}})});
 await page.goto('/#/track/24442527');await expect(page.getByRole('alert')).toContainText('HTTP 429');await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByRole('alert')).toContainText('HTTP 429');expect(auth).toBe(1);
});
