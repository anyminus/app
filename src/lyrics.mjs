export function normalizeStoredLyrics(payload,durationMs){
 if(!payload||!['available','absent','transient_error'].includes(payload.state)||!['LRC','TEXT'].includes(payload.format)||!Array.isArray(payload.lines))throw Error('Некорректный ответ текста');
 const lines=payload.state==='available'&&payload.format==='LRC'&&payload.timing==='line'?payload.lines.filter(l=>l&&typeof l.text==='string'&&l.text.trim()&&Number.isSafeInteger(l.startMs)&&l.startMs>=0&&l.startMs<durationMs&&l.startOrigin==='source').map(l=>({text:l.text,startMs:l.startMs,endMs:Number.isSafeInteger(l.endMs)&&l.endMs>=l.startMs?Math.min(l.endMs,durationMs):null})).sort((a,b)=>a.startMs-b.startMs):[];
 const text=payload.state==='available'&&payload.format==='TEXT'&&typeof payload.text==='string'?payload.text.trim():'';
 return {state:payload.state,lines,text};
}
export function retryLyricsStatus(status){return status===0||status===408||status===429||status>=500}

// Normalized critically damped spring-like curve. No overshoot, bounded 0..1.
/** @param {number} progress */
export function lyricScrollEase(progress){const t=Math.max(0,Math.min(1,progress));const curve=x=>1-(1+7*x)*Math.exp(-7*x);return t===0?0:t===1?1:curve(t)/curve(1)}

// Only long intros with a validated source timestamp qualify. Countdown follows
// the audio position, not wall time; ceil avoids a visible zero before singing.
/** @param {number|undefined} firstStartMs @param {number} positionSeconds @param {number} [rate] */
export function introCountdown(firstStartMs,positionSeconds,rate=1){if(typeof firstStartMs!=='number'||!Number.isFinite(firstStartMs)||firstStartMs<=10000||!Number.isFinite(positionSeconds))return null;const remaining=firstStartMs-Math.max(0,positionSeconds)*1000;return remaining>0?Math.ceil(remaining/1000/(Number.isFinite(rate)&&rate>0?rate:1)):null}
