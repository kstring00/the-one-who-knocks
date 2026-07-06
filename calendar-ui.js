/**
 * Notion-style calendar — week grid, event drawer, mini month
 */
(function(root){
  'use strict';

  const PIPE_SLOT_LABELS = {
    beforeWork:'Before Work', duringWork:'During Work',
    afterWork:'After Work', eveningShutdown:'Evening Shutdown', timed:'Timed'
  };
  const PIPE_SLOT_FIELDS = {
    beforeWork:'beforeWork', duringWork:'duringWork',
    afterWork:'afterWork', eveningShutdown:'eveningShutdown'
  };
  const SLOT_RANGE = {
    beforeWork:{ start:360, end:480 },
    duringWork:{ start:540, end:720 },
    afterWork:{ start:1020, end:1110 },
    eveningShutdown:{ start:1200, end:1290 }
  };
  const MY_WEEK_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const HOUR_START = 6;
  const HOUR_END = 23;
  const HOUR_H = 56;
  const EVENT_COLORS = {
    task:'#3b82f6', idea:'#8b5cf6', mustdo:'#d97706', recurring:'#64748b', block:'#94a3b8'
  };

  let weekOffset = 0;
  let monthOffset = 0;
  let viewMode = 'week';
  let dayCache = {};
  let filters = { tasks:true, ideas:true, mustdos:true, recurring:true };
  let searchQuery = '';
  let drawer = null;
  let myWeekOpen = false;
  let nowTimer = null;

  function esc(s){
    if(typeof window.esc === 'function') return window.esc(s);
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function iso(d){ return d.toISOString().slice(0,10); }
  function dayOf(off){
    const d = new Date(); d.setDate(d.getDate() + (off||0)); d.setHours(0,0,0,0); return d;
  }
  function monthOf(off){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + (off||0)); return d;
  }
  function store(){ return window.faithStore || null; }
  function mins(h, m){ return h * 60 + m; }
  function parseTime(t){
    if(!t) return null;
    const p = String(t).match(/^(\d{1,2}):(\d{2})/);
    if(!p) return null;
    return mins(+p[1], +p[2]);
  }
  function fmtTime(m){
    if(m == null) return '';
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return h12 + (min ? ':' + String(min).padStart(2,'0') : '') + ' ' + ap;
  }
  function fmtDuration(start, end){
    const d = Math.max(15, (end||0) - (start||0));
    if(d >= 60) return Math.round(d/60) + 'hr';
    return d + 'min';
  }
  function weekDates(offset){
    const today = dayOf(0);
    const sun = new Date(today);
    sun.setDate(today.getDate() - today.getDay() + offset * 7);
    return Array.from({length:7}, (_, i) => {
      const d = new Date(sun); d.setDate(sun.getDate() + i); return iso(d);
    });
  }
  function monthStr(){ const d = monthOf(monthOffset); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }

  async function loadDayCache(monthStrVal){
    dayCache = {};
    const [y,m] = monthStrVal.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    for(let d = 1; d <= days; d++){
      const ds = monthStrVal + '-' + String(d).padStart(2,'0');
      if(typeof window.getDayDataByDate === 'function'){
        dayCache[ds] = await window.getDayDataByDate(ds);
      } else {
        dayCache[ds] = {};
      }
    }
  }

  function ideaEventsForDay(dateStr){
    const events = [];
    const WINDOW_TO_SLOT = { before_work:'beforeWork', during_work:'duringWork', after_work:'afterWork', evening_shutdown:'eveningShutdown' };
    if(typeof IdeasStore !== 'undefined'){
      IdeasStore.getIdeas().forEach(i => {
        if(['planned','in_progress'].includes(i.status) && i.schedule?.date === dateStr && i.steps?.step1){
          events.push({ type:'idea', id:'idea-'+i.id, ideaId:i.id, text:i.steps.step1,
            slot:WINDOW_TO_SLOT[i.schedule.window]||'beforeWork', done:false });
        }
      });
    }
    if(typeof window.ensureIdeas === 'function') window.ensureIdeas();
    const g = window.globals;
    if(g?.ideas){
      g.ideas.forEach(raw => {
        const norm = typeof window.normalizeIdea === 'function' ? window.normalizeIdea(raw) : raw;
        if(norm.status === 'growing' && norm.flow?.scheduleDate === dateStr && norm.flow.steps?.[0]){
          if(events.some(e => e.ideaId === norm.id)) return;
          events.push({ type:'idea', id:'idea-'+norm.id, ideaId:norm.id, text:norm.flow.steps[0],
            slot:norm.flow.scheduleSlot, done:!!norm.flow.stepsDone?.[0] });
        }
      });
    }
    const day = dayCache[dateStr];
    if(day?.faithfulFew?.mustDo?.items){
      day.faithfulFew.mustDo.items.forEach(it => {
        events.push({ type:'mustdo', id:'md-'+it.id, mustDoId:it.id, text:it.text, done:!!it.done, slot:'beforeWork' });
      });
    }
    const fs = store();
    if(fs){
      fs.getTasksForDate(dateStr).forEach(t => {
        if(t.legacyMustDoId && events.some(e => e.type === 'mustdo' && e.mustDoId === t.legacyMustDoId)) return;
        if(!t.title) return;
        events.push({ type:'task', id:'t-'+t.id, taskId:t.id, text:t.title, done:!!t.completed,
          slot:t.timeSlot||'beforeWork', startTime:t.startTime, durationMin:t.durationMin });
      });
    }
    return events;
  }

  function gridEventsForDay(dateStr){
    const out = [];
    const q = searchQuery.trim().toLowerCase();
    const match = t => !q || String(t).toLowerCase().includes(q);

    if(filters.recurring){
      if(typeof window.ensureMyWeek === 'function') window.ensureMyWeek();
      const dow = new Date(dateStr+'T12:00:00').getDay();
      (window.globals?.myWeek?.[dow]||[]).forEach((b, i) => {
        const start = parseTime(b.start) ?? mins(9,0);
        const end = parseTime(b.end) ?? start + 60;
        if(!match(b.label)) return;
        out.push({ id:'rec-'+dow+'-'+i, type:'recurring', title:b.label||'Block', date:dateStr,
          startMin:start, endMin:end, allDay:!b.start, done:false, color:EVENT_COLORS.recurring });
      });
      const fs = store();
      fs?.getScheduleBlocksForDate(dateStr).forEach(b => {
        const start = parseTime(b.startTime) ?? mins(9,0);
        const end = parseTime(b.endTime) ?? start + 60;
        if(!match(b.label)) return;
        out.push({ id:'blk-'+b.id, type:'block', title:b.label||'Block', date:dateStr,
          startMin:start, endMin:end, allDay:!b.startTime, done:false, color:EVENT_COLORS.block });
      });
    }

    ideaEventsForDay(dateStr).forEach(ev => {
      if(ev.type === 'task' && !filters.tasks) return;
      if(ev.type === 'idea' && !filters.ideas) return;
      if(ev.type === 'mustdo' && !filters.mustdos) return;
      if(!match(ev.text)) return;
      let start, end;
      if(ev.slot === 'timed' && ev.startTime){
        start = parseTime(ev.startTime) ?? mins(12,0);
        end = start + (ev.durationMin || 30);
      } else {
        const r = SLOT_RANGE[ev.slot] || SLOT_RANGE.beforeWork;
        start = r.start; end = r.end;
      }
      out.push({ id:ev.id, type:ev.type, title:ev.text, date:dateStr, startMin:start, endMin:end,
        allDay:false, done:!!ev.done, slot:ev.slot, ideaId:ev.ideaId, taskId:ev.taskId,
        mustDoId:ev.mustDoId, color:EVENT_COLORS[ev.type]||EVENT_COLORS.task, raw:ev });
    });
    return out;
  }

  function renderMiniMonth(){
    const el = document.getElementById('ncalMini');
    if(!el) return;
    const m = monthOf(monthOffset);
    const y = m.getFullYear(), mo = m.getMonth();
    const today = iso(dayOf(0));
    const first = new Date(y, mo, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, mo+1, 0).getDate();
    const label = m.toLocaleDateString('en-US', { month:'long', year:'numeric' });
    let h = '<div class="ncal-mini-head"><button type="button" class="ncal-mini-nav" data-ncal-mini="-1" aria-label="Previous month">‹</button>'+
      '<span>'+label+'</span><button type="button" class="ncal-mini-nav" data-ncal-mini="1" aria-label="Next month">›</button></div>'+
      '<div class="ncal-mini-grid">';
    ['S','M','T','W','T','F','S'].forEach(d => { h += '<span class="ncal-mini-dow">'+d+'</span>'; });
    for(let i = 0; i < startPad; i++) h += '<span class="ncal-mini-day empty"></span>';
    for(let d = 1; d <= daysInMonth; d++){
      const ds = y+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      h += '<button type="button" class="ncal-mini-day'+(ds===today?' today':'')+'" data-ncal-jump="'+ds+'">'+d+'</button>';
    }
    h += '</div>';
    el.innerHTML = h;
  }

  function renderFilters(){
    const el = document.getElementById('ncalFilters');
    if(!el) return;
    const items = [
      { key:'tasks', label:'Tasks', color:EVENT_COLORS.task },
      { key:'ideas', label:'Ideas', color:EVENT_COLORS.idea },
      { key:'mustdos', label:'Must-dos', color:EVENT_COLORS.mustdo },
      { key:'recurring', label:'Recurring', color:EVENT_COLORS.recurring }
    ];
    el.innerHTML = items.map(it =>
      '<label class="ncal-filter"><input type="checkbox" data-ncal-filter="'+it.key+'"'+(filters[it.key]?' checked':'')+'>'+
      '<span class="ncal-filter-dot" style="background:'+it.color+'"></span>'+esc(it.label)+'</label>'
    ).join('');
  }

  function renderMyWeek(){
    const panel = document.getElementById('ncalMyWeek');
    if(!panel) return;
    panel.hidden = !myWeekOpen;
    if(!myWeekOpen) return;
    if(typeof window.ensureMyWeek === 'function') window.ensureMyWeek();
    const mw = window.globals?.myWeek || {};
    panel.innerHTML = MY_WEEK_DAYS.map((name, i) => {
      const blocks = (mw[i]||[]).map((b, bi) =>
        '<div class="ncal-mw-row" data-dow="'+i+'" data-bi="'+bi+'">'+
        '<input type="text" data-mw-label value="'+esc(b.label||'')+'" placeholder="Label">'+
        '<input type="time" data-mw-start value="'+(b.start||'')+'"><input type="time" data-mw-end value="'+(b.end||'')+'">'+
        '<button type="button" class="ncal-mw-rm" data-mw-rm aria-label="Remove">×</button></div>'
      ).join('');
      return '<div class="ncal-mw-day"><h5>'+name+'</h5>'+blocks+
        '<button type="button" class="ncal-text-btn" data-mw-add="'+i+'">+ Add block</button></div>';
    }).join('');
  }

  function renderWeekGrid(dates){
    const today = iso(dayOf(0));
    const totalH = (HOUR_END - HOUR_START + 1) * HOUR_H;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const showNow = dates.includes(today) && nowMin >= HOUR_START*60 && nowMin <= HOUR_END*60 + 59;
    const nowTop = ((nowMin - HOUR_START*60) / 60) * HOUR_H;

    let head = '<div class="ncal-week-head"><div class="ncal-gutter-spacer"></div>';
    dates.forEach(d => {
      const dt = new Date(d+'T12:00:00');
      const isToday = d === today;
      head += '<div class="ncal-col-head'+(isToday?' today':'')+'"><span class="ncal-dow">'+dt.toLocaleDateString('en-US',{weekday:'short'})+'</span>'+
        '<span class="ncal-dom">'+dt.getDate()+'</span></div>';
    });
    head += '</div>';

    let allday = '<div class="ncal-allday-row"><div class="ncal-gutter-label">All-day</div>';
    dates.forEach(d => {
      const all = gridEventsForDay(d).filter(e => e.allDay);
      allday += '<div class="ncal-allday-col" data-ncal-date="'+d+'">'+
        all.map(e => '<button type="button" class="ncal-allday-pill" data-ncal-ev="'+esc(e.id)+'" data-ncal-date="'+d+'" style="--ev-color:'+e.color+'">'+esc(e.title)+'</button>').join('')+
        '</div>';
    });
    allday += '</div>';

    let gutter = '';
    for(let h = HOUR_START; h <= HOUR_END; h++){
      gutter += '<div class="ncal-hour-label" style="height:'+HOUR_H+'px">'+fmtTime(mins(h,0)).replace(':00','')+'</div>';
    }

    let cols = '';
    dates.forEach(d => {
      const timed = gridEventsForDay(d).filter(e => !e.allDay);
      cols += '<div class="ncal-day-col" data-ncal-date="'+d+'" style="height:'+totalH+'px">';
      for(let h = HOUR_START; h <= HOUR_END; h++){
        cols += '<div class="ncal-hour-slot" data-ncal-date="'+d+'" data-ncal-hour="'+h+'" style="height:'+HOUR_H+'px"></div>';
      }
      if(d === today && showNow){
        cols += '<div class="ncal-now-line" style="top:'+nowTop+'px"><span class="ncal-now-badge">'+fmtTime(nowMin)+'</span></div>';
      }
      timed.forEach(e => {
        const top = ((e.startMin - HOUR_START*60) / 60) * HOUR_H;
        const h = Math.max(22, ((e.endMin - e.startMin) / 60) * HOUR_H);
        cols += '<button type="button" class="ncal-event'+(e.done?' done':'')+'" data-ncal-ev="'+esc(e.id)+'" data-ncal-date="'+d+'"'+
          ' style="top:'+top+'px;height:'+h+'px;--ev-color:'+e.color+'" title="'+esc(e.title)+'">'+
          '<span class="ncal-event-title">'+esc(e.title)+'</span>'+
          '<span class="ncal-event-time">'+fmtTime(e.startMin)+'</span></button>';
      });
      cols += '</div>';
    });

    return '<div class="ncal-week">'+head+allday+
      '<div class="ncal-week-body"><div class="ncal-time-gutter">'+gutter+'</div><div class="ncal-cols">'+cols+'</div></div></div>';
  }

  function renderMonthGrid(){
    const ms = monthStr();
    const [y,m] = ms.split('-').map(Number);
    const today = iso(dayOf(0));
    const first = new Date(y, m-1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    let h = '<div class="ncal-month"><div class="ncal-month-head">';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { h += '<span>'+d+'</span>'; });
    h += '</div><div class="ncal-month-grid">';
    for(let i = 0; i < startPad; i++) h += '<div class="ncal-month-cell empty"></div>';
    for(let d = 1; d <= daysInMonth; d++){
      const ds = ms+'-'+String(d).padStart(2,'0');
      const evs = gridEventsForDay(ds).slice(0,3);
      h += '<button type="button" class="ncal-month-cell'+(ds===today?' today':'')+'" data-ncal-jump="'+ds+'">'+
        '<span class="ncal-month-num">'+d+'</span><div class="ncal-month-dots">'+
        evs.map(e => '<span class="ncal-dot" style="background:'+e.color+'"></span>').join('')+'</div></button>';
    }
    h += '</div></div>';
    return h;
  }

  function updateTitle(){
    const el = document.getElementById('ncalTitle');
    if(!el) return;
    if(viewMode === 'week'){
      const dates = weekDates(weekOffset);
      const a = new Date(dates[0]+'T12:00:00');
      const b = new Date(dates[6]+'T12:00:00');
      if(a.getMonth() === b.getMonth()){
        el.textContent = a.toLocaleDateString('en-US',{month:'long',year:'numeric'});
      } else {
        el.textContent = a.toLocaleDateString('en-US',{month:'short'})+' – '+b.toLocaleDateString('en-US',{month:'short',year:'numeric'});
      }
    } else {
      el.textContent = monthOf(monthOffset).toLocaleDateString('en-US',{month:'long',year:'numeric'});
    }
  }

  async function renderCalendar(){
    const grid = document.getElementById('ncalGrid');
    if(!grid) return;
    await loadDayCache(monthStr());
    if(viewMode === 'week'){
      const dates = weekDates(weekOffset);
      await Promise.all(dates.filter(d => !dayCache[d]).map(async d => {
        if(typeof window.getDayDataByDate === 'function') dayCache[d] = await window.getDayDataByDate(d);
      }));
      grid.innerHTML = renderWeekGrid(dates);
    } else {
      grid.innerHTML = renderMonthGrid();
    }
    updateTitle();
    renderMiniMonth();
    renderFilters();
    renderMyWeek();
    clearTimeout(nowTimer);
    nowTimer = setTimeout(renderCalendar, 60000);
  }

  function openDrawer(payload){
    drawer = payload;
    const panel = document.getElementById('ncalDrawer');
    const backdrop = document.getElementById('ncalDrawerBackdrop');
    if(!panel) return;
    const slots = ['beforeWork','duringWork','afterWork','eveningShutdown','timed'];
    panel.innerHTML =
      '<div class="ncal-drawer-head">'+
      '<select class="ncal-drawer-type" id="ncalDrType"><option value="task">Task</option></select>'+
      '<button type="button" class="ncal-drawer-close" id="ncalDrClose" aria-label="Close">×</button></div>'+
      '<input type="text" class="ncal-drawer-title" id="ncalDrTitle" placeholder="Title" value="'+esc(payload.title||'')+'">'+
      '<div class="ncal-drawer-row"><span class="ncal-drawer-icon">🕐</span>'+
      '<div><div class="ncal-drawer-time">'+fmtTime(payload.startMin)+' → '+fmtTime(payload.endMin)+
      ' <span class="ncal-muted">'+fmtDuration(payload.startMin,payload.endMin)+'</span></div>'+
      '<div class="ncal-drawer-date">'+new Date((payload.date||iso(dayOf(0)))+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</div></div></div>'+
      '<div class="ncal-drawer-row"><span class="ncal-drawer-icon">↕</span>'+
      '<input type="time" id="ncalDrStart" value="'+minsToInput(payload.startMin)+'"> → <input type="time" id="ncalDrEnd" value="'+minsToInput(payload.endMin)+'"></div>'+
      '<div class="ncal-drawer-row"><span class="ncal-drawer-icon">▦</span>'+
      '<select id="ncalDrSlot">'+slots.map(s=>'<option value="'+s+'"'+(payload.slot===s?' selected':'')+'>'+PIPE_SLOT_LABELS[s]+'</option>').join('')+'</select></div>'+
      '<div class="ncal-drawer-row"><span class="ncal-drawer-icon">☑</span>'+
      '<label class="ncal-check"><input type="checkbox" id="ncalDrDone"'+(payload.done?' checked':'')+'> Mark complete</label></div>'+
      '<textarea class="ncal-drawer-desc" id="ncalDrDesc" rows="3" placeholder="Description"></textarea>'+
      '<div class="ncal-drawer-actions">'+
      (payload.evId && !payload.evId.startsWith('rec-') && !payload.evId.startsWith('blk-') ?
        '<button type="button" class="ncal-btn ncal-btn-danger" id="ncalDrDelete">Delete</button>' : '')+
      '<button type="button" class="ncal-btn ncal-btn-primary" id="ncalDrSave">Save</button></div>';
    panel.hidden = false;
    backdrop.hidden = false;
    document.getElementById('ncalDrTitle')?.focus();
  }

  function minsToInput(m){
    const h = Math.floor(m/60), min = m%60;
    return String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');
  }
  function closeDrawer(){ drawer = null; document.getElementById('ncalDrawer').hidden = true; document.getElementById('ncalDrawerBackdrop').hidden = true; }

  function findEvent(evId, dateStr){
    return gridEventsForDay(dateStr).find(e => e.id === evId);
  }

  async function saveDrawer(){
    if(!drawer) return;
    const title = document.getElementById('ncalDrTitle')?.value.trim();
    const startMin = parseTime(document.getElementById('ncalDrStart')?.value) ?? drawer.startMin;
    const endMin = parseTime(document.getElementById('ncalDrEnd')?.value) ?? drawer.endMin;
    const slot = document.getElementById('ncalDrSlot')?.value || 'beforeWork';
    const done = !!document.getElementById('ncalDrDone')?.checked;
    const fs = store();
    if(drawer.mode === 'new'){
      if(!title || !fs) return;
      fs.createTask({ title, date:drawer.date, timeSlot:slot, tag:'stewardship',
        startTime: slot === 'timed' ? minsToInput(startMin) : '', durationMin: endMin - startMin });
      await fs.save();
      if(typeof window.markDirty === 'function') window.markDirty();
    } else if(drawer.evId?.startsWith('t-') && fs){
      fs.updateTask(drawer.evId.slice(2), { title, timeSlot:slot, completed:done,
        startTime: slot === 'timed' ? minsToInput(startMin) : '', durationMin: endMin - startMin });
      await fs.save();
      if(typeof window.markDirty === 'function') window.markDirty();
    } else if(drawer.evId?.startsWith('md-')){
      const day = dayCache[drawer.date] || await window.getDayDataByDate(drawer.date);
      const md = day.faithfulFew?.mustDo?.items?.find(x => 'md-'+x.id === drawer.evId);
      if(md){ md.text = title; md.done = done; await window.saveDayDataByDate(drawer.date, day); }
    }
    closeDrawer();
    await renderCalendar();
    if(typeof window.renderDashboard === 'function') window.renderDashboard();
  }

  async function calDeleteEvent(evId, dateStr){
    if(!dateStr) return;
    const fs = store();
    if(evId.startsWith('t-') && fs){
      const task = fs.getTask(evId.slice(2));
      if(!task) return;
      await fs.deleteTaskAndSave(task.id);
      if(typeof window.showIdeaToast === 'function') window.showIdeaToast('Task removed.');
      return;
    }
    if(evId.startsWith('md-')){
      const mustDoId = evId.slice(3);
      const day = dayCache[dateStr] || await window.getDayDataByDate(dateStr);
      if(!day.faithfulFew?.mustDo?.items) return;
      day.faithfulFew.mustDo.items = day.faithfulFew.mustDo.items.filter(x => x.id !== mustDoId);
      await window.saveDayDataByDate(dateStr, day);
      const task = fs?.findTaskByLegacyMustDo(mustDoId, dateStr);
      if(task) await fs.deleteTaskAndSave(task.id);
      if(typeof window.showIdeaToast === 'function') window.showIdeaToast('Item removed.');
      return;
    }
    if(evId.startsWith('idea-')){
      const ideaId = evId.slice(5);
      const g = window.globals;
      const idea = g?.ideas?.find(x => x.id === ideaId);
      if(idea?.flow?.scheduleDate){
        idea.flow.scheduleDate = '';
        if(typeof window.markDirty === 'function') window.markDirty();
        if(typeof window.showIdeaToast === 'function') window.showIdeaToast('Idea unscheduled.');
      }
    }
  }

  async function deleteDrawerEvent(){
    if(!drawer?.evId || !drawer.date) return;
    await calDeleteEvent(drawer.evId, drawer.date);
    closeDrawer();
    await renderCalendar();
    if(typeof window.renderDashboard === 'function') window.renderDashboard();
  }

  function bindCalendarEvents(){
    if(document.body.dataset.ncalBound) return;
    document.body.dataset.ncalBound = '1';

    document.getElementById('ncalPrev')?.addEventListener('click', () => {
      if(viewMode === 'week') weekOffset--; else monthOffset--;
      renderCalendar();
    });
    document.getElementById('ncalNext')?.addEventListener('click', () => {
      if(viewMode === 'week') weekOffset++; else monthOffset++;
      renderCalendar();
    });
    document.getElementById('ncalToday')?.addEventListener('click', () => {
      weekOffset = 0; monthOffset = 0; renderCalendar();
    });
    document.getElementById('ncalViewSelect')?.addEventListener('change', e => {
      viewMode = e.target.value; renderCalendar();
    });
    document.getElementById('ncalNewEvent')?.addEventListener('click', () => {
      const d = iso(dayOf(0));
      openDrawer({ mode:'new', date:d, title:'', startMin:mins(9,0), endMin:mins(10,0), slot:'duringWork', done:false });
    });
    document.getElementById('ncalSearch')?.addEventListener('input', e => {
      searchQuery = e.target.value; renderCalendar();
    });
    document.getElementById('ncalMyWeekToggle')?.addEventListener('click', () => {
      myWeekOpen = !myWeekOpen; renderMyWeek();
    });
    document.getElementById('ncalMini')?.addEventListener('click', e => {
      const nav = e.target.closest('[data-ncal-mini]');
      if(nav){ monthOffset += +nav.dataset.ncalMini; renderCalendar(); return; }
      const jump = e.target.closest('[data-ncal-jump]');
      if(jump){
        const d = new Date(jump.dataset.ncalJump+'T12:00:00');
        weekOffset = Math.round((d - dayOf(0)) / 86400000 / 7);
        viewMode = 'week';
        const sel = document.getElementById('ncalViewSelect');
        if(sel) sel.value = 'week';
        renderCalendar();
      }
    });
    document.getElementById('ncalFilters')?.addEventListener('change', e => {
      const k = e.target.dataset?.ncalFilter;
      if(k){ filters[k] = e.target.checked; renderCalendar(); }
    });
    document.getElementById('ncalMyWeek')?.addEventListener('input', e => {
      const row = e.target.closest('[data-dow]');
      if(!row) return;
      const dow = +row.dataset.dow, bi = +row.dataset.bi;
      if(typeof window.ensureMyWeek === 'function') window.ensureMyWeek();
      const b = window.globals.myWeek[dow][bi] || (window.globals.myWeek[dow][bi] = {});
      if(e.target.dataset.mwLabel !== undefined) b.label = e.target.value;
      if(e.target.dataset.mwStart !== undefined) b.start = e.target.value;
      if(e.target.dataset.mwEnd !== undefined) b.end = e.target.value;
      if(typeof window.markDirty === 'function') window.markDirty();
      renderCalendar();
    });
    document.getElementById('ncalMyWeek')?.addEventListener('click', e => {
      if(e.target.dataset.mwAdd !== undefined){
        if(typeof window.ensureMyWeek === 'function') window.ensureMyWeek();
        window.globals.myWeek[+e.target.dataset.mwAdd].push({ label:'', start:'', end:'' });
        if(typeof window.markDirty === 'function') window.markDirty();
        renderMyWeek(); return;
      }
      if(e.target.closest('[data-mw-rm]')){
        const row = e.target.closest('[data-dow]');
        window.globals.myWeek[+row.dataset.dow].splice(+row.dataset.bi, 1);
        if(typeof window.markDirty === 'function') window.markDirty();
        renderMyWeek(); renderCalendar();
      }
    });

    document.getElementById('ncalGrid')?.addEventListener('click', e => {
      const ev = e.target.closest('[data-ncal-ev]');
      if(ev){
        const found = findEvent(ev.dataset.ncalEv, ev.dataset.ncalDate);
        if(found){
          openDrawer({ mode:'edit', evId:found.id, date:found.date, title:found.title,
            startMin:found.startMin, endMin:found.endMin, slot:found.slot||'beforeWork', done:found.done });
        }
        return;
      }
      const slot = e.target.closest('[data-ncal-hour]');
      if(slot){
        const h = +slot.dataset.ncalHour;
        openDrawer({ mode:'new', date:slot.dataset.ncalDate, title:'', startMin:mins(h,0), endMin:mins(h,30), slot:'timed', done:false });
      }
      const jump = e.target.closest('[data-ncal-jump]');
      if(jump){
        viewMode = 'week';
        document.getElementById('ncalViewSelect').value = 'week';
        const d = new Date(jump.dataset.ncalJump+'T12:00:00');
        weekOffset = Math.round((d - dayOf(0)) / 86400000 / 7);
        renderCalendar();
      }
    });

    document.getElementById('ncalDrawer')?.addEventListener('click', e => {
      if(e.target.id === 'ncalDrClose') closeDrawer();
      if(e.target.id === 'ncalDrSave') saveDrawer();
      if(e.target.id === 'ncalDrDelete') deleteDrawerEvent();
    });
    document.getElementById('ncalDrawerBackdrop')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && drawer) closeDrawer();
    });
  }

  function loadCalendar(){
    if(typeof window.ensureIdeas === 'function') window.ensureIdeas();
    if(typeof window.ensureMyWeek === 'function') window.ensureMyWeek();
    bindCalendarEvents();
    renderCalendar();
  }

  root.renderCalendar = renderCalendar;
  root.loadCalendar = loadCalendar;
  root.bindCalendarEvents = bindCalendarEvents;

})(typeof window !== 'undefined' ? window : globalThis);
