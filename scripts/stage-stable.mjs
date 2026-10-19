// Promote an already-verified standalone build to the local playable entry point.
// Version snapshots are immutable so an older release can always be reviewed.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const html=await readFile('output/planet-demo/planet-demo.html');
const snapshot=join('output/releases',version);
await mkdir(snapshot,{recursive:true});
try {
  const existing=await readFile(join(snapshot,'index.html'));
  if(!existing.equals(html))throw new Error(`Release ${version} already exists with different content; increment the version first.`);
}catch(error){if(error.code==='ENOENT')await writeFile(join(snapshot,'index.html'),html);else throw error;}
await mkdir('output/planet-stable',{recursive:true});
await writeFile('output/planet-stable/index.html.next',html);
await rename('output/planet-stable/index.html.next','output/planet-stable/index.html');
console.log(`Local stable release: ${version}; ${html.length} bytes`);
