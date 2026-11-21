const {chromium} = require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
(async()=>{
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'feder-storage-check-'));
  let context=await chromium.launchPersistentContext(profile,{headless:true});
  let page=await context.newPage();await page.goto('http://127.0.0.1:4173');
  await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
  await page.evaluate(async()=>{state.text='Diese Schrift bleibt nach einem Browser-Neustart erhalten.';state.glyphs.a=[{pen:3,strokes:[[[220,150,.5],[240,240,.5],[270,180,.5]]]}];await persist();});
  await context.close();
  context=await chromium.launchPersistentContext(profile,{headless:true});
  page=await context.newPage();await page.goto('http://127.0.0.1:4173');
  await page.locator('#save-status').filter({hasText:'geladen'}).waitFor();
  assert.equal(await page.evaluate(()=>state.glyphs.a.length),1);
  assert.match(await page.locator('#text').inputValue(),/Browser-Neustart/);
  await context.close();
  // Only remove the exact, newly created test profile under the OS temporary directory.
  if(path.dirname(profile)===path.resolve(os.tmpdir()) && path.basename(profile).startsWith('feder-storage-check-'))await fs.rm(profile,{recursive:true,force:true});
  console.log('Persistence across complete browser shutdown and restart passed.');
})().catch(error=>{console.error(error);process.exit(1);});
