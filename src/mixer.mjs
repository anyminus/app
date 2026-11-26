export function effectiveVolume(level,muted){return muted?0:Number.isFinite(level)?Math.max(0,Math.min(100,level)):0}
