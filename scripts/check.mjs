import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const sources=['src','api','scripts'].flatMap(dir=>readdirSync(dir).filter(f=>/\.m?js$/.test(f)).map(f=>`${dir}/${f}`));
for(const file of sources){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
const tests=readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>`tests/${f}`);
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});
process.exit(result.status||0);
