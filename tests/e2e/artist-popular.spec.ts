import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('popular pages preserve provider order, deduplicate and retry without clearing',async({page})=>{
 await mockApi(page);let retries=0;
 const song=(id:string)=>({providerTrackId:id,title:'Popular '+id,artist:'Artist',durationMs:180000,coverUrl:null,providerLyricsFormat:'LRC'});
 await page.route(/^https:\/\/[^/]+\/demo\/artists\/popular(?:\?|$)/,async r=>{
  const q=new URL(r.request().url()).searchParams;
  if(q.has('cursor')){
   expect(q.get('artistId')).toBe('42');expect(q.get('cursor')).toBe('20');
   if(retries++===0)return r.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'}});
   return r.fulfill({json:{artistId:'42',name:'Artist',items:[song('2'),song('3')],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}});
  }
  expect(q.get('name')).toBe('Artist');
  return r.fulfill({json:{artistId:'42',name:'Artist',items:[song('9'),song('2')],nextCursor:'20'},headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.goto('/#/artist/Artist');await page.getByRole('button',{name:'Популярные песни'}).click();
 await expect(page.locator('.track-row .track-title')).toHaveText(['Popular 9','Popular 2']);await expect(page.locator('.track-row').getByText('Создать караоке',{exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Загрузить ещё'}).click();await expect(page.getByRole('button',{name:'Повторить запрос'})).toBeVisible();
 await expect(page.locator('.track-row .track-title')).toHaveText(['Popular 9','Popular 2']);
 await page.getByRole('button',{name:'Повторить запрос'}).click();await expect(page.locator('.track-row .track-title')).toHaveText(['Popular 9','Popular 2','Popular 3']);
 await expect(page.getByRole('button',{name:'Загрузить ещё'})).toHaveCount(0);
});

test('ID-qualified artist route uses ID on initial API request',async({page})=>{await mockApi(page);await page.route(/^https:\/\/[^/]+\/demo\/artists\/popular(?:\?|$)/,async r=>{const q=new URL(r.request().url()).searchParams;expect(q.get('artistId')).toBe('42');expect(q.has('name')).toBe(false);return r.fulfill({json:{artistId:'42',name:'Artist',items:[{providerTrackId:'9',title:'Verified song',artist:'Artist',artistCredits:[{author_id:'42',name:'Artist'}],durationMs:180000}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}})});await page.goto('/#/artist/Artist?author_id=42');await page.getByRole('button',{name:'Популярные песни'}).click();await expect(page.getByRole('button',{name:'Verified song',exact:true})).toBeVisible()});

test('exact artist search puts one artist link above songs and navigates by verified ID',async({page})=>{
 await mockApi(page);
 const items=[{providerTrackId:'201',title:'First song',artist:'Soldatov, Guest',artistCredits:[{author_id:'42',name:'Soldatov'},{author_id:'43',name:'Guest'}],durationMs:8000},{providerTrackId:'202',title:'Second song',artist:'Soldatov',artistCredits:[{author_id:'42',name:'Soldatov'}],durationMs:8000},{providerTrackId:'203',title:'Soldatov',artist:'Different artist',durationMs:8000}];
 await page.route(/^https:\/\/[^/]+\/demo\/search\?/,r=>r.fulfill({json:{items,nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/#/search');const input=page.getByRole('textbox',{name:'Поиск песни'});await input.fill('sold');
 await expect(page.getByRole('button',{name:'First song',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Открыть артиста: Soldatov',exact:true})).toBeVisible();
 await input.fill('SOLDATOV');const artist=page.getByRole('button',{name:'Открыть артиста: Soldatov',exact:true});await expect(artist).toHaveCount(1);await expect(artist).toBeVisible();await expect(page.locator('.track-row')).toHaveCount(3);
 expect(await artist.evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.track-row')!.getBoundingClientRect().top+1)).toBe(true);
 await artist.click();await expect(page).toHaveURL(/#\/artist\/Soldatov\?author_id=42$/);await expect(page.getByRole('heading',{name:'Soldatov',exact:true})).toBeVisible();
});

test('independent SDK artist suggestion shows portrait for surname and reordered diminutive with no matching songs',async({page})=>{
 await mockApi(page);const headers={'Access-Control-Allow-Origin':'*'};
 await page.route(/^https:\/\/[^/]+\/demo\/search\?/,r=>r.fulfill({json:{items:[],artists:[{author_id:'42',name:'Юлия Коган'}],nextCursor:null},headers}));
 await page.route(/^https:\/\/[^/]+\/demo\/artist-artwork\/42$/,r=>r.fulfill({body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOcppHCgA0wYRUdtBIA54YBMulAnr4AAAAASUVORK5CYII=','base64'),contentType:'image/png'}));
 await page.goto('/#/search');const input=page.getByRole('textbox',{name:'Поиск песни'});const artist=page.getByRole('button',{name:'Открыть артиста: Юлия Коган',exact:true});
 await input.fill('Коган');await expect(artist).toBeVisible();await expect(artist.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');
 await input.fill('Коган Юля');await expect(artist).toBeVisible();await artist.click();await expect(page).toHaveURL(/author_id=42$/);
});

test('search song rows are compact without clipping two artist lines or shrinking action targets',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});
 const items=[{providerTrackId:'501',title:'Sleepless',artist:'Anathema',durationMs:251000,providerLyricsFormat:'NONE'},{providerTrackId:'502',title:'Sleepless',artist:'Relaxing With Sounds of Nature and Spa Music Natural White Noise Extended Artist Name',durationMs:251000,providerLyricsFormat:'NONE'}];
 await page.route(/^https:\/\/[^/]+\/demo\/search\?/,r=>r.fulfill({json:{items,nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Sleepless');
 const rows=page.locator('.search-track-list .track-row');await expect(rows).toHaveCount(2);
 const sizes=await rows.evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,actionHeight:el.querySelector('.icon-button')!.getBoundingClientRect().height,artistHeight:el.querySelector('.track-artist-lines')!.getBoundingClientRect().height})));
 expect(sizes[0].height).toBeLessThanOrEqual(64);expect(sizes[1].height).toBeLessThanOrEqual(76);expect(sizes[1].artistHeight).toBeGreaterThan(15);expect(sizes[1].artistHeight).toBeLessThanOrEqual(30);expect(sizes[1].top-sizes[0].bottom).toBeLessThanOrEqual(1);expect(sizes.every(x=>x.actionHeight>=44)).toBe(true);
});
