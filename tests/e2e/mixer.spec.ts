import {test,expect} from '@playwright/test';
test('independent mute restores levels and disables sliders in player and settings',async({page})=>{
 await page.goto('/#/player/city');
 const music=page.getByRole('slider',{name:'Музыка',exact:true});const vocals=page.getByRole('slider',{name:'Голос артиста',exact:true});
 const mm=page.getByRole('button',{name:'Приглушить: Музыка',exact:true});const vm=page.getByRole('button',{name:'Приглушить: Голос артиста',exact:true});
 await music.fill('73');await vocals.fill('28');await mm.click();await expect(music).toBeDisabled();await expect(music).toHaveValue('0');await expect(mm).toHaveAttribute('aria-pressed','true');await expect(vocals).toBeEnabled();await expect(vocals).toHaveValue('28');
 await vm.click();await expect(vocals).toBeDisabled();await expect(vocals).toHaveValue('0');await mm.click();await expect(music).toBeEnabled();await expect(music).toHaveValue('73');await expect(vocals).toBeDisabled();
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await expect(vocals).toBeDisabled();await page.reload();await expect(vocals).toBeDisabled();await vm.click();await expect(vocals).toBeEnabled();await expect(vocals).toHaveValue('28');await expect(music).toHaveValue('73');
});
