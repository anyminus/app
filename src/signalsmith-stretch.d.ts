declare module 'signalsmith-stretch' {
 export interface StretchNode extends AudioWorkletNode {
  latency():Promise<number>;
  schedule(options:{active?:boolean;output?:number;rate?:number;semitones?:number}):Promise<unknown>;
 }
 export default function SignalsmithStretch(context:AudioContext,options?:AudioWorkletNodeOptions):Promise<StretchNode>;
}
