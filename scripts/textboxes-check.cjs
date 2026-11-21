const {chromium,webkit}=require('playwright');
const {PDFDocument}=require('pdf-lib');
const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
  for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true});const context=await browser.newContext({viewport:{width:1200,height:900},deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
    await page.evaluate(()=>{const points=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;points.push([245+35*Math.cos(a),195+45*Math.sin(a),.5]);}state.glyphs.a=[{pen:2.5,strokes:[points,[[280,150,.5],[280,240,.5]]]}];state.settings.disorder=100;});
    await page.locator('#text').fill('a '.repeat(85));
    for(const [key,value] of [['width','240'],['height','240']]){await page.locator(`#box-${key}`).fill(value);await page.locator(`#box-${key}`).dispatchEvent('change');}
    await page.locator('#box-add').click();await page.locator('#box-name').fill('Zweite Spalte');await page.locator('#text').fill('a '.repeat(70));
    const secondId=await page.locator('#box-select').inputValue();
    await page.waitForFunction(()=>pages.flat().filter(g=>g.boxId!==MAIN_BOX).length===70);
    const frame=page.locator(`.paper-stage[data-page-index="0"] .text-box-frame[data-box-id="${secondId}"]`);await frame.scrollIntoViewIfNeeded();
    let rect=await frame.boundingBox(),paper=await page.locator('#page-preview').boundingBox();
    const before=await page.evaluate(()=>boxMetrics(selectedBox()));
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+paper.width/794*35,rect.y+rect.height/2+paper.height/1123*69,{steps:15});await page.mouse.up();
    await page.locator('#save-status').filter({hasText:'Auf diesem Gerät gespeichert'}).waitFor();
    const moved=await page.evaluate(()=>boxMetrics(selectedBox()));assert.ok(moved.x>before.x+20);assert.ok(moved.y>before.y+40);
    assert.ok(await page.evaluate(()=>pages.flat().every(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))<1e-8)),'all fields stay on paper lines after arbitrary dragging');
    const east=frame.locator('.handle-e');await east.scrollIntoViewIfNeeded();rect=await east.boundingBox();paper=await page.locator('#page-preview').boundingBox();
    const widthBefore=moved.width;
    await page.mouse.move(rect.x+12,rect.y+12);await page.mouse.down();await page.mouse.move(rect.x+12-paper.width/794*100,rect.y+12,{steps:15});await page.mouse.up();
    assert.ok(await page.evaluate(()=>boxMetrics(selectedBox()).width)<widthBefore-80,'east edge actually resizes');
    const south=frame.locator('.handle-s');await south.scrollIntoViewIfNeeded();rect=await south.boundingBox();paper=await page.locator('#page-preview').boundingBox();
    await page.mouse.move(rect.x+12,rect.y+12);await page.mouse.down();await page.mouse.move(rect.x+12,rect.y+12-paper.height/1123*130,{steps:12});await page.mouse.up();
    await page.locator('#save-status').filter({hasText:'Auf diesem Gerät gespeichert'}).waitFor();
    const summary=await page.evaluate(()=>({pages:pages.length,total:pages.flat().filter(g=>g.boxId===selectedBoxId).length,width:boxMetrics(selectedBox()).width,height:boxMetrics(selectedBox()).height,baselineAligned:pages.flat().every(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))<1e-8)}));
    assert.equal(summary.total,70,'overflow continues without dropping characters');assert.ok(summary.pages>1 && summary.height<200 && summary.baselineAligned);
    await page.locator('#box-page').fill('2');await page.locator('#box-page').dispatchEvent('change');
    await page.waitForFunction(()=>currentPage===1);assert.equal(await page.evaluate(()=>selectedBox().page),1);
    const snapshot=await page.evaluate(()=>JSON.stringify(state.boxes));
    await page.locator('#save-status').filter({hasText:'Auf diesem Gerät gespeichert'}).waitFor();await page.reload();await page.locator('#save-status').filter({hasText:'geladen'}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.stringify(state.boxes)),snapshot,'geometry and text survive reload');
    assert.equal(await page.evaluate(()=>normalizedState(state).boxes.length),2,'backup preserves multiple boxes');
    await page.locator('#box-select').selectOption(secondId);await page.locator('#box-delete').click();
    await page.locator('#text').fill('a '.repeat(20));await page.locator('#box-undo-delete').click();
    assert.equal(await page.evaluate(()=>state.boxes.length),2);assert.equal(await page.evaluate(()=>state.text),'a '.repeat(20),'undo deletion keeps subsequent edits');
    const count=await page.evaluate(()=>{renderPreview();return pages.length;});const pdf=Buffer.from(await page.evaluate(async()=>[...new Uint8Array(await (await makePDF()).arrayBuffer())]));assert.equal((await PDFDocument.load(pdf)).getPageCount(),count);
    const output=path.resolve(__dirname,'../output/playwright');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,`${name}-textfields.pdf`),pdf);
    await page.locator('#box-select').selectOption('box-main');
    await page.evaluate(()=>{const other=state.boxes.find(b=>b.id!==MAIN_BOX);other.page=0;other.height=260;renderPreview();});
    await page.screenshot({path:path.join(output,`${name}-textfields.png`),fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:768,height:1024});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(errors.length,0,errors.join('\n'));await browser.close();console.log(`${name}: multiple fields, pointer move/resize, line snapping, width reflow, height continuation, page assignment, persistence, undo and vector PDF passed.`);
  }
})().catch(e=>{console.error(e);process.exit(1);});
