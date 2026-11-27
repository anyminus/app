import {test,expect} from '@playwright/test';
import {mockApi} from './fixture';
test('fixed viewport blocks app-level zoom without blocking ordinary gestures',async({page})=>{
 await mockApi(page);await page.goto('/#/home');
 const viewport=page.locator('meta[name="viewport"]');
 await expect(viewport).toHaveAttribute('content',/minimum-scale=1, maximum-scale=1, user-scalable=no/);
 const state=await page.evaluate(()=>{
  const target=document.getElementById('root')!;
  const canceled=(e:Event)=>!target.dispatchEvent(e);
  const touch=(n:number)=>{
   const e=new Event('touchmove',{bubbles:true,cancelable:true});
   Object.defineProperty(e,'touches',{value:Array(n).fill({})});return canceled(e);
  };
  return {
   touchAction:getComputedStyle(target).touchAction,
   pinch:canceled(new Event('gesturestart',{bubbles:true,cancelable:true})),
   multiTouch:touch(2),singleTouch:touch(1),
   wheelZoom:canceled(new WheelEvent('wheel',{ctrlKey:true,bubbles:true,cancelable:true})),
   wheelScroll:canceled(new WheelEvent('wheel',{deltaY:20,bubbles:true,cancelable:true})),
   keyZoom:canceled(new KeyboardEvent('keydown',{key:'+',ctrlKey:true,bubbles:true,cancelable:true})),
   macZoom:canceled(new KeyboardEvent('keydown',{key:'-',metaKey:true,bubbles:true,cancelable:true})),
   normalKey:canceled(new KeyboardEvent('keydown',{key:'+',bubbles:true,cancelable:true}))
  };
 });
 expect(state).toEqual({touchAction:'pan-x pan-y',pinch:true,multiTouch:true,singleTouch:false,wheelZoom:true,wheelScroll:false,keyZoom:true,macZoom:true,normalKey:false});
 await page.goto('/#/profile');
 await expect(page.getByRole('navigation',{name:'Навигация'})).toBeVisible();
 await expect(viewport).toHaveAttribute('content',/maximum-scale=1/);
});
