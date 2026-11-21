'use strict';

const MAIN_BOX='box-main';
let selectedBoxId=MAIN_BOX,selectedBoxPage=null,boxLocations=new Map(),boxDrag=null,deletedBoxes=null;
function normalizeBoxes(input){
  if(input===undefined)return [];
  if(!Array.isArray(input)||input.length>50)throw new Error('Ungültige Textfelder');
  const ids=new Set();
  return input.map(box=>{
    if(!box || typeof box.id!=='string' || !/^[a-zA-Z0-9-]{1,60}$/.test(box.id) || ids.has(box.id) || typeof box.text!=='string' || box.text.length>60000 || typeof box.name!=='string' || box.name.length>80 || !Number.isInteger(box.page) || box.page<0 || box.page>49 || !['x','y','width','height'].every(k=>Number.isFinite(box[k]) && Math.abs(box[k])<=3000))throw new Error('Ungültiges Textfeld');
    const normalized={id:box.id,name:box.name,text:box.id===MAIN_BOX?'':box.text,page:box.page,x:box.x,y:box.y,width:Math.max(80,box.width),height:Math.max(60,box.height),auto:box.auto===true};
    if(box.continuations!==undefined){
      if(!box.continuations || typeof box.continuations!=='object' || Array.isArray(box.continuations))throw new Error('Ungültige Fortsetzungen');
      normalized.continuations={};
      for(const [offset,rect] of Object.entries(box.continuations)){
        if(!/^[1-9]\d{0,4}$/.test(offset) || Number(offset)>60000 || !rect || !['x','y','width','height'].every(k=>Number.isFinite(rect[k]) && Math.abs(rect[k])<=3000))throw new Error('Ungültige Fortsetzung');
        normalized.continuations[offset]={x:rect.x,y:rect.y,width:Math.max(80,rect.width),height:Math.max(1,rect.height)};
      }
    }
    ids.add(box.id);return normalized;
  });
}
function ensureBoxes(){
  if(!Array.isArray(state.boxes)||!state.boxes.length)state.boxes=[{id:MAIN_BOX,name:'Textfeld 1',text:'',page:0,x:0,y:0,width:600,height:900,auto:true}];
  if(!state.boxes.some(b=>b.id===selectedBoxId)){selectedBoxId=state.boxes[0].id;selectedBoxPage=null;}
}
function selectedBox(){ensureBoxes();return state.boxes.find(b=>b.id===selectedBoxId);}
function boxText(box){return box.id===MAIN_BOX?state.text:box.text;}
function allText(){ensureBoxes();return state.boxes.map(boxText).join('\n');}
function setBoxText(text){const box=selectedBox();if(box.id===MAIN_BOX)state.text=text;else box.text=text;}
function boxesSnapToLines(){return state.settings.paper==='lined';}
function boxMetrics(box){
  const [w,h]=dimensions(),s=state.settings,asc=Math.min(s.top,s.size*1.6),anchor=s.top-asc;
  let width=box.auto?w-2*s.margin:box.width;
  width=Math.min(w-16,Math.max(80,width));
  const minHeight=asc+s.size*.78+4;
  const rawY=box.auto?anchor:box.y;
  const minStep=0,maxStep=Math.max(0,Math.floor((Math.min(h-25,h-minHeight+asc)-s.top)/s.spacing));
  const step=Math.max(minStep,Math.min(maxStep,Math.round((rawY-anchor)/s.spacing)));
  const y=boxesSnapToLines()?anchor+step*s.spacing:Math.max(0,Math.min(h-minHeight,rawY));
  const height=Math.max(minHeight,Math.min(h-y,box.auto?h-s.margin-y:box.height));
  const x=Math.max(0,Math.min(w-width,box.auto?s.margin:box.x));
  return {x,y,width,height,baseline:y+asc,asc};
}
function assignBoxRect(box,rect){for(const key of ['x','y','width','height'])box[key]=rect[key];box.auto=false;const clean=boxMetrics(box);for(const key of ['x','y','width','height'])box[key]=clean[key];}
function boxPageMetrics(box,page=box.page){
  if(page<=box.page)return boxMetrics(box);
  const first=boxMetrics(box),s=state.settings,[,h]=dimensions(),y=s.top-first.asc;
  // Overflow starts at the first writing line and uses the rest of the sheet.
  // Explicit geometry belongs to this continuation, never to its source box.
  return boxMetrics({...box,auto:false,x:first.x,y,width:first.width,height:h-s.margin-y,...box.continuations?.[page-box.page]});
}
function selectedPartPage(box=selectedBox()){return Math.max(box.page,selectedBoxPage??box.page);}
function assignPageBoxRect(box,rect,page=box.page){
  if(page<=box.page){assignBoxRect(box,rect);return;}
  const clean=boxMetrics({...box,...rect,auto:false});
  box.continuations??={};box.continuations[page-box.page]={x:clean.x,y:clean.y,width:clean.width,height:clean.height};
}
function updateBoxGeometryControls(){
  const box=selectedBox(),page=selectedPartPage(box),rect=boxPageMetrics(box,page);
  for(const key of ['width','height','page']){const input=$(`#box-${key}`);if(document.activeElement!==input)input.value=key==='page'?box.page+1:Math.round(rect[key]);}
  $('#box-part').hidden=page===box.page;
  $('#box-part').textContent=`Fortsetzung · Seite ${page+1}. Breite und Höhe gelten für dieses Feld.`;
}
function renderBoxEditor(){
  const box=selectedBox(),rect=boxPageMetrics(box,selectedPartPage(box)),select=$('#box-select');select.replaceChildren();
  state.boxes.forEach(b=>{const option=document.createElement('option');option.value=b.id;option.textContent=b.name;select.append(option);});select.value=box.id;
  $('#text').value=boxText(box);$('#text').maxLength=Math.max(0,60000-state.boxes.filter(b=>b.id!==box.id).reduce((n,b)=>n+boxText(b).length,0));
  $('#box-name').value=box.name;
  for(const key of ['width','height'])$(`#box-${key}`).value=Math.round(rect[key]);
  $('#box-page').value=box.page+1;
  $('#box-add').disabled=state.boxes.length>=50;$('#box-duplicate').disabled=state.boxes.length>=50;
  $('#box-undo-delete').hidden=!deletedBoxes;
  updateBoxGeometryControls();
}
function selectBox(id,jump=true,page=null){selectedBoxId=id;const box=selectedBox();selectedBoxPage=page??box.page;currentPage=selectedPartPage(box);renderBoxEditor();if(jump)requestPageJump();else requestRender();}
function addBox(copy=false){
  if(state.boxes.length>=50)return;
  const [w,h]=dimensions(),source=selectedBox(),r=boxPageMetrics(source,selectedPartPage(source)),s=state.settings;
  if(copy && allText().length+boxText(source).length>60000){toast('Insgesamt sind bis zu 60.000 Zeichen möglich.');return;}
  const box={id:`box-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,name:`Textfeld ${state.boxes.length+1}`,text:copy?boxText(source):'',page:currentPage,x:copy?r.x+20:w*.5,y:copy?r.y+s.spacing:s.top+2*s.spacing,width:copy?r.width:Math.min(280,w*.4),height:copy?r.height:Math.min(260,h*.35),auto:false};
  assignBoxRect(box,box);state.boxes.push(box);selectBox(box.id);persist();$('#text').focus();
}
function deleteBox(){
  deletedBoxes={box:structuredClone(selectedBox()),text:boxText(selectedBox()),index:state.boxes.findIndex(b=>b.id===selectedBoxId)};
  state.boxes=state.boxes.filter(b=>b.id!==selectedBoxId);if(selectedBoxId===MAIN_BOX)state.text='';
  ensureBoxes();renderBoxEditor();requestRender();persist();toast('Textfeld entfernt. Über „Rückgängig“ wiederherstellbar.');
}
function seedForBox(box){if(box.id===MAIN_BOX)return state.settings.seed;let hash=0;for(const char of box.id)hash=Math.imul(hash,31)+char.charCodeAt(0)|0;return state.settings.seed^hash;}
function layoutTextBoxes(){
  ensureBoxes();boxLocations=new Map();const result=[[]],s=state.settings;
  for(const box of state.boxes){
    const rng=randomFactory(seedForBox(box));let page=box.page,rect=boxPageMetrics(box,page),x=rect.x,baseline=rect.baseline;
    const right=()=>rect.x+rect.width;
    const bottom=()=>{const boxBottom=rect.y+rect.height-s.size*.78;return boxesSnapToLines()?Math.min(boxBottom,dimensions()[1]-25):boxBottom;};
    const markPage=()=>{while(result.length<=page)result.push([]);if(!boxLocations.has(page))boxLocations.set(page,[]);if(!boxLocations.get(page).some(v=>v.box.id===box.id))boxLocations.get(page).push({box,rect,continued:page>box.page});};
    markPage();
    const newLine=()=>{baseline+=s.spacing;if(baseline>bottom()){page++;rect=boxPageMetrics(box,page);baseline=rect.baseline;markPage();}x=rect.x;};
    const add=g=>{result[page].push({...g,x,y:baseline,boxId:box.id});x+=g.width+g.gap;};
    const tokens=boxText(box).replace(/\r\n?/g,'\n').split(/(\n|[^\S\n]+)/u);
    for(const token of tokens){
      if(token==='\n'){newLine();continue;}if(!token)continue;
      if(/^\s+$/u.test(token)){if(x>rect.x){x+=s.size*.4*(s.wordSpacing??DEFAULTS.wordSpacing)/100*s.width/100*token.replace(/\t/g,'    ').length;if(x>right())newLine();}continue;}
      const letters=[...token].map(c=>glyphFor(c,rng)),total=letters.reduce((n,g)=>n+g.width+g.gap,0);
      if(x>rect.x && x+total>right())newLine();
      for(const glyph of letters){if(x>rect.x && x+glyph.width+glyph.gap>right())newLine();add(glyph);}
    }
  }
  return result;
}
function renderBoxOverlays(){
  const box=selectedBox();
  if(!boxLocations.get(selectedPartPage(box))?.some(loc=>loc.box.id===box.id))selectedBoxPage=box.page;
  for(const page of $('#page-stack').children)renderPageBoxOverlays(page.querySelector('.box-overlay'),Number(page.dataset.pageIndex));
  if(!boxDrag)updateBoxGeometryControls();
}
function renderPageBoxOverlays(overlay,pageIndex){
  const [w,h]=dimensions(),locations=boxLocations.get(pageIndex)||[];
  const visible=new Set(locations.map(l=>l.box.id));
  for(const element of [...overlay.children])if(!visible.has(element.dataset.boxId))element.remove();
  for(const {box,rect,continued} of locations){
    let element=[...overlay.children].find(e=>e.dataset.boxId===box.id);
    if(!element){element=document.createElement('div');element.className='text-box-frame';element.dataset.boxId=box.id;element.tabIndex=0;element.setAttribute('role','group');
      const title=document.createElement('span');title.className='text-box-title';element.append(title);
      for(const direction of ['n','ne','e','se','s','sw','w','nw']){const handle=document.createElement('span');handle.className=`box-handle handle-${direction}`;handle.dataset.resize=direction;element.append(handle);}
      overlay.append(element);
    }
    element.classList.toggle('selected',box.id===selectedBoxId && pageIndex===selectedPartPage(box));element.setAttribute('aria-label',`${box.name}${continued?', Fortsetzung':''}, verschiebbares Textfeld. Pfeiltasten bewegen, Umschalt und Pfeiltasten ändern die Größe.`);
    element.querySelector('.text-box-title').textContent=box.name+(continued?' · Fortsetzung':'');
    element.style.left=`${rect.x/w*100}%`;element.style.top=`${rect.y/h*100}%`;element.style.width=`${rect.width/w*100}%`;element.style.height=`${rect.height/h*100}%`;
  }
}
function paperPoint(event,canvas=boxDrag?.canvas||pageCanvas){const r=canvas.getBoundingClientRect(),[w,h]=dimensions();return [(event.clientX-r.left)*w/r.width,(event.clientY-r.top)*h/r.height];}
function bindTextBoxes(){
  $('#box-select').onchange=e=>selectBox(e.target.value);
  $('#box-add').onclick=()=>addBox();$('#box-duplicate').onclick=()=>addBox(true);$('#box-delete').onclick=deleteBox;
  $('#box-undo-delete').onclick=()=>{
    if(!deletedBoxes)return;
    const restored={...deletedBoxes.box},existing=state.boxes.find(b=>b.id===restored.id);
    const replacementEmpty=existing && !boxText(existing).length;
    const total=state.boxes.reduce((n,b)=>n+boxText(b).length,0)+deletedBoxes.text.length;
    if(total>60000){toast('Zum Wiederherstellen muss die Gesamtmenge unter 60.000 Zeichen bleiben.');return;}
    if(replacementEmpty)state.boxes=state.boxes.filter(b=>b.id!==existing.id);
    else if(existing)restored.id=`box-restored-${Date.now().toString(36)}`;
    if(restored.id===MAIN_BOX)state.text=deletedBoxes.text;else restored.text=deletedBoxes.text;
    state.boxes.splice(Math.min(deletedBoxes.index,state.boxes.length),0,restored);selectedBoxId=restored.id;currentPage=restored.page;selectedBoxPage=null;deletedBoxes=null;
    renderBoxEditor();requestRender();persist();
  };
  $('#box-name').oninput=e=>{selectedBox().name=e.target.value;renderBoxOverlays();const option=$('#box-select').selectedOptions[0];if(option)option.textContent=e.target.value;persist();};
  for(const key of ['width','height'])$(`#box-${key}`).onchange=e=>{const value=Number(e.target.value);if(!Number.isFinite(value))return;const box=selectedBox(),page=selectedPartPage(box);assignPageBoxRect(box,{...boxPageMetrics(box,page),[key]:value},page);renderBoxEditor();requestRender();persist();};
  $('#box-page').onchange=e=>{selectedBox().page=Math.max(0,Math.min(49,Math.round(Number(e.target.value)||1)-1));currentPage=selectedBox().page;selectedBoxPage=null;renderBoxEditor();requestPageJump();persist();};
  const overlay=$('#page-stack');
  overlay.addEventListener('pointerdown',e=>{
    const frame=e.target.closest('.text-box-frame');if(!frame||e.button>0||boxDrag)return;
    const page=Number(frame.closest('.paper-stage').dataset.pageIndex);
    e.preventDefault();selectBox(frame.dataset.boxId,false,page);const box=selectedBox(),rect=boxPageMetrics(box,page);
    const canvas=frame.closest('.paper-stage').querySelector('.page-preview');
    boxDrag={pointer:e.pointerId,id:box.id,page,canvas,start:paperPoint(e,canvas),rect,handle:e.target.dataset.resize||''};overlay.setPointerCapture(e.pointerId);frame.focus({preventScroll:true});
  });
  overlay.addEventListener('pointermove',e=>{
    if(!boxDrag||e.pointerId!==boxDrag.pointer)return;e.preventDefault();
    const [px,py]=paperPoint(e),dx=px-boxDrag.start[0],dy=py-boxDrag.start[1],r=boxDrag.rect,handle=boxDrag.handle;
    const rect={...r},[w,h]=dimensions(),minWidth=80,minHeight=r.asc+state.settings.size*.78+4;
    if(!handle){rect.x=r.x+dx;rect.y=r.y+dy;}
    else{
      if(handle.includes('e'))rect.width=Math.max(minWidth,Math.min(w-r.x,r.width+dx));
      if(handle.includes('s'))rect.height=Math.max(minHeight,Math.min(h-r.y,r.height+dy));
      if(handle.includes('w')){rect.x=Math.max(0,Math.min(r.x+r.width-minWidth,r.x+dx));rect.width=r.x+r.width-rect.x;}
      if(handle.includes('n')){rect.y=Math.max(0,Math.min(r.y+r.height-minHeight,r.y+dy));rect.height=r.y+r.height-rect.y;}
    }
    const box=state.boxes.find(b=>b.id===boxDrag.id);assignPageBoxRect(box,rect,boxDrag.page);
    if(handle.includes('n')){const clean=boxPageMetrics(box,boxDrag.page);clean.height=Math.max(minHeight,r.y+r.height-clean.y);assignPageBoxRect(box,clean,boxDrag.page);}
    requestRender();
  });
  const finish=e=>{if(!boxDrag||e.pointerId!==boxDrag.pointer)return;cancelAnimationFrame(renderFrame);boxDrag=null;renderPreview();renderBoxEditor();persist();};
  overlay.addEventListener('pointerup',finish);overlay.addEventListener('pointercancel',finish);overlay.addEventListener('lostpointercapture',finish);
  overlay.addEventListener('dblclick',e=>{if(e.target.closest('.text-box-frame'))$('#text').focus();});
  overlay.addEventListener('focusin',e=>{const frame=e.target.closest('.text-box-frame');if(!frame)return;const page=Number(frame.closest('.paper-stage').dataset.pageIndex);if(frame.dataset.boxId!==selectedBoxId || page!==selectedPartPage())selectBox(frame.dataset.boxId,false,page);});
  overlay.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
    const box=selectedBox(),page=selectedPartPage(box),r=boxPageMetrics(box,page),delta=e.altKey?1:10,verticalStep=boxesSnapToLines()?state.settings.spacing:delta;
    if(e.shiftKey){if(e.key==='ArrowLeft')r.width-=delta;if(e.key==='ArrowRight')r.width+=delta;if(e.key==='ArrowUp')r.height-=verticalStep;if(e.key==='ArrowDown')r.height+=verticalStep;}
    else{if(e.key==='ArrowLeft')r.x-=delta;if(e.key==='ArrowRight')r.x+=delta;if(e.key==='ArrowUp')r.y-=verticalStep;if(e.key==='ArrowDown')r.y+=verticalStep;}
    assignPageBoxRect(box,r,page);renderPreview();renderBoxEditor();persist();
  });
}
