/* ============================================================================
   Scenemaker editor; project info & credits  (features #2 sidebar, #3 metadata, #4 credits)
   Author/website/socials/email/collaborators live on project.meta (separate from
   the story's variables). Asset attributions live on project.credits. Both can be
   surfaced on the title screen (tokens) and an automatic end credits screen.
   Shares global scope with core.js.
   ==========================================================================*/
function ensureProjectInfo(){
  if(!project.meta) project.meta={};
  const m=project.meta;
  if(m.author==null) m.author='';
  if(m.email==null) m.email='';
  if(m.website==null) m.website='';
  if(!Array.isArray(m.socials)) m.socials=[];
  if(!Array.isArray(m.collaborators)) m.collaborators=[];
  if(!Array.isArray(project.credits)) project.credits=[];
  if(!project.title) project.title={};
  if(project.title.showCredits==null) project.title.showCredits=false;
  if(project.title.creditsHeading==null) project.title.creditsHeading='Credits';
  if(!project.settings) project.settings={};
  if(!project.settings.share) project.settings.share={enabled:false, message:'I got the “{ending}” ending in {title}!'};
}

/* ---- settings sidebar navigation --------------------------------------- */
// #12: which settings sections live in the PROJECT (saved with the story,
// travels with it) vs THIS EDITOR (a local preference, never saved into the
// story) - mirrors the two <div class="set-nav-group"> blocks in editor.html
// exactly; add a new section to both places together.
const SETTINGS_EDITOR_SECS=['theme','workspace','apikeys'];
function showSettingsSection(sec){
  document.querySelectorAll('#story-modal .set-sec').forEach(el=>{ el.hidden = el.getAttribute('data-sec')!==sec; });
  document.querySelectorAll('#settings-nav .set-nav-item').forEach(a=>{ a.classList.toggle('active', a.getAttribute('data-sec')===sec); });
  const badge=document.getElementById('settings-scope-badge');
  if(badge){
    const isEditor=SETTINGS_EDITOR_SECS.indexOf(sec)!==-1;
    badge.textContent = isEditor
      ? '\u{1F5A5} This editor’s own setting; stored on this device, never saved into the story'
      : '\u{1F4C1} Project setting; saved with this story, goes with it when shared or exported';
    badge.className = 'settings-scope-badge ' + (isEditor?'scope-editor':'scope-project');
  }
}

/* ---- populate / read scalar fields ------------------------------------- */
function openProjectInfo(){
  ensureProjectInfo(); const m=project.meta;
  const datesBox=document.getElementById('pi-dates');
  if(datesBox){
    const started=(typeof _fmtWhen==='function')?_fmtWhen(m.createdAt):null;
    const saved=(typeof _fmtWhen==='function')?_fmtWhen(m.exportTime):null;
    datesBox.innerHTML=
      `<div class="asset-meta"><span>Started</span><b>${started||'unknown (saved before this was tracked)'}</b></div>`
      +`<div class="asset-meta"><span>Last saved</span><b>${saved||'not yet saved'}</b></div>`;
  }
  document.getElementById('pi-author').value=m.author||'';
  document.getElementById('pi-email').value=m.email||'';
  document.getElementById('pi-website').value=m.website||'';
  document.getElementById('pi-showcredits').checked=!!project.title.showCredits;
  document.getElementById('pi-creditshead').value=project.title.creditsHeading||'Credits';
  document.getElementById('pi-share-enabled').checked=!!project.settings.share.enabled;
  document.getElementById('pi-share-message').value=project.settings.share.message||'';
  renderSocials(); renderCollabs(); renderCredits();
}
function saveProjectInfo(){
  ensureProjectInfo(); const m=project.meta;
  m.author=document.getElementById('pi-author').value.trim();
  m.email=document.getElementById('pi-email').value.trim();
  m.website=document.getElementById('pi-website').value.trim();
  project.title.showCredits=document.getElementById('pi-showcredits').checked;
  project.title.creditsHeading=document.getElementById('pi-creditshead').value.trim()||'Credits';
  project.settings.share.enabled=document.getElementById('pi-share-enabled').checked;
  project.settings.share.message=document.getElementById('pi-share-message').value.trim()||'I got the “{ending}” ending in {title}!';
}

/* ---- socials ------------------------------------------------------------ */
function renderSocials(){ const box=document.getElementById('pi-socials'); if(!box) return; ensureProjectInfo();
  box.innerHTML=project.meta.socials.map((s,i)=>
    `<div class="mini-row"><input placeholder="label (e.g. Mastodon)" value="${escAttr(s.label)}" oninput="setSocial(${i},'label',this.value)">`
    +`<input placeholder="https://…" value="${escAttr(s.url)}" oninput="setSocial(${i},'url',this.value)">`
    +`<span class="row-x" title="Remove" onclick="delSocial(${i})">✕</span></div>`).join('');
}
function addSocial(){ ensureProjectInfo(); pushUndo(); project.meta.socials.push({label:'',url:''}); renderSocials(); }
function setSocial(i,f,v){ project.meta.socials[i][f]=v; }
function delSocial(i){ pushUndo(); project.meta.socials.splice(i,1); renderSocials(); }

/* ---- collaborators ------------------------------------------------------ */
function renderCollabs(){ const box=document.getElementById('pi-collabs'); if(!box) return; ensureProjectInfo();
  box.innerHTML=project.meta.collaborators.map((c,i)=>
    `<div class="mini-row"><input placeholder="name" value="${escAttr(c.name)}" oninput="setCollab(${i},'name',this.value)">`
    +`<input placeholder="role (e.g. writing, art)" value="${escAttr(c.role)}" oninput="setCollab(${i},'role',this.value)">`
    +`<span class="row-x" title="Remove" onclick="delCollab(${i})">✕</span></div>`).join('');
}
function addCollab(){ ensureProjectInfo(); pushUndo(); project.meta.collaborators.push({name:'',role:''}); renderCollabs(); }
function setCollab(i,f,v){ project.meta.collaborators[i][f]=v; }
function delCollab(i){ pushUndo(); project.meta.collaborators.splice(i,1); renderCollabs(); }

/* ---- asset credits / attributions -------------------------------------- */
function renderCredits(){ const box=document.getElementById('pi-credits'); if(!box) return; ensureProjectInfo();
  box.innerHTML=project.credits.map((c,i)=>
    `<div class="mini-row"><input placeholder="asset (e.g. title audio)" value="${escAttr(c.asset)}" oninput="setCredit(${i},'asset',this.value)">`
    +`<input placeholder="author / source" value="${escAttr(c.author)}" oninput="setCredit(${i},'author',this.value)">`
    +`<input placeholder="license" value="${escAttr(c.license)}" oninput="setCredit(${i},'license',this.value)" style="max-width:120px">`
    +`<input placeholder="url" value="${escAttr(c.url)}" oninput="setCredit(${i},'url',this.value)">`
    +`<span class="row-x" title="Remove" onclick="delCredit(${i})">✕</span></div>`).join('');
}
function addCredit(){ ensureProjectInfo(); pushUndo(); project.credits.push({asset:'',author:'',source:'',license:'',url:''}); renderCredits(); }
function setCredit(i,f,v){ project.credits[i][f]=v; }
function delCredit(i){ pushUndo(); project.credits.splice(i,1); renderCredits(); }
