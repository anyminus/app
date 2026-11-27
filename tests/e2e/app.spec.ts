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

test('shared track beyond first catalog page uses real title and artist without auth or metadata',async({page})=>{
 const api=await mockApi(page);let pages=0,auth=0;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,async route=>{pages++;const cursor=new URL(route.request().url()).searchParams.get('cursor');await route.fulfill({json:cursor?{items:[{providerTrackId:'330786',title:'Real title from second page',artist:'Real artist',durationSeconds:8,pairOperationId:'00000000-0000-4000-8000-000000000001'}],nextCursor:null}:{items:[],nextCursor:'101'},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.route(/^https:\/\/[^/]+\/demo\/auth$/,async route=>{auth++;await route.fulfill({status:502,json:{},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.goto('/#/track/330786');await expect(page.getByRole('heading',{name:'Real title from second page'})).toBeVisible();await expect(page.getByRole('button',{name:'Real artist',exact:true})).toBeVisible();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});expect(pages).toBe(2);expect(auth).toBe(0);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});
test('shared link recovers from a transient auth gateway error',async({page})=>{
 const api=await mockApi(page);let attempts=0;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,route=>route.fulfill({json:{items:[],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/auth$/,async route=>{if(route.request().method()==='OPTIONS'){await route.fallback();return}attempts++;if(attempts===1)await route.fulfill({status:502,json:{},headers:{'Access-Control-Allow-Origin':'*'}});else await route.fallback()});
 await page.goto('/#/track/101');await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});expect(attempts).toBe(2);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

import {readFileSync} from 'node:fs';
const appVersion=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version as string;
test('home and profile display the package version',async({page})=>{await mockApi(page);await page.goto('/#/home');await expect(page.locator('.brand-header .app-version')).toHaveText('v'+appVersion);await page.getByRole('navigation').getByRole('button',{name:'Профиль',exact:true}).click();await expect(page.getByText('ANYMINUS '+appVersion,{exact:true})).toBeVisible()});

test('published release notice is global, does not reload automatically, and supports later or explicit reload',async({page})=>{
 await mockApi(page);let published=appVersion;let requests=0;
 await page.route(/\/version\.json(?:\?|$)/,r=>{requests++;return r.fulfill({json:{schemaVersion:1,version:published,highlights:['Новый темп','Переход к артисту']}})});
 await page.goto('/#/home');const notice=page.getByRole('complementary',{name:'Уведомление об обновлении'});await expect.poll(()=>requests).toBeGreaterThan(0);await expect(notice).toHaveCount(0);
 await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 published='999.1.0';await page.waitForTimeout(3100);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(notice).toContainText('v999.1.0');await expect(notice).toContainText('Новый темп');await expect(notice).toContainText('Переход к артисту');await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page).toHaveURL(/#\/track\/101$/);
 await notice.getByRole('button',{name:'Позже'}).click();await expect(notice).toHaveCount(0);
 published='999.2.0';await page.waitForTimeout(3100);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(notice).toContainText('v999.2.0');
 published=appVersion;await Promise.all([page.waitForEvent('load'),notice.getByRole('button',{name:'Обновить страницу'}).click()]);await expect(page).toHaveURL(/#\/track\/101$/);await expect(notice).toHaveCount(0);
});
test('built Pages artifact exposes exactly its packaged version',async({request})=>{const r=await request.get('/version.json');expect(r.ok()).toBeTruthy();const manifest=await r.json();expect(manifest).toMatchObject({schemaVersion:1,version:appVersion});expect(manifest.highlights.length).toBeLessThanOrEqual(2)});


test('optional playback settings travel in the song link without overwriting recipient preferences',async({page})=>{
 await mockApi(page);await page.addInitScript(()=>{if(!sessionStorage.getItem('share-preset-test')){localStorage.setItem('anyminus:music','70');localStorage.setItem('anyminus:vocals','15');sessionStorage.setItem('share-preset-test','1')}});
 await page.goto('/#/track/101?music=85&vocals=23&musicMuted=0&vocalsMuted=1&pitch=-2&speed=1.2');
 await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});await expect(page.getByRole('slider',{name:'Музыка',exact:true})).toHaveValue('85');await expect(page.getByRole('button',{name:'Приглушить: Голос артиста'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByLabel('Тональность в полутонах')).toHaveText('-2');await expect(page.getByLabel('Скорость воспроизведения')).toHaveText('1.2×');
 await page.getByRole('button',{name:'Поделиться песней',exact:true}).click();const sheet=page.getByRole('dialog',{name:'Поделиться песней'}),checkbox=sheet.getByRole('checkbox',{name:/Передать настройки воспроизведения/}),link=sheet.getByRole('textbox',{name:'Ссылка для отправки'});
 await expect(checkbox).not.toBeChecked();await expect(link).toHaveValue(/#\/track\/101$/);await checkbox.check();await expect(link).toHaveValue(/music=85&vocals=23&musicMuted=0&vocalsMuted=1&pitch=-2&speed=1\.2$/);await checkbox.uncheck();await expect(link).toHaveValue(/#\/track\/101$/);await sheet.getByRole('button',{name:'Закрыть',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('anyminus:music'))).toBe('70');expect(await page.evaluate(()=>localStorage.getItem('anyminus:vocals'))).toBe('15');
 await page.evaluate(()=>{location.hash='#/track/101'});await expect(page.getByRole('slider',{name:'Музыка',exact:true})).toHaveValue('70');await expect(page.getByRole('slider',{name:'Голос артиста',exact:true})).toHaveValue('15');await expect(page.getByLabel('Тональность в полутонах')).toHaveText('0');await expect(page.getByLabel('Скорость воспроизведения')).toHaveText('1.0×');
});
