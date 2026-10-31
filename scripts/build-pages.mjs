import { cp, mkdir, rm, lstat, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(root,'dist');
// Recursive removal is confined to this fixed generated directory; reject symlinks.
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw Error('Unsafe build destination');
try{if((await lstat(output)).isSymbolicLink())throw Error('Refusing symlink destination');}catch(e){if(e.code!=='ENOENT')throw e;}
await rm(output,{recursive:true,force:true});await mkdir(output);
// Publish an explicit static allowlist. API/server/test/config/environment files are excluded.
for(const name of ['index.html','preview.html','styles.css','README.md'])await cp(path.join(root,name),path.join(output,name));
const directories={src:/^(app|engine|questions|storage)\.js$/,assets:/^[\w-]+\.(png|svg|json)$/,docs:/^[\w-]+\.md$/};
for(const [directory,pattern] of Object.entries(directories)){
  await mkdir(path.join(output,directory));
  for(const entry of await readdir(path.join(root,directory),{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('Symlink in public source');
    if(entry.isFile()&&pattern.test(entry.name))await cp(path.join(root,directory,entry.name),path.join(output,directory,entry.name));
  }
}
await writeFile(path.join(output,'.nojekyll'),'');
console.log('Built dist/ (static only; no API, keys, tests or development server).');
