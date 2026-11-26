import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('only visible artwork is requested, with a stable API URL',async({page})=>{
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,async r=>r.fulfill({json:{items:Array.from({length:60},(_,i)=>({providerTrackId:String(1000+i),title:'Cover test '+i,artist:'Artist',durationSeconds:60,pairOperationId:'00000000-0000-4000-8000-000000000001'})),nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/');await expect(page.locator('.track-row')).toHaveCount(60);
 await expect.poll(()=>api.covers.length).toBeGreaterThan(0);
 expect(api.covers.length).toBeLessThan(60);expect(api.covers).not.toContain('/demo/artwork/1059');
 await page.locator('.track-row').last().scrollIntoViewIfNeeded();
 await expect.poll(()=>api.covers.includes('/demo/artwork/1059')).toBe(true);
 await expect(page.locator('.track-row').last().locator('img')).toHaveAttribute('src',/\/demo\/artwork\/1059$/);
});
