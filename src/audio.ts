// Synthetic, original test signals. One AudioContext clock and two independent gains.
export class DemoAudio {
 private context: AudioContext | null=null;
 private buffers: AudioBuffer[]=[];
 private sources: AudioBufferSourceNode[]=[];
 private gains: GainNode[]=[];
 private startedAt=0;
 private offset=0;
 private running=false;
 private levels=[100,15];
 private readonly duration=96;
 get playing(){return this.running;}
 get position(){return Math.min(this.duration,this.running&&this.context?this.offset+this.context.currentTime-this.startedAt:this.offset);}
 async init(){if(this.context)return; const ctx=new AudioContext({sampleRate:22050});this.context=ctx;const sr=ctx.sampleRate;const count=sr*this.duration;const notes=[261.63,329.63,392,440,392,329.63,293.66,261.63];for(let role=0;role<2;role++){const buffer=ctx.createBuffer(1,count,sr);const data=buffer.getChannelData(0);for(let i=0;i<count;i++){const t=i/sr;const beat=t%0.5;const n=notes[Math.floor(t*2)%notes.length];const phrase=t%1;data[i]=role===0?0.12*Math.sin(2*Math.PI*n/2*t)*Math.exp(-beat*5)+0.06*Math.sin(2*Math.PI*n*t)*Math.exp(-beat*9)+0.05*Math.sin(2*Math.PI*55*t)*Math.exp(-beat*22):0.18*(Math.sin(2*Math.PI*n*t+0.13*Math.sin(t*28))+0.25*Math.sin(4*Math.PI*n*t))*Math.min(1,phrase*15,(1-phrase)*15);}this.buffers.push(buffer);const gain=ctx.createGain();gain.gain.value=this.levels[role]/100;gain.connect(ctx.destination);this.gains.push(gain);}}
 setVolumes(music:number,vocals:number){this.levels=[music,vocals].map(n=>Math.max(0,Math.min(100,n)));this.gains.forEach((g,i)=>g.gain.setTargetAtTime(this.levels[i]/100,this.context!.currentTime,0.015));}
 async play(){await this.init();const ctx=this.context!;await ctx.resume();if(this.running)return;if(this.offset>=this.duration)this.offset=0;this.startedAt=ctx.currentTime+0.025;this.sources=this.buffers.map((buffer,i)=>{const source=ctx.createBufferSource();source.buffer=buffer;source.connect(this.gains[i]);source.start(this.startedAt,this.offset);return source;});this.running=true;}
 pause(){if(!this.running)return;this.offset=Math.max(0,this.position);this.running=false;for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}this.sources=[];}
 async seek(seconds:number){const resume=this.running;this.pause();this.offset=Math.max(0,Math.min(this.duration,seconds));if(resume&&this.offset<this.duration)await this.play();}
 reset(){this.pause();this.offset=0;}
 dispose(){this.pause();void this.context?.close();this.context=null;this.buffers=[];this.gains=[];}
}