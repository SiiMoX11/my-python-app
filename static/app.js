/* Chirurgie Viscérale A — CHU Oujda — Front-end (vanilla JS, SPA) */
(() => {
'use strict';

// SORTIE DATES ET CRH V1
function crhIsoDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(String(d||''));}
function crhStayEntries(entries,p){
 const start=crhIsoDate(p.date_entree)?p.date_entree:null,end=crhIsoDate(p.sortie_date)?p.sortie_date:null;
 return (entries||[]).filter(e=>{
  const date=crhIsoDate(e.date)?e.date:crhIsoDate(String(e.created_at||'').slice(0,10))?String(e.created_at).slice(0,10):null;
  return !date||(!start||date>=start)&&(!end||date<=end);
 });
}
function crhOrdered(entries){return [...entries].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.id||0)-(b.id||0));}
function crhText(e){return String(e.content||'').trim();}
function crhBilanPayload(e){
 try{const p=JSON.parse(e.details||'');if(!p?.values)return null;
  if(p.schema==='bilan-simple-v2')return p.values;
  if(p.schema==='bilan-v1')return Object.fromEntries(Object.entries(p.values).map(([k,row])=>[k,row?.value||'']));
 }catch{}return null;
}
function crhBilanLines(entries){
 const fields=[['Alb',['Alb']],['GB',['GB']],['Hb',['Hb']],['Plq',['Plq']],['TP',['TP']],['CRP',['CRP']],['Lipase',['Lipase']],['BT/BD',['BT','BD']],['GGT/PAL',['GGT','PAL']],['ASAT/ALAT',['ASAT','ALAT']],['Urée/Créat',['Uree','Creat']],['Na/K',['Na','K']],['ECBU',['ECBU']],['ACE',['ACE']],['CA19-9',['CA19-9']],['CA125',['CA125']],['CA15-3',['CA15-3']]];
 const grouped=new Map(),free=[],other=[];
 for(const e of crhOrdered(entries)){
  const values=crhBilanPayload(e);if(!values){free.push(e);continue;}
  const numeric=Object.fromEntries(Object.entries(values).filter(([k,v])=>k!=='Autre'&&String(v??'').trim()));
  if(Object.keys(numeric).length)grouped.set(e.date||'',{...(grouped.get(e.date||'')||{}),...numeric});
  if(values.Autre)other.push({date:e.date,text:values.Autre,id:e.id});
 }
 const dates=[...grouped.keys()].sort(),lines=[];
 if(dates.length){
  const last=dates[dates.length-1];
  const labels=dates.map((d,i)=>i===dates.length-1?fmtDate(d):crhIsoDate(d)&&d.slice(0,7)===last.slice(0,7)?d.slice(8):fmtDate(d));
  lines.push('BB '+labels.join(' → ')+' :');
  for(const[label,keys]of fields){if(!dates.some(date=>keys.some(k=>grouped.get(date)[k])))continue;
    lines.push(label+' : '+dates.map(date=>keys.map(k=>grouped.get(date)[k]||'—').join('/')).join(' → '));
  }
 }
 for(const e of free)lines.push('BB '+(fmtDate(e.date)||'date non renseignée')+' :\n'+crhText(e));
 for(const e of other.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.id||0)-(a.id||0)))lines.push('Autre — '+(fmtDate(e.date)||'date non renseignée')+' :\n'+e.text);
 return lines;
}
function buildCrhDraft(p,E,options={}){
 const lines=['COMPTE RENDU D’HOSPITALISATION',
 'Nom et prénom : '+[p.nom,p.prenom].filter(Boolean).join(' ')+' — IP : '+(p.ip||'Non renseigné')+' — Âge : '+(p.age!=null?p.age+' ans':'Non renseigné'),
 'Date d’entrée : '+(fmtDate(p.date_entree)||'À renseigner')+' — Date de sortie : '+(fmtDate(p.sortie_date)||'À renseigner'),
 '', 'Identité :', [p.age!=null?'Patient de '+p.age+' ans':'Âge non renseigné',p.mutuelle?'Couverture : '+p.mutuelle:''].filter(Boolean).join('. ')+'.',
 '', 'Motif :',p.motif||'Non renseigné', '', 'ATCDs :'];
 const atcd=(E.atcd||[]).map(crhText).filter(Boolean);lines.push(atcd.length?atcd.join('\n'):'Non renseignés');
 const clinical=crhStayEntries(E.clinique,p);
 lines.push('', 'Examen clinique / surveillance :');
 if(clinical.length){for(const e of crhOrdered(clinical)){lines.push((e.category||'Clinique')+(e.date?' — '+fmtDate(e.date):'')+' :',crhText(e));if(e.details)lines.push(e.details);}}
 else lines.push('Non renseigné');
 const bilans=crhStayEntries(E.bilan,p);
 if(bilans.length)lines.push('',...crhBilanLines(bilans));
 const exams=crhStayEntries(E.examen,p);
 if(exams.length){lines.push('', 'Examens complémentaires :');for(const e of crhOrdered(exams)){
  lines.push([e.title||e.category||'Examen',fmtDate(e.date)].filter(Boolean).join(' — ')+' :');
  if(e.content)lines.push(e.content);if(e.details)lines.push(e.details);
 }}
 const avis=crhStayEntries(E.avis,p);
 if(avis.length){lines.push('', 'Avis spécialisés :');for(const e of crhOrdered(avis))lines.push((e.category||'Avis')+(e.date?' — '+fmtDate(e.date):'')+' :',crhText(e));}
 lines.push('', 'Prise en charge :');
 if(options.care==='intervention'){
  const name=String(options.operation_name||'').trim();
  lines.push(name?'Le patient a bénéficié de l’intervention suivante : '+name+(options.operation_date?' le '+fmtDate(options.operation_date):' (date à compléter)')+'.':'Intervention réalisée : intitulé et date à compléter.');
 }else if(options.care==='surveillance')lines.push('Le patient a bénéficié d’une prise en charge par surveillance clinico-biologique.');
 else lines.push('À confirmer : prise en charge par surveillance clinico-biologique en l’absence d’intervention réalisée.');
 const observations=crhStayEntries(E.observation,p);
 lines.push('', 'Évolution / observations :');
 if(observations.length){for(const e of crhOrdered(observations))lines.push((fmtDate(e.date)||'Date non renseignée')+(e.title?' — '+e.title:'')+' :',crhText(e));}
 else lines.push('Évolution non renseignée — à compléter.');
 lines.push('',p.status==='sorti'?'Sortie :':'Projet de sortie :');
 lines.push([p.sortie_date?'Le '+fmtDate(p.sortie_date):'',p.sortie_mode||'',p.sortie_destination||''].filter(Boolean).join(' — ')||'À compléter');
 if(p.sortie_ordonnance)lines.push('', 'Ordonnance de sortie renseignée :',p.sortie_ordonnance);
 if(p.sortie_rdv)lines.push('', 'Suivi prévu :',p.sortie_rdv);
 return lines.join('\n');
}
function initSortieCrh(form,p,E){
 const summary=form.elements.sortie_resume;if(!summary)return;
 let sourceEntries=E,lastDraft=null;
 const controls=document.createElement('div');controls.className='crh-tools';
 controls.innerHTML=`<div class="fgrid" style="margin:8px 0"><div class="field"><label>Pour le préremplissage : prise en charge</label><select id="crh-care"><option value="a_confirmer">À confirmer</option><option value="surveillance">Surveillance sans intervention — confirmée</option><option value="intervention">Intervention réalisée — confirmée</option></select></div><div class="field" id="crh-gesture-field"><label>Geste enregistré à reprendre (facultatif)</label><select id="crh-gesture"></select></div><div class="field" id="crh-name-field"><label>Intervention réalisée</label><input id="crh-operation-name" placeholder="Intitulé à confirmer"></div><div class="field" id="crh-date-field"><label>Date de l’intervention</label><input type="date" id="crh-operation-date"></div></div><button type="button" class="btn" id="crh-prefill">Préremplir depuis MAJ + observations</button><p id="crh-prefill-status" style="font-size:11px;color:#64748b;margin:8px 0">Brouillon à relire ; aucune bonne évolution ni donnée manquante n’est inventée.</p>`;
 summary.parentElement.insertBefore(controls,summary);
 const care=$('#crh-care',controls),gestures=$('#crh-gesture',controls),name=$('#crh-operation-name',controls),date=$('#crh-operation-date',controls),status=$('#crh-prefill-status',controls),button=$('#crh-prefill',controls);
 const currentPatient=()=>({...p,date_entree:form.elements.date_entree?.value||'',sortie_date:form.elements.sortie_date.value,sortie_mode:form.elements.sortie_mode.value,sortie_destination:form.elements.sortie_destination.value,sortie_ordonnance:form.elements.sortie_ordonnance.value,sortie_rdv:form.elements.sortie_rdv.value});
 const options=()=>({care:care.value,operation_name:name.value,operation_date:date.value});
 const gestureList=()=>crhStayEntries(sourceEntries.clinique,currentPatient()).filter(e=>e.category==='Gestes faits');
 const refreshGestures=()=>{
  const previous=gestures.value;gestures.innerHTML='<option value="">— Choisir ou saisir manuellement —</option>'+gestureList().map(e=>`<option value="${e.id}">${esc((fmtDate(e.date)||'Date inconnue')+' — '+crhText(e))}</option>`).join('');
  if([...gestures.options].some(o=>o.value===previous))gestures.value=previous;
 };
 const update=force=>{
  if(force||!summary.value.trim()||summary.value===lastDraft){lastDraft=buildCrhDraft(currentPatient(),sourceEntries,options());summary.value=lastDraft;status.textContent='Brouillon prérempli : vérifier les dates, la prise en charge et l’évolution avant validation.';}
  else status.textContent='Texte personnalisé conservé. Utilisez Préremplir pour le remplacer après confirmation.';
 };
 const toggle=()=>{const visible=care.value==='intervention';for(const id of ['crh-gesture-field','crh-name-field','crh-date-field'])$('#'+id,controls).style.display=visible?'':'none';};
 care.onchange=()=>{toggle();update(false);};
 gestures.onchange=()=>{const e=gestureList().find(e=>String(e.id)===gestures.value);if(e){name.value=crhText(e).replace(/^\s*J\s*\d+\s*(?:post\b\s*)?/i,'').replace(/^\s*post\b\s*/i,'').trim();date.value=crhIsoDate(e.date)?e.date:'';}update(false);};
 name.oninput=()=>update(false);date.onchange=()=>update(false);
 for(const field of ['date_entree','sortie_date','sortie_mode','sortie_destination','sortie_ordonnance','sortie_rdv'])form.elements[field]?.addEventListener('change',()=>{refreshGestures();update(false);});
 button.onclick=async()=>{
  if(summary.value.trim()&&summary.value!==lastDraft&&!confirm('Remplacer le résumé personnalisé par un nouveau brouillon depuis le dossier ?'))return;
  button.disabled=true;
  try{const data=await api('/api/patients/'+p.id);if(!form.isConnected)return;sourceEntries=data.entries;refreshGestures();update(true);}
  catch(error){status.textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}
 };
 refreshGestures();toggle();if(!summary.value.trim())update(true);
}

// AUTRES ET CENTRAGE ONGLETS V1
// MENU TABLEAU VISITE ET STAFFER V1

function viewPatientsAStaffer(){
  $('#app').innerHTML=topbar()+`<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="staffer-back">${I.back} Retour à l’accueil</button></div><section class="panel"><div class="panel-head"><h3>Patients à staffer</h3></div><div class="empty">Espace réservé — fonctionnalités à définir.</div></section></main>`;
  bindChrome();
  $('#staffer-back').onclick=()=>{location.hash='#/home';};
}

// ONGLETS ET LOGS ADMIN V1

// TELECHARGEMENT IMAGERIE V3
async function downloadImaging(pid,v,button){
 if(button)button.disabled=true;
 try{
  if(v.category==='fichier'){
    const access=await api('/api/patients/'+pid+'/imaging/'+v.id+'/ticket',{method:'POST'});
    const link=document.createElement('a');link.href=API+'/api/patients/'+pid+'/imaging/'+v.id+'/media?ticket='+encodeURIComponent(access.ticket)+'&download=1';
    link.download='';document.body.appendChild(link);link.click();link.remove();
  }else{
    let url;try{url=new URL(v.content);}catch{}if(!url||!['http:','https:'].includes(url.protocol))throw new Error('Lien non pris en charge.');
    const host=url.hostname.toLowerCase();
    if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host))throw new Error('Téléchargement non disponible pour un lien YouTube.');
    const response=await fetch(url.href,{credentials:'omit'});if(!response.ok)throw new Error('Téléchargement refusé par le serveur externe.');
    const blob=await response.blob(),local=URL.createObjectURL(blob),link=document.createElement('a');link.href=local;link.download=url.pathname.split('/').pop()||'imagerie';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(local),60000);
  }
 }catch(error){toast(v.category==='fichier'?error.message:'Téléchargement du lien externe indisponible : '+error.message,true);}
 finally{if(button?.isConnected)button.disabled=false;}
}


// MINIATURES IMAGERIES V2
function imagingCardTitle(p){
 const base=imagingHeading(p);
 return p.type==='Autre'?base:[base,imagingSummary(p)].filter(Boolean).join(' — ');
}
async function loadImagingThumbnail(pid,v,button){
 if(button.dataset.thumbLoaded)return;button.dataset.thumbLoaded='1';
 try{
  let src,kind;
  if(v.category==='fichier'){
    const ticket=await api('/api/patients/'+pid+'/imaging/'+v.id+'/ticket',{method:'POST'});
    if(!button.isConnected)return;
    src=API+'/api/patients/'+pid+'/imaging/'+v.id+'/media?ticket='+encodeURIComponent(ticket.ticket);kind=ticket.media_type;
  }else{
    let url;try{url=new URL(v.content);}catch{}if(!url||!['http:','https:'].includes(url.protocol))throw new Error('Lien non pris en charge');
    const host=url.hostname.toLowerCase();
    if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host)){
      const id=host.includes('youtu.be')?url.pathname.split('/').filter(Boolean)[0]:(url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).pop());
      if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))throw new Error('Lien YouTube invalide');
      src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';kind='image';
    }else if(/\.(jpe?g|png)$/i.test(url.pathname)){src=url.href;kind='image';}
    else if(/\.(mp4|webm|mov|m4v|ogg)$/i.test(url.pathname)){src=url.href;kind='video';}
    else throw new Error('Pas de miniature intégrée pour ce lien');
  }
  if(!button.isConnected)return;
  const media=document.createElement(kind==='image'?'img':'video');media.className='imaging-thumbnail-media';
  if(kind==='image'){media.alt=imagingCardTitle(imagingInfo(v));media.loading='lazy';media.referrerPolicy='no-referrer';}
  else{
    media.muted=true;media.playsInline=true;media.preload='metadata';media.controls=false;media.tabIndex=-1;
    media.addEventListener('loadedmetadata',()=>{try{if(Number.isFinite(media.duration)&&media.duration>0)media.currentTime=Math.min(.1,media.duration/2);}catch{}},{once:true});
  }
  media.onerror=()=>{if(button.isConnected)button.innerHTML='<span class="imaging-thumbnail-fallback">▶</span><small>Miniature indisponible — cliquer pour lire</small>';};
  media.src=src;button.replaceChildren(media);
  const play=document.createElement('span');play.className='imaging-thumbnail-play';play.textContent='▶';button.appendChild(play);
 }catch(error){if(button.isConnected){button.innerHTML='<span class="imaging-thumbnail-fallback">▶</span><small>Aperçu indisponible — cliquer pour ouvrir</small>';}}
}
function prepareImagingThumbnails(box,pid,vids){
 const buttons=[...box.querySelectorAll('[data-imaging-thumbnail]')];
 const load=button=>{const v=vids.find(v=>String(v.id)===button.dataset.imagingThumbnail);if(v)loadImagingThumbnail(pid,v,button);};
 if('IntersectionObserver' in window){
   const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);load(e.target);}});},{root:null,rootMargin:'150px'});
   buttons.forEach(button=>observer.observe(button));
   setTimeout(()=>{if(!box.isConnected)observer.disconnect();},60000);
 }else buttons.forEach(load);
}


// VIDEOS IMAGERIES V1
function imagingInfo(v){
 try{const p=JSON.parse(v.details||'');if(p?.schema==='imaging-v1')return p;}catch{}
 return {schema:'imaging-v1',type:['TDM','IRM'].includes(v.title)?v.title:'Autre',custom_title:['TDM','IRM'].includes(v.title)?'':v.title||'',plane:'Autre',phase:'Autre',custom_plane:'',custom_phase:'',notes:v.details||''};
}
function imagingHeading(p){return p.type==='Autre'?p.custom_title||'Autre':p.type;}
function imagingSummary(p){
 return [p.plane==='Autre'?p.custom_plane||'':p.plane||'',p.phase==='Autre'?p.custom_phase||'':p.phase||''].filter(value=>String(value).trim()).join(' · ');
}
function imagingForm(entry){
 const p=entry?imagingInfo(entry):{type:'',custom_title:'',plane:'',phase:'',custom_plane:'',custom_phase:'',notes:''};
 const uploaded=entry?.category==='fichier';
 const fields=[
 {name:'imaging_type',label:'Type d’imagerie',type:'select',options:[['','— Choisir —'],'TDM','IRM','Autre'],required:true},
 {name:'custom_title',label:'Titre — type Autre',full:true},
 {name:'date',label:'Date',type:'date',required:true},
 {name:'plane',label:'Coupe',type:'select',options:[['','— Choisir —'],'Axiale','Sagittale','Coronale','Autre'],required:false},
 {name:'custom_plane',label:'Précision de coupe (facultative)',full:true},
 {name:'phase',label:'Temps',type:'select',options:[['','— Choisir —'],'Sans injection','Artériel','Veineux','Portal','Tardif','Autre'],required:false},
 {name:'custom_phase',label:'Précision du temps (facultative)',full:true},
 ...(!uploaded?[{name:'content',label:'Lien URL de la vidéo',full:true,placeholder:'https://… (ou importer un fichier ci-dessous)'}]:[]),
 {name:'file',label:entry?'Remplacer par une autre vidéo / image (facultatif)':'Ou importer une vidéo / image',type:'file',accept:'video/*,image/jpeg,image/png',full:true},
 {name:'notes',label:'Description',type:'textarea',full:true}];
 const form=formModal({title:entry?'Modifier l’imagerie':'Ajouter une imagerie',fields,
 values:{imaging_type:p.type,custom_title:p.custom_title,date:entry?.date||today(),plane:p.plane,custom_plane:p.custom_plane,phase:p.phase,custom_phase:p.custom_phase,notes:p.notes,content:entry?.content||''},
 onSubmit:async v=>{
  if(v.imaging_type!=='Autre'&&(!v.plane||!v.phase))throw new Error('Renseignez coupe et temps pour TDM/IRM.');
  if(v.imaging_type==='Autre'&&!v.custom_title.trim())throw new Error('Précisez le titre du type Autre.');
  const info={schema:'imaging-v1',type:v.imaging_type,custom_title:v.imaging_type==='Autre'?v.custom_title.trim():'',plane:v.imaging_type==='Autre'?'':v.plane,custom_plane:v.plane==='Autre'?v.custom_plane.trim():'',phase:v.imaging_type==='Autre'?'':v.phase,custom_phase:v.phase==='Autre'?v.custom_phase.trim():'',notes:v.notes||''};
  const title=imagingHeading(info),details=JSON.stringify(info);
  const pid=S.patient.id;
  if(v.file){
   const fd=new FormData();fd.append('file',v.file);fd.append('title',title);fd.append('date',v.date);fd.append('details',details);
   await api(entry?'/api/patients/'+pid+'/imaging/'+entry.id+'/replace':'/api/patients/'+pid+'/upload',{method:'POST',body:fd});
  }else{
   const content=uploaded?entry.content:(v.content||'').trim();
   if(!content)throw new Error('Ajoutez un lien ou importez un fichier.');
   if(!uploaded){let url;try{url=new URL(content);}catch{}if(!url||!['http:','https:'].includes(url.protocol))throw new Error('Lien HTTP ou HTTPS valide requis.');}
   const body={kind:'video',category:entry?.category||'',title,date:v.date,content,details};
   if(entry)await api('/api/entries/'+entry.id,{method:'PUT',body});else await api('/api/patients/'+pid+'/entries',{method:'POST',body});
  }
  toast('Imagerie enregistrée');await refresh();
 },onDelete:entry?async()=>{await api('/api/entries/'+entry.id,{method:'DELETE'});await refresh();}:null});
 const toggle=()=>{
  const other=form.elements.imaging_type.value==='Autre';
  for(const[name,visible]of [['custom_title',other],['plane',!other],['phase',!other],['custom_plane',!other&&form.elements.plane.value==='Autre'],['custom_phase',!other&&form.elements.phase.value==='Autre']]){
   const row=form.querySelector('[data-f="'+name+'"]');if(row)row.style.display=visible?'':'none';
  }
  form.elements.plane.required=!other;form.elements.phase.required=!other;
 };
 form.elements.imaging_type.onchange=toggle;form.elements.plane.onchange=toggle;form.elements.phase.onchange=toggle;toggle();
}
function renderImagingTab(box,E,p){
 const vids=sortByDate(E.video||[]);
 box.innerHTML=`<div class="panel"><div class="panel-head"><h3>Videos imageries</h3><button class="btn primary" data-add="video">+ Ajouter une imagerie</button></div><div class="videos">${vids.map(v=>{
  const info=imagingInfo(v);
  return `<article class="card imaging-card" data-imaging-card="${v.id}" data-imaging-type="${esc(info.type)}"><div class="imaging-card-head"><h4>${esc(imagingCardTitle(info))}</h4><button type="button" class="maj-edit-pencil no-print" data-imaging-edit="${v.id}" title="Modifier l’imagerie" aria-label="Modifier l’imagerie">✎</button></div><div class="imaging-subtitle">${fmtDate(v.date)}</div><button type="button" class="imaging-thumbnail" data-imaging-thumbnail="${v.id}" aria-label="Ouvrir ${esc(imagingCardTitle(info))}"><span class="imaging-thumbnail-fallback">▶</span><small>Chargement de la miniature…</small></button>${info.notes?`<p class="imaging-description">${esc(info.notes)}</p>`:''}</article>`;
 }).join('')||'<div class="empty">Aucune imagerie</div>'}</div></div>`;
 box.querySelectorAll('[data-imaging-card]').forEach(card=>card.onclick=event=>{
  if(event.target.closest('[data-imaging-edit]'))return;
  const v=vids.find(v=>String(v.id)===card.dataset.imagingCard);if(v)openImagingPlayer(p.id,v);
 });
 box.querySelectorAll('[data-imaging-edit]').forEach(button=>button.onclick=event=>{
  event.stopPropagation();const v=vids.find(v=>String(v.id)===button.dataset.imagingEdit);if(v)imagingForm(v);
 });
 prepareImagingThumbnails(box,p.id,vids);
}

function stopImagingPlayer(){
 const video=document.querySelector('#imaging-player-content video');
 if(video){video.pause();video.removeAttribute('src');video.load();}
}
async function openImagingPlayer(pid,v){
 closeModal();const info=imagingInfo(v);
 const overlay=modal(`<div class="dialog-head"><h2>${esc(imagingCardTitle(info))}</h2><div class="imaging-reader-actions"><button type="button" class="btn" id="imaging-download">Télécharger</button><button type="button" class="icon-btn" id="imaging-close" aria-label="Fermer">✕</button></div></div><p class="imaging-player-meta">${fmtDate(v.date)}</p><div class="imaging-player-content" id="imaging-player-content"><div class="empty">Ouverture…</div></div>${info.notes?`<p class="imaging-player-description">${esc(info.notes)}</p>`:''}`,'imaging-player-dialog');
 $('#imaging-close',overlay).onclick=closeModal;
 const download=$('#imaging-download',overlay);download.onclick=()=>downloadImaging(pid,v,download);
 if(v.category!=='fichier'){try{const host=new URL(v.content).hostname.toLowerCase();if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host)){download.disabled=true;download.title='Téléchargement indisponible pour un lien YouTube';}}catch{}}
const container=$('#imaging-player-content',overlay);
 try{
  if(v.category==='fichier'){
   const access=await api('/api/patients/'+pid+'/imaging/'+v.id+'/ticket',{method:'POST'});if(!container.isConnected)return;
   const src=API+'/api/patients/'+pid+'/imaging/'+v.id+'/media?ticket='+encodeURIComponent(access.ticket);
   if(access.media_type==='image'){
    const image=document.createElement('img');image.src=src;image.alt=imagingHeading(info);image.className='imaging-player-image';container.replaceChildren(image);
   }else{
    const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.className='imaging-player-video';video.src=src;
    video.onerror=()=>{if(container.isConnected&&!container.querySelector('.imaging-format-note')){const note=document.createElement('p');note.className='imaging-format-note';note.textContent='Vidéo non lisible : vérifier son format/codecs ou rouvrir le lecteur si l’accès a expiré.';container.appendChild(note);}};
    container.replaceChildren(video);
   }
  }else{
   let url;try{url=new URL(v.content);}catch{}if(!url||!['http:','https:'].includes(url.protocol))throw new Error('Lien non pris en charge.');
   const host=url.hostname.toLowerCase();
   if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(host)){
    const id=host.includes('youtu.be')?url.pathname.split('/').filter(Boolean)[0]:(url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).pop());
    if(!/^[\w-]{11}$/.test(id||''))throw new Error('Lien YouTube invalide.');
    const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id;frame.title=imagingHeading(info);frame.className='imaging-youtube-frame';frame.allowFullscreen=true;frame.setAttribute('allow','fullscreen; picture-in-picture');container.replaceChildren(frame);
   }else if(/\.(mp4|webm|mov|m4v|ogg)$/i.test(url.pathname)){
    const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=url.href;video.className='imaging-player-video';container.replaceChildren(video);
   }else{
    container.innerHTML='<p>Ce lien ne permet pas un aperçu intégré.</p>';const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Ouvrir le lien externe';container.appendChild(link);
   }
  }
 }catch(error){if(container.isConnected)container.innerHTML='<div class="empty">'+esc(error.message)+'</div>';}
}


// TTT PRESENTATION V3
let tttPresentationRanks=new Map();
function tttRank(entry){
 if(tttPresentationRanks.has(entry.title))return tttPresentationRanks.get(entry.title);
 const categories={'solutés':0,'solutes':0,'sérums':0,'serums':0,'antalgique':1,'antibiotique':2,'anticoagulant':3,'anticoagulation':3,'insuline':4};
 return categories[String(entry.category||'').trim().toLowerCase()]??5;
}
function tttCompare(a,b){return tttRank(a)-tttRank(b)||Number(!!a.done)-Number(!!b.done)||(b.date||'').localeCompare(a.date||'')||(b.id||0)-(a.id||0);}
async function sortTreatmentTableWhenReady(box,E){
 try{
  const catalogue=await getTreatmentCatalogue();
  tttPresentationRanks=new Map(catalogue.map(row=>[row.nom,Number.isFinite(row.rang)?row.rang:5]));
  if(!box.isConnected)return;
  const body=box.querySelector('tbody');if(!body)return;
  const nodes=new Map([...body.querySelectorAll('[data-eid]')].map(node=>[node.dataset.eid,node]));
  [...(E.traitement||[])].sort(tttCompare).forEach(entry=>{const node=nodes.get('traitement:'+entry.id);if(node)body.appendChild(node);});
 }catch(error){toast(error.message,true);}
}
async function previewTreatmentSheet(pid){
 closeModal();
 const overlay=modal(`<div class="dialog-head"><h2>Fiche de traitement</h2><div class="ttt-preview-actions"><button type="button" class="btn" id="ttt-preview-download" disabled>Télécharger Word</button><button type="button" class="icon-btn" id="ttt-preview-close" aria-label="Fermer">✕</button></div></div><div class="ttt-preview-content"><div class="empty">Génération de la fiche…</div></div>`,'ttt-preview-dialog');
 $('#ttt-preview-close',overlay).onclick=closeModal;
 const container=$('.ttt-preview-content',overlay),download=$('#ttt-preview-download',overlay);
 try{
  const result=await api('/api/patients/'+pid+'/fiche-traitement/preview');if(!container.isConnected)return;
  const frame=document.createElement('iframe');frame.title='Aperçu de la fiche de traitement';frame.className='ttt-preview-frame';frame.setAttribute('sandbox','');frame.srcdoc=result.html;container.replaceChildren(frame);
  download.disabled=false;
  download.onclick=()=>{
   try{
    const raw=atob(result.docx_base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   }catch(error){toast(error.message,true);}
  };
 }catch(error){if(container.isConnected)container.innerHTML='<div class="empty">'+esc(error.message)+'</div>';}
}


// TRAITEMENTS TTT V1
let treatmentCatalogueCache=null;
async function getTreatmentCatalogue(){if(!treatmentCatalogueCache)treatmentCatalogueCache=(await api('/api/ttt/catalogue')).traitements;return treatmentCatalogueCache;}
function tttDetails(entry){try{const p=JSON.parse(entry?.details||'');return p?.schema==='ttt-catalogue-v1'?p:null;}catch{return null;}}
function tttNotes(entry){return tttDetails(entry)?.notes||(!tttDetails(entry)?entry.details||'':'');}
async function treatmentForm(entry){
 let rows;try{rows=await getTreatmentCatalogue();}catch(error){toast(error.message,true);return;}
 const names=rows.map(r=>r.nom),matched=rows.find(r=>r.nom===entry?.title),stored=entry?tttDetails(entry):null;
 const options=[['','— Choisir un traitement —'],...names.map(n=>[n,n])];
 if(entry?.title&&!names.includes(entry.title))options.push([entry.title,entry.title+' (traitement existant)']);
 const form=formModal({title:entry?'Modifier le traitement':'Ajouter un traitement',
   fields:[{name:'title',label:'Traitement',type:'select',options,required:true,full:true},{name:'date',label:'Date de début',type:'date',required:true},{name:'prises',label:'Prises planifiées par jour (0 = cases laissées vides)',type:'number',required:true},{name:'jours',label:'Jours à marquer sur la fiche (1 à 6)',type:'number',required:true},{name:'done',label:'Statut',type:'checkbox',hint:'Traitement arrêté'},{name:'notes',label:'Remarques',type:'textarea',full:true}],
   values:{title:entry?.title||'',content:entry?.content||'',date:entry?.date||today(),prises:stored?.prises??matched?.prises??0,jours:stored?.jours??matched?.jours??6,done:!!entry?.done,notes:entry?tttNotes(entry):''},
   extra:'<p class="ttt-note">Catalogue fourni par le service, repris tel quel. Vérifier le traitement, les unités et les prises avant validation. Les Δ de la fiche sont des prises planifiées, pas des administrations réalisées.</p>',
   onSubmit:async v=>{
     const takes=Number(v.prises),days=Number(v.jours);
     if(!Number.isInteger(takes)||takes<0||takes>24||!Number.isInteger(days)||days<1||days>6)throw new Error('Vérifiez prises/jour (0–24) et jours de fiche (1–6).');
     const body={kind:'traitement',title:v.title,content:entry&&v.title===entry.title?entry.content||'':'',date:v.date,done:v.done,details:JSON.stringify({schema:'ttt-catalogue-v1',prises:takes,jours:days,notes:v.notes||''})};
     if(entry)await api('/api/entries/'+entry.id,{method:'PUT',body});else await api('/api/patients/'+S.patient.id+'/entries',{method:'POST',body});
     toast('Traitement enregistré');await refresh();
   },onDelete:entry?async()=>{await api('/api/entries/'+entry.id,{method:'DELETE'});await refresh();}:null
 });
 form.elements.title.onchange=()=>{
   const chosen=rows.find(r=>r.nom===form.elements.title.value);
   if(chosen){form.elements.prises.value=chosen.prises;form.elements.jours.value=chosen.jours;}
 };
 form.elements.prises.min='0';form.elements.prises.max='24';form.elements.prises.step='1';
 form.elements.jours.min='1';form.elements.jours.max='6';form.elements.jours.step='1';
}
function renderTreatmentTab(box,E,p){
 const list=[...(E.traitement||[])].sort(tttCompare);
 box.innerHTML=`<div class="panel"><div class="panel-head"><h3>Traitement</h3><div class="ttt-head-actions"><button class="btn" id="ttt-word" type="button" disabled>Fiche de traitement Word</button><button class="btn primary" data-add="traitement">+ Ajouter un traitement</button></div></div><div class="ttt-diseases"><label for="ttt-associated-diseases">Maladies associées</label><textarea id="ttt-associated-diseases" rows="1" maxlength="1000" placeholder="Ex. diabète, HTA…" disabled></textarea><button class="btn" type="button" id="ttt-save-diseases" disabled>Enregistrer</button></div><table class="tbl"><thead><tr><th>Statut</th><th>Traitement</th><th>Début</th></tr></thead><tbody>${list.map(t=>`<tr class="clickable" data-eid="traitement:${t.id}"><td><span class="chip ${t.done?'off':'on'}">${t.done?'Arrêté':'En cours'}</span></td><td><b>${esc(t.title)}</b>${tttNotes(t)?`<br><small>${esc(tttNotes(t))}</small>`:''}</td><td>${fmtDate(t.date)}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">Aucun traitement</td></tr>'}</tbody></table></div>`;
 sortTreatmentTableWhenReady(box,E);
 bindTreatmentProfile(p.id,box);
}
async function bindTreatmentProfile(pid,box){
 const field=$('#ttt-associated-diseases',box),save=$('#ttt-save-diseases',box),word=$('#ttt-word',box);
 try{
   const p=await api('/api/patients/'+pid+'/ttt-profile');if(!box.isConnected||String(S.patient?.id)!==String(pid))return;
   field.value=p.associated_diseases||'';field.dataset.saved=field.value;field.disabled=false;save.disabled=false;word.disabled=false;
   const persist=async()=>{
     if(field.value!==field.dataset.saved){await api('/api/patients/'+pid+'/ttt-profile',{method:'PUT',body:{associated_diseases:field.value}});field.dataset.saved=field.value;}
   };
   save.onclick=async()=>{save.disabled=true;try{await persist();toast('Maladies associées enregistrées');}catch(e){toast(e.message,true);}finally{if(save.isConnected)save.disabled=false;}};
   word.onclick=async()=>{
     word.disabled=true;save.disabled=true;
     try{await persist();await previewTreatmentSheet(pid);}
     catch(e){toast(e.message,true);}
     finally{if(word.isConnected)word.disabled=false;if(save.isConnected)save.disabled=false;}
   };
 }catch(e){toast(e.message,true);if(field)field.placeholder='Impossible de charger les maladies associées';}
}


// OBSRV DOCUMENTS V1
let patientDocObjectUrl=null;
function releasePatientDocUrl(){if(patientDocObjectUrl){URL.revokeObjectURL(patientDocObjectUrl);patientDocObjectUrl=null;}}
function documentPanel(){return `<section class="panel obs-doc-panel"><div class="panel-head"><h3>Documents du patient</h3><button type="button" class="btn primary" id="upload-patient-doc">+ Importer</button></div><p class="obs-doc-note">Images, PDF et Word DOCX — 25 Mo maximum. Cliquez pour ouvrir l’aperçu.</p><div id="patient-doc-list"><div class="empty">Chargement…</div></div></section>`;}
function uploadPatientDocument(pid){
 formModal({title:'Importer un document',fields:[{name:'title',label:'Titre du document'},{name:'date',label:'Date du document',type:'date',required:true,default:today()},{name:'file',label:'Fichier',type:'file',accept:'.pdf,.png,.jpg,.jpeg,.gif,.webp,.docx',required:true}],
 onSubmit:async(v,form)=>{
   const file=form.elements.file.files[0];
   if(!file)throw new Error('Choisissez un document.');
   if(file.size>25*1024*1024)throw new Error('Le fichier dépasse 25 Mo.');
   const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
   try{
     const data=new FormData();data.append('file',file);data.append('title',v.title||file.name);data.append('date',v.date);
     await api('/api/patients/'+pid+'/documents',{method:'POST',body:data});
     toast('Document importé');await loadPatientDocuments(pid);
   }finally{if(submit)submit.disabled=false;}
 }});
}
async function loadPatientDocuments(pid){
 const list=$('#patient-doc-list');if(!list)return;
 const upload=$('#upload-patient-doc');if(upload)upload.onclick=()=>uploadPatientDocument(pid);
 try{
   const response=await api('/api/patients/'+pid+'/documents');
   if(!list.isConnected || String(S.patient?.id)!==String(pid))return;
   list.innerHTML=response.documents.length?response.documents.map(d=>`<button type="button" class="patient-doc-card" data-document-id="${d.id}"><span class="doc-format">${esc(d.extension.slice(1).toUpperCase())}</span><span><strong>${esc(d.title)}</strong><small>${fmtDate(d.document_date)} · ${Math.max(1,Math.round(d.size_bytes/1024))} Ko</small></span><span class="doc-open-label">Ouvrir</span></button>`).join(''):'<div class="empty">Aucun document importé</div>';
   list.querySelectorAll('[data-document-id]').forEach(button=>button.onclick=()=>{
     const doc=response.documents.find(d=>String(d.id)===button.dataset.documentId);if(doc)previewPatientDocument(pid,doc);
   });
 }catch(error){if(list.isConnected)list.innerHTML='<div class="empty">'+esc(error.message)+'</div>';}
}

async function patientDocumentResponse(path){
 const response=await fetch(API+path,{headers:{Authorization:'Bearer '+S.token},credentials:'same-origin'});
 if(response.status===401){logout(true);throw new Error('Session expirée.');}
 if(!response.ok){let message='Impossible d’ouvrir le document';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
 return response;
}
async function downloadPatientDocument(pid,doc,button){
 if(button)button.disabled=true;
 try{
   const response=await patientDocumentResponse('/api/patients/'+pid+'/documents/'+doc.id+'/download');
   const blob=await response.blob(),url=URL.createObjectURL(blob);
   const link=document.createElement('a');link.href=url;link.download=doc.original_name||doc.title||'document';
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(error){toast(error.message,true);}finally{if(button)button.disabled=false;}
}
async function previewPatientDocument(pid,doc){
 releasePatientDocUrl();
 const overlay=modal(`<div class="dialog-head"><h2>${esc(doc.title)}</h2><div class="doc-preview-actions"><button type="button" class="btn" id="download-doc-original">Télécharger</button><button type="button" class="icon-btn" id="close-doc-preview" aria-label="Fermer">✕</button></div></div><div class="document-preview-content"><div class="empty">Ouverture du document…</div></div>`, 'document-preview-dialog');
 $('#close-doc-preview',overlay).onclick=closeModal;
 const download=$('#download-doc-original',overlay);download.onclick=()=>downloadPatientDocument(pid,doc,download);
 const container=$('.document-preview-content',overlay);
 try{
   if(doc.extension==='.pdf'){
     const info=await api('/api/patients/'+pid+'/documents/'+doc.id+'/pdf-info');
     if(!container.isConnected)return;
     if(!info.pages)throw new Error('Ce PDF ne contient aucune page.');
     container.innerHTML=`<div class="pdf-local-toolbar"><button type="button" class="btn" data-prev>Précédente</button><span data-page-label></span><button type="button" class="btn" data-next>Suivante</button><button type="button" class="btn" data-zoom-out>−</button><button type="button" class="btn" data-zoom-in>+</button><span data-zoom-label>100 %</span></div><div class="pdf-local-stage"><div class="empty">Chargement de la page…</div></div>`;
     const stage=$('.pdf-local-stage',container),prev=$('[data-prev]',container),next=$('[data-next]',container);
     let page=1,zoom=1,busy=false;
     const update=()=>{
       prev.disabled=busy||page<=1;next.disabled=busy||page>=info.pages;
       $('[data-page-label]',container).textContent='Page '+page+' / '+info.pages;
       $('[data-zoom-label]',container).textContent=Math.round(zoom*100)+' %';
       const image=$('img',stage);if(image)image.style.width=Math.round(zoom*100)+'%';
     };
     const show=async target=>{
       if(busy||!container.isConnected)return;busy=true;update();
       try{
         const response=await patientDocumentResponse('/api/patients/'+pid+'/documents/'+doc.id+'/pdf-page/'+target);
         const blob=await response.blob();if(!container.isConnected)return;
         releasePatientDocUrl();patientDocObjectUrl=URL.createObjectURL(blob);
         const image=document.createElement('img');image.className='pdf-local-image';image.alt=doc.title+' — page '+target;image.src=patientDocObjectUrl;
         stage.replaceChildren(image);page=target;
       }catch(error){if(container.isConnected)toast(error.message,true);}finally{busy=false;if(container.isConnected)update();}
     };
     prev.onclick=()=>show(page-1);next.onclick=()=>show(page+1);
     $('[data-zoom-out]',container).onclick=()=>{zoom=Math.max(.5,zoom-.25);update();};
     $('[data-zoom-in]',container).onclick=()=>{zoom=Math.min(3,zoom+.25);update();};
     await show(1);
   }else{
     const response=await patientDocumentResponse('/api/patients/'+pid+'/documents/'+doc.id+'/preview');
     const blob=await response.blob();if(!container.isConnected)return;
     patientDocObjectUrl=URL.createObjectURL(blob);
     if(['.png','.jpg','.jpeg','.gif','.webp'].includes(doc.extension)){
       const image=document.createElement('img');image.className='patient-doc-image';image.alt=doc.title;image.src=patientDocObjectUrl;container.replaceChildren(image);
     }else{
       const frame=document.createElement('iframe');frame.title=doc.title;frame.className='patient-doc-frame';frame.setAttribute('sandbox','');frame.src=patientDocObjectUrl;container.replaceChildren(frame);
     }
   }
 }catch(error){if(container.isConnected)container.innerHTML='<div class="empty">'+esc(error.message)+'</div>';}
}


// AUTRE HORS CINETIQUE V4
// CORRECTIF BILANS PAR DATE V3

function simpleDecode(e){try{const p=JSON.parse(e.details||'');return p?.schema==='bilan-simple-v2'&&p.values?p:null;}catch{return null;}}
function simpleNumeric(v,key){
  let s=String(v??'').trim().replace(',','.');
  if(['GB','Plq'].includes(key)&&/^\d+(?:\.\d+)?k$/i.test(s))return Number(s.slice(0,-1))*1000;
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function simpleResult(p,key){
  const raw=p.values[key]||'';if(!raw)return '<span class="lab-missing">—</span>';
  const r=p.references?.[key]||{}, n=simpleNumeric(raw,key);
  let suffix='',abnormal=false;
  if(n!==null&&r.active){
    abnormal=(r.min!==null&&r.min!==undefined&&n<r.min)||(r.max!==null&&r.max!==undefined&&(r.max_exclusive?n>=r.max:n>r.max));
    
  }
  const note=r.active?'Référence indicative : '+(r.min??'—')+' à '+(r.max??'—')+' '+(r.unit||'')+(r.note?' — '+r.note:''):'Pas de référence active : âge absent ou hors profil adulte.';
  return `<span class="${abnormal?'lab-abnormal':''}" title="${esc(note)}">${esc(raw+suffix)}</span>`;
}
function simpleDates(entries){
 const last=entries[entries.length-1]?.date||'';
 return entries.map((e,i)=>{
   const d=e.date||'';
   if(i===entries.length-1||d.length!==10)return fmtDate(d);
   if(d.slice(0,7)===last.slice(0,7))return d.slice(8,10);
   if(d.slice(0,4)===last.slice(0,4))return d.slice(8,10)+'/'+d.slice(5,7);
   return fmtDate(d);
 });
}

function simpleMergeDates(entries){
 const byDate=new Map();
 for(const e of labChronology(entries)){
   const p=simpleDecode(e);if(!p)continue;
   let merged=byDate.get(e.date);
   if(!merged){merged={...e,details:JSON.stringify({...p,values:{},references:{}})};byDate.set(e.date,merged);}
   const target=simpleDecode(merged);
   for(const [key,value]of Object.entries(p.values||{})){
     if(String(value??'').trim()){
       target.values[key]=key==='Autre'&&target.values[key]?target.values[key]+'\n\n'+value:value;
       if(p.references?.[key])target.references[key]=p.references[key];
     }
   }
   merged.id=e.id;merged.details=JSON.stringify(target);
 }
 return [...byDate.values()];
}

function labKinetic(entries){
 const simple=simpleMergeDates((entries||[]).filter(simpleDecode));
 const series=simple.filter(e=>Object.entries(simpleDecode(e).values).some(([key,value])=>key!=='Autre'&&String(value??'').trim()));
 const old=(entries||[]).filter(e=>!simpleDecode(e));
 const v1=old.filter(labDecode),text=old.filter(e=>!labDecode(e));
 let olderHtml=v1.length?labKineticV1(v1):'';
 let html='';
 olderHtml+=sortByDate(text).map(e=>`<div class="item" data-eid="bilan:${e.id}"><span class="k">${fmtDate(e.date)} :</span>\n${esc(e.content)}${meta(e)}</div>`).join('');
 if(series.length){
   const last=series[series.length-1];
   const dateHtml=simpleDates(series).map((label,i)=>i===series.length-1?`<span class="bilan-recent-yellow">${esc(label)}</span>`:esc(label)).join(' <span class="simple-arrow">→</span> ');
   html+=`<div class="item bilan-simple" data-eid="bilan:${last.id}"><div class="simple-dates">${dateHtml}</div>`;
   for(const [label,keys]of LAB_GROUPS){
     if(keys.includes('Autre'))continue;
     if(!series.some(e=>keys.some(k=>simpleDecode(e).values[k])))continue;
     const values=series.map((e,i)=>{
       const p=simpleDecode(e);
       return keys.map(k=>{
         const rendered=simpleResult(p,k);
         return i===series.length-1&&p.values[k]?`<span class="bilan-recent-yellow">${rendered}</span>`:rendered;
       }).join('/');
     }).join(' <span class="simple-arrow">→</span> ');
     html+=`<div class="simple-line"><span class="simple-label">${esc(label)} :</span> ${values}</div>`;
   }
   html+='</div>';
 }
 const autres=simple.filter(e=>simpleDecode(e).values.Autre);
 if(autres.length){
   html+='<div class="simple-other-section">';
   for(const e of [...autres].reverse()){
     html+=`<div class="item" data-eid="bilan:${e.id}"><span class="k">Autre — ${esc(fmtDate(e.date))}</span><div style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:5px">${esc(simpleDecode(e).values.Autre)}</div></div>`;
   }
   html+='</div>';
 }
 return (html+olderHtml)||'<div class="empty">Aucun bilan</div>';
}
async function simpleBilanForm(entry){
 let cfg;try{cfg=await api('/api/bilans/reference');}catch(err){toast(err.message,true);return;}
 const p=entry?simpleDecode(entry):{values:{}};
 const references=p.references||cfg.parameters||{};
 const map=[];let index=0;
 const rows=LAB_GROUPS.map(([label,keys])=>{
   const inputs=keys.map(key=>{
     const n=index++;map.push([n,key]);const value=p.values[key]||'';
     const unit=references[key]?.unit||'';const text=['ECBU','Autre'].includes(key);
     const caption=(keys.length>1?key:label)+(unit?' ('+unit+')':'');
     return `<label class="simple-field">${esc(caption)}${text?`<textarea name="sv${n}">${esc(value)}</textarea>`:`<input name="sv${n}" inputmode="decimal" value="${esc(value)}" placeholder="${key==='Plq'?'196000 ou 196k':'Valeur'}" autocomplete="off">`}</label>`;
   }).join('');
   return `<div class="simple-form-row ${keys.length>1?'pair':''}">${inputs}</div>`;
 }).join('');
 const samePatient=labChronology((S.entries.bilan||[]).filter(simpleDecode));
 const picker=entry?`<label class="simple-picker">Prélèvement à modifier<select id="simple-picker">${samePatient.map(e=>`<option value="${e.id}" ${e.id===entry.id?'selected':''}>${esc(fmtDate(e.date))} — n° ${e.id}</option>`).join('')}</select></label>`:'';
 const note=S.patient?.age==null||S.patient.age<(cfg.minimum_age||19)?'Âge absent ou hors profil adulte : pas de signalement automatique.':'Références indicatives adultes : la couleur ne remplace pas le compte rendu du laboratoire.';
 const form=formModal({title:entry?'Modifier le bilan':'Nouveau bilan',fields:[{name:'date',label:'Date du prélèvement',type:'date',required:true}],values:{date:entry?.date||today()},
   extra:picker+`<div class="simple-form">${rows}</div><p class="simple-note">${esc(note)} Unités fixes indiquées dans les libellés, sans saisie d’unité ni de norme.</p>`,
   onSubmit:async(v,form)=>{
     const values={};for(const[n,key]of map)values[key]=form.elements['sv'+n].value.trim();
     if(!Object.values(values).some(Boolean))throw new Error('Renseignez au moins un résultat.');
     const content=LAB_GROUPS.filter(([,keys])=>keys.some(k=>values[k])).map(([label,keys])=>label+' : '+keys.map(k=>values[k]||'—').join('/')).join('\n');
     const body={kind:'bilan',date:v.date,content,details:JSON.stringify({schema:'bilan-simple-v2',values})};
     const pid=S.patient.id;
     if(entry)await api('/api/entries/'+entry.id,{method:'PUT',body});
     else await api('/api/patients/'+pid+'/entries',{method:'POST',body});
     toast('Bilan enregistré');await refresh();
   },onDelete:entry?async()=>{await api('/api/entries/'+entry.id,{method:'DELETE'});await refresh();}:null
 });
 form.querySelector('#simple-picker')?.addEventListener('change',event=>{
    const e=samePatient.find(e=>String(e.id)===event.target.value);if(e){closeModal();simpleBilanForm(e);}
 });
 const dateGrid=form.querySelector('.fgrid');
 if(dateGrid)form.insertBefore(dateGrid,form.firstChild);
 form.closest('.dialog')?.classList.add('simple-bilan-dialog');
}



const LAB_GROUPS = [["Alb", ["Alb"]], ["GB", ["GB"]], ["Hb", ["Hb"]], ["Plq", ["Plq"]], ["TP", ["TP"]], ["CRP", ["CRP"]], ["Lipase", ["Lipase"]], ["BT/BD", ["BT", "BD"]], ["GGT/PAL", ["GGT", "PAL"]], ["ASAT/ALAT", ["ASAT", "ALAT"]], ["Urée/Créat", ["Uree", "Creat"]], ["Na/K", ["Na", "K"]], ["ECBU", ["ECBU"]], ["ACE", ["ACE"]], ["CA19-9", ["CA19-9"]], ["CA125", ["CA125"]], ["CA15-3", ["CA15-3"]], ["Autre", ["Autre"]]];
const LAB_MULTI = new Set(['Lipase','BT','BD','GGT','PAL','ASAT','ALAT']);
function labDecode(e) {
  try {const p=JSON.parse(e.details||'');return p?.schema==='bilan-v1' && p.values && typeof p.values==='object' ? p : null;}catch{return null;}
}
function labNumber(v) {
  const text=String(v??'').trim().replace(',','.');
  if(!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))return null;
  const n=Number(text);return Number.isFinite(n)?n:null;
}
function labResult(row,key) {
  if(!row?.value)return '<span class="lab-missing">—</span>';
  const n=labNumber(row.value), lo=labNumber(row.min), hi=labNumber(row.max);
  const abnormal=!!row.unit && n!==null && ((lo!==null&&n<lo)||(hi!==null&&n>hi));
  let suffix='';
  
  return `<span class="${abnormal?'lab-abnormal':''}" title="${esc('Références : '+(row.min||'—')+' à '+(row.max||'—')+' '+(row.unit||''))}">${esc(row.value+suffix+(row.unit?' '+row.unit:''))}</span>`;
}
function labChronology(entries){return [...entries].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.id-b.id);}
function labKineticV1(entries) {
  const all=labChronology(entries||[]), structured=all.filter(labDecode), legacy=all.filter(e=>!labDecode(e));
  let html='';
  if(structured.length){
    html='<div class="lab-scroll"><table class="lab-kinetic"><thead><tr><th>Bilan</th>';
    structured.forEach((e,i)=>{html+=(i?'<th class="lab-arrow">→</th>':'')+`<th>${fmtDate(e.date)}<button type="button" class="lab-edit no-print" data-bilan-edit="${e.id}" aria-label="Modifier le bilan du ${esc(fmtDate(e.date))}" title="Modifier ce prélèvement">✎</button></th>`;});
    html+='</tr></thead><tbody>';
    for(const [label,keys] of LAB_GROUPS){
      if(!structured.some(e=>keys.some(k=>labDecode(e).values[k]?.value)))continue;
      html+=`<tr><th>${esc(label)}</th>`;
      structured.forEach((e,i)=>{const p=labDecode(e);html+=(i?'<td class="lab-arrow">→</td>':'')+'<td>'+keys.map(k=>labResult(p.values[k],k)).join(' / ')+'</td>';});
      html+='</tr>';
    }
    html+='</tbody></table></div><p class="lab-note">Valeurs anciennes → récentes. Références propres à chaque prélèvement. Unités affichées sans conversion.</p>';
  }
  if(legacy.length)html+='<details class="lab-legacy" '+(!structured.length?'open':'')+'><summary>Bilans anciens en texte libre ('+legacy.length+')</summary>'+legacy.map(e=>`<div class="item" data-eid="bilan:${e.id}"><span class="k">${fmtDate(e.date)} :</span><div style="white-space:pre-wrap">${esc(e.content)}</div></div>`).join('')+'</details>';
  return html||'<div class="empty">Aucun bilan</div>';
}
function bindLabTools(box){box.querySelectorAll('[data-bilan-edit]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const e=(S.entries.bilan||[]).find(e=>String(e.id)===b.dataset.bilanEdit);if(e)entryForm('bilan',e);});}
function structuredBilanForm(entry){
  const p=entry?labDecode(entry):{schema:'bilan-v1',values:{}};
  const fields=[{name:'date',label:'Date du prélèvement',type:'date',required:true}];
  let index=0;
  const mapping=[];
  const body=LAB_GROUPS.map(([label,keys])=>`<tr><th>${esc(label)}</th><td colspan="4">${keys.map(key=>{
    const n=index++;mapping.push([n,key]);const row=p.values[key]||{};
    const text=['ECBU','Autre'].includes(key);
    return `<div class="lab-input-row"><label>${keys.length>1?esc(key):'Résultat'}${text?`<textarea name="lv${n}" aria-label="${esc(key)}">${esc(row.value||'')}</textarea>`:`<input name="lv${n}" value="${esc(row.value||'')}" inputmode="decimal" aria-label="Valeur ${esc(key)}" placeholder="Valeur">`}</label>${text?'':`<label>Unité<input name="lu${n}" value="${esc(row.unit||'')}" aria-label="Unité ${esc(key)}" placeholder="Unité du compte rendu"></label><label>Norme min.<input name="ll${n}" value="${esc(row.min||'')}" inputmode="decimal" aria-label="Minimum ${esc(key)}"></label><label>Norme max.<input name="lh${n}" value="${esc(row.max||'')}" inputmode="decimal" aria-label="Maximum ${esc(key)}"></label>`}</div>`;
  }).join('')}</td></tr>`).join('');
  const form=formModal({title:entry?'Modifier le bilan':'Nouveau bilan',fields,values:{date:entry?.date||today()},
    extra:`${p.legacy_original?`<details><summary>Texte original — vérifier la conversion avant enregistrement</summary><pre style="white-space:pre-wrap">${esc(p.legacy_original)}</pre></details>`:''}<p class="lab-note">Renseignez les valeurs dans les unités du compte rendu. Les normes restent vides par défaut : sans référence, pas de coloration ni de multiples N. Pour un résultat non numérique (ex. &lt;5), aucune interprétation automatique. Les normes doivent être adaptées au laboratoire et au patient.</p><div class="lab-form-scroll"><table class="lab-form-table">${body}</table></div>`,
    onSubmit:async(v,form)=>{
      const values={};
      for(const [n,key] of mapping){
        const read=prefix=>form.elements[prefix+n]?.value.trim()||'';
        const row={value:read('lv'),unit:read('lu'),min:read('ll'),max:read('lh')};
        for(const name of ['min','max'])if(row[name]&&labNumber(row[name])===null)throw new Error('Référence invalide pour '+key);
        const lo=labNumber(row.min),hi=labNumber(row.max);
        if(lo!==null&&hi!==null&&lo>hi)throw new Error('Minimum supérieur au maximum pour '+key);
        if((row.min||row.max)&&!row.unit)throw new Error('Précisez l’unité pour '+key);
        values[key]=row;
      }
      if(!Object.values(values).some(r=>r.value))throw new Error('Renseignez au moins un résultat.');
      const content=LAB_GROUPS.filter(([,keys])=>keys.some(k=>values[k].value)).map(([label,keys])=>label+' : '+keys.map(k=>values[k].value||'—').join('/')).join('\n');
      const body={kind:'bilan',date:v.date,content,details:JSON.stringify({schema:'bilan-v1',values,...(p.legacy_original?{legacy_original:p.legacy_original}:{})})};
      if(entry)await api('/api/entries/'+entry.id,{method:'PUT',body});
      else await api('/api/patients/'+S.patient.id+'/entries',{method:'POST',body});
      toast('Bilan enregistré');await refresh();
    },
    onDelete:entry?async()=>{await api('/api/entries/'+entry.id,{method:'DELETE'});await refresh();}:null
  });
  form.closest('.dialog')?.classList.add('lab-dialog');
}


// COMPTEUR POSTOPERATOIRE AUTOMATIQUE
function postOpLabel(c) {
  if (c.category !== 'Gestes faits') return String(c.content || '');
  const dayNumber = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const y=Number(match[1]), m=Number(match[2]), d=Number(match[3]);
    const t=new Date(0);t.setUTCFullYear(y,m-1,d);t.setUTCHours(0,0,0,0);
    if(t.getUTCFullYear()!==y || t.getUTCMonth()!==m-1 || t.getUTCDate()!==d)return null;
    return t.getTime()/86400000;
  };
  const start=dayNumber(c.date), end=dayNumber(today());
  if(start===null || end===null)return String(c.content || '') + ' — date du geste à renseigner';
  if(end<start)return String(c.content || '') + ' — geste prévu le ' + fmtDate(c.date);
  const text=String(c.content || '').replace(/^\s*J\s*\d+\s*(?:post\b\s*)?/i,'').replace(/^\s*post\b\s*/i,'').trim();
  return 'J' + Math.round(end-start) + ' post ' + text;
}
function refreshPostOpLabels(){
  if(!S.token || !S.entries)return;
  document.querySelectorAll('[data-postop-id]').forEach(el=>{
    const entry=(S.entries.clinique || []).find(c=>String(c.id)===el.dataset.postopId);
    if(entry)el.textContent=postOpLabel(entry);
  });
}
setInterval(refreshPostOpLabels,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPostOpLabels();});


async function downloadTableauWord() {
  const button = document.querySelector('[data-act="tableau"]');
  if (button) button.disabled = true;
  try {
    toast('Génération du tableau Word…');
    const response = await fetch(API + '/api/tableau/word', {headers:{Authorization:'Bearer ' + S.token}, credentials:'same-origin'});
    if (response.status === 401) {logout(true); throw new Error('Session expirée');}
    if (!response.ok) {
      let message = 'Impossible de générer le tableau';
      try {message = (await response.json()).error || message;} catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const match = (response.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/);
    link.download = match ? match[1].trim() : 'Tableau_service.docx';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('Tableau Word téléchargé');
  } catch (error) {toast(error.message, true);}
  finally {if(button)button.disabled=false;}
}


// Base API : vide quand Flask sert le site ; remplacé par le proxy lors d'un déploiement de prévisualisation
const API = '__PORT_8000__'.startsWith('__') ? '' : '__PORT_8000__';

const S = { token: null, user: null, meta: null, patient: null, entries: null, expanded: new Set() };
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

// ------------------------------------------------------------------ utils
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let clock = {offset_minutes:0, epoch_ms:Date.now(), synced:performance.now()};
const clockDate = () => new Date(clock.epoch_ms + performance.now()-clock.synced + clock.offset_minutes*60000);
const today = () => clockDate().toISOString().slice(0,10);
async function syncClock() {clock={...await api('/api/clock'), synced:performance.now()};}
const fmtDate = (d) => { if (!d) return ''; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : d; };
const fmtTs = (t) => { if (!t) return ''; const [d, h] = t.split(' '); return `${fmtDate(d)} ${h ? h.slice(0, 5) : ''}`; };
const bedLabel = (p) => p.room ? `${p.room}${p.position || ''}` : (p.hors_service ? 'Hors service' : '—');

function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = ''), 2600);
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let body = opts.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const res = await fetch(API + path, { method: opts.method || 'GET', headers, body, credentials: 'same-origin' });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && path !== '/api/login') { logout(true); throw new Error(data.error || 'Session expirée'); }
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ------------------------------------------------------------------ icons
const I = {
  menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  logout: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  cross: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" rx="2"/></svg>',
  bed: (s = 28) => `<svg width="${s}" height="${s * .75}" viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18M3 15h26v6M29 15v-3a3 3 0 0 0-3-3H14v6"/><circle cx="8.5" cy="10" r="2.3"/></svg>`,
  bigBed: '<svg width="124" height="90" viewBox="0 0 124 90" fill="none"><rect x="4" y="6" width="7" height="80" rx="3" fill="#1d62a0"/><rect x="113" y="50" width="7" height="36" rx="3" fill="#1d62a0"/><rect x="4" y="54" width="116" height="8" rx="3" fill="#1d62a0"/><circle cx="30" cy="31" r="10" fill="#1d62a0"/><rect x="16" y="42" width="30" height="10" rx="4" fill="#7ac4bf"/><path d="M50 30h52a14 14 0 0 1 14 14v8H50z" fill="#1d62a0"/></svg>',
  folder: '<svg width="44" height="40" viewBox="0 0 24 22" fill="none" stroke="#1b2b3c" stroke-width="1.6" stroke-linejoin="round"><path d="M2 5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2"/><path d="M2 5v13a1 1 0 0 0 1 1h16l3-9H6l-3 8"/></svg>',
  hosp: '<svg width="36" height="32" viewBox="0 0 36 32" fill="none" stroke="#1d4673" stroke-width="2.2" stroke-linejoin="round"><path d="M4 30V12L18 3l14 9v18z"/><path d="M18 9v8M14 13h8" stroke-linecap="round"/><path d="M8 30v-6h20v6M8 24h20" /></svg>',
  plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  chev: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9fb0c4" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M6 14l6 6 6-6"/></svg>',
  up: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M6 10l6-6 6 6"/></svg>',
  arrL: '<svg viewBox="0 0 52 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M50 15H4M16 3L4 15l12 12"/></svg>',
  arrR: '<svg viewBox="0 0 52 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15h46M36 3l12 12-12 12"/></svg>',
  arrU: '<svg viewBox="0 0 30 52" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 50V4M3 16L15 4l12 12"/></svg>',
};

// ------------------------------------------------------------------ auth
function logout(silent) {
  if (S.token && !silent) api('/api/logout', { method: 'POST' }).catch(() => {});
  S.token = null; S.user = null; S.meta = null; S.patient = null; S.entries = null; store.set('cva_token', null);
  closeModal(); location.hash = '#/login'; render();
}

function viewLogin() {
  $('#app').innerHTML = `
  <main class="login">
    <img src="./static/logo.png" alt="Chirurgie Viscérale A — CHU Oujda" width="657" height="259">
    <section class="login-card" aria-labelledby="lg">
      <h1 id="lg">LOGIN</h1>
      <form id="login-form" autocomplete="on">
        <input class="pill" name="username" placeholder="Username" aria-label="Nom d'utilisateur" autocomplete="username" required>
        <input class="pill" name="password" type="password" placeholder="Password" aria-label="Mot de passe" autocomplete="current-password" required>
        <div class="login-err" id="login-err"></div>
        <button class="btn-login" type="submit">LOG IN</button>
      </form>
    </section>
    
  </main>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#login-err').textContent = '';
    try {
      const r = await api('/api/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
      S.token = r.token; S.user = r.user; store.set('cva_token', r.token);
      location.hash = '#/home';
    } catch (err) { $('#login-err').textContent = err.message; }
  });
}

// ------------------------------------------------------------------ chrome
function topbar() {
  return `
  <header class="topbar no-print">
    <div class="left">
      <button class="icon-btn" id="menu-btn" aria-label="Menu">${I.menu}</button>
      <span class="clock" id="clock"></span>
    </div>
    <h1>Chirurgie viscérale A</h1>
    <div class="right">
      <div class="search-box">
        <input id="search" type="search" placeholder="Rechercher nom / IP" aria-label="Rechercher un patient" autocomplete="off">
        <div class="search-res hidden" id="search-res"></div>
      </div>
      <span class="username">${esc(S.user?.username || '')}</span>
      <button class="icon-btn" id="logout-btn" aria-label="Se déconnecter" title="Se déconnecter">${I.logout}</button>
    </div>
  </header>
  <nav class="menu-panel" id="menu">
    <button data-go="#/home">Plan du service</button>
    <button data-act="tableau">Tableau de Visite</button>
    <button data-act="admit">Admettre un patient</button>
    <button data-act="hs">Dossiers hors service</button>
    <button data-go="#/archives">Patients sortis (archives)</button>
    <button data-go="#/patients-a-staffer">Patients à staffer</button>
    ${S.user?.role === 'admin' ? '<div class="sep"></div><button data-go="#/users">Utilisateurs</button><button data-go="#/journal">Journal global</button><button data-act="clock">Date et heure</button>' : ''}
    <div class="sep"></div>
<button data-act="logout">Se déconnecter</button>
  </nav>`;
}

function bindChrome() {
  if(S.user?.role!=='admin')document.querySelectorAll('[data-go="#/journal"]').forEach(button=>button.remove());
  const tick = () => { const c = $('#clock'); if (!c) return; const d = clockDate(); c.textContent = `${d.toLocaleDateString('fr-FR',{timeZone:'UTC'})}   ${d.toLocaleTimeString('fr-FR', {timeZone:'UTC', hour:'2-digit', minute:'2-digit'})} UTC${clock.offset_minutes ? ' (corrigé)' : ''}`; };
  tick(); clearInterval(bindChrome._i); bindChrome._i = setInterval(tick, 15000);
  $('#logout-btn').onclick = () => logout();
  const menu = $('#menu');
  $('#menu-btn').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
  document.onclick = (e) => {
    if (!menu.contains(e.target)) menu.classList.remove('open');
    if (!e.target.closest('.search-box')) $('#search-res')?.classList.add('hidden');
  };
  menu.querySelectorAll('button').forEach(b => b.onclick = () => {
    menu.classList.remove('open');
    if (b.dataset.go) location.hash = b.dataset.go;
    if (b.dataset.act === 'admit') admitForm({});
    if (b.dataset.act === 'hs') openHorsService();
    if (b.dataset.act === 'logout') logout();
    if (b.dataset.act === 'tableau') downloadTableauWord();
    if (b.dataset.act === 'profile') profileForm();
    if (b.dataset.act === 'clock') clockForm();
  });
  const inp = $('#search'), res = $('#search-res');
  let t;
  inp.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = inp.value.trim();
      if (q.length < 2) { res.classList.add('hidden'); return; }
      const r = await api('/api/search?q=' + encodeURIComponent(q));
      res.innerHTML = r.patients.length ? r.patients.map(p => `<button data-id="${p.id}"><b>${esc(p.nom)} ${esc(p.prenom)}</b> <small>IP ${esc(p.ip)} · ${p.status === 'sorti' ? 'Sorti' : esc(bedLabel(p))}</small><br><small>${esc(p.motif)}</small></button>`).join('') : '<div class="empty">Aucun résultat</div>';
      res.classList.remove('hidden');
      res.querySelectorAll('button').forEach(b => b.onclick = () => { res.classList.add('hidden'); inp.value = ''; location.hash = `#/patient/${b.dataset.id}/maj`; });
    }, 220);
  };
}

// ------------------------------------------------------------------ home
const LAYOUT = { tl: ['213', '212', '211', '210'], tr: ['209', '208', '207', '206'], bl: ['214', '215', '216', '217', '218'], br: ['201', '202', '203', '204', '205'] };

async function viewHome() {
  $('#app').innerHTML = topbar() + `<main class="home"><div class="map" id="map"><div class="empty">Chargement du plan…</div></div></main>`;
  bindChrome();
  const r = await api('/api/rooms');
  const by = Object.fromEntries(r.rooms.map(x => [x.room, x]));
  const roomBtn = (n) => {
    const b = by[n].beds, c = (b.F ? 1 : 0) + (b.P ? 1 : 0);
    return `<button class="room ${c ? 'occ' : ''}" data-room="${n}" aria-label="Chambre ${n}, ${c} patient(s) sur 2">
      <span class="cnt">${c}/2</span><span>CH ${n}</span><span class="cross">${I.cross}</span><span>${I.bed(28)}</span></button>`;
  };
  $('#map').innerHTML = `
    <section class="wing top">
      <div class="rooms">${LAYOUT.tl.map(roomBtn).join('')}</div>
      <button class="hs-table" id="hs-btn" aria-label="Table des dossiers hors service">
        <span>dossiers hors-service</span>
        <div class="tbl">${I.folder}${r.hors_service_count ? `<span class="badge">${r.hors_service_count}</span>` : ''}</div>
      </button>
      <div class="rooms">${LAYOUT.tr.map(roomBtn).join('')}</div>
    </section>
    <div class="corridor-h" aria-hidden="true">${I.arrL}${I.arrR}</div>
    <section class="bottom">
      <div class="rooms">${LAYOUT.bl.map(roomBtn).join('')}</div>
      <div class="corridor-v" aria-hidden="true">${I.arrU}</div>
      <div class="rooms">${LAYOUT.br.map(roomBtn).join('')}</div>
    </section>
    <div class="legend"><span><b style="background:var(--teal-tint)"></b>Chambre occupée</span><span><b style="background:#f3f5f9"></b>Chambre libre</span></div>`;
  $('#map').querySelectorAll('.room').forEach(b => b.onclick = () => openRoom(b.dataset.room, by[b.dataset.room]));
  $('#hs-btn').onclick = openHorsService;
}

// ------------------------------------------------------------------ modals
function closeModal() { stopImagingPlayer(); releasePatientDocUrl(); $('#modal-root').innerHTML = ''; document.onkeydown = null; }
function modal(html, cls = '') {
  $('#modal-root').innerHTML = `<div class="overlay" id="ov"><div class="dialog ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  const ov = $('#ov');
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeModal(); });
  document.onkeydown = (e) => { if (e.key === 'Escape') closeModal(); };
  return ov;
}

function bedCard(p, label, isLoc, emptyAction) {
  if (!p) return `<button class="bed empty" data-empty="${esc(emptyAction)}">
      <div class="bed-ico">${label ? `<b>${esc(label)}</b>` : ''}${I.bigBed}</div>
      <div class="bed-info">Lit libre<br><small>Cliquer pour admettre un patient</small></div>
      <div class="bed-go"><div class="row">${I.plus}</div>Admettre</div></button>`;
  return `<button class="bed" data-pid="${p.id}">
      <div class="bed-ico ${isLoc ? 'loc' : ''}">${isLoc ? esc(label) : `<b>${esc(label)}</b>${I.bigBed}`}</div>
      <div class="bed-info">Patient : ${esc(p.nom)} ${esc(p.prenom)}<br>IP : ${esc(p.ip)}<br>Motif : ${esc(p.motif)}</div>
      <div class="bed-go"><div class="row">${I.bed(58)}${I.chev}</div>Cliquer pour voir<br>la fiche</div></button>`;
}

function bindBeds(ov) {
  ov.querySelectorAll('.bed[data-pid]').forEach(b => b.onclick = () => { closeModal(); location.hash = `#/patient/${b.dataset.pid}/maj`; });
  ov.querySelectorAll('.bed[data-empty]').forEach(b => b.onclick = () => {
    const [room, position] = b.dataset.empty.split('|');
    room === 'HS' ? admitForm({ hors_service: ' ' }) : admitForm({ room, position });
  });
  ov.querySelector('.btn-back').onclick = closeModal;
}

function openRoom(n, data) {
  const ov = modal(`
    <div class="dialog-head"><div><h2>CHAMBRE ${esc(n)} ${I.hosp}</h2><p>Détails de la chambre</p></div>
      <button class="btn-back">&lt; Retour à l'accueil</button></div>
    <div class="dialog-body">${bedCard(data.beds.F, 'F', false, `${n}|F`)}${bedCard(data.beds.P, 'P', false, `${n}|P`)}</div>`);
  bindBeds(ov);
}

async function openHorsService() {
  const r = await api('/api/hors-service');
  const ov = modal(`
    <div class="dialog-head"><div><h2>Hors Service ${I.hosp}</h2><p>Patients hébergés dans d'autres services</p></div>
      <button class="btn-back">&lt; Retour à l'accueil</button></div>
    <div class="dialog-body">${r.patients.map(p => bedCard(p, p.hors_service, true)).join('') || '<div class="empty">Aucun patient hors service.</div>'}
      ${bedCard(null, '', false, 'HS|')}</div>`);
  bindBeds(ov);
}

/* Formulaire générique : fields = [{name,label,type,options,full,required,placeholder}] */
function formModal({ title, fields, values = {}, submit = 'Enregistrer', onSubmit, onDelete, extra = '' }) {
  const fld = (f) => {
    const v = values[f.name] ?? f.default ?? '';
    let input;
    if (f.type === 'textarea') input = `<textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>${esc(v)}</textarea>`;
    else if (f.type === 'select') input = `<select name="${f.name}" ${f.required ? 'required' : ''}>${f.options.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
    else if (f.type === 'datalist') input = `<input name="${f.name}" list="dl-${f.name}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}><datalist id="dl-${f.name}">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
    else if (f.type === 'checkbox') input = `<label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:15px;color:var(--ink);font-weight:500"><input type="checkbox" name="${f.name}" style="width:auto" ${v ? 'checked' : ''}> ${esc(f.hint || '')}</label>`;
    else if (f.type === 'file') input = `<input type="file" name="${f.name}" accept="${esc(f.accept || '')}">`;
    else input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>`;
    return `<div class="field ${f.full ? 'full' : ''}" data-f="${f.name}"><label>${esc(f.label)}</label>${input}</div>`;
  };
  const ov = modal(`
    <div class="dialog-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <form class="dialog-body" id="mform" novalidate>
      ${extra}
      <div class="fgrid">${fields.map(fld).join('')}</div>
      <div class="form-err" id="ferr"></div>
      <div class="form-actions">
        ${onDelete ? '<button type="button" class="btn danger" data-del>Supprimer</button>' : ''}
        <div class="r"><button type="button" class="btn" data-close>Annuler</button><button class="btn primary" type="submit">${esc(submit)}</button></div>
      </div>
    </form>`, 'form-dialog');
  ov.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
  const form = $('#mform');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const out = {};
    fields.forEach(f => {
      const el = form.elements[f.name];
      if (!el) return;
      out[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'file' ? el.files[0] : el.value;
    });
    const miss = fields.find(f => f.required && !String(out[f.name] ?? '').trim());
    if (miss) { $('#ferr').textContent = `Champ obligatoire : ${miss.label}`; return; }
    try { await onSubmit(out, form); closeModal(); } catch (err) { $('#ferr').textContent = err.message; }
  };
  if (onDelete) ov.querySelector('[data-del]').onclick = async () => {
    if (!confirm('Confirmer la suppression ?')) return;
    try { await onDelete(); closeModal(); } catch (err) { $('#ferr').textContent = err.message; }
  };
  setTimeout(() => form.querySelector('input:not([type=checkbox]),textarea,select')?.focus(), 50);
  return form;
}

// Emplacement : chambre+lit ou hors service
function locationFields(meta) {
  return [
    { name: 'loc_type', label: 'Emplacement', type: 'select', options: [['room', 'Chambre du service'], ['hs', 'Hors service (hébergé ailleurs)']] },
    { name: 'room', label: 'Chambre', type: 'select', options: [['', '—'], ...meta.rooms.map(r => [r, 'CH ' + r])] },
    { name: 'position', label: 'Lit', type: 'select', options: [['', '—'], ['F', 'F — côté fenêtre'], ['P', 'P — côté porte']] },
    { name: 'hors_service', label: 'Service d\'hébergement', type: 'datalist', full: true, placeholder: 'ex. Service Réanimation Brûlés BOX 2', options: ['Service Réanimation Brûlés', 'Service HGE', 'Réanimation chirurgicale', 'Réanimation médicale', 'Urgences', 'Cardiologie', 'Néphrologie'] },
  ];
}
function bindLocToggle(form) {
  const sync = () => {
    const hs = form.elements.loc_type.value === 'hs';
    ['room', 'position'].forEach(n => form.querySelector(`[data-f=${n}]`).classList.toggle('hidden', hs));
    form.querySelector('[data-f=hors_service]').classList.toggle('hidden', !hs);
  };
  form.elements.loc_type.onchange = sync; sync();
}
function locPayload(v) {
  return v.loc_type === 'hs' ? { hors_service: v.hors_service.trim(), room: null, position: null } : { hors_service: '', room: v.room, position: v.position };
}

function admitForm(pre) {
  const m = S.meta;
  const values = { ...pre, loc_type: pre.hors_service ? 'hs' : 'room', hors_service: (pre.hors_service || '').trim(), date_entree: today() };
  const form = formModal({
    title: 'Admettre un patient',
    submit: 'Admettre',
    values,
    fields: [
      { name: 'nom', label: 'Nom', required: true }, { name: 'prenom', label: 'Prénom' },
      { name: 'age', label: 'Âge', type: 'number' }, { name: 'ip', label: 'IP', required: true },
      { name: 'mutuelle', label: 'Mutuelle', type: 'select', options: m.mutuelles }, { name: 'groupe', label: 'Groupe sanguin', type: 'select', options: m.groupes },
      { name: 'motif', label: 'Motif d\'hospitalisation', full: true, placeholder: 'ex. AVP, Cholécystectomie…' },
      { name: 'date_entree', label: 'Date d\'entrée', type: 'date' },
      ...locationFields(m),
    ],
    onSubmit: async (v) => {
      if (v.loc_type === 'hs' && !v.hors_service.trim()) throw new Error('Indiquez le service d\'hébergement.');
      if (v.loc_type === 'room' && (!v.room || !v.position)) throw new Error('Choisissez la chambre et le lit.');
      const { loc_type, ...rest } = v;
      const r = await api('/api/patients', { method: 'POST', body: { ...rest, ...locPayload(v) } });
      toast('Patient admis'); location.hash = `#/patient/${r.id}/maj`;
    },
  });
  bindLocToggle(form);
}

// ------------------------------------------------------------------ patient
const TABS = [["maj", "MAJ"], ["obsrv", "OBSERVATION + DOCS"], ["ttt", "TRAITEMENT"], ["videos", "VIDEOS"], ["autres", "AUTRES"], ["sortie", "SORTIE"], ["logs", "LOGS"]];
function visiblePatientTabs(){return TABS.filter(([key])=>key!=='logs'||S.user?.role==='admin');}

const EXAM_TYPES = ['TDM', 'IRM', 'Bili-IRM', 'Échographie', 'Radiographie', 'Coloscopie', 'FOGD', 'Écho-endoscopie', 'CPRE', 'Anapath', 'Cytologie', 'Scintigraphie', 'Autre'];
const CLIN_CATS = ['Gestes faits', 'Surveillance clinique', 'Constantes', 'Drains'];
const ATCD_CATS = ['Médicaux', 'Chirurgicaux', 'Gynéco-obstétricaux', 'Toxiques', 'Allergies', 'Familiaux'];
const SPECIALITES = ['Anesthésie-Réanimation', 'Réanimation médicale', 'Réanimation chirurgicale', 'Médecine intensive', 'Médecine d’urgence', 'Médecine interne', 'Médecine générale', 'Cardiologie', 'Rythmologie', 'Cardiologie interventionnelle', 'Pneumologie', 'Gastro-entérologie', 'Hépatologie', 'Néphrologie', 'Endocrinologie', 'Diabétologie', 'Nutrition', 'Neurologie', 'Rhumatologie', 'Dermatologie', 'Allergologie', 'Immunologie clinique', 'Hématologie', 'Oncologie médicale', 'Radiothérapie', 'Maladies infectieuses', 'Gériatrie', 'Pédiatrie', 'Néonatologie', 'Psychiatrie', 'Pédopsychiatrie', 'Médecine physique et réadaptation', 'Médecine de la douleur', 'Soins palliatifs', 'Médecine du travail', 'Médecine du sport', 'Médecine légale', 'Santé publique', 'Chirurgie générale', 'Chirurgie viscérale et digestive', 'Chirurgie hépatobiliaire et pancréatique', 'Chirurgie colorectale', 'Chirurgie oncologique', 'Chirurgie thoracique', 'Chirurgie cardiovasculaire', 'Chirurgie vasculaire', 'Chirurgie orthopédique et traumatologique', 'Neurochirurgie', 'Chirurgie pédiatrique', 'Chirurgie plastique et reconstructrice', 'Chirurgie maxillo-faciale', 'Chirurgie orale', 'Urologie', 'Gynécologie-Obstétrique', 'Gynécologie', 'Obstétrique', 'Ophtalmologie', 'ORL', 'Radiologie', 'Radiologie interventionnelle', 'Médecine nucléaire', 'Anatomie et cytologie pathologiques', 'Biologie médicale', 'Microbiologie', 'Biochimie', 'Génétique médicale', 'Pharmacologie clinique', 'Autre'];

async function loadPatient(id) {
  const r = await api('/api/patients/' + id);
  S.patient = r.patient; S.entries = r.entries;
}

async function viewPatient(id, tab) {
  if(!visiblePatientTabs().some(([key])=>key===tab)){location.hash='#/patient/'+id+'/maj';return;}
  if (!S.patient || String(S.patient.id) !== String(id) || !$('#pmain')) {
    $('#app').innerHTML = topbar() + `<main class="patient"><div class="empty">Chargement du dossier…</div></main>`;
    bindChrome();
    await loadPatient(id);
  }
  const p = S.patient;
  $('#app').querySelector('main').outerHTML = `
  <main class="patient" id="pmain">
    <div class="tabsbar no-print">
      <button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button>
      <nav class="tabs" role="tablist">${visiblePatientTabs().map(([k, l]) => `<button class="tab ${k === tab ? 'active' : ''}" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l}</button>`).join('')}</nav>
    </div>
    <div class="pbody">
      <aside class="consignes no-print">
        <div class="col-head">CONSIGNES <button class="plus" id="add-cons" aria-label="Ajouter une consigne">${I.plus}</button></div>
        <div class="cons-list" id="cons-list"></div>
      </aside>
      <section class="main">
        <div class="idbar">
          <div class="ids">
            <span><b>${esc(p.nom)} ${esc(p.prenom)}</b></span>
            <span>${p.age != null ? esc(p.age) + ' ans' : '— ans'}</span>
            <span>IP : ${esc(p.ip)}</span>
            <span>${esc(p.mutuelle || '—')}</span>
            <span>${esc(p.groupe || '—')}</span>
            ${p.status === 'sorti' ? '<span class="status-pill">Sorti</span>' : ''}
            <button class="plus edit no-print" id="edit-id" aria-label="Modifier l'identité et l'emplacement" title="Modifier identité / emplacement">${I.plus}</button>
          </div>
          <div class="roomno">${p.status === 'sorti' ? 'Sorti' : p.room ? esc(p.room + (p.position || '')) : `<small>${esc(p.hors_service)}</small>`}</div>
        </div>
        <div id="tab-content" style="min-height:0;display:grid"></div>
      </section>
    </div>
  </main>`;
  $('#home-btn').onclick = () => (location.hash = '#/home');
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => (location.hash = `#/patient/${p.id}/${b.dataset.tab}`));
  $('#add-cons').onclick = () => entryForm('consigne');
  $('#edit-id').onclick = editIdentity;
  renderConsignes();
  renderTab(tab);
}

async function refresh() {
  await loadPatient(S.patient.id);
  const tab = (location.hash.split('/')[3]) || 'maj';
  viewPatient(S.patient.id, tab);
}

function renderConsignes() {
  const list = S.entries.consigne || [];
  const todo = list.filter(c => !c.done), done = list.filter(c => c.done);
  const row = (c) => `<div class="cons ${c.done ? 'done' : 'todo'}"><input type="checkbox" data-id="${c.id}" ${c.done ? 'checked' : ''} aria-label="Valider la consigne"><span class="txt" data-edit="${c.id}">${esc(c.content)}<small>${fmtDate(c.updated_at)}</small></span></div>`;
  $('#cons-list').innerHTML = (todo.map(row).join('') || '<div class="empty">Aucune consigne à faire</div>') + (done.length ? `<div class="cons-sep">VALIDÉES (${done.length})</div>` + done.map(row).join('') : '');
  $('#cons-list').querySelectorAll('input').forEach(i => i.onchange = async () => {
    await api('/api/entries/' + i.dataset.id, { method: 'PUT', body: { done: i.checked } });
    toast(i.checked ? 'Consigne validée' : 'Consigne remise à faire'); refresh();
  });
  $('#cons-list').querySelectorAll('[data-edit]').forEach(s => s.onclick = () => entryForm('consigne', list.find(c => String(c.id) === s.dataset.edit)));
}

const ENTRY_DEF = {
  consigne: { t: 'consigne', f: [{ name: 'content', label: 'Consigne', full: true, required: true, placeholder: 'ex. DEMANDER BILAN' }, { name: 'done', label: 'Statut', type: 'checkbox', hint: 'Déjà faite (validée)', full: true }] },
  atcd: { t: 'antécédent', f: [{ name: 'category', label: 'Catégorie', type: 'select', options: ATCD_CATS }, { name: 'content', label: 'Antécédent', type: 'textarea', full: true, required: true }] },
  clinique: { t: 'élément clinique', f: [{ name: 'category', label: 'Catégorie', type: 'select', options: CLIN_CATS }, { name: 'date', label: 'Date', type: 'date', default: today() }, { name: 'content', label: 'Contenu', type: 'textarea', full: true, required: true, placeholder: 'ex. TA 12/8 - FC 80 - T° 37.2 / Drain : 50 cc séreux' }] },
  bilan: { t: 'bilan', f: [{ name: 'date', label: 'Date du bilan', type: 'date', default: today(), required: true }, { name: 'content', label: 'Résultats (une ligne par paramètre)', type: 'textarea', full: true, required: true, placeholder: 'Alb : 34\nGB : 6660\nHB : 13.1\nPlq : 196k\nTP : 74\nCRP : 40' }] },
  examen: { t: 'examen complémentaire', f: [{ name: 'category', label: 'Type', type: 'select', options: EXAM_TYPES }, { name: 'date', label: 'Date', type: 'date', default: today(), required: true }, { name: 'title', label: 'Intitulé / lieu', full: true, placeholder: 'ex. TDM TAP — CHU Oujda' }, { name: 'content', label: 'Conclusion', type: 'textarea', full: true, required: true }, { name: 'details', label: 'Détails du compte rendu', type: 'textarea', full: true }] },
  avis: { t: 'avis spécialisé', f: [{ name: 'category', label: 'Spécialité', type: 'datalist', options: SPECIALITES, required: true }, { name: 'date', label: 'Date', type: 'date', default: today(), required: true }, { name: 'content', label: 'Avis', type: 'textarea', full: true, required: true }] },
  observation: { t: 'observation', f: [{ name: 'date', label: 'Date', type: 'date', default: today(), required: true }, { name: 'title', label: 'Titre (optionnel)', placeholder: 'ex. J2 post-op' }, { name: 'content', label: 'Observation', type: 'textarea', full: true, required: true }] },
  traitement: { t: 'traitement', f: [{ name: 'title', label: 'Médicament', required: true }, { name: 'category', label: 'Classe', type: 'datalist', options: ['Antibiotique', 'Antalgique', 'Anticoagulant', 'IPP', 'Antiémétique', 'Solutés', 'Insuline', 'Antihypertenseur', 'Autre'] }, { name: 'content', label: 'Posologie / voie', full: true, required: true, placeholder: 'ex. 1 g x 3/j IV' }, { name: 'date', label: 'Date de début', type: 'date', default: today() }, { name: 'done', label: 'Statut', type: 'checkbox', hint: 'Traitement arrêté' }, { name: 'details', label: 'Remarques', type: 'textarea', full: true }] },
  video: { t: 'vidéo', f: [{ name: 'title', label: 'Titre', required: true, placeholder: 'ex. Cholécystectomie cœlioscopique' }, { name: 'date', label: 'Date', type: 'date', default: today() }, { name: 'content', label: 'Lien (URL) de la vidéo', full: true, placeholder: 'https://… (ou importer un fichier ci-dessous)' }, { name: 'file', label: 'Ou importer un fichier (mp4, webm, mov, image)', type: 'file', accept: 'video/*,image/*', full: true }, { name: 'details', label: 'Description', type: 'textarea', full: true }] },
};

function entryForm(kind, entry, preset = {}) {
  if(kind==='video'){imagingForm(entry);return;}
  if(kind==='traitement'){treatmentForm(entry);return;}
  if (kind === 'bilan' && (!entry || simpleDecode(entry))) {simpleBilanForm(entry);return;}
  if (kind === 'bilan' && entry && labDecode(entry)) {structuredBilanForm(entry);return;}
  const def = ENTRY_DEF[kind];
  formModal({
    title: (entry ? 'Modifier ' : 'Ajouter ') + def.t,
    fields: def.f.filter(f => !(entry && f.type === 'file')),
    values: entry || preset,
    onSubmit: async (v) => {
      if (kind === 'video' && v.file) {
        const fd = new FormData(); fd.append('file', v.file); fd.append('title', v.title); fd.append('date', v.date); fd.append('details', v.details || '');
        await api(`/api/patients/${S.patient.id}/upload`, { method: 'POST', body: fd });
      } else {
        delete v.file;
        if (kind === 'video' && !v.content) throw new Error('Ajoutez un lien ou un fichier.');
        if (entry) await api('/api/entries/' + entry.id, { method: 'PUT', body: v });
        else await api(`/api/patients/${S.patient.id}/entries`, { method: 'POST', body: { kind, ...v } });
      }
      toast(entry ? 'Modification enregistrée' : 'Ajout enregistré'); refresh();
    },
    onDelete: entry ? async () => { await api('/api/entries/' + entry.id, { method: 'DELETE' }); toast('Supprimé'); refresh(); } : null,
  });
}

function editIdentity() {
  const p = S.patient, m = S.meta;
  const form = formModal({
    title: 'Identité, motif & emplacement',
    values: { ...p, loc_type: p.hors_service ? 'hs' : 'room' },
    fields: [
      { name: 'nom', label: 'Nom', required: true }, { name: 'prenom', label: 'Prénom' },
      { name: 'age', label: 'Âge', type: 'number' }, { name: 'ip', label: 'IP', required: true },
      { name: 'mutuelle', label: 'Mutuelle', type: 'select', options: m.mutuelles }, { name: 'groupe', label: 'Groupe sanguin', type: 'select', options: m.groupes },
      { name: 'motif', label: 'Motif', full: true }, { name: 'date_entree', label: 'Date d\'entrée', type: 'date' },
      ...(p.status === 'sorti' ? [] : locationFields(m)),
    ],
    onSubmit: async (v) => {
      const { loc_type, ...rest } = v;
      let body = rest;
      if (p.status !== 'sorti') {
        if (loc_type === 'hs' && !v.hors_service.trim()) throw new Error('Indiquez le service d\'hébergement.');
        if (loc_type === 'room' && (!v.room || !v.position)) throw new Error('Choisissez la chambre et le lit.');
        body = { ...rest, ...locPayload(v) };
      }
      await api('/api/patients/' + p.id, { method: 'PUT', body });
      toast('Dossier mis à jour'); refresh();
    },
  });
  if (p.status !== 'sorti') bindLocToggle(form);
}

const plusBtn = (kind, label) => `<button class="plus" data-add="${kind}" aria-label="Ajouter ${label}">${I.plus}</button>`;
function bindItems(root) {
  root.querySelectorAll('[data-add]').forEach(b => b.onclick = (e) => { e.stopPropagation(); entryForm(b.dataset.add, null, b.dataset.preset ? JSON.parse(b.dataset.preset) : {}); });
  const isMaj = ((location.hash.split('/')[3]) || 'maj') === 'maj';
  root.querySelectorAll('[data-eid]').forEach(el => {
    const edit = () => {
      const [kind, id] = el.dataset.eid.split(':');
      const item = (S.entries[kind] || []).find(x => String(x.id) === id);
      if (item) entryForm(kind, item);
    };
    if (isMaj) {
      el.onclick = null;
      el.classList.add('maj-read-only');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'maj-edit-pencil no-print';
      button.textContent = '✎'; button.title = 'Modifier cet élément';
      button.setAttribute('aria-label', 'Modifier cet élément');
      button.onclick = event => {event.stopPropagation(); edit();};
      el.prepend(button);
    } else {
      el.onclick = event => {
        if (event.target.closest('.tog, a, video')) return;
        edit();
      };
    }
  });
  if (isMaj) {
    const motif = root.querySelector('#motif-edit');
    if (motif) {
      motif.onclick = null;
      motif.classList.add('maj-read-only');
      const hint = motif.querySelector('small');
      if (hint) hint.textContent = hint.textContent.replace(/\s*·\s*cliquer pour modifier/, '');
      const button = document.createElement('button');
      button.type = 'button';button.className = 'maj-edit-pencil no-print';
      button.textContent = '✎';button.title = 'Modifier le motif';
      button.setAttribute('aria-label','Modifier le motif');
      button.onclick = event => {event.stopPropagation();editIdentity();};
      motif.prepend(button);
    }
  }
  root.querySelectorAll('.tog').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.tog; S.expanded.has(id) ? S.expanded.delete(id) : S.expanded.add(id);
    renderTab((location.hash.split('/')[3]) || 'maj');
  });
}
const meta = (e) => `<span class="meta">${fmtDate(e.updated_at)}</span>`;
const sortByDate = (arr) => [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);

function examItem(e) {
  const open = S.expanded.has(String(e.id));
  const head = `${esc((e.title || e.category || '').toUpperCase())} LE ${fmtDate(e.date)}`;
  return `<div class="item exam" data-eid="examen:${e.id}">
    <span class="t">${head} :</span><span class="c">${esc(e.content)}</span>
    ${e.details ? (open
      ? `<div class="det"><span class="det-lbl">DÉTAILS :</span><br>${esc(e.details)}</div><button class="tog" data-tog="${e.id}" aria-label="Réduire">${I.up}</button>`
      : `<button class="tog" data-tog="${e.id}" aria-label="Voir les détails">${I.down}</button>`) : ''}
    ${meta(e)}</div>`;
}

function renderTab(tab) {
  if(!visiblePatientTabs().some(([key])=>key===tab))tab='maj';
  const box = $('#tab-content'), E = S.entries, p = S.patient;
  if (tab === 'maj') {
    const atcds = E.atcd || [];
    const atcdHtml = atcds.map(a => `<div class="item center" data-eid="atcd:${a.id}" style="border-bottom:none;padding:6px 14px">${esc(a.content)}</div>`).join('');
    const clin = [...(E.clinique || [])].sort((a, b) => {
      const rank = (e) => e.category === 'Gestes faits' ? 0 : e.category === 'Drains' ? 1 : 2;
      return rank(a) - rank(b)
        || (b.date || '').localeCompare(a.date || '')
        || b.id - a.id;
    });
    box.innerHTML = `<div class="cols">
      <div class="col"><div class="col-head">Motif ${plusBtn('atcd', 'un antécédent')}</div>
        <div class="col-body">
          <div class="motif-block" id="motif-edit"><div class="m">${esc(p.motif || '—')}</div><small>Entrée le ${fmtDate(p.date_entree)} · cliquer pour modifier</small></div>
          <div class="atcd-cat" style="text-align:center;font-size:15px;text-transform:none;letter-spacing:0;color:var(--ink)">ATCDs :</div>
          ${atcdHtml || '<div class="empty">Aucun antécédent renseigné</div>'}
        </div></div>
      <div class="col"><div class="col-head">clinique ${plusBtn('clinique', 'un élément clinique')}</div>
        <div class="col-body">${clin.map(c => `<div class="item center" data-eid="clinique:${c.id}"><span class="cat-tag">${esc(c.category)}</span><br>${c.category === 'Gestes faits' ? `<span data-postop-id="${c.id}">${esc(postOpLabel(c))}</span>` : esc(c.content)}<span class="meta">${fmtDate(c.date)}</span></div>`).join('') || '<div class="empty">Gestes, surveillance, constantes, drains…</div>'}</div></div>
      <div class="col"><div class="col-head">Bilan ${plusBtn('bilan', 'un bilan')}</div>
        <div class="col-body">${labKinetic(E.bilan || [])}</div></div>
      <div class="col"><div class="col-head">Examen complémentaires ${plusBtn('examen', 'un examen')}</div>
        <div class="col-body">${sortByDate(E.examen || []).map(examItem).join('') || '<div class="empty">TDM, IRM, coloscopie, anapath…</div>'}</div></div>
      <div class="col"><div class="col-head">Avis ${plusBtn('avis', 'un avis')}</div>
        <div class="col-body">${sortByDate(E.avis || []).map(a => `<div class="item avis" data-eid="avis:${a.id}"><span class="t">${fmtDate(a.date)}<br>Avis ${esc(a.category)} :</span><span class="c">${esc(a.content)}</span>${meta(a)}</div>`).join('') || '<div class="empty">Aucun avis spécialisé</div>'}</div></div>
    </div>`;
    $('#motif-edit').onclick = editIdentity;
  } else if (tab === 'obsrv') {
    box.innerHTML = '<div class="obs-doc-grid">' + `<div class="panel"><div class="panel-head"><h3>Observations médicales</h3><button class="btn primary" data-add="observation">+ Nouvelle observation</button></div>
      <div class="timeline">${sortByDate(E.observation || []).map(o => `<article class="card" data-eid="observation:${o.id}"><h4>${fmtDate(o.date)}${o.title ? ' — ' + esc(o.title) : ''}</h4><p>${esc(o.content)}</p><div class="meta">${fmtDate(o.updated_at)}</div></article>`).join('') || '<div class="empty">Aucune observation</div>'}</div></div>` + documentPanel() + '</div>';
    loadPatientDocuments(S.patient.id);
  } else if (tab === 'ttt') {
    renderTreatmentTab(box,E,p);
  } else if (tab === 'videos') {
    renderImagingTab(box,E,p);
  } else if (tab === 'autres') {
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>AUTRES</h3></div><div class="empty">Espace réservé — contenu à définir.</div></div>`;
  } else if (tab === 'sortie') {
    renderSortie(box); return;
  } else if (tab === 'logs') {
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Journal des modifications</h3></div><div class="empty">Chargement…</div></div>`;
    api(`/api/patients/${p.id}/logs`).then(r => {
      box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Journal des modifications</h3><span class="meta">${r.logs.length} événement(s)</span></div>
      <table class="tbl"><thead><tr><th style="width:150px">Date / heure</th><th style="width:170px">Utilisateur</th><th style="width:240px">Action</th><th>Détail</th></tr></thead>
      <tbody>${r.logs.map(l => `<tr><td>${fmtTs(l.ts)}</td><td>${esc(l.user)}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody></table></div>`;
    });
    return;
  }
  bindItems(box);
  bindLabTools(box);
}


const SORTIE_MEDICAMENTS = [{"nom": "Parantal 1 g cp", "posologie": "1 cp x 3/jour", "duree": "Si douleur"}, {"nom": "Coparantal 1 g cp", "posologie": "1 cp x 3/jour", "duree": "Si douleur"}, {"nom": "Augmentin 1 g Sachet", "posologie": "1 Sachet x 3/jour", "duree": "7 jours"}, {"nom": "Aclav 1 g Sachet", "posologie": "1 sachet x 3/jour", "duree": "8 jours"}, {"nom": "Catex 500 mg cp", "posologie": "1 cp x 2/jour", "duree": "7 jours"}, {"nom": "Sepcen 500 mg cp", "posologie": "1 cp x 2/jour", "duree": "7 jours"}, {"nom": "Flagyl 500 mg cp", "posologie": "1 cp x 3/jour", "duree": "7 jours"}, {"nom": "Aulcer 20 mg gél", "posologie": "1 gél/j le matin à jeun", "duree": "1 mois"}, {"nom": "Ixor 20 mg cp", "posologie": "1 cp/j le matin à jeun", "duree": "1 mois"}, {"nom": "Spasfon 80 mg cp", "posologie": "2 cp x 3/jour si douleur", "duree": "5 jours"}, {"nom": "Dasen 10000 UI cp", "posologie": "2 cp x 3/jour", "duree": "7 jours"}, {"nom": "Tramal 50 mg gél", "posologie": "1 gél x 2/jour si douleur", "duree": "5 jours"}, {"nom": "Lovenox 4000 UI inj", "posologie": "1 inj SC/jour", "duree": "7 jours"}, {"nom": "Lovenox 4000 UI inj", "posologie": "1 inj SC/jour", "duree": "14 jours"}, {"nom": "Lovenox 4000 UI inj", "posologie": "1 inj SC/jour", "duree": "21 jours"}];
function initSortieLists(form) {
  const types=['RDV consult avec nous','RDV avec d’autres services','RDV bilan','RDV imagerie'];
  function setup(name, medication) {
    const storage=form.elements[name], root=form.querySelector(`[data-list="${name}"]`);
    const rows=[];
    const legacy=[];
    storage.value.split('\n').filter(l=>l.trim()).forEach(line=>{
      const m=medication ? line.match(/^• (.*?) — Posologie : (.*?) — Durée : (.*)$/) : line.match(/^• (.*?) — Date : (.*?) — Détails : (.*)$/);
      if(m) rows.push(medication?{nom:m[1],posologie:m[2],duree:m[3]}:{type:m[1],date:m[2]==='À préciser'?'':m[2],details:m[3]});
      else if(medication) legacy.push(line);
      else rows.push({type:'',date:'',details:line});
    });
    const fields=medication?[['nom','Médicament'],['posologie','Posologie'],['duree','Durée']]:[['type','Type de RDV'],['date','Date (facultative)'],['details','Détails / service / examen / délai']];
    root.innerHTML=`<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><select data-choice style="flex:1;min-width:200px" aria-label="${medication?'Choisir un médicament':'Choisir un RDV'}"><option value="">Choisir…</option>${medication?SORTIE_MEDICAMENTS.map((m,i)=>`<option value="${i}">${esc(m.nom)} — ${esc(m.posologie)} — ${esc(m.duree)}</option>`).join('')+'<option value="autre">Autre — saisie manuelle</option>':types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select><button class="btn primary" type="button" data-add>Ajouter ${medication?'un médicament':'un RDV'}</button></div><div data-rows></div><p class="no-print" style="font-size:12px;color:#64748b">${medication?'Vérifier et adapter chaque médicament, sa posologie et sa durée avant validation.':'Plusieurs rendez-vous possibles, y compris du même type. Une date vide reste « À préciser ».'}</p>`;
    const list=root.querySelector('[data-rows]');
    function sync(){
      const clean=v=>String(v||'').replace(/[\r\n]+/g,' ').trim();
      storage.value=[...rows.map(r=>medication?`• ${clean(r.nom)} — Posologie : ${clean(r.posologie)} — Durée : ${clean(r.duree)}`:r.type?`• ${r.type} — Date : ${r.date||'À préciser'} — Détails : ${clean(r.details)}`:clean(r.details)),...legacy].filter(Boolean).join('\n');
      storage.dispatchEvent(new Event('change',{bubbles:true}));
    }
    function render(){
      list.innerHTML=rows.map((r,i)=>`<div data-row="${i}" style="border:1px solid #dbe3ed;border-radius:10px;padding:12px;margin-bottom:10px;display:flex;gap:10px;align-items:end;flex-wrap:wrap">${fields.map(([key,label])=>`<label style="flex:1;min-width:170px">${label}${key==='type'?`<select data-key="type" required><option value="">Choisir un type…</option>${types.map(t=>`<option ${t===r.type?'selected':''} value="${esc(t)}">${esc(t)}</option>`).join('')}</select>`:key==='details'?`<textarea data-key="details" rows="2" maxlength="2000" placeholder="Service, examen, délai, consignes…">${esc(r[key])}</textarea>`:`<input data-key="${key}" type="${key==='date'?'date':'text'}" ${medication?'required':''} maxlength="500" value="${esc(r[key])}">`}</label>`).join('')}<button class="btn danger no-print" type="button" data-remove="${i}">Supprimer</button></div>`).join('')||`<p style="color:#64748b">${medication?'Aucun médicament sélectionné.':'Aucun rendez-vous ajouté.'}</p>`;
      list.querySelectorAll('[data-key]').forEach(input=>{
        const update=()=>{rows[Number(input.closest('[data-row]').dataset.row)][input.dataset.key]=input.value;sync();};
        input.addEventListener('input',update);input.addEventListener('change',update);
      });
      list.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{rows.splice(Number(b.dataset.remove),1);render();sync();});
    }
    root.querySelector('[data-add]').onclick=()=>{
      const select=root.querySelector('[data-choice]');
      if(!select.value){select.focus();return;}
      rows.push(medication?(select.value==='autre'?{nom:'',posologie:'',duree:''}:{...SORTIE_MEDICAMENTS[Number(select.value)]}):{type:select.value,date:'',details:''});
      select.value='';render();sync();
      const controls=list.lastElementChild?.querySelectorAll('input,select,textarea');controls?.[0]?.focus();
    };
    form.addEventListener('submit',sync,true);
    render();
  }
  setup('sortie_ordonnance',true);
  setup('sortie_rdv',false);
}

function renderSortie(box) {
  const p = S.patient, sorti = p.status === 'sorti';
  const modes = ['', 'Domicile', 'Transfert vers un autre service', 'Transfert vers un autre établissement', 'Contre avis médical', 'Évasion', 'Décès'];
  box.innerHTML = `<div class="panel">
    <div class="panel-head"><h3>Fiche de sortie</h3><div style="display:flex;gap:8px"><button class="btn no-print" id="print">Imprimer</button>${sorti ? '<button class="btn teal no-print" id="readmit">Réadmettre</button>' : ''}</div></div>
    ${sorti ? `<div class="banner ok">Sortie validée le ${fmtDate(p.sortie_date)} — ${esc(p.sortie_mode)}. Le lit a été libéré.</div>` : '<div class="banner">Patient hospitalisé. « Valider la sortie » libère le lit et archive le dossier (consultable dans Patients sortis).</div>'}
    <form id="sortie-form" class="sortie-grid">
      <div class="field"><label>Date d’entrée</label><input type="date" name="date_entree" value="${esc(p.date_entree || '')}"></div>
      <div class="field"><label>Date de sortie</label><input type="date" name="sortie_date" value="${esc(p.sortie_date || today())}"></div>
      <div class="field"><label>Mode de sortie</label><select name="sortie_mode">${modes.map(m => `<option ${m === (p.sortie_mode || '') ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
      <div class="field full" style="grid-column:1/-1"><label>Destination / service d'accueil</label><input name="sortie_destination" value="${esc(p.sortie_destination || '')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Résumé d'hospitalisation / compte rendu</label><textarea name="sortie_resume" style="min-height:160px">${esc(p.sortie_resume || '')}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Ordonnance de sortie</label><textarea name="sortie_ordonnance" hidden style="display:none">${esc(p.sortie_ordonnance || '')}</textarea><div data-list="sortie_ordonnance"></div></div>
      <div class="field" style="grid-column:1/-1"><label>Rendez-vous après la sortie</label><textarea name="sortie_rdv" hidden style="display:none">${esc(p.sortie_rdv || '')}</textarea><div data-list="sortie_rdv"></div></div>
      <div class="form-err" id="serr" style="grid-column:1/-1"></div>
      <div class="form-actions no-print" style="grid-column:1/-1"><div class="r"><button class="btn" type="submit" data-v="0">Enregistrer le brouillon</button>${sorti ? '' : '<button class="btn primary" type="submit" data-v="1">Valider la sortie</button>'}</div></div>
    </form></div>`;
  const form = $('#sortie-form');
  initSortieLists(form);
  initSortieCrh(form,p,S.entries);
  let valider = false;
  form.querySelectorAll('[data-v]').forEach(b => b.onclick = () => (valider = b.dataset.v === '1'));
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (valider && !confirm('Valider la sortie et libérer le lit ?')) return;
    const body = Object.fromEntries(new FormData(form)); body.valider = valider;
    try { await api(`/api/patients/${p.id}/sortie`, { method: 'POST', body }); toast(valider ? 'Sortie validée' : 'Fiche enregistrée'); refresh(); }
    catch (err) { $('#serr').textContent = err.message; }
  };
  $('#print').onclick = () => window.print();
  const ra = $('#readmit');
  if (ra) ra.onclick = () => {
    const f = formModal({
      title: 'Réadmettre le patient', submit: 'Réadmettre', values: { loc_type: 'room' }, fields: locationFields(S.meta),
      onSubmit: async (v) => {
        if (v.loc_type === 'room' && (!v.room || !v.position)) throw new Error('Choisissez la chambre et le lit.');
        await api(`/api/patients/${p.id}/readmettre`, { method: 'POST', body: locPayload(v) }); toast('Patient réadmis'); refresh();
      },
    });
    bindLocToggle(f);
  };
}

// ------------------------------------------------------------------ other pages
async function viewArchives() {
  $('#app').innerHTML = topbar() + `<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button><input id="aq" class="pill" style="box-shadow:none;border:1.5px solid var(--line);font-size:15px;padding:9px 18px;width:320px" placeholder="Filtrer par nom ou IP"></div><div class="panel" id="arch"></div></main>`;
  bindChrome();
  $('#home-btn').onclick = () => (location.hash = '#/home');
  const load = async (q = '') => {
    const r = await api('/api/archives?q=' + encodeURIComponent(q));
    $('#arch').innerHTML = `<div class="panel-head"><h3>Patients sortis</h3><span class="meta">${r.patients.length} dossier(s)</span></div>
      <table class="tbl"><thead><tr><th>Patient</th><th>IP</th><th>Motif</th><th>Date de sortie</th><th>Mode</th></tr></thead>
      <tbody>${r.patients.map(p => `<tr class="clickable" data-id="${p.id}"><td><b>${esc(p.nom)} ${esc(p.prenom)}</b></td><td>${esc(p.ip)}</td><td>${esc(p.motif)}</td><td>${fmtDate(p.sortie_date)}</td><td>${esc(p.sortie_mode)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Aucun patient sorti</td></tr>'}</tbody></table>`;
    $('#arch').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => (location.hash = `#/patient/${tr.dataset.id}/sortie`));
  };
  let t; $('#aq').oninput = (e) => { clearTimeout(t); t = setTimeout(() => load(e.target.value), 250); };
  load();
}

async function viewUsers() {
  $('#app').innerHTML = topbar() + `<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button></div><div class="panel" id="users"></div></main>`;
  bindChrome();
  $('#home-btn').onclick = () => (location.hash = '#/home');
  const r = await api('/api/users');
  const roles = { admin: 'Administrateur', medecin: 'Médecin', infirmier: 'Infirmier(e)' };
  $('#users').innerHTML = `<div class="panel-head"><h3>Utilisateurs de l'équipe</h3><button class="btn primary" id="add-user">+ Nouvel utilisateur</button></div>
    <table class="tbl"><thead><tr><th>Identifiant</th><th>Nom complet</th><th>Rôle</th><th>Statut</th><th></th></tr></thead>
    <tbody>${r.users.map(u => `<tr><td><b>${esc(u.username)}</b></td><td>${esc(u.full_name)}</td><td>${roles[u.role] || u.role}</td><td><span class="chip ${u.active ? 'on' : 'off'}">${u.active ? 'Actif' : 'Désactivé'}</span></td>
      <td style="text-align:right"><button class="btn" data-pw="${u.id}">Mot de passe</button> ${u.role === 'admin' ? '<span class="chip on">Compte protégé</span>' : `<button class="btn ${u.active ? 'danger' : ''}" data-act="${u.id}" data-a="${u.active ? 0 : 1}">${u.active ? 'Désactiver' : 'Activer'}</button> <button class="btn danger" data-delete-user="${u.id}">Supprimer</button>`}</td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-delete-user]').forEach(b=>b.onclick=async()=>{
    const u=r.users.find(x=>String(x.id)===b.dataset.deleteUser);
    if(!confirm(`Supprimer ${u.full_name} (${u.username}) ? Les dossiers et historiques seront conservés.`))return;
    try{await api('/api/users/'+u.id,{method:'DELETE'});toast('Utilisateur supprimé');await viewUsers();}catch(e){toast(e.message,true);}
  });
  $('#add-user').onclick = () => formModal({
    title: 'Nouvel utilisateur', submit: 'Créer',
    fields: [{ name: 'username', label: 'Identifiant', required: true }, { name: 'full_name', label: 'Nom complet', required: true }, { name: 'role', label: 'Rôle', type: 'select', options: [['medecin', 'Médecin'], ['infirmier', 'Infirmier(e)'], ['admin', 'Administrateur']] }, { name: 'password', label: 'Mot de passe', type: 'password', required: true }],
    onSubmit: async (v) => { await api('/api/users', { method: 'POST', body: v }); toast('Utilisateur créé'); viewUsers(); },
  });
  document.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => formModal({
    title: 'Nouveau mot de passe', fields: [{ name: 'password', label: 'Mot de passe', type: 'password', required: true }],
    onSubmit: async (v) => { await api('/api/users/' + b.dataset.pw, { method: 'PUT', body: v }); toast('Mot de passe modifié'); },
  }));
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    try { await api('/api/users/' + b.dataset.act, { method: 'PUT', body: { active: b.dataset.a === '1' } }); viewUsers(); } catch (e) { toast(e.message, true); }
  });
}

async function viewJournal() {
  if(S.user?.role!=='admin'){location.hash='#/home';toast('Journal réservé à l’administrateur.',true);return;}
  $('#app').innerHTML = topbar() + `<main class="patient" style="grid-template-rows:auto 1fr"><div class="tabsbar"><button class="btn-back" id="home-btn">${I.back} Retour à l'accueil</button></div><div class="panel" id="jr"></div></main>`;
  bindChrome();
  $('#home-btn').onclick = () => (location.hash = '#/home');
  const r = await api('/api/logs');
  $('#jr').innerHTML = `<div class="panel-head"><h3>Journal global (500 derniers événements)</h3></div>
    <table class="tbl"><thead><tr><th>Date / heure</th><th>Utilisateur</th><th>Patient</th><th>Action</th><th>Détail</th></tr></thead>
    <tbody>${r.logs.map(l => `<tr ${l.patient_id ? `class="clickable" data-id="${l.patient_id}"` : ''}><td>${fmtTs(l.ts)}</td><td>${esc(l.user)}</td><td>${l.nom ? esc(l.nom + ' ' + (l.prenom || '')) : '—'}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.detail)}</td></tr>`).join('')}</tbody></table>`;
  $('#jr').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => (location.hash = `#/patient/${tr.dataset.id}/logs`));
}


function clockForm(){formModal({title:'UTC et adaptation manuelle',values:clock,
 extra:'<p>UTC par défaut. Correction globale : 0 = UTC, +60 = UTC+1, -60 = UTC−1. Les anciens historiques ne sont pas modifiés.</p>',
 fields:[{name:'offset_minutes',label:'Correction en minutes',type:'number',required:true}],
 onSubmit:async v=>{await api('/api/clock',{method:'PUT',body:v});await syncClock();toast('Horloge mise à jour');setTimeout(render,0);}});}
function profileFields(){return [
 {name:'username',label:'Identifiant',required:true},{name:'full_name',label:'Nom complet',required:true},
 {name:'current_password',label:'Mot de passe actuel / temporaire',type:'password',required:true},
 ...(S.user.must_change_password ? [{name:'password',label:'Nouveau mot de passe (8 caractères minimum)',type:'password',required:true},{name:'confirm_password',label:'Confirmer le nouveau mot de passe',type:'password',required:true}] : [])
];}
async function saveProfile(v){
 if(S.user.must_change_password && v.password!==v.confirm_password)throw new Error('Les mots de passe ne correspondent pas.');
 delete v.confirm_password;
 S.user=(await api('/api/me/profile',{method:'PUT',body:v})).user;
 toast('Compte mis à jour');location.hash='#/home';setTimeout(render,0);
}
function profileForm(){formModal({title:'Mon compte',fields:profileFields(),values:S.user,
 extra:'<p>Après la première connexion, seul l’administrateur peut modifier votre mot de passe.</p>',onSubmit:saveProfile});}
function viewFirstLogin(){
 $('#app').innerHTML=`<main class="login"><section class="login-card"><h1>Première connexion</h1><p>Personnalisez votre compte. Vous ne pourrez plus modifier vous-même votre mot de passe après cette étape.</p><form id="first-login">${profileFields().map(f=>`<label>${esc(f.label)}<input class="pill" name="${f.name}" type="${f.type||'text'}" value="${f.type==='password'?'':esc(S.user[f.name])}" required></label>`).join('')}<div class="login-err" id="first-error"></div><button class="btn primary" type="submit">Enregistrer et continuer</button><button class="btn" type="button" id="first-logout">Se déconnecter</button></form></section></main>`;
 $('#first-logout').onclick=()=>logout();
 $('#first-login').onsubmit=async e=>{e.preventDefault();try{await saveProfile(Object.fromEntries(new FormData(e.target)));}catch(err){$('#first-error').textContent=err.message;}};
}

// ------------------------------------------------------------------ router
async function render() {
  const parts = (location.hash || '#/home').slice(2).split('/');
  if (!S.token) { if (parts[0] !== 'login') { location.hash = '#/login'; } viewLogin(); return; }
  if (!S.user) { try { S.user = (await api('/api/me')).user; } catch { return; } }
  closeModal();
  if (S.user.must_change_password) {viewFirstLogin(); return;}
  try {
    await syncClock();
    if (!S.meta) S.meta = await api('/api/meta');
    if (parts[0] === 'patient' && parts[1]) {
      const tab = visiblePatientTabs().some(t => t[0] === parts[2]) ? parts[2] : 'maj';
      if(parts[2]&&parts[2]!==tab){location.hash='#/patient/'+parts[1]+'/'+tab;return;}
      if (!S.patient || String(S.patient.id) !== parts[1]) S.patient = null;
      await viewPatient(parts[1], tab);
    } else if (parts[0] === 'patients-a-staffer') { S.patient = null; await viewPatientsAStaffer(); }
    else if (parts[0] === 'archives') { S.patient = null; await viewArchives(); }
    else if (parts[0] === 'users') { S.patient = null; await viewUsers(); }
    else if (parts[0] === 'journal') { S.patient = null; await viewJournal(); }
    else { if (parts[0] !== 'home') { location.hash = '#/home'; return; } S.patient = null; await viewHome(); }
  } catch (err) { toast(err.message, true); }
}

// BEGIN SORTIE WORD INTEGRATED V2
// Documents Word uniquement. Chargé après app.js.
(() => {
'use strict';
const baseBuilder=buildCrhDraft;
buildCrhDraft=function(p,E,options={}) {
 const observations=crhOrdered(crhStayEntries(E.observation||[],p)).filter(e=>crhText(e));
 if(!observations.length) {
  return baseBuilder(p,{...E,observation:[]},options)
   .replace('À confirmer : prise en charge par surveillance clinico-biologique en l’absence d’intervention réalisée.','Prise en charge à renseigner.')
   .replace(/\nÉvolution \/ observations :\nÉvolution non renseignée — à compléter\./,'');
 }
 const parts=[],seen=new Set();
 const norm=t=>String(t||'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
 function add(t){t=String(t||'').trim();const key=norm(t);if(t&&!seen.has(key)){seen.add(key);parts.push(t);}}
 function contained(t){const key=norm(t);return key&&parts.some(part=>norm(part).includes(key));}
 add(crhText(observations[0]));
 for(const o of observations.slice(1))if(!contained(crhText(o)))add('Évolution du '+(fmtDate(o.date)||'date à préciser')+' :\n'+crhText(o));
 const bilans=crhStayEntries(E.bilan||[],p);
 if(bilans.length){const text=crhBilanLines(bilans).join('\n');if(!contained(text))add(text);}
 for(const e of crhOrdered(crhStayEntries(E.examen||[],p))){
  const content=[e.content,e.details].filter(Boolean).join('\n');
  if(content.trim()&&!contained(content))add([e.title||e.category||'Examen complémentaire',fmtDate(e.date)].filter(Boolean).join(' — ')+' :\n'+content);
 }
 for(const e of crhOrdered(crhStayEntries(E.avis||[],p)))if(crhText(e)&&!contained(crhText(e)))add('Avis '+(e.category||'spécialisé')+' — '+(fmtDate(e.date)||'date à préciser')+' :\n'+crhText(e));
 if(options.care==='intervention')add('Prise en charge :\nIntervention : '+(options.operation_name||'intitulé à préciser')+(options.operation_date?' le '+fmtDate(options.operation_date):' — date à préciser')+'.');
 else if(options.care==='surveillance')add('Prise en charge :\nSurveillance clinico-biologique confirmée.');
 add('Sortie :\n'+[p.sortie_date?'Le '+fmtDate(p.sortie_date):'Date à préciser',p.sortie_mode,p.sortie_destination].filter(Boolean).join(' — '));
 if(p.sortie_ordonnance)add('Traitement de sortie :\n'+p.sortie_ordonnance);
 if(p.sortie_rdv)add('Suivi prévu :\n'+p.sortie_rdv);
 return parts.join('\n\n');
};
function wordMenu(){
 const patient=S.patient;
 if(!patient||patient.status!=='sorti'){toast('Validez la sortie avant de télécharger les documents Word.',true);return;}
 const form=document.querySelector('#sortie-form');
 const fields=['date_entree','sortie_date','sortie_mode','sortie_destination','sortie_resume','sortie_ordonnance','sortie_rdv'];
 if(form&&fields.some(key=>form.elements[key]&&String(form.elements[key].value||'').trim()!==String(patient[key]||'').trim())){
  toast('Enregistrez les modifications de la fiche de sortie avant de télécharger les documents.',true);return;
 }
 const overlay=modal(`<div class="dialog-head"><h2>Documents de sortie — Word</h2><button class="btn" type="button" data-word-close>Fermer</button></div><p>Téléchargez le document, puis ouvrez-le dans Word pour le modifier ou l’imprimer.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" class="btn primary" data-word-kind="crh">Télécharger le CRH (.docx)</button><button type="button" class="btn primary" data-word-kind="ordonnance">Télécharger l’ordonnance (.docx)</button></div>`);
 overlay.querySelector('[data-word-close]').onclick=closeModal;
 overlay.querySelectorAll('[data-word-kind]').forEach(button=>button.onclick=async()=>{
  button.disabled=true;
  try{
   const kind=button.dataset.wordKind;
   const response=await fetch(API+'/api/patients/'+patient.id+'/sortie-document/'+kind+'/docx',{headers:{Authorization:'Bearer '+S.token},credentials:'same-origin'});
   if(!response.ok){let message='Téléchargement impossible.';try{message=(await response.json()).error||message;}catch{}if(response.status===401)logout(true);throw new Error(message);}
   const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=kind+'_'+String(patient.nom||'patient').replace(/[^\p{L}\p{N}_-]+/gu,'_')+'_'+patient.id+'.docx';
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){toast(error.message,true);}finally{if(button.isConnected)button.disabled=false;}
 });
}
document.addEventListener('click',event=>{
 if(event.target.closest('#print')&&document.querySelector('#sortie-form')){
  event.preventDefault();event.stopImmediatePropagation();wordMenu();
 }
},true);
})();

// END SORTIE WORD INTEGRATED V2

window.addEventListener('hashchange', render);
S.token = store.get('cva_token');
render();
})();
