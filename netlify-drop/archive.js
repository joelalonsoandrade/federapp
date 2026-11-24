'use strict';

let archive={version:1,documents:[]},archiveBusy=false,archiveAvailable=true,deletedDocument=null,renameDocumentId=null;
const DOCUMENT_NAME='Unbenanntes Dokument';
function normalizeDocumentMeta(value){
  if(value===undefined)return {id:null,name:DOCUMENT_NAME};
  if(!value || typeof value.name!=='string' || value.name.length>80 || (value.id!==null && (typeof value.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.id))))throw new Error('Ungültiges Dokument');
  return {id:value.id,name:value.name};
}
function documentContent(source=state){return {text:source.text,boxes:structuredClone(source.boxes),settings:{...source.settings},template:source.template};}
function normalizedArchive(value){
  if(!value || value.version!==1 || !Array.isArray(value.documents) || value.documents.length>1000)throw new Error('Ungültiges Archiv');
  const ids=new Set();
  return {version:1,documents:value.documents.map(doc=>{
    if(!doc || typeof doc.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(doc.id) || ids.has(doc.id) || typeof doc.name!=='string' || !doc.name.trim() || doc.name.length>80 || !Number.isSafeInteger(doc.createdAt) || doc.createdAt<0 || !Number.isSafeInteger(doc.updatedAt) || doc.updatedAt<0 || !Number.isInteger(doc.pageCount) || doc.pageCount<1 || doc.pageCount>60050 || !doc.content)throw new Error('Ungültiger Archiveintrag');
    const cleaned=normalizedState({version:1,...doc.content,glyphs:{}});ids.add(doc.id);
    return {id:doc.id,name:doc.name,createdAt:doc.createdAt,updatedAt:doc.updatedAt,pageCount:doc.pageCount,content:documentContent(cleaned)};
  })};
}
async function writeWorkspace(entries){
  if(db)return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    try{for(const [key,value] of Object.entries(entries))store.put(value,key);}
    catch(error){tx.abort();reject(error);}
  });
  const previous=new Map();
  try{
    for(const [key,value] of Object.entries(entries)){
      const storageKey=key==='current'?'feder-backup':`feder-${key}`;
      previous.set(storageKey,localStorage.getItem(storageKey));localStorage.setItem(storageKey,JSON.stringify(value));
    }
  }catch(error){
    for(const [key,value] of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}
    throw error;
  }
}
async function loadArchive(){
  try{
    const saved=db?await readDatabase('archive'):JSON.parse(localStorage.getItem('feder-archive')||'null');
    if(saved)archive=normalizedArchive(saved);
  }catch(error){archiveAvailable=false;toast('Das Archiv konnte nicht geladen werden. Dein aktuelles Dokument bleibt erhalten.');}
}
function currentDocumentName(){return state.document.name.trim()||DOCUMENT_NAME;}
function updateDocumentControls(){
  $$('.view').forEach(view=>view.inert=archiveBusy);
  $$('[data-view]').forEach(button=>button.disabled=archiveBusy);
  $('#document-name').disabled=archiveBusy;
  if(document.activeElement!==$('#document-name'))$('#document-name').value=state.document.name;
  const saved=archive.documents.some(doc=>doc.id===state.document.id);
  $('#document-save').textContent=saved?'Speichern':'Archivieren';
  $('#document-status').textContent=saved?'Im Archiv':'';
  $('#archive-count').textContent=archive.documents.length;
  $('#document-save').disabled=archiveBusy||!archiveAvailable;
  $$('.document-new').forEach(button=>button.disabled=archiveBusy||!archiveAvailable);
  $('#archive-backup').disabled=archiveBusy;
  $$('#archive-list button').forEach(button=>button.disabled=archiveBusy||!archiveAvailable);
  $('#archive-undo').disabled=archiveBusy||!archiveAvailable;
  $('#archive-rename-save').disabled=archiveBusy||!archiveAvailable;
}
function documentText(content){return [content.text,...content.boxes.filter(b=>b.id!==MAIN_BOX).map(b=>b.text)].join('\n');}
function renderArchive(){
  const list=$('#archive-list'),search=$('#archive-search').value.trim().toLocaleLowerCase('de');list.replaceChildren();
  const docs=[...archive.documents].sort((a,b)=>b.updatedAt-a.updatedAt || a.name.localeCompare(b.name,'de')).filter(doc=>`${doc.name}\n${documentText(doc.content)}`.toLocaleLowerCase('de').includes(search));
  $('#archive-summary').textContent=`${archive.documents.length} ${archive.documents.length===1?'Dokument':'Dokumente'}`;
  $('#archive-empty').hidden=docs.length>0;
  $('#archive-empty-title').textContent=!archiveAvailable?'Archiv nicht verfügbar':search?'Keine passenden Dokumente':'Dein Archiv ist noch leer';
  $('#archive-empty-text').textContent=!archiveAvailable?'Lade bei Bedarf eine Sicherung mit deinem Archiv.':search?'Versuche einen anderen Namen oder Suchbegriff.':'Gespeicherte Dokumente erscheinen hier.';
  $('#archive-undo-row').hidden=!deletedDocument;
  for(const doc of docs){
    const card=document.createElement('article');card.className='archive-card';card.dataset.documentId=doc.id;
    const heading=document.createElement('div');heading.className='archive-card-heading';
    const icon=document.createElement('span');icon.className=`paper-mini ${doc.content.settings.paper}`;icon.setAttribute('aria-hidden','true');
    const name=document.createElement('h2');name.textContent=doc.name;heading.append(icon,name);
    const meta=document.createElement('p');meta.className='archive-meta';
    const formats={a4:'A4',a5:'A5',letter:'US Letter'},papers={lined:'Liniert',grid:'Kariert',dots:'Gepunktet',blank:'Blanko'};
    meta.textContent=`${doc.pageCount} ${doc.pageCount===1?'Seite':'Seiten'} · ${formats[doc.content.settings.format]} · ${doc.content.template?'Eigene Vorlage':papers[doc.content.settings.paper]}`;
    const excerpt=document.createElement('p');excerpt.className='archive-excerpt';excerpt.textContent=documentText(doc.content).trim().slice(0,180)||'Leeres Dokument';
    const date=document.createElement('p');date.className='archive-date';date.textContent=`${new Date(doc.updatedAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}`;
    const actions=document.createElement('div');actions.className='archive-card-actions';
    for(const [action,label,className] of [['open','Öffnen','button primary'],['rename','Umbenennen','text-button'],['delete','Entfernen','text-button muted']]){
      const button=document.createElement('button');button.className=className;button.dataset.archiveAction=action;button.textContent=label;button.setAttribute('aria-label',`${doc.name}: ${label}`);actions.append(button);
    }
    card.append(heading,meta,excerpt,date,actions);list.append(card);
  }
  updateDocumentControls();
}
function hasDocumentDraft(){ensureBoxes();return !!state.document.id || !!allText().trim() || state.boxes.length>1 || state.boxes.some(box=>!box.auto);}
function archiveCurrent(nextArchive,explicit=false){
  if(!explicit && !hasDocumentDraft())return {archive:nextArchive,meta:{...state.document}};
  renderPreview();const existing=nextArchive.documents.find(doc=>doc.id===state.document.id),content=documentContent(),name=currentDocumentName();
  if(existing && existing.name===name && JSON.stringify(existing.content)===JSON.stringify(content))return {archive:nextArchive,meta:{id:existing.id,name}};
  if(!existing && nextArchive.documents.length>=1000)throw new Error('Das Archiv ist voll. Entferne ein Dokument, um Platz zu schaffen.');
  const now=Date.now(),id=existing?.id||`doc-${now.toString(36)}-${crypto.randomUUID()}`;
  const saved={id,name,createdAt:existing?.createdAt||now,updatedAt:now,pageCount:pages.length,content};
  return {archive:{version:1,documents:[saved,...nextArchive.documents.filter(doc=>doc.id!==id)]},meta:{id,name}};
}
async function commitArchive(nextArchive,nextState=state){
  // The archive and current draft change together, including during a reset.
  await writeWorkspace({archive:nextArchive,current:nextState});archive=nextArchive;state=nextState;
  $('#save-status').textContent='✓ Auf diesem Gerät gespeichert';renderArchive();
}
async function archiveAction(action){
  if(archiveBusy||!archiveAvailable)return;
  archiveBusy=true;updateDocumentControls();
  try{await action();}catch(error){toast(error.message==='Das Archiv ist voll. Entferne ein Dokument, um Platz zu schaffen.'?error.message:'Speichern oder Öffnen fehlgeschlagen. Dein bisheriges Dokument bleibt erhalten.');}
  finally{archiveBusy=false;updateDocumentControls();}
}
function resetDocumentEditor(image=templateImage){
  cancelAnimationFrame(renderFrame);selectedBoxId=MAIN_BOX;selectedBoxPage=null;deletedBoxes=null;boxDrag=null;currentPage=0;templateImage=image;
  syncControls();renderPreview();setView('studio');window.scrollTo({top:0});
}
async function saveDocument(){return archiveAction(async()=>{
  const saved=archiveCurrent(archive,true);await commitArchive(saved.archive,{...state,document:saved.meta});toast('Dokument im Archiv gespeichert.');
});}
async function newDocument(){return archiveAction(async()=>{
  const saved=archiveCurrent(archive);
  const fresh={...state,text:'',boxes:[],document:{id:null,name:DOCUMENT_NAME}};
  await commitArchive(saved.archive,fresh);resetDocumentEditor();toast('Neues Dokument bereit.');
});}
async function openDocument(id){return archiveAction(async()=>{
  if(id===state.document.id){setView('studio');window.scrollTo({top:0});return;}
  const doc=archive.documents.find(entry=>entry.id===id);if(!doc)return;
  const image=doc.content.template?await loadImage(doc.content.template):null;
  const saved=archiveCurrent(archive),incoming={...state,...structuredClone(doc.content),document:{id:doc.id,name:doc.name}};
  await commitArchive(saved.archive,incoming);resetDocumentEditor(image);toast(`„${doc.name}“ geöffnet.`);
});}
async function renameArchivedDocument(id,name){return archiveAction(async()=>{
  name=name.trim();if(!name)return;
  const next={version:1,documents:archive.documents.map(doc=>doc.id===id?{...doc,name,updatedAt:Date.now()}:doc)};
  const incoming=state.document.id===id?{...state,document:{id,name}}:state;
  await commitArchive(next,incoming);$('#archive-rename-dialog').close();toast('Dokument umbenannt.');
});}
async function deleteArchivedDocument(id){return archiveAction(async()=>{
  const doc=archive.documents.find(entry=>entry.id===id);if(!doc)return;
  const wasCurrent=state.document.id===id,next={version:1,documents:archive.documents.filter(entry=>entry.id!==id)};
  await commitArchive(next,wasCurrent?{...state,document:{id:null,name:state.document.name}}:state);
  deletedDocument={doc,wasCurrent,detachedMeta:state.document};renderArchive();toast('Aus dem Archiv entfernt. Du kannst das rückgängig machen.');
});}
async function undoArchivedDelete(){return archiveAction(async()=>{
  if(!deletedDocument)return;
  const {doc,wasCurrent,detachedMeta}=deletedDocument;
  if(archive.documents.length>=1000 && !archive.documents.some(entry=>entry.id===doc.id))throw new Error('Das Archiv ist voll. Entferne ein Dokument, um Platz zu schaffen.');
  const next={version:1,documents:[doc,...archive.documents.filter(entry=>entry.id!==doc.id)]};
  const incoming=wasCurrent && state.document===detachedMeta?{...state,document:{id:doc.id,name:state.document.name}}:state;
  await commitArchive(next,incoming);deletedDocument=null;renderArchive();toast('Dokument wiederhergestellt.');
});}
function downloadWorkspaceBackup(){download(new Blob([JSON.stringify({...state,archive})],{type:'application/json'}),`Feder-Sicherung-${new Date().toISOString().slice(0,10)}.json`);toast('Sicherung mit Alphabet und Archiv heruntergeladen.');}
function bindArchive(){
  $('#document-name').oninput=e=>{state.document.name=e.target.value;persist();};
  $('#document-name').onblur=()=>{if(!state.document.name.trim()){state.document.name=DOCUMENT_NAME;updateDocumentControls();persist();}};
  $('#document-save').onclick=saveDocument;$$('.document-new').forEach(button=>button.onclick=newDocument);
  $('#archive-search').oninput=renderArchive;$('#archive-backup').onclick=downloadWorkspaceBackup;$('#archive-undo').onclick=undoArchivedDelete;
  $('#archive-list').onclick=e=>{
    const button=e.target.closest('[data-archive-action]');if(!button || archiveBusy)return;
    const id=button.closest('.archive-card').dataset.documentId;
    if(button.dataset.archiveAction==='open')openDocument(id);
    else if(button.dataset.archiveAction==='delete')deleteArchivedDocument(id);
    else{const doc=archive.documents.find(entry=>entry.id===id);renameDocumentId=id;$('#archive-rename-name').value=doc.name;$('#archive-rename-dialog').showModal();$('#archive-rename-name').select();}
  };
  $('#archive-rename-form').onsubmit=e=>{e.preventDefault();renameArchivedDocument(renameDocumentId,$('#archive-rename-name').value);};
  renderArchive();
}
