import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('real catalog, search, explicit creation and status',async({page})=>{const api=await mockApi(page);await page.goto('/#/search');const input=page.getByRole('textbox',{name:'Поиск песни'});await input.fill('a');await expect(page.getByText('Введите минимум 2 символа')).toBeVisible();expect(api.requests).toEqual([]);await input.fill('Test song');await page.getByRole('button',{name:'Test song two',exact:true}).click();expect(api.enqueued).toBe(0);await expect(page.getByText('Караоке ещё не создано')).toBeVisible();await expect(page.getByRole('button',{name:'Проверить статус'})).toHaveCount(0);await page.getByRole('button',{name:'Создать караоке'}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible({timeout:10000});await expect(page.getByRole('button',{name:'Открыть караоке'})).toHaveCount(0);expect(api.enqueued).toBe(1);expect(api.media).toBe(2)});
test('ready playback retries lyrics without reloading audio or creating jobs',async({page})=>{const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.getByText('Текст временно недоступен (HTTP 503)',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Повторить загрузку текста'}).click();await expect(page.getByRole('button',{name:'Synthetic test line'})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0)});
test('obsolete data is not shown and API failures never fall back to demo tracks',async({page})=>{const api=await mockApi(page);await page.goto('/#/search');const input=page.getByRole('textbox',{name:'Поиск песни'});await input.fill('Test');await input.fill('Other artist');await expect(page.getByRole('button',{name:'Test song three',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Test song one',exact:true})).toHaveCount(0);await page.route(/^https:\/\/[^/]+\/demo\/search/,r=>r.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},json:{}}));await input.fill('another');await expect(page.getByRole('alert')).toContainText('503');await expect(page.locator('.track-row')).toHaveCount(0);expect(api.enqueued).toBe(0)});

test('ready search result starts automatically without enqueuing',async({page})=>{const api=await mockApi(page);await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Other artist');await page.getByRole('button',{name:'Test song three',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.requests.filter(p=>p==='/demo/catalog/playback')).toHaveLength(1);expect(api.media).toBe(2);expect(api.enqueued).toBe(0)});

test('unknown readiness never offers creation until a successful status response',async({page})=>{
 const api=await mockApi(page);
 let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve});
 await page.route(/^https:\/\/[^/]+\/demo\/karaoke\/status(?:\?|$)/,async route=>{await blocked;await route.fulfill({status:503,json:{},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song');await page.getByRole('button',{name:'Test song two',exact:true}).click();
 try{await expect(page.getByText('Проверяем наличие караоке…')).toBeVisible();await expect(page.getByRole('button',{name:'Создать караоке'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Проверить статус'})).toHaveCount(0)}finally{release()}
 await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Повторить загрузку'})).toBeVisible();await expect(page.getByRole('button',{name:'Создать караоке'})).toHaveCount(0);expect(api.enqueued).toBe(0);
});
test('search marks previously known ready tracks and opens them without a status roundtrip',async({page})=>{
 const api=await mockApi(page);await page.goto('/');await expect(page.getByText('Караоке готово',{exact:true}).first()).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Поиск',exact:true}).click();await page.getByRole('textbox',{name:'Поиск песни'}).fill('Other artist');const row=page.locator('.track-row').filter({has:page.getByRole('button',{name:'Test song three',exact:true})});await expect(row.getByText('Караоке готово')).toBeVisible();
 await row.getByRole('button',{name:'Test song three',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.requests.filter(p=>p==='/demo/karaoke/status')).toHaveLength(0);expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

test('fresh search renders confirmed ready badges before selection and plays without auth, status or creation',async({page})=>{
 const api=await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';let playbackBody:unknown;
 await page.route(/^https:\/\/[^/]+\/demo\/search(?:\?|$)/,route=>route.fulfill({json:{items:[
 {providerTrackId:'101',title:'Ready from search',artist:'Artist',durationMs:8000,karaokeStatus:{state:'ready',pairOperationId:pair}},
 {providerTrackId:'102',title:'Unknown result',artist:'Artist',durationMs:8000,karaokeStatus:{state:'unknown',pairOperationId:pair}},
 {providerTrackId:'103',title:'Invalid pair',artist:'Artist',durationMs:8000,karaokeStatus:{state:'ready',pairOperationId:'invalid'}},
 {providerTrackId:'104',title:'Legacy result',artist:'Artist',durationMs:8000}
 ],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/playback$/,async route=>{if(route.request().method()==='POST')playbackBody=route.request().postDataJSON();await route.fallback()});
 await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Ready');
 const rows=page.locator('.track-row');await expect(rows).toHaveCount(4);
 await expect(rows.nth(0).getByText('Караоке готово',{exact:true})).toBeVisible();
 for(let i=1;i<4;i++)await expect(rows.nth(i).getByText('Караоке готово',{exact:true})).toHaveCount(0);
 expect(api.requests.filter(p=>p.includes('/karaoke/status')||p==='/demo/auth')).toEqual([]);
 await rows.nth(0).getByRole('button',{name:'Ready from search',exact:true}).click();
 await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 expect(playbackBody).toEqual({pairOperationId:pair,providerTrackId:'101'});expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
 expect(api.requests.filter(p=>p.includes('/karaoke/status')||p==='/demo/auth')).toEqual([]);
});
test('unknown search readiness retains status check on selection and does not create automatically',async({page})=>{
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/search(?:\?|$)/,route=>route.fulfill({json:{items:[{providerTrackId:'102',title:'Unknown song',artist:'Artist',durationMs:8000,karaokeStatus:{state:'unknown'}}]},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Unknown');await expect(page.getByRole('button',{name:'Unknown song',exact:true})).toBeVisible();
 await expect(page.getByText('Караоке готово',{exact:true})).toHaveCount(0);expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Unknown song',exact:true}).click();await expect(page.getByRole('button',{name:'Создать караоке'})).toBeVisible();expect(api.requests.filter(p=>p==='/demo/karaoke/status')).toHaveLength(1);expect(api.enqueued).toBe(0);
});
