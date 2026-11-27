import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('karaoke fits the viewport, follows lyrics without page scroll, keeps controls in focus and landscape',async({page})=>{
 const api=await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,async r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:Array.from({length:20},(_,i)=>({text:'Test lyric '+i+' with a long line to wrap',startMs:i*45,endMs:(i+1)*45,startOrigin:'source'}))},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const screen=page.getByRole('region',{name:'Плеер караоке'}), lyrics=page.getByLabel('Текст песни',{exact:true}),play=page.getByRole('button',{name:'Воспроизвести',exact:true}),slider=page.getByRole('slider',{name:'Позиция песни'}),mixer=page.getByRole('region',{name:'Микшер'});await expect(screen).toBeVisible();await expect(lyrics.getByRole('button')).toHaveCount(20);
 async function fits(locator:typeof screen){await expect(locator).toBeInViewport({ratio:0.99});const b=await locator.boundingBox();const v=page.viewportSize()!;expect(b!.x).toBeGreaterThanOrEqual(-1);expect(b!.x+b!.width).toBeLessThanOrEqual(v.width+1);expect(b!.y).toBeGreaterThanOrEqual(-1);expect(b!.y+b!.height).toBeLessThanOrEqual(v.height+1)}
 await fits(screen);await fits(play);await fits(slider);await fits(mixer);await expect(page.getByRole('navigation')).toBeHidden();
 await slider.fill('0.8');await expect.poll(()=>lyrics.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.scrollY)).toBe(0);await fits(play);
 await page.getByRole('button',{name:'Только текст',exact:true}).click();await expect(mixer).toHaveCount(0);await fits(play);await fits(slider);await fits(screen);
 await page.getByRole('button',{name:'Показать плеер',exact:true}).click();await fits(mixer);
 for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);await fits(screen);await fits(play);await fits(slider);await fits(mixer);expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height+1)}
 await page.getByRole('button',{name:'Только текст',exact:true}).click();await fits(play);await fits(slider);await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('navigation')).toBeVisible();await expect(page.locator('body')).not.toHaveClass(/karaoke-open/);
});

test('active lyric scales to 100 percent and inactive lyrics to 75 percent with smooth motion',async({page})=>{
 await mockApi(page);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,async r=>r.fulfill({json:{state:'available',format:'LRC',timing:'line',lines:Array.from({length:7},(_,i)=>({text:'Motion line '+i,startMs:i*1000,endMs:(i+1)*1000,startOrigin:'source'}))},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 const lines=page.locator('.karaoke-lyrics .lyric');await expect(lines).toHaveCount(7);const slider=page.getByRole('slider',{name:'Позиция песни'});await slider.fill('0');await expect(lines.nth(0)).toHaveAttribute('aria-current','true');
 const scale=(i:number)=>lines.nth(i).locator('.lyric-text').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
 await expect.poll(()=>scale(0)).toBeCloseTo(1,2);await expect.poll(()=>scale(1)).toBeCloseTo(.75,2);
 expect(await lines.nth(0).locator('.lyric-text').evaluate(el=>getComputedStyle(el).transitionDuration)).not.toBe('0s');
 await slider.fill('4');await expect(lines.nth(4)).toHaveAttribute('aria-current','true');await expect.poll(()=>scale(4)).toBeCloseTo(1,2);await expect.poll(()=>scale(0)).toBeCloseTo(.75,2);
 await expect.poll(()=>page.locator('.karaoke-lyrics').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>window.scrollY)).toBe(0);
 await page.emulateMedia({reducedMotion:'reduce'});await slider.fill('2');await expect(lines.nth(2)).toHaveAttribute('aria-current','true');await expect.poll(()=>scale(2)).toBeCloseTo(1,2);await expect(lines.nth(2).locator('.lyric-text')).toHaveCSS('transition-duration','0s');
});

test('player heading keeps collaborating artists and punctuation on a single line',async({page})=>{
 await mockApi(page);
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>r.fulfill({json:{items:[{providerTrackId:'101',title:'Collaboration',artist:'Kai Angel, 9mice',artistCredits:[{author_id:'16509384',name:'Kai Angel'},{author_id:'13739916',name:'9mice'}],durationSeconds:8,pairOperationId:'00000000-0000-4000-8000-000000000001'}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.setViewportSize({width:390,height:664});await page.goto('/');await page.getByRole('button',{name:'Collaboration',exact:true}).click();
 const heading=page.locator('.karaoke-heading'),artists=heading.locator('.artist-credits');await expect(artists).toHaveText('Kai Angel, 9mice');await expect(artists.getByRole('button')).toHaveCount(2);
 for(const width of [390,320,540]){await page.setViewportSize({width,height:664});const first=await artists.getByRole('button',{name:'Kai Angel',exact:true}).boundingBox();const second=await artists.getByRole('button',{name:'9mice',exact:true}).boundingBox();expect(first&&second).toBeTruthy();expect(Math.abs(first!.y-second!.y)).toBeLessThan(2);expect(second!.x).toBeGreaterThan(first!.x);await expect(artists).toHaveCSS('white-space','nowrap');}
 await artists.getByRole('button',{name:'9mice',exact:true}).click();await expect(page).toHaveURL(/#\/artist\/9mice\?author_id=13739916$/);
});
