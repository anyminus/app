import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('real catalog, search, explicit creation and status',async({page})=>{const api=await mockApi(page,'accepted');await page.goto('/#/search');const input=page.getByRole('textbox',{name:'Поиск песни'});await input.fill('a');await expect(page.getByText('Введите минимум 2 символа')).toBeVisible();expect(api.requests).toEqual([]);await input.fill('Test song');await page.getByRole('button',{name:'Test song two',exact:true}).click();expect(api.enqueued).toBe(0);await expect(page.getByText('Караоке ещё не создано')).toBeVisible();await expect(page.getByRole('button',{name:'Проверить статус'})).toHaveCount(0);await page.getByRole('button',{name:'Создать караоке'}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible({timeout:10000});await expect(page.getByRole('button',{name:'Открыть караоке'})).toHaveCount(0);expect(api.enqueued).toBe(1);expect(api.media).toBe(2)});
test('ready playback retries lyrics without reloading audio or creating jobs',async({page})=>{const api=await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();await expect(page.getByText('Не удалось проверить наличие текста (HTTP 503)',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Повторить загрузку текста'}).click();await expect(page.getByRole('button',{name:'Synthetic test line'})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0)});
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

test('artist pages find ready songs beyond the first catalog page and include collaborations',async({page})=>{
 const api=await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';const cursors:string[]=[];
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>{const c=new URL(r.request().url()).searchParams.get('cursor');cursors.push(c??'first');return r.fulfill({json:{items:c?[{providerTrackId:'102',title:'Solo',artist:'ДЕЛЬФИН',durationSeconds:8,pairOperationId:pair},{providerTrackId:'103',title:'Collaboration',artist:'Другой, Дельфин',durationSeconds:8,pairOperationId:pair},{providerTrackId:'104',title:'Wrong artist',artist:'Дельфинчик',durationSeconds:8,pairOperationId:pair}]:[{providerTrackId:'101',title:'Unrelated',artist:'Other artist',durationSeconds:8,pairOperationId:pair}],nextCursor:c?null:'101'},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.goto('/#/artist/'+encodeURIComponent('Дельфин'));await expect(page.locator('.track-row')).toHaveCount(2);await expect(page.getByRole('button',{name:'Solo',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Collaboration',exact:true})).toBeVisible();await expect(page.getByText('Караоке готово',{exact:true})).toHaveCount(2);expect(cursors).toEqual(['first','101']);
 await page.getByRole('button',{name:'Collaboration',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);expect(api.requests).not.toContain('/demo/karaoke/status');
});

test('artist tabs separate ready database tracks and SDK popularity order',async({page})=>{
 const api=await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';let popularCalls=0;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>r.fulfill({json:{items:[{providerTrackId:'101',title:'Ready song',artist:'Дельфин',durationSeconds:8,pairOperationId:pair}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.route(/^https:\/\/[^/]+\/demo\/artists\/popular(?:\?|$)/,r=>{popularCalls++;expect(new URL(r.request().url()).searchParams.get('name')).toBe('Дельфин');return r.fulfill({json:{artistId:'42',name:'Дельфин',nextCursor:null,items:[{providerTrackId:'102',title:'Most popular',artist:'Дельфин',durationMs:8000,karaokeStatus:{state:'unknown'}},{providerTrackId:'101',title:'Ready song',artist:'Дельфин',durationMs:8000,karaokeStatus:{state:'ready',pairOperationId:pair}},{providerTrackId:'103',title:'Popular only',artist:'Дельфин',durationMs:8000,karaokeStatus:{state:'ready',pairOperationId:pair}}]},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.goto('/#/artist/'+encodeURIComponent('Дельфин'));await expect(page.getByRole('button',{name:'Ready song',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Популярные песни',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Обзор',exact:true})).toHaveCount(0);expect(popularCalls).toBe(0);
 await page.getByRole('button',{name:'Популярные песни',exact:true}).click();await expect(page.locator('.track-row')).toHaveCount(3);
 await expect(page.locator('.track-row').nth(0).getByRole('button',{name:'Most popular',exact:true})).toBeVisible();await expect(page.locator('.track-row').nth(1).getByRole('button',{name:'Ready song',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Готовые караоке',exact:true}).click();await expect(page.locator('.track-row')).toHaveCount(1);await expect(page.getByRole('button',{name:'Popular only',exact:true})).toHaveCount(0);
 expect(api.requests).not.toContain('/demo/search');expect(popularCalls).toBe(1);
 await page.getByRole('button',{name:'Спеть',exact:true}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();expect(api.media).toBe(2);expect(api.enqueued).toBe(0);
});

test('unreleased popularity API shows a clear error, not search results',async({page})=>{
 const api=await mockApi(page);await page.route(/^https:\/\/[^/]+\/demo\/artists\/popular(?:\?|$)/,r=>r.fulfill({status:404,json:{},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/#/artist/'+encodeURIComponent('Test artist'));await expect(page.getByRole('button',{name:'Test song one',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Популярные песни',exact:true}).click();await expect(page.getByRole('alert')).toContainText('требуется обновление API');await expect(page.locator('.track-row')).toHaveCount(0);expect(api.requests).not.toContain('/demo/search');
});

test('artist automatically loads every catalog page and displays all songs in overview',async({page})=>{
 const api=await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';const cursors:string[]=[];
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>{
  const c=new URL(r.request().url()).searchParams.get('cursor');cursors.push(c??'first');const i=c?Number(c)-1000:0;
  return r.fulfill({json:{items:[{providerTrackId:String(2000+i),title:'Artist song '+i,artist:'Дельфин',durationSeconds:8,pairOperationId:pair}],nextCursor:i<11?String(1001+i):null},headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.route(/^https:\/\/[^/]+\/demo\/search(?:\?|$)/,r=>r.fulfill({json:{items:[],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/#/artist/'+encodeURIComponent('Дельфин'));
 await expect(page.locator('.track-row')).toHaveCount(12);
 await expect(page.getByRole('button',{name:'Artist song 11',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Загрузить ещё',exact:true})).toHaveCount(0);
 expect(cursors).toHaveLength(12);expect(api.enqueued).toBe(0);expect(api.requests).not.toContain('/demo/karaoke/status');
 await expect(page.getByRole('button',{name:'Готовые караоке',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(cursors).toHaveLength(12);
});

test('missing lyrics can be subscribed to locally and notify when available on revisit',async({page})=>{
 const api=await mockApi(page);let available=false;
 await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({json:available?{state:'available',format:'LRC',timing:'line',lines:[{text:'Ready line',startMs:100,endMs:900,startOrigin:'source'}]}:{state:'absent',format:'LRC',timing:'none',lines:[]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));
 await page.goto('/#/track/101');await expect(page.getByText('Текст отсутствует в базе',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Подписаться на обновление',exact:true}).click();await expect(page.getByRole('button',{name:'Вы подписаны · отменить'})).toBeVisible();expect(api.enqueued).toBe(0);
 await page.reload();await expect(page.getByRole('button',{name:'Вы подписаны · отменить'})).toBeVisible();
 available=true;await page.getByRole('button',{name:'Назад',exact:true}).click();
 await expect(page.getByRole('button',{name:'Текст готов: Test song one',exact:true})).toBeVisible({timeout:15000});
 expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Текст готов: Test song one',exact:true}).click();await expect(page.getByRole('button',{name:'Ready line',exact:true})).toBeVisible();expect(api.enqueued).toBe(0);
});
test('pending 503 explicitly says lyrics absent from database',async({page})=>{
 await mockApi(page);await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({status:503,json:{state:'transient_error',format:'LRC',timing:'none',lines:[]},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'X-AnyMinus-Lyrics-Provenance','X-AnyMinus-Lyrics-Provenance':'pending'}}));
 await page.goto('/#/track/101');await expect(page.getByText('Текст отсутствует в базе',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Подписаться на обновление'})).toBeVisible();
});

test('guest creation requires an explicit click and uses a signed demo session',async({page})=>{
 const api=await mockApi(page);await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song two');await page.getByRole('button',{name:'Test song two',exact:true}).click();await expect(page.getByRole('button',{name:'Создать караоке'})).toBeVisible();expect(api.enqueued).toBe(0);
 await page.getByRole('button',{name:'Создать караоке'}).click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible({timeout:10000});expect(api.enqueued).toBe(1);
});
test('rejected Telegram initData leaves guest creation available without auto-enqueue',async({page})=>{
 const api=await mockApi(page,'rejected');await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song two');await page.getByRole('button',{name:'Test song two',exact:true}).click();await expect(page.getByRole('button',{name:'Создать караоке'})).toBeVisible();expect(api.enqueued).toBe(0);
});
test('verified Telegram session displays profile and logout restores optional guest access',async({page})=>{
 const api=await mockApi(page,'accepted');await page.goto('/#/profile');await expect(page.getByRole('heading',{name:'Test Telegram'})).toBeVisible();await expect(page.getByText('Telegram · вход подтверждён')).toBeVisible();await page.getByRole('button',{name:'Выйти из аккаунта'}).click();await expect(page.getByRole('button',{name:'Войти через Telegram'})).toBeVisible();await page.getByRole('navigation').getByRole('button',{name:'Поиск'}).click();await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song two');await page.getByRole('button',{name:'Test song two',exact:true}).click();await expect(page.getByRole('button',{name:'Создать караоке'})).toBeVisible();expect(api.enqueued).toBe(0);
});
test('browser OIDC callback validates stored state and restores profile',async({page})=>{
 const api=await mockApi(page);let exchanged=0;
 await page.addInitScript(()=>{if(location.search.includes('code=fixture'))sessionStorage.setItem('anyminus:telegram-oidc-pending',JSON.stringify({state:'fixture-state',verifier:'v'.repeat(43),returnHash:'#/profile',expires:Date.now()+60000}))});
 await page.route(/^https:\/\/[^/]+\/v1\/auth\/telegram\/exchange$/,async r=>{
  const headers={'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(r.request().method()==='OPTIONS'){await r.fulfill({status:204,headers});return}
  exchanged++;expect(r.request().postDataJSON()).toEqual({code:'fixture',state:'fixture-state',verifier:'v'.repeat(43)});
  await r.fulfill({json:{accessToken:'test-telegram-only',tokenType:'Bearer',expiresIn:1800,name:'Browser Telegram'},headers});
 });
 await page.goto('/?code=fixture&state=fixture-state');await expect(page.getByRole('heading',{name:'Browser Telegram'})).toBeVisible();expect(exchanged).toBe(1);expect(new URL(page.url()).search).toBe('');expect(await page.evaluate(()=>sessionStorage.getItem('anyminus:telegram-oidc-pending'))).toBeNull();expect(api.enqueued).toBe(0);
});
test('browser OIDC callback without matching pending state never exchanges',async({page})=>{
 await mockApi(page);let calls=0;await page.route(/^https:\/\/[^/]+\/v1\/auth\/telegram\/exchange$/,r=>{calls++;return r.abort()});
 await page.goto('/?code=fixture&state=untrusted');await expect(page.getByRole('button',{name:'Войти через Telegram'})).toBeVisible();await expect(page.getByText('Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.')).toBeVisible();expect(calls).toBe(0);
});

test('ready catalog labels only confirmed plain text in the warm accent',async({page})=>{await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>r.fulfill({json:{items:[{providerTrackId:'101',title:'Plain song',artist:'Artist',durationSeconds:8,pairOperationId:pair,lyricsFormat:'TEXT'},{providerTrackId:'102',title:'Timed song',artist:'Artist',durationSeconds:8,pairOperationId:pair,lyricsFormat:'LRC'},{providerTrackId:'103',title:'Unknown song',artist:'Artist',durationSeconds:8,pairOperationId:pair},{providerTrackId:'104',title:'Missing song',artist:'Artist',durationSeconds:8,pairOperationId:pair,lyricsFormat:'NONE'}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));await page.goto('/');const plain=page.locator('.track-row').filter({hasText:'Plain song'});await expect(plain.getByText('Текст без таймкодов',{exact:true})).toBeVisible();await expect(plain.getByText('Караоке готово',{exact:true})).toHaveCount(0);await expect(plain.locator('.track-ready')).toHaveClass(/track-ready-plain/);const missing=page.locator('.track-row').filter({hasText:'Missing song'});await expect(missing.getByText('Караоке без текста',{exact:true})).toBeVisible();await expect(missing.locator('.track-ready')).toHaveClass(/track-ready-missing/);await expect(missing.getByText('Караоке готово',{exact:true})).toHaveCount(0);await expect(page.getByText('Караоке готово',{exact:true})).toHaveCount(2)});

for(const [format,label,style] of [['LRC','Караоке готово','track-ready'],['TEXT','Текст без таймкодов','track-ready-plain'],['NONE','Караоке без текста','track-ready-missing']] as const){test('create karaoke shows '+format+' lyric status in song player',async({page})=>{const api=await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';await page.route(/^https:\/\/[^/]+\/demo\/karaoke\/status(?:\?|$)/,r=>r.fulfill({json:api.enqueued?{state:'ready',pairOperationId:pair,lyricsFormat:format}:{state:'none'},headers:{'Access-Control-Allow-Origin':'*'}}));await page.route(/^https:\/\/[^/]+\/demo\/catalog\/media\/[^/]+\/lyrics$/,r=>r.fulfill({status:503,json:{state:'transient_error'},headers:{'Access-Control-Allow-Origin':r.request().headers().origin||'http://127.0.0.1:4173','Access-Control-Allow-Credentials':'true'}}));await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Test song');await page.getByRole('button',{name:'Test song two',exact:true}).click();await page.getByRole('button',{name:'Создать караоке'}).click();await expect(page.getByText('Формат текста уточняется…')).toBeVisible();const status=page.locator('.karaoke-heading .song-lyrics-status');await expect(status).toHaveText(label,{timeout:10000});await expect(status).toHaveClass(new RegExp(style));expect(api.enqueued).toBe(1)});}

test('artist popular uncreated tracks warn before any creation and preserve unknown',async({page})=>{const api=await mockApi(page);const headers={'Access-Control-Allow-Origin':'*'};await page.route(/^https:\/\/[^/]+\/demo\/artists\/popular(?:\?|$)/,r=>r.fulfill({json:{artistId:'42',name:'Test',items:[{providerTrackId:'102',title:'Plain preview',artist:'Test',durationMs:8000,providerLyricsFormat:'TEXT'},{providerTrackId:'106',title:'Missing preview',artist:'Test',durationMs:8000,providerLyricsFormat:'NONE'},{providerTrackId:'107',title:'Unknown preview',artist:'Test',durationMs:8000}],nextCursor:null},headers}));await page.route(/^https:\/\/[^/]+\/demo\/karaoke\/status(?:\?|$)/,r=>r.fulfill({json:{state:'none'},headers}));await page.goto('/#/artist/Test?author_id=42');await page.getByRole('button',{name:'Популярные песни'}).click();await expect(page.locator('.track-row').filter({hasText:'Plain preview'}).getByText('Текст без таймкодов')).toBeVisible();await expect(page.locator('.track-row').filter({hasText:'Missing preview'}).getByText('Текст отсутствует')).toBeVisible();await expect(page.locator('.track-row').filter({hasText:'Unknown preview'}).getByText('Наличие текста не подтверждено')).toBeVisible();await page.getByRole('button',{name:'Missing preview',exact:true}).click();await expect(page.locator('.song-lyrics-preview').getByText('Текст отсутствует',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Создать караоке'})).toBeEnabled();expect(api.enqueued).toBe(0)});

test('all search results show provider or stored lyric availability before create',async({page})=>{const api=await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';await page.route(/^https:\/\/[^/]+\/demo\/search(?:\?|$)/,r=>r.fulfill({json:{items:[{providerTrackId:'101',title:'Search timed',artist:'Artist',durationMs:8000,providerLyricsFormat:'LRC'},{providerTrackId:'102',title:'Search plain',artist:'Artist',durationMs:8000,providerLyricsFormat:'TEXT'},{providerTrackId:'103',title:'Search absent',artist:'Artist',durationMs:8000,providerLyricsFormat:'NONE'},{providerTrackId:'104',title:'Search unknown',artist:'Artist',durationMs:8000},{providerTrackId:'105',title:'Search ready',artist:'Artist',durationMs:8000,providerLyricsFormat:'NONE',lyricsFormat:'LRC',karaokeStatus:{state:'ready',pairOperationId:pair}},{providerTrackId:'106',title:'Search ready without lyrics',artist:'Artist',durationMs:8000,providerLyricsFormat:'NONE',lyricsFormat:'NONE',karaokeStatus:{state:'ready',pairOperationId:pair}}],nextCursor:null},headers:{'Access-Control-Allow-Origin':'*'}}));await page.goto('/#/search');await page.getByRole('textbox',{name:'Поиск песни'}).fill('Search');for(const [name,label] of [['Search timed','Текст с таймкодами'],['Search plain','Текст без таймкодов'],['Search absent','Текст отсутствует'],['Search unknown','Наличие текста не подтверждено'],['Search ready','Караоке готово']])await expect(page.locator('.track-row').filter({has:page.getByRole('button',{name,exact:true})}).getByText(label,{exact:true})).toBeVisible();const timedReady=page.locator('.track-row').filter({has:page.getByRole('button',{name:'Search ready',exact:true})});await expect(timedReady.getByText('Караоке готово',{exact:true})).toBeVisible();await expect(timedReady.getByText('Текст с таймкодами',{exact:true})).toHaveCount(0);await expect(timedReady.locator('.track-ready')).toHaveCount(1);const missingReady=page.locator('.track-row').filter({has:page.getByRole('button',{name:'Search ready without lyrics',exact:true})});await expect(missingReady.getByText('Караоке без текста',{exact:true})).toBeVisible();await expect(missingReady.getByText('Текст отсутствует',{exact:true})).toHaveCount(0);await expect(missingReady.locator('.track-ready-missing')).toHaveCount(1);expect(api.enqueued).toBe(0)});

test('home shuffles the whole catalog server-side on reload and keeps one seed for pagination',async({page})=>{
 await mockApi(page);const pair='00000000-0000-4000-8000-000000000001';const calls:{seed:string|null;cursor:string|null}[]=[];
 await page.route(/^https:\/\/[^/]+\/demo\/catalog(?:\?|$)/,r=>{const url=new URL(r.request().url());const seed=url.searchParams.get('seed'),cursor=url.searchParams.get('cursor');calls.push({seed,cursor});const ids=cursor?['1','901']:['999','7'];return r.fulfill({json:{items:ids.map(id=>({providerTrackId:id,title:'Shuffle '+id,artist:'Artist',durationSeconds:8,pairOperationId:pair})),nextCursor:cursor?null:'7'},headers:{'Access-Control-Allow-Origin':'*'}})});
 await page.goto('/#/home');await expect(page.getByRole('button',{name:'Shuffle 999',exact:true})).toBeVisible();expect(calls[0].seed).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);await page.getByRole('button',{name:'Загрузить ещё',exact:true}).click();await expect(page.getByRole('button',{name:'Shuffle 901',exact:true})).toBeVisible();expect(calls[1]).toEqual({seed:calls[0].seed,cursor:'7'});await expect(page.locator('.track-row')).toHaveCount(4);await page.reload();await expect(page.getByRole('button',{name:'Shuffle 999',exact:true})).toBeVisible();expect(calls[2].cursor).toBeNull();expect(calls[2].seed).not.toBe(calls[0].seed);
});
