/**
 * Universal tags — chips, editor, global lens
 */
(function(root){
  'use strict';

  let activeTag = null;

  function allTags(){
    return faithStore ? faithStore.getAllTags() : [];
  }

  function semanticTagClass(tag){
    const t = String(tag||'').trim().toLowerCase();
    if(!t) return '';
    if(t.includes('first fruit') || t === 'first fruits') return 'tag-first-fruits';
    if(t === 'hobbies' || t === 'hobby' || t.includes('hobb')) return 'tag-hobby';
    if(t === 'skills' || t === 'skill' || t.includes('skill')) return 'tag-skill';
    return '';
  }

  function tagChipsHtml(tags, opts){
    opts = opts || {};
    const list = (tags || []).filter(Boolean);
    if(!list.length && !opts.showAdd) return '';
    let h = '<span class="tag-chips">';
    list.forEach(t=>{
      const cls = semanticTagClass(t);
      h += '<button type="button" class="tag-chip'+(cls ? ' '+cls : '')+'" data-tag-lens="'+esc(t)+'" title="View all tagged">'+esc(t)+'</button>';
    });
    if(opts.showAdd) h += '<button type="button" class="tag-add-btn" data-tag-add="'+opts.entityType+'" data-tag-id="'+opts.entityId+'">+ tag</button>';
    h += '</span>';
    return h;
  }

  function tagEditorHtml(entityType, entityId, tags){
    const list = tags || [];
    const suggestions = allTags().filter(t=> !list.includes(t)).slice(0,8);
    return '<div class="tag-editor" data-tag-editor="'+entityType+'" data-tag-eid="'+entityId+'">'+
      list.map(t=>{
        const cls = semanticTagClass(t);
        return '<span class="tag-chip-wrap"><button type="button" class="tag-chip'+(cls ? ' '+cls : '')+'" data-tag-lens="'+esc(t)+'">'+esc(t)+'</button>'+
      '<button type="button" class="tag-chip-rm" data-tag-rm="'+esc(t)+'" aria-label="Remove">×</button></span>';
      }).join('')+
      '<button type="button" class="tag-add-btn" data-tag-add="'+entityType+'" data-tag-id="'+entityId+'">+ tag</button>'+
      '<div class="tag-input-row"><input type="text" class="tag-input" list="tagSuggestions" placeholder="Add tag…" aria-label="Add tag">'+
      (suggestions.length ? '<datalist id="tagSuggestions">'+suggestions.map(t=>'<option value="'+esc(t)+'">').join('')+'</datalist>' : '')+
      '</div></div>';
  }

  function renderTagLens(tag){
    activeTag = tag;
    const panel = document.getElementById('tagLensPanel');
    if(!panel || !faithStore) return;
    document.getElementById('tagLensTitle').textContent = 'Tagged: ' + tag;
    const groups = faithStore.findByTag(tag);
    const sections = [
      ['Tasks', groups.tasks, r=>'<button type="button" class="tag-lens-row" data-goto-task="'+r.id+'">'+esc(r.title)+' <span class="tag-lens-meta">'+esc(r.date)+'</span></button>'],
      ['Seeds', groups.seeds, r=>'<button type="button" class="tag-lens-row" data-goto-seed="'+r.id+'">'+esc(r.title)+'</button>'],
      ['Projects', groups.projects, r=>'<button type="button" class="tag-lens-row" data-goto-project="'+r.id+'">'+esc(r.title)+'</button>'],
      ['Journal', groups.journalEntries, r=>'<button type="button" class="tag-lens-row" data-goto-journal="'+r.id+'">'+esc(r.date)+' — '+esc((r.body||'').slice(0,60))+'</button>'],
      ['Notes', groups.quickNotes, r=>'<button type="button" class="tag-lens-row" data-goto-note="'+r.id+'">'+esc((r.text||'').slice(0,80))+'</button>']
    ];
    const body = document.getElementById('tagLensBody');
    if(!body) return;
    body.innerHTML = sections.map(([label, rows, fn])=>{
      if(!rows.length) return '';
      return '<div class="tag-lens-group"><h4>'+label+'</h4>'+rows.map(fn).join('')+'</div>';
    }).join('') || '<p class="dash-empty">Nothing carries this tag yet.</p>';
  }

  function openTagLens(tag){
    activeTag = tag;
    if(typeof openTagView === 'function') openTagView(tag);
    else if(typeof setMode === 'function'){ setMode('tag'); renderTagLens(tag); }
  }

  function bindTagEvents(){
    if(document.body.dataset.tagsBound) return;
    document.body.dataset.tagsBound = '1';

    document.addEventListener('click', e=>{
      const lens = e.target.closest('[data-tag-lens]');
      if(lens && !e.target.closest('.tag-editor')){ openTagLens(lens.dataset.tagLens); return; }

      const add = e.target.closest('[data-tag-add]');
      if(add){
        const row = add.closest('.dash-task-wrap, .proj-card, .dash-note-row');
        if(row && !row.querySelector('.tag-editor')){
          const ent = getEntity(add.dataset.tagAdd, add.dataset.tagId);
          const div = document.createElement('div');
          div.innerHTML = tagEditorHtml(add.dataset.tagAdd, add.dataset.tagId, ent?.tags||[]);
          row.appendChild(div.firstChild);
          row.querySelector('.tag-input')?.focus();
        }
        return;
      }

      const rm = e.target.closest('[data-tag-rm]');
      if(rm){
        const ed = rm.closest('.tag-editor');
        if(!ed || !faithStore) return;
        const type = ed.dataset.tagEditor;
        const id = ed.dataset.tagEid;
        const ent = getEntity(type, id);
        if(!ent) return;
        const next = (ent.tags||[]).filter(t=> t !== rm.dataset.tagRm);
        faithStore.updateEntityTags(type, id, next).then(()=>{
          refreshAfterTags(type);
          ed.outerHTML = tagEditorHtml(type, id, next);
        });
        return;
      }

      const goto = e.target.closest('[data-goto-task],[data-goto-seed],[data-goto-project],[data-goto-journal],[data-goto-note]');
      if(goto){
        if(goto.dataset.gotoTask) setMode('daily');
        else if(goto.dataset.gotoSeed) setMode('ideas');
        else if(goto.dataset.gotoProject) setMode('projects');
        else if(goto.dataset.gotoJournal) setMode('journal');
        else if(goto.dataset.gotoNote) setMode('dashboard');
        return;
      }

      if(e.target.closest('#tagLensBack')) setMode('dashboard');
    });

    document.addEventListener('keydown', async e=>{
      if(e.key !== 'Enter' || !e.target.classList.contains('tag-input')) return;
      const ed = e.target.closest('.tag-editor');
      if(!ed || !faithStore) return;
      const val = e.target.value.trim();
      if(!val) return;
      const type = ed.dataset.tagEditor;
      const id = ed.dataset.tagEid;
      const ent = getEntity(type, id);
      if(!ent) return;
      const next = [...new Set([...(ent.tags||[]), val])];
      await faithStore.updateEntityTags(type, id, next);
      e.target.value = '';
      refreshAfterTags(type);
      ed.outerHTML = tagEditorHtml(type, id, next);
      markDirty?.();
    });
  }

  function getEntity(type, id){
    if(!faithStore) return null;
    if(type==='task') return faithStore.getTask(id);
    if(type==='seed') return faithStore.getSeed(id);
    if(type==='project') return faithStore.getProject(id);
    if(type==='journal') return faithStore.data.journalEntries.find(j=> j.id===id);
    if(type==='note') return faithStore.data.quickNotes.find(n=> n.id===id);
    return null;
  }

  function refreshAfterTags(type){
    if(typeof renderDashboard === 'function') renderDashboard();
    if(typeof renderProjects === 'function') renderProjects();
    if(typeof renderSeedbed === 'function') renderSeedbed();
  }

  function loadTagLens(){
    if(activeTag) renderTagLens(activeTag);
  }

  root.tagChipsHtml = tagChipsHtml;
  root.semanticTagClass = semanticTagClass;
  root.tagEditorHtml = tagEditorHtml;
  root.openTagLens = openTagLens;
  root.renderTagLens = renderTagLens;
  root.loadTagLens = loadTagLens;
  root.bindTagEvents = bindTagEvents;
  root.getActiveTag = ()=> activeTag;
  root.setActiveTag = t=> { activeTag = t; };

})(typeof window !== 'undefined' ? window : globalThis);
