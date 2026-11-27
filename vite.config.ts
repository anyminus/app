import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {version} from './package.json';
const require=createRequire(import.meta.url);
// Both files are part of the exact same Pages deployment artifact as index.html.
const manifest=()=>JSON.stringify({schemaVersion:1,version})+'\n';
const worklet=()=>readFileSync(require.resolve('signalsmith-stretch'));
export default defineConfig({base:'./',plugins:[react(),{
 name:'anyminus-release-artifacts',
 generateBundle(){
  this.emitFile({type:'asset',fileName:'version.json',source:manifest()});
  this.emitFile({type:'asset',fileName:'signalsmith-worklet.js',source:worklet()});
 },
 configureServer(server){
  server.middlewares.use((req,res,next)=>{
   const path=req.url?.split('?')[0];
   if(path==='/version.json'){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(manifest());return}
   if(path==='/signalsmith-worklet.js'){res.setHeader('Content-Type','application/javascript');res.end(worklet());return}
   next();
  })
 }
}]});
