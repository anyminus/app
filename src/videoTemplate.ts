// Versioned, declarative style data; no executable user templates.
export type VideoTemplate=Readonly<{
 schemaVersion:1;id:string;fontFamily:string;margin:number;gap:number;
 header:Readonly<{align:'left'|'center'|'right';titleSize:number;artistSize:number;titleColor:string;artistColor:string;shadeOpacity:number}>;
 lyrics:Readonly<{align:'left'|'center'|'right';currentSize:number;nextSize:number;currentColor:string;nextColor:string;shadeOpacity:number}>;
 watermark:Readonly<{text:string;align:'left'|'center'|'right';size:number;color:string}>;
}>;
export const classicVideoTemplate:VideoTemplate={
 schemaVersion:1,id:'anyminus-classic',fontFamily:'system-ui, sans-serif',margin:.045,gap:.016,
 header:{align:'left',titleSize:.052,artistSize:.037,titleColor:'#ffffff',artistColor:'#ded8e7',shadeOpacity:.82},
 lyrics:{align:'center',currentSize:.055,nextSize:.042,currentColor:'#e2caff',nextColor:'#ffffff',shadeOpacity:.88},
 watermark:{text:'AnyMinus',align:'right',size:.028,color:'rgba(255,255,255,.72)'}
};
