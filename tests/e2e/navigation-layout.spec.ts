import {test,expect} from '@playwright/test';
test('bottom navigation is compact and keeps usable touch targets',async({page})=>{
 for(const size of [{width:390,height:664},{width:320,height:568},{width:667,height:375}]){
 await page.setViewportSize(size);await page.goto('/#/profile');
 const nav=page.getByRole('navigation',{name:'Навигация'});await expect(nav).toBeVisible();
 const b=await nav.boundingBox();expect(b!.height).toBeLessThanOrEqual(52);expect(b!.y+b!.height).toBeCloseTo(size.height,0);
 const buttons=await nav.getByRole('button').all();expect(buttons).toHaveLength(4);
 for(const button of buttons){const r=await button.boundingBox();expect(r!.height).toBeGreaterThanOrEqual(44);expect(r!.width).toBeGreaterThanOrEqual(44)}
 await nav.getByRole('button',{name:'Профиль'}).click();await expect(page.getByRole('heading',{name:'Профиль',exact:true})).toBeVisible();
 }
});
