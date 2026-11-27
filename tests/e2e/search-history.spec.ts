import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('recent submitted searches replay, persist, deduplicate and can be removed',async({page})=>{
 await mockApi(page);await page.goto('/#/search');
 const input=page.getByRole('textbox',{name:'Поиск песни'}),history=page.getByRole('region',{name:'История поиска'});
 const search=async(q:string)=>{const request=page.waitForRequest(r=>new URL(r.url()).pathname==='/demo/search'&&new URL(r.url()).searchParams.get('q')===q);await input.fill(q);await request;};
 const clear=()=>page.getByRole('button',{name:'Очистить',exact:true}).click();
 await input.fill('T');await input.fill('Te');await search('Test song');await clear();
 await expect(history.getByRole('button',{name:'Test song',exact:true})).toBeVisible();await expect(history.locator('.search-history-query')).toHaveCount(1);
 await search('Other artist');await clear();
 await expect(history.locator('.search-history-query')).toHaveText(['Other artist','Test song']);
 await page.reload();await expect(history.locator('.search-history-query')).toHaveText(['Other artist','Test song']);
 const request=page.waitForRequest(r=>new URL(r.url()).pathname==='/demo/search'&&new URL(r.url()).searchParams.get('q')==='Test song');await history.getByRole('button',{name:'Test song',exact:true}).click();await request;await expect(input).toHaveValue('Test song');await expect(page.getByRole('button',{name:'Test song one',exact:true})).toBeVisible();await clear();
 await expect(history.locator('.search-history-query')).toHaveText(['Test song','Other artist']);
 await history.getByRole('button',{name:'Удалить запрос: Test song',exact:true}).click();await expect(history.locator('.search-history-query')).toHaveText(['Other artist']);
 await history.getByRole('button',{name:'Очистить историю поиска'}).click();await expect(history).toHaveCount(0);await expect(page.getByText('Введите минимум 2 символа')).toBeVisible();await page.reload();await expect(history).toHaveCount(0);
});
