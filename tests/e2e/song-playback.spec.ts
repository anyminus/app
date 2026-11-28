import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('each song remembers its own playback parameters only while enabled',async({page})=>{
 await mockApi(page);await page.goto('/');
 const music=page.getByRole('slider',{name:'Музыка',exact:true}),voice=page.getByRole('slider',{name:'Голос артиста',exact:true}),pitch=page.getByLabel('Тональность в полутонах'),speed=page.getByLabel('Скорость воспроизведения'),mute=page.getByRole('button',{name:'Приглушить: Голос артиста'});
 const open=async(title:string)=>{await page.getByRole('button',{name:title,exact:true}).click();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});};
 const home=async()=>{await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.getByRole('button',{name:'Найти песню'})).toBeVisible()};
 const standard=async()=>{await expect(music).toHaveValue('100');await expect(voice).toHaveValue('15');await expect(mute).toHaveAttribute('aria-pressed','false');await expect(pitch).toHaveText('0');await expect(speed).toHaveText('1.0×')};
 await open('Test song one');await standard();await music.fill('82');await voice.fill('37');await mute.click();
 await page.getByRole('button',{name:'Понизить тональность'}).click();await expect(pitch).toHaveText('-1');await page.getByRole('button',{name:'Увеличить скорость'}).click();await expect(speed).toHaveText('1.1×');
 await home();await open('Test song two');await standard();await home();await open('Test song one');
 await expect(music).toHaveValue('82');await expect(mute).toHaveAttribute('aria-pressed','true');await expect(pitch).toHaveText('-1');await expect(speed).toHaveText('1.1×');await mute.click();await expect(voice).toHaveValue('37');await home();
 const nav=page.getByRole('navigation'),setting=page.getByRole('checkbox',{name:'Сохранять настройки воспроизведения караоке'});
 await nav.getByRole('button',{name:'Профиль',exact:true}).click();await expect(setting).toBeChecked();await setting.uncheck();await nav.getByRole('button',{name:'Главная',exact:true}).click();await open('Test song one');await standard();await music.fill('40');await home();
 await nav.getByRole('button',{name:'Профиль',exact:true}).click();await expect(setting).not.toBeChecked();await page.reload();await expect(setting).not.toBeChecked();await setting.check();await nav.getByRole('button',{name:'Главная',exact:true}).click();await open('Test song one');await expect(music).toHaveValue('82');await expect(voice).toHaveValue('37');await expect(pitch).toHaveText('-1');await expect(speed).toHaveText('1.1×');await page.reload();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});await expect(music).toHaveValue('82');
});
