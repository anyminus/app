import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('popular pages preserve provider order, deduplicate and retry without clearing',async({page})=>{
 await mockApi(page);let retries=0;
 const song=(id:string)=>({providerTrackId:id,title:'Popular '+id,artist:'Artist',durationMs:180000,coverUrl:null});
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
 await expect(page.locator('.track-row .track-title')).toHaveText(['Popular 9','Popular 2']);
 await page.getByRole('button',{name:'Загрузить ещё'}).click();await expect(page.getByRole('button',{name:'Повторить запрос'})).toBeVisible();
 await expect(page.locator('.track-row .track-title')).toHaveText(['Popular 9','Popular 2']);
 await page.getByRole('button',{name:'Повторить запрос'}).click();await expect(page.locator('.track-row .track-title')).toHaveText(['Popular 9','Popular 2','Popular 3']);
 await expect(page.getByRole('button',{name:'Загрузить ещё'})).toHaveCount(0);
});

test('ID-qualified artist route uses ID on initial API request',async({page})=>{await mockApi(page);await page.route(/^https:\/\/[^/]+\/demo\/artists\/popular(?:\?|$)/,async r=>{const q=new URL(r.request().url()).searchParams;expect(q.get('artistId')).toBe('42');expect(q.has('name')).toBe(false);return r.fulfill({json:{artistId:'42',name:'Artist',items:[{providerTrackId:'9',title:'Verified song',artist:'Artist',artistCredits:[{author_id:'42',name:'Artist'}],durationMs:180000}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}})});await page.goto('/#/artist/Artist?author_id=42');await page.getByRole('button',{name:'Популярные песни'}).click();await expect(page.getByRole('button',{name:'Verified song'})).toBeVisible()});
