export function normalizeStoredLyrics(payload,durationMs){
 if(!payload||!['available','absent','transient_error'].includes(payload.state)||!['LRC','TEXT'].includes(payload.format)||!Array.isArray(payload.lines))throw Error('Некорректный ответ текста');
 const lines=payload.state==='available'&&payload.format==='LRC'&&payload.timing==='line'?payload.lines.filter(l=>l&&typeof l.text==='string'&&l.text.trim()&&Number.isSafeInteger(l.startMs)&&l.startMs>=0&&l.startMs<durationMs&&l.startOrigin==='source').map(l=>({text:l.text,startMs:l.startMs,endMs:Number.isSafeInteger(l.endMs)&&l.endMs>=l.startMs?Math.min(l.endMs,durationMs):null})).sort((a,b)=>a.startMs-b.startMs):[];
 const text=payload.state==='available'&&payload.format==='TEXT'&&typeof payload.text==='string'?payload.text.trim():'';
 return {state:payload.state,lines,text};
}
export function retryLyricsStatus(status){return status===0||status===408||status===429||status>=500}
