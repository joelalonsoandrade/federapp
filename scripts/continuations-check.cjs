const {chromium,webkit}=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {PDFDocument}=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdf-lib');
const assert=require('node:assert/strict');
(async()=>{
  for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true}),page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
    await page.evaluate(()=>{
      state.glyphs.a=[{pen:2.5,strokes:[[[200,150,.5],[240,150,.5],[240,240,.5],[200,240,.5],[200,150,.5]]]}];
      state.text=Array.from({length:60},()=> 'aaaaaa').join('\n');
      state.boxes=[{id:MAIN_BOX,name:'Mein Text',text:'',page:0,x:64,y:412.8,width:280,height:200,auto:false}];
      selectedBoxPage=null;syncControls();renderBoxEditor();renderPreview();
    });
    const source=await page.evaluate(()=>boxMetrics(selectedBox()));
    const later=await page.evaluate(()=>boxPageMetrics(selectedBox(),2));
    assert.equal(later.baseline,84,'continuations start on the first writing line');
    assert.equal(await page.evaluate(()=>pages.length),3);
    await page.evaluate(()=>scrollToPreviewPage(1));
    const frame=page.locator('.paper-stage[data-page-index="1"] .text-box-frame[data-box-id="box-main"]');
    await frame.scrollIntoViewIfNeeded();
    let r=await frame.boundingBox(),paper=await page.locator('.paper-stage[data-page-index="1"] .page-preview').boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/3);await page.mouse.down();
    await page.mouse.move(r.x+r.width/2+paper.width/794*35,r.y+r.height/3+paper.height/1123*67,{steps:12});await page.mouse.up();
    let part=await page.evaluate(()=>boxPageMetrics(selectedBox(),1));
    assert.ok(part.x>source.x+25 && part.y>later.y+40,'continuation follows pointer');
    assert.deepEqual(await page.evaluate(()=>boxMetrics(selectedBox())),source,'first field is untouched');
    assert.deepEqual(await page.evaluate(()=>boxPageMetrics(selectedBox(),2)),later,'another continuation is untouched');
    assert.equal(await page.evaluate(()=>selectedPartPage()),1);
    assert.ok(await page.locator('#box-part').isVisible());
    const east=frame.locator('.handle-e');await east.scrollIntoViewIfNeeded();r=await east.boundingBox();
    const oldWidth=part.width;
    await page.mouse.move(r.x+12,r.y+12);await page.mouse.down();await page.mouse.move(r.x+12-paper.width/794*65,r.y+12,{steps:10});await page.mouse.up();
    part=await page.evaluate(()=>boxPageMetrics(selectedBox(),1));assert.ok(part.width<oldWidth-50,'continuation can resize independently');
    await page.locator('#box-width').fill('190');await page.locator('#box-width').dispatchEvent('change');
    await page.locator('#box-height').fill('250');await page.locator('#box-height').dispatchEvent('change');
    await page.waitForFunction(()=>boxPageMetrics(selectedBox(),1).width===190 && boxPageMetrics(selectedBox(),1).height===250);
    assert.deepEqual(await page.evaluate(()=>boxMetrics(selectedBox())),source,'sidebar dimensions apply only to selected continuation');
    assert.equal(await page.evaluate(()=>pages.flat().length),360,'all text flows through resized continuation without duplication or loss');
    for(const paperType of ['grid','dots','blank']){
      await page.locator(`[data-paper="${paperType}"]`).click();
      await page.waitForFunction(p=>state.settings.paper===p,paperType);
      await frame.focus();const before=await page.evaluate(()=>boxPageMetrics(selectedBox(),1));
      await page.keyboard.press('Alt+ArrowDown');
      const after=await page.evaluate(()=>boxPageMetrics(selectedBox(),1));
      assert.ok(Math.abs(after.y-before.y-1)<1e-8,`${paperType}: continuation moves without snapping`);
      await page.keyboard.press('Alt+Shift+ArrowDown');
      assert.ok(Math.abs(await page.evaluate(()=>boxPageMetrics(selectedBox(),1).height)-after.height-1)<1e-8,`${paperType}: continuation resizes without snapping`);
    }
    await page.locator('[data-paper="lined"]').click();
    await page.waitForFunction(()=>state.settings.paper==='lined' && pages.flat().every(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))<1e-8));
    const geometry=await page.evaluate(()=>boxPageMetrics(selectedBox(),1));
    const tiny=await page.evaluate(()=>{
      const box=selectedBox();assignPageBoxRect(box,{...boxPageMetrics(box,2),height:0},2);renderPreview();return boxPageMetrics(box,2);
    });
    const backup=await page.evaluate(()=>{
      const raw=JSON.stringify(state),incoming=normalizedState(JSON.parse(raw));
      return {saved:state.boxes[0].continuations,loaded:incoming.boxes[0].continuations};
    });assert.deepEqual(backup.loaded,backup.saved,'backup validation preserves continuation rectangles');
    await page.evaluate(()=>persist());await page.reload();await page.locator('#save-status').filter({hasText:'geladen'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>boxPageMetrics(selectedBox(),1)),geometry,'reload preserves continuation position and dimensions');
    assert.deepEqual(await page.evaluate(()=>boxPageMetrics(selectedBox(),2)),tiny,'minimum-height continuation survives reload exactly');
    assert.deepEqual(await page.evaluate(()=>boxMetrics(selectedBox())),source,'reload preserves independent original position');
    assert.equal(await page.evaluate(()=>pages.flat().length),360);
    const pageCount=await page.evaluate(()=>pages.length);
    const pdf=Buffer.from(await page.evaluate(async()=>[...new Uint8Array(await (await makePDF()).arrayBuffer())]));
    assert.equal((await PDFDocument.load(pdf)).getPageCount(),pageCount,'PDF includes reflowed continuations');
    assert.deepEqual(errors,[]);await browser.close();
    console.log(`${name}: independent continuation drag/resize, sidebar editing, other-field isolation, top-of-page defaults, lossless reflow, 4 paper types, backup, reload and PDF passed.`);
  }
})().catch(e=>{console.error(e);process.exit(1);});
