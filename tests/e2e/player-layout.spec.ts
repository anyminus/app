import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('karaoke fits the viewport, follows lyrics without page scroll, keeps controls in focus and landscape',async({page})=>{
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,async r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:Array.from({length:20},(_,i)=>({text:'Test lyric '+i+' with a long line to wrap',startMs:i*45,endMs:(i+1)*45,startOrigin:'source'}))},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await page.getByRole('button',{name:'Открыть караоке'}).click();
 const screen=page.getByRole('region',{name:'Плеер караоке'}), lyrics=page.getByLabel('Текст песни',{exact:true}),play=page.getByRole('button',{name:'Воспроизвести',exact:true}),slider=page.getByRole('slider',{name:'Позиция песни'}),mixer=page.getByRole('region',{name:'Микшер'});await expect(screen).toBeVisible();await expect(lyrics.getByRole('button')).toHaveCount(20);
 async function fits(locator:typeof screen){await expect(locator).toBeInViewport({ratio:0.99});const b=await locator.boundingBox();const v=page.viewportSize()!;expect(b!.y).toBeGreaterThanOrEqual(-1);expect(b!.y+b!.height).toBeLessThanOrEqual(v.height+1)}
 await fits(screen);await fits(play);await fits(slider);await fits(mixer);await expect(page.getByRole('navigation')).toBeHidden();
 await slider.fill('0.8');await expect.poll(()=>lyrics.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.scrollY)).toBe(0);await fits(play);
 await page.getByRole('button',{name:'Только текст',exact:true}).click();await expect(mixer).toHaveCount(0);await fits(play);await fits(slider);await fits(screen);
 await page.getByRole('button',{name:'Показать плеер',exact:true}).click();await fits(mixer);
 for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);await fits(screen);await fits(play);await fits(slider);await fits(mixer);expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height+1)}
 await page.getByRole('button',{name:'Только текст',exact:true}).click();await fits(play);await fits(slider);await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();await expect(page.locator('body')).not.toHaveClass(/karaoke-open/);
});
