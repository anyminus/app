import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('independent mute restores per-song levels after reload',async({page})=>{
 await mockApi(page);await page.goto('/');await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});
 const music=page.getByRole('slider',{name:'Музыка',exact:true}),vocals=page.getByRole('slider',{name:'Голос артиста',exact:true});
 await expect(music).toHaveValue('100');await expect(vocals).toHaveValue('15');await music.fill('60');await page.getByRole('button',{name:'Приглушить: Музыка'}).click();await expect(music).toBeDisabled();await expect(music).toHaveValue('0');await expect(vocals).toHaveValue('15');await page.reload();await expect(music).toBeDisabled();await page.getByRole('button',{name:'Приглушить: Музыка',exact:true}).click();await expect(music).toHaveValue('60');
});
