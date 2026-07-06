/**
 * Mentorship — principles, vault, sessions, threads
 */
(function(root){
  'use strict';

  const TIME_SLOTS = [
    { id:'beforeWork', label:'Before Work' },
    { id:'duringWork', label:'During Work' },
    { id:'afterWork', label:'After Work' },
    { id:'eveningShutdown', label:'Evening Shutdown' },
    { id:'timed', label:'Timed' }
  ];

  let expandedPrinciples = new Set();
  let activeForms = {};
  let prepView = false;
  let dragQuestionId = null;

  function mentorViewId(mentorId){ return 'mentorship-' + mentorId; }
  function parseMentorshipView(mode){
    if(mode === 'mentorship-threads') return { type:'threads' };
    if(mode && mode.startsWith('mentorship-')) return { type:'mentor', mentorId: mode.slice('mentorship-'.length) };
    return null;
  }
  function isMentorshipMode(mode){
    const m = mode || (typeof viewMode !== 'undefined' ? viewMode : '');
    return String(m).startsWith('mentorship');
  }

  function renderMentorshipNav(){
    const sub = document.getElementById('navMentorshipSub');
    if(!sub || !faithStore) return;
    faithStore.ensureDefaultMentors();
    const mentors = faithStore.getMentors();
    let html = '<button type="button" data-nav="mentorship-threads"><span class="nav-icon" aria-hidden="true">◎</span><span>Threads</span></button>';
    mentors.forEach(m=>{
      html += '<button type="button" data-nav="mentorship-'+m.id+'"><span class="nav-icon" aria-hidden="true">✦</span><span>'+esc(m.label)+'</span></button>';
    });
    sub.innerHTML = html;
    updateSidebarNav?.();
  }

  function renderMentorSettings(){
    const el = document.getElementById('mentorSettings');
    if(!el || !faithStore) return;
    faithStore.ensureDefaultMentors();
    el.innerHTML = faithStore.getMentors().map((m,i)=>
      '<div class="mentor-row" data-mentor-row data-mentor-idx="'+i+'">'+
      '<input type="text" data-mentor-label value="'+esc(m.label)+'" placeholder="Label" aria-label="Label">'+
      '<input type="text" data-mentor-role value="'+esc(m.role)+'" placeholder="Role" aria-label="Role">'+
      '<input type="text" data-mentor-name value="'+esc(m.name)+'" placeholder="Name (optional)" aria-label="Name">'+
      '<button type="button" class="ff-rm" data-mentor-rm aria-label="Remove">×</button></div>'
    ).join('');
  }

  async function saveMentorSettingsFromDOM(){
    if(!faithStore) return;
    const rows = [...document.querySelectorAll('#mentorSettings [data-mentor-row]')];
    const prev = faithStore.getMentors();
    const cfg = rows.map((row,i)=>({
      id: prev[i]?.id || uid(),
      label: row.querySelector('[data-mentor-label]')?.value.trim() || 'M',
      role: row.querySelector('[data-mentor-role]')?.value.trim() || '',
      name: row.querySelector('[data-mentor-name]')?.value.trim() || '',
      nextSessionDate: prev[i]?.nextSessionDate || '',
      sortOrder: i
    }));
    faithStore.setMentorConfig(cfg);
    await faithStore.save();
    renderMentorshipNav();
    if(isMentorshipMode()) renderMentorship();
    markDirty?.();
  }

  function themeTagHtml(tags){
    return (tags||[]).map(t=>'<span class="ms-theme-tag">'+esc(t)+'</span>').join('');
  }

  function slotChipsHtml(selected, dataAttr){
    return TIME_SLOTS.map(s=>
      '<button type="button" class="ms-slot-chip'+(selected===s.id?' on':'')+'" '+dataAttr+'="'+s.id+'">'+esc(s.label)+'</button>'
    ).join('');
  }

  function renderApplicationTimeline(principleId){
    const apps = faithStore.getApplicationsByPrinciple(principleId);
    if(!apps.length) return '<p class="ms-muted">No applications yet.</p>';
    return '<div class="ms-app-timeline">'+apps.map(a=>
      '<div class="ms-app-row"><span class="ms-app-date">'+esc(a.date)+'</span><span class="ms-app-note">'+esc(a.note || '(no note)')+'</span></div>'
    ).join('')+'</div>';
  }

  function renderPrincipleCard(p){
    const open = expandedPrinciples.has(p.id);
    const appCount = faithStore.getApplicationCount(p.id);
    const form = activeForms[p.id];
    return '<article class="ms-principle-card'+(open?' open':'')+'" id="ms-principle-'+p.id+'" data-principle-id="'+p.id+'">'+
      '<div class="ms-principle-head">'+
      '<button type="button" class="ms-principle-toggle" data-ms-expand="'+p.id+'">'+
      (appCount ? '<span class="ms-leaf-badge" title="'+appCount+' application(s)">🍃 '+appCount+'</span>' : '')+
      '<span class="ms-principle-title">'+esc(p.title || '(Untitled principle)')+'</span>'+
      '<span class="ms-chev">'+(open?'−':'+')+'</span></button></div>'+
      (open ? '<div class="ms-principle-body">'+
        (p.detailBullets.length ? '<ul class="ms-bullets">'+p.detailBullets.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>' : '')+
        (p.themeTags.length ? '<div class="ms-theme-tags">'+themeTagHtml(p.themeTags)+'</div>' : '')+
        '<div class="ms-app-section"><h5>Applications</h5>'+renderApplicationTimeline(p.id)+'</div>'+
        '<div class="ms-principle-actions">'+
        '<button type="button" class="btn-ghost ms-action-btn" data-ms-work="'+p.id+'">Put it to work</button>'+
        '<button type="button" class="btn-ghost ms-action-btn" data-ms-log="'+p.id+'">Log it</button>'+
        '</div>'+
        (form === 'work' ? renderWorkForm(p) : '')+
        (form === 'log' ? renderLogForm(p) : '')+
      '</div>' : '')+
      '</article>';
  }

  function renderWorkForm(p){
    const f = activeForms['work-'+p.id] || { title: p.title, date: todayIso(), slot:'beforeWork' };
    return '<div class="ms-inline-form" data-ms-work-form="'+p.id+'">'+
      '<input type="text" data-ms-work-title value="'+esc(f.title)+'" placeholder="Task title">'+
      '<input type="date" data-ms-work-date value="'+esc(f.date)+'">'+
      '<div class="ms-slot-chips">'+slotChipsHtml(f.slot, 'data-ms-work-slot')+'</div>'+
      '<button type="button" class="btn-gold" data-ms-work-save="'+p.id+'">Create task</button>'+
      '<button type="button" class="btn-ghost" data-ms-form-cancel="'+p.id+'">Cancel</button></div>';
  }

  function renderLogForm(p){
    return '<div class="ms-inline-form" data-ms-log-form="'+p.id+'">'+
      '<textarea rows="2" data-ms-log-note placeholder="What came of it?"></textarea>'+
      '<input type="date" data-ms-log-date value="'+todayIso()+'">'+
      '<button type="button" class="btn-gold" data-ms-log-save="'+p.id+'">Save application</button>'+
      '<button type="button" class="btn-ghost" data-ms-form-cancel="'+p.id+'">Cancel</button></div>';
  }

  function renderPrincipleLibrary(mentorId){
    const groups = faithStore.getPrinciplesGroupedByQuestion(mentorId);
    const keys = Object.keys(groups);
    if(!keys.length){
      return '<p class="dash-empty">No principles yet — mark a queued question as asked or import your notes.</p>';
    }
    return keys.map(q=>
      '<section class="ms-question-group" id="ms-q-'+hashStr(q)+'">'+
      '<h4 class="serif ms-q-head">'+esc(q)+'</h4>'+
      groups[q].map(renderPrincipleCard).join('')+
      '</section>'
    ).join('');
  }

  function hashStr(s){
    let h = 0;
    for(let i=0;i<s.length;i++) h = ((h<<5)-h)+s.charCodeAt(i) | 0;
    return 'h'+Math.abs(h);
  }

  function renderQuestionVault(mentorId){
    const asked = faithStore.getAskedQuestions(mentorId);
    const queued = faithStore.getQueuedQuestions(mentorId);
    return '<section class="ms-section"><h3 class="serif">Question Vault</h3>'+
      '<div class="ms-vault-col"><h5>Asked</h5>'+
      (asked.length ? asked.map(q=>{
        const gid = hashStr(q.text);
        return '<button type="button" class="ms-vault-link" data-ms-scroll-q="'+gid+'">'+esc(q.text)+'</button>';
      }).join('') : '<p class="ms-muted">Nothing asked yet.</p>')+
      '</div>'+
      '<div class="ms-vault-col"><h5>Queued for next session</h5>'+
      '<div class="ms-queue-list" data-ms-queue="'+mentorId+'">'+
      queued.map((q,i)=>
        '<div class="ms-queue-row" draggable="true" data-ms-qid="'+q.id+'" data-ms-qidx="'+i+'">'+
        '<span class="ms-drag">⋮⋮</span><span class="ms-q-text">'+esc(q.text)+'</span>'+
        '<button type="button" class="ms-sched-btn" data-ms-q-up="'+q.id+'" title="Up">↑</button>'+
        '<button type="button" class="ms-sched-btn" data-ms-q-down="'+q.id+'" title="Down">↓</button>'+
        '<button type="button" class="btn-ghost ms-ask-btn" data-ms-mark-asked="'+q.id+'">Mark asked</button>'+
        '<button type="button" class="ff-rm" data-ms-q-del="'+q.id+'">×</button></div>'
      ).join('')+
      '</div>'+
      '<div class="ms-queue-add"><input type="text" data-ms-q-add="'+mentorId+'" placeholder="Add a question for next session…">'+
      '<button type="button" class="btn-gold" data-ms-q-add-btn="'+mentorId+'">+</button></div>'+
      '</div></section>';
  }

  function renderSessionLog(mentorId){
    const mentor = faithStore.getMentor(mentorId);
    const sessions = faithStore.getSessionsByMentor(mentorId);
    const prep = prepView ? faithStore.buildSessionPrepText(mentorId) : '';
    return '<section class="ms-section"><div class="ms-section-head">'+
      '<h3 class="serif">Session Log</h3>'+
      '<div class="ms-session-tools">'+
      '<label class="ms-prep-toggle"><input type="checkbox" data-ms-prep-toggle'+(prepView?' checked':'')+'> Prep view</label>'+
      '<button type="button" class="btn-gold" data-ms-new-session="'+mentorId+'">New session</button>'+
      '</div></div>'+
      (prepView ? '<div class="ms-prep-box"><pre class="ms-prep-text" id="msPrepText">'+esc(prep)+'</pre>'+
      '<button type="button" class="btn-ghost" data-ms-copy-prep="'+mentorId+'">Copy prep</button></div>' : '')+
      (mentor?.nextSessionDate ? '<p class="ms-next-session">Next session: <input type="date" data-ms-next-date="'+mentorId+'" value="'+esc(mentor.nextSessionDate)+'"></p>' : 
        '<p class="ms-next-session">Next session: <input type="date" data-ms-next-date="'+mentorId+'" value=""></p>')+
      (sessions.length ? sessions.map(renderSessionCard).join('') : '<p class="dash-empty">No sessions logged yet.</p>')+
      '</section>';
  }

  function renderSessionCard(s){
    const apps = (s.attachedApplicationIds||[]).map(id=> faithStore.data.applications.find(a=> a.id===id)).filter(Boolean);
    const qs = (s.attachedQuestionIds||[]).map(id=> faithStore.data.queuedQuestions.find(q=> q.id===id)).filter(Boolean);
    return '<article class="ms-session-card">'+
      '<div class="ms-session-head"><strong>'+esc(s.date)+'</strong></div>'+
      (s.notes ? '<div class="ms-session-notes">'+esc(s.notes)+'</div>' : '')+
      (apps.length ? '<div class="ms-session-att"><h5>Applications since last session</h5>'+
        apps.map(a=>{
          const p = faithStore.getPrinciple(a.principleId);
          return '<div class="ms-app-row"><span class="ms-app-date">'+esc(a.date)+'</span> '+esc(p?.title||'')+' — '+esc(a.note||'')+'</div>';
        }).join('')+'</div>' : '')+
      (qs.length ? '<div class="ms-session-att"><h5>Questions marked asked</h5><ul>'+qs.map(q=>'<li>'+esc(q.text)+'</li>').join('')+'</ul></div>' : '')+
      '</article>';
  }

  function renderMentorPage(mentorId){
    const m = faithStore.getMentor(mentorId);
    if(!m) return '<p class="dash-empty">Mentor not found.</p>';
    const stats = faithStore.getMentorStats(mentorId);
    return '<div class="ms-mentor-page" data-mentor-page="'+mentorId+'">'+
      '<header class="ms-page-head">'+
      '<div><h2 class="serif">'+esc(m.label)+'</h2>'+
      '<p class="ms-role">'+esc(m.role)+(m.name ? ' · '+esc(m.name) : '')+'</p></div>'+
      '<div class="ms-stats">'+stats.total+' principle'+(stats.total===1?'':'s')+' · '+stats.practiced+' put to work</div>'+
      '</header>'+
      '<section class="ms-section"><h3 class="serif">Principle Library</h3>'+renderPrincipleLibrary(mentorId)+'</section>'+
      renderQuestionVault(mentorId)+
      renderSessionLog(mentorId)+
      '</div>';
  }

  function renderThreadsView(){
    const threads = faithStore.getThreadsGrouped().filter(g=> g.tag !== 'untagged' || g.principles.length);
    if(!threads.length){
      return '<p class="dash-empty">No themed principles yet — tags appear as you import or add principles.</p>';
    }
    return '<div class="ms-threads">'+
      threads.map(g=>
        '<section class="ms-thread-group"><h3 class="serif ms-thread-title">'+esc(g.tag)+'</h3>'+
        '<div class="ms-thread-grid">'+
        g.principles.map(p=>{
          const m = faithStore.getMentor(p.mentorId);
          const apps = faithStore.getApplicationCount(p.id);
          return '<button type="button" class="ms-thread-card" data-ms-goto-principle="'+p.id+'" data-ms-goto-mentor="'+p.mentorId+'">'+
            '<span class="ms-thread-mentor">'+esc(m?.label||'?')+'</span>'+
            '<span class="ms-thread-principle">'+esc(p.title || p.sourceQuestion)+'</span>'+
            (apps ? '<span class="ms-leaf-badge">🍃 '+apps+'</span>' : '')+
            '</button>';
        }).join('')+
        '</div></section>'
      ).join('')+'</div>';
  }

  function renderMentorship(){
    const panel = document.getElementById('mentorshipPanel');
    if(!panel || !faithStore) return;
    MentorshipSeed?.ensureMentorshipReady(faithStore);
    renderMentorshipNav();
    const view = parseMentorshipView(viewMode);
    if(!view){
      panel.innerHTML = '<p class="dash-empty">Select a mentor.</p>';
      return;
    }
    if(view.type === 'threads'){
      panel.innerHTML = '<div class="page-head"><div><h2 class="serif">Threads</h2><p>Principles grouped by theme across mentors.</p></div></div>'+renderThreadsView();
      return;
    }
    panel.innerHTML = renderMentorPage(view.mentorId);
    const hash = location.hash.replace('#','');
    if(hash.startsWith('ms-principle-')){
      const el = document.getElementById(hash);
      if(el){ expandedPrinciples.add(hash.replace('ms-principle-','')); el.scrollIntoView({ behavior:'smooth', block:'start' }); }
    }
  }

  function todayIso(){
    const d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function showPrincipleHarvestPrompt(taskId){
    const task = faithStore?.getTask(taskId);
    if(!task?.principleId) return;
    const existing = document.getElementById('msHarvestPrompt');
    if(existing) existing.remove();
    const p = faithStore.getPrinciple(task.principleId);
    const div = document.createElement('div');
    div.id = 'msHarvestPrompt';
    div.className = 'ms-harvest-prompt';
    div.innerHTML = '<div class="ms-harvest-inner">'+
      '<p><strong>What came of it?</strong><br><span class="ms-muted">'+esc(p?.title||task.title)+'</span></p>'+
      '<textarea rows="2" id="msHarvestNote" placeholder="Brief note on how this principle played out…"></textarea>'+
      '<div class="ms-harvest-actions">'+
      '<button type="button" class="btn-gold" id="msHarvestSave">Save</button>'+
      '<button type="button" class="btn-ghost" id="msHarvestSkip">Skip</button></div></div>';
    document.body.appendChild(div);
    document.getElementById('msHarvestSave').onclick = async ()=>{
      const note = document.getElementById('msHarvestNote')?.value.trim();
      faithStore.completePrincipleHarvest(taskId, note || task.title);
      await faithStore.save();
      div.remove();
      renderMentorship?.();
      renderDashboard?.();
      markDirty?.();
    };
    document.getElementById('msHarvestSkip').onclick = ()=> div.remove();
    document.getElementById('msHarvestNote')?.focus();
  }

  function wrapCompleteTask(){
    if(!faithStore || faithStore._principleWrapped) return;
    const orig = faithStore.completeTask.bind(faithStore);
    faithStore.completeTask = async function(id, opts){
      const r = await orig(id, opts);
      if(r.needsPrincipleHarvest) showPrincipleHarvestPrompt(id);
      return r;
    };
    faithStore._principleWrapped = true;
  }

  function renderDangerMentorSuggestions(){
    const row = document.getElementById('dangerMentorSuggest');
    if(!row || !faithStore || !dayData) return;
    const danger = dayData.danger?.danger || '';
    const matches = faithStore.matchPrinciplesForDanger(danger, 3);
    if(!danger.trim() || !matches.length){
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    row.hidden = false;
    row.innerHTML = '<span class="ms-borrow-label">Borrow from mentors:</span>'+
      matches.map(p=>{
        const m = faithStore.getMentor(p.mentorId);
        return '<button type="button" class="ms-borrow-chip" data-ms-borrow="'+p.id+'">'+
          esc(m?.label||'')+': '+esc(p.title)+'</button>';
      }).join('');
  }

  async function applyBorrowedPrinciple(principleId){
    const p = faithStore.getPrinciple(principleId);
    if(!p || !dayData) return;
    const title = p.title || p.sourceQuestion;
    dayData.danger.thenWill = dayData.danger.thenWill
      ? dayData.danger.thenWill.trim() + ' — ' + title
      : title;
    dayData.danger.borrowedPrincipleId = principleId;
    const inp = document.querySelector('[data-field="danger.thenWill"]');
    if(inp) inp.value = dayData.danger.thenWill;
    updateDangerReminder?.();
    markDirty?.();
  }

  async function onGuardrailKept(checked){
    if(!checked || !dayData?.danger?.borrowedPrincipleId || !faithStore) return;
    const pid = dayData.danger.borrowedPrincipleId;
    const note = 'Guardrail kept — ' + (dayData.danger.thenWill || '');
    faithStore.logPrincipleApplication(pid, { note, date: iso(dayOf(dayOffset)) });
    await faithStore.save();
    dayData.danger.borrowedPrincipleId = null;
    renderMentorship?.();
    markDirty?.();
  }

  function bindMentorshipEvents(){
    if(document.body.dataset.msBound) return;
    document.body.dataset.msBound = '1';
    wrapCompleteTask();

    document.getElementById('mentorAddBtn')?.addEventListener('click', async ()=>{
      if(!faithStore) return;
      faithStore.createMentor({ label:'M'+(faithStore.getMentors().length+1), role:'', name:'' });
      await faithStore.save();
      renderMentorSettings();
      renderMentorshipNav();
      markDirty?.();
    });

    document.getElementById('mentorSettings')?.addEventListener('click', async e=>{
      if(e.target.closest('[data-mentor-rm]')){
        const row = e.target.closest('[data-mentor-row]');
        const idx = +row?.dataset.mentorIdx;
        const m = faithStore.getMentors()[idx];
        if(m && confirm('Remove mentor “'+m.label+'” and all their principles?')){
          faithStore.deleteMentor(m.id);
          await faithStore.save();
          renderMentorSettings();
          renderMentorshipNav();
          markDirty?.();
        }
      }
    });
    document.getElementById('mentorSettings')?.addEventListener('input', ()=>{
      clearTimeout(bindMentorshipEvents._saveT);
      bindMentorshipEvents._saveT = setTimeout(saveMentorSettingsFromDOM, 400);
    });

    document.getElementById('mentorshipPanel')?.addEventListener('dragstart', e=>{
      const row = e.target.closest('[data-ms-qid]');
      if(!row) return;
      dragQuestionId = row.dataset.msQid;
      e.dataTransfer.effectAllowed = 'move';
    });
    document.getElementById('mentorshipPanel')?.addEventListener('dragover', e=>{
      if(!e.target.closest('[data-ms-qid]')) return;
      e.preventDefault();
    });
    document.getElementById('mentorshipPanel')?.addEventListener('drop', async e=>{
      const target = e.target.closest('[data-ms-qid]');
      if(!target || !dragQuestionId || dragQuestionId === target.dataset.msQid) return;
      e.preventDefault();
      const mid = parseMentorshipView(viewMode)?.mentorId;
      if(!mid) return;
      const qs = faithStore.getQueuedQuestions(mid);
      const ids = qs.map(q=> q.id);
      const from = ids.indexOf(dragQuestionId);
      const to = ids.indexOf(target.dataset.msQid);
      if(from < 0 || to < 0) return;
      ids.splice(from, 1);
      ids.splice(to, 0, dragQuestionId);
      faithStore.reorderQueuedQuestions(mid, ids);
      await faithStore.save();
      dragQuestionId = null;
      renderMentorship();
      markDirty?.();
    });
    document.getElementById('mentorshipPanel')?.addEventListener('click', handleMentorshipClick);
    document.getElementById('mentorshipPanel')?.addEventListener('change', handleMentorshipChange);
    document.getElementById('mentorshipPanel')?.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && e.target.matches('[data-ms-q-add]')){
        e.preventDefault();
        const mid = e.target.dataset.msQAdd;
        document.querySelector('[data-ms-q-add-btn="'+mid+'"]')?.click();
      }
    });

    document.getElementById('dailyMain')?.addEventListener('click', e=>{
      const borrow = e.target.closest('[data-ms-borrow]');
      if(borrow) applyBorrowedPrinciple(borrow.dataset.msBorrow);
    });

    const app = document.getElementById('app');
    app?.addEventListener('input', e=>{
      if(e.target.dataset?.field === 'danger.danger') renderDangerMentorSuggestions();
      if(e.target.dataset?.field === 'danger.guardrailKept' && e.target.checked) onGuardrailKept(true);
    });
  }

  async function handleMentorshipClick(e){
    const expand = e.target.closest('[data-ms-expand]');
    if(expand){
      const id = expand.dataset.msExpand;
      if(expandedPrinciples.has(id)) expandedPrinciples.delete(id);
      else expandedPrinciples.add(id);
      renderMentorship();
      return;
    }

    const work = e.target.closest('[data-ms-work]');
    if(work){ activeForms[work.dataset.msWork] = 'work'; renderMentorship(); return; }
    const log = e.target.closest('[data-ms-log]');
    if(log){ activeForms[log.dataset.msLog] = 'log'; renderMentorship(); return; }
    const cancel = e.target.closest('[data-ms-form-cancel]');
    if(cancel){ delete activeForms[cancel.dataset.msFormCancel]; renderMentorship(); return; }

    const workSave = e.target.closest('[data-ms-work-save]');
    if(workSave){
      const pid = workSave.dataset.msWorkSave;
      const form = document.getElementById('mentorshipPanel')?.querySelector('[data-ms-work-form="'+pid+'"]');
      const title = form?.querySelector('[data-ms-work-title]')?.value.trim();
      const date = form?.querySelector('[data-ms-work-date]')?.value;
      const slotBtn = form?.querySelector('.ms-slot-chip.on');
      const slot = slotBtn?.dataset.msWorkSlot || 'beforeWork';
      faithStore.putPrincipleToWork(pid, { title, date, timeSlot: slot });
      await faithStore.save();
      delete activeForms[pid];
      renderMentorship();
      renderDashboard?.();
      markDirty?.();
      return;
    }

    const logSave = e.target.closest('[data-ms-log-save]');
    if(logSave){
      const pid = logSave.dataset.msLogSave;
      const form = document.getElementById('mentorshipPanel')?.querySelector('[data-ms-log-form="'+pid+'"]');
      const note = form?.querySelector('[data-ms-log-note]')?.value.trim();
      const date = form?.querySelector('[data-ms-log-date]')?.value;
      faithStore.logPrincipleApplication(pid, { note, date });
      await faithStore.save();
      delete activeForms[pid];
      expandedPrinciples.add(pid);
      renderMentorship();
      markDirty?.();
      return;
    }

    const slotChip = e.target.closest('[data-ms-work-slot]');
    if(slotChip){
      slotChip.closest('.ms-slot-chips')?.querySelectorAll('.ms-slot-chip').forEach(c=> c.classList.remove('on'));
      slotChip.classList.add('on');
      return;
    }

    const markAsked = e.target.closest('[data-ms-mark-asked]');
    if(markAsked){
      faithStore.markQuestionAsked(markAsked.dataset.msMarkAsked);
      await faithStore.save();
      renderMentorship();
      markDirty?.();
      return;
    }

    const qDel = e.target.closest('[data-ms-q-del]');
    if(qDel){
      faithStore.deleteQueuedQuestion(qDel.dataset.msQDel);
      await faithStore.save();
      renderMentorship();
      markDirty?.();
      return;
    }

    const qAdd = e.target.closest('[data-ms-q-add-btn]');
    if(qAdd){
      const mid = qAdd.dataset.msQAddBtn;
      const inp = document.getElementById('mentorshipPanel')?.querySelector('[data-ms-q-add="'+mid+'"]');
      const text = inp?.value.trim();
      if(text){
        faithStore.createQueuedQuestion({ mentorId: mid, text });
        await faithStore.save();
        inp.value = '';
        renderMentorship();
        markDirty?.();
      }
      return;
    }

    const qUp = e.target.closest('[data-ms-q-up]');
    if(qUp){
      const mid = parseMentorshipView(viewMode)?.mentorId;
      if(mid){
        const qs = faithStore.getQueuedQuestions(mid);
        const idx = qs.findIndex(q=> q.id === qUp.dataset.msQUp);
        if(idx > 0){
          const ids = qs.map(q=> q.id);
          [ids[idx-1], ids[idx]] = [ids[idx], ids[idx-1]];
          faithStore.reorderQueuedQuestions(mid, ids);
          await faithStore.save();
          renderMentorship();
        }
      }
      return;
    }

    const qDown = e.target.closest('[data-ms-q-down]');
    if(qDown){
      const mid = parseMentorshipView(viewMode)?.mentorId;
      if(mid){
        const qs = faithStore.getQueuedQuestions(mid);
        const idx = qs.findIndex(q=> q.id === qDown.dataset.msQDown);
        if(idx >= 0 && idx < qs.length - 1){
          const ids = qs.map(q=> q.id);
          [ids[idx], ids[idx+1]] = [ids[idx+1], ids[idx]];
          faithStore.reorderQueuedQuestions(mid, ids);
          await faithStore.save();
          renderMentorship();
        }
      }
      return;
    }

    const scrollQ = e.target.closest('[data-ms-scroll-q]');
    if(scrollQ){
      document.getElementById('ms-q-'+scrollQ.dataset.msScrollQ)?.scrollIntoView({ behavior:'smooth' });
      return;
    }

    const newSession = e.target.closest('[data-ms-new-session]');
    if(newSession){
      faithStore.startNewSession(newSession.dataset.msNewSession, { notes: '' });
      await faithStore.save();
      renderMentorship();
      markDirty?.();
      return;
    }

    const copyPrep = e.target.closest('[data-ms-copy-prep]');
    if(copyPrep){
      const text = faithStore.buildSessionPrepText(copyPrep.dataset.msCopyPrep);
      navigator.clipboard?.writeText(text);
      return;
    }

    const gotoP = e.target.closest('[data-ms-goto-principle]');
    if(gotoP){
      expandedPrinciples.add(gotoP.dataset.msGotoPrinciple);
      setMode('mentorship-'+gotoP.dataset.msGotoMentor);
      location.hash = 'ms-principle-'+gotoP.dataset.msGotoPrinciple;
      return;
    }
  }

  function handleMentorshipChange(e){
    if(e.target.dataset?.msPrepToggle != null){
      prepView = e.target.checked;
      renderMentorship();
      return;
    }
    const nextDate = e.target.dataset?.msNextDate;
    if(nextDate){
      faithStore.updateMentor(nextDate, { nextSessionDate: e.target.value });
      faithStore.save();
      markDirty?.();
    }
  }

  function loadMentorship(){ renderMentorship(); }

  root.renderMentorship = renderMentorship;
  root.loadMentorship = loadMentorship;
  root.renderMentorSettings = renderMentorSettings;
  root.renderMentorshipNav = renderMentorshipNav;
  root.bindMentorshipEvents = bindMentorshipEvents;
  root.isMentorshipMode = isMentorshipMode;
  root.parseMentorshipView = parseMentorshipView;
  root.renderDangerMentorSuggestions = renderDangerMentorSuggestions;
  root.showPrincipleHarvestPrompt = showPrincipleHarvestPrompt;

})(typeof window !== 'undefined' ? window : globalThis);
