// Versioned, declarative style data; no executable user templates.
export type VideoTemplate=Readonly<{
 schemaVersion:1;id:string;fontFamily:string;margin:number;gap:number;
 header:Readonly<{align:'left'|'center'|'right';titleSize:number;artistSize:number;titleColor:string;artistColor:string;shadeOpacity:number;safeTop:number}>;
 lyrics:Readonly<{align:'left'|'center'|'right';currentSize:number;nextSize:number;currentColor:string;nextColor:string;shadeOpacity:number;transitionMs:number;safeBottom:number;nextOpacity:number}>;
 watermark:Readonly<{text:string;align:'left'|'center'|'right';size:number;color:string}>;
}>;
export const classicVideoTemplate:VideoTemplate={
 schemaVersion:1,id:'anyminus-classic',fontFamily:'system-ui, sans-serif',margin:.045,gap:.016,
 header:{align:'left',titleSize:.0624,artistSize:.0444,titleColor:'#ffffff',artistColor:'#ded8e7',shadeOpacity:.82,safeTop:.085},
 lyrics:{align:'center',currentSize:.066,nextSize:.0504,currentColor:'#e2caff',nextColor:'#ffffff',shadeOpacity:.88,transitionMs:600,safeBottom:.14,nextOpacity:.68},
 watermark:{text:'AnyMinus',align:'right',size:.028,color:'rgba(255,255,255,.72)'}
};
