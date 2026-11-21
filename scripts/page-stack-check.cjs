const {chromium,webkit}=require('playwright');
const {PDFDocument}=require('pdf-lib');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
  for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true}),page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
    await page.evaluate(()=>{
      state.glyphs.a=[{pen:2.5,strokes:[[[200,150,.5],[240,150,.5],[240,240,.5],[200,240,.5],[200,150,.5]]]}];
      state.text=Array.from({length:40},()=> 'aaa').join('\n');
      state.boxes=[{id:MAIN_BOX,name:'Fortlaufender Text',text:'',page:0,x:64,y:328.8,width:240,height:200,auto:false},{id:'box-third',name:'Dritte Seite',text:'aaa',page:2,x:430,y:160,width:240,height:230,auto:false}];
      syncControls();renderPreview();
    });
    assert.equal(await page.locator('.preview-page').count(),3);
    assert.ok(await page.evaluate(()=>{
      const pages=[...document.querySelectorAll('.paper-stage')].map(el=>el.getBoundingClientRect());
      return pages.every((r,i)=>i===0 || r.top>pages[i-1].bottom+20);
    }),'every new sheet is below the previous one');
    assert.deepEqual(await page.locator('.page-caption').allTextContents(),['Seite 1','Seite 2','Seite 3']);
    await page.locator('#next-page').click();await page.waitForFunction(()=>currentPage===1);
    const frame=page.locator('.paper-stage[data-page-index="1"] .text-box-frame[data-box-id="box-main"]');
    assert.match(await frame.locator('.text-box-title').textContent(),/Fortsetzung/);
    const original=await page.evaluate(()=>boxMetrics(state.boxes[0]));
    const before=await page.evaluate(()=>boxPageMetrics(state.boxes[0],1));
    assert.equal(before.baseline,84,'continuation starts at the first paper line rather than the source position');
    let r=await frame.boundingBox(),paper=await page.locator('.paper-stage[data-page-index="1"] .page-preview').boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
    await page.mouse.move(r.x+r.width/2+paper.width/794*25,r.y+r.height/2+paper.height/1123*55,{steps:10});await page.mouse.up();
    const moved=await page.evaluate(()=>boxPageMetrics(state.boxes[0],1));assert.ok(moved.x>before.x+20 && moved.y>before.y+40,'dragging on page 2 uses page 2 coordinates');
    assert.deepEqual(await page.evaluate(()=>boxMetrics(state.boxes[0])),original,'continuation drag leaves source field unchanged');
    assert.ok(await page.evaluate(()=>pages.flat().every(g=>Math.abs((g.y-state.settings.top)/state.settings.spacing-Math.round((g.y-state.settings.top)/state.settings.spacing))<1e-8)),'continuations stay on lines');
    await page.evaluate(()=>scrollToPreviewPage(2));await page.waitForFunction(()=>currentPage===2);
    const third=page.locator('.paper-stage[data-page-index="2"] .text-box-frame[data-box-id="box-third"]');
    await page.evaluate(()=>window.unchangedInk=document.querySelector('#page-preview [data-layer="ink"]').firstElementChild);
    await third.focus();await page.keyboard.press('ArrowRight');
    assert.ok(await page.evaluate(()=>window.unchangedInk===document.querySelector('#page-preview [data-layer="ink"]').firstElementChild),'editing another page does not replace unchanged ink');
    for(const paperType of ['dots','grid','blank','lined']){
      await page.evaluate(p=>{state.settings.paper=p;renderPreview();},paperType);
      const ids=await page.locator('#page-stack [id]').evaluateAll(elements=>elements.map(e=>e.id));
      assert.equal(new Set(ids).size,ids.length,'all SVG definitions have unique IDs across pages');
      assert.equal(await page.locator('.preview-page').count(),3);
    }
    const pdf=Buffer.from(await page.evaluate(async()=>[...new Uint8Array(await (await makePDF()).arrayBuffer())]));
    assert.equal((await PDFDocument.load(pdf)).getPageCount(),3);
    await page.evaluate(()=>{state.boxes=state.boxes.slice(0,1);state.text='aaa';selectBox(MAIN_BOX,false);renderPreview();});
    assert.equal(await page.locator('.preview-page').count(),1,'obsolete overflow sheets disappear');
    await page.locator('#text').fill(Array.from({length:20},()=> 'aaa').join('\n'));
    await page.waitForFunction(()=>pages.length===2 && document.querySelectorAll('.preview-page').length===2);
    await page.setViewportSize({width:768,height:1024});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on iPad');
    await page.evaluate(()=>scrollToPreviewPage(1));
    const output=path.resolve(__dirname,'../output/playwright');await fs.mkdir(output,{recursive:true});
    await page.screenshot({path:path.join(output,`${name}-page-stack.png`),animations:'disabled'});
    assert.deepEqual(errors,[]);await browser.close();
    console.log(`${name}: stacked pages, navigation, page-2 drag, line alignment, page cache, unique SVG IDs, 3-page PDF, adding/removing overflow, iPad layout passed.`);
  }
})().catch(e=>{console.error(e);process.exit(1);});
