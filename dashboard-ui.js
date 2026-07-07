/**
 * Dashboard UI — priorities, suggestions, widgets
 */
(function(root){
  'use strict';

  const USER_NAME = 'Kyle';
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
  const SCHEDULE_SLOTS = [
    { id:'beforeWork', label:'Before Work' },
    { id:'duringWork', label:'During Work' },
    { id:'afterWork', label:'After Work' },
    { id:'eveningShutdown', label:'Evening Shutdown' }
  ];

  function tagClassFor(tag){
    if(typeof semanticTagClass === 'function') return semanticTagClass(tag);
    const t = String(tag||'').toLowerCase();
    if(t.includes('first fruit')) return 'tag-first-fruits';
    if(t.includes('hobb')) return 'tag-hobby';
    if(t.includes('skill')) return 'tag-skill';
    return '';
  }

  function dashTagHtml(tag){
    const cls = tagClassFor(tag);
    return '<span class="dash-tag'+(cls ? ' '+cls.replace('tag-','') : '')+'">'+esc(tag)+'</span>';
  }

  function dashDateStr(){ return iso(dayOf(typeof dayOffset==='number' ? dayOffset : 0)); }

  function dismissedKey(){ return 'fs:dismissed:' + dashDateStr(); }
  function getDismissed(){
    try{ return JSON.parse(localStorage.getItem(dismissedKey()) || '[]'); }catch(e){ return []; }
  }
  function dismissSuggestion(id){
    const d = getDismissed();
    if(!d.includes(id)){
      d.push(id);
      localStorage.setItem(dismissedKey(), JSON.stringify(d));
      if(typeof window.scheduleCloudPush === 'function') window.scheduleCloudPush([dismissedKey()]);
    }
  }

  function timeGreeting(){
    const h = new Date().getHours();
    if(h < 12) return 'Good morning';
    if(h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function journalPromptForDay(){
    const prompts = typeof getAllJournalPrompts === 'function'
      ? getAllJournalPrompts()
      : JOURNAL_PROMPTS;
    const d = dayOf(typeof dayOffset === 'number' ? dayOffset : 0);
    const start = new Date(d.getFullYear(), 0, 0);
    const dayNum = Math.floor((d - start) / 86400000);
    return prompts[dayNum % prompts.length];
  }

  function buildSummaryLine(summary){
    if(summary.practiceLine) return summary.practiceLine;
    if(summary.firstFruitsTotal > 0 && !summary.firstFruitsComplete)
      return "Start with what's first — Bible reading & prayer.";
    if(summary.firstFruitsComplete){
      const n = summary.prioritiesLeft || 0;
      return 'First things first — done. ' + n + ' priorit' + (n===1?'y':'ies') + ' remain.';
    }
    const parts = [];
    if(summary.prioritiesLeft != null)
      parts.push(summary.prioritiesLeft + ' priorit' + (summary.prioritiesLeft===1?'y':'ies') + ' left');
    if(summary.nextBlockLabel && summary.nextBlockTime)
      parts.push('next block · ' + summary.nextBlockLabel + ' at ' + formatTime(summary.nextBlockTime));
    if(summary.seedsGrowing != null)
      parts.push(summary.seedsGrowing + ' seed' + (summary.seedsGrowing===1?'':'s') + ' growing');
    return parts.join(' · ') || 'Open space is not wasted space.';
  }

  function formatTime(t){
    const [h,m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + String(m).padStart(2,'0') + ' ' + ampm;
  }

  function weekStartStr(d){
    const x = new Date(d);
    const diff = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - diff);
    return iso(x);
  }

  function getSuggestions(dateStr){
    if(!faithStore) return [];
    const dismissed = new Set(getDismissed());
    const out = [];
    if(faithStore.getPriorityTasksForDate(dateStr).length > 0) return [];

    const seed = faithStore.getOldestUnwateredActiveSeed();
    if(seed && !dismissed.has('seed-'+seed.id)){
      const hasPlanted = faithStore.getTasksBySeed(seed.id).some(t=> !t.completed);
      if(!hasPlanted){
        out.push({
          id: 'seed-'+seed.id,
          icon: '🌱',
          text: '“'+seed.title+'” has no next step planted — plant one?',
          acceptTitle: 'Work on ' + seed.title,
          meta: { type:'seed', seedId: seed.id }
        });
      }
    }

    faithStore.getActiveProjects().forEach(p=>{
      if(out.length >= 4 || dismissed.has('project-'+p.id)) return;
      if(!faithStore.projectHasTaskThisWeek(p.id, weekStartStr(dayOf(dayOffset)))){
        out.push({
          id: 'project-'+p.id,
          icon: '📁',
          text: 'Project “'+p.title+'” has no task this week — add one?',
          acceptTitle: 'Work on ' + p.title,
          meta: { type:'project', projectId: p.id }
        });
      }
    });

    (faithStore.data.quickNotes || []).filter(n=> !n.promotedTo).forEach(n=>{
      if(out.length >= 4 || dismissed.has('note-'+n.id)) return;
      out.push({
        id: 'note-'+n.id,
        icon: '📝',
        text: 'Quick note: “'+(n.text.length>40 ? n.text.slice(0,40)+'…' : n.text)+'” — make it a task?',
        acceptTitle: n.text,
        meta: { type:'note', noteId: n.id }
      });
    });

    return out.slice(0, 4);
  }

  function renderTaskRow(t, opts){
    opts = opts || {};
    const showFfTag = !opts.hideFirstFruitsTag && (t.tags||[]).includes('First Fruits');
    const otherTags = (t.tags||[]).filter(x=> x !== 'First Fruits' || opts.hideFirstFruitsTag);
    return '<div class="dash-task-wrap'+(t.completed?' done':'')+'">'+
      '<label class="dash-task'+(t.completed?' done':'')+'">'+
      '<input type="checkbox" data-dash-task="'+t.id+'"'+(t.completed?' checked':'')+'>'+
      '<span class="dash-task-text">'+esc(t.title)+'</span>'+
      (t.durationMin ? '<span class="dash-dur">'+t.durationMin+'m</span>' : '')+
      (showFfTag ? dashTagHtml('First Fruits') : '')+
      '</label>'+
      (typeof tagChipsHtml === 'function' && !opts.compact
        ? tagChipsHtml(otherTags, { showAdd:true, entityType:'task', entityId:t.id }) : '')+
      '</div>';
  }

  function renderFirstFruitsSection(anchors){
    if(!anchors.length) return '';
    const done = anchors.filter(a=> a.completed).length;
    return '<section class="dash-first-fruits" aria-label="First Fruits">'+
      '<header class="dash-first-head">'+
      '<span class="dash-first-badge" aria-hidden="true">✦</span>'+
      '<div class="dash-first-meta">'+
      '<strong class="dash-first-title">First Fruits</strong>'+
      '<span class="dash-first-hint">Bible & prayer — start here</span>'+
      '</div>'+
      '<span class="dash-first-progress">'+done+'/'+anchors.length+'</span>'+
      '</header>'+
      '<div class="dash-first-list">'+
      anchors.map(t=>
        '<div class="dash-ff-item'+(t.completed?' done':'')+'">'+
        '<label class="dash-ff-row">'+
        '<input type="checkbox" data-dash-task="'+t.id+'"'+(t.completed?' checked':'')+'>'+
        '<span class="dash-ff-text">'+esc(t.title)+'</span>'+
        (t.durationMin ? '<span class="dash-ff-dur">'+t.durationMin+' min</span>' : '')+
        '</label></div>'
      ).join('')+
      '</div></section>';
  }

  function renderSuggestions(suggestions){
    if(!suggestions.length) return '';
    return '<div class="dash-suggestions">'+suggestions.map(s=>
      '<div class="dash-suggest-row" data-suggest-id="'+s.id+'">'+
      '<span class="dash-suggest-text">'+s.icon+' '+esc(s.text)+'</span>'+
      '<div class="dash-suggest-actions">'+
      '<button type="button" class="dash-suggest-add" data-suggest-add="'+s.id+'">+</button>'+
      '<button type="button" class="dash-suggest-dismiss" data-suggest-dismiss="'+s.id+'">×</button>'+
      '</div></div>'+
      (window._suggestEdit === s.id ? '<div class="dash-suggest-edit"><input type="text" class="dash-suggest-inp" data-suggest-inp="'+s.id+'" value="'+esc(s.acceptTitle)+'"><button type="button" class="dash-suggest-save" data-suggest-save="'+s.id+'">Save task</button></div>' : '')
    ).join('')+'</div>';
  }

  function timeToMinutes(t){
    if(!t || !t.includes(':')) return null;
    const [h,m] = t.split(':').map(Number);
    return h*60+m;
  }

  function renderScheduleItemControls(kind, id){
    let h = '<div class="dash-sched-ctrls">';
    if(kind === 'task'){
      h += '<button type="button" class="dash-sched-btn" data-sched-move="'+id+':up" title="Move up">↑</button>'+
        '<button type="button" class="dash-sched-btn" data-sched-move="'+id+':down" title="Move down">↓</button>'+
        '<button type="button" class="dash-sched-btn dash-sched-del" data-sched-del-task="'+id+'" title="Remove">×</button>';
    } else {
      h += '<button type="button" class="dash-sched-btn dash-sched-del" data-sched-del-block="'+id+'" title="Remove block">×</button>';
    }
    return h + '</div>';
  }

  function renderScheduleTaskRow(t, opts){
    opts = opts || {};
    const slotOpts = SCHEDULE_SLOTS.map(s=>
      '<option value="'+s.id+'"'+(t.timeSlot===s.id?' selected':'')+'>'+s.label+'</option>'
    ).join('') + '<option value="timed"'+(t.timeSlot==='timed'?' selected':'')+'>Specific time</option>';
    return '<div class="dash-sched-item'+(t.completed?' done':'')+'" data-sched-task="'+t.id+'">'+
      '<label class="dash-sched-check">'+
      '<input type="checkbox" data-dash-sched-task="'+t.id+'"'+(t.completed?' checked':'')+'>'+
      '<span class="dash-sched-title">'+esc(t.title)+'</span>'+
      '</label>'+
      '<select class="dash-sched-slot-sel" data-sched-slot="'+t.id+'" aria-label="Time slot">'+slotOpts+'</select>'+
      (t.timeSlot === 'timed'
        ? '<input type="time" class="dash-sched-time-inp" data-sched-time="'+t.id+'" value="'+(t.startTime||'')+'" aria-label="Time">'
        : '')+
      renderScheduleItemControls('task', t.id)+
      '</div>';
  }

  function renderDashboardSchedule(dateStr){
    if(!faithStore) return '<p class="dash-empty">Open space is not wasted space.</p>';
    const blocks = faithStore.getScheduleBlocksForDate(dateStr)
      .slice()
      .sort((a,b)=> (timeToMinutes(a.startTime) ?? 9999) - (timeToMinutes(b.startTime) ?? 9999));
    const tasks = faithStore.getScheduleTasksForDate(dateStr);
    const timedTasks = tasks.filter(t=> t.timeSlot === 'timed')
      .slice()
      .sort((a,b)=> faithStore._scheduleTaskSort(a,b));
    const slotTasks = slotId => tasks.filter(t=> t.timeSlot === slotId)
      .slice()
      .sort((a,b)=> faithStore._scheduleTaskSort(a,b));

    let html = '';
    const timedRows = blocks.map(b=>
      '<div class="dash-sched-item dash-sched-block">'+
      '<div class="dash-sched-time">'+esc(b.startTime ? formatTime(b.startTime) : '—')+'</div>'+
      '<div class="dash-sched-body"><div class="dash-sched-title">'+esc(b.label)+'</div>'+
      (b.endTime ? '<div class="dash-sched-sub">until '+esc(formatTime(b.endTime))+'</div>' : '')+
      '</div>'+renderScheduleItemControls('block', b.id)+'</div>'
    ).concat(timedTasks.map(t=>{
      const row = renderScheduleTaskRow(t);
      return row.replace('dash-sched-item', 'dash-sched-item dash-sched-timed');
    }));

    if(timedRows.length){
      html += '<div class="dash-sched-section"><div class="dash-sched-section-label">At a time</div>'+
        timedRows.join('')+'</div>';
    }

    SCHEDULE_SLOTS.forEach(slot=>{
      const items = slotTasks(slot.id);
      html += '<div class="dash-sched-section" data-sched-section="'+slot.id+'">'+
        '<div class="dash-sched-section-label">'+slot.label+'</div>';
      if(items.length){
        html += items.map(t=> renderScheduleTaskRow(t)).join('');
      } else {
        html += '<p class="dash-sched-empty">Nothing here yet</p>';
      }
      html += '</div>';
    });

    return html;
  }


  function syncDayForDash(){
    const dateStr = dashDateStr();
    if(!faithStore || typeof getDayDataByDate !== 'function') return Promise.resolve();
    const useCached = typeof iso === 'function' && typeof dayOffset === 'number' && typeof dayData !== 'undefined'
      && iso(dayOf(dayOffset)) === dateStr && dayData;
    return (useCached ? Promise.resolve(dayData) : getDayDataByDate(dateStr)).then(day=>{
      if(typeof normalizeDaily === 'function') day = normalizeDaily(day);
      faithStore.ensureDailyAnchors(dateStr);
      faithStore.syncMustDosFromDay(dateStr, day);
      faithStore.syncAnchorsToDay(dateStr, day);
      return faithStore.save().then(()=> day);
    });
  }

  async function dashAddMustDo(text){
    const dateStr = dashDateStr();
    faithStore.ensureDailyAnchors(dateStr);
    let day = (typeof iso === 'function' && iso(dayOf(dayOffset)) === dateStr && typeof dayData !== 'undefined' && dayData)
      ? dayData : await getDayDataByDate(dateStr);
    if(typeof normalizeDaily === 'function') day = normalizeDaily(day);
    if(!day.faithfulFew.mustDo.items) day.faithfulFew.mustDo.items = [];
    const mustDoId = uid();
    day.faithfulFew.mustDo.items.push({ id: mustDoId, text, done: false });
    faithStore.createTask({ title: text, date: dateStr, tag: 'stewardship', timeSlot: 'beforeWork', legacyMustDoId: mustDoId });
    await faithStore.save();
    if(typeof iso === 'function' && iso(dayOf(dayOffset)) === dateStr){
      dayData = day;
      if(typeof renderFFLists === 'function') renderFFLists();
      if(typeof updateScore === 'function') updateScore();
    } else if(typeof saveDayDataByDate === 'function') await saveDayDataByDate(dateStr, day);
    if(typeof markDirty === 'function') markDirty();
  }

  function renderDashboard(){
    const panel = document.getElementById('dashboardPanel');
    if(!panel || !faithStore) return;
    syncDayForDash();
    const dateStr = dashDateStr();
    faithStore.ensureDailyAnchors(dateStr);
    const summary = faithStore.getDashboardSummary(dateStr, { now: new Date() });
    const anchors = faithStore.getAnchorTasksForDate(dateStr);
    const priorities = faithStore.getPriorityTasksForDate(dateStr).slice().sort((a,b)=>{
      if(a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.createdAt||'').localeCompare(b.createdAt||'');
    });
    const suggestions = getSuggestions(dateStr);
    const projects = faithStore.getActiveProjects();
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
      let html = '';
      if(anchors.length){
        html += renderFirstFruitsSection(anchors);
        if(priorities.length) html += '<div class="dash-pri-divider"></div>';
      }
      html += priorities.map(renderTaskRow).join('');
      if(!anchors.length && !priorities.length && !suggestions.length)
        html += '<p class="dash-empty">No priorities yet — add one below or accept a suggestion.</p>';
      html += renderSuggestions(suggestions);
      pri.innerHTML = html;
    }

    const sched = document.getElementById('dashScheduleList');
    if(sched){
      sched.innerHTML = renderDashboardSchedule(dateStr);
    }

    const proj = document.getElementById('dashProjects');
    if(proj){
      proj.innerHTML = (projects.length ? projects.slice(0,4).map(p=>{
        const pc = faithStore.getProjectPercentComplete(p.id);
        return '<button type="button" class="dash-proj-row dash-proj-link" data-dash-proj="'+p.id+'">'+
          '<div class="dash-proj-head"><span>'+esc(p.title)+'</span><span>'+pc+'%</span></div>'+
          '<div class="dash-proj-bar"><div class="dash-proj-fill" style="width:'+pc+'%"></div></div></button>';
      }).join('') : '<p class="dash-empty">No projects yet.</p>') +
        '<div class="dash-inline-add"><input type="text" id="dashNewProject" placeholder="+ New project…"></div>';
    }

    document.getElementById('dashJournalPrompt').textContent = journalPromptForDay();

    const seedEl = document.getElementById('dashSeedbed');
    if(seedEl){
      seedEl.innerHTML = (seeds.length ? seeds.map(s=>
        '<button type="button" class="dash-seed-chip" data-dash-seed="'+s.id+'"><span class="seed-growth">✦</span>'+esc(s.title)+'</button>'
      ).join('') : '<span class="dash-empty">No seeds growing yet.</span>') +
        '<div class="dash-inline-add"><input type="text" id="dashPlantSeed" placeholder="Plant a seed…"></div>';
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

  async function saveSuggestion(id){
    const s = getSuggestions(dashDateStr()).find(x=> x.id === id);
    const inp = document.querySelector('[data-suggest-inp="'+id+'"]');
    const title = inp?.value.trim() || s?.acceptTitle;
    if(!title || !s) return;
    const dateStr = dashDateStr();
    if(s.meta.type === 'note') faithStore.promoteNoteToTask(s.meta.noteId, { date: dateStr, tag: 'stewardship', timeSlot: 'beforeWork' });
    else if(s.meta.type === 'project') faithStore.createTask({ title, date: dateStr, projectId: s.meta.projectId, tag: 'project', timeSlot: 'beforeWork' });
    else if(s.meta.type === 'seed') faithStore.createTask({ title, date: dateStr, seedId: s.meta.seedId, tag: 'growth', timeSlot: 'beforeWork', stepNumber: 1 });
    else await dashAddMustDo(title);
    window._suggestEdit = null;
    dismissSuggestion(id);
    await faithStore.save();
    renderDashboard();
    markDirty?.();
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
        e.target.closest('.dash-task-wrap')?.classList.add('done','bloom');
        if(task.legacyMustDoId && typeof dayData !== 'undefined' && dayData){
          faithStore.syncTaskToLegacyDay({ ...task, completed: true }, dayData);
          if(typeof syncIdeaFromMustDo === 'function') syncIdeaFromMustDo(task.legacyMustDoId, true);
          if(typeof renderFFLists === 'function') renderFFLists();
        }
        if(task.anchorId) showDashToast('First fruits — faithful.');
        else if(r.seedHarvested) showDashToast('Harvested.');
        else if(r.watering) showDashToast('Watered.');
      } else {
        await faithStore.uncompleteTask(id);
        if(task.legacyMustDoId && typeof dayData !== 'undefined' && dayData){
          faithStore.syncTaskToLegacyDay({ ...task, completed: false }, dayData);
          if(typeof syncIdeaFromMustDo === 'function') syncIdeaFromMustDo(task.legacyMustDoId, false);
          if(typeof renderFFLists === 'function') renderFFLists();
        }
      }
      renderDashboard();
      if(typeof renderCalendar === 'function') renderCalendar();
    });

    document.getElementById('dashPriorities')?.addEventListener('click', e=>{
      if(e.target.closest('[data-suggest-dismiss]')){
        dismissSuggestion(e.target.closest('[data-suggest-dismiss]').dataset.suggestDismiss);
        window._suggestEdit = null; renderDashboard(); return;
      }
      if(e.target.closest('[data-suggest-add]')){
        window._suggestEdit = e.target.closest('[data-suggest-add]').dataset.suggestAdd;
        renderDashboard(); return;
      }
      if(e.target.closest('[data-suggest-save]')){
        saveSuggestion(e.target.closest('[data-suggest-save]').dataset.suggestSave);
      }
    });

    document.getElementById('dashAddTask')?.addEventListener('click', async ()=>{
      const text = document.getElementById('dashNewTask')?.value.trim();
      if(!text) return;
      await dashAddMustDo(text);
      document.getElementById('dashNewTask').value = '';
      renderDashboard(); markDirty();
    });

    async function dashAddScheduleItem(){
      const title = document.getElementById('dashSchedTitle')?.value.trim();
      if(!title || !faithStore) return;
      const slot = document.getElementById('dashSchedSlot')?.value || 'beforeWork';
      const time = document.getElementById('dashSchedTime')?.value || '';
      const dateStr = dashDateStr();
      if(time){
        faithStore.createTask({ title, date: dateStr, timeSlot: 'timed', startTime: time, tag: 'none' });
      } else if(slot === 'timed'){
        showDashToast('Pick a time for a timed item.');
        return;
      } else {
        faithStore.createTask({ title, date: dateStr, timeSlot: slot, tag: 'none' });
      }
      await faithStore.save();
      document.getElementById('dashSchedTitle').value = '';
      if(document.getElementById('dashSchedTime')) document.getElementById('dashSchedTime').value = '';
      renderDashboard(); markDirty();
    }

    document.getElementById('dashSchedAdd')?.addEventListener('click', dashAddScheduleItem);
    document.getElementById('dashSchedTitle')?.addEventListener('keydown', e=>{
      if(e.key === 'Enter'){ e.preventDefault(); dashAddScheduleItem(); }
    });
    document.getElementById('dashSchedSlot')?.addEventListener('change', e=>{
      const timeEl = document.getElementById('dashSchedTime');
      if(timeEl) timeEl.hidden = e.target.value !== 'timed';
    });

    document.getElementById('dashScheduleList')?.addEventListener('change', async e=>{
      const schedTask = e.target.dataset?.dashSchedTask;
      if(schedTask && faithStore){
        const task = faithStore.getTask(schedTask);
        if(!task) return;
        if(e.target.checked) await faithStore.completeTask(schedTask);
        else await faithStore.uncompleteTask(schedTask);
        await faithStore.save();
        renderDashboard();
        if(typeof renderCalendar === 'function') renderCalendar();
        return;
      }
      const slotSel = e.target.dataset?.schedSlot;
      if(slotSel && faithStore){
        const slot = e.target.value;
        const patch = { timeSlot: slot };
        if(slot !== 'timed') patch.startTime = '';
        await faithStore.updateTask(slotSel, patch);
        await faithStore.save();
        renderDashboard(); markDirty();
        return;
      }
      const timeInp = e.target.dataset?.schedTime;
      if(timeInp && faithStore){
        await faithStore.updateTask(timeInp, { startTime: e.target.value, timeSlot: 'timed' });
        await faithStore.save();
        renderDashboard(); markDirty();
      }
    });

    document.getElementById('dashScheduleList')?.addEventListener('click', async e=>{
      const move = e.target.closest('[data-sched-move]');
      if(move && faithStore){
        const [id, dir] = move.dataset.schedMove.split(':');
        faithStore.moveScheduleTask(id, dir);
        await faithStore.save();
        renderDashboard(); markDirty();
        return;
      }
      const delTask = e.target.closest('[data-sched-del-task]');
      if(delTask && faithStore){
        await faithStore.deleteTaskAndSave(delTask.dataset.schedDelTask);
        renderDashboard(); markDirty();
        return;
      }
      const delBlock = e.target.closest('[data-sched-del-block]');
      if(delBlock && faithStore){
        faithStore.deleteScheduleBlock(delBlock.dataset.schedDelBlock);
        await faithStore.save();
        renderDashboard(); markDirty();
      }
    });

    document.getElementById('dashSaveNote')?.addEventListener('click', async ()=>{
      const text = document.getElementById('dashQuickNote')?.value.trim();
      if(!text || !faithStore) return;
      faithStore.createQuickNote(text);
      await faithStore.save();
      document.getElementById('dashQuickNote').value = '';
      renderDashboard(); markDirty(); showDashToast('Note saved.');
    });

    document.getElementById('dashNotesInbox')?.addEventListener('click', async e=>{
      const tBtn = e.target.closest('[data-promote-task]');
      const sBtn = e.target.closest('[data-promote-seed]');
      if(tBtn){ faithStore.promoteNoteToTask(tBtn.dataset.promoteTask, { date:dashDateStr(), tag:'stewardship' }); await faithStore.save(); renderDashboard(); markDirty(); }
      if(sBtn){ faithStore.promoteNoteToSeed(sBtn.dataset.promoteSeed, { lifeArea:'other', status:'active' }); await faithStore.save(); renderDashboard(); markDirty(); }
    });

    document.getElementById('dashProjects')?.addEventListener('click', e=>{
      const link = e.target.closest('[data-dash-proj]');
      if(link && typeof openProject === 'function') openProject(link.dataset.dashProj);
    });
    document.getElementById('dashProjects')?.addEventListener('keydown', async e=>{
      if(e.target.id !== 'dashNewProject' || e.key !== 'Enter') return;
      const text = e.target.value.trim();
      if(text && typeof dashCreateProject === 'function') await dashCreateProject(text);
      e.target.value = ''; renderDashboard();
    });

    document.getElementById('dashSeedbed')?.addEventListener('keydown', e=>{
      if(e.target.id !== 'dashPlantSeed' || e.key !== 'Enter') return;
      const text = e.target.value.trim();
      if(!text) return;
      if(typeof IdeasStore !== 'undefined'){
        IdeasStore.createIdea({ text, sourceType:'quick', lifeArea:'other' });
      } else if(typeof ensureIdeas === 'function'){
        ensureIdeas();
        globals.ideas.push(normalizeIdea({ text, status:'seedbed', category:'other' }));
      }
      e.target.value = ''; markDirty?.(); renderDashboard(); showDashToast('Idea captured.');
    });
    document.getElementById('dashSeedbed')?.addEventListener('click', e=>{
      if(e.target.closest('[data-dash-seed]')) setMode('ideas');
    });

    document.getElementById('dashJournalWidget')?.addEventListener('click', ()=>{
      window._journalPromptPrefill = journalPromptForDay();
      setMode('journal');
    });
    document.getElementById('dashJournalWidget')?.addEventListener('keydown', e=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        window._journalPromptPrefill = journalPromptForDay();
        setMode('journal');
      }
    });

    document.querySelectorAll('[data-dash-link]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const mode = btn.dataset.dashLink;
        if(mode === 'journal-prefill'){ window._journalPromptPrefill = journalPromptForDay(); setMode('journal'); }
        else setMode(mode);
      });
    });

    document.getElementById('btnQuickAdd')?.addEventListener('click', ()=>{
      setMode('dashboard');
      setTimeout(()=> document.getElementById('dashQuickNote')?.focus(), 150);
    });
    document.getElementById('btnFocusMode')?.addEventListener('click', ()=> document.body.classList.toggle('focus-mode'));
    document.getElementById('btnCalJump')?.addEventListener('click', ()=>{ dayOffset = 0; loadCurrent(); });
  }

  function showDashToast(msg){
    const t = document.getElementById('ideaToast');
    if(!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(showDashToast._t);
    showDashToast._t = setTimeout(()=> t.classList.remove('show'), 2800);
  }

  function loadDashboard(){ renderDashboard(); }

  root.renderDashboard = renderDashboard;
  root.loadDashboard = loadDashboard;
  root.bindDashboardEvents = bindDashboardEvents;
  root.journalPromptForDay = journalPromptForDay;

})(typeof window !== 'undefined' ? window : globalThis);
