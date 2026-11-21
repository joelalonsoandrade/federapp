const {chromium,webkit}=require('C:/Users/drei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
  const mode=process.argv[2]||'before',output=path.resolve(__dirname,'../output/playwright');await fs.mkdir(output,{recursive:true});
  const results={};
  for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true}),page=await browser.newPage({viewport:{width:1024,height:768},deviceScaleFactor:2});
    await page.goto('http://127.0.0.1:4173');await page.locator('#save-status').filter({hasText:'bereit'}).waitFor();
    results[name]=await page.evaluate(()=>{
      const points=[];for(let i=0;i<=50;i++){const a=i/50*Math.PI*2;points.push([245+35*Math.cos(a),195+45*Math.sin(a),.5]);}
      state.glyphs.a=[{pen:2.5,strokes:[points,[[280,150,.5],[280,240,.5]]]}];state.text='a '.repeat(150);state.settings.paper='dots';state.settings.spacing=18;
      state.boxes=[{id:MAIN_BOX,name:'Erstes Feld',text:'',page:0,x:64,y:50,width:280,height:500,auto:false},{id:'box-second',name:'Zweites Feld',text:'a '.repeat(120),page:0,x:410,y:110,width:280,height:500,auto:false}];selectedBoxId='box-second';syncControls();renderPreview();
      const samples=[];for(let i=0;i<24;i++){selectedBox().y=110+i*.4;const start=performance.now();renderPreview();pageCanvas.getBoundingClientRect();samples.push(performance.now()-start);}
      const sorted=[...samples].sort((a,b)=>a-b);return {medianMs:sorted[Math.floor(sorted.length/2)],worstMs:sorted.at(-1),svgNodes:pageCanvas.querySelectorAll('*').length,paperNodes:pageCanvas.querySelector('[data-layer="paper"]')?.querySelectorAll('*').length || 0};
    });
    if(mode==='after'){
      assert.ok(results[name].paperNodes<10 && results[name].paperNodes>0,'dots use a compact pattern');
      assert.ok(results[name].svgNodes<1000,'SVG has no thousands of per-dot nodes');
      const stable=await page.evaluate(()=>{
        const paper=pageCanvas.querySelector('[data-layer="paper"]'),pattern=paper.querySelector('pattern'),ink=pageCanvas.querySelector('[data-layer="ink"]');
        selectedBox().y+=7;renderPreview();const same=paper===pageCanvas.querySelector('[data-layer="paper"]')&&pattern===paper.querySelector('pattern')&&ink===pageCanvas.querySelector('[data-layer="ink"]');
        const oldStep=pattern.getAttribute('width');state.settings.spacing=30;renderPreview();return same&&pageCanvas.querySelector('pattern').getAttribute('width')!==oldStep;
      });assert.ok(stable,'paper layer remains intact while moving, and updates on spacing changes');
      const baseline=JSON.parse(await fs.readFile(path.join(output,'dots-before.json'),'utf8'));results[name].speedup=baseline[name].medianMs/results[name].medianMs;
    }
    await browser.close();
  }
  await fs.writeFile(path.join(output,`dots-${mode}.json`),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1);});
