import {test,expect} from '@playwright/test';import {mockApi} from './fixture';
test('repeated karaoke sessions create distinct history rows, but pause and resume do not',async({page})=>{
 await mockApi(page);await page.goto('/');
 const open=async()=>{await page.getByRole('button',{name:'Test song one',exact:true}).click();await expect(page.getByRole('slider',{name:'Позиция песни'})).toBeEnabled({timeout:15000});const play=page.getByRole('button',{name:'Воспроизвести',exact:true});if(await play.isVisible())await play.click();await expect(page.getByRole('button',{name:'Пауза',exact:true})).toBeVisible();};
 const log=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('anyminus:real-history')||'[]'));
 await open();await expect.poll(log).toEqual(['101']);await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('button',{name:'Воспроизвести',exact:true}).click();await expect.poll(log).toEqual(['101']);
 await page.getByRole('button',{name:'Назад',exact:true}).click();await open();await expect.poll(log).toEqual(['101','101']);
 await page.goto('/#/history');await expect(page.getByRole('button',{name:'Test song one',exact:true})).toHaveCount(2);
});
