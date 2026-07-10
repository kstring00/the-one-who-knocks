/**
 * Mentorship — principles, vault, sessions, threads
 */
(function(root){
  'use strict';

  function escHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }
  function esc(s){
    if(typeof window !== 'undefined' && typeof window.esc === 'function') return window.esc(s);
    return escHtml(s);
  }
  function msUid(){
    if(typeof window !== 'undefined' && typeof window.uid === 'function') return window.uid();
    return Math.random().toString(36).slice(2, 10);
  }
  function getViewMode(){
    if(typeof window !== 'undefined' && typeof window.viewMode === 'string') return window.viewMode;
    try { return viewMode; } catch (_) { return ''; }
  }

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
    const m = mode || (getViewMode());
    return String(m).startsWith('mentorship');
  }

  function renderMentorshipNav(){
    const sub = document.getElementById('navMentorshipSub');
    if(!sub || !window.faithStore) return;
    const mentors = window.faithStore.getMentors();
    let html = '<button type="button" data-nav="mentorship-threads"><span class="nav-icon" aria-hidden="true">◎</span><span>Threads</span></button>';
    mentors.forEach(m=>{
      html += '<button type="button" data-nav="mentorship-'+m.id+'"><span class="nav-icon" aria-hidden="true">✦</span><span>'+esc(m.label)+'</span></button>';
    });
    sub.innerHTML = html;
    updateSidebarNav?.();
  }

  function renderMentorSettings(){
    const el = document.getElementById('mentorSettings');
    if(!el || !window.faithStore) return;
    el.innerHTML = window.faithStore.getMentors().map((m,i)=>
      '<div class="mentor-row" data-mentor-row data-mentor-idx="'+i+'">'+
      '<input type="text" data-mentor-label value="'+esc(m.label)+'" placeholder="Label" aria-label="Label">'+
      '<input type="text" data-mentor-role value="'+esc(m.role)+'" placeholder="Role" aria-label="Role">'+
      '<input type="text" data-mentor-name value="'+esc(m.name)+'" placeholder="Name (optional)" aria-label="Name">'+
      '<button type="button" class="ff-rm" data-mentor-rm aria-label="Remove">×</button></div>'
    ).join('');
  }

  async function saveMentorSettingsFromDOM(){
    if(!window.faithStore) return;
    const rows = [...document.querySelectorAll('#mentorSettings [data-mentor-row]')];
    const prev = window.faithStore.getMentors();
    const cfg = rows.map((row,i)=>({
      id: prev[i]?.id || msUid(),
      label: row.querySelector('[data-mentor-label]')?.value.trim() || 'M',
      role: row.querySelector('[data-mentor-role]')?.value.trim() || '',
      name: row.querySelector('[data-mentor-name]')?.value.trim() || '',
      nextSessionDate: prev[i]?.nextSessionDate || '',
      sortOrder: i
    }));
    window.faithStore.setMentorConfig(cfg);
    await window.faithStore.save();
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
    const apps = window.faithStore.getApplicationsByPrinciple(principleId);
    if(!apps.length) return '<p class="ms-muted">No applications yet.</p>';
    return '<div class="ms-app-timeline">'+apps.map(a=>
      '<div class="ms-app-row"><span class="ms-app-date">'+esc(a.date)+'</span><span class="ms-app-note">'+esc(a.note || '(no note)')+'</span></div>'
    ).join('')+'</div>';
  }

  function renderPrincipleCard(p){
    const open = expandedPrinciples.has(p.id);
    const appCount = window.faithStore.getApplicationCount(p.id);
    const form = activeForms[p.id];
    return '<article class="ms-principle'+(open?' open':'')+'" id="ms-principle-'+p.id+'" data-principle-id="'+p.id+'">'+
      '<button type="button" class="ms-principle-toggle" data-ms-expand="'+p.id+'">'+
      (appCount ? '<span class="ms-leaf" title="'+appCount+' applied">🍃 '+appCount+'</span>' : '<span class="ms-leaf ms-leaf-empty"></span>')+
      '<span class="ms-principle-title">'+esc(p.title || '(Untitled principle)')+'</span>'+
      '<span class="ms-chev" aria-hidden="true">'+(open?'▾':'▸')+'</span></button>'+
      (open ? '<div class="ms-principle-body">'+
        (p.detailBullets.length ? '<ul class="ms-bullets">'+p.detailBullets.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>' : '')+
        (p.themeTags.length ? '<div class="ms-theme-tags">'+themeTagHtml(p.themeTags)+'</div>' : '')+
        (window.faithStore.getApplicationsByPrinciple(p.id).length ? '<div class="ms-app-section"><span class="ms-label">Applications</span>'+renderApplicationTimeline(p.id)+'</div>' : '')+
        '<div class="ms-principle-actions">'+
        '<button type="button" class="ms-text-btn" data-ms-work="'+p.id+'">Put to work</button>'+
        '<span class="ms-dot">·</span>'+
        '<button type="button" class="ms-text-btn" data-ms-log="'+p.id+'">Log it</button>'+
        '</div>'+
        (form === 'work' ? renderWorkForm(p) : '')+
        (form === 'log' ? renderLogForm(p) : '')+
      '</div>' : '')+
      '</article>';
  }

  function renderWorkForm(p){
    const f = activeForms['work-'+p.id] || { title: p.title, date: todayIso(), slot:'' };
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
    const groups = window.faithStore.getPrinciplesGroupedByQuestion(mentorId);
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
    const asked = window.faithStore.getAskedQuestions(mentorId);
    const queued = window.faithStore.getQueuedQuestions(mentorId);
    return '<div class="ms-vault-inner">'+
      '<div class="ms-vault-block"><span class="ms-label">Asked</span>'+
      (asked.length ? '<ul class="ms-plain-list">'+asked.map(q=>{
        const gid = hashStr(q.text);
        return '<li><button type="button" class="ms-link" data-ms-scroll-q="'+gid+'">'+esc(q.text)+'</button></li>';
      }).join('')+'</ul>' : '<p class="ms-muted">Nothing asked yet.</p>')+
      '</div>'+
      '<div class="ms-vault-block"><span class="ms-label">Queued for next session</span>'+
      '<ul class="ms-queue-list" data-ms-queue="'+mentorId+'">'+
      queued.map((q,i)=>
        '<li class="ms-queue-item" draggable="true" data-ms-qid="'+q.id+'" data-ms-qidx="'+i+'">'+
        '<span class="ms-drag" title="Drag to reorder">⋮⋮</span>'+
        '<span class="ms-q-text">'+esc(q.text)+'</span>'+
        '<span class="ms-queue-ctrls">'+
        '<button type="button" class="ms-icon-btn" data-ms-q-up="'+q.id+'" title="Up">↑</button>'+
        '<button type="button" class="ms-icon-btn" data-ms-q-down="'+q.id+'" title="Down">↓</button>'+
        '<button type="button" class="ms-text-btn" data-ms-mark-asked="'+q.id+'">Asked</button>'+
        '<button type="button" class="ms-icon-btn ms-del" data-ms-q-del="'+q.id+'" title="Remove">×</button>'+
        '</span></li>'
      ).join('')+
      '</ul>'+
      '<div class="ms-queue-add"><input type="text" data-ms-q-add="'+mentorId+'" placeholder="Add a question…">'+
      '<button type="button" class="ms-text-btn" data-ms-q-add-btn="'+mentorId+'">+ Add</button></div>'+
      '</div></div>';
  }

  function renderSessionLog(mentorId){
    const mentor = window.faithStore.getMentor(mentorId);
    const sessions = window.faithStore.getSessionsByMentor(mentorId);
    const prep = prepView ? window.faithStore.buildSessionPrepText(mentorId) : '';
    return '<div class="ms-session-inner">'+
      '<div class="ms-session-bar">'+
      '<label class="ms-check-label"><input type="checkbox" data-ms-prep-toggle'+(prepView?' checked':'')+'> Prep view</label>'+
      '<button type="button" class="ms-text-btn ms-text-btn-gold" data-ms-new-session="'+mentorId+'">+ New session</button>'+
      '</div>'+
      '<p class="ms-next-session">Next session <input type="date" data-ms-next-date="'+mentorId+'" value="'+esc(mentor?.nextSessionDate||'')+'"></p>'+
      (prepView ? '<div class="ms-prep"><pre class="ms-prep-text" id="msPrepText">'+esc(prep)+'</pre>'+
      '<button type="button" class="ms-text-btn" data-ms-copy-prep="'+mentorId+'">Copy prep</button></div>' : '')+
      (sessions.length ? '<ul class="ms-session-list">'+sessions.map(s=>'<li>'+renderSessionCard(s)+'</li>').join('')+'</ul>' :
        '<p class="ms-muted">No sessions logged yet.</p>')+
      '</div>';
  }

  function renderSessionCard(s){
    const apps = (s.attachedApplicationIds||[]).map(id=> window.faithStore.data.applications.find(a=> a.id===id)).filter(Boolean);
    const qs = (s.attachedQuestionIds||[]).map(id=> window.faithStore.data.queuedQuestions.find(q=> q.id===id)).filter(Boolean);
    return '<article class="ms-session">'+
      '<div class="ms-session-date">'+esc(s.date)+'</div>'+
      (s.notes ? '<p class="ms-session-notes">'+esc(s.notes)+'</p>' : '')+
      (apps.length ? '<div class="ms-session-att"><span class="ms-label">Since last session</span>'+
        apps.map(a=>{
          const p = window.faithStore.getPrinciple(a.principleId);
          return '<div class="ms-app-row"><span class="ms-app-date">'+esc(a.date)+'</span><span>'+esc(p?.title||'')+(a.note ? ' — '+esc(a.note) : '')+'</span></div>';
        }).join('')+'</div>' : '')+
      (qs.length ? '<div class="ms-session-att"><span class="ms-label">Questions asked</span><ul class="ms-plain-list compact">'+
        qs.map(q=>'<li>'+esc(q.text)+'</li>').join('')+'</ul></div>' : '')+
      '</article>';
  }

  function renderMentorPage(mentorId){
    const m = window.faithStore.getMentor(mentorId);
    if(!m) return '<p class="dash-empty">Mentor not found.</p>';
    const stats = window.faithStore.getMentorStats(mentorId);
    return '<div class="ms-mentor-page" data-mentor-page="'+mentorId+'">'+
      '<header class="ms-page-head">'+
      '<div><h2 class="serif">'+esc(m.label)+'</h2>'+
      '<p class="ms-role">'+esc(m.role)+(m.name ? ' · '+esc(m.name) : '')+'</p></div>'+
      '<p class="ms-stats">'+stats.total+' principles · '+stats.practiced+' put to work</p>'+
      '</header>'+
      '<div class="ms-columns">'+
      '<div class="ms-col ms-col-library">'+
      '<h3 class="ms-col-title serif">Principle Library</h3>'+
      '<div class="ms-col-body">'+renderPrincipleLibrary(mentorId)+'</div></div>'+
      '<div class="ms-col ms-col-vault">'+
      '<h3 class="ms-col-title serif">Question Vault</h3>'+
      '<div class="ms-col-body">'+renderQuestionVault(mentorId)+'</div></div>'+
      '<div class="ms-col ms-col-sessions">'+
      '<h3 class="ms-col-title serif">Session Log</h3>'+
      '<div class="ms-col-body">'+renderSessionLog(mentorId)+'</div></div>'+
      '</div></div>';
  }

  function renderThreadsView(){
    const threads = window.faithStore.getThreadsGrouped().filter(g=> g.tag !== 'untagged' || g.principles.length);
    if(!threads.length){
      return '<p class="dash-empty">No themed principles yet — tags appear as you import or add principles.</p>';
    }
    return '<div class="ms-threads">'+
      threads.map(g=>
        '<section class="ms-thread-group"><h3 class="serif ms-thread-title">'+esc(g.tag)+'</h3>'+
        '<ul class="ms-thread-list">'+
        g.principles.map(p=>{
          const m = window.faithStore.getMentor(p.mentorId);
          const apps = window.faithStore.getApplicationCount(p.id);
          return '<li><button type="button" class="ms-thread-item" data-ms-goto-principle="'+p.id+'" data-ms-goto-mentor="'+p.mentorId+'">'+
            '<span class="ms-thread-mentor">'+esc(m?.label||'?')+'</span>'+
            '<span class="ms-thread-principle">'+esc(p.title || p.sourceQuestion)+'</span>'+
            (apps ? '<span class="ms-leaf">🍃 '+apps+'</span>' : '')+
            '</button></li>';
        }).join('')+
        '</ul></section>'
      ).join('')+'</div>';
  }

  function renderMentorship(){
    const panel = document.getElementById('mentorshipPanel');
    if(!panel) return;
    if(!window.faithStore){
      panel.innerHTML = '<p class="dash-empty">Loading mentorship data…</p>';
      if(!renderMentorship._retry){
        renderMentorship._retry = true;
        const started = performance.now();
        (function waitForStore(){
          if(window.faithStore){
            renderMentorship._retry = false;
            renderMentorship();
          }else if(performance.now() - started < 12000){
            requestAnimationFrame(waitForStore);
          }else{
            renderMentorship._retry = false;
            panel.innerHTML = '<p class="dash-empty">Mentorship data did not load — refresh the page or check that faithfulness-store.js loaded.</p>';
          }
        })();
      }
      return;
    }
    try {
      renderMentorshipNav();
      if(!window.faithStore.getMentors().length){
        panel.innerHTML = renderMentorshipEmptyState();
        return;
      }
      const view = parseMentorshipView(getViewMode());
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
    } catch (err) {
      console.error('[mentorship] render failed', err);
      panel.innerHTML = '<p class="dash-empty">Could not load mentorship — try refreshing the page.</p>';
    }
  }

  function todayIso(){
    const d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  /* ── first-run setup: no mentors yet ─────────────────────────── */
  function renderMentorshipEmptyState(){
    return '<div class="page-head"><div><h2 class="serif">Mentorship</h2>'+
      '<p>Wisdom from the people who speak into your life.</p></div></div>'+
      '<div class="settings-card ms-empty-setup">'+
      '<h3 class="serif">Who speaks life into you?</h3>'+
      '<p class="ms-muted" style="margin:6px 0 14px">A mentor, a pastor, a wise friend, a boss worth learning from. '+
      'Name them here — then capture their principles as they come, queue questions for your next conversation, '+
      'and borrow their wisdom on hard days.</p>'+
      '<div class="proj-new-row">'+
      '<input type="text" id="msFirstMentorName" placeholder="Their name or role — e.g. Pastor Mike" aria-label="Mentor name">'+
      '<button type="button" class="btn-gold" id="msFirstMentorAdd">Add mentor</button>'+
      '</div>'+
      '<p class="ms-muted" style="margin:12px 0 0;font-size:12px">Still searching for one? That’s a faithful step too — '+
      'add them whenever they arrive. You can manage mentors anytime in Settings.</p>'+
      '</div>';
  }
  async function addFirstMentor(){
    const inp = document.getElementById('msFirstMentorName');
    const name = inp?.value.trim();
    if(!name || !window.faithStore) return;
    const label = name.split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,3) || 'M1';
    window.faithStore.createMentor({ label, role:'', name });
    await window.faithStore.save();
    renderMentorshipNav();
    renderMentorship();
    markDirty?.();
  }

  function showPrincipleHarvestPrompt(taskId){
    const task = window.faithStore?.getTask(taskId);
    if(!task?.principleId) return;
    const existing = document.getElementById('msHarvestPrompt');
    if(existing) existing.remove();
    const p = window.faithStore.getPrinciple(task.principleId);
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
      window.faithStore.completePrincipleHarvest(taskId, note || task.title);
      await window.faithStore.save();
      div.remove();
      renderMentorship?.();
      renderCalendar?.();
      markDirty?.();
    };
    document.getElementById('msHarvestSkip').onclick = ()=> div.remove();
    document.getElementById('msHarvestNote')?.focus();
  }

  function wrapCompleteTask(){
    if(!window.faithStore || window.faithStore._principleWrapped) return;
    const orig = window.faithStore.completeTask.bind(window.faithStore);
    window.faithStore.completeTask = async function(id, opts){
      const r = await orig(id, opts);
      if(r.needsPrincipleHarvest) showPrincipleHarvestPrompt(id);
      return r;
    };
    window.faithStore._principleWrapped = true;
  }

  function renderDangerMentorSuggestions(){
    const row = document.getElementById('dangerMentorSuggest');
    if(!row || !window.faithStore || !dayData) return;
    const danger = dayData.danger?.danger || '';
    const matches = window.faithStore.matchPrinciplesForDanger(danger, 3);
    if(!danger.trim() || !matches.length){
      row.hidden = true;
      row.innerHTML = '';
      return;
    }
    row.hidden = false;
    row.innerHTML = '<span class="ms-borrow-label">Borrow from mentors:</span>'+
      matches.map(p=>{
        const m = window.faithStore.getMentor(p.mentorId);
        return '<button type="button" class="ms-borrow-chip" data-ms-borrow="'+p.id+'">'+
          esc(m?.label||'')+': '+esc(p.title)+'</button>';
      }).join('');
  }

  async function applyBorrowedPrinciple(principleId){
    const p = window.faithStore.getPrinciple(principleId);
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
    if(!checked || !dayData?.danger?.borrowedPrincipleId || !window.faithStore) return;
    const pid = dayData.danger.borrowedPrincipleId;
    const note = 'Guardrail kept — ' + (dayData.danger.thenWill || '');
    window.faithStore.logPrincipleApplication(pid, { note, date: iso(dayOf(dayOffset)) });
    await window.faithStore.save();
    dayData.danger.borrowedPrincipleId = null;
    renderMentorship?.();
    markDirty?.();
  }

  function bindMentorshipEvents(){
    if(document.body.dataset.msBound) return;
    document.body.dataset.msBound = '1';
    wrapCompleteTask();

    document.getElementById('mentorshipPanel')?.addEventListener('click', e=>{
      if(e.target.closest('#msFirstMentorAdd')) addFirstMentor();
    });
    document.getElementById('mentorshipPanel')?.addEventListener('keydown', e=>{
      if(e.key==='Enter' && e.target.id==='msFirstMentorName'){ e.preventDefault(); addFirstMentor(); }
    });

    document.getElementById('mentorAddBtn')?.addEventListener('click', async ()=>{
      if(!window.faithStore) return;
      window.faithStore.createMentor({ label:'M'+(window.faithStore.getMentors().length+1), role:'', name:'' });
      await window.faithStore.save();
      renderMentorSettings();
      renderMentorshipNav();
      markDirty?.();
    });

    document.getElementById('mentorSettings')?.addEventListener('click', async e=>{
      if(e.target.closest('[data-mentor-rm]')){
        const row = e.target.closest('[data-mentor-row]');
        const idx = +row?.dataset.mentorIdx;
        const m = window.faithStore.getMentors()[idx];
        if(m && confirm('Remove mentor “'+m.label+'” and all their principles?')){
          window.faithStore.deleteMentor(m.id);
          await window.faithStore.save();
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
      const mid = parseMentorshipView(getViewMode())?.mentorId;
      if(!mid) return;
      const qs = window.faithStore.getQueuedQuestions(mid);
      const ids = qs.map(q=> q.id);
      const from = ids.indexOf(dragQuestionId);
      const to = ids.indexOf(target.dataset.msQid);
      if(from < 0 || to < 0) return;
      ids.splice(from, 1);
      ids.splice(to, 0, dragQuestionId);
      window.faithStore.reorderQueuedQuestions(mid, ids);
      await window.faithStore.save();
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
      const slot = slotBtn?.dataset.msWorkSlot || null;
      window.faithStore.putPrincipleToWork(pid, { title, date, timeSlot: slot });
      await window.faithStore.save();
      delete activeForms[pid];
      renderMentorship();
      renderCalendar?.();
      markDirty?.();
      return;
    }

    const logSave = e.target.closest('[data-ms-log-save]');
    if(logSave){
      const pid = logSave.dataset.msLogSave;
      const form = document.getElementById('mentorshipPanel')?.querySelector('[data-ms-log-form="'+pid+'"]');
      const note = form?.querySelector('[data-ms-log-note]')?.value.trim();
      const date = form?.querySelector('[data-ms-log-date]')?.value;
      window.faithStore.logPrincipleApplication(pid, { note, date });
      await window.faithStore.save();
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
      window.faithStore.markQuestionAsked(markAsked.dataset.msMarkAsked);
      await window.faithStore.save();
      renderMentorship();
      markDirty?.();
      return;
    }

    const qDel = e.target.closest('[data-ms-q-del]');
    if(qDel){
      window.faithStore.deleteQueuedQuestion(qDel.dataset.msQDel);
      await window.faithStore.save();
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
        window.faithStore.createQueuedQuestion({ mentorId: mid, text });
        await window.faithStore.save();
        inp.value = '';
        renderMentorship();
        markDirty?.();
      }
      return;
    }

    const qUp = e.target.closest('[data-ms-q-up]');
    if(qUp){
      const mid = parseMentorshipView(getViewMode())?.mentorId;
      if(mid){
        const qs = window.faithStore.getQueuedQuestions(mid);
        const idx = qs.findIndex(q=> q.id === qUp.dataset.msQUp);
        if(idx > 0){
          const ids = qs.map(q=> q.id);
          [ids[idx-1], ids[idx]] = [ids[idx], ids[idx-1]];
          window.faithStore.reorderQueuedQuestions(mid, ids);
          await window.faithStore.save();
          renderMentorship();
        }
      }
      return;
    }

    const qDown = e.target.closest('[data-ms-q-down]');
    if(qDown){
      const mid = parseMentorshipView(getViewMode())?.mentorId;
      if(mid){
        const qs = window.faithStore.getQueuedQuestions(mid);
        const idx = qs.findIndex(q=> q.id === qDown.dataset.msQDown);
        if(idx >= 0 && idx < qs.length - 1){
          const ids = qs.map(q=> q.id);
          [ids[idx], ids[idx+1]] = [ids[idx+1], ids[idx]];
          window.faithStore.reorderQueuedQuestions(mid, ids);
          await window.faithStore.save();
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
      window.faithStore.startNewSession(newSession.dataset.msNewSession, { notes: '' });
      await window.faithStore.save();
      renderMentorship();
      markDirty?.();
      return;
    }

    const copyPrep = e.target.closest('[data-ms-copy-prep]');
    if(copyPrep){
      const text = window.faithStore.buildSessionPrepText(copyPrep.dataset.msCopyPrep);
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
      window.faithStore.updateMentor(nextDate, { nextSessionDate: e.target.value });
      window.faithStore.save();
      markDirty?.();
    }
  }

  async function loadMentorship(){
    if(typeof window.ensureFaithStore === 'function'){
      try{ await window.ensureFaithStore(); }catch(e){ console.warn('[mentorship] store init failed', e); }
    }
    renderMentorship();
  }

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
