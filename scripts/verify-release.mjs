import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ignored=new Set(['.git','node_modules','.cache','dist','test-results','playwright-report']);
async function filesUnder(directory){
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const filename=path.join(directory,entry.name);
    if(entry.isSymbolicLink())throw Error(`Unexpected symlink: ${path.relative(root,filename)}`);
    if(entry.isDirectory())result.push(...await filesUnder(filename));else result.push(filename);
  }
  return result;
}
export function containsSecret(text){
  return [/\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/,/\bgh[pousr]_[A-Za-z0-9]{30,}/,/\bgithub_pat_[A-Za-z0-9_]{30,}/,/\bAKIA[0-9A-Z]{16}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/].some(pattern=>pattern.test(text));
}
export async function verifyRelease(){
  const files=await filesUnder(root);let links=0, scanned=0;
  for(const file of files){
    const relative=path.relative(root,file);
    if(path.basename(file).startsWith('.env')&&path.basename(file)!=='.env.example')throw Error(`Environment file in release source: ${relative}`);
    if(!/\.(?:[cm]?js|md|html|css|json|yaml|yml|svg|example)$/.test(file))continue;
    const text=await readFile(file,'utf8');scanned++;
    if(containsSecret(text))throw Error(`Potential credential in ${relative}; content omitted`);
    if(file.endsWith('.md'))for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
      const target=match[1].split('#')[0];if(!target||/^[a-z]+:/i.test(target))continue;
      await access(path.resolve(path.dirname(file),decodeURIComponent(target)));links++;
    }
  }
  const distFiles=await filesUnder(path.join(root,'dist'));
  for(const file of distFiles){
    const relative=path.relative(path.join(root,'dist'),file).replaceAll('\\','/');
    if(!/^(index\.html|preview\.html|styles\.css|README\.md|\.nojekyll|src\/(app|engine|questions|storage)\.js|assets\/[\w-]+\.(png|svg|json)|docs\/[\w-]+\.md)$/.test(relative))throw Error(`Unexpected public file: ${relative}`);
    if(!file.endsWith('.png')&&containsSecret(await readFile(file,'utf8')))throw Error(`Potential credential in public output: ${relative}`);
  }
  console.log(`Release checks passed: ${scanned} source text files scanned; ${links} local Markdown links resolved; ${distFiles.length} allowlisted static files. No matching credential patterns found.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyRelease();
