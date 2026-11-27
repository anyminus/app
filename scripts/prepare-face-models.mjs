import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../public/face-models/',import.meta.url);
await mkdir(dir,{recursive:true});
const models=[
 ['facefinder','https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder',239632,'340d0f5aea2dffab4457d44266821b753d9adfa7'],
 ['puploc','https://raw.githubusercontent.com/esimov/pigo/9ad5f2b5ee2104f6dc7aa81a40ca7ccf539fc2ea/pkg/cascade/puploc',1228416,'0447dcf932b97fd3368ad822d92fa081a4651ed7']
];
const valid=(bytes,size,sha)=>bytes.length===size&&createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===sha;
for(const [name,url,size,sha] of models){
 const path=new URL(name+'.bin',dir);
 try{if(valid(await readFile(path),size,sha))continue;}catch{}
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Face model download: '+name+' '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!valid(bytes,size,sha))throw Error('Unexpected face model checksum: '+name);
 await writeFile(path,bytes);
 console.log('Verified local face model: '+name);
}
