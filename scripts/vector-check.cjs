const {chromium}=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {PDFDocument,PDFName}=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdf-lib');
const native=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
  const output=path.resolve(__dirname,'../output/playwright');await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');
  await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
  await page.evaluate(()=>{
    const circle=[];for(let i=0;i<=50;i++){const angle=i/50*Math.PI*2;circle.push([245+35*Math.cos(angle),195+45*Math.sin(angle),.5]);}
    state.glyphs.a=[{pen:2.5,strokes:[circle,[[280,150,.5],[280,240,.5],[300,240,.5]]]}];state.text='a '.repeat(160);state.settings.size=12;state.settings.disorder=70;state.settings.strokeWidth=.9;state.settings.fallback=false;syncControls();renderPreview();
  });
  assert.equal(await page.locator('#page-preview').evaluate(el=>el.tagName.toLowerCase()),'svg');
  assert.equal(await page.locator('#page-preview image').count(),0,'preview own letters are not images');
  assert.ok(await page.locator('#page-preview use').count()>160,'preview contains vectors');
  const widths=await page.evaluate(()=>{
    const pen=g=>g.v.pen/2.5*state.settings.strokeWidth/((state.settings.size/REF_XHEIGHT)*g.stretch);
    const g=pages[0][0],small=pen(g)*state.settings.size/REF_XHEIGHT*g.stretch;state.settings.size=40;pages=layout();const large=pen(pages[0][0])*state.settings.size/REF_XHEIGHT*pages[0][0].stretch;state.settings.size=12;renderPreview();return [small,large];
  });
  assert.ok(Math.abs(widths[0]-widths[1])<1e-8,'physical ink thickness is independent of text size');
  await page.screenshot({path:path.join(output,'vector-preview-small.png'),fullPage:true,animations:'disabled'});
  const pdfBytes=Buffer.from(await page.evaluate(async()=>[...new Uint8Array(await (await makePDF()).arrayBuffer())]));
  await fs.writeFile(path.join(output,'vector-small.pdf'),pdfBytes);
  const document=await PDFDocument.load(pdfBytes);assert.equal(document.getPageCount(),1);
  const xobjects=document.getPage(0).node.Resources()?.lookup(PDFName.of('XObject'));
  assert.ok(!xobjects || xobjects.keys().length===0,'own handwriting PDF contains no bitmap image objects');
  global.DOMMatrix=native.DOMMatrix;global.ImageData=native.ImageData;global.Path2D=native.Path2D;
  const pdfjs=await import('file:///C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const loaded=await pdfjs.getDocument({data:new Uint8Array(pdfBytes),useSystemFonts:true}).promise;
  const pdfPage=await loaded.getPage(1),operators=await pdfPage.getOperatorList();
  assert.ok(operators.fnArray.includes(pdfjs.OPS.constructPath),'PDF contains drawing paths');
  const viewport=pdfPage.getViewport({scale:4}),canvas=native.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
  await fs.writeFile(path.join(output,'vector-small-render-4x.png'),canvas.toBuffer('image/png'));
  const crop=native.createCanvas(1200,320);crop.getContext('2d').drawImage(canvas,100,200,1200,320,0,0,1200,320);
  await fs.writeFile(path.join(output,'vector-small-render-detail.png'),crop.toBuffer('image/png'));
  // The same vector writer must support imported paper and temporary font fallback.
  await page.evaluate(()=>{state.text='a ! ä €';state.settings.fallback=true;state.template='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';});
  await page.evaluate(async()=>{templateImage=await loadImage(state.template);});
  const mixed=Buffer.from(await page.evaluate(async()=>[...new Uint8Array(await (await makePDF()).arrayBuffer())]));
  await fs.writeFile(path.join(output,'vector-mixed.pdf'),mixed);await PDFDocument.load(mixed);
  const mixedDocument=await pdfjs.getDocument({data:new Uint8Array(mixed),useSystemFonts:true}).promise;
  const mixedPage=await mixedDocument.getPage(1),mixedViewport=mixedPage.getViewport({scale:1}),mixedCanvas=native.createCanvas(Math.ceil(mixedViewport.width),Math.ceil(mixedViewport.height));
  await mixedPage.render({canvasContext:mixedCanvas.getContext('2d'),viewport:mixedViewport,canvas:mixedCanvas}).promise;
  assert.equal(errors.length,0,errors.join('\n'));
  await browser.close();console.log('SVG preview, constant physical ink width, bitmap-free own-handwriting PDF, 4x PDF rendering, template and fallback export passed.');
})().catch(e=>{console.error(e);process.exit(1);});
