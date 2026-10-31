/** Build a single-file offline preview with no dependencies or API key. */
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read=(name)=>readFile(path.join(root,name),'utf8');
let [html,css,questions,engine,storage,app,icon]=await Promise.all([
  read('index.html'),read('styles.css'),read('src/questions.js'),
  read('src/engine.js'),read('src/storage.js'),read('src/app.js'),read('assets/favicon.svg')
]);
const stripExports = s=>s.replace(/^export /gm,'');
const stripImports = s=>s.replace(/^import .*;\s*$/gm,'');
const combined = [stripExports(questions),stripExports(stripImports(engine)),stripExports(stripImports(storage)),stripImports(app)].join('\n\n');
if (/<\/script/i.test(combined)) throw Error('Unsafe script closing tag in source');
html=html.replace('<link rel="icon" href="assets/favicon.svg" type="image/svg+xml" />',`<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}" />`);
html=html.replace('<link rel="stylesheet" href="styles.css" />',`<style>\n${css}\n</style>`);
html=html.replace('<script type="module" src="src/app.js"></script>',`<script>\n${combined}\n</script>`);
await writeFile(path.join(root,'preview.html'),html);
console.log('Generated preview.html (standalone offline demo).');
