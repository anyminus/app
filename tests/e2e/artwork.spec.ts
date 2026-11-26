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
