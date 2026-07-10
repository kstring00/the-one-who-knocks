/**
 * Projects tab — StewStore-backed project/task surface.
 *
 * Canonical source: fs-stewardship.
 * Legacy fs-core project/task records are migrated by StewStore and left
 * untouched as a rollback/verification backup.
 */
(function(root){
  'use strict';

  let selectedProjectId = null;
  let showArchived = false;

  function S(){ return root.StewStore; }
  function esc(s){ return typeof root.esc === 'function' ? root.esc(s) : String(s ?? ''); }
  function todayIso(){
    const d = new Date(); d.setHours(12,0,0,0); return d.toISOString().slice(0,10);
  }
  function parseTimeToMin(t){
    const p = String(t||'').match(/^(\d{1,2}):(\d{2})/);
    return p ? (+p[1])*60 + (+p[2]) : null;
  }
  function fmtDate(dateStr){
    if(!dateStr) return '';
    return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }
  function fmtProgress(p){
    const prog = S()?.projectProgress?.(p.id);
    if(!prog || prog.percent == null) return { label:'Not started', pct:0, meta:'No tasks or milestones yet' };
    return { label:prog.percent+'%', pct:prog.percent, meta:prog.done+' / '+prog.total+' complete' };
  }
  function syncAfterChange(){
    S()?.save?.();
    root.markDirty?.();
    if(typeof root.renderCalendar === 'function') root.renderCalendar();
  }

  function projectList(){
    const all = S()?.getProjects?.(null, { includeArchived:true }) || [];
    const visible = showArchived ? all : all.filter(p=>p.status!=='archived' && !p.archived);
    return visible.sort((a,b)=>(a.status==='done')-(b.status==='done') || (b.updatedAt||'').localeCompare(a.updatedAt||''));
  }

  function renderProjects(){
    const el = document.getElementById('projectsList');
    if(!el || !S()) return;
    S().init?.();
    populateSeedSelect();
    bindProjectShell();
    const projects = projectList();
    if(selectedProjectId && !S().getProject(selectedProjectId)) selectedProjectId = null;
    if(!selectedProjectId && projects.length) selectedProjectId = projects[0].id;
    el.innerHTML = projects.length ? projects.map(renderProjectCard).join('')
      : emptyStateHtml('projects', 'A project gives related work one defined outcome.');
    const detail = document.getElementById('projDetailPanel');
    if(detail) detail.innerHTML = selectedProjectId ? renderProjectDetail(selectedProjectId)
      : '<div class="proj-detail-empty">'+emptyStateHtml('projects', 'A project gives related work one defined outcome.')+'</div>';
  }

  function emptyStateHtml(type, text){
    if(typeof root.emptyState === 'function') return root.emptyState(type, text);
    return '<p class="dash-empty app-empty-state">'+esc(text)+'</p>';
  }

  function populateSeedSelect(){
    const seedSel = document.getElementById('projNewSeed');
    if(!seedSel) return;
    const seeds = root.faithStore?.data?.seeds || [];
    seedSel.innerHTML = '<option value="">No related seed/idea</option>' +
      seeds.map(s=>'<option value="'+esc(s.legacyIdeaId || s.id)+'">'+esc(s.title)+'</option>').join('');
  }

  function renderProjectCard(p){
    const prog = fmtProgress(p);
    const goal = p.goalId && S().getGoal(p.goalId);
    return '<article class="proj-card'+(selectedProjectId===p.id?' selected':'')+'" data-proj-id="'+esc(p.id)+'">'+
      '<div class="proj-card-head"><h4 class="serif">'+esc(p.title || 'Untitled project')+'</h4><span class="proj-pct">'+esc(prog.label)+'</span></div>'+
      '<div class="dash-proj-bar"><div class="dash-proj-fill" style="width:'+prog.pct+'%"></div></div>'+
      '<div class="proj-meta">'+esc(prog.meta)+(goal?' · '+esc(goal.title):'')+(p.status==='archived'?' · Archived':'')+'</div>'+
      (p.definedOutcome?'<p class="proj-preview">'+esc(p.definedOutcome)+'</p>':'')+
      '</article>';
  }

  function optionHtml(options, value){
    return options.map(o=>'<option value="'+esc(o[0])+'"'+(String(o[0])===String(value||'')?' selected':'')+'>'+esc(o[1])+'</option>').join('');
  }

  function renderProjectDetail(projectId){
    const p = S().getProject(projectId);
    if(!p) return '';
    const prog = fmtProgress(p);
    const goals = S().getGoals();
    const tasks = S().getTasks({projectId:p.id}).filter(t=>t.status!=='archived');
    const open = tasks.filter(t=>t.status!=='done');
    const done = tasks.filter(t=>t.status==='done');
    const events = S().getEvents().filter(e=>e.projectId===p.id || e.taskIds.some(tid=>tasks.some(t=>t.id===tid)));
    const lifeAreas = [['','—']].concat(S().LIFE_AREAS.map(a=>[a,a]));
    return '<div class="proj-detail" data-proj-detail="'+esc(p.id)+'">'+
      '<div class="proj-definition">A project is a connected body of work with a defined outcome. It is larger than a task and more concrete than a goal.</div>'+
      '<div class="proj-detail-head">'+
      '<input type="text" class="proj-rename-inp" data-proj-field="title" value="'+esc(p.title)+'" aria-label="Project title">'+
      statusControls(p)+'</div>'+
      '<div class="proj-progress-row"><div class="dash-proj-bar"><div class="dash-proj-fill" style="width:'+prog.pct+'%"></div></div><span>'+esc(prog.meta)+'</span></div>'+
      '<div class="proj-detail-grid">'+
      '<label>Defined outcome<textarea data-proj-field="definedOutcome" rows="2" placeholder="What will be true when this is done?">'+esc(p.definedOutcome)+'</textarea></label>'+
      '<label>Why it matters<textarea data-proj-field="whyItMatters" rows="2" placeholder="Why is this worth carrying?">'+esc(p.whyItMatters)+'</textarea></label>'+
      '<label>Vision<textarea data-proj-field="vision" rows="2" placeholder="What direction does this serve?">'+esc(p.vision)+'</textarea></label>'+
      '<label>Related goal<select data-proj-field="goalId">'+optionHtml([['','—']].concat(goals.map(g=>[g.id,g.title])), p.goalId)+'</select></label>'+
      '<label>Life area<select data-proj-field="lifeArea">'+optionHtml(lifeAreas, p.lifeArea)+'</select></label>'+
      '<label>Target date<input type="date" data-proj-field="targetDate" value="'+esc(p.targetDate)+'"></label>'+
      '</div>'+
      '<div class="proj-task-group"><h5>Milestones</h5>'+
      (p.milestones.length ? p.milestones.slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(renderMilestone).join('') : emptyStateHtml('projects', 'Milestones mark the path without pretending the whole project is one task.'))+
      '<div class="dash-add-row"><input type="text" id="projAddMilestoneInp" placeholder="Add milestone…"><input type="date" id="projAddMilestoneDate"><button type="button" id="projAddMilestoneBtn">+ Add</button></div></div>'+
      '<div class="proj-task-group"><h5>Open tasks</h5>'+
      (open.length ? open.map(projTaskRow).join('') : emptyStateHtml('projects', 'A task is one physical next action.'))+
      '<div class="dash-add-row"><input type="text" id="projAddTaskInp" placeholder="Add task to project…"><input type="date" id="projAddTaskDate" title="Optional due date"><button type="button" id="projAddTaskBtn">+ Add</button></div></div>'+
      '<div class="proj-task-group"><h5>Completed tasks</h5>'+
      (done.length ? done.map(projTaskRow).join('') : '<p class="dash-empty app-empty-state">Completed work will gather here.</p>')+'</div>'+
      '<div class="proj-task-group"><h5>Related calendar blocks</h5>'+
      (events.length ? events.slice(0,6).map(e=>'<div class="proj-event-row">'+esc(fmtDate(e.date))+' · '+esc(e.title)+'</div>').join('') : '<p class="dash-empty app-empty-state">Scheduling a task creates a calendar block without deleting the task.</p>')+'</div>'+
      '<label class="proj-notes-label">Notes<textarea data-proj-field="notes" rows="4" placeholder="Links, decisions, context…">'+esc(p.notes)+'</textarea></label>'+
      '</div>';
  }

  function statusControls(p){
    if(p.status === 'archived'){
      return '<button type="button" class="btn-ghost" data-proj-act="restore">Restore</button>';
    }
    return '<button type="button" class="btn-ghost" data-proj-act="complete">'+(p.status==='done'?'Reopen':'Mark complete')+'</button>'+
      '<button type="button" class="btn-ghost" data-proj-act="archive">Archive</button>';
  }

  function renderMilestone(m){
    return '<label class="proj-milestone'+(m.done?' done':'')+'">'+
      '<input type="checkbox" data-proj-mile="'+esc(m.id)+'"'+(m.done?' checked':'')+'>'+
      '<span>'+esc(m.title)+'</span>'+(m.dueDate?'<small>'+esc(fmtDate(m.dueDate))+'</small>':'')+'</label>';
  }

  function projTaskRow(t){
    return '<div class="dash-task proj-task-row'+(t.status==='done'?' done':'')+'" data-proj-task-row="'+esc(t.id)+'">'+
      '<label><input type="checkbox" data-proj-task="'+esc(t.id)+'"'+(t.status==='done'?' checked':'')+'>'+
      '<span class="dash-task-text">'+esc(t.title)+'</span></label>'+
      (t.dueDate ? '<span class="dash-dur">'+esc(fmtDate(t.dueDate))+'</span>' : '')+
      '<button type="button" class="btn-ghost proj-mini" data-proj-schedule="'+esc(t.id)+'">Schedule</button>'+
      '<details class="proj-subtasks"><summary>Subtasks</summary>'+
      (t.subtasks.length ? t.subtasks.map(s=>'<label class="stew-subtask'+(s.done?' done':'')+'"><input type="checkbox" data-proj-sub="'+esc(s.id)+'" data-task-id="'+esc(t.id)+'"'+(s.done?' checked':'')+'>'+esc(s.text)+'</label>').join('') : '<p class="dash-empty">No subtasks.</p>')+
      '<div class="dash-add-row"><input type="text" data-proj-add-sub="'+esc(t.id)+'" placeholder="Add subtask — Enter"></div></details>'+
      '</div>';
  }

  function bindProjectShell(){
    const panel = document.getElementById('projectsPanel');
    if(!panel || panel.dataset.projBound) return;
    panel.dataset.projBound = '1';
    document.getElementById('projCreateBtn')?.addEventListener('click', createProjectFromForm);
    document.getElementById('projNewTitle')?.addEventListener('keydown', e=>{
      if(e.key === 'Enter') createProjectFromForm();
    });
    panel.addEventListener('click', async e=>{
      const card = e.target.closest('[data-proj-id]');
      if(card){ selectedProjectId = card.dataset.projId; renderProjects(); return; }
      if(e.target.closest('#projAddTaskBtn')){ addTaskToProject(); return; }
      if(e.target.closest('#projAddMilestoneBtn')){ addMilestoneToProject(); return; }
      const act = e.target.closest('[data-proj-act]');
      if(act && selectedProjectId){
        const p = S().getProject(selectedProjectId);
        if(act.dataset.projAct === 'archive') S().archiveProject(selectedProjectId);
        if(act.dataset.projAct === 'restore') S().restoreProject(selectedProjectId);
        if(act.dataset.projAct === 'complete'){
          if(p?.status === 'done') S().restoreProject(selectedProjectId);
          else S().completeProject(selectedProjectId);
        }
        syncAfterChange(); renderProjects(); return;
      }
      const sched = e.target.closest('[data-proj-schedule]');
      if(sched){ scheduleTaskPrompt(sched.dataset.projSchedule); return; }
    });
    panel.addEventListener('input', e=>{
      const field = e.target.dataset?.projField;
      if(field && selectedProjectId){
        S().updateProject(selectedProjectId, { [field]: e.target.value });
        syncAfterChange();
      }
    });
    panel.addEventListener('change', e=>{
      const id = e.target.dataset?.projTask;
      if(id){ S().updateTask(id, { status:e.target.checked?'done':'todo' }); syncAfterChange(); renderProjects(); return; }
      const mile = e.target.dataset?.projMile;
      if(mile && selectedProjectId){ S().toggleProjectMilestone(selectedProjectId, mile); syncAfterChange(); renderProjects(); return; }
      const sub = e.target.dataset?.projSub;
      if(sub){ S().toggleSubtask(e.target.dataset.taskId, sub); syncAfterChange(); renderProjects(); }
    });
    panel.addEventListener('keydown', e=>{
      const sub = e.target.dataset?.projAddSub;
      if(sub && e.key === 'Enter' && e.target.value.trim()){
        e.preventDefault();
        S().addSubtask(sub, e.target.value.trim());
        syncAfterChange(); renderProjects();
      }
    });
  }

  function createProjectFromForm(){
    const title = document.getElementById('projNewTitle')?.value.trim();
    if(!title || !S()) return;
    const relatedIdeaId = document.getElementById('projNewSeed')?.value || null;
    const p = S().createProject({ title, relatedIdeaId });
    document.getElementById('projNewTitle').value = '';
    selectedProjectId = p.id;
    syncAfterChange();
    renderProjects();
  }

  function addTaskToProject(){
    const inp = document.getElementById('projAddTaskInp');
    const dateInp = document.getElementById('projAddTaskDate');
    const text = inp?.value.trim();
    if(!text || !selectedProjectId || !S()) return;
    const p = S().getProject(selectedProjectId);
    S().createTask({
      title: text,
      projectId: selectedProjectId,
      goalId: p?.goalId || null,
      dueDate: dateInp?.value || '',
      urgency: dateInp?.value === todayIso() ? 'today' : 'week'
    });
    inp.value = '';
    if(dateInp) dateInp.value = '';
    syncAfterChange();
    renderProjects();
  }

  function addMilestoneToProject(){
    const inp = document.getElementById('projAddMilestoneInp');
    const dateInp = document.getElementById('projAddMilestoneDate');
    const title = inp?.value.trim();
    if(!title || !selectedProjectId || !S()) return;
    S().addProjectMilestone(selectedProjectId, title, dateInp?.value || '');
    inp.value = '';
    if(dateInp) dateInp.value = '';
    syncAfterChange();
    renderProjects();
  }

  function scheduleTaskPrompt(taskId){
    const t = S().getTask(taskId); if(!t) return;
    const date = prompt('Schedule for which date? (YYYY-MM-DD)', t.dueDate || todayIso());
    if(!date) return;
    const time = prompt('Start time? (HH:MM)', '');
    const start = parseTimeToMin(time);
    if(start == null){ alert('Add a start time before scheduling.'); return; }
    const durStr = prompt('Duration in minutes?', String(t.durationMin || 45));
    const dur = Math.max(15, parseInt(durStr || '45', 10) || 45);
    S().updateTask(taskId, { durationMin:dur, dueDate:date });
    S().scheduleTask(taskId, date, start);
    syncAfterChange();
    renderProjects();
  }

  async function dashCreateProject(title){
    if(!title?.trim() || !S()) return;
    S().createProject({ title: title.trim() });
    syncAfterChange();
  }

  function openProject(id){
    selectedProjectId = id;
    if(typeof root.setMode === 'function') root.setMode('projects');
    else renderProjects();
  }

  function loadProjects(){ renderProjects(); }

  root.renderProjects = renderProjects;
  root.loadProjects = loadProjects;
  root.dashCreateProject = dashCreateProject;
  root.openProject = openProject;

})(typeof window !== 'undefined' ? window : globalThis);
