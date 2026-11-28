import {useEffect,useLayoutEffect} from 'react';

// Safari controls its chrome. A document-level canvas and a matching solid
// tint let supported browser versions extend the page into the obscured insets.
export function usePlayerEdgeBackground(open:boolean,visible:boolean,source:string|null,thumbnail:string|null){
 useLayoutEffect(()=>{
  if(!open)return;
  const root=document.documentElement,meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const prior=meta?.getAttribute('content');
  root.classList.add('karaoke-edge-open');
  return ()=>{
   root.classList.remove('karaoke-edge-open','karaoke-edge-active');
   root.style.removeProperty('--karaoke-edge-tint');
   root.style.removeProperty('--karaoke-edge-art');
   root.style.removeProperty('--karaoke-edge-scrim');
   if(meta&&prior!==null&&prior!==undefined)meta.setAttribute('content',prior);
  };
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const root=document.documentElement,meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const light=document.querySelector('.app')?.classList.contains('light')??false;
  const base=light?[248,247,252]:[16,16,25],scrim=light?.58:.43;
  const normal=light?'#f8f7fc':'#101019';
  if(!visible||!source){root.classList.remove('karaoke-edge-active');meta?.setAttribute('content',normal);return;}
  let disposed=false;
  root.style.setProperty('--karaoke-edge-art','url('+JSON.stringify(source)+')');
  root.style.setProperty('--karaoke-edge-scrim','rgba('+base.join(',')+','+scrim+')');
  root.style.setProperty('--karaoke-edge-tint',normal);
  root.classList.add('karaoke-edge-active');
  meta?.setAttribute('content',normal);
  // Sample only a tiny, CORS-enabled thumbnail; never read protected audio or
  // require CORS for the actual artwork. If denied, the artwork still renders.
  const sample=new Image();
  sample.crossOrigin='anonymous';
  sample.onload=()=>{
   if(disposed)return;
   try{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.drawImage(sample,0,0,16,16);
    const pixels=ctx.getImageData(0,0,16,16).data;
    const sum=[0,0,0];
    for(let i=0;i<pixels.length;i+=4){
     const weight=pixels[i+3]/255*.9*(1-scrim);
     for(let c=0;c<3;c++)sum[c]+=pixels[i+c]*weight+base[c]*(1-weight);
    }
    const tint='#'+sum.map(v=>Math.round(v/(pixels.length/4)).toString(16).padStart(2,'0')).join('');
    root.style.setProperty('--karaoke-edge-tint',tint);
    meta?.setAttribute('content',tint);
   }catch{/* CORS and canvas restrictions must never break playback. */}
  };
  sample.src=thumbnail??source;
  return ()=>{disposed=true;sample.onload=null;};
 },[open,visible,source,thumbnail]);
}
