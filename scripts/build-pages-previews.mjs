import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,cpSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

// Only explicitly approved prototype branches are published. Their output is
// collected separately from main; no preview build can replace the main root.
const branches=JSON.parse(readFileSync(new URL('../pages-previews.json',import.meta.url),'utf8'));
if(!Array.isArray(branches)||new Set(branches).size!==branches.length)throw Error('Invalid preview list');
for(const branch of branches){
 if(typeof branch!=='string'||!/^prototype\/[a-z0-9][a-z0-9-]{0,63}$/.test(branch))throw Error('Invalid preview branch: '+branch);
}
const root=resolve('pages-previews');
rmSync(root,{recursive:true,force:true});
mkdirSync(join(root,'prototype'),{recursive:true});
const scratch=mkdtempSync(join(tmpdir(),'anyminus-pages-'));
try{
 for(const branch of branches){
  const work=join(scratch,branch.split('/')[1]);
  execFileSync('git',['clone','--depth','1','--single-branch','--branch',branch,'https://github.com/anyminus/app.git',work],{stdio:'inherit'});
  for(const args of [['install','--no-audit','--no-fund'],['test'],['run','build']])execFileSync('npm',args,{cwd:work,stdio:'inherit'});
  if(!existsSync(join(work,'dist','index.html')))throw Error('No preview index: '+branch);
  cpSync(join(work,'dist'),join(root,branch),{recursive:true});
  console.log('Prepared /app/'+branch+'/');
 }
 // Ensure the artifact has an entry even when the allowlist is empty.
 mkdirSync(join(root,'prototype'),{recursive:true});
 if(!branches.length)cpSync(new URL('../pages-previews.json',import.meta.url),join(root,'prototype','index.json'));
}finally{rmSync(scratch,{recursive:true,force:true});}
