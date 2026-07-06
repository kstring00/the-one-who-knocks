/**
 * Phase 2 — Dashboard UI (reads FaithfulnessStore)
 */
(function(root){
  'use strict';

  const USER_NAME = 'Kevin';
  const JOURNAL_PROMPTS = [
    'What did you learn today about God, yourself, or your calling?',
    'Where did you notice faithfulness in small things today?',
    'What are you carrying that you need to release to the Lord?',
    'Who was in front of you today — and how did you serve them?',
    'What would make tomorrow a faithful yes?',
    'Where did you feel pulled away from what matters most?',
    'What grace did you receive today that you almost missed?'
  ];
  const TAG_LABELS = { project:'Project', growth:'Growth', stewardship:'Stewardship', none:'' };

  function dashDateStr(){ return iso(dayOf(typeof dayOffset==='number' ? dayOffset : 0)); }

  function timeGreeting(){
    const h = new Date().getHours();
    if(h < 12) return 'Good morning';
    if(h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function journalPromptForDay(){
    const d = dayOf(dayOffset);
    const start = new Date(d.getFullYear(),0,0);
    const dayNum = Math.floor((d - start) / 86400000);
    return JOURNAL_PROMPTS[dayNum % JOURNAL_PROMPTS.length];
  }

  function formatNextBlock(summary){
    if(!summary.nextBlockTime) return null;
    const [h,m] = summary.nextBlockTime.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return (summary.nextBlockLabel || 'Block') + ' at ' + hr + ':' + String(m).padStart(2,'0') + ' ' + ampm;
  }

  function buildSummaryLine(summary){
    const parts = [];
    if(summary.prioritiesLeft != null)
      parts.push(summary.prioritiesLeft + ' priorit' + (summary.prioritiesLeft===1?'y':'ies') + ' left');
    const nb = formatNextBlock(summary);
    if(nb) parts.push('next block · ' + nb.replace(' at ', ' at '));
    if(summary.seedsGrowing != null)
      parts.push(summary.seedsGrowing + ' seed' + (summary.seedsGrowing===1?'':'s') + ' growing');
    return parts.join(' · ') || 'Open space is not wasted space.';
  }

  function scheduleTimelineItems(dateStr){
    if(!faithStore) return [];
    const blocks = faithStore.getScheduleBlocksForDate(dateStr);
    const tasks = faithStore.getTasksForDate(dateStr).filter(t=> t.timeSlot==='timed' || t.timeSlot);
    const items = blocks.map(b=>({
      time: b.startTime || '—',
      title: b.label,
      sub: b.sublabel || b.endTime ? (b.startTime&&b.endTime ? b.startTime+' – '+b.endTime : '') : ''
    }));
    const slotOrder = ['beforeWork','duringWork','afterWork','eveningShutdown'];
    const slotLabels = { beforeWork:'Before Work', duringWork:'During Work', afterWork:'After Work', eveningShutdown:'Evening Shutdown' };
    slotOrder.forEach(slot=>{
      tasks.filter(t=> t.timeSlot===slot && t.title).forEach(t=>{
        items.push({ time: slotLabels[slot], title: t.title, sub: t.completed ? 'Done' : '' });
      });
    });
    return items.sort((a,b)=> String(a.time).localeCompare(String(b.time)));
  }

  function renderDashboard(){
    const panel = document.getElementById('dashboardPanel');
    if(!panel || !faithStore) return;
    const dateStr = dashDateStr();
    const summary = faithStore.getDashboardSummary(dateStr, { now: new Date() });
    const tasks = faithStore.getTasksForDate(dateStr).slice().sort((a,b)=>{
      if(a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.createdAt||'').localeCompare(b.createdAt||'');
    });
    const projects = faithStore.data.projects || [];
    const seeds = faithStore.getRecentlyWateredSeeds(3);
    const pct = summary.tasksTotal ? Math.round(summary.tasksCompleted / summary.tasksTotal * 100) : 0;
    const notes = (faithStore.data.quickNotes || []).filter(n=> !n.promotedTo).slice(0,5);

    document.getElementById('dashGreeting').textContent = timeGreeting() + ', ' + USER_NAME;
    document.getElementById('dashSummary').textContent = buildSummaryLine(summary);
    document.getElementById('dashStatFraction').textContent = summary.tasksCompleted + ' / ' + summary.tasksTotal;
    document.getElementById('dashStatPct').textContent = pct + '%';
    document.getElementById('dashStatBar').style.width = pct + '%';

    const pri = document.getElementById('dashPriorities');
    if(pri){
      pri.innerHTML = tasks.length ? tasks.map(t=>'<label class="dash-task'+(t.completed?' done':'')+'">'+
        '<input type="checkbox" data-dash-task="'+t.id+'"'+(t.completed?' checked':'')+'>'+
        '<span class="dash-task-text">'+esc(t.title)+'</span>'+
        (t.durationMin ? '<span class="dash-dur">'+t.durationMin+'m</span>' : '')+
        (TAG_LABELS[t.tag] ? '<span class="dash-tag '+t.tag+'">'+TAG_LABELS[t.tag]+'</span>' : '')+
        '</label>').join('') : '<p class="dash-empty">No priorities yet — add one below.</p>';
    }

    const sched = document.getElementById('dashScheduleList');
    const schedItems = scheduleTimelineItems(dateStr);
    if(sched){
      sched.innerHTML = schedItems.length ? schedItems.map((it,i)=>
        '<div class="dash-tl-row"><div class="dash-tl-dot"></div><div class="dash-tl-body">'+
        '<div class="dash-tl-time">'+esc(it.time)+'</div><div class="dash-tl-title">'+esc(it.title)+'</div>'+
        (it.sub ? '<div class="dash-tl-sub">'+esc(it.sub)+'</div>' : '')+'</div></div>'
      ).join('') : '<p class="dash-empty">Open space is not wasted space.</p>';
    }

    const proj = document.getElementById('dashProjects');
    if(proj){
      proj.innerHTML = projects.length ? projects.slice(0,4).map(p=>{
        const pc = faithStore.getProjectPercentComplete(p.id);
        return '<div class="dash-proj-row"><div class="dash-proj-head"><span>'+esc(p.title)+'</span><span>'+pc+'%</span></div>'+
          '<div class="dash-proj-bar"><div class="dash-proj-fill" style="width:'+pc+'%"></div></div></div>';
      }).join('') : '<p class="dash-empty">No projects yet.</p>';
    }

    document.getElementById('dashJournalPrompt').textContent = journalPromptForDay();

    const seedEl = document.getElementById('dashSeedbed');
    if(seedEl){
      seedEl.innerHTML = seeds.length ? seeds.map(s=>
        '<button type="button" class="dash-seed-chip" data-dash-seed="'+s.id+'"><span class="seed-growth">✦</span>'+esc(s.title)+'</button>'
      ).join('') : '<span class="dash-empty">No seeds growing — capture one in Ideas.</span>';
    }

    const inbox = document.getElementById('dashNotesInbox');
    if(inbox){
      inbox.innerHTML = notes.length ? notes.map(n=>
        '<div class="dash-note-row"><span>'+esc(n.text)+'</span>'+
        '<button type="button" class="dash-note-promote" data-promote-task="'+n.id+'">→ Task</button>'+
        '<button type="button" class="dash-note-promote" data-promote-seed="'+n.id+'">→ Seed</button></div>'
      ).join('') : '';
    }
  }

  function bindDashboardEvents(){
    if(document.body.dataset.dashBound) return;
    document.body.dataset.dashBound = '1';

    document.getElementById('dashPriorities')?.addEventListener('change', async e=>{
      const id = e.target.dataset?.dashTask;
      if(!id || !faithStore) return;
      const task = faithStore.getTask(id);
      if(!task) return;
      if(e.target.checked){
        const r = await faithStore.completeTask(id);
        e.target.closest('.dash-task')?.classList.add('done','bloom');
        if(r.seedHarvested) showDashToast('Harvested — faithful work completed.');
        else if(r.watering) showDashToast('Watered.');
      } else {
        await faithStore.uncompleteTask(id);
        e.target.closest('.dash-task')?.classList.remove('done');
      }
      renderDashboard();
      if(typeof renderIdeaCalendar === 'function') renderIdeaCalendar();
    });

    document.getElementById('dashAddTask')?.addEventListener('click', async ()=>{
      const inp = document.getElementById('dashNewTask');
      const text = inp?.value.trim();
      if(!text || !faithStore) return;
      faithStore.createTask({ title:text, date:dashDateStr(), tag:'stewardship', timeSlot:'beforeWork' });
      await faithStore.save();
      inp.value = '';
      renderDashboard();
      markDirty();
    });

    document.getElementById('dashSaveNote')?.addEventListener('click', async ()=>{
      const ta = document.getElementById('dashQuickNote');
      const text = ta?.value.trim();
      if(!text || !faithStore) return;
      faithStore.createQuickNote(text);
      await faithStore.save();
      ta.value = '';
      renderDashboard();
      markDirty();
      showDashToast('Note saved.');
    });

    document.getElementById('dashNotesInbox')?.addEventListener('click', async e=>{
      const tBtn = e.target.closest('[data-promote-task]');
      const sBtn = e.target.closest('[data-promote-seed]');
      if(tBtn && faithStore){
        faithStore.promoteNoteToTask(tBtn.dataset.promoteTask, { date:dashDateStr(), tag:'stewardship' });
        await faithStore.save(); renderDashboard(); markDirty();
      }
      if(sBtn && faithStore){
        faithStore.promoteNoteToSeed(sBtn.dataset.promoteSeed, { lifeArea:'other', status:'active' });
        await faithStore.save(); renderDashboard(); markDirty();
      }
    });

    document.querySelectorAll('[data-dash-link]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const mode = btn.dataset.dashLink;
        if(mode === 'calendar'){ setMode('ideas'); setTimeout(()=> document.getElementById('ideasCalendarSection')?.scrollIntoView({behavior:'smooth'}), 200); }
        else if(mode === 'journal-prefill'){
          window._journalPromptPrefill = document.getElementById('dashJournalPrompt')?.textContent || '';
          setMode('journal');
        }
        else setMode(mode);
      });
    });

    document.getElementById('dashSeedbed')?.addEventListener('click', e=>{
      if(e.target.closest('[data-dash-seed]')) setMode('ideas');
    });

    document.getElementById('btnQuickAdd')?.addEventListener('click', ()=>{
      setMode('dashboard');
      setTimeout(()=> document.getElementById('dashQuickNote')?.focus(), 150);
    });

    document.getElementById('btnFocusMode')?.addEventListener('click', ()=>{
      document.body.classList.toggle('focus-mode');
    });

    document.getElementById('btnCalJump')?.addEventListener('click', ()=>{
      dayOffset = 0;
      loadCurrent();
    });
  }

  function showDashToast(msg){
    const t = document.getElementById('ideaToast') || document.getElementById('dashToast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showDashToast._t);
    showDashToast._t = setTimeout(()=> t.classList.remove('show'), 2800);
  }

  function loadDashboard(){
    renderDashboard();
  }

  root.renderDashboard = renderDashboard;
  root.loadDashboard = loadDashboard;
  root.bindDashboardEvents = bindDashboardEvents;

})(typeof window !== 'undefined' ? window : globalThis);
