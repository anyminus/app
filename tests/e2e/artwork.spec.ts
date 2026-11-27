import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('only visible artwork is requested, with a stable API URL',async({page})=>{
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,async r=>r.fulfill({json:{items:Array.from({length:60},(_,i)=>({providerTrackId:String(1000+i),title:'Cover test '+i,artist:'Artist',durationSeconds:60,pairOperationId:'00000000-0000-4000-8000-000000000001'})),nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/');await expect(page.locator('.track-row')).toHaveCount(60);
 await expect.poll(()=>api.covers.length).toBeGreaterThan(0);
 expect(api.covers.length).toBeLessThan(60);expect(api.covers).not.toContain('/demo/artwork/1059');
 await page.locator('.track-row').last().scrollIntoViewIfNeeded();
 await expect.poll(()=>api.covers.includes('/demo/artwork/1059')).toBe(true);
 const image=page.locator('.track-row').last().locator('img');await expect(image).toHaveAttribute('src',/\/demo\/artwork\/1059$/);expect(await image.getAttribute('crossorigin')).toBeNull();await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(8);await expect(image).toHaveClass(/loaded/);await expect(image).toHaveCSS('opacity','1');
});

test('unavailable artwork retains placeholder and valid covers really render',async({page})=>{await mockApi(page);await page.route(/^https:\/\/[^/]+\/demo\/artwork\/101$/,route=>route.fulfill({status:404,headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}}));await page.goto('/');const first=page.locator('.track-row').first(),second=page.locator('.track-row').nth(1);await expect(first.locator('.cover-slot')).toHaveAttribute('data-cover-state','unavailable');await expect(first.locator('.artwork svg')).toBeVisible();await expect(second.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await expect(second.locator('img')).toHaveCSS('opacity','1');await expect.poll(()=>second.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(8)});

test('public artwork renders without CORS response header in search, favorites, share and player',async({page})=>{
 const api=await mockApi(page);const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOcppHCgA0wYRUdtBIA54YBMulAnr4AAAAASUVORK5CYII=','base64');
 await page.route(/^https:\/\/[^/]+\/demo\/artwork\/\d+$/,r=>r.fulfill({body:png,contentType:'image/png',headers:{'Cache-Control':'public, max-age=31536000, immutable'}}));
 await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song one');
 const row=page.locator('.track-row').first();await expect(row.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await row.getByRole('button',{name:'В любимое',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Любимое'}).click();await expect(row.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');
 await row.getByRole('button',{name:'Поделиться Test song one'}).click();await expect(page.getByRole('dialog').locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await row.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.locator('.karaoke-header .cover-slot')).toHaveAttribute('data-cover-state','loaded');expect(api.enqueued).toBe(0);
});

test('catalog and search use supplied artwork URL; missing metadata retries stable endpoint',async({page})=>{
 await mockApi(page);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOcppHCgA0wYRUdtBIA54YBMulAnr4AAAAASUVORK5CYII=','base64');
 await page.route(/^https:\/\/[^/]+\/demo\/(catalog|search)(?:\?|$)/,r=>{
 const ready=new URL(r.request().url()).pathname.endsWith('/catalog');
 return r.fulfill({json:{items:[{providerTrackId:'101',title:'Versioned cover',artist:'Artist',durationMs:8000,durationSeconds:8,pairOperationId:'00000000-0000-4000-8000-000000000001',coverUrl:'/demo/artwork/101?v=2'},{providerTrackId:'102',title:'No cover',artist:'Artist',durationMs:8000,durationSeconds:8,pairOperationId:'00000000-0000-4000-8000-000000000001',coverUrl:null}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.route(/^https:\/\/[^/]+\/demo\/artwork\/102$/,r=>r.fulfill({status:404,headers:{'Cache-Control':'no-store'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/artwork\/101\?v=2$/,r=>r.fulfill({body:png,contentType:'image/png',headers:{'Cache-Control':'public, max-age=3600'}}));
 for(const route of ['/#/home','/#/search']){
  await page.goto(route);if(route.endsWith('search'))await page.getByRole('textbox',{name:'Поиск песни'}).fill('Cover');
  const rows=page.locator('.track-row');await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await expect(rows.nth(0).locator('img')).toHaveAttribute('src',/\/demo\/artwork\/101\?v=2$/);
  await expect(rows.nth(1).locator('.cover-slot')).toHaveAttribute('data-cover-state','unavailable');await expect(rows.nth(1).locator('img')).toHaveCount(0);await expect(rows.nth(1).locator('.artwork svg')).toBeVisible();
 }
});

test('provider CDN cover uses stable server fallback if the image fails',async({page})=>{
 const api=await mockApi(page);const direct='https://avatars.yandex.net/get-music-content/123/example/200x200';
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>r.fulfill({json:{items:[{providerTrackId:'101',title:'Fallback cover',artist:'Artist',durationSeconds:8,pairOperationId:'00000000-0000-4000-8000-000000000001',coverUrl:direct}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 let attempts=0;await page.route(direct,r=>{attempts++;return r.fulfill({status:404})});
 await page.goto('/');const row=page.locator('.track-row').first();await expect(row.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await expect(row.locator('img')).toHaveAttribute('src',/\/demo\/artwork\/101$/);expect(attempts).toBe(1);expect(api.covers).toContain('/demo/artwork/101');
});

test('artist page ready tab loads a portrait by canonical artist ID',async({page})=>{
 await mockApi(page);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOcppHCgA0wYRUdtBIA54YBMulAnr4AAAAASUVORK5CYII=','base64');
 await page.route(/^https:\/\/[^/]+\/demo\/artist-artwork\/42$/,r=>r.fulfill({body:png,contentType:'image/png'}));
 await page.goto('/#/artist/Test?author_id=42');
 const cover=page.locator('.artist-profile-art .cover-slot');await expect(cover).toHaveAttribute('data-cover-state','loaded');await expect(cover.locator('img')).toHaveAttribute('src',/\/demo\/artist-artwork\/42$/);await expect.poll(()=>cover.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(8);
});

test('karaoke cover toggles proportional blurred full-player background without changing mixer or audio',async({page})=>{
 const api=await mockApi(page);await page.setViewportSize({width:390,height:664});await page.goto('/');
 await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const cover=page.getByRole('button',{name:'Фон из обложки',exact:true}),background=page.locator('.karaoke-cover-background'),screen=page.locator('.karaoke-screen');
 await expect(cover.locator('.cover-slot')).toHaveAttribute('data-cover-state','loaded');await expect(cover).toHaveAttribute('aria-pressed','false');await expect(background).toHaveCount(0);
 const src=await cover.locator('img').evaluate((el:HTMLImageElement)=>el.currentSrc);
 await cover.click();await expect(cover).toHaveAttribute('aria-pressed','true');await expect(background.locator('img')).toHaveAttribute('src',src);await expect(background.locator('img')).toHaveCSS('object-fit','cover');await expect(background.locator('img')).toHaveCSS('filter','blur(90px)');await expect(background).toHaveCSS('pointer-events','none');await expect.poll(()=>background.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
 async function fullScreen(){const a=(await background.boundingBox())!,b=(await screen.boundingBox())!;expect(Math.abs(a.width-b.width)).toBeLessThan(1);expect(Math.abs(a.height-b.height)).toBeLessThan(1)}
 await fullScreen();await page.getByRole('button',{name:'Свернуть микшер',exact:true}).click();await expect(background).toBeVisible();await expect(cover).toBeVisible();await page.setViewportSize({width:667,height:375});await fullScreen();
 await cover.click();await expect(background).toHaveCount(0);await expect(cover).toHaveAttribute('aria-pressed','false');await expect(page.getByRole('button',{name:'Воспроизвести',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});
test('missing cover never enables a broken karaoke background',async({page})=>{
 await mockApi(page);await page.route(/^https:\/\/[^/]+\/demo\/artwork\/101$/,r=>r.fulfill({status:404}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();const cover=page.getByRole('button',{name:'Фон из обложки',exact:true});await expect(cover.locator('.cover-slot')).toHaveAttribute('data-cover-state','unavailable');await cover.click();await expect(cover).toHaveAttribute('aria-pressed','false');await expect(page.locator('.karaoke-cover-background')).toHaveCount(0);
});
