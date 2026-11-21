const {chromium,webkit}=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true}),page=await browser.newPage({viewport:{width:1200,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
    await page.locator('#text').fill('Erstes Feld mit mehreren Zeilen.\nWeitere Zeile.');
    await page.locator('#box-width').fill('230');await page.locator('#box-width').dispatchEvent('change');
    await page.locator('#box-height').fill('200');await page.locator('#box-height').dispatchEvent('change');
    await page.locator('#box-add').click();await page.locator('#text').fill('Zweites Feld.\nNoch eine Zeile.');
    const id=await page.locator('#box-select').inputValue(),frame=page.locator(`.text-box-frame[data-box-id="${id}"]`);
    for(const paper of ['grid','dots','blank']){
      await page.locator(`[data-paper="${paper}"]`).click();await page.waitForFunction(p=>state.settings.paper===p,paper);
      await frame.focus();const before=await page.evaluate(()=>boxMetrics(selectedBox()));
      await page.keyboard.press('Alt+ArrowDown');const moved=await page.evaluate(()=>boxMetrics(selectedBox()));
      assert.ok(Math.abs(moved.y-before.y-1)<1e-8,`${paper}: free keyboard movement without snapping`);
      await page.keyboard.press('Alt+Shift+ArrowUp');assert.ok(Math.abs(await page.evaluate(()=>boxMetrics(selectedBox()).height)-before.height+1)<1e-8,`${paper}: free resize`);
      await frame.scrollIntoViewIfNeeded();const r=await frame.boundingBox(),p=await page.locator('#page-preview').boundingBox(),yBefore=await page.evaluate(()=>boxMetrics(selectedBox()).y);
      await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height/2+p.height/1123*7.3,{steps:5});await page.mouse.up();
      const yAfter=await page.evaluate(()=>boxMetrics(selectedBox()).y);assert.ok(Math.abs(yAfter-yBefore-7.3)<1123/p.height+.01,`${paper}: pointer follows free movement within the browser's event coordinate precision`);
      await page.evaluate(()=>{assignBoxRect(state.boxes[0],{...boxMetrics(state.boxes[0]),y:95.7});renderPreview();});
      assert.ok(await page.evaluate(()=>pages.flat().some(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))>.001)),`${paper}: text is not forced onto a grid`);
      await page.locator('[data-paper="lined"]').click();await page.waitForFunction(()=>state.settings.paper==='lined' && pages.flat().every(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))<1e-8));
      assert.ok(await page.evaluate(()=>state.boxes.every(b=>Math.abs(boxMetrics(b).baseline-state.settings.top-state.settings.spacing*Math.round((boxMetrics(b).baseline-state.settings.top)/state.settings.spacing))<1e-8)),`back from ${paper}: every box aligns`);
    }
    await page.locator('#save-status').filter({hasText:'Auf diesem Gerät gespeichert'}).waitFor();await page.reload();await page.locator('#save-status').filter({hasText:'geladen'}).waitFor();
    assert.ok(await page.evaluate(()=>state.settings.paper==='lined' && pages.flat().every(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))<1e-8)),'alignment remains correct after reload');
    assert.equal(errors.length,0,errors.join('\n'));await browser.close();console.log(`${name}: all 3 non-lined papers allow free drag and resize; switching back aligns all fields, including after reload.`);
  }
})().catch(e=>{console.error(e);process.exit(1);});
