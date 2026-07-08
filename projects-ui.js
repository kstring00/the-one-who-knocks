/**
 * Projects tab — create, manage, archive
 */
(function(root){
  'use strict';

  let selectedProjectId = null;

  function renderProjects(){
    const el = document.getElementById('projectsList');
    if(!el || !faithStore) return;
    const seedSel = document.getElementById('projNewSeed');
    if(seedSel){
      seedSel.innerHTML = '<option value="">No linked seed</option>' +
        (faithStore.data.seeds || []).map(s=>'<option value="'+s.id+'">'+esc(s.title)+'</option>').join('');
    }
    const projects = faithStore.getActiveProjects();
    const newForm = document.getElementById('projNewForm');
    if(newForm && !document.body.dataset.projFormBound){
      document.body.dataset.projFormBound = '1';
      document.getElementById('projCreateBtn')?.addEventListener('click', createProjectFromForm);
      document.getElementById('projNewTitle')?.addEventListener('keydown', e=>{
        if(e.key === 'Enter') createProjectFromForm();
      });
    }
    if(!projects.length && !selectedProjectId){
      el.innerHTML = '<p class="dash-empty">No projects yet — create one above.</p>';
      return;
    }
    el.innerHTML = projects.map(p=> renderProjectCard(p)).join('');
    bindProjectCardEvents();
    if(selectedProjectId){
      const detail = document.getElementById('projDetailPanel');
      if(detail) detail.innerHTML = renderProjectDetail(selectedProjectId);
    }
  }

  function renderProjectCard(p){
    const pc = faithStore.getProjectPercentComplete(p.id);
    const tasks = faithStore.getTasksByProject(p.id);
    const done = tasks.filter(t=> t.completed).length;
    return '<article class="proj-card'+(selectedProjectId===p.id?' selected':'')+'" data-proj-id="'+p.id+'">'+
      '<div class="proj-card-head"><h4 class="serif">'+esc(p.title)+'</h4><span class="proj-pct">'+pc+'%</span></div>'+
      '<div class="dash-proj-bar"><div class="dash-proj-fill" style="width:'+pc+'%"></div></div>'+
      '<div class="proj-meta">'+done+' / '+tasks.length+' tasks</div>'+
      (typeof tagChipsHtml === 'function' ? tagChipsHtml(p.tags, { showAdd:true, entityType:'project', entityId:p.id }) : '')+
      '</article>';
  }

  function renderProjectDetail(projectId){
    const p = faithStore.getProject(projectId);
    if(!p) return '';
    const tasks = faithStore.getTasksByProject(projectId);
    const open = tasks.filter(t=> !t.completed);
    const done = tasks.filter(t=> t.completed);
    const pc = faithStore.getProjectPercentComplete(projectId);
    const seeds = faithStore.data.seeds || [];
    return '<div class="proj-detail">'+
      '<div class="proj-detail-head">'+
      '<input type="text" class="proj-rename-inp" id="projRenameInp" value="'+esc(p.title)+'" aria-label="Project title">'+
      '<button type="button" class="btn-ghost" id="projArchiveBtn">Archive</button></div>'+
      '<div class="proj-meta">'+pc+'% · '+done.length+' done · '+open.length+' open</div>'+
      '<div class="proj-task-group"><h5>Open</h5>'+
      (open.length ? open.map(t=> projTaskRow(t)).join('') : '<p class="dash-empty">No open tasks.</p>')+'</div>'+
      '<div class="proj-task-group"><h5>Done</h5>'+
      (done.length ? done.map(t=> projTaskRow(t)).join('') : '<p class="dash-empty">Nothing completed yet.</p>')+'</div>'+
      '<div class="dash-add-row"><input type="text" id="projAddTaskInp" placeholder="Add task to project…">'+
      '<input type="date" id="projAddTaskDate" title="Optional calendar date">'+
      '<button type="button" id="projAddTaskBtn">+ Add</button></div></div>';
  }

  function projTaskRow(t){
    return '<label class="dash-task'+(t.completed?' done':'')+'">'+
      '<input type="checkbox" data-proj-task="'+t.id+'"'+(t.completed?' checked':'')+'>'+
      '<span class="dash-task-text">'+esc(t.title)+'</span>'+
      (t.date ? '<span class="dash-dur">'+esc(t.date)+'</span>' : '')+
      '</label>';
  }

  function bindProjectCardEvents(){
    document.querySelectorAll('[data-proj-id]').forEach(card=>{
      card.onclick = e=>{
        if(e.target.closest('.tag-chip, .tag-add-btn, .tag-editor')) return;
        selectedProjectId = card.dataset.projId;
        renderProjects();
      };
    });
    document.getElementById('projRenameInp')?.addEventListener('change', async e=>{
      if(!selectedProjectId || !faithStore) return;
      faithStore.updateProject(selectedProjectId, { title: e.target.value.trim() });
      await faithStore.save();
      renderProjects();
      if(typeof renderCalendar === 'function') renderCalendar();
      markDirty?.();
    });
    document.getElementById('projArchiveBtn')?.addEventListener('click', async ()=>{
      if(!selectedProjectId || !faithStore) return;
      const title = faithStore.getProject(selectedProjectId)?.title;
      faithStore.archiveProject(selectedProjectId);
      await faithStore.save();
      selectedProjectId = null;
      renderProjects();
      if(typeof renderCalendar === 'function') renderCalendar();
      showProjToast('Archived “'+title+'”.');
      markDirty?.();
    });
    document.getElementById('projAddTaskBtn')?.addEventListener('click', addTaskToProject);
    document.getElementById('projDetailPanel')?.addEventListener('change', async e=>{
      const id = e.target.dataset?.projTask;
      if(!id || !faithStore) return;
      if(e.target.checked) await faithStore.completeTask(id);
      else await faithStore.uncompleteTask(id);
      renderProjects();
      if(typeof renderCalendar === 'function') renderCalendar();
    });
  }

  async function addTaskToProject(){
    const inp = document.getElementById('projAddTaskInp');
    const dateInp = document.getElementById('projAddTaskDate');
    const text = inp?.value.trim();
    if(!text || !selectedProjectId || !faithStore) return;
    faithStore.createTask({
      title: text,
      projectId: selectedProjectId,
      date: dateInp?.value || (typeof dashDateStr === 'function' ? dashDateStr() : iso(dayOf(0))),
      tag: 'project',
      timeSlot: 'beforeWork'
    });
    await faithStore.save();
    inp.value = '';
    if(dateInp) dateInp.value = '';
    renderProjects();
    if(typeof renderCalendar === 'function') renderCalendar();
    markDirty?.();
  }

  async function createProjectFromForm(){
    const title = document.getElementById('projNewTitle')?.value.trim();
    if(!title || !faithStore) return;
    const seedSel = document.getElementById('projNewSeed')?.value;
    const p = faithStore.createProject({
      title,
      linkedSeedId: seedSel || null,
      tags: []
    });
    await faithStore.save();
    document.getElementById('projNewTitle').value = '';
    selectedProjectId = p.id;
    renderProjects();
    if(typeof renderCalendar === 'function') renderCalendar();
    markDirty?.();
  }

  async function dashCreateProject(title){
    if(!title?.trim() || !faithStore) return;
    faithStore.createProject({ title: title.trim() });
    await faithStore.save();
    if(typeof renderCalendar === 'function') renderCalendar();
    markDirty?.();
  }

  function openProject(id){
    selectedProjectId = id;
    if(typeof setMode === 'function') setMode('projects');
    else renderProjects();
  }

  function showProjToast(msg){
    const t = document.getElementById('ideaToast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showProjToast._t);
    showProjToast._t = setTimeout(()=> t.classList.remove('show'), 3200);
  }

  function loadProjects(){
    renderProjects();
    const detail = document.getElementById('projDetailPanel');
    if(detail && selectedProjectId) detail.innerHTML = renderProjectDetail(selectedProjectId);
  }

  root.renderProjects = renderProjects;
  root.loadProjects = loadProjects;
  root.dashCreateProject = dashCreateProject;
  root.openProject = openProject;

})(typeof window !== 'undefined' ? window : globalThis);
