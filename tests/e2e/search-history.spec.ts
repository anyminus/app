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

test('home find song focuses the search field in the originating click',async({page})=>{
 await mockApi(page);await page.goto('/');
 await page.evaluate(()=>{document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('button')?.textContent?.trim()==='Найти песню'){document.documentElement.dataset.searchFocusedInClick=String(document.activeElement instanceof HTMLInputElement&&document.activeElement.getAttribute('aria-label')==='Поиск песни')}}, {once:true})});
 await page.getByRole('button',{name:'Найти песню',exact:true}).click();const input=page.getByRole('textbox',{name:'Поиск песни'});
 await expect(page).toHaveURL(/#\/search$/);await expect(input).toBeFocused();await expect(page.locator('html')).toHaveAttribute('data-search-focused-in-click','true');await page.keyboard.type('Test song');await expect(input).toHaveValue('Test song');
 await expect(page.getByRole('button',{name:'Test song one',exact:true})).toBeVisible();
});

test('search focuses on direct entry, reload, bottom tab and returning from another page',async({page})=>{
 await mockApi(page);await page.goto('/?utm_source=chatgpt.com#/search');const input=page.getByRole('textbox',{name:'Поиск песни'}),nav=page.getByRole('navigation');
 await expect(input).toBeFocused();await page.reload();await expect(input).toBeFocused();
 await nav.getByRole('button',{name:'Главная',exact:true}).click();await expect(page.getByRole('button',{name:'Найти песню',exact:true})).toBeVisible();
 await page.evaluate(()=>{document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('button')?.textContent?.trim()==='Поиск')document.documentElement.dataset.searchTabFocused=String(document.activeElement instanceof HTMLInputElement&&document.activeElement.getAttribute('aria-label')==='Поиск песни')},{once:true})});
 await nav.getByRole('button',{name:'Поиск',exact:true}).click();await expect(input).toBeFocused();await expect(page.locator('html')).toHaveAttribute('data-search-tab-focused','true');
 await input.fill('Test song');await expect(page.getByRole('button',{name:'Test song one',exact:true})).toBeVisible();await input.blur();
 await nav.getByRole('button',{name:'Поиск',exact:true}).click();await expect(input).toBeFocused();await expect(input).toHaveValue('Test song');expect(await input.evaluate((el:HTMLInputElement)=>el.selectionStart)).toBe(9);
 await nav.getByRole('button',{name:'Главная',exact:true}).click();await expect(input).toHaveCount(0);await page.goBack();await expect(input).toBeFocused();
});

test('search requests up to fifteen songs in a single combined response',async({page})=>{
 await mockApi(page);await page.goto('/#/search');const input=page.getByRole('textbox',{name:'Поиск песни'});
 const response=page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/demo/search'&&u.searchParams.get('q')==='Test song'});
 await input.fill('Test song');const result=await response;expect(new URL(result.url()).searchParams.get('limit')).toBe('15');await expect(page.getByRole('button',{name:'Test song one',exact:true})).toBeVisible();
});
