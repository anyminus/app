import {test} from 'node:test';import assert from 'node:assert/strict';import {defaults,clampVolume,parseRoute,formatTime} from '../src/model.mjs';test('independent default mixer values',()=>{assert.deepEqual(defaults,{music:100,vocals:15});assert.equal(clampVolume(125),100);assert.equal(clampVolume(-5),0)});test('lyrics timing and deep links',()=>{assert.deepEqual(parseRoute('#/artist/luna'),{page:'artist',id:'luna'});assert.equal(formatTime(96),'1:36')});
import {registerProfileTap,addPlaylist,renamePlaylist,deletePlaylist,addTrack,removeTrack} from '../src/playlists.mjs';
test('five profile taps within four seconds, expired sequence resets',()=>{let p={count:0,startedAt:0};for(let i=0;i<5;i++)p=registerProfileTap(p,1000+i*300);assert.equal(p.count,5);assert.equal(registerProfileTap(p,6000).count,1);});
test('playlist CRUD and no duplicate tracks',()=>{let p=addPlaylist([],'new','  Вечер  ');assert.equal(p.at(-1).name,'Вечер');p=renamePlaylist(p,'new','Хиты');p=addTrack(p,'new','123');p=addTrack(p,'new','123');p=addTrack(p,'new','bad');assert.deepEqual(p.at(-1),{id:'new',name:'Хиты',trackIds:['123']});p=removeTrack(p,'new','123');assert.deepEqual(p.at(-1).trackIds,[]);p=deletePlaylist(p,'new');assert.deepEqual(p,[]);});

import {effectiveVolume} from '../src/mixer.mjs';
test('mute masks stored levels without changing them',()=>{const levels={music:73,vocals:28};assert.equal(effectiveVolume(levels.music,true),0);assert.equal(effectiveVolume(levels.vocals,false),28);assert.equal(effectiveVolume(levels.music,false),73);assert.equal(effectiveVolume(levels.vocals,true),0);assert.equal(effectiveVolume(0,false),0);});

import {moveItem} from '../src/order.mjs';import {movePlaylistTrack} from '../src/playlists.mjs';
test('reordering moves items without mutation, duplication or unknown IDs',()=>{const ids=['123','fly','more'];assert.deepEqual(moveItem(ids,'123','more'),['fly','more','123']);assert.deepEqual(moveItem(ids,'more','123'),['more','123','fly']);assert.deepEqual(ids,['123','fly','more']);assert.equal(moveItem(ids,'unknown','123'),ids);assert.equal(moveItem(ids,'123','123'),ids);const list=[{id:'p',name:'P',trackIds:ids},{id:'q',name:'Q',trackIds:['123']}];const next=movePlaylistTrack(list,'p','123','more');assert.deepEqual(next[0].trackIds,['fly','more','123']);assert.equal(next[1],list[1]);});

import {apiOrigin,createDemoApi,createControlApi,normalizeTracks,normalizeJob,mediaUrl} from '../src/api.mjs';
test('API routes and origin separation',async()=>{const calls=[];const fake=async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({items:[],nextCursor:null}),{status:200})};const origin='https://api.example.test';const api=createDemoApi(origin,fake);await api.catalog('100',undefined,undefined);await api.search(' тест ',undefined,undefined);await api.enqueue({providerTrackId:'123',title:'Demo',artist:'Demo',durationMs:96000},'synthetic-token');await api.status('123','synthetic-token');assert.equal(new URL(calls[0].url).pathname,'/demo/catalog');assert.equal(new URL(calls[0].url).searchParams.get('limit'),'100');assert.equal(new URL(calls[1].url).searchParams.get('q'),'тест');assert.equal(calls[1].init.headers.Authorization,undefined);assert.equal(calls[2].init.method,'POST');assert.equal(JSON.parse(calls[2].init.body).providerTrackId,'123');assert.equal(calls[3].init.headers.Authorization,'Bearer synthetic-token');const control=createControlApi(origin,fake);await control.remove('synthetic-id','synthetic-token');assert.equal(calls[4].init.method,'DELETE');assert.throws(()=>apiOrigin(origin+'/app/'));assert.throws(()=>apiOrigin('http://api.example.test'));assert.equal(normalizeTracks({items:[{providerTrackId:'123',title:'Demo',artist:'Demo',durationMs:96000}]})[0].durationMs,96000);assert.throws(()=>normalizeJob({state:'invented'}));assert.throws(()=>mediaUrl(origin,'00000000-0000-4000-8000-000000000000','vocals','https://other.example.test/demo/catalog/media/00000000-0000-4000-8000-000000000000/vocals'));});

import {toggleFavoritePlaylist,pruneFavoritePlaylists} from '../src/playlists.mjs';
test('playlist favorites are independent, unique and pruned after deletion',()=>{const a=toggleFavoritePlaylist([],'top');assert.deepEqual(a,['top']);const b=toggleFavoritePlaylist(a,'Рок');assert.deepEqual(b,['Рок','top']);assert.deepEqual(toggleFavoritePlaylist(b,'top'),['Рок']);assert.deepEqual(pruneFavoritePlaylists(b,[{id:'top'}]),['top']);assert.equal(pruneFavoritePlaylists(a,[{id:'top'}]),a);});

import {normalizeStoredLyrics,retryLyricsStatus} from '../src/lyrics.mjs';
test('stored lyrics distinguish timed, plain, absent and transient states',()=>{const line={text:'test line',startMs:100,endMs:null,startOrigin:'source'};assert.deepEqual(normalizeStoredLyrics({state:'available',format:'LRC',timing:'line',lines:[{...line,startMs:200},line,{...line,startMs:300,startOrigin:'inferred'}]},1000).lines.map(l=>l.startMs),[100,200]);assert.equal(normalizeStoredLyrics({state:'available',format:'TEXT',timing:'none',text:'one\ntwo',lines:[]},1000).text,'one\ntwo');assert.equal(normalizeStoredLyrics({state:'absent',format:'LRC',lines:[]},1000).state,'absent');assert.equal(retryLyricsStatus(503),true);assert.equal(retryLyricsStatus(401),false);assert.throws(()=>normalizeStoredLyrics({},1000));});

import {trackArtworkUrl} from '../src/artwork.mjs';
test('artwork URLs use stable approved API paths only',()=>{assert.equal(trackArtworkUrl('https://api.example.test','123'),'https://api.example.test/demo/artwork/123');assert.equal(trackArtworkUrl('https://api.example.test','../private'),null);assert.equal(trackArtworkUrl('https://api.example.test/path','123'),null);assert.equal(trackArtworkUrl('http://api.example.test','123'),null)});

test('anonymous session is reused and concurrent auth calls are deduplicated',async()=>{let calls=0;const api=createDemoApi('https://api.example.test',async()=>{calls++;return new Response(JSON.stringify({accessToken:'test',expiresIn:300}),{status:200})});const [a,b]=await Promise.all([api.auth(),api.auth()]);assert.equal(a.accessToken,b.accessToken);await api.auth();assert.equal(calls,1);api.invalidateAuth();await api.auth();assert.equal(calls,2)});
test('429 honors retry-after and prevents repeat network traffic',async()=>{let calls=0;const api=createDemoApi('https://api.example.test',async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'30'}})});await assert.rejects(api.auth(),e=>e.status===429&&e.retryAfter===30000);await assert.rejects(api.auth(),e=>e.status===429&&e.retryAfter>0);assert.equal(calls,1)});

test('provider supplied artwork cannot select another origin or track',()=>{const origin='https://api.example.test';assert.equal(trackArtworkUrl(origin,'123','/demo/artwork/123'),origin+'/demo/artwork/123');assert.equal(trackArtworkUrl(origin,'123','https://other.example.test/cover'),null);assert.equal(trackArtworkUrl(origin,'123','/demo/artwork/456'),null);assert.equal(trackArtworkUrl(origin,'123',null),origin+'/demo/artwork/123');assert.equal(trackArtworkUrl(origin,'123','/demo/artwork/123?v=2'),origin+'/demo/artwork/123?v=2');assert.equal(trackArtworkUrl(origin,'123','https://avatars.yandex.net/get-music-content/123/200x200'),'https://avatars.yandex.net/get-music-content/123/200x200');assert.equal(normalizeTracks({items:[{providerTrackId:'123',title:'Title',artist:'Artist',durationMs:2000,coverUrl:origin+'/demo/artwork/123'}]})[0].coverUrl,origin+'/demo/artwork/123')});

test('search readiness is accepted only for explicit ready with a valid pair UUID',()=>{
 const id='00000000-0000-4000-8000-000000000001',track={providerTrackId:'123',title:'Track',artist:'Artist',durationMs:2000};
 for(const karaokeStatus of [undefined,null,{state:'unknown',pairOperationId:id},{state:'none',pairOperationId:id},{state:'running',pairOperationId:id},{state:'invalid',pairOperationId:id},{state:'ready'},{state:'ready',pairOperationId:'bad'}]){
  assert.equal(normalizeTracks({items:[{...track,pairOperationId:id,karaokeStatus}]})[0].pairOperationId,null);
 }
 assert.equal(normalizeTracks({items:[{...track,karaokeStatus:{state:'ready',pairOperationId:id}}]})[0].pairOperationId,id);
 assert.equal(normalizeTracks({items:[{...track,durationSeconds:2,pairOperationId:id}]},true)[0].pairOperationId,id);
 assert.equal(normalizeTracks({items:[{...track,coverUrl:null}]})[0].coverUrl,null);
 assert.equal(normalizeTracks({items:[track]})[0].coverUrl,undefined);
});

import {matchesArtist} from '../src/model.mjs';
test('artist credit matching is exact, case and whitespace normalized, and includes collaborations',()=>{assert.equal(matchesArtist(' ДЕЛЬФИН ','Дельфин'),true);assert.equal(matchesArtist('Другой, Дельфин','Дельфин'),true);assert.equal(matchesArtist('Дельфинчик','Дельфин'),false);assert.equal(matchesArtist('Артист Ё','артист е'),true);assert.equal(matchesArtist('Дельфин',''),false)});

import {artistPath} from '../src/model.mjs';
test('artist links keep unique provider IDs and old links remain readable',()=>{assert.equal(artistPath('Дельфин','42'),'/artist/'+encodeURIComponent('Дельфин')+'?author_id=42');assert.deepEqual(parseRoute('#'+artistPath('Дельфин','42')),{page:'artist',id:'Дельфин',author_id:'42'});assert.deepEqual(parseRoute('#/artist/Dolphin?author_id=bad'),{page:'artist',id:'Dolphin'});assert.notEqual(artistPath('Дельфин','42'),artistPath('Дельфин','43'));});

import {lyricScrollEase} from '../src/lyrics.mjs';
test('lyric spring scroll easing is bounded, monotone and exact at endpoints',()=>{assert.equal(lyricScrollEase(-1),0);assert.equal(lyricScrollEase(0),0);assert.equal(lyricScrollEase(1),1);assert.equal(lyricScrollEase(2),1);let prev=0;for(let i=1;i<=100;i++){const v=lyricScrollEase(i/100);assert.ok(v>=prev&&v<=1);prev=v}assert.ok(lyricScrollEase(.5)>.5)});

test('catalog lyrics format accepts only explicit TEXT, LRC, NONE or authoritative null',()=>{const sample={providerTrackId:'123',title:'Demo',artist:'Artist',durationMs:2000};for(const [value,expected] of [['TEXT','TEXT'],['LRC','LRC'],['NONE','NONE'],['absent',undefined],['plain',undefined],[null,null]])assert.equal(normalizeTracks({items:[{...sample,lyricsFormat:value}]})[0].lyricsFormat,expected)});

import {providerLyricsHint} from '../src/api.mjs';
test('provider lyric capability is separate and unknown is not absent',()=>{assert.equal(providerLyricsHint({lyricsSyncAvailable:false,lyricsTextAvailable:true}),'TEXT');assert.equal(providerLyricsHint({lyricsSyncAvailable:false,lyricsTextAvailable:false}),'NONE');assert.equal(providerLyricsHint({lyricsSyncAvailable:false,lyricsTextAvailable:false,lyricsAvailable:true}),undefined);assert.equal(providerLyricsHint({lyricsTextAvailable:false}),undefined);assert.equal(providerLyricsHint({lyricsSyncAvailable:true}),'LRC')});

import {introCountdown} from '../src/lyrics.mjs';
test('long intro countdown uses source timestamp and media position',()=>{assert.equal(introCountdown(undefined,0),null);assert.equal(introCountdown(10000,0),null);assert.equal(introCountdown(10001,0),11);assert.equal(introCountdown(30000,0),30);assert.equal(introCountdown(30000,24.25),6);assert.equal(introCountdown(30000,29.99),1);assert.equal(introCountdown(30000,30),null);assert.equal(introCountdown(30000,31),null);assert.equal(introCountdown(30000,5),25);assert.equal(introCountdown(30000,NaN),null)});

import {publishedUpgrade} from '../src/release-version.mjs';
test('published release comparator rejects malformed, same and stale versions',()=>{const m=version=>({schemaVersion:1,version});assert.equal(publishedUpgrade('0.5.2',m('0.5.2')),null);assert.equal(publishedUpgrade('0.5.2',m('0.5.1')),null);assert.equal(publishedUpgrade('0.5.9',m('0.5.10')),'0.5.10');assert.equal(publishedUpgrade('0.5.9',m('0.6.0')),'0.6.0');assert.equal(publishedUpgrade('0.5.2',m('garbage')),null);assert.equal(publishedUpgrade('0.5.2',{version:'1.0.0'}),null);assert.equal(publishedUpgrade('0.5.2',null),null)});

test('intro countdown reports real seconds at changed tempo',()=>{assert.equal(introCountdown(30000,0,.5),60);assert.equal(introCountdown(30000,0,1.5),20);assert.equal(introCountdown(30000,15,1.2),13);assert.equal(introCountdown(30000,30,1.5),null)});

import {sharedTrackPath,readSharedPlayback,validateSharedPlayback} from '../src/sharedPlayback.mjs';
test('optional share presets round-trip and reject invalid or duplicate parameters',()=>{const settings={music:85,vocals:23,musicMuted:false,vocalsMuted:true,pitch:-4,speed:1.2};const path=sharedTrackPath('25218412',settings);assert.deepEqual(parseRoute('#'+path),{page:'track',id:'25218412',settings});assert.equal(sharedTrackPath('25218412'),'/track/25218412');assert.deepEqual(parseRoute('#/track/25218412?music=85'),{page:'track',id:'25218412'});assert.equal(readSharedPlayback(new URLSearchParams(path.split('?')[1]+'&speed=1.3')),null);assert.equal(validateSharedPlayback({...settings,pitch:7}),null);assert.equal(validateSharedPlayback({...settings,speed:1.25}),null);assert.equal(validateSharedPlayback({...settings,music:101}),null);assert.equal(validateSharedPlayback({...settings,vocals:NaN}),null);assert.equal(parseRoute('#/artist/Test?'+path.split('?')[1]).settings,undefined);});

test('shared playback accepts 2x and rejects above limit',()=>{const preset={music:100,vocals:15,musicMuted:false,vocalsMuted:false,pitch:0,speed:2};assert.deepEqual(parseRoute('#'+sharedTrackPath('123',preset)).settings,preset);assert.equal(validateSharedPlayback({...preset,speed:2.1}),null);assert.equal(introCountdown(30000,0,2),15)});

import {releaseHighlights} from '../src/release-version.mjs';
test('release highlights are optional, bounded plain text',()=>{assert.deepEqual(releaseHighlights({highlights:['  New   speed ',null,'Artist link','third']}),['New speed','Artist link']);assert.deepEqual(releaseHighlights({}),[]);assert.equal(releaseHighlights({highlights:['a'.repeat(200)]})[0].length,100)});

import {readSharedTime,validateSharedTime} from '../src/sharedPlayback.mjs';
test('optional song time is independent from playback settings and safely parsed',()=>{const settings={music:85,vocals:23,musicMuted:false,vocalsMuted:false,pitch:-2,speed:2};assert.equal(sharedTrackPath('123',null,83),'/track/123?t=83');assert.deepEqual(parseRoute('#'+sharedTrackPath('123',settings,83)),{page:'track',id:'123',settings,time:83});assert.deepEqual(parseRoute('#/track/123?t=0'),{page:'track',id:'123',time:0});assert.deepEqual(parseRoute('#/track/123?t=83&music=20'),{page:'track',id:'123',time:83});for(const query of ['t=-1','t=901','t=1.5','t=','t=1&t=2','t=NaN','t=1e2'])assert.equal(readSharedTime(new URLSearchParams(query)),null);assert.equal(validateSharedTime(Infinity),null);assert.equal(parseRoute('#/artist/Test?t=83').time,undefined);assert.deepEqual(parseRoute('#'+sharedTrackPath('123',settings)+'&t=bad'),{page:'track',id:'123',settings});});

import {interludeCountdown} from '../src/lyrics.mjs';
test('interlude countdown requires a verified gap strictly longer than ten seconds',()=>{
 const lines=[{startMs:0,endMs:3000},{startMs:15000,endMs:17000},{startMs:27000,endMs:30000},{startMs:45000,endMs:null},{startMs:60000,endMs:62000}];
 assert.equal(interludeCountdown(lines,0,2.99),null);assert.equal(interludeCountdown(lines,0,3),12);assert.equal(interludeCountdown(lines,0,7.2),8);assert.equal(interludeCountdown(lines,0,14.99),1);assert.equal(interludeCountdown(lines,0,15),null);assert.equal(interludeCountdown(lines,0,3,2),6);
 assert.equal(interludeCountdown(lines,1,17),null);assert.equal(interludeCountdown(lines,2,30),15);assert.equal(interludeCountdown(lines,3,50),null);assert.equal(interludeCountdown(lines,4,63),null);assert.equal(interludeCountdown(lines,-1,0),null);assert.equal(interludeCountdown([{startMs:0,endMs:0},{startMs:20000,endMs:21000}],0,5),null);
});

import {exactSearchArtists} from '../src/model.mjs';
test('exact search artist suggestion prefers verified individual credits and deduplicates IDs',()=>{
 const tracks=[{artist:'Soldatov',title:'Other'},{artist:'Soldatov, Guest',artistCredits:[{name:'Soldatov',author_id:'42'},{name:'Guest',author_id:'43'}]},{artist:'Soldatov',artistCredits:[{name:'Soldatov',author_id:'42'}]},{artist:'Other',title:'Soldatov'}];
 assert.deepEqual(exactSearchArtists('  SOLDATOV ',tracks),[{name:'Soldatov',author_id:'42'}]);assert.deepEqual(exactSearchArtists('Sold',tracks),[]);assert.deepEqual(exactSearchArtists('Guest',tracks),[{name:'Guest',author_id:'43'}]);assert.deepEqual(exactSearchArtists('Other title',[{artist:'Other',title:'Other title'}]),[]);assert.deepEqual(exactSearchArtists('soldatov',[{artist:'Soldatov'}]),[{name:'Soldatov'}]);assert.deepEqual(exactSearchArtists('Guest',[{artist:'Soldatov, Guest'}]),[]);
});
