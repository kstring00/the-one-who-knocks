/**
 * Stewardship Calendar — the signature surface of With Little.
 *
 * Focused Day, Agenda, and Planning views built on StewStore,
 * with the existing data sources (Daily Ledger must-dos, Dashboard tasks,
 * scheduled Ideas, recurring blocks) merged into the same day so everything
 * connects back to one question: how do I faithfully steward today?
 */
(function(root){
  'use strict';

  /* ── constants ─────────────────────────────────────────────── */
  const HOUR_START = 6, HOUR_END = 22, HOUR_H = 52;
  const PRIORITY_LABEL = { high:'High', medium:'Medium', low:'Low' };
  const ENERGY_LABEL = { high:'High focus', medium:'Steady', low:'Low' };
  const URGENCY_LABEL = { today:'Today', week:'This week', later:'Later', someday:'Someday' };
  const SEGMENTS = [ ['all','All'], ['morning','Morning'], ['midday','Midday'], ['evening','Evening'] ];
  const LEGACY_META = {
    task:      { label:'Dashboard task', category:'work' },
    mustdo:    { label:'Daily Ledger',   category:'personal' },
    idea:      { label:'Ideas Hub',      category:'learning' },
    recurring: { label:'Recurring',      category:'admin' },
    block:     { label:'Schedule block', category:'admin' }
  };
  const SLOT_RANGE = {
    beforeWork:{ start:360, end:480 }, duringWork:{ start:540, end:720 },
    afterWork:{ start:1020, end:1110 }, eveningShutdown:{ start:1200, end:1290 }
  };
  const SLOT_LABELS = { beforeWork:'Before Work', duringWork:'During Work',
    afterWork:'After Work', eveningShutdown:'Evening Shutdown', timed:'Timed' };
  const VERSES = [
    ['Commit your work to the Lord, and your plans will be established.','Proverbs 16:3'],
    ['Whatever you do, do it from the heart, as something done for the Lord.','Colossians 3:23'],
    ['Teach us to number our days, that we may gain a heart of wisdom.','Psalm 90:12'],
    ['Be still, and know that I am God.','Psalm 46:10'],
    ['Your word is a lamp for my feet, a light on my path.','Psalm 119:105'],
    ['Well done, good and faithful servant. You were faithful over a few things.','Matthew 25:21'],
    ['Seek first the kingdom of God and His righteousness.','Matthew 6:33']
  ];
  const REFLECTION_CHIPS = [
    ['Wins','Wins — where did I see faithfulness today?\n'],
    ['Lessons','Lessons — what did today teach me?\n'],
    ['Gratitude','Gratitude — three gifts from today:\n1. \n2. \n3. '],
    ['Tomorrow','Prepare tomorrow — the one thing that matters most:\n']
  ];

  /* ── state ─────────────────────────────────────────────────── */
  let view = 'day';
  let anchor = null;              // ISO date the views orbit around
  let segment = 'all';
  let searchQuery = '';
  let activeCats = null;          // Set of category ids (null = all)
  let drawer = null;              // { mode, draft, eventId, legacy }
  let dayCache = {};              // legacy must-do day data
  let nowTimer = null;

  function S(){ return root.StewStore; }
  function esc(s){
    if(typeof root.esc === 'function') return root.esc(s);
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function iso(d){ return d.toISOString().slice(0,10); }
  function dayOf(off){ const d=new Date(); d.setDate(d.getDate()+(off||0)); d.setHours(12,0,0,0); return d; }
  function addDays(dateStr, n){ const d=new Date(dateStr+'T12:00:00'); d.setDate(d.getDate()+n); return iso(d); }
  function mondayOfDateStr(dateStr){
    const d = new Date(dateStr+'T12:00:00');
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return iso(d);
  }
  function habitWeekDots(h, dateStr){
    const today = iso(dayOf(0));
    const weekStart = mondayOfDateStr(dateStr);
    return Array.from({length:7}, (_, i) => {
      const d = addDays(weekStart, i);
      const applies = S().habitAppliesOn(h, d);
      const done = S().habitDone(h.id, d);
      const isToday = d === dateStr;
      let cls = 'stew-h-dot';
      if(!applies) cls += ' na';
      else if(done) cls += ' hit';
      else if(d < today) cls += ' miss';
      else cls += ' pending';
      if(isToday) cls += ' today';
      const dt = new Date(d+'T12:00:00');
      const label = dt.toLocaleDateString('en-US',{weekday:'short'});
      return '<span class="'+cls+'" title="'+label+(done?' — kept':applies?'':' — off')+'" aria-hidden="true"></span>';
    }).join('');
  }
  function mins(h,m){ return h*60+(m||0); }
  function parseTime(t){
    const p = String(t||'').match(/^(\d{1,2}):(\d{2})/);
    return p ? mins(+p[1],+p[2]) : null;
  }
  function fmtTime(m){
    if(m==null) return '';
    const h = Math.floor(m/60), min = m%60, ap = h>=12?'PM':'AM', h12 = h%12||12;
    return h12+(min?':'+String(min).padStart(2,'0'):'')+' '+ap;
  }
  function fmtDur(min){
    if(!min) return '';
    const h = Math.floor(min/60), m = min%60;
    return (h? h+'h':'')+(h&&m?' ':'')+(m? m+'m':'') || '0m';
  }
  function minsToInput(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  function fmtDateLong(dateStr){
    return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  }
  function fmtDateShort(dateStr){
    return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }
  function relDay(dateStr){
    const t = iso(dayOf(0));
    if(dateStr===t) return 'Today';
    if(dateStr===addDays(t,1)) return 'Tomorrow';
    if(dateStr===addDays(t,-1)) return 'Yesterday';
    return null;
  }
  function catOf(id){ return S().CATEGORIES.find(c=>c.id===id) || S().CATEGORIES[0]; }
  function verseFor(dateStr){
    const n = dateStr.split('-').reduce((a,b)=>a+parseInt(b,10),0);
    return VERSES[n % VERSES.length];
  }
  function toast(msg){ if(typeof root.showIdeaToast === 'function') root.showIdeaToast(msg); }
  function catMatch(catId){ return !activeCats || activeCats.has(catId); }
  function textMatch(t){ const q = searchQuery.trim().toLowerCase(); return !q || String(t||'').toLowerCase().includes(q); }

  /* ── legacy sources (Daily Ledger, Dashboard, Ideas, recurring) ── */
  async function loadLegacyDay(dateStr){
    if(dayCache[dateStr] !== undefined) return;
    dayCache[dateStr] = typeof root.getDayDataByDate === 'function'
      ? await root.getDayDataByDate(dateStr) : {};
  }
  function legacyEventsForDay(dateStr){
    const out = [];
    const push = (type, o) => {
      const meta = LEGACY_META[type];
      out.push(Object.assign({ legacy:type, category:meta.category, sub:meta.label,
        color:catOf(meta.category).color }, o));
    };
    if(typeof root.ensureMyWeek === 'function') root.ensureMyWeek();
    const dow = new Date(dateStr+'T12:00:00').getDay();
    (root.globals?.myWeek?.[dow]||[]).forEach((b,i)=>{
      const start = parseTime(b.start) ?? mins(9,0);
      push('recurring', { id:'rec-'+dow+'-'+i, title:b.label||'Block', date:dateStr,
        startMin:start, endMin:parseTime(b.end) ?? start+60, allDay:!b.start, done:false, readonly:true });
    });
    const fs = root.faithStore;
    fs?.getScheduleBlocksForDate?.(dateStr).forEach(b=>{
      const start = parseTime(b.startTime) ?? mins(9,0);
      push('block', { id:'blk-'+b.id, title:b.label||'Block', date:dateStr,
        startMin:start, endMin:parseTime(b.endTime) ?? start+60, allDay:!b.startTime, done:false, readonly:true });
    });
    const mdIds = new Set();
    const day = dayCache[dateStr];
    (day?.faithfulFew?.mustDo?.items||[]).forEach(it=>{
      mdIds.add(it.id);
    });
    fs?.getTasksForDate?.(dateStr).forEach(t=>{
      if(!t.title) return;
      if(t.legacyMustDoId && mdIds.has(t.legacyMustDoId)) return;
      if(t.projectId && S().getTask(t.id)) return;
      let start, end;
      if(t.timeSlot==='timed' && t.startTime){
        start = parseTime(t.startTime);
        if(start == null) return;
        end = start+(t.durationMin||30);
      }
      else {
        if(!t.timeSlot || (t.timeSlot === 'beforeWork' && !t.startTime)) return;
        const r = SLOT_RANGE[t.timeSlot];
        if(!r) return;
        start = r.start; end = r.end;
      }
      if(t.anchorId) end = start + (t.durationMin || 20);
      const ev = { id:'t-'+t.id, taskId:t.id, title:t.title, date:dateStr,
        startMin:start, endMin:end, done:!!t.completed, slot:t.timeSlot };
      push('task', ev);
      if(t.anchorId || t.tag==='first-fruits'){
        const last = out[out.length-1];
        last.category = 'spiritual'; last.color = catOf('spiritual').color; last.sub = 'First fruits';
      }
    });
    if(typeof root.ensureIdeas === 'function') root.ensureIdeas();
    (root.globals?.ideas||[]).forEach(raw=>{
      const n = typeof root.normalizeIdea === 'function' ? root.normalizeIdea(raw) : raw;
      if(n.status==='growing' && n.flow?.scheduleDate===dateStr && n.flow.steps?.[0]){
        const r = SLOT_RANGE[n.flow.scheduleSlot];
        if(!r) return;
        push('idea', { id:'idea-'+n.id, ideaId:n.id, title:n.flow.steps[0], date:dateStr,
          startMin:r.start, endMin:r.end, done:!!n.flow.stepsDone?.[0], slot:n.flow.scheduleSlot });
      }
    });
    return out;
  }
  function stewEventsForDay(dateStr){
    return S().eventsForDate(dateStr).map(e=>Object.assign({ color:catOf(e.category).color, sub:eventSub(e) }, e));
  }
  function eventSub(e){
    const g = e.goalId && S().getGoal(e.goalId);
    const p = e.projectId && S().getProject(e.projectId);
    if(g && p) return 'Goal: '+g.title+' · '+p.title;
    if(g) return 'Goal: '+g.title;
    if(p) return 'Project: '+p.title;
    return (e.notes||'').split('\n')[0];
  }
  function allEventsForDay(dateStr){
    return stewEventsForDay(dateStr).concat(legacyEventsForDay(dateStr))
      .filter(e=>catMatch(e.category) && textMatch(e.title))
      .sort((a,b)=>a.startMin-b.startMin);
  }

  /* ── shared bits ───────────────────────────────────────────── */
  function chip(cls, text){ return '<span class="stew-chip '+cls+'">'+esc(text)+'</span>'; }
  function priChip(p){ return chip('pri-'+p, PRIORITY_LABEL[p]); }
  function catPill(catId){
    const c = catOf(catId);
    return '<span class="stew-cat-pill" style="--cat:'+c.color+'">'+esc(c.label)+'</span>';
  }
  function doneCircle(e){
    if(e.readonly) return '';
    return '<button type="button" class="stew-done-circle'+(e.done?' on':'')+'" '+
      'data-act="toggle-done" data-id="'+esc(e.id)+'" data-date="'+e.date+'" '+
      'aria-label="'+(e.done?'Mark not complete':'Mark complete')+'" aria-pressed="'+(e.done?'true':'false')+'">'+
      (e.done?'✓':'')+'</button>';
  }
  function selectHtml(attrs, options, value){
    return '<select '+attrs+'>'+options.map(o=>
      '<option value="'+esc(o[0])+'"'+(String(o[0])===String(value??'')?' selected':'')+'>'+esc(o[1])+'</option>'
    ).join('')+'</select>';
  }

  /* ── toolbar ───────────────────────────────────────────────── */
  function renderToolbar(){
    const views = [['day','Day'],['agenda','Agenda'],['planning','Planning']];
    let label;
    if(view==='month'){
      label = new Date(anchor+'T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
    } else if(view==='week'){
      const start = addDays(anchor, -new Date(anchor+'T12:00:00').getDay());
      label = fmtDateShort(start)+' – '+fmtDateShort(addDays(start,6));
    } else {
      label = (relDay(anchor) ? relDay(anchor)+' · ' : '')+fmtDateLong(anchor);
    }
    return '<div class="stew-toolbar">'+
      '<div class="stew-toolbar-row">'+
      '<label class="stew-view-select-wrap"><span class="sr-only">View</span>'+
      selectHtml('id="stewViewSelect" data-act-change="set-view-select" aria-label="Dashboard view"',
        views, view)+'</label>'+
      '<div class="stew-date-nav">'+
      '<button type="button" class="stew-nav-btn" data-act="nav" data-id="-1" aria-label="Previous">‹</button>'+
      '<span class="stew-date-label">'+esc(label)+'</span>'+
      '<button type="button" class="stew-nav-btn" data-act="nav" data-id="1" aria-label="Next">›</button>'+
      '</div>'+
      '<div class="stew-toolbar-tools">'+
      '<input type="search" class="stew-search" id="stewSearch" placeholder="Search" aria-label="Search events" value="'+esc(searchQuery)+'">'+
      '<button type="button" class="btn-gold stew-new-btn" data-act="new-event">+ New block</button>'+
      '</div></div></div>';
  }

  /* ── Faithfulness Ring ─────────────────────────────────────── */
  function ringWord(r){
    if(r.score==null) return 'A quiet page — plan one faithful block.';
    if(r.score>=100) return 'Well done, good and faithful.';
    if(r.score>=67) return 'You are faithfully living the day you planned.';
    if(r.score>=34) return 'Returning to the plan, one block at a time.';
    return 'Grace for what remains. Begin again gently.';
  }
  function ringSvg(r){
    const rings = [
      { rad:52, pct:r.keptPct,  color:'var(--gold)' },
      { rad:41, pct:r.habitPct, color:'var(--green)' },
      { rad:30, pct:r.bigPct,   color:'var(--text-primary)' }
    ];
    const arcs = rings.map(g=>{
      const c = 2*Math.PI*g.rad;
      return '<circle cx="60" cy="60" r="'+g.rad+'" fill="none" stroke="var(--bar-track)" stroke-width="7"/>'+
        '<circle cx="60" cy="60" r="'+g.rad+'" fill="none" stroke="'+g.color+'" stroke-width="7" '+
        'stroke-linecap="round" stroke-dasharray="'+(c*Math.max(0.001,g.pct))+' '+c+'" '+
        'transform="rotate(-90 60 60)" style="transition:stroke-dasharray .5s ease"/>';
    }).join('');
    const scoreTxt = r.score==null ? '·' : r.score;
    return '<svg viewBox="0 0 120 120" class="stew-ring-svg" role="img" aria-label="Stewardship score '+(r.score??'not started')+'">'+
      arcs+'<text x="60" y="58" text-anchor="middle" class="stew-ring-score">'+scoreTxt+'</text>'+
      '<text x="60" y="74" text-anchor="middle" class="stew-ring-caption">stewardship</text></svg>';
  }
  function renderRingCard(dateStr){
    const r = S().ringForDate(dateStr);
    const rows = [
      ['gold','Time planned', fmtDur(r.plannedMin)||'—'],
      ['gold','Time kept', fmtDur(r.keptMin)||'—'],
      ['deep','Deep work kept', fmtDur(r.deepMin)||'—'],
      ['green','Prayer', r.prayerDone?'✓ kept':'still entrusted'],
      ['rest','Rest', fmtDur(r.restMin)||'—'],
      ['green','Habits', r.habitsTotal? r.habitsDone+' / '+r.habitsTotal : '—']
    ].map(x=>'<div class="stew-ring-row"><span class="stew-ring-dot dot-'+x[0]+'"></span>'+
      '<span class="stew-ring-key">'+x[1]+'</span><span class="stew-ring-val">'+esc(String(x[2]))+'</span></div>').join('');
    return '<div class="stew-card stew-ring-card"><div class="stew-card-kicker">Faithfulness Ring</div>'+
      '<div class="stew-ring-wrap">'+ringSvg(r)+'<div class="stew-ring-legend">'+rows+'</div></div>'+
      '<p class="stew-ring-word">'+esc(ringWord(r))+'</p></div>';
  }

  /* ── Day view ──────────────────────────────────────────────── */
  function renderMissionCard(dateStr, dm){
    return '<div class="stew-card stew-mission stew-mission-quiet">'+
      '<div class="stew-card-kicker">Today’s theme</div>'+
      '<input type="text" class="stew-theme-input serif" data-daymeta="theme" data-date="'+dateStr+'" '+
      'value="'+esc(dm.theme)+'" placeholder="Name the day — e.g. Faithful in the small things" aria-label="Today’s theme">'+
      '<div class="stew-card-kicker" style="margin-top:12px">Today’s prayer</div>'+
      '<textarea class="stew-prayer-input" data-daymeta="prayer" data-date="'+dateStr+'" rows="2" '+
      'placeholder="Lord, help me steward what You’ve entrusted to me today…" aria-label="Today’s prayer">'+esc(dm.prayer)+'</textarea>'+
      '</div>';
  }
  function bigThreeCandidates(dateStr){
    const dm = S().getDayMeta(dateStr);
    return S().getTasks({status:'todo'})
      .filter(t=>!dm.bigThree.includes(t.id))
      .sort((a,b)=>(a.urgency==='today'?0:1)-(b.urgency==='today'?0:1))
      .slice(0,12);
  }
  function renderBigThreeCard(dateStr, dm){
    const rows = dm.bigThree.map((tid,i)=>{
      const t = S().getTask(tid);
      if(!t) return '';
      return '<div class="stew-b3-row'+(t.status==='done'?' done':'')+'">'+
        '<span class="stew-b3-num">'+(i+1)+'</span>'+
        '<label class="stew-b3-main"><input type="checkbox" data-act="task-done" data-id="'+t.id+'"'+(t.status==='done'?' checked':'')+'>'+
        '<span class="stew-b3-title">'+esc(t.title)+'</span></label>'+
        priChip(t.priority)+
        '<button type="button" class="stew-x" data-act="b3-remove" data-id="'+t.id+'" data-date="'+dateStr+'" aria-label="Remove from Big Three">×</button>'+
        '</div>';
    }).join('');
    const cands = bigThreeCandidates(dateStr);
    const picker = dm.bigThree.length<3 && cands.length ?
      '<div class="stew-b3-pick">'+selectHtml('data-act-change="b3-add" data-date="'+dateStr+'" aria-label="Choose a Big Three task"',
        [['','Choose a task to focus on…']].concat(cands.map(t=>[t.id, t.title+(t.priority==='high'?' · High':'')])), '')+'</div>' : '';
    const empty = !dm.bigThree.length && !cands.length ?
      '<p class="stew-empty">Add tasks in Planning, then crown up to three here.</p>' : '';
    return '<div class="stew-card stew-b3"><div class="stew-card-kicker">✦ Today’s Big Three'+
      (root.helpTip?.(3,'Choose up to three tasks that matter most today. Everything else waits in the Task Shelf.')||'')+'</div>'+
      (rows||'')+picker+empty+
      '<p class="stew-b3-hint">Only three. The rest can wait faithfully.</p></div>';
  }
  function renderScriptureCard(dateStr){
    const v = verseFor(dateStr);
    return '<div class="stew-card stew-verse stew-verse-sm"><div class="stew-card-kicker">Today’s Scripture</div>'+
      '<p class="stew-verse-text serif">“'+esc(v[0])+'”</p>'+
      '<cite class="stew-verse-ref">'+esc(v[1])+'</cite></div>';
  }
  function segmentOf(startMin){
    if(startMin < 12*60) return 'morning';
    if(startMin < 17*60) return 'midday';
    return 'evening';
  }
  function renderTimeline(dateStr){
    const events = allEventsForDay(dateStr).filter(e=>!e.allDay);
    const allDay = allEventsForDay(dateStr).filter(e=>e.allDay);
    const now = new Date();
    const isToday = dateStr===iso(dayOf(0));
    const nowHour = now.getHours();
    let rows = '';
    if(allDay.length){
      rows += '<div class="stew-allday">'+allDay.map(e=>
        '<span class="stew-allday-pill" style="--cat:'+e.color+'">'+esc(e.title)+'</span>').join('')+'</div>';
    }
    const covered = h => events.some(e=>e.startMin < (h+1)*60 && e.endMin > h*60);
    for(let h=HOUR_START; h<=HOUR_END; h++){
      const starting = events.filter(e=>Math.floor(e.startMin/60)===h);
      starting.forEach(e=>{ rows += timelineRow(e); });
      if(!covered(h)){
        rows += '<div class="stew-hour-empty'+(isToday&&h===nowHour?' now':'')+'" data-drop-hour="'+h+'" data-date="'+dateStr+'" '+
          'data-act="hour-create" role="button" tabindex="0" aria-label="Add block at '+fmtTime(mins(h,0))+'">'+
          '<span class="stew-hour-label">'+fmtTime(mins(h,0)).replace(':00','')+'</span>'+
          '<span class="stew-hour-line"></span></div>';
      }
    }
    if(!events.length && !allDay.length){
      rows += '<div class="stew-empty stew-timeline-empty">Nothing planned yet. Click an hour or drag a task from the Task Shelf onto the timeline.</div>';
    }
    return '<div class="stew-card stew-timeline">'+
      '<div class="stew-timeline-head">'+
      '<div class="stew-card-kicker">Today\u2019s schedule'+
      (root.helpTip?.(4,'Plan your day in time blocks. Click an empty hour to add one, or drag a task from the Task Shelf onto the timeline.')||'')+'</div>'+
      '<button type="button" class="btn-ghost" data-act="new-event">+ Add time block</button>'+
      '</div><div class="stew-timeline-body" data-date="'+dateStr+'">'+rows+'</div></div>';
  }
  function timelineRow(e){
    const isToday = e.date===iso(dayOf(0));
    const now = new Date(); const nowMin = now.getHours()*60+now.getMinutes();
    const isNow = isToday && !e.done && e.startMin<=nowMin && e.endMin>nowMin;
    return '<div class="stew-block'+(e.done?' done':'')+(isNow?' current':'')+(e.legacy?' legacy':'')+'" '+
      'style="--cat:'+e.color+'" data-act="open-event" data-id="'+esc(e.id)+'" data-date="'+e.date+'" '+
      (e.legacy?'':'draggable="true" ')+'role="button" tabindex="0">'+
      '<span class="stew-block-time">'+fmtTime(e.startMin)+' – '+fmtTime(e.endMin)+'</span>'+
      '<span class="stew-block-main"><span class="stew-block-title">'+esc(e.title)+'</span>'+
      (e.sub?'<span class="stew-block-sub">'+esc(e.sub)+'</span>':'')+'</span>'+
      '<span class="stew-block-side">'+catPill(e.category)+doneCircle(e)+'</span></div>';
  }
  function renderHabitsCard(dateStr){
    const habits = S().habitsForDate(dateStr);
    const total = habits.length, done = habits.filter(h=>S().habitDone(h.id,dateStr)).length;
    const rows = habits.map(h=>{
      const isDone = S().habitDone(h.id,dateStr);
      const streak = S().habitStreak(h.id);
      const hist = habitWeekDots(h, dateStr);
      const freq = h.frequency==='daily'?'Daily':h.frequency==='weekdays'?'Weekdays':'Weekly';
      return '<div class="stew-habit-row'+(isDone?' done':'')+'">'+
        '<span class="stew-habit-icon" aria-hidden="true">'+esc(h.icon)+'</span>'+
        '<span class="stew-habit-main"><span class="stew-habit-title">'+esc(h.title)+'</span>'+
        '<span class="stew-habit-meta">'+freq+(streak>1?' · '+streak+' day streak':'')+'</span></span>'+
        '<span class="stew-h-hist">'+hist+'</span>'+
        '<button type="button" class="stew-done-circle sm'+(isDone?' on':'')+'" data-act="toggle-habit" data-id="'+h.id+'" data-date="'+dateStr+'" '+
        'aria-pressed="'+isDone+'" aria-label="'+esc(h.title)+(isDone?' — done':'')+'">'+(isDone?'✓':'')+'</button></div>';
    }).join('');
    const tip = root.helpTip?.(1,'Start here. Tap the circle to mark a habit kept today — the dots show your last seven days. Habits from your Habit Library appear here every day.')||'';
    return '<div class="stew-card stew-habits-card"><div class="stew-card-head"><div class="stew-card-kicker">Today\u2019s Habits'+tip+'</div>'+
      '<span class="stew-card-meta">'+(total? done+' / '+total+' kept':'')+'</span></div>'+
      '<p class="stew-habit-explain">Habits you create in the Habit Library appear here and in your daily rhythm so you can track them each day.</p>'+
      (rows || '<p class="stew-empty">No habits yet. Add your first below — it will appear here every day so you can track it.</p>')+
      '<div class="stew-add-row"><input type="text" class="stew-add-input" id="dashNewHabit" placeholder="+ New habit — Enter to save" aria-label="New habit"></div>'+
      '<button type="button" class="stew-text-link" data-act="set-view" data-id="planning">Open Habit Library →</button></div>';
  }
  function renderOverflowCard(){
    const tasks = S().overflowTasks().slice(0,8);
    const rows = tasks.map(t=>{
      const g = t.goalId && S().getGoal(t.goalId);
      return '<div class="stew-of-row" draggable="true" data-drag-task="'+t.id+'">'+
        '<span class="stew-of-grip" aria-hidden="true">⋮⋮</span>'+
        '<span class="stew-of-main"><span class="stew-of-title">'+esc(t.title)+'</span>'+
        '<span class="stew-of-meta">'+URGENCY_LABEL[t.urgency]+(t.durationMin?' · '+fmtDur(t.durationMin):'')+(g?' · '+esc(g.title):'')+'</span></span>'+
        priChip(t.priority)+
        '<details class="stew-of-menu"><summary aria-label="Move task">→</summary><div class="stew-of-menu-list">'+
        [['later-today','Later today'],['tomorrow','Tomorrow'],['this-week','This week'],['someday','Someday'],['archive','Archive']]
          .map(m=>'<button type="button" data-act="move-task" data-id="'+t.id+'" data-dest="'+m[0]+'">'+m[1]+'</button>').join('')+
        '<button type="button" data-act="schedule-task" data-id="'+t.id+'">Schedule…</button>'+
        '</div></details></div>';
    }).join('');
    return '<div class="stew-card"><div class="stew-card-head"><div class="stew-card-kicker">Task Shelf'+
      (root.helpTip?.(5,'Tasks waiting for their moment. Drag one onto the timeline, or use the arrow to move it to another day.')||'')+'</div>'+
      '<span class="stew-card-meta">'+(tasks.length? tasks.length+' waiting':'')+'</span></div>'+
      (rows || '<p class="stew-empty">Nothing waiting. Every task has its place.</p>')+
      '<p class="stew-of-hint">Tasks here exist but have not been scheduled or selected for today.</p></div>';
  }
  function renderReflectionCard(dateStr, dm){
    const chips = REFLECTION_CHIPS.map(c=>
      '<button type="button" class="stew-refl-chip" data-act="refl-chip" data-date="'+dateStr+'" data-text="'+esc(c[1])+'">'+c[0]+'</button>').join('');
    return '<div class="stew-card stew-reflection"><div class="stew-card-kicker">Evening reflection'+
      (root.helpTip?.(6,'End the day honestly. A line or two is enough — grace for what remains.')||'')+'</div>'+
      '<p class="stew-refl-q serif">How did I faithfully steward today?</p>'+
      '<textarea class="stew-refl-input" data-daymeta="reflection" data-date="'+dateStr+'" rows="4" '+
      'placeholder="Honest lines. Grace for what remains.">'+esc(dm.reflection)+'</textarea>'+
      '<div class="stew-refl-chips">'+chips+'</div></div>';
  }
  function renderRhythmFlowCard(){
    const phases = [
      ['morning','Morning Setup','Non-negotiables and morning plan'],
      ['day','During the Day','Must-dos, growth, and faithful work'],
      ['evening','Evening Review','Reflect, carry forward, or release']
    ];
    const tip = root.helpTip?.(2,'Your day in three movements. Open the Daily Ledger to work through each phase in order.')||'';
    return '<div class="stew-card stew-rhythm-flow"><div class="stew-card-kicker">Daily Rhythm'+tip+'</div>'+
      '<div class="stew-rhythm-tabs" role="group" aria-label="Daily rhythm phases">'+
      phases.map(p=>'<button type="button" class="stew-rhythm-tab" data-act="open-daily-phase" data-id="'+p[0]+'">'+
        '<span class="stew-rhythm-tab-title">'+p[1]+'</span>'+
        '<span class="stew-rhythm-tab-sub">'+p[2]+'</span></button>').join('')+'</div>'+
      '<button type="button" class="stew-text-link" data-act="open-daily">Open Daily Ledger →</button></div>';
  }
  function renderDayView(){
    const dm = S().getDayMeta(anchor);
    return '<div class="stew-day">'+
      '<div class="stew-habits-hero">'+renderHabitsCard(anchor)+'</div>'+
      '<div class="stew-day-grid">'+
      '<div class="stew-day-main">'+
      renderRhythmFlowCard()+
      renderTimeline(anchor)+
      renderScriptureCard(anchor)+
      '</div>'+
      '<aside class="stew-rail">'+
      renderBigThreeCard(anchor,dm)+
      renderOverflowCard()+
      renderReflectionCard(anchor,dm)+
      renderMissionCard(anchor,dm)+
      '</aside></div></div>';
  }

  /* ── Week view ─────────────────────────────────────────────── */
  function weekDates(){
    const start = addDays(anchor, -new Date(anchor+'T12:00:00').getDay());
    return Array.from({length:7},(_,i)=>addDays(start,i));
  }
  function renderWeekView(){
    const dates = weekDates();
    const today = iso(dayOf(0));
    const totalH = (HOUR_END-HOUR_START+1)*HOUR_H;
    let head = '<div class="stew-week-head"><div class="stew-wgutter-spacer"></div>';
    dates.forEach(d=>{
      const dt = new Date(d+'T12:00:00');
      head += '<button type="button" class="stew-wcol-head'+(d===today?' today':'')+'" data-act="jump-day" data-date="'+d+'">'+
        '<span class="stew-wdow">'+dt.toLocaleDateString('en-US',{weekday:'short'})+'</span>'+
        '<span class="stew-wdom">'+dt.getDate()+'</span></button>';
    });
    head += '</div>';
    let allday = '<div class="stew-week-allday"><div class="stew-wgutter-label">All-day</div>';
    dates.forEach(d=>{
      const all = allEventsForDay(d).filter(e=>e.allDay);
      allday += '<div class="stew-wallday-col">'+all.map(e=>
        '<button type="button" class="stew-allday-pill" style="--cat:'+e.color+'" data-act="open-event" data-id="'+esc(e.id)+'" data-date="'+d+'">'+esc(e.title)+'</button>').join('')+'</div>';
    });
    allday += '</div>';
    let gutter = '';
    for(let h=HOUR_START; h<=HOUR_END; h++)
      gutter += '<div class="stew-whour-label" style="height:'+HOUR_H+'px">'+fmtTime(mins(h,0)).replace(':00','')+'</div>';
    const now = new Date();
    const nowMin = now.getHours()*60+now.getMinutes();
    let cols = '';
    dates.forEach(d=>{
      const timed = allEventsForDay(d).filter(e=>!e.allDay);
      cols += '<div class="stew-wday-col" data-date="'+d+'" style="height:'+totalH+'px">';
      for(let h=HOUR_START; h<=HOUR_END; h++)
        cols += '<div class="stew-wslot" data-act="hour-create" data-date="'+d+'" data-drop-hour="'+h+'" style="height:'+HOUR_H+'px"></div>';
      if(d===today && nowMin>=HOUR_START*60 && nowMin<=HOUR_END*60+59){
        cols += '<div class="stew-now-line" style="top:'+(((nowMin-HOUR_START*60)/60)*HOUR_H)+'px"></div>';
      }
      const laneEnds = [];
      timed.forEach(e=>{
        let lane = laneEnds.findIndex(end=>end <= e.startMin);
        if(lane === -1){ lane = laneEnds.length; laneEnds.push(e.endMin); }
        else laneEnds[lane] = e.endMin;
        const top = ((e.startMin-HOUR_START*60)/60)*HOUR_H;
        const hh = Math.max(24, ((e.endMin-e.startMin)/60)*HOUR_H);
        cols += '<button type="button" class="stew-wevent'+(e.done?' done':'')+'" '+
          'style="top:'+top+'px;height:'+hh+'px;--cat:'+e.color+';left:'+(3+lane*14)+'px;z-index:'+(1+lane)+'" '+
          (e.legacy?'':'draggable="true" ')+'data-act="open-event" data-id="'+esc(e.id)+'" data-date="'+d+'" title="'+esc(e.title)+'">'+
          '<span class="stew-wevent-title">'+esc(e.title)+'</span>'+
          '<span class="stew-wevent-time">'+fmtTime(e.startMin)+'</span></button>';
      });
      cols += '</div>';
    });
    return '<div class="stew-card stew-week-card"><div class="stew-week-scroll"><div class="stew-week">'+head+allday+
      '<div class="stew-week-body"><div class="stew-wgutter">'+gutter+'</div><div class="stew-wcols">'+cols+'</div></div>'+
      '</div></div></div>';
  }

  /* ── Month view ────────────────────────────────────────────── */
  function renderMonthView(){
    const base = new Date(anchor+'T12:00:00'); base.setDate(1);
    const y = base.getFullYear(), m = base.getMonth();
    const today = iso(dayOf(0));
    const startPad = base.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    let cells = '';
    for(let i=0;i<startPad;i++) cells += '<div class="stew-mcell empty"></div>';
    for(let d=1; d<=daysInMonth; d++){
      const ds = y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const evs = allEventsForDay(ds);
      const shown = evs.slice(0,3);
      cells += '<button type="button" class="stew-mcell'+(ds===today?' today':'')+'" data-act="jump-day" data-date="'+ds+'">'+
        '<span class="stew-mnum">'+d+'</span>'+
        shown.map(e=>'<span class="stew-mevent" style="--cat:'+e.color+'">'+esc(e.title)+'</span>').join('')+
        (evs.length>3?'<span class="stew-mmore">+'+(evs.length-3)+' more</span>':'')+
        '</button>';
    }
    const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<span>'+d+'</span>').join('');
    return '<div class="stew-card stew-month"><div class="stew-mhead">'+dows+'</div>'+
      '<div class="stew-mgrid">'+cells+'</div></div>';
  }

  /* ── Agenda view ───────────────────────────────────────────── */
  function renderAgendaView(){
    let out = '';
    for(let off=0; off<14; off++){
      const d = addDays(anchor, off);
      const evs = allEventsForDay(d);
      const habits = S().habitsForDate(d);
      const habitsDone = habits.filter(h=>S().habitDone(h.id,d)).length;
      if(!evs.length && off>2) continue;
      const rel = relDay(d);
      out += '<section class="stew-agenda-day"><header class="stew-agenda-head">'+
        '<button type="button" class="stew-agenda-date" data-act="jump-day" data-date="'+d+'">'+
        (rel?'<strong>'+rel+'</strong> · ':'')+fmtDateLong(d)+'</button>'+
        (habits.length?'<span class="stew-card-meta">'+habitsDone+' / '+habits.length+' habits</span>':'')+
        '</header>'+
        (evs.length ? evs.map(e=>
          '<div class="stew-agenda-row'+(e.done?' done':'')+'" style="--cat:'+e.color+'" data-act="open-event" data-id="'+esc(e.id)+'" data-date="'+d+'" role="button" tabindex="0">'+
          '<span class="stew-agenda-time">'+(e.allDay?'All day':fmtTime(e.startMin))+'</span>'+
          '<span class="stew-agenda-title">'+esc(e.title)+'</span>'+catPill(e.category)+doneCircle(e)+'</div>').join('')
        : '<p class="stew-empty">Open space — not wasted space.</p>')+
        '</section>';
    }
    return '<div class="stew-card stew-agenda">'+out+'</div>';
  }

  /* ── Planning view ─────────────────────────────────────────── */
  function taskRowPlanning(t){
    const subDone = t.subtasks.filter(s=>s.done).length;
    const dm = S().getDayMeta(iso(dayOf(0)));
    const isB3 = dm.bigThree.includes(t.id);
    return '<div class="stew-ptask'+(t.status==='done'?' done':'')+'" draggable="true" data-drag-task="'+t.id+'">'+
      '<label class="stew-ptask-check"><input type="checkbox" data-act="task-done" data-id="'+t.id+'"'+(t.status==='done'?' checked':'')+'>'+
      '<span>'+esc(t.title)+'</span></label>'+
      '<span class="stew-ptask-meta">'+priChip(t.priority)+chip('energy',ENERGY_LABEL[t.energy])+
      (t.durationMin?chip('dur',fmtDur(t.durationMin)):'')+
      (t.subtasks.length?chip('sub',subDone+'/'+t.subtasks.length):'')+'</span>'+
      '<span class="stew-ptask-actions">'+
      '<button type="button" class="stew-icon-act'+(isB3?' on':'')+'" data-act="b3-toggle" data-id="'+t.id+'" title="'+(isB3?'Remove from':'Add to')+' today’s Big Three" aria-label="Big Three toggle">✦</button>'+
      '<button type="button" class="stew-icon-act" data-act="task-edit" data-id="'+t.id+'" title="Details" aria-label="Task details">✎</button>'+
      (t.scheduledEventId?'':'<button type="button" class="stew-icon-act" data-act="schedule-task" data-id="'+t.id+'" title="Schedule" aria-label="Schedule">▦</button>')+
      '</span></div>'+
      (t.subtasks.length ? '<div class="stew-subtasks">'+t.subtasks.map(s=>
        '<label class="stew-subtask'+(s.done?' done':'')+'"><input type="checkbox" data-act="subtask-toggle" data-id="'+t.id+'" data-sub="'+s.id+'"'+(s.done?' checked':'')+'>'+esc(s.text)+'</label>').join('')+'</div>' : '');
  }
  function renderGoalCard(g){
    const prog = S().goalProgress(g.id);
    const projects = S().getProjects(g.id);
    const looseTasks = S().getTasks({goalId:g.id}).filter(t=>!t.projectId && t.status!=='archived');
    return '<div class="stew-card stew-goal" data-goal="'+g.id+'">'+
      '<div class="stew-card-head"><div><div class="stew-card-kicker">'+esc(g.lifeArea)+'</div>'+
      '<h3 class="stew-goal-title serif">'+esc(g.title)+'</h3></div>'+
      '<button type="button" class="stew-x" data-act="goal-delete" data-id="'+g.id+'" aria-label="Delete goal">×</button></div>'+
      (g.why?'<p class="stew-goal-why">'+esc(g.why)+'</p>':'')+
      (prog!=null?'<div class="stew-progress"><div class="stew-progress-fill" style="width:'+prog+'%"></div></div>'+
        '<div class="stew-card-meta">'+prog+'% stewarded</div>':'')+
      (g.milestones.length?'<div class="stew-milestones">'+g.milestones.map(m=>
        '<label class="stew-subtask'+(m.done?' done':'')+'"><input type="checkbox" data-act="milestone-toggle" data-goal="'+g.id+'" data-id="'+m.id+'"'+(m.done?' checked':'')+'>'+esc(m.title)+'</label>').join('')+'</div>':'')+
      projects.map(p=>{
        const tasks = S().getTasks({projectId:p.id}).filter(t=>t.status!=='archived');
        return '<div class="stew-project"><div class="stew-project-head">'+
          '<span class="stew-project-title">'+esc(p.title)+'</span>'+
          '<button type="button" class="stew-x" data-act="project-delete" data-id="'+p.id+'" aria-label="Delete project">×</button></div>'+
          tasks.map(taskRowPlanning).join('')+
          '<div class="stew-add-row"><input type="text" class="stew-add-input" data-add-task data-project="'+p.id+'" data-goal="'+g.id+'" placeholder="Add task — Enter to save">'+
          '</div></div>';
      }).join('')+
      (looseTasks.length?'<div class="stew-project"><div class="stew-project-head"><span class="stew-project-title">Unassigned</span></div>'+
        looseTasks.map(taskRowPlanning).join('')+'</div>':'')+
      '<div class="stew-add-row"><input type="text" class="stew-add-input" data-add-project data-goal="'+g.id+'" placeholder="Add project — Enter to save"></div>'+
      '</div>';
  }
  function renderPlanningView(){
    const goals = S().getGoals();
    const tpls = S().getTemplates();
    const habits = S().getHabits();
    const overflow = S().overflowTasks();
    const goalCol = goals.map(renderGoalCard).join('')+
      '<div class="stew-card stew-add-goal"><div class="stew-card-kicker">New goal</div>'+
      '<div class="stew-add-goal-row">'+
      '<input type="text" class="stew-add-input" id="stewNewGoalTitle" placeholder="Goal title — e.g. Build a healthy body">'+
      selectHtml('id="stewNewGoalArea" aria-label="Life area"', S().LIFE_AREAS.map(a=>[a,a]), 'Faith')+
      '<button type="button" class="btn-gold" data-act="goal-create">Add goal</button></div></div>';
    const ofRows = overflow.map(t=>{
      const g = t.goalId && S().getGoal(t.goalId);
      return '<div class="stew-of-row" draggable="true" data-drag-task="'+t.id+'">'+
        '<span class="stew-of-grip" aria-hidden="true">⋮⋮</span>'+
        '<span class="stew-of-main"><span class="stew-of-title">'+esc(t.title)+'</span>'+
        '<span class="stew-of-meta">'+URGENCY_LABEL[t.urgency]+(g?' · '+esc(g.title):'')+'</span></span>'+priChip(t.priority)+
        '<details class="stew-of-menu"><summary aria-label="Move task">→</summary><div class="stew-of-menu-list">'+
        [['later-today','Later today'],['tomorrow','Tomorrow'],['this-week','This week'],['someday','Someday'],['archive','Archive']]
          .map(m=>'<button type="button" data-act="move-task" data-id="'+t.id+'" data-dest="'+m[0]+'">'+m[1]+'</button>').join('')+
        '<button type="button" data-act="schedule-task" data-id="'+t.id+'">Schedule…</button></div></details></div>';
    }).join('');
    const tplRows = tpls.map(t=>
      '<div class="stew-tpl-row" style="--cat:'+catOf(t.category).color+'">'+
      '<span class="stew-tpl-main"><span class="stew-of-title">'+esc(t.title)+'</span>'+
      '<span class="stew-of-meta">'+catOf(t.category).label+' · '+fmtDur(t.endMin-t.startMin)+' · '+fmtTime(t.startMin)+'</span></span>'+
      '<button type="button" class="btn-ghost" data-act="tpl-use" data-id="'+t.id+'">Use today</button>'+
      '<button type="button" class="stew-x" data-act="tpl-delete" data-id="'+t.id+'" aria-label="Delete template">×</button></div>').join('');
    const habitRows = habits.map(h=>{
      const g = h.goalId && S().getGoal(h.goalId);
      return '<div class="stew-habit-manage">'+
        '<span class="stew-habit-icon">'+esc(h.icon)+'</span>'+
        '<input type="text" class="stew-add-input" data-habit-title="'+h.id+'" value="'+esc(h.title)+'" aria-label="Habit name">'+
        selectHtml('data-habit-freq="'+h.id+'" aria-label="Frequency"',
          [['daily','Daily'],['weekdays','Weekdays'],['weekly','Weekly']], h.frequency)+
        selectHtml('data-habit-time="'+h.id+'" aria-label="Target time"',
          [['morning','Morning'],['midday','Midday'],['evening','Evening'],['any','Any time']], h.targetTime)+
        (g?chip('goal',g.title):'')+
        '<span class="stew-card-meta">'+S().habitStreak(h.id)+'d</span>'+
        '<button type="button" class="stew-x" data-act="habit-delete" data-id="'+h.id+'" aria-label="Delete habit">×</button></div>';
    }).join('');
    return '<div class="stew-planning">'+
      '<div class="stew-plan-col">'+
      '<h3 class="stew-plan-title serif">Goals & projects</h3>'+goalCol+'</div>'+
      '<div class="stew-plan-col">'+
      '<div class="stew-card"><div class="stew-card-head"><div class="stew-card-kicker">Task Shelf</div>'+
      '<span class="stew-card-meta">'+overflow.length+' unscheduled</span></div>'+
      (ofRows||'<p class="stew-empty">Every task has a home.</p>')+
      '<div class="stew-add-row"><input type="text" class="stew-add-input" data-add-task data-project="" data-goal="" placeholder="Quick task — Enter to save"></div></div>'+
      '<div class="stew-card"><div class="stew-card-kicker">Templates</div>'+
      (tplRows||'<p class="stew-empty">Open any block and choose “Save as template.”</p>')+'</div>'+
      '<div class="stew-card stew-habit-library"><div class="stew-card-kicker">Habit Library</div>'+
      '<p class="stew-habit-explain">Habits you create here appear in your daily rhythm and on your dashboard, so you can track them each day.</p>'+
      (habitRows||'<p class="stew-empty">No habits yet — add your first below.</p>')+
      '<div class="stew-add-row"><input type="text" class="stew-add-input" id="stewNewHabit" placeholder="New habit — Enter to save"></div></div>'+
      '<div class="stew-card stew-review-links"><div class="stew-card-kicker">Rhythms of review</div>'+
      '<button type="button" class="stew-review-link" data-act="open-weekly"><strong>Weekly review</strong><span>Review · adjust · experiment</span></button>'+
      '<button type="button" class="stew-review-link" data-act="open-monthly"><strong>Monthly review</strong><span>Zoom out · celebrate · realign</span></button>'+
      '</div></div></div>';
  }

  /* ── Event drawer ──────────────────────────────────────────── */
  function openDrawer(config){
    drawer = config;
    renderDrawer();
    document.getElementById('stewDrawer').hidden = false;
    document.getElementById('stewDrawerBackdrop').hidden = false;
    setTimeout(()=>document.getElementById('stewDrTitle')?.focus(), 30);
  }
  function closeDrawer(){
    drawer = null;
    const p = document.getElementById('stewDrawer'), b = document.getElementById('stewDrawerBackdrop');
    if(p) p.hidden = true; if(b) b.hidden = true;
  }
  function drawerDraft(){ return drawer?.draft; }
  function renderDrawer(){
    const panel = document.getElementById('stewDrawer');
    if(!panel || !drawer) return;
    if(drawer.legacy){ panel.innerHTML = renderLegacyDrawer(); return; }
    const d = drawer.draft;
    const cat = catOf(d.category);
    const goals = S().getGoals();
    const projects = d.goalId ? S().getProjects(d.goalId) : S().getProjects();
    const linkedTasks = d.taskIds.map(id=>S().getTask(id)).filter(Boolean);
    const linkable = S().getTasks({status:'todo'}).filter(t=>!d.taskIds.includes(t.id) && !t.scheduledEventId).slice(0,20);
    const habits = S().getHabits();
    const tpls = S().getTemplates();
    const isNew = drawer.mode==='new';
    panel.innerHTML =
      '<div class="stew-dr-accent" style="--cat:'+cat.color+'"></div>'+
      '<div class="stew-dr-head">'+
      '<span class="stew-dr-mode">'+(isNew?'New time block':'Time block')+'</span>'+
      '<button type="button" class="stew-dr-close" data-act="dr-close" aria-label="Close">×</button></div>'+
      '<input type="text" class="stew-dr-title serif" id="stewDrTitle" data-dr="title" value="'+esc(d.title)+'" placeholder="What is this time for?">'+
      (isNew && tpls.length ? '<div class="stew-dr-tpls">'+tpls.map(t=>
        '<button type="button" class="stew-refl-chip" data-act="dr-tpl" data-id="'+t.id+'">'+esc(t.title)+'</button>').join('')+'</div>' : '')+
      '<div class="stew-dr-grid">'+
      '<label>Date<input type="date" data-dr="date" value="'+d.date+'"></label>'+
      '<label>Start<input type="time" data-dr="start" value="'+minsToInput(d.startMin)+'"></label>'+
      '<label>End<input type="time" data-dr="end" value="'+minsToInput(d.endMin)+'"></label>'+
      '<label>Category'+selectHtml('data-dr="category"', S().CATEGORIES.map(c=>[c.id,c.label]), d.category)+'</label>'+
      '<label>Priority'+selectHtml('data-dr="priority"', S().PRIORITIES.map(p=>[p,PRIORITY_LABEL[p]]), d.priority)+'</label>'+
      '<label>Energy'+selectHtml('data-dr="energy"', S().ENERGIES.map(p=>[p,ENERGY_LABEL[p]]), d.energy)+'</label>'+
      '<label>Goal'+selectHtml('data-dr="goalId"', [['','—']].concat(goals.map(g=>[g.id,g.title])), d.goalId||'')+'</label>'+
      '<label>Project'+selectHtml('data-dr="projectId"', [['','—']].concat(projects.map(p=>[p.id,p.title])), d.projectId||'')+'</label>'+
      '</div>'+
      '<div class="stew-dr-section"><h4>Tasks in this block</h4>'+
      (linkedTasks.map(t=>
        '<div class="stew-dr-task"><label><input type="checkbox" data-act="task-done" data-id="'+t.id+'"'+(t.status==='done'?' checked':'')+'>'+
        '<span'+(t.status==='done'?' class="done"':'')+'>'+esc(t.title)+'</span></label>'+
        '<button type="button" class="stew-x" data-act="dr-unlink-task" data-id="'+t.id+'" aria-label="Unlink">×</button>'+
        (t.subtasks.length?'<div class="stew-subtasks">'+t.subtasks.map(s=>
          '<label class="stew-subtask'+(s.done?' done':'')+'"><input type="checkbox" data-act="subtask-toggle" data-id="'+t.id+'" data-sub="'+s.id+'"'+(s.done?' checked':'')+'>'+esc(s.text)+'</label>').join('')+'</div>':'')+
        '</div>').join('') || '<p class="stew-empty">No tasks linked yet.</p>')+
      (linkable.length?selectHtml('data-act-change="dr-link-task" aria-label="Link an existing task"',
        [['','Link an existing task…']].concat(linkable.map(t=>[t.id,t.title])), ''):'')+
      '<input type="text" class="stew-add-input" data-dr-new-task placeholder="New task for this block — Enter to add">'+
      '</div>'+
      '<div class="stew-dr-section"><h4>Habits in this block</h4>'+
      (habits.length ? habits.map(h=>
        '<label class="stew-dr-habit"><input type="checkbox" data-act="dr-habit-link" data-id="'+h.id+'"'+(d.habitIds.includes(h.id)?' checked':'')+'>'+
        esc(h.icon)+' '+esc(h.title)+'</label>').join('') : '<p class="stew-empty">No habits yet.</p>')+
      '</div>'+
      '<div class="stew-dr-section"><h4>Notes</h4>'+
      '<textarea data-dr="notes" rows="3" placeholder="Context, links, anything that serves the block…">'+esc(d.notes)+'</textarea></div>'+
      '<div class="stew-dr-section"><h4>Reflection</h4>'+
      '<textarea data-dr="reflection" rows="2" placeholder="How did I show faithfulness here?">'+esc(d.reflection)+'</textarea></div>'+
      '<div class="stew-dr-actions">'+
      (isNew ? '' :
        '<button type="button" class="stew-dr-complete'+(d.done?' undone':'')+'" data-act="dr-complete">'+
        (d.done?'Mark not complete':'✓ Complete block')+'</button>'+
        '<button type="button" class="btn-ghost" data-act="dr-duplicate">Duplicate</button>'+
        '<button type="button" class="btn-ghost" data-act="dr-template">Save as template</button>'+
        '<button type="button" class="btn-ghost stew-dr-delete" data-act="dr-delete">Delete</button>')+
      '<span class="stew-dr-spacer"></span>'+
      '<button type="button" class="btn-gold" data-act="dr-save">'+(isNew?'Create block':'Save')+'</button>'+
      '</div>';
  }
  function renderLegacyDrawer(){
    const d = drawer.draft;
    return '<div class="stew-dr-accent" style="--cat:'+d.color+'"></div>'+
      '<div class="stew-dr-head"><span class="stew-dr-mode">'+esc(d.sub||'Linked item')+'</span>'+
      '<button type="button" class="stew-dr-close" data-act="dr-close" aria-label="Close">×</button></div>'+
      '<input type="text" class="stew-dr-title serif" id="stewDrTitle" data-dr="title" value="'+esc(d.title)+'">'+
      '<p class="stew-dr-note">This item lives in '+esc(d.sub)+' — edits here stay in sync with it.</p>'+
      '<div class="stew-dr-grid">'+
      '<label>Start<input type="time" data-dr="start" value="'+minsToInput(d.startMin)+'"'+(d.readonly?' disabled':'')+'></label>'+
      '<label>End<input type="time" data-dr="end" value="'+minsToInput(d.endMin)+'"'+(d.readonly?' disabled':'')+'></label>'+
      (d.slot!==undefined?'<label>Window'+selectHtml('data-dr="slot"',
        Object.keys(SLOT_LABELS).map(s=>[s,SLOT_LABELS[s]]), d.slot)+'</label>':'')+
      '</div>'+
      (d.readonly?'':'<label class="stew-dr-habit"><input type="checkbox" data-dr-check="done"'+(d.done?' checked':'')+'> Mark complete</label>')+
      '<div class="stew-dr-actions">'+
      (d.readonly?'<p class="stew-dr-note">Recurring blocks are edited in their source view.</p>':
        '<button type="button" class="btn-ghost stew-dr-delete" data-act="dr-legacy-delete">Delete</button>'+
        '<span class="stew-dr-spacer"></span>'+
        '<button type="button" class="btn-gold" data-act="dr-legacy-save">Save</button>')+
      '</div>';
  }
  function newDraft(dateStr, startMin){
    return {
      title:'', date:dateStr||anchor, startMin:startMin??mins(9,0), endMin:(startMin??mins(9,0))+60,
      category:'work', priority:'medium', energy:'medium', goalId:null, projectId:null,
      taskIds:[], habitIds:[], notes:'', reflection:'', done:false
    };
  }
  function openScheduleTask(taskId, dateStr){
    const t = S().getTask(taskId);
    if(!t) return;
    const start = mins(9,0);
    const dur = t.durationMin || 45;
    openDrawer({ mode:'new', draft:Object.assign(newDraft(dateStr || t.dueDate || anchor, start), {
      title:t.title,
      goalId:t.goalId,
      projectId:t.projectId,
      priority:t.priority,
      energy:t.energy,
      taskIds:[t.id],
      endMin:start + dur
    })});
    toast('Choose the date, start time, and duration, then create the block.');
  }
  function openEvent(id, dateStr){
    const ev = S().getEvent(id);
    if(ev){ openDrawer({ mode:'edit', eventId:id, draft:JSON.parse(JSON.stringify(ev)) }); return; }
    const legacy = legacyEventsForDay(dateStr).find(e=>e.id===id);
    if(legacy) openDrawer({ mode:'edit', legacy:true, draft:Object.assign({}, legacy) });
  }
  async function saveLegacy(){
    const d = drawer.draft;
    const fs = root.faithStore;
    if(d.id.startsWith('t-') && fs){
      fs.updateTask(d.id.slice(2), { title:d.title, timeSlot:d.slot, completed:!!d.done,
        startTime: d.slot==='timed' ? minsToInput(d.startMin) : '', durationMin: d.endMin-d.startMin });
      await fs.save();
    } else if(d.id.startsWith('md-')){
      const day = dayCache[d.date] || await root.getDayDataByDate(d.date);
      const md = day.faithfulFew?.mustDo?.items?.find(x=>'md-'+x.id===d.id);
      if(md){ md.text = d.title; md.done = !!d.done; await root.saveDayDataByDate(d.date, day); dayCache[d.date] = day; }
    } else if(d.id.startsWith('idea-')){
      const idea = root.globals?.ideas?.find(x=>'idea-'+x.id===d.id);
      if(idea?.flow){ idea.flow.stepsDone = idea.flow.stepsDone||[]; idea.flow.stepsDone[0] = !!d.done; root.markDirty?.(); }
    }
    root.markDirty?.();
  }
  async function deleteLegacy(){
    const d = drawer.draft;
    const fs = root.faithStore;
    if(d.id.startsWith('t-') && fs){
      const task = fs.getTask(d.id.slice(2));
      if(task) await fs.deleteTaskAndSave(task.id);
    } else if(d.id.startsWith('md-')){
      const day = dayCache[d.date] || await root.getDayDataByDate(d.date);
      if(day.faithfulFew?.mustDo?.items){
        day.faithfulFew.mustDo.items = day.faithfulFew.mustDo.items.filter(x=>'md-'+x.id!==d.id);
        await root.saveDayDataByDate(d.date, day); dayCache[d.date] = day;
        const t = fs?.findTaskByLegacyMustDo?.(d.id.slice(3), d.date);
        if(t) await fs.deleteTaskAndSave(t.id);
      }
    } else if(d.id.startsWith('idea-')){
      const idea = root.globals?.ideas?.find(x=>'idea-'+x.id===d.id);
      if(idea?.flow){ idea.flow.scheduleDate=''; root.markDirty?.(); }
    }
    root.markDirty?.();
  }

  /* ── quick add ─────────────────────────────────────────────── */
  function parseQuickAdd(str){
    let s = ' '+str+' ';
    const out = { title:'', category:null, priority:null, date:anchor, startMin:null, durationMin:null };
    s = s.replace(/\s#(\w+)\s/i, (m,c)=>{
      const cat = S().CATEGORIES.find(x=>x.id.startsWith(c.toLowerCase()) || x.label.toLowerCase().startsWith(c.toLowerCase()));
      if(cat) out.category = cat.id;
      return ' ';
    });
    s = s.replace(/\s!(high|med(?:ium)?|low)\s/i, (m,p)=>{ out.priority = p.toLowerCase().startsWith('med')?'medium':p.toLowerCase(); return ' '; });
    s = s.replace(/\s(today|tomorrow)\s/i, (m,w)=>{ out.date = w.toLowerCase()==='tomorrow'?addDays(iso(dayOf(0)),1):iso(dayOf(0)); return ' '; });
    s = s.replace(/\s(sun|mon|tue|wed|thu|fri|sat)(?:day|sday|nesday|rsday|urday)?\s/i, (m,w)=>{
      const target = ['sun','mon','tue','wed','thu','fri','sat'].indexOf(w.toLowerCase());
      let d = iso(dayOf(0));
      for(let i=1;i<=7;i++){ const c = addDays(iso(dayOf(0)),i); if(new Date(c+'T12:00:00').getDay()===target){ d=c; break; } }
      out.date = d; return ' ';
    });
    s = s.replace(/\s(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s/i, (m,h,mm,ap)=>{
      let hh = +h % 12; if(ap.toLowerCase()==='pm') hh += 12;
      out.startMin = mins(hh, +(mm||0)); return ' ';
    });
    s = s.replace(/\s(\d{1,3})\s*m(?:in)?\s/i, (m,n)=>{ out.durationMin = +n; return ' '; });
    s = s.replace(/\s(\d+(?:\.\d+)?)\s*h(?:r|our)?s?\s/i, (m,n)=>{ out.durationMin = Math.round(+n*60); return ' '; });
    out.title = s.replace(/\s+/g,' ').trim();
    return out;
  }
  function handleQuickAdd(str){
    const p = parseQuickAdd(str);
    if(!p.title) return;
    if(p.startMin != null){
      S().createEvent({ title:p.title, date:p.date, startMin:p.startMin,
        endMin:p.startMin+(p.durationMin||60), category:p.category||'personal', priority:p.priority||'medium' });
      toast('Faithfully planned — '+fmtDateShort(p.date)+' at '+fmtTime(p.startMin)+'.');
    } else {
      S().createTask({ title:p.title, priority:p.priority||'medium',
        urgency: p.date===iso(dayOf(0)) ? 'today' : 'week',
        durationMin:p.durationMin||null, dueDate:p.date!==iso(dayOf(0))?p.date:'' });
      toast('Task added to Task Shelf.');
    }
    renderCalendar();
  }

  /* ── home band (greeting + quick capture) ─────────────────── */
  const HOME_VIEWS = ['day','agenda','planning'];
  function timeGreeting(){
    const h = new Date().getHours();
    if(h < 12) return 'Good morning';
    if(h < 17) return 'Good afternoon';
    return 'Good evening';
  }
  function homeDisplayName(){
    const p = typeof root.normalizeProfile === 'function' ? root.normalizeProfile(root.userProfile) : (root.userProfile || {});
    return (p.name || '').trim();
  }
  function formatSummaryTime(t){
    const [h,m] = String(t||'').split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + String(m).padStart(2,'0') + ' ' + ampm;
  }
  function buildSummaryLine(summary){
    if(summary.practiceLine) return summary.practiceLine;
    if(summary.firstFruitsTotal > 0 && !summary.firstFruitsComplete)
      return "Start with what's first — your non-negotiables.";
    if(summary.firstFruitsComplete){
      const n = summary.prioritiesLeft || 0;
      return 'First things first — done. ' + n + ' priorit' + (n===1?'y':'ies') + ' remain.';
    }
    const parts = [];
    if(summary.prioritiesLeft != null)
      parts.push(summary.prioritiesLeft + ' priorit' + (summary.prioritiesLeft===1?'y':'ies') + ' left');
    if(summary.nextBlockLabel && summary.nextBlockTime)
      parts.push('next block · ' + summary.nextBlockLabel + ' at ' + formatSummaryTime(summary.nextBlockTime));
    if(summary.seedsGrowing != null)
      parts.push(summary.seedsGrowing + ' seed' + (summary.seedsGrowing===1?'':'s') + ' growing');
    return parts.join(' · ') || 'Open space is not wasted space.';
  }
  function renderHomeBand(){
    const el = document.getElementById('homeBand');
    if(!el) return;
    const dateStr = anchor || iso(dayOf(0));
    let summaryText = 'Open space is not wasted space.';
    if(root.faithStore){
      root.faithStore.ensureDailyAnchors(dateStr);
      summaryText = buildSummaryLine(root.faithStore.getDashboardSummary(dateStr, { now: new Date() }));
    }
    el.innerHTML =
      '<div class="home-greeting"><h2 class="serif">'+esc(homeDisplayName() ? timeGreeting()+', '+homeDisplayName() : timeGreeting())+'</h2>'+
      '<p id="homeSummary">'+esc(summaryText)+'</p>'+
      '<div id="dashFocus"></div></div>'+
      (typeof root.renderStoneCard === 'function' ? root.renderStoneCard() : '');
    root.renderProfileNudge?.();
    root.updateDashIntakeUI?.();
  }

  /* ── render root ───────────────────────────────────────────── */
  async function renderCalendar(){
    const body = document.getElementById('stewBody');
    const bar = document.getElementById('stewToolbar');
    if(!body || !S()) return;
    if(root.isDashboard?.()) renderHomeBand();
    await S().init();
    const dates = view==='week' ? weekDates()
      : view==='agenda' ? Array.from({length:14},(_,i)=>addDays(anchor,i))
      : view==='month' ? [] : [anchor];
    if(view==='month'){
      const base = new Date(anchor+'T12:00:00'); base.setDate(1);
      const days = new Date(base.getFullYear(), base.getMonth()+1, 0).getDate();
      for(let d=1; d<=days; d++) dates.push(iso(new Date(base.getFullYear(), base.getMonth(), d, 12)));
    }
    await Promise.all(dates.map(loadLegacyDay));
    bar.innerHTML = renderToolbar();
    body.innerHTML =
      view==='day' ? renderDayView() :
      view==='week' ? renderWeekView() :
      view==='month' ? renderMonthView() :
      view==='agenda' ? renderAgendaView() : renderPlanningView();
    const q = document.getElementById('stewSearch');
    if(q && searchQuery) q.value = searchQuery;
    clearTimeout(nowTimer);
    nowTimer = setTimeout(()=>{ if(root.isDashboard?.()) renderCalendar(); }, 60000);
  }

  /* ── event wiring ──────────────────────────────────────────── */
  function toggleAnyDone(id, dateStr){
    const ev = S().getEvent(id);
    if(ev){
      if(!ev.done && (ev.taskIds.length || ev.habitIds.length)){
        S().completeEvent(id, { completeTasks:true, checkHabits:true });
        toast('Time stewarded — linked tasks and habits kept too.');
      } else {
        S().updateEvent(id, { done:!ev.done });
        if(!ev.done) toast('Time stewarded.');
      }
      renderCalendar(); return;
    }
    const legacy = legacyEventsForDay(dateStr).find(e=>e.id===id);
    if(!legacy || legacy.readonly) return;
    drawer = { legacy:true, draft:Object.assign({}, legacy, { done:!legacy.done }) };
    saveLegacy().then(()=>{ drawer=null; renderCalendar(); });
  }
  function navStep(dir){
    if(view==='month'){
      const d = new Date(anchor+'T12:00:00'); d.setMonth(d.getMonth()+dir); anchor = iso(d);
    } else if(view==='week'){ anchor = addDays(anchor, dir*7); }
    else if(view==='agenda'){ anchor = addDays(anchor, dir*14); }
    else { anchor = addDays(anchor, dir); }
    renderCalendar();
  }
  function bindCalendarEvents(){
    if(document.body.dataset.stewBound) return;
    document.body.dataset.stewBound = '1';
    const panel = document.getElementById('calendarPanel');

    panel.addEventListener('click', async e=>{
      const el = e.target.closest('[data-act]');
      if(!el) return;
      const act = el.dataset.act, id = el.dataset.id, date = el.dataset.date;
      if(el.closest('.stew-of-menu') && act!=='move-task' && act!=='schedule-task') return;
      switch(act){
        case 'set-view': view = id; try{ localStorage.setItem('stew:view', view); }catch(x){} renderCalendar(); break;
        case 'open-daily': root.setMode?.('daily'); break;
        case 'open-daily-phase': root.setMode?.('daily'); if(id) root.setDailyPhase?.(id); break;
        case 'nav': navStep(+id); break;
        case 'go-today': anchor = iso(dayOf(0)); renderCalendar(); break;
        case 'jump-day': anchor = date; view = 'day'; try{ localStorage.setItem('stew:view','day'); }catch(x){} renderCalendar(); break;
        case 'filter-cat': {
          if(!activeCats) activeCats = new Set(S().CATEGORIES.map(c=>c.id));
          if(activeCats.has(id)) activeCats.delete(id); else activeCats.add(id);
          if(activeCats.size===S().CATEGORIES.length) activeCats = null;
          renderCalendar(); break;
        }
        case 'filter-clear': activeCats = null; renderCalendar(); break;
        case 'new-event': openDrawer({ mode:'new', draft:newDraft(view==='day'?anchor:iso(dayOf(0))) }); break;
        case 'hour-create': {
          if(e.target.closest('.stew-block')) break;
          openDrawer({ mode:'new', draft:newDraft(el.dataset.date, mins(+el.dataset.dropHour,0)) }); break;
        }
        case 'open-event': {
          if(e.target.closest('.stew-done-circle')) break;
          openEvent(id, date); break;
        }
        case 'toggle-done': e.stopPropagation(); toggleAnyDone(id, date); break;
        case 'toggle-habit': e.stopPropagation(); S().toggleHabit(id, date); renderCalendar(); break;
        case 'task-done': break; // handled on change
        case 'b3-remove': S().toggleBigThree(date, id); renderCalendar(); break;
        case 'b3-toggle': {
          const ok = S().toggleBigThree(iso(dayOf(0)), id);
          if(!ok) toast('Three is enough. Release one first.');
          renderCalendar(); break;
        }
        case 'move-task': S().moveTask(id, el.dataset.dest); toast('Moved in the Task Shelf.'); renderCalendar(); break;
        case 'schedule-task': {
          openScheduleTask(id, view==='day'?anchor:iso(dayOf(0)));
          break;
        }
        case 'task-edit': {
          const t = S().getTask(id);
          if(t?.scheduledEventId && S().getEvent(t.scheduledEventId)){ openEvent(t.scheduledEventId, anchor); }
          else openTaskEditor(id);
          break;
        }
        case 'refl-chip': {
          const ta = panel.querySelector('.stew-refl-input');
          if(ta){ ta.value = (ta.value?ta.value+'\n\n':'')+el.dataset.text; ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); }
          break;
        }
        case 'goal-create': {
          const title = document.getElementById('stewNewGoalTitle')?.value.trim();
          const area = document.getElementById('stewNewGoalArea')?.value || 'Faith';
          if(title){ S().createGoal({ title, lifeArea:area }); renderCalendar(); }
          break;
        }
        case 'goal-delete': if(confirm('Delete this goal? Its projects and tasks stay, unlinked.')){ S().deleteGoal(id); renderCalendar(); } break;
        case 'project-delete': if(confirm('Delete this project? Its tasks stay, unlinked.')){ S().deleteProject(id); renderCalendar(); } break;
        case 'habit-delete': if(confirm('Delete this habit and its history?')){ S().deleteHabit(id); renderCalendar(); } break;
        case 'tpl-use': {
          const ev = S().createEventFromTemplate(id, iso(dayOf(0)));
          if(ev){ toast('“'+ev.title+'” planned for today.'); renderCalendar(); }
          break;
        }
        case 'tpl-delete': S().deleteTemplate(id); renderCalendar(); break;
        case 'open-weekly': root.setMode?.('weekly'); break;
        case 'open-monthly': root.setMode?.('monthly'); break;
        /* drawer */
        case 'dr-close': closeDrawer(); break;
        case 'dr-save': {
          const d = drawerDraft();
          if(!d.title.trim()){ document.getElementById('stewDrTitle')?.focus(); break; }
          if(drawer.mode==='new'){ S().createEvent(d); toast('Faithfully planned.'); }
          else S().updateEvent(drawer.eventId, d);
          closeDrawer(); renderCalendar(); break;
        }
        case 'dr-complete': {
          const d = drawerDraft();
          if(d.done){ S().updateEvent(drawer.eventId, { done:false }); d.done = false; }
          else {
            S().completeEvent(drawer.eventId, { completeTasks:true, checkHabits:true, reflection:d.reflection });
            d.done = true;
            toast('Time stewarded.');
          }
          renderDrawer(); renderCalendar(); break;
        }
        case 'dr-duplicate': {
          const copy = S().duplicateEvent(drawer.eventId);
          if(copy){ toast('Duplicated.'); closeDrawer(); renderCalendar(); }
          break;
        }
        case 'dr-template': {
          S().saveTemplate(drawer.eventId);
          toast('Saved as template — find it in Planning.');
          break;
        }
        case 'dr-delete': S().deleteEvent(drawer.eventId); closeDrawer(); renderCalendar(); break;
        case 'dr-tpl': {
          const tpl = S().getTemplates().find(t=>t.id===id);
          if(tpl){
            const keepDate = drawer.draft.date, keepStart = drawer.draft.startMin;
            drawer.draft = Object.assign(JSON.parse(JSON.stringify(tpl)), {
              id:undefined, date:keepDate, startMin:keepStart, endMin:keepStart+(tpl.endMin-tpl.startMin), done:false, taskIds:[] });
            renderDrawer();
          }
          break;
        }
        case 'dr-unlink-task': {
          const d = drawerDraft();
          d.taskIds = d.taskIds.filter(x=>x!==id);
          if(drawer.mode!=='new') S().updateEvent(drawer.eventId, { taskIds:d.taskIds });
          renderDrawer(); break;
        }
        case 'dr-legacy-save': await saveLegacy(); closeDrawer(); renderCalendar(); break;
        case 'dr-legacy-delete': await deleteLegacy(); closeDrawer(); renderCalendar(); break;
      }
    });

    panel.addEventListener('change', e=>{
      const el = e.target;
      const actEl = el.closest('[data-act-change]');
      if(actEl){
        const act = actEl.dataset.actChange;
        if(act==='set-view-select' && el.value){ view = el.value; try{ localStorage.setItem('stew:view', view); }catch(x){} renderCalendar(); }
        if(act==='b3-add' && el.value){ S().toggleBigThree(actEl.dataset.date, el.value); renderCalendar(); }
        if(act==='dr-link-task' && el.value){
          const d = drawerDraft();
          d.taskIds.push(el.value);
          if(drawer.mode!=='new') S().updateEvent(drawer.eventId, { taskIds:d.taskIds });
          renderDrawer();
        }
        return;
      }
      if(el.dataset.act==='task-done'){
        S().updateTask(el.dataset.id, { status: el.checked?'done':'todo' });
        if(drawer && document.getElementById('stewDrawer') && !document.getElementById('stewDrawer').hidden) renderDrawer();
        renderCalendar(); return;
      }
      if(el.dataset.act==='subtask-toggle'){ S().toggleSubtask(el.dataset.id, el.dataset.sub); return; }
      if(el.dataset.act==='milestone-toggle'){
        const g = S().getGoal(el.dataset.goal);
        const m = g?.milestones.find(x=>x.id===el.dataset.id);
        if(m){ m.done = el.checked; S().save(); renderCalendar(); }
        return;
      }
      if(el.dataset.act==='dr-habit-link'){
        const d = drawerDraft();
        if(el.checked){ if(!d.habitIds.includes(el.dataset.id)) d.habitIds.push(el.dataset.id); }
        else d.habitIds = d.habitIds.filter(x=>x!==el.dataset.id);
        if(drawer.mode!=='new') S().updateEvent(drawer.eventId, { habitIds:d.habitIds });
        return;
      }
      if(el.dataset.habitFreq){ S().updateHabit(el.dataset.habitFreq, { frequency:el.value }); renderCalendar(); return; }
      if(el.dataset.habitTime){ S().updateHabit(el.dataset.habitTime, { targetTime:el.value }); return; }
      if(el.dataset.dr !== undefined && drawer){
        const d = drawerDraft(); const k = el.dataset.dr;
        if(k==='start') d.startMin = parseTime(el.value) ?? d.startMin;
        else if(k==='end') d.endMin = Math.max((parseTime(el.value) ?? d.endMin), d.startMin+15);
        else if(k==='goalId'){ d.goalId = el.value||null; d.projectId = null; renderDrawer(); }
        else if(k==='projectId') d.projectId = el.value||null;
        else if(k==='slot') d.slot = el.value;
        else d[k] = el.value;
        if(k==='category') renderDrawer();
        return;
      }
      if(el.dataset.drCheck==='done' && drawer){ drawer.draft.done = el.checked; }
    });

    panel.addEventListener('input', e=>{
      const el = e.target;
      if(el.dataset.daymeta){ S().setDayMeta(el.dataset.date, { [el.dataset.daymeta]: el.value }); return; }
      if(el.id==='stewSearch'){ searchQuery = el.value; debounceRender(); return; }
      if(el.dataset.habitTitle){ S().updateHabit(el.dataset.habitTitle, { title:el.value }); return; }
      if(el.dataset.dr !== undefined && drawer){ const d = drawerDraft(); if(el.dataset.dr==='title') d.title = el.value; else if(el.dataset.dr==='notes'||el.dataset.dr==='reflection') d[el.dataset.dr] = el.value; }
    });

    panel.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        const el = e.target;
        if(el.dataset.addTask !== undefined && el.value.trim()){
          S().createTask({ title:el.value.trim(), projectId:el.dataset.project||null, goalId:el.dataset.goal||null, urgency:'week' });
          el.value=''; renderCalendar(); e.preventDefault(); return;
        }
        if(el.dataset.addProject !== undefined && el.value.trim()){
          S().createProject({ title:el.value.trim(), goalId:el.dataset.goal });
          el.value=''; renderCalendar(); e.preventDefault(); return;
        }
        if((el.id==='stewNewHabit' || el.id==='dashNewHabit') && el.value.trim()){
          S().createHabit({ title:el.value.trim(), icon:'○' }); el.value=''; renderCalendar();
          toast('Habit added — it will appear here every day.');
          e.preventDefault(); return;
        }
        if(el.dataset.drNewTask !== undefined && el.value.trim() && drawer){
          const d = drawerDraft();
          const t = S().createTask({ title:el.value.trim(), goalId:d.goalId, projectId:d.projectId, urgency:'today' });
          d.taskIds.push(t.id);
          if(drawer.mode!=='new') S().updateEvent(drawer.eventId, { taskIds:d.taskIds });
          renderDrawer(); e.preventDefault(); return;
        }
        if(e.target.closest('[data-act="hour-create"],[data-act="open-event"]')){
          e.target.closest('[data-act]').click(); e.preventDefault();
        }
      }
      if(e.key==='Escape' && drawer) closeDrawer();
    });

    /* drag & drop: tasks → timeline/week; events → new time */
    panel.addEventListener('dragstart', e=>{
      const taskEl = e.target.closest?.('[data-drag-task]');
      if(taskEl){ e.dataTransfer.setData('text/plain', JSON.stringify({ kind:'task', id:taskEl.dataset.dragTask })); return; }
      const evEl = e.target.closest?.('[data-act="open-event"][draggable]');
      if(evEl){ e.dataTransfer.setData('text/plain', JSON.stringify({ kind:'event', id:evEl.dataset.id })); }
    });
    panel.addEventListener('dragover', e=>{
      const slot = e.target.closest?.('[data-drop-hour]');
      if(slot){ e.preventDefault(); slot.classList.add('drop-hover'); }
    });
    panel.addEventListener('dragleave', e=>{
      e.target.closest?.('[data-drop-hour]')?.classList.remove('drop-hover');
    });
    panel.addEventListener('drop', e=>{
      const slot = e.target.closest?.('[data-drop-hour]');
      if(!slot) return;
      e.preventDefault();
      slot.classList.remove('drop-hover');
      let payload = null;
      try{ payload = JSON.parse(e.dataTransfer.getData('text/plain')); }catch(x){ return; }
      const date = slot.dataset.date, startMin = mins(+slot.dataset.dropHour, 0);
      if(payload?.kind==='task'){
        const ev = S().scheduleTask(payload.id, date, startMin);
        if(ev) toast('Faithfully planned — '+fmtTime(startMin)+'.');
      } else if(payload?.kind==='event'){
        const ev = S().getEvent(payload.id);
        if(ev) S().updateEvent(payload.id, { date, startMin, endMin: startMin+(ev.endMin-ev.startMin) });
      }
      renderCalendar();
    });

    document.getElementById('stewDrawerBackdrop')?.addEventListener('click', closeDrawer);

  }
  let renderDebounce = null;
  function debounceRender(){ clearTimeout(renderDebounce); renderDebounce = setTimeout(renderCalendar, 200); }
  function nextFreeHour(dateStr){
    const evs = S().eventsForDate(dateStr);
    const now = new Date();
    let h = dateStr===iso(dayOf(0)) ? Math.max(HOUR_START, now.getHours()+1) : 9;
    while(h < HOUR_END && evs.some(e=>e.startMin < (h+1)*60 && e.endMin > h*60)) h++;
    return mins(Math.min(h, HOUR_END-1), 0);
  }
  /** Small inline editor for a task's details (priority / energy / duration / subtasks). */
  function openTaskEditor(taskId){
    const t = S().getTask(taskId); if(!t) return;
    openDrawer({ mode:'new', draft:Object.assign(newDraft(anchor, nextFreeHour(anchor)), {
      title:t.title, goalId:t.goalId, projectId:t.projectId, taskIds:[t.id],
      priority:t.priority, energy:t.energy,
      endMin: nextFreeHour(anchor)+(t.durationMin||60)
    })});
  }

  async function loadCalendar(){
    const body = document.getElementById('stewBody');
    if(!S()){
      if(body) body.innerHTML = '<p class="stew-boot">Dashboard could not load — stewardship-store.js may be missing. Hard-refresh the page.</p>';
      return;
    }
    try{
      await S().init();
      if(!anchor) anchor = iso(dayOf(0));
      try{
        const saved = localStorage.getItem('stew:view');
        if(saved && HOME_VIEWS.includes(saved)) view = saved;
        else view = 'day';
      }catch(x){ view = 'day'; }
      bindCalendarEvents();
      await renderCalendar();
    }catch(e){
      console.error('[calendar] load failed', e);
      if(body) body.innerHTML = '<p class="stew-boot">Could not load the dashboard. Try a hard refresh — your saved data is still on this device.</p>';
    }
  }

  root.renderCalendar = renderCalendar;
  root.loadCalendar = loadCalendar;

})(typeof window !== 'undefined' ? window : globalThis);
