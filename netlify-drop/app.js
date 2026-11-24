'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const GROUPS = {
  lower: [...'abcdefghijklmnopqrstuvwxyzäöüß'],
  upper: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'],
  digits: [...'0123456789'],
  punct: [...'.,:;!?-–()„“"\'/%+=&@€°'],
};
const ALL = [...new Set(Object.values(GROUPS).flat())];
const DEFAULTS = { paper:'lined', format:'a4', paperColor:'#fffefa', size:22, width:100, wordSpacing:175, strokeWidth:1.1, disorder:18, spacing:28, top:84, margin:64, ink:'#253345', fallback:true, seed:12345 };
const SLIDERS = [
  ['size','Schriftgröße',12,40,1,'px'], ['width','Schriftbreite',65,140,1,'%'],
  ['wordSpacing','Wortabstand',75,300,5,'%'],
  ['strokeWidth','Strichstärke',0.4,2.2,0.1,'px'],
  ['disorder','Unordnung',0,100,1,'%'], ['spacing','Linienabstand',18,60,1,'px'],
  ['top','Erste Grundlinie',40,180,1,'px'], ['margin','Seitenrand',24,100,1,'px'],
];
const SAMPLE = 'Fotosynthese\n\nPflanzen nutzen Lichtenergie, um aus Wasser und Kohlenstoffdioxid Glucose und Sauerstoff herzustellen. Dieser Vorgang findet in den Chloroplasten statt.\n\nDie Glucose dient als Energiequelle und als Ausgangsstoff für weitere Stoffe.';
let state = {version:1, text:'', boxes:[], glyphs:{}, settings:{...DEFAULTS}, template:null, document:{id:null,name:DOCUMENT_NAME}};
let db = null, selected = 'a', group = 'lower', strokes = [], currentStroke = null;
let drawingPointer = null, pages = [[]], currentPage = 0, templateImage = null;
let savingGlyph = false;
let renderFrame = 0, toastTimer = 0, saveSequence = 0;
const draw = $('#draw-canvas'), dctx = draw.getContext('2d');
const pageCanvas = $('#page-preview');
const measure = document.createElement('canvas').getContext('2d');
const REF_BASE = 240, REF_XHEIGHT = 90;
const glyphBoundsCache = new WeakMap();
const fallbackMetricsCache = new Map();
let alignmentVariant = null;
const previewCache = new WeakMap();

function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'),3500);
}
function openDatabase() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open('feder-local',1);
    req.onupgradeneeded = () => req.result.createObjectStore('workspace');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Datenbank blockiert'));
  });
}
function readDatabase(key='current') {
  return new Promise((resolve,reject) => {
    const req = db.transaction('workspace','readonly').objectStore('workspace').get(key);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function persist() {
  const sequence = ++saveSequence;
  $('#save-status').textContent = 'Speichern …';
  try {
    // The transaction is started immediately: closing the tab does not depend on a debounce.
    await writeWorkspace({current:state});
    if (sequence === saveSequence) $('#save-status').textContent = '✓ Auf diesem Gerät gespeichert';
    return true;
  } catch (error) {
    $('#save-status').textContent = 'Speichern fehlgeschlagen — bitte sichern';
    toast('Lokaler Speicher nicht verfügbar oder voll. Bitte eine Sicherung herunterladen.');
    return false;
  }
}
function normalizedState(data) {
  if (!data || data.version !== 1 || typeof data.text !== 'string' || data.text.length > 60000 || !data.glyphs || typeof data.glyphs !== 'object' || Array.isArray(data.glyphs)) throw new Error('Ungültige Sicherung');
  const glyphs = {};
  const entries = Object.entries(data.glyphs);
  if (entries.length > 300) throw new Error('Zu viele Zeichen');
  for (const [char,variants] of entries) {
    if ([...char].length !== 1 || !Array.isArray(variants) || variants.length > 12) throw new Error('Ungültige Zeichen');
    glyphs[char] = variants.map(v => {
      if (!v || !Array.isArray(v.strokes) || v.strokes.length < 1 || v.strokes.length > 150 || !Number.isFinite(v.pen) || v.pen < 1 || v.pen > 6) throw new Error('Ungültige Striche');
      let count = 0;
      const cleaned = v.strokes.map(stroke => {
        if (!Array.isArray(stroke) || !stroke.length || stroke.length > 15000) throw new Error('Ungültige Punkte');
        count += stroke.length;
        return stroke.map(p => {
          if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite) || p[0]<0 || p[0]>600 || p[1]<0 || p[1]>360 || p[2]<0 || p[2]>1) throw new Error('Ungültige Punkte');
          return [...p];
        });
      });
      if (count > 40000) throw new Error('Zeichen zu groß');
      const result = {strokes:cleaned,pen:v.pen};
      if (Number.isFinite(v.baseline) && v.baseline >= 0 && v.baseline <= 360) result.baseline = v.baseline;
      return result;
    });
  }
  const settings = {...DEFAULTS}, input = data.settings || {};
  for (const [key,,min,max] of SLIDERS) if (Number.isFinite(input[key])) settings[key] = Math.min(max,Math.max(min,input[key]));
  if (['lined','grid','dots','blank'].includes(input.paper)) settings.paper = input.paper;
  if (['a4','a5','letter'].includes(input.format)) settings.format = input.format;
  for (const key of ['ink','paperColor']) if (/^#[0-9a-f]{6}$/i.test(input[key])) settings[key] = input[key];
  if (typeof input.fallback === 'boolean') settings.fallback = input.fallback;
  if (Number.isSafeInteger(input.seed)) settings.seed = input.seed;
  let template = null;
  if (data.template != null) {
    if (typeof data.template !== 'string' || data.template.length > 8000000 || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(data.template)) throw new Error('Ungültige Vorlage');
    template = data.template;
  }
  const boxes=normalizeBoxes(data.boxes);
  if(data.text.length+boxes.filter(b=>b.id!==MAIN_BOX).reduce((n,b)=>n+b.text.length,0)>60000)throw new Error('Zu viel Text');
  return {version:1,text:data.text,boxes,glyphs,settings,template,document:normalizeDocumentMeta(data.document)};
}

function setupSliders() {
  for (const [key,label,min,max,step,unit] of SLIDERS) {
    const field = document.createElement('div'); field.className = 'slider-field';
    field.innerHTML = `<label class="slider-label" for="setting-${key}"><span>${label}</span><output id="value-${key}" for="setting-${key}"></output></label><input id="setting-${key}" type="range" min="${min}" max="${max}" step="${step}">`;
    $('#sliders').append(field);
    $(`#setting-${key}`).addEventListener('input', e => {
      state.settings[key] = Number(e.target.value); updateSlider(key); requestRender(); persist();
    });
  }
}
function updateSlider(key) {
  const spec = SLIDERS.find(s=>s[0]===key), el = $(`#setting-${key}`);
  el.value = state.settings[key]; el.style.setProperty('--progress',`${(el.value-spec[2])/(spec[3]-spec[2])*100}%`);
  $(`#value-${key}`).textContent = `${Number(el.value).toLocaleString('de-DE')} ${spec[5]}`;
}
function syncControls() {
  renderBoxEditor();
  SLIDERS.forEach(([key])=>updateSlider(key));
  $('#format').value = state.settings.format; $('#paper-color').value = state.settings.paperColor;
  $('#fallback').checked = state.settings.fallback;
  $$('.paper-choice').forEach(b=> {b.classList.toggle('active',b.dataset.paper===state.settings.paper && !state.template);b.setAttribute('aria-pressed',b.classList.contains('active'));});
  $$('.swatch').forEach(b=>{b.classList.toggle('active',b.dataset.ink===state.settings.ink);b.setAttribute('aria-pressed',b.classList.contains('active'));});
  $('#custom-template').hidden = !state.template;
}
function setView(view) {
  $$('.view').forEach(v => v.hidden = v.id !== `${view}-view`);
  $$('[data-view]').forEach(b=>{b.classList.toggle('active', b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view);});
  if (view==='alphabet') {renderLetters(); renderDrawing(); renderVariants();}
  if (view==='archive') renderArchive();
}
function neededChars() {return [...new Set([...allText()].filter(c=>!/^\s$/u.test(c)))];}
function renderLetters() {
  const completed = ALL.filter(c=>state.glyphs[c]?.length).length;
  $('#glyph-count').textContent = `${completed} / ${ALL.length}`;
  $('#nav-count').textContent = completed; $('#glyph-progress').style.width = `${completed/ALL.length*100}%`;
  const chars = group==='needed' ? neededChars() : GROUPS[group];
  $('#letter-grid').replaceChildren();
  if (!chars.length) { const p = document.createElement('p'); p.className='small muted';p.textContent='Noch kein Text im Studio.';$('#letter-grid').append(p); }
  for (const c of chars) {
    const b = document.createElement('button'); b.className = 'letter-button'; b.classList.toggle('active',c===selected);
    b.textContent = c; b.setAttribute('aria-label',`${c}: ${state.glyphs[c]?.length || 0} Varianten`);b.setAttribute('aria-pressed',c===selected);
    if (state.glyphs[c]?.length) {const dot = document.createElement('span'); dot.className='glyph-dot'; b.append(dot);}
    b.onclick = () => { if (strokes.length && c !== selected && !confirm('Die aktuelle Zeichnung ist noch nicht gespeichert. Zeichen trotzdem wechseln?')) return; selectCharacter(c); };
    $('#letter-grid').append(b);
  }
}
function selectCharacter(c) {
  selected = c; strokes = []; currentStroke=null; drawingPointer=null;
  $('#selected-char').textContent = c; $('#draw-placeholder').textContent = c;
  draw.setAttribute('aria-label',`Zeichenfläche für ${c}`);renderLetters();renderDrawing();renderVariants();
}
function trace(ctx, lines, pen, color) {
  if(ctx.traceStrokes){ctx.traceStrokes(lines,pen,color);return;}
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=pen;
  for (const points of lines) {
    if (points.length === 1) {ctx.beginPath();ctx.arc(points[0][0],points[0][1],pen/2,0,Math.PI*2);ctx.fill();continue;}
    // One continuous path with a constant ballpoint width, rather than separately
    // stroked segments. Midpoint curves smooth sampling noise without overshooting.
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for (let i=1;i<points.length-1;i++) {
      const p=points[i],next=points[i+1];
      ctx.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);
    }
    const last=points[points.length-1];ctx.lineTo(last[0],last[1]);ctx.stroke();
  }
}
function prepareDrawingCanvas(canvas,logicalWidth=600,logicalHeight=360) {
  const cssWidth=canvas.getBoundingClientRect().width;
  const scale=Math.max(1,cssWidth/logicalWidth*(window.devicePixelRatio || 1));
  const width=Math.round(logicalWidth*scale),height=Math.round(logicalHeight*scale);
  if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');ctx.setTransform(width/logicalWidth,0,0,height/logicalHeight,0,0);
  ctx.clearRect(0,0,logicalWidth,logicalHeight);return ctx;
}
function renderDrawing() {
  prepareDrawingCanvas(draw);
  for (const y of [90,150,240,310]) {dctx.beginPath();dctx.setLineDash(y===240?[]:[5,6]);dctx.strokeStyle=y===240?'#a5bb96':'#dbe3d1';dctx.lineWidth=y===240?1.4:1;dctx.moveTo(0,y);dctx.lineTo(600,y);dctx.stroke();}
  dctx.setLineDash([]);trace(dctx,strokes,Number($('#pen-width').value),'#253345');
  $('#draw-placeholder').hidden = strokes.length>0;
  $('#save-glyph').disabled = !strokes.length || drawingPointer!==null || savingGlyph;
  $('#undo-stroke').disabled = !strokes.length; $('#clear-drawing').disabled = !strokes.length;
}
function bounds(v) {
  if(glyphBoundsCache.has(v))return glyphBoundsCache.get(v);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  const include=p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);};
  for (const stroke of v.strokes) {
    let start=stroke[0];include(start);
    for(let i=1;i<stroke.length-1;i++) {
      const control=stroke[i],next=stroke[i+1],end=[(control[0]+next[0])/2,(control[1]+next[1])/2];
      include(end);
      for(let axis=0;axis<2;axis++) {
        const denominator=start[axis]-2*control[axis]+end[axis];
        if(Math.abs(denominator)<1e-8)continue;
        const t=(start[axis]-control[axis])/denominator;
        if(t>0 && t<1)include([0,1].map(a=>(1-t)**2*start[a]+2*(1-t)*t*control[a]+t*t*end[a]));
      }
      start=end;
    }
    include(stroke[stroke.length-1]);
  }
  const result={minX,maxX,minY,maxY,width:Math.max(5,maxX-minX),height:Math.max(5,maxY-minY)};
  glyphBoundsCache.set(v,result);return result;
}
function glyphBaseline(char,variant) {
  if (Number.isFinite(variant.baseline)) return variant.baseline;
  // Letters without descenders rest on their bottom edge even if the drawing
  // slightly missed the guide. Descenders and punctuation retain the shared guide.
  return /^[\p{L}\p{N}]$/u.test(char) && !/[gjpqy]/u.test(char) ? bounds(variant).maxY : REF_BASE;
}
function renderAlignment() {
  if(!alignmentVariant)return;
  const canvas=$('#alignment-canvas'),ctx=prepareDrawingCanvas(canvas);
  trace(ctx,alignmentVariant.strokes,alignmentVariant.pen,'#253345');
  const y=Number($('#alignment-baseline').value);
  ctx.strokeStyle='#276451';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(600,y);ctx.stroke();ctx.setLineDash([]);
  $('#alignment-value').textContent=`${y} px`;
}
function openAlignment(variant) {
  alignmentVariant=variant;
  $('#alignment-baseline').value=glyphBaseline(selected,variant);
  $('#alignment-dialog').showModal();renderAlignment();
}
function renderVariants() {
  const vs=state.glyphs[selected] || []; $('#variant-count').textContent=vs.length;$('#variants').replaceChildren();
  if (!vs.length) {const p=document.createElement('div');p.className='variants-empty';p.textContent='Für dieses Zeichen ist noch keine Variante gespeichert.';$('#variants').append(p);return;}
  vs.forEach((v,index)=>{
    const card=document.createElement('div');card.className='variant-card';
    const canvas=document.createElement('canvas');canvas.width=200;canvas.height=176;const ctx=canvas.getContext('2d'),b=bounds(v),scale=Math.min(130/b.width,120/b.height,.8);
    ctx.translate(100-b.width*scale/2,88-b.height*scale/2);ctx.scale(scale,scale);ctx.translate(-b.minX,-b.minY);trace(ctx,v.strokes,v.pen,'#253345');
    const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Variante ${index+1} für ${selected} löschen`);
    remove.onclick=()=>{state.glyphs[selected].splice(index,1);if (!state.glyphs[selected].length) delete state.glyphs[selected];persist();renderVariants();renderLetters();requestRender();};
    const align=document.createElement('button');align.className='align-variant';align.textContent='Ausrichten';align.onclick=()=>openAlignment(v);
    card.append(canvas,remove,align);$('#variants').append(card);
  });
}
function point(event) {
  const r=draw.getBoundingClientRect();
  return [Math.max(0,Math.min(600,(event.clientX-r.left)*600/r.width)),Math.max(0,Math.min(360,(event.clientY-r.top)*360/r.height)),event.pointerType==='pen'?Math.max(.1,event.pressure):.5];
}
draw.addEventListener('pointerdown',e=>{
  if (drawingPointer!==null || savingGlyph || e.button>0) return;
  e.preventDefault();drawingPointer=e.pointerId;draw.setPointerCapture(e.pointerId);currentStroke=[point(e)];strokes.push(currentStroke);renderDrawing();
});
draw.addEventListener('pointermove',e=>{
  if (e.pointerId!==drawingPointer) return; e.preventDefault();
  const events=e.getCoalescedEvents?.();
  for (const ev of (events?.length ? events : [e])) {
    const p=point(ev),prev=currentStroke[currentStroke.length-1];
    if (Math.hypot(p[0]-prev[0],p[1]-prev[1])>.6) currentStroke.push(p);
  }
  renderDrawing();
});
function endStroke(e) {if (e.pointerId!==drawingPointer) return;drawingPointer=null;currentStroke=null;renderDrawing();}
draw.addEventListener('pointerup',endStroke);draw.addEventListener('pointercancel',endStroke);draw.addEventListener('lostpointercapture',endStroke);

function randomFactory(seed) {let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let n=Math.imul(t^(t>>>15),t|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};}
function dimensions() {return state.settings.format==='letter'?[816,1056]:state.settings.format==='a5'?[559,794]:[794,1123];}
function glyphFor(char,rng) {
  const s=state.settings,variants=state.glyphs[char],v=variants?.length?variants[Math.floor(rng()*variants.length)]:null;
  const b=v?bounds(v):null;const unit=s.size/REF_XHEIGHT,scaleX=unit*s.width/100;
  let fallbackWidth=0,fontBaseline=0;
  if(!v){
    const font=`${s.size*1.42}px 'Segoe Print','Bradley Hand','Comic Sans MS',cursive`,key=font+'|'+char;
    let metrics=fallbackMetricsCache.get(key);
    if(!metrics){measure.font=font;metrics={width:measure.measureText(char).width,baseline:measure.measureText('x').actualBoundingBoxDescent || 0};fallbackMetricsCache.set(key,metrics);}
    fallbackWidth=metrics.width;fontBaseline=metrics.baseline;
  }
  const width= v ? b.width*scaleX+s.size*.13 : fallbackWidth*s.width/100;
  const chaos=s.disorder/100;
  return {char,v,b,baseline:v?glyphBaseline(char,v):fontBaseline,width:Math.max(2,width),slant:(rng()-.5)*.11*chaos,stretch:1+(rng()-.5)*.07*chaos,gap:s.size*(.055+rng()*.06*chaos)};
}
function layout() {
  return layoutTextBoxes();
}
function drawPaper(ctx,w,h) {
  const s=state.settings;ctx.fillStyle=s.paperColor;ctx.fillRect(0,0,w,h);
  if (templateImage) {ctx.drawImage(templateImage,0,0,w,h);return;}
  ctx.strokeStyle='#cdd9df';ctx.lineWidth=.65;ctx.fillStyle='#b5c5cc';
  if (s.paper==='lined') {
    ctx.beginPath();for(let y=s.top;y<h-24;y+=s.spacing){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
  } else if (s.paper==='grid') {
    const step=s.spacing/2;ctx.beginPath();for(let y=s.top%step;y<h;y+=step){ctx.moveTo(0,y);ctx.lineTo(w,y);}for(let x=0;x<w;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,h);}ctx.stroke();
  } else if (s.paper==='dots') {
    const step=s.spacing/2;for(let y=s.top%step;y<h;y+=step)for(let x=step;x<w;x+=step){ctx.beginPath();ctx.arc(x,y,.85,0,Math.PI*2);ctx.fill();}
  }
}
function paintPage(canvas,index,resolution=1.5,transparent=false) {
  const [w,h]=dimensions();canvas.width=Math.round(w*resolution);canvas.height=Math.round(h*resolution);
  const ctx=canvas.getContext('2d');ctx.scale(resolution,resolution);
  if (!transparent) drawPaper(ctx,w,h);
  drawPageInk(ctx,index);
}
function drawPageInk(ctx,index) {
  const s=state.settings,unit=s.size/REF_XHEIGHT;
  for (const g of (pages[index]||[])) {
    ctx.save();ctx.translate(g.x,g.y);
    // Horizontal shear varies the slant while preserving every point on y=0.
    // Rotation and vertical jitter used to lift the feet away from the paper line.
    ctx.transform(1,0,g.slant,1,0,0);
    if (g.v) {ctx.scale(unit*s.width/100*g.stretch,unit*g.stretch);ctx.translate(-g.b.minX,-g.baseline);trace(ctx,g.v.strokes,g.v.pen/2.5*s.strokeWidth/(unit*g.stretch),s.ink);}
    else if (s.fallback) {ctx.scale(s.width/100*g.stretch,g.stretch);ctx.font=`${s.size*1.42}px 'Segoe Print','Bradley Hand','Comic Sans MS',cursive`;ctx.fillStyle=s.ink;ctx.textBaseline='alphabetic';ctx.fillText(g.char,0,-g.baseline);}
    ctx.restore();
  }
}
function vectorPage(index) {const [w,h]=dimensions(),recording=new VectorPage();drawPaper(recording,w,h);drawPageInk(recording,index);return recording;}
function paintPreviewPage(canvas,index) {
  const [w,h]=dimensions(),s=state.settings,viewBox=`0 0 ${w} ${h}`;
  if(canvas.getAttribute('viewBox')!==viewBox)canvas.setAttribute('viewBox',viewBox);
  let paperLayer=canvas.querySelector('[data-layer="paper"]'),inkLayer=canvas.querySelector('[data-layer="ink"]');
  let cache=previewCache.get(canvas);
  if(!paperLayer || !inkLayer){
    const ns='http://www.w3.org/2000/svg';paperLayer=document.createElementNS(ns,'g');paperLayer.dataset.layer='paper';inkLayer=document.createElementNS(ns,'g');inkLayer.dataset.layer='ink';
    canvas.replaceChildren(paperLayer,inkLayer);cache={paper:[],ink:[]};previewCache.set(canvas,cache);
  }
  const key=[w,h,s.paper,s.paperColor,s.spacing,s.top,state.template];
  if(key.some((value,i)=>value!==cache.paper[i])){
    if(s.paper==='dots' && !templateImage){
      // A single vector tile replaces thousands of individual dot paths. It is
      // independent of text position and stays mounted throughout a drag.
      const step=s.spacing/2,phase=s.top%step,id=`preview-dot-grid-${index}`;
      paperLayer.innerHTML=`<rect width="${w}" height="${h}" fill="${s.paperColor}"/><defs><pattern id="${id}" width="${step}" height="${step}" x="${step/2}" y="${phase-step/2}" patternUnits="userSpaceOnUse"><circle cx="${step/2}" cy="${step/2}" r="0.85" fill="#b5c5cc"/></pattern></defs><rect x="${step/2}" width="${w-step/2}" height="${h}" fill="url(#${id})"/>`;
    }else{
      const paper=new VectorPage();drawPaper(paper,w,h);paperLayer.innerHTML=paper.svg(w,h,`paper-${index}-vp`);
    }
    cache.paper=key;
  }
  // Keep unchanged pages mounted while a field on another page is edited.
  const inkKey=[w,h,s.size,s.width,s.strokeWidth,s.ink,s.fallback];
  for(const g of pages[index])inkKey.push(g.char,g.v,g.b,g.v?.strokes,g.v?.pen,g.baseline,g.x,g.y,g.slant,g.stretch);
  if(inkKey.length!==cache.ink.length || inkKey.some((value,i)=>value!==cache.ink[i])){
    const ink=new VectorPage();drawPageInk(ink,index);inkLayer.innerHTML=ink.svg(w,h,`ink-${index}-vp`);cache.ink=inkKey;
  }
}
function paintPreview() {
  const stack=$('#page-stack');
  while(stack.children.length>pages.length)stack.lastElementChild.remove();
  for(let index=0;index<pages.length;index++){
    let page=stack.children[index];
    if(!page){
      page=document.createElement('div');page.className='preview-page';page.dataset.pageIndex=index;
      page.innerHTML=`<div class="page-caption">Seite ${index+1}</div><div class="paper-stage" data-page-index="${index}"><svg class="page-preview" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Seite ${index+1}, Vorschau des handgeschriebenen Textes"></svg><div class="box-overlay"></div></div>`;
      stack.append(page);
    }
    paintPreviewPage(page.querySelector('.page-preview'),index);
  }
  renderBoxOverlays();updatePageNav();
}
function scrollToPreviewPage(index=currentPage) {
  currentPage=Math.max(0,Math.min(pages.length-1,index));updatePageNav();
  $('#page-stack').children[currentPage]?.scrollIntoView({block:'start'});
}
function requestPageJump() {requestRender();requestAnimationFrame(()=>scrollToPreviewPage());}
function bindPageStack() {
  const stack=$('#page-stack');
  const activate=e=>{const page=e.target.closest('.preview-page');if(page){currentPage=Number(page.dataset.pageIndex);updatePageNav();}};
  stack.addEventListener('pointerdown',activate);stack.addEventListener('focusin',activate);
  let scrollFrame=0;
  window.addEventListener('scroll',()=>{
    if(scrollFrame)return;
    scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=0;const target=innerHeight*.4;
      for(const page of stack.children){const r=page.getBoundingClientRect();if(r.top<=target && r.bottom>target){currentPage=Number(page.dataset.pageIndex);updatePageNav();break;}}
    });
  },{passive:true});
}
function requestRender() {cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(renderPreview);}
function renderPreview() {
  pages=layout();currentPage=Math.min(currentPage,pages.length-1);paintPreview();
  $('#text-count').textContent=`${[...boxText(selectedBox())].length.toLocaleString('de-DE')} Zeichen`;
  $('#page-count').textContent=`Seite ${currentPage+1} von ${pages.length}`;
  $('#prev-page').disabled=currentPage===0;$('#next-page').disabled=currentPage===pages.length-1;
  $('#empty-page').hidden=!!allText().trim();
  $('#preview-format').textContent=$('#format').selectedOptions[0].textContent;
  const missing=neededChars().filter(c=>!state.glyphs[c]?.length);
  const note=$('#missing-note');note.replaceChildren();
  if (missing.length) {
    const text=document.createElement('span');text.textContent=`${missing.length} Zeichen fehlen: ${missing.slice(0,12).join(' ')}${missing.length>12?' …':''} ${state.settings.fallback?'(Beispielschrift)':'(bleiben leer)'} `;
    const button=document.createElement('button');button.className='text-button';button.textContent='Zeichnen →';button.onclick=()=>{group='needed';updateGroups();selectCharacter(missing[0]);setView('alphabet');};note.append(text,button);
  }
  $('#export-info').textContent=`${pages.length} ${pages.length===1?'Seite':'Seiten'}${missing.length?` · ${missing.length} Zeichen ${state.settings.fallback?'in Beispielschrift':'fehlen'}`:''}`;
}
function updateGroups() {$$('[data-group]').forEach(b=>{b.classList.toggle('active',b.dataset.group===group);b.setAttribute('aria-pressed',b.dataset.group===group);});}
async function loadImage(source) {
  const image=new Image();image.src=source;await image.decode();return image;
}
async function importTemplate(file) {
  if (!file) return;
  if (!['image/png','image/jpeg'].includes(file.type) || file.size>20000000) {toast('Bitte eine PNG-/JPG-Datei bis 20 MB wählen.');return;}
  const url=URL.createObjectURL(file);
  try {
    const image=await loadImage(url),scale=Math.min(1,1800/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.92);templateImage=await loadImage(data);state.template=data;
    syncControls();requestRender();await persist();toast('Vorlage importiert. Grundlinie und Linienabstand bei Bedarf anpassen.');
  } catch(error) {toast('Diese Bilddatei konnte nicht gelesen werden.');}
  finally {URL.revokeObjectURL(url);$('#template-file').value='';}
}
function download(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function filename(extension) {return ($('#export-name').value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_') || 'Meine Notizen')+extension;}
let exportBusy=false;
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Bildexport fehlgeschlagen')),type,quality));}
async function makePDF() {
  renderPreview();const [w,h]=dimensions(),document=await PDFLib.PDFDocument.create(),cache=new Map();
  document.setCreator('Feder');
  for(let i=0;i<pages.length;i++) {
    $('#export-info').textContent=`PDF wird erstellt … Seite ${i+1} von ${pages.length}`;
    const page=document.addPage([w*.75,h*.75]);
    page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.concatTransformationMatrix(.75,0,0,-.75,0,h*.75));
    await vectorPage(i).toPDF(document,page,cache);page.pushOperators(PDFLib.popGraphicsState());
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return new Blob([await document.save()],{type:'application/pdf'});
}
// .goodnotes-Export: Jeder Strich wird echte GoodNotes-Tinte (radierbar), das Papier
// ist der Hintergrund. Die Striche entsprechen der Zeichnung in drawPageInk().
async function goodNotesFile() {
  renderPreview();
  const [w,h]=dimensions(),PT=.75,s=state.settings,unit=s.size/REF_XHEIGHT;
  const rgb=[1,3,5].map(i=>parseInt(s.ink.slice(i,i+2),16)/255);
  let skipped=0;
  const strokes=pages.map(glyphs=>{
    const out=[];
    for(const g of glyphs){
      if(!g.v){if(s.fallback && !/^\s$/u.test(g.char))skipped++;continue;}
      const sx=unit*s.width/100*g.stretch,sy=unit*g.stretch,width=g.v.pen/2.5*s.strokeWidth*PT;
      for(const stroke of g.v.strokes){
        out.push({width,color:rgb,points:stroke.map(([x,y])=>{const X=(x-g.b.minX)*sx,Y=(y-g.baseline)*sy;return [(X+g.slant*Y+g.x)*PT,(Y+g.y)*PT];})});
      }
    }
    return out;
  });
  const paperDoc=await PDFLib.PDFDocument.create();
  paperDoc.setCreator('Feder');
  const page=paperDoc.addPage([w*PT,h*PT]);
  page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.concatTransformationMatrix(PT,0,0,-PT,0,h*PT));
  const paper=new VectorPage();drawPaper(paper,w,h);await paper.toPDF(paperDoc,page,new Map());page.pushOperators(PDFLib.popGraphicsState());
  const paperPdf=new Uint8Array(await paperDoc.save());
  const blob=await GoodNotesExport.build({title:$('#export-name').value.trim()||'Meine Notizen',widthPt:w*PT,heightPt:h*PT,pages:strokes,paperPdf});
  return {blob,skipped};
}
async function exportGoodNotes() {
  if(exportBusy)return;
  if(!allText().trim()){toast('Füge zuerst einen Text ein.');return;}
  exportBusy=true;$$('.export-actions button').forEach(b=>b.disabled=true);
  try{
    const {blob,skipped}=await goodNotesFile();
    download(blob,filename('.goodnotes'));
    toast(skipped?`.goodnotes ist bereit. ${skipped} Zeichen aus der Beispielschrift sind nicht enthalten.`:'.goodnotes ist bereit.');
  }catch(error){toast('GoodNotes-Export fehlgeschlagen. Bitte mit einem kürzeren Text erneut versuchen.');}
  finally{exportBusy=false;$$('.export-actions button').forEach(b=>b.disabled=false);renderPreview();}
}
async function exportDocument(type,share=false) {
  if(exportBusy)return;
  if(!allText().trim()){toast('Füge zuerst einen Text ein.');return;}
  exportBusy=true;$$('.export-actions button').forEach(b=>b.disabled=true);
  try {
    let blob,name;
    if(type==='pdf'){blob=await makePDF();name=filename('.pdf');}
    else {renderPreview();const canvas=document.createElement('canvas');paintPage(canvas,currentPage,4,$('#transparent').checked);blob=await canvasBlob(canvas,'image/png');name=filename(`-Seite-${currentPage+1}.png`);}
    if(share){
      const file=new File([blob],name,{type:blob.type});
      if(navigator.canShare?.({files:[file]})) {try {await navigator.share({files:[file],title:'Meine Notizen'});}catch(error){if(error.name==='AbortError')return;download(blob,name);toast('Teilen nicht verfügbar. Die PDF wurde heruntergeladen.');}}
      else {download(blob,name);toast('Die PDF wurde heruntergeladen. Öffne sie über das Teilen-Menü.');}
    } else {download(blob,name);toast(`${type.toUpperCase()} ist bereit.`);}
  } catch(error){toast('Export fehlgeschlagen. Bitte mit einem kürzeren Text erneut versuchen.');}
  finally {exportBusy=false;$$('.export-actions button').forEach(b=>b.disabled=false);renderPreview();}
}
async function saveGlyph() {
  if (!strokes.length || drawingPointer!==null || savingGlyph) return;
  const variants=state.glyphs[selected]||[];
  if(variants.length>=12){toast('Bis zu 12 Varianten pro Zeichen. Lösche zuerst eine Variante.');return;}
  if (strokes.length>150 || strokes.some(s=>s.length>15000) || strokes.reduce((n,s)=>n+s.length,0)>40000) {toast('Die Zeichnung ist zu groß. Bitte vereinfache sie etwas.');return;}
  savingGlyph=true;renderDrawing();
  state.glyphs[selected]=[...variants,{strokes:structuredClone(strokes),pen:Number($('#pen-width').value)}];
  const success=await persist();
  savingGlyph=false;
  if(success && navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
  strokes=[];renderDrawing();renderVariants();renderLetters();requestRender();
  if(success)toast(`„${selected}“ gespeichert · ${variants.length+1} ${variants.length?'Varianten':'Variante'}`);
  if($('#auto-next').checked){const chars=group==='needed'?neededChars():GROUPS[group];selectCharacter(chars[(Math.max(0,chars.indexOf(selected))+1)%chars.length]||selected);}
}
function bindEvents() {
  $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('.brand').onclick=e=>{e.preventDefault();setView('studio');};
  bindTextBoxes();
  bindArchive();
  $('#text').addEventListener('input',e=>{setBoxText(e.target.value);requestRender();persist();});
  $('#sample-text').onclick=()=>{if(boxText(selectedBox()).trim() && !confirm('Den vorhandenen Text durch den Beispieltext ersetzen?'))return;setBoxText(SAMPLE);$('#text').value=SAMPLE;currentPage=selectedBox().page;requestRender();persist();};
  $$('.paper-choice').forEach(b=>b.onclick=()=>{state.settings.paper=b.dataset.paper;state.template=null;templateImage=null;syncControls();requestRender();persist();});
  $('#format').onchange=e=>{state.settings.format=e.target.value;currentPage=0;requestRender();persist();};
  $('#paper-color').onchange=e=>{state.settings.paperColor=e.target.value;requestRender();persist();};
  $('#fallback').onchange=e=>{state.settings.fallback=e.target.checked;requestRender();persist();};
  $$('.swatch').forEach(b=>b.onclick=()=>{state.settings.ink=b.dataset.ink;syncControls();requestRender();persist();});
  $('#shuffle').onclick=()=>{state.settings.seed=Math.floor(Math.random()*2147483647);requestRender();persist();toast('Varianten neu gemischt.');};
  $('#reset-settings').onclick=()=>{state.settings={...DEFAULTS};syncControls();requestRender();persist();toast('Gestaltung zurückgesetzt. Dein Alphabet bleibt gespeichert.');};
  bindPageStack();
  $('#prev-page').onclick=()=>scrollToPreviewPage(currentPage-1);
  $('#next-page').onclick=()=>scrollToPreviewPage(currentPage+1);
  $('#template-file').onchange=e=>importTemplate(e.target.files[0]);
  $('#remove-template').onclick=()=>{state.template=null;templateImage=null;syncControls();requestRender();persist();};
  $$('[data-group]').forEach(b=>b.onclick=()=>{group=b.dataset.group;updateGroups();renderLetters();});
  $('#undo-stroke').onclick=()=>{if(drawingPointer!==null)return;strokes.pop();renderDrawing();};
  $('#clear-drawing').onclick=()=>{if(drawingPointer!==null)return;strokes=[];renderDrawing();};
  $('#pen-width').oninput=e=>{$('#pen-width-value').textContent=e.target.value.replace('.',',');renderDrawing();};
  $('#save-glyph').onclick=saveGlyph;
  $('#alignment-baseline').oninput=renderAlignment;
  $('#alignment-save').onclick=async()=>{
    if(!alignmentVariant)return;
    alignmentVariant.baseline=Number($('#alignment-baseline').value);
    await persist();requestRender();$('#alignment-dialog').close();alignmentVariant=null;
  };
  $('#backup-export').onclick=downloadWorkspaceBackup;
  $('#backup-file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      if(file.size>150000000)throw new Error('Datei zu groß');
      const data=JSON.parse(await file.text()),incoming=normalizedState(data);
      const incomingArchive=data.archive===undefined?archive:normalizedArchive(data.archive);
      const incomingImage=incoming.template?await loadImage(incoming.template):null;
      if(!confirm(`Diese Sicherung ersetzt dein aktuelles Alphabet, deinen Text und deine Einstellungen${data.archive===undefined?'':' sowie dein Archiv'}. Vorher bei Bedarf eine Sicherung speichern. Fortfahren?`))return;
      await writeWorkspace({current:incoming,archive:incomingArchive});
      state=incoming;archive=incomingArchive;archiveAvailable=true;deletedDocument=null;templateImage=incomingImage;strokes=[];selectedBoxId=MAIN_BOX;selectedBoxPage=null;deletedBoxes=null;currentPage=0;syncControls();renderLetters();renderVariants();renderDrawing();renderArchive();requestRender();
      $('#save-status').textContent='✓ Auf diesem Gerät gespeichert';toast('Deine Sicherung wurde wiederhergestellt.');
    }catch(error){toast('Diese Datei ist keine gültige Feder-Sicherung.');}finally{e.target.value='';}
  };
  $('#export-open').onclick=()=>{renderPreview();$('#export-name').value=currentDocumentName();$('#export-dialog').showModal();};
  $('#help-button').onclick=()=>$('#help-dialog').showModal();
  $('#download-pdf').onclick=()=>exportDocument('pdf');$('#download-goodnotes').onclick=()=>exportGoodNotes();$('#download-png').onclick=()=>exportDocument('png');$('#share-pdf').onclick=()=>exportDocument('pdf',true);
  $('#share-pdf').hidden=!navigator.share;
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog && !exportBusy){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
  $('#export-dialog').addEventListener('cancel',e=>{if(exportBusy)e.preventDefault();});
  $('#export-dialog form').addEventListener('submit',e=>{if(exportBusy)e.preventDefault();});
}
function updatePageNav() {$('#page-count').textContent=`Seite ${currentPage+1} von ${pages.length}`;$('#prev-page').disabled=currentPage===0;$('#next-page').disabled=currentPage===pages.length-1;for(const page of $('#page-stack').children)page.classList.toggle('active-page',Number(page.dataset.pageIndex)===currentPage);}
async function init() {
  setupSliders();
  let initialStorageStatus='Nur auf deinem Gerät';
  try {
    db=await openDatabase();const saved=await readDatabase();
    if(saved)state=normalizedState(saved);
    initialStorageStatus=saved?'✓ Gespeicherte Handschrift geladen':'Lokale Speicherung bereit';
  }catch(error){
    try {const saved=localStorage.getItem('feder-backup');if(saved)state=normalizedState(JSON.parse(saved));localStorage.setItem('feder-storage-check','1');localStorage.removeItem('feder-storage-check');initialStorageStatus='Lokale Browserspeicherung bereit';}
    catch(storageError){initialStorageStatus='Speicher nicht verfügbar — Sicherung nutzen';toast('Lokale Speicherung ist hier nicht verfügbar. Nutze die Sicherungsdatei.');}
    db=null;
  }
  if(state.template){try{templateImage=await loadImage(state.template);}catch(error){state.template=null;toast('Die gespeicherte Vorlage konnte nicht geladen werden.');}}
  await loadArchive();
  syncControls();bindEvents();renderLetters();renderDrawing();renderVariants();renderPreview();
  $('#save-status').textContent=initialStorageStatus;
  ['.guide-top','.guide-mid','.guide-base','.guide-bottom'].forEach((selector,i)=>$(selector).style.top=`${[90,REF_BASE-REF_XHEIGHT,REF_BASE,310][i]/360*100}%`);
  new ResizeObserver(()=>{if(!$('#alphabet-view').hidden)renderDrawing();}).observe(draw);
  window.addEventListener('resize',()=>{requestRender();if(!$('#alignment-dialog').hidden && alignmentVariant)renderAlignment();});
}
init();
