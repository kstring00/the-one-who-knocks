/**
 * Daily Ledger UI — guided daily stewardship system
 * Preserves dayData / faithStore persistence; compact layout & behavior-change flow.
 */
(function(root){
  'use strict';

  let sessionExpandId = null;
  let openGrowthCat = null;
  let openDailyStep = 'aim';

  const DURATIONS = [5, 10, 15, 30];
  const SCRIPTURE = {
    text: 'Whatever you do, do it from the heart, as something done for the Lord and not for people.',
    ref: 'Colossians 3:23'
  };
  const GROWTH_REP_CATS = [
    { id:'body', label:'Body', legacy:'body' },
    { id:'order', label:'Order', legacy:'order' },
    { id:'leadership', label:'Leadership', legacy:'leadership' },
    { id:'skill', label:'Skill / Talent', legacy:'skill' },
    { id:'relationship', label:'Relationship', legacy:'leadership' },
    { id:'faith', label:'Faith', legacy:'leadership' },
    { id:'recovery', label:'Recovery', legacy:'body' }
  ];
  const DAILY_STEPS = [
    { id:'aim', label:'Aim', sec:'sec-daily-aim', phases:['morning'] },
    { id:'habits', label:'Habits', sec:'sec-first-fruits', phases:['morning','evening'] },
    { id:'mustdos', label:'Must-Dos', sec:'sec-non-neg', phases:['morning','evening'] },
    { id:'growth', label:'Growth', sec:'sec-growth', phases:['morning'] },
    { id:'plan', label:'Plan', sec:'sec-friction', phases:['morning'] },
    { id:'reflect', label:'Reflect', sec:'ev-kept', phases:['evening'] }
  ];

  function dateStr(){
    return iso(dayOf(typeof dayOffset === 'number' ? dayOffset : 0));
  }

  function ensureGrowthRep(){
    if(!dayData) return;
    if(!dayData.growthRep || typeof dayData.growthRep !== 'object'){
      dayData.growthRep = { category:'', text:'', done:false };
    }
    if(!dayData.posture) dayData.posture = {};
    if(dayData.posture.aim == null) dayData.posture.aim = '';
  }

  function legacyCatForRep(catId){
    return GROWTH_REP_CATS.find(c=> c.id === catId)?.legacy || catId;
  }

  function syncGrowthRepToLegacy(){
    ensureGrowthRep();
    const rep = dayData.growthRep;
    if(!rep.text?.trim() || !rep.category) return;
    const key = legacyCatForRep(rep.category);
    if(!dayData.faithfulFew[key]) dayData.faithfulFew[key] = { items: [] };
    let item = dayData.faithfulFew[key].items.find(i=> i.growthRep);
    if(!item){
      item = { id: uid(), text: rep.text.trim(), done: !!rep.done, growthRep: true };
      dayData.faithfulFew[key].items.push(item);
    } else {
      item.text = rep.text.trim();
      item.done = !!rep.done;
    }
  }

  function getAnchors(){
    if(!window.faithStore) return [];
    return window.faithStore.getDailyAnchorConfig().filter(a=> a.enabled);
  }

  function stew(){
    return window.StewStore || null;
  }

  /** Unified habit list: faithStore anchors + dashboard habits not already linked */
  function getHabitRows(){
    const rows = [];
    const anchors = getAnchors();
    const linkedStew = new Set();
    anchors.forEach(a=>{
      if(a.stewHabitId) linkedStew.add(a.stewHabitId);
      rows.push({ type:'anchor', anchor:a, id:a.id, title:a.title, stewHabitId:a.stewHabitId || null });
    });
    const S = stew();
    if(S?.habitsForDate){
      S.habitsForDate(dateStr()).forEach(h=>{
        if(linkedStew.has(h.id)) return;
        if(anchors.some(a=> a.title.trim().toLowerCase() === h.title.trim().toLowerCase())) return;
        rows.push({ type:'stew', stewId:h.id, id:'stew-'+h.id, title:h.title, stewHabitId:h.id });
      });
    }
    return rows;
  }

  function habitRowDone(row){
    if(row.type === 'stew'){
      return !!stew()?.habitDone?.(row.stewId, dateStr());
    }
    if(row.stewHabitId && stew()?.habitDone?.(row.stewHabitId, dateStr())) return true;
    return anchorDone(row.id);
  }

  function habitRowStatus(row){
    if(habitRowDone(row)) return 'Complete';
    if(row.type === 'anchor'){
      const sum = practiceSummary(row.id);
      if(sum.count) return 'In progress';
    }
    return 'Not started';
  }

  function stewHabitCue(h){
    if(!h) return '';
    const freq = h.frequency === 'daily' ? 'Daily' : h.frequency === 'weekdays' ? 'Weekdays' : 'Weekly';
    const time = h.targetTime && h.targetTime !== 'any' ? h.targetTime : '';
    return [freq, time].filter(Boolean).join(' · ');
  }

  function getCategories(){
    if(!window.faithStore) return [];
    return window.faithStore.getDailyCategoryConfig().filter(c=> c.enabled);
  }

  function getNonNegItems(){
    return (dayData?.faithfulFew?.mustDo?.items || []).filter(it=> !it.anchorId);
  }

  function getTopMustDos(){ return getNonNegItems().slice(0, 3); }
  function getMoreMustDos(){ return getNonNegItems().slice(3); }

  function practiceSummary(anchorId){
    if(!window.faithStore) return { count: 0, minutes: 0 };
    const s = window.faithStore.getPracticeSummaryForDate(dateStr());
    return s.byAnchor[anchorId] || { count: 0, minutes: 0 };
  }

  function anchorDone(anchorId){
    const sum = practiceSummary(anchorId);
    if(sum.count > 0) return true;
    const task = window.faithStore?.getAnchorTasksForDate(dateStr()).find(t=> t.anchorId === anchorId);
    return !!task?.completed;
  }

  function anchorCue(anchor){
    const parts = [];
    if(anchor.durationMin) parts.push(anchor.durationMin + ' min');
    const task = window.faithStore?.getAnchorTasksForDate(dateStr()).find(t=> t.anchorId === anchor.id);
    if(task?.startTime) parts.push(task.startTime);
    return parts.join(' · ');
  }

  function filled(v){ return !!(v && String(v).trim()); }

  function sectionStatus(kind){
    ensureGrowthRep();
    if(kind === 'aim'){
      return filled(dayData?.posture?.aim) ? 'done' : 'empty';
    }
    if(kind === 'habits'){
      const rows = getHabitRows();
      if(!rows.length) return 'empty';
      const done = rows.filter(habitRowDone).length;
      if(done === rows.length) return 'done';
      if(done > 0) return 'partial';
      return 'empty';
    }
    if(kind === 'mustdos'){
      const items = getNonNegItems();
      if(!items.length) return 'empty';
      const done = items.filter(it=> it.done && !it.released).length;
      if(done === items.length) return 'done';
      return done > 0 ? 'partial' : 'partial';
    }
    if(kind === 'growth'){
      const rep = dayData?.growthRep;
      if(rep?.text?.trim() && rep?.category){
        return rep.done ? 'done' : 'partial';
      }
      const cats = getCategories();
      let total = 0, done = 0;
      cats.forEach(c=>{
        const items = (dayData?.faithfulFew?.[c.id]?.items || []).filter(x=> !x.growthRep);
        total += items.length;
        done += items.filter(x=> x.done).length;
      });
      if(!total) return 'empty';
      if(done === total) return 'done';
      return 'partial';
    }
    if(kind === 'plan'){
      const d = dayData?.danger || {};
      const e = dayData?.execute || {};
      const friction = filled(d.danger) && filled(d.thenWill);
      const wins = [e.beforeWork, e.duringWork, e.afterWork, e.eveningShutdown].filter(filled).length;
      if(friction && wins === 4) return 'done';
      if(friction || wins) return 'partial';
      return 'empty';
    }
    if(kind === 'reflect'){
      if(dayData?.phaseComplete?.evening) return 'done';
      const kept = filled(dayData?.track?.handledWell);
      const learned = filled(dayData?.learn?.reveal);
      const grace = filled(dayData?.track?.neglected);
      const pending = getNonNegItems().filter(it=> !it.done && !it.released && !it.eveningAction);
      const acted = getNonNegItems().filter(it=> it.eveningAction || it.released);
      if(kept && learned && grace && !pending.length) return 'done';
      if(kept || learned || grace || acted.length || pending.length) return 'partial';
      return 'empty';
    }
    return 'empty';
  }

  function statusBadge(st){
    if(st === 'done') return '<span class="gr-status done">Complete</span>';
    if(st === 'partial') return '<span class="gr-status partial">In progress</span>';
    return '<span class="gr-status empty">Not started</span>';
  }

  function currentPhase(){
    return typeof dailyPhase === 'string' ? dailyPhase : 'morning';
  }

  function isPlanningTomorrow(){
    return typeof dayOffset === 'number' && dayOffset === 1;
  }

  function tomorrowPromptKey(){
    return 'wsr:tomorrow-prompt-dismissed:' + iso(dayOf(0));
  }

  function isTomorrowPromptDismissed(){
    try{ return localStorage.getItem(tomorrowPromptKey()) === '1'; }catch(e){ return false; }
  }

  function dismissTomorrowPrompt(){
    try{ localStorage.setItem(tomorrowPromptKey(), '1'); }catch(e){}
    refreshTomorrowPrompt();
  }

  function shouldShowTomorrowPrompt(){
    if(typeof dayOffset !== 'number' || dayOffset !== 0) return false;
    if(!dayData?.phaseComplete?.evening) return false;
    if(isTomorrowPromptDismissed()) return false;
    return true;
  }

  function refreshTomorrowPrompt(){
    const host = document.getElementById('dailyTomorrowPromptHost');
    if(!host) return;
    if(!isDaily?.() || document.getElementById('dailyBoard')?.hidden || !shouldShowTomorrowPrompt()){
      host.innerHTML = '';
      return;
    }
    host.innerHTML = '<div class="dl-tomorrow-prompt" role="dialog" aria-labelledby="dlTomorrowPromptTitle">'+
      '<p class="dl-tomorrow-prompt-title" id="dlTomorrowPromptTitle">Want to set tomorrow up for success?</p>'+
      '<div class="dl-tomorrow-prompt-actions">'+
      '<button type="button" class="gr-btn-primary" data-dl-plan-tomorrow-yes>Yes, plan tomorrow</button>'+
      '<button type="button" class="dl-tomorrow-prompt-no" data-dl-plan-tomorrow-no>Not tonight</button></div></div>';
  }

  async function carryUnfinishedToTomorrow(fromDay){
    const src = fromDay || dayData;
    if(!src?.faithfulFew?.mustDo?.items) return;
    const unfinished = src.faithfulFew.mustDo.items.filter(it=> !it.done && !it.released);

    const tomorrowOff = 1;
    const tomorrowDate = iso(dayOf(tomorrowOff));
    let tom = typeof normalizeDaily === 'function'
      ? normalizeDaily(await getJSON?.(dayKeyFor(tomorrowOff)))
      : null;
    if(!tom) return;
    if(!tom.faithfulFew.mustDo.items) tom.faithfulFew.mustDo.items = [];

    const todayDate = iso(dayOf(0));
    unfinished.forEach(it=>{
      const text = (it.text || '').trim();
      if(!text) return;
      const dup = tom.faithfulFew.mustDo.items.some(x=>
        (x.text || '').trim().toLowerCase() === text.toLowerCase()
      );
      if(dup) return;
      tom.faithfulFew.mustDo.items.push({
        id: typeof uid === 'function' ? uid() : ('id-' + Date.now() + Math.random()),
        text,
        done: false,
        carryCount: (it.carryCount || 0) + 1,
        carriedFrom: todayDate,
        carriedOver: true
      });
    });

    if(typeof saveDayDataByDate === 'function') await saveDayDataByDate(tomorrowDate, tom);
    if(root.faithStore){
      root.faithStore.syncMustDosFromDay(tomorrowDate, tom);
      await root.faithStore.save();
    }
    const S = stew();
    if(S?.getTasks){
      S.getTasks({status:'todo'}).forEach(t=>{
        const due = t.dueDate || t.originalDate || null;
        if(due !== todayDate) return;
        if(t.carriedFrom === todayDate && t.dueDate === tomorrowDate) return;
        S.updateTask(t.id, {
          dueDate: tomorrowDate,
          originalDate: t.originalDate || todayDate,
          carriedFrom: todayDate,
          carryCount: (t.carryCount || 0) + 1
        });
      });
    }
  }

  async function openTomorrowPlanning(opts){
    opts = opts || {};
    const todayData = opts.fromDay || dayData;
    if(typeof save === 'function') await save();
    if(opts.carry !== false) await carryUnfinishedToTomorrow(todayData);
    dismissTomorrowPrompt();
    dayOffset = 1;
    if(typeof loadDaily === 'function') await loadDaily();
    if(typeof setDailyPhase === 'function') setDailyPhase('morning');
    if(typeof updateViewUI === 'function') updateViewUI();
    else root.refreshDayScopeUI?.();
  }

  const HOW_BY_PHASE = {
    morning: ['Name your aim','Choose top 3','Keep non-negotiables','Pick one growth rep','Prepare for friction','Map the day'],
    day: ['Check your aim','Review habits and must-dos','Notice what changed','Call an audible if needed','Choose the next faithful step'],
    evening: ['Notice what was kept','Learn from the day','Release what needs grace','Carry one adjustment forward','Close in peace']
  };

  function renderHowThisWorks(phase){
    const steps = HOW_BY_PHASE[phase] || HOW_BY_PHASE.morning;
    return '<div class="gr-how dl-rail-how"><h4 class="serif">How This Works</h4><ol>'+
      steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></div>';
  }

  function mustDoDisplay(it){
    if(it?.reducedText?.trim()) return it.reducedText.trim();
    return it?.text || '';
  }

  function phaseLabel(){
    const p = currentPhase();
    if(p === 'day') return 'During the Day';
    if(p === 'evening') return 'Evening Review';
    return 'Morning Setup';
  }

  function renderMorningStatRow(){
    const aim = dayData?.posture?.aim?.trim() || '\u2014';
    const rows = getHabitRows();
    const kept = rows.filter(habitRowDone).length;
    const top = getTopMustDos();
    const done = top.filter(it=> it.done && !it.released).length;
    return '<div class="dl-stat-row">'+
      '<button type="button" class="dl-stat-card" data-dl-step="aim"><span class="dl-stat-k">Today\u2019s Aim</span><span class="dl-stat-v">'+esc(aim.length>28?aim.slice(0,28)+'\u2026':aim)+'</span></button>'+
      '<button type="button" class="dl-stat-card" data-dl-step="habits"><span class="dl-stat-k">Habits</span><span class="dl-stat-v">'+kept+' / '+rows.length+'</span></button>'+
      '<button type="button" class="dl-stat-card" data-dl-step="mustdos"><span class="dl-stat-k">Top 3</span><span class="dl-stat-v">'+done+' / '+top.length+'</span></button>'+
      '<div class="dl-stat-card dl-stat-static"><span class="dl-stat-k">Phase</span><span class="dl-stat-v">'+esc(phaseLabel())+'</span></div>'+
      '</div>';
  }

  function renderGrowthCompact(){
    ensureGrowthRep();
    const sel = dayData.growthRep.category || '';
    const cats = GROWTH_REP_CATS.map(c=>
      '<button type="button" class="dl-growth-cat'+(sel===c.id?' on':'')+'" data-dl-rep-cat="'+c.id+'">'+esc(c.label)+'</button>'
    ).join('');
    return '<section class="gr-card dl-cc-card" id="sec-growth" data-dl-sec="growth">'+
      '<div class="dl-cc-head-row"><h3 class="dl-cc-title serif">1% Growth Rep</h3>'+mentorBtn('Help me pick a growth rep', 'Help me pick a growth rep', 'daily-growth')+'</div>'+
      '<p class="dl-cc-q">What is today\u2019s rep?</p>'+
      '<div class="dl-growth-cats">'+cats+'</div>'+
      '<input type="text" class="dl-hairline" data-field="growthRep.text" placeholder="e.g. 30-min workout" aria-label="Growth rep">'+
      '</section>';
  }

  function renderFrictionCompact(){
    return '<section class="gr-card dl-cc-card" id="sec-friction" data-dl-sec="plan">'+
      '<h3 class="dl-cc-title serif">Prepare for Friction</h3>'+
      '<label class="dl-label">What could pull me off course?</label>'+
      '<input type="text" class="dl-hairline" data-field="danger.danger" placeholder="If I feel bored after work\u2026">'+
      '<label class="dl-label">If that happens, then I will\u2026</label>'+
      '<input type="text" class="dl-hairline" data-field="danger.thenWill" placeholder="Go to the gym first"></section>';
  }

  function renderPlanCompact(){
    return '<section class="gr-card dl-cc-card" id="sec-plan" data-dl-sec="plan-windows">'+
      '<h3 class="dl-cc-title serif">Time Windows</h3>'+
      '<div class="dl-window-row"><span class="dl-window-label">Morning</span><input type="text" class="dl-hairline" data-field="execute.beforeWork" placeholder="Quiet start\u2026"></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">Work</span><input type="text" class="dl-hairline" data-field="execute.duringWork" placeholder="Focus\u2026"></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">After</span><input type="text" class="dl-hairline" data-field="execute.afterWork" placeholder="Transition\u2026"></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">Evening</span><input type="text" class="dl-hairline" data-field="execute.eveningShutdown" placeholder="Shutdown\u2026"></div></section>';
  }

  function mentorBtn(label, prompt, source){
    return '<button type="button" class="dl-mentor-chip" data-mentor-open data-mentor-prompt="'+esc(prompt)+'" data-mentor-source="'+esc(source)+'">'+esc(label)+'</button>';
  }

  function renderMorningDashboard(){
    return '<div class="dl-phase-view" id="dl-phase-morning">'+
      '<div class="dl-mentor-row">'+mentorBtn('Help me plan today', 'Help me plan today', 'daily-plan')+'</div>'+
      renderMorningStatRow()+
      '<div class="dl-grid-2">'+renderTodayAimCompact()+renderTop3Compact()+'</div>'+
      renderFirstFruitsCompact()+
      '<div class="dl-grid-3">'+renderGrowthCompact()+renderFrictionCompact()+renderPlanCompact()+'</div>'+
      '</div>';
  }

  function renderPhaseMain(){
    const p = currentPhase();
    if(p === 'morning') return renderMorningDashboard();
    if(p === 'day') return root.renderDuringDayDashboard?.() || '';
    if(p === 'evening') return root.renderEveningDashboard?.() || '';
    return renderMorningDashboard();
  }

  function renderPhaseContent(){
    const main = document.getElementById('dailyMain');
    const sidebar = document.getElementById('dailySidebar');
    if(!main) return;
    main.innerHTML = renderPhaseMain();
    populateFields?.(main, dayData);
    if(sidebar) sidebar.innerHTML = renderDailySidebar();
    if(typeof loadThoughtJournal === 'function') loadThoughtJournal();
    refreshTomorrowPrompt();
    refreshProgressChrome();
    updateDailyScore();
  }

  function renderProgressPills(){
    const phase = typeof dailyPhase === 'string' ? dailyPhase : 'morning';
    return '<div class="gr-progress" role="navigation" aria-label="Daily progress">'+
      DAILY_STEPS.map((s,i)=>{
        const visible = s.phases.includes(phase);
        const st = sectionStatus(s.id);
        const on = openDailyStep === s.id ? ' on' : '';
        const hide = visible ? '' : ' style="opacity:.45"';
        return '<button type="button" class="gr-pill'+on+(st==='done'?' done':'')+'" data-dl-step="'+s.id+'"'+hide+'>'+
          '<span class="gr-pill-num">'+(i+1)+'</span>'+esc(s.label)+
          (st==='done'?'<span class="gr-pill-check" aria-hidden="true">✓</span>':'')+
          '</button>';
      }).join('')+'</div>';
  }

  function renderSessionExpand(anchor, kind){
    const mins = DURATIONS.map(m=>
      '<button type="button" class="dl-dur-pick" data-dl-mins="'+m+'" data-dl-anchor="'+anchor.id+'">'+m+'m</button>'
    ).join('');
    if(kind === 'prayer'){
      return '<div class="dl-session-panel" data-dl-panel="'+anchor.id+'">'+
        '<div class="dl-session-row"><span class="dl-label">Duration</span><div class="dl-dur-picks">'+mins+
        '<input type="number" class="dl-custom-min" min="1" max="180" placeholder="Custom" data-dl-custom-min="'+anchor.id+'"></div></div>'+
        '<div class="dl-prayer-rows" data-dl-prayer-rows="'+anchor.id+'">'+
        renderPrayerEntryRow(anchor.id, 0)+renderPrayerEntryRow(anchor.id, 1)+renderPrayerEntryRow(anchor.id, 2)+
        '</div>'+
        '<button type="button" class="dl-btn dl-btn-primary" data-dl-save-session="'+anchor.id+'">Save session</button></div>';
    }
    if(kind === 'bible'){
      return '<div class="dl-session-panel" data-dl-panel="'+anchor.id+'">'+
        '<div class="dl-session-row"><span class="dl-label">Duration</span><div class="dl-dur-picks">'+mins+
        '<input type="number" class="dl-custom-min" min="1" max="180" placeholder="Custom" data-dl-custom-min="'+anchor.id+'"></div></div>'+
        '<label class="dl-label">What did you read?</label>'+
        '<input type="text" class="dl-hairline" data-dl-bible-passage="'+anchor.id+'" placeholder="e.g. Matthew 25">'+
        '<label class="dl-label">What stood out?</label>'+
        '<input type="text" class="dl-hairline" data-dl-bible-takeaway="'+anchor.id+'" placeholder="One line…">'+
        '<button type="button" class="dl-btn dl-btn-primary" data-dl-save-session="'+anchor.id+'">Save session</button>'+
        '</div>';
    }
    return '<div class="dl-session-panel" data-dl-panel="'+anchor.id+'">'+
      '<div class="dl-session-row"><span class="dl-label">Duration</span><div class="dl-dur-picks">'+mins+
      '<input type="number" class="dl-custom-min" min="1" max="180" placeholder="Custom" data-dl-custom-min="'+anchor.id+'"></div></div>'+
      '<button type="button" class="dl-btn dl-btn-primary" data-dl-save-session="'+anchor.id+'">Save session</button></div>';
  }

  function renderPrayerEntryRow(anchorId, idx){
    return '<div class="dl-prayer-entry" data-dl-prayer-idx="'+idx+'">'+
      '<input type="text" class="dl-hairline" data-dl-prayer-req="'+anchorId+'" data-dl-prayer-idx="'+idx+'" placeholder="What did I pray about?">'+
      '<input type="text" class="dl-hairline dl-secondary" data-dl-prayer-fruit="'+anchorId+'" data-dl-prayer-idx="'+idx+'" placeholder="How will this bear fruit? (optional)">'+
      '</div>';
  }

  function renderTodayAimCompact(){
    const tomorrow = isPlanningTomorrow();
    return '<section class="gr-card dl-cc-card" id="sec-daily-aim" data-dl-sec="aim">'+
      '<div class="dl-cc-head-row"><h3 class="dl-cc-title serif">'+(tomorrow ? 'Tomorrow\u2019s Aim' : 'Today\u2019s Aim')+'</h3></div>'+
      '<p class="dl-cc-q">'+(tomorrow ? 'Tomorrow, I want to be faithful in\u2026' : 'Today, I want to be faithful in\u2026')+'</p>'+
      '<input type="text" class="dl-hairline" data-field="posture.aim" placeholder="patience, focus, courage, order, serving well\u2026" aria-label="'+(tomorrow ? 'Tomorrow\u2019s aim' : 'Today\u2019s aim')+'">'+
      '<p class="dl-cc-hint">Name the direction before you name the tasks.</p></section>';
  }

  function renderTop3Compact(){
    const tomorrow = isPlanningTomorrow();
    const top = getTopMustDos();
    const more = getMoreMustDos();
    const topList = top.length ? top.map((it,i)=> renderMustDoRow(it, i+1)).join('')
      : '<p class="dl-empty">'+(tomorrow ? 'What three things would make tomorrow faithful?' : 'What three things would make today faithful?')+'</p>';
    const moreBlock = more.length
      ? '<details class="dl-more-tasks"><summary>More tasks ('+more.length+')</summary>'+
        '<div class="dl-list">'+more.map(it=> renderMustDoRow(it)).join('')+'</div></details>'
      : '';
    return '<section class="gr-card dl-cc-card" id="sec-non-neg" data-dl-sec="mustdos">'+
      '<div class="dl-cc-head-row"><h3 class="dl-cc-title serif">Top 3 Must-Dos</h3>'+mentorBtn('Help me choose my Top 3', 'Help me choose my Top 3', 'daily-top3')+'</div>'+
      '<p class="dl-cc-q">'+(tomorrow ? 'What three things would make tomorrow faithful?' : 'What three things would make today faithful?')+'</p>'+
      '<div class="dl-list" id="dlNonNegList">'+topList+'</div>'+moreBlock+
      '<div class="dl-add-row">'+
      '<input type="text" class="dl-hairline" id="dlNonNegAdd" placeholder="Add a must-do\u2026">'+
      '<button type="button" class="dl-add-btn" id="dlNonNegAddBtn" aria-label="Add">+</button></div></section>';
  }

  function renderFirstFruitsCompact(){
    const rows = getHabitRows();
    const cards = rows.length ? rows.map(renderHabitRow).join('')
      : '<p class="dl-empty">These are the rhythms that protect your day. Add your own non-negotiables below.</p>';
    return '<section class="gr-card dl-cc-card dl-cc-full" id="sec-first-fruits" data-dl-sec="habits">'+
      '<h3 class="dl-cc-title serif">Non-Negotiables / Habits</h3>'+
      '<p class="dl-cc-q">These are the rhythms that protect your day.</p>'+
      '<div class="dl-habit-list dl-habit-grid">'+cards+'</div>'+
      '<div class="dl-add-row">'+
      '<input type="text" class="dl-hairline" id="dlAnchorAdd" placeholder="Add a daily non-negotiable\u2026">'+
      '<button type="button" class="dl-add-btn" id="dlAnchorAddBtn" aria-label="Add non-negotiable">+</button></div></section>';
  }

  function renderTodayAim(){
    const st = sectionStatus('aim');
    return '<section class="gr-card daily-section" data-phases="morning" id="sec-daily-aim" data-dl-sec="aim">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 1</div>'+
      '<h3 class="gr-card-title serif">Today\u2019s Aim'+(window.helpTip?.(1,'Name the virtue or posture you want to carry today — before tasks take over.')||'')+'</h3>'+
      '<p class="gr-card-q">Today, I want to be faithful in\u2026</p></div>'+
      statusBadge(st)+'</div>'+
      '<input type="text" class="dl-hairline" data-field="posture.aim" placeholder="patience, focus, courage, order, serving well\u2026" aria-label="Today\u2019s aim">'+
      '</section>';
  }

  // Editable title + quiet remove control, identical for every row shape.
  function habitTitleEl(kind, id, title){
    return '<span class="dl-habit-name" contenteditable="true" spellcheck="false" role="textbox" '+
      'aria-label="Habit name — edit and press Enter" data-dl-habit-title="1" data-row-kind="'+kind+'" data-row-id="'+esc(id)+'">'+
      esc(title)+'</span>';
  }
  function habitRemoveEl(kind, id, title){
    return '<button type="button" class="dl-habit-remove" data-dl-habit-remove="1" data-row-kind="'+kind+'" data-row-id="'+esc(id)+'" '+
      'aria-label="Remove '+esc(title)+'" title="Remove">×</button>';
  }

  function renderHabitRow(row){
    const done = habitRowDone(row);
    const status = habitRowStatus(row);
    if(row.type === 'stew'){
      const h = stew()?.getHabit?.(row.stewId);
      const cue = stewHabitCue(h);
      return '<div class="dl-habit-card'+(done?' done':'')+'" data-dl-stew-habit="'+row.stewId+'">'+
        '<input type="checkbox" data-dl-stew-check="'+row.stewId+'"'+(done?' checked':'')+' aria-label="Mark '+esc(row.title)+' kept">'+
        '<div class="dl-habit-main">'+
        habitTitleEl('stew', row.stewId, row.title)+
        (cue ? '<span class="dl-habit-meta">'+esc(cue)+'</span>' : '')+
        '</div>'+
        '<span class="dl-habit-status">'+esc(status)+'</span>'+
        habitRemoveEl('stew', row.stewId, row.title)+'</div>';
    }
    const anchor = row.anchor;
    const kind = anchor.kind || window.faithStore?.getAnchorKind(anchor.id) || 'habit';
    const expanded = sessionExpandId === anchor.id;
    const cue = anchorCue(anchor);
    return '<div class="dl-habit-card'+(done?' done':'')+(expanded?' expanded':'')+'" data-dl-ff="'+anchor.id+'">'+
      '<input type="checkbox" data-dl-habit-check="'+anchor.id+'"'+(done?' checked':'')+' aria-label="Mark '+esc(anchor.title)+' kept">'+
      '<div class="dl-habit-main">'+
      habitTitleEl('anchor', anchor.id, anchor.title)+
      (cue ? '<span class="dl-habit-meta">'+esc(cue)+'</span>' : '')+
      '</div>'+
      '<span class="dl-habit-status">'+esc(status)+'</span>'+
      habitRemoveEl('anchor', anchor.id, anchor.title)+
      (done ? '<button type="button" class="dl-text-action" data-dl-log-another="'+anchor.id+'">+ log</button>' : '')+
      (expanded ? renderSessionExpand(anchor, kind) : '')+
      '</div>';
  }

  /* ── remove / edit, writing back to whichever store the row came from ── */
  async function removeHabitRow(kind, id){
    const S = stew();
    if(kind === 'stew'){
      S?.deleteHabit?.(id);
      await S?.save?.();
    } else if(kind === 'anchor'){
      const fs = window.faithStore;
      if(fs){
        const cfg = fs.getDailyAnchorConfig();
        const entry = cfg.find(a=> a.id === id);
        const linkedStew = entry?.stewHabitId || null;
        fs.setDailyAnchorConfig(cfg.filter(a=> a.id !== id));
        await fs.save();
        // A ledger-added anchor is a linked pair — remove its stew twin too, or
        // it would resurface as an unlinked stew row.
        if(linkedStew && S?.deleteHabit){ S.deleteHabit(linkedStew); await S.save?.(); }
      }
    }
    refreshDailyUI();
    if(typeof renderCalendar === 'function' && typeof isDashboard === 'function' && isDashboard()) renderCalendar();
    markDirty?.();
  }

  function currentHabitTitle(kind, id){
    if(kind === 'stew') return stew()?.getHabit?.(id)?.title || '';
    return window.faithStore?.getDailyAnchorConfig().find(a=> a.id === id)?.title || '';
  }

  async function commitHabitTitle(kind, id, raw){
    // Preserve case exactly as typed; only tidy contenteditable whitespace.
    const title = String(raw || '').replace(/\s+/g, ' ').trim();  // JS \s covers nbsp
    const old = currentHabitTitle(kind, id);
    if(!title){ refreshDailyUI(); return; }   // emptied → revert to the stored title
    if(title === old) return;                 // unchanged → leave the row alone (no churn while tabbing)
    const S = stew();
    if(kind === 'stew'){
      S?.updateHabit?.(id, { title });
      await S?.save?.();
    } else if(kind === 'anchor'){
      const fs = window.faithStore;
      if(fs){
        const cfg = fs.getDailyAnchorConfig();
        const entry = cfg.find(a=> a.id === id);
        if(entry){
          entry.title = title;
          fs.setDailyAnchorConfig(cfg);
          await fs.save();
          if(entry.stewHabitId && S?.updateHabit){ S.updateHabit(entry.stewHabitId, { title }); await S.save?.(); }
        }
      }
    }
    refreshDailyUI();
    if(typeof renderCalendar === 'function' && typeof isDashboard === 'function' && isDashboard()) renderCalendar();
    markDirty?.();
  }

  function renderFirstFruits(){
    const rows = getHabitRows();
    const st = sectionStatus('habits');
    const cards = rows.length ? rows.map(renderHabitRow).join('')
      : '<p class="dl-empty">These are the rhythms that protect your day. Add your own non-negotiables below.</p>';
    return '<section class="gr-card daily-section" data-phases="morning evening" id="sec-first-fruits" data-dl-sec="habits">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 2</div>'+
      '<h3 class="gr-card-title serif">Non-Negotiables / Habits'+(window.helpTip?.(2,'Daily rhythms you return to. Check off when kept — they can sync to your dashboard.')||'')+'</h3>'+
      '<p class="gr-card-q">These are the rhythms that protect your day.</p></div>'+
      statusBadge(st)+'</div>'+
      '<div class="dl-habit-list">'+cards+'</div>'+
      '<div class="dl-add-row">'+
      '<input type="text" class="dl-hairline" id="dlAnchorAdd" placeholder="Add a daily non-negotiable\u2026">'+
      '<button type="button" class="dl-add-btn" id="dlAnchorAddBtn" aria-label="Add non-negotiable">+</button></div>'+
      '<p class="dl-note">Habits created here can appear on your dashboard and daily rhythm.</p></section>';
  }

  function renderMustDoRow(it, priority){
    const done = !!it.done && !it.released;
    const carried = !!(it.carriedOver || it.carriedFrom);
    const badge = it.carryCount ? '<span class="dl-carry-badge" title="Carried forward">\u21bb'+it.carryCount+'</span>' : '';
    const fromBadge = carried ? '<span class="dl-from-yesterday">Carried over</span>' : '';
    const plan = it.carryPlan ? '<div class="dl-carry-plan">'+esc(it.carryPlan)+'</div>' : '';
    const pri = priority != null ? '<span class="dl-priority" aria-label="Priority '+priority+'">'+priority+'</span>' : '';
    return '<div class="dl-must-row'+(done?' done':'')+(it.released?' released':'')+(carried?' carried-over':'')+'" data-dl-nn="'+it.id+'">'+
      pri+'<span class="dl-grip" aria-hidden="true" title="Drag to reorder">\u2807</span>'+
      fromBadge+badge+
      '<label class="dl-check-wrap">'+
      '<input type="checkbox" class="dl-check" data-dl-nn-check="'+it.id+'"'+(done?' checked':'')+(it.released?' disabled':'')+'>'+
      '<span class="dl-item-main dl-must-text">'+esc(it.text)+'</span></label>'+plan+
      '</div>';
  }

  function renderNonNegotiables(){
    const top = getTopMustDos();
    const more = getMoreMustDos();
    const st = sectionStatus('mustdos');
    const topList = top.length ? top.map((it,i)=> renderMustDoRow(it, i+1)).join('')
      : '<p class="dl-empty">What three things would make today faithful?</p>';
    const moreBlock = more.length
      ? '<details class="dl-more-tasks"><summary>More tasks ('+more.length+')</summary>'+
        '<div class="dl-list">'+more.map(it=> renderMustDoRow(it)).join('')+'</div></details>'
      : '';
    return '<section class="gr-card daily-section" data-phases="morning evening" id="sec-non-neg" data-dl-sec="mustdos">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 3</div>'+
      '<h3 class="gr-card-title serif">Top 3 Must-Dos'+(window.helpTip?.(3,'Only three priorities visible — not a giant task manager. More tasks stay tucked away.')||'')+'</h3>'+
      '<p class="gr-card-q">What three things would make today faithful?</p></div>'+
      statusBadge(st)+'</div>'+
      '<div class="dl-list" id="dlNonNegList">'+topList+'</div>'+moreBlock+
      '<div class="dl-add-row">'+
      '<input type="text" class="dl-hairline" id="dlNonNegAdd" placeholder="Add a must-do\u2026">'+
      '<button type="button" class="dl-add-btn" id="dlNonNegAddBtn" aria-label="Add">+</button></div></section>';
  }

  function renderMentorBorrow(catId){
    if(!window.faithStore || catId !== 'leadership') return '';
    const principles = (window.faithStore.data.principles || [])
      .filter(p=> p.title?.trim())
      .sort((a,b)=> (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''))
      .slice(0, 3);
    if(!principles.length) return '';
    return '<div class="dl-borrow-row"><span class="dl-label">Borrow from mentors</span>'+
      principles.map(p=>{
        const m = window.faithStore.getMentor(p.mentorId);
        return '<button type="button" class="dl-borrow-chip" data-dl-borrow="'+p.id+'" data-dl-cat="'+catId+'">'+
          esc((m?.label ? m.label+': ' : '') + (p.title || ''))+'</button>';
      }).join('')+'</div>';
  }

  function defaultGrowthPrompt(c){
    const map = {
      body: 'How am I stewarding my body today?',
      order: 'What needs structure, systems, or clarity?',
      leadership: 'How am I growing as a leader?',
      skill: 'What gift or skill am I developing?'
    };
    return c.hint || map[c.id] || 'One faithful step today.';
  }

  function renderGrowthRep(){
    ensureGrowthRep();
    const st = sectionStatus('growth');
    const sel = dayData.growthRep.category || '';
    const cats = GROWTH_REP_CATS.map(c=>
      '<button type="button" class="dl-growth-cat'+(sel===c.id?' on':'')+'" data-dl-rep-cat="'+c.id+'">'+esc(c.label)+'</button>'
    ).join('');
    const legacy = renderLegacyGrowthAreas();
    return '<section class="gr-card daily-section" data-phases="morning" id="sec-growth" data-dl-sec="growth">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 4</div>'+
      '<h3 class="gr-card-title serif">1% Growth Rep'+(window.helpTip?.(4,'One small action that develops what God has entrusted to you.')||'')+'</h3>'+
      '<p class="gr-card-q">What is one small action that develops what God has entrusted to you?</p></div>'+
      statusBadge(st)+'</div>'+
      '<div class="dl-growth-cats" role="group" aria-label="Growth category">'+cats+'</div>'+
      '<label class="dl-label">What is today\u2019s rep?</label>'+
      '<div class="dl-must-row" style="border:none;padding:4px 0">'+
      '<input type="checkbox" data-field="growthRep.done" aria-label="Growth rep complete"'+(dayData.growthRep.done?' checked':'')+'>'+
      '<input type="text" class="dl-hairline" data-field="growthRep.text" placeholder="e.g. Body \u2014 30-minute workout" aria-label="Today\u2019s growth rep"></div>'+
      legacy+'</section>';
  }

  function renderLegacyGrowthAreas(){
    const cats = getCategories();
    if(!cats.length) return '';
    if(openGrowthCat == null) openGrowthCat = cats[0]?.id || null;
    const acc = cats.map(c=>{
      const items = (dayData?.faithfulFew?.[c.id]?.items || []).filter(x=> !x.growthRep);
      const doneN = items.filter(x=> x.done).length;
      const preview = items.length
        ? doneN + '/' + items.length + (items[0].text ? ' \u00b7 ' + items[0].text.slice(0, 28) : '')
        : 'Add one step';
      const open = openGrowthCat === c.id;
      return '<details class="dl-accordion"'+(open?' open':'')+' data-dl-cat="'+c.id+'">'+
        '<summary><span class="dl-acc-icon">'+esc(c.icon)+'</span><span class="dl-acc-title">'+esc(c.title)+'</span>'+
        '<span class="dl-acc-preview">'+esc(preview)+'</span></summary>'+
        '<div class="dl-acc-body">'+
        '<p class="dl-hint">'+esc(defaultGrowthPrompt(c))+'</p>'+
        renderMentorBorrow(c.id)+
        '<ul class="dl-growth-items" data-dl-growth-list="'+c.id+'">'+
        (items.length ? items.map(it=> renderGrowthItem(it, c.id)).join('')
          : '<li class="dl-empty-li">Nothing yet \u2014 add below.</li>')+
        '</ul>'+
        '<div class="dl-add-row">'+
        '<input type="text" class="dl-hairline" data-dl-growth-add="'+c.id+'" placeholder="Add item\u2026">'+
        '<button type="button" class="dl-add-btn" data-dl-growth-add-btn="'+c.id+'">+</button></div>'+
        '</div></details>';
    }).join('');
    return '<details class="dl-more-tasks" style="margin-top:10px"><summary>Add more growth areas</summary>'+
      '<div class="dl-acc-grid">'+acc+'</div></details>';
  }

  function renderGrowthItem(it, catId){
    return '<li class="dl-item'+(it.done?' done':'')+'" data-dl-growth="'+it.id+'" data-dl-growth-cat="'+catId+'">'+
      '<label class="dl-check-wrap">'+
      '<input type="checkbox" class="dl-check" data-dl-growth-check="'+it.id+'" data-dl-growth-cat="'+catId+'"'+(it.done?' checked':'')+'>'+
      '<input type="text" class="dl-hairline dl-grow-text" data-dl-growth-text="'+it.id+'" data-dl-growth-cat="'+catId+'" value="'+esc(it.text)+'">'+
      '</label>'+
      '<button type="button" class="dl-rm" data-dl-growth-rm="'+it.id+'" data-dl-growth-cat="'+catId+'" aria-label="Remove">\u00d7</button></li>';
  }

  function renderFriction(){
    const st = sectionStatus('plan');
    return '<section class="gr-card daily-section" data-phases="morning" id="sec-friction" data-dl-sec="plan">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 5</div>'+
      '<h3 class="gr-card-title serif">Prepare for Friction'+(window.helpTip?.(5,'Goals need a plan for obstacles, not just good intentions.')||'')+'</h3>'+
      '<p class="gr-card-q">What could pull me off course today?</p></div>'+
      statusBadge(st)+'</div>'+
      '<div class="dl-friction-grid">'+
      '<div><label class="dl-label">Obstacle</label>'+
      '<input type="text" class="dl-hairline" data-field="danger.danger" placeholder="If I feel bored after work\u2026"></div>'+
      '<div><label class="dl-label">If that happens, then I will\u2026</label>'+
      '<input type="text" class="dl-hairline" data-field="danger.thenWill" placeholder="go to the gym before touching my phone"></div>'+
      '</div></section>';
  }

  function renderPlanOfAction(){
    return '<section class="gr-card daily-section" data-phases="morning" id="sec-plan" data-dl-sec="plan-windows">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 6</div>'+
      '<h3 class="gr-card-title serif">Time Windows'+(window.helpTip?.(6,'Map faithfulness across the day \u2014 one line per window.')||'')+'</h3>'+
      '<p class="gr-card-q">What does faithfulness look like in each window?</p></div></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">Morning</span>'+
      '<input type="text" class="dl-hairline" data-field="execute.beforeWork" placeholder="Quiet start, non-negotiables\u2026"></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">Work / School</span>'+
      '<input type="text" class="dl-hairline" data-field="execute.duringWork" placeholder="Focus, service, integrity\u2026"></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">After Work</span>'+
      '<input type="text" class="dl-hairline" data-field="execute.afterWork" placeholder="Transition, family, rest\u2026"></div>'+
      '<div class="dl-window-row"><span class="dl-window-label">Evening Shutdown</span>'+
      '<input type="text" class="dl-hairline" data-field="execute.eveningShutdown" placeholder="Close loops, prepare tomorrow\u2026"></div>'+
      '</section>';
  }

  function renderEveningNonNegReview(){
    const items = getNonNegItems().filter(it=> !it.done && !it.released && !it.eveningAction);
    const st = sectionStatus('reflect');
    const carryRows = items.length ? items.map(it=>
      '<div class="dl-review-row" data-dl-review="'+it.id+'">'+
      '<span class="dl-review-q">Didn\u2019t happen \u2014 carry to tomorrow?</span>'+
      '<span class="dl-review-item">'+esc(it.text)+'</span>'+
      '<div class="dl-review-actions">'+
      '<button type="button" class="dl-btn" data-dl-carry="'+it.id+'">Carry + plan</button>'+
      '<button type="button" class="dl-btn dl-btn-ghost" data-dl-release="'+it.id+'">Release</button></div>'+
      '<div class="dl-carry-field" hidden data-dl-carry-field="'+it.id+'">'+
      '<input type="text" class="dl-hairline" data-dl-carry-plan="'+it.id+'" placeholder="What will make it happen tomorrow?">'+
      '<button type="button" class="dl-btn dl-btn-primary" data-dl-carry-confirm="'+it.id+'">Confirm carry</button></div>'+
      '</div>'
    ).join('') : '';
    return '<section class="gr-card daily-section" data-phases="evening" id="sec-evening-review" data-dl-sec="reflect">'+
      '<div class="gr-card-head">'+
      '<div><div class="gr-card-kicker">Step 8</div>'+
      '<h3 class="gr-card-title serif">Evening Review'+(window.helpTip?.(7,'Close the day with grace \u2014 keep, learn, adjust.')||'')+'</h3>'+
      '<p class="gr-card-q">Review with grace</p></div>'+
      statusBadge(st)+'</div>'+
      '<div class="dl-evening-prompt"><label>What did I keep?</label>'+
      '<input type="text" class="dl-hairline" data-field="track.handledWell" placeholder="Rhythms, commitments, moments of faithfulness\u2026"></div>'+
      '<div class="dl-evening-prompt"><label>What did I learn?</label>'+
      '<input type="text" class="dl-hairline" data-field="learn.reveal" placeholder="What today revealed about you or God\u2026"></div>'+
      '<div class="dl-evening-prompt"><label>What needs grace and adjustment tomorrow?</label>'+
      '<input type="text" class="dl-hairline" data-field="track.neglected" placeholder="Release, replan, or ask for help\u2026"></div>'+
      (carryRows ? '<div class="dl-evening-carry" style="margin-top:12px">'+carryRows+'</div>' : '')+
      '</section>';
  }

  function renderEveningSummary(){
    const s = window.faithStore?.getNonNegotiableSummary(dateStr(), dayData) || { kept:0, carried:0, released:0 };
    if(!s.kept && !s.carried && !s.released) return '';
    return '<section class="gr-card daily-section" data-phases="evening" id="sec-day-summary">'+
      '<p class="dl-summary-line">'+s.kept+' kept \u00b7 '+s.carried+' carried \u00b7 '+s.released+' released</p></section>';
  }

  function renderDailySidebar(){
    const tip = typeof helpTip === 'function' ? helpTip(8,'A calm margin for passing thoughts. Kept safe across days.') : '';
    return '<div class="dl-rail-journal" id="thoughtJournal" aria-label="Thought journal">'+
      '<h4 class="serif">Thought Journal'+tip+'</h4>'+
      '<p class="dl-rail-q">What is on your heart right now?</p>'+
      '<textarea id="thoughtJournalText" placeholder="Write freely \u2014 no pressure to be polished\u2026" aria-label="Thought journal"></textarea>'+
      '<div class="thought-journal-meta" id="thoughtJournalMeta"></div></div>'+
      '<div class="dl-rail-block dl-scripture-block"><h4 class="dl-rail-head serif">Today\u2019s Scripture</h4>'+
      '<p class="dl-scripture">"'+esc(SCRIPTURE.text)+'"<cite>'+esc(SCRIPTURE.ref)+'</cite></p></div>'+
      renderHowThisWorks(currentPhase());
  }

  function syncActionBar(){
    const bar = document.getElementById('dailyStickyBar');
    if(!bar) return;
    bar.hidden = false;
    const phase = currentPhase();
    const markBtn = bar.querySelector('[data-gr-act="mark-phase"]');
    const commitBtn = bar.querySelector('[data-gr-act="commit-next-step"]');
    if(phase === 'day'){
      if(markBtn) markBtn.textContent = 'Mark Midday Check-In Complete';
      if(commitBtn) commitBtn.hidden = false;
    } else if(phase === 'evening'){
      if(markBtn) markBtn.textContent = 'Mark Evening Complete';
      if(commitBtn) commitBtn.hidden = true;
    } else {
      if(markBtn) markBtn.textContent = 'Mark Morning Complete';
      if(commitBtn) commitBtn.hidden = true;
    }
  }

  function refreshProgressChrome(){
    const host = document.getElementById('dailyGuideChrome');
    if(host) host.innerHTML = renderProgressPills();
    syncActionBar();
  }

  function scrollToStep(stepId){
    openDailyStep = stepId;
    const step = DAILY_STEPS.find(s=> s.id === stepId);
    if(!step) return;
    const phase = typeof dailyPhase === 'string' ? dailyPhase : 'morning';
    if(!step.phases.includes(phase)){
      const prefer = step.phases[0];
      if(typeof setDailyPhase === 'function') setDailyPhase(prefer);
    }
    setTimeout(()=>{
      let el = document.getElementById(step.sec);
      if(stepId === 'plan'){
        const friction = document.getElementById('sec-friction');
        const windows = document.getElementById('sec-plan');
        const d = dayData?.danger || {};
        el = (!filled(d.danger) || !filled(d.thenWill)) ? friction : (windows || friction);
      }
      el?.scrollIntoView({ behavior:'smooth', block:'start' });
      refreshProgressChrome();
    }, 60);
  }

  function renderDailyLedger(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return false;
    if(!document.getElementById('dailyMain')) return false;
    ensureGrowthRep();
    root.ensureEveningReview?.();
    renderPhaseContent();
    return true;
  }

  function refreshMustDoList(){
    const nnList = document.getElementById('dlNonNegList');
    if(!nnList) return;
    const top = getTopMustDos();
    nnList.innerHTML = top.length ? top.map((it,i)=> renderMustDoRow(it, i+1)).join('')
      : '<p class="dl-empty">What three things would make today faithful?</p>';
    const sec = document.getElementById('sec-non-neg');
    const moreDetails = sec?.querySelector('.dl-more-tasks');
    const more = getMoreMustDos();
    if(more.length){
      const html = '<details class="dl-more-tasks"'+(moreDetails?.open?' open':'')+'><summary>More tasks ('+more.length+')</summary>'+
        '<div class="dl-list">'+more.map(it=> renderMustDoRow(it)).join('')+'</div></details>';
      if(moreDetails) moreDetails.outerHTML = html;
      else sec?.querySelector('.dl-add-row')?.insertAdjacentHTML('beforebegin', html);
    } else if(moreDetails) moreDetails.remove();
  }

  function refreshSectionBadge(secId, kind){
    const sec = document.getElementById(secId);
    const badge = sec?.querySelector('.gr-status');
    if(badge) badge.outerHTML = statusBadge(sectionStatus(kind));
  }

  function refreshDailyUI(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return;
    ensureGrowthRep();
    root.ensureEveningReview?.();
    renderPhaseContent();
  }

  function updateDailyScore(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return;
    const el = document.getElementById('score');
    if(!el || !dayData) return;
    const nn = getNonNegItems();
    const done = nn.filter(it=> it.done && !it.released).length;
    const anchors = getAnchors();
    const rows = getHabitRows();
    const ffDone = rows.filter(habitRowDone).length;
    const practice = window.faithStore?.getPracticeSummaryForDate(dateStr());
    let txt = ffDone + '/' + rows.length + ' habits';
    if(practice?.totalSessions) txt += ' \u00b7 ' + practice.totalSessions + ' sessions';
    if(nn.length) txt += ' \u00b7 ' + done + '/' + nn.length + ' must-dos';
    el.textContent = txt;
    el.classList.toggle('gold', rows.length && ffDone === rows.length && (!nn.length || done === nn.length));
  }

  async function logSession(anchorId, minutes, entries){
    if(!window.faithStore) return;
    const anchor = getAnchors().find(a=> a.id === anchorId);
    const kind = anchor?.kind || window.faithStore.getAnchorKind(anchorId);
    window.faithStore.logPracticeSession({
      anchorId,
      kind,
      date: dateStr(),
      minutes: minutes || 0,
      entries: entries || []
    });
    await window.faithStore.save();
    sessionExpandId = null;
    refreshDailyUI();
    if(typeof renderCalendar === 'function') renderCalendar();
    markDirty?.();
  }

  function collectPrayerEntries(anchorId){
    const out = [];
    document.querySelectorAll('[data-dl-prayer-req="'+anchorId+'"]').forEach(el=>{
      const idx = el.dataset.dlPrayerIdx;
      const fruit = document.querySelector('[data-dl-prayer-fruit="'+anchorId+'"][data-dl-prayer-idx="'+idx+'"]');
      const request = el.value.trim();
      const fruitVal = fruit?.value?.trim() || '';
      if(request || fruitVal) out.push({ request, fruit: fruitVal });
    });
    return out;
  }

  function getSelectedMinutes(anchorId){
    const picked = document.querySelector('[data-dl-mins].on[data-dl-anchor="'+anchorId+'"]');
    if(picked) return +picked.dataset.dlMins;
    const custom = document.querySelector('[data-dl-custom-min="'+anchorId+'"]');
    return custom?.value ? +custom.value : 0;
  }

  async function carryItem(itemId, plan){
    const it = getNonNegItems().find(x=> x.id === itemId);
    if(!it || !plan?.trim()) return;
    it.eveningAction = 'carry';
    it.carriedOut = true;
    const tomorrowOff = (typeof dayOffset === 'number' ? dayOffset : 0) + 1;
    const tomorrowKey = dayKeyFor(tomorrowOff);
    let tom = normalizeDaily(await getJSON(tomorrowKey));
    if(!tom.faithfulFew.mustDo.items) tom.faithfulFew.mustDo.items = [];
    const exists = tom.faithfulFew.mustDo.items.some(x=>
      (x.text || '').trim().toLowerCase() === (it.text || '').trim().toLowerCase() &&
      x.carriedFrom === dateStr()
    );
    if(!exists){
      tom.faithfulFew.mustDo.items.push({
        id: uid(),
        text: it.text,
        done: false,
        carryCount: (it.carryCount || 0) + 1,
        carryPlan: plan.trim(),
        carriedFrom: dateStr(),
        carriedOver: true
      });
    }
    if(typeof saveDayDataByDate === 'function') await saveDayDataByDate(iso(dayOf(tomorrowOff)), tom);
    if(faithStore){
      faithStore.syncMustDosFromDay(iso(dayOf(tomorrowOff)), tom);
      await faithStore.save();
    }
    const S = stew();
    const t = S?.getTasks?.().find(x=>x.legacyMustDoId === itemId);
    if(t){
      S.updateTask(t.id, {
        dueDate: iso(dayOf(tomorrowOff)),
        originalDate: t.originalDate || dateStr(),
        carriedFrom: dateStr(),
        carryCount: (t.carryCount || 0) + 1
      });
    }
    refreshDailyUI();
    markDirty?.();
  }

  function releaseItem(itemId){
    const it = getNonNegItems().find(x=> x.id === itemId);
    if(!it) return;
    it.released = true;
    it.eveningAction = 'release';
    it.done = false;
    refreshDailyUI();
    markDirty?.();
  }

  async function addAnchor(text){
    const title = text?.trim();
    if(!title) return;

    const fs = window.faithStore || await window.ensureFaithStore?.().catch(()=> null);
    let stewHabit = null;
    const S = stew();
    if(S?.createHabit){
      stewHabit = S.createHabit({ title, icon: '\u25cb' });
      await S.save?.();
    }

    if(fs){
      const cfg = fs.getDailyAnchorConfig();
      cfg.push({
        id: uid(),
        title,
        durationMin: null,
        enabled: true,
        kind: 'habit',
        stewHabitId: stewHabit?.id || null
      });
      fs.setDailyAnchorConfig(cfg);
      fs.ensureDailyAnchors?.(dateStr());
      if(dayData) fs.syncAnchorsToDay?.(dateStr(), dayData);
      await fs.save();
      if(typeof renderAnchorSettings === 'function') renderAnchorSettings();
    } else if(!stewHabit){
      return;
    }

    refreshDailyUI();
    if(typeof renderCalendar === 'function') renderCalendar();
    markDirty?.();
  }

  async function toggleStewHabit(stewId){
    const S = stew();
    if(!S?.toggleHabit) return;
    S.toggleHabit(stewId, dateStr());
    await S.save?.();
    refreshDailyUI();
    if(typeof renderCalendar === 'function') renderCalendar();
    markDirty?.();
  }

  async function markAnchorKept(anchorId){
    const anchor = getAnchors().find(a=> a.id === anchorId);
    if(anchor?.stewHabitId && stew()?.habitDone && !stew().habitDone(anchor.stewHabitId, dateStr())){
      stew().toggleHabit(anchor.stewHabitId, dateStr());
      await stew().save?.();
    }
    if(!anchorDone(anchorId)){
      await logSession(anchorId, 0, []);
      sessionExpandId = anchorId;
    }
    refreshDailyUI();
  }

  function addNonNeg(text){
    if(!text?.trim() || !dayData) return;
    if(!dayData.faithfulFew.mustDo.items) dayData.faithfulFew.mustDo.items = [];
    const itemId = uid();
    dayData.faithfulFew.mustDo.items.push({ id: itemId, text: text.trim(), done: false });
    if(window.faithStore){
      window.faithStore.createTask({
        title: text.trim(),
        date: dateStr(),
        tag: 'stewardship',
        legacyMustDoId: itemId
      });
      window.faithStore.save();
    }
    if(stew()?.createTask){
      const S = stew();
      if(!S.getTasks().some(t=>t.legacyMustDoId === itemId)){
        S.createTask({ title:text.trim(), dueDate:dateStr(), urgency:'today', legacyMustDoId:itemId });
      }
    }
    refreshDailyUI();
    markDirty?.();
  }

  function renderCategorySettings(){
    const el = document.getElementById('categorySettings');
    if(!el || !window.faithStore) return;
    const cats = window.faithStore.getDailyCategoryConfig();
    el.innerHTML = cats.map((c,i)=>
      '<div class="anchor-row anchor-row-cat" data-cat-row="'+i+'">'+
      '<input type="text" class="inp-sm" data-cat-icon value="'+esc(c.icon)+'" style="width:40px" aria-label="Icon">'+
      '<input type="text" class="inp-sm" data-cat-title value="'+esc(c.title)+'" placeholder="Name">'+
      '<input type="text" class="inp-sm" data-cat-hint value="'+esc(c.hint)+'" placeholder="Prompt">'+
      '<label class="simple-toggle"><input type="checkbox" data-cat-enabled'+(c.enabled?' checked':'')+'> On</label>'+
      '<button type="button" class="ff-rm" data-cat-rm aria-label="Remove">\u00d7</button></div>'
    ).join('');
  }

  function saveCategorySettingsFromDOM(){
    if(!window.faithStore) return;
    const rows = [...document.querySelectorAll('#categorySettings [data-cat-row]')];
    const cats = rows.map(row=>({
      icon: row.querySelector('[data-cat-icon]')?.value || '\u2022',
      title: row.querySelector('[data-cat-title]')?.value || '',
      hint: row.querySelector('[data-cat-hint]')?.value || '',
      enabled: row.querySelector('[data-cat-enabled]')?.checked !== false
    }));
    window.faithStore.setDailyCategoryConfig(cats);
    window.faithStore.save();
  }

  function markPhaseComplete(key){
    if(!dayData) return;
    if(!dayData.phaseComplete || typeof dayData.phaseComplete !== 'object'){
      dayData.phaseComplete = { morning:false, day:false, evening:false };
    }
    const phase = typeof dailyPhase === 'string' ? dailyPhase : 'morning';
    if(phase === 'morning'){
      dayData.phaseComplete.morning = true;
      dayData.morningComplete = true;
      if(typeof setDailyPhase === 'function') setDailyPhase('day');
    } else if(phase === 'day'){
      dayData.phaseComplete.day = true;
      dayData.dayComplete = true;
      root.ensureDayCheckIn?.();
      if(dayData.dayCheckIn) dayData.dayCheckIn.middayComplete = true;
      if(typeof setDailyPhase === 'function') setDailyPhase('evening');
    } else {
      dayData.phaseComplete.evening = true;
      dayData.dayComplete = true;
    }
    markDirty?.();
    refreshDailyUI();
    refreshTomorrowPrompt();
  }

  function setNestedField(path, value){
    if(!dayData || !path) return;
    const parts = path.split('.');
    let o = dayData;
    for(let i = 0; i < parts.length - 1; i++){
      if(!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }

  function bindDailyEvents(){
    if(document.body.dataset.dlBound) return;
    document.body.dataset.dlBound = '1';
    const app = document.getElementById('app');

    app.addEventListener('click', async e=>{
      if(!isDaily?.() || (typeof isSaturdayRecovery === 'function' && isSaturdayRecovery())) return;

      const stepBtn = e.target.closest('[data-dl-step]');
      if(stepBtn?.dataset.dlStep){
        scrollToStep(stepBtn.dataset.dlStep);
        return;
      }

      const grAct = e.target.closest('[data-gr-act]');
      if(grAct && document.getElementById('dailyStickyBar')?.contains(grAct)){
        const act = grAct.dataset.grAct;
        // (No manual save action: everything on this screen auto-saves on change.)
        if(act === 'mark-phase'){ markPhaseComplete(); await save?.(); return; }
        if(act === 'clear-day'){ clearCurrent?.(); return; }
      }
      if(e.target.closest('[data-dl-save]')){
        await save?.();
        return;
      }
      const mark = e.target.closest('[data-dl-mark-phase]');
      if(mark){
        markPhaseComplete(mark.dataset.dlMarkPhase);
        await save?.();
        return;
      }
      if(e.target.closest('[data-dl-clear]')){
        clearCurrent?.();
        return;
      }

      if(e.target.closest('[data-dl-plan-tomorrow-yes]')){
        await openTomorrowPlanning({ fromDay: dayData, carry: true });
        return;
      }
      if(e.target.closest('[data-dl-plan-tomorrow-no]')){
        dismissTomorrowPrompt();
        return;
      }

      const gotoPhase = e.target.closest('[data-dl-goto-phase]');
      if(gotoPhase?.dataset.dlGotoPhase){
        setDailyPhase?.(gotoPhase.dataset.dlGotoPhase);
        refreshProgressChrome();
        return;
      }

      if(e.target.closest('#dlNonNegAddBtn')){
        addNonNeg(document.getElementById('dlNonNegAdd')?.value);
        const inp = document.getElementById('dlNonNegAdd');
        if(inp) inp.value = '';
        return;
      }

      if(e.target.closest('#dlAnchorAddBtn')){
        const inp = document.getElementById('dlAnchorAdd');
        await addAnchor(inp?.value);
        if(inp) inp.value = '';
        return;
      }

      const stewCheck = e.target.closest('[data-dl-stew-check]');
      if(stewCheck){
        e.preventDefault();
        await toggleStewHabit(stewCheck.dataset.dlStewCheck);
        return;
      }

      const habitRemove = e.target.closest('[data-dl-habit-remove]');
      if(habitRemove){
        e.preventDefault();
        const kind = habitRemove.dataset.rowKind;
        const id = habitRemove.dataset.rowId;
        const title = currentHabitTitle(kind, id) || 'this habit';
        if(confirm('Remove “'+title+'”? You can always add it again.')){
          await removeHabitRow(kind, id);
        }
        return;
      }

      const habitTitle = e.target.closest('[data-dl-habit-title]');
      if(habitTitle){ return; }   // clicking a title just places the caret to edit

      const repCat = e.target.closest('[data-dl-rep-cat]');
      if(repCat){
        ensureGrowthRep();
        dayData.growthRep.category = repCat.dataset.dlRepCat;
        syncGrowthRepToLegacy();
        refreshDailyUI();
        markDirty?.();
        return;
      }

      const habitCheck = e.target.closest('[data-dl-habit-check]');
      if(habitCheck){
        e.preventDefault();
        const anchorId = habitCheck.dataset.dlHabitCheck;
        if(!anchorDone(anchorId)){
          await markAnchorKept(anchorId);
        } else {
          sessionExpandId = sessionExpandId === anchorId ? null : anchorId;
          refreshDailyUI();
        }
        return;
      }

      const ffCheck = e.target.closest('[data-dl-ff-check]');
      if(ffCheck){
        const anchorId = ffCheck.dataset.dlFfCheck;
        if(!anchorDone(anchorId)){
          await logSession(anchorId, 0, []);
          sessionExpandId = anchorId;
          refreshDailyUI();
        } else {
          sessionExpandId = sessionExpandId === anchorId ? null : anchorId;
          refreshDailyUI();
        }
        return;
      }

      const logAnother = e.target.closest('[data-dl-log-another]');
      if(logAnother){
        sessionExpandId = logAnother.dataset.dlLogAnother;
        refreshDailyUI();
        return;
      }

      const saveSession = e.target.closest('[data-dl-save-session]');
      if(saveSession){
        const anchorId = saveSession.dataset.dlSaveSession;
        const mins = getSelectedMinutes(anchorId);
        const kind = getAnchors().find(a=> a.id === anchorId)?.kind;
        let ent = collectPrayerEntries(anchorId);
        if(kind === 'bible'){
          ent = [{ passage: document.querySelector('[data-dl-bible-passage="'+anchorId+'"]')?.value?.trim() || '',
            takeaway: document.querySelector('[data-dl-bible-takeaway="'+anchorId+'"]')?.value?.trim() || '' }];
        }
        await logSession(anchorId, mins, ent);
        return;
      }

      const durPick = e.target.closest('[data-dl-mins]');
      if(durPick){
        durPick.closest('.dl-dur-picks')?.querySelectorAll('[data-dl-mins]').forEach(b=> b.classList.remove('on'));
        durPick.classList.add('on');
        const anchorId = durPick.dataset.dlAnchor;
        const entries = collectPrayerEntries(anchorId);
        const passage = document.querySelector('[data-dl-bible-passage="'+anchorId+'"]')?.value?.trim();
        const takeaway = document.querySelector('[data-dl-bible-takeaway="'+anchorId+'"]')?.value?.trim();
        const kind = getAnchors().find(a=> a.id === anchorId)?.kind;
        let ent = entries;
        if(kind === 'bible') ent = [{ passage, takeaway }];
        await logSession(anchorId, +durPick.dataset.dlMins, ent);
        return;
      }

      const carryBtn = e.target.closest('[data-dl-carry]');
      if(carryBtn){
        const field = document.querySelector('[data-dl-carry-field="'+carryBtn.dataset.dlCarry+'"]');
        field?.removeAttribute('hidden');
        return;
      }

      const carryConfirm = e.target.closest('[data-dl-carry-confirm]');
      if(carryConfirm){
        const id = carryConfirm.dataset.dlCarryConfirm;
        const plan = document.querySelector('[data-dl-carry-plan="'+id+'"]')?.value;
        await carryItem(id, plan);
        return;
      }

      const releaseBtn = e.target.closest('[data-dl-release]');
      if(releaseBtn){ releaseItem(releaseBtn.dataset.dlRelease); return; }

      const borrow = e.target.closest('[data-dl-borrow]');
      if(borrow && window.faithStore){
        const p = window.faithStore.getPrinciple(borrow.dataset.dlBorrow);
        const catId = borrow.dataset.dlCat;
        if(!p || !dayData) return;
        if(!dayData.faithfulFew[catId]?.items) dayData.faithfulFew[catId] = { items: [] };
        const title = p.title || p.sourceQuestion;
        dayData.faithfulFew[catId].items.push({ id: uid(), text: title, done: false, principleId: p.id });
        window.faithStore.logPrincipleApplication(p.id, { note: 'Borrowed to daily growth', date: dateStr() });
        window.faithStore.save();
        refreshDailyUI();
        markDirty?.();
        return;
      }

      const growthAdd = e.target.closest('[data-dl-growth-add-btn]');
      if(growthAdd){
        const cat = growthAdd.dataset.dlGrowthAddBtn;
        const inp = document.querySelector('[data-dl-growth-add="'+cat+'"]');
        const text = inp?.value?.trim();
        if(!text) return;
        if(!dayData.faithfulFew[cat]) dayData.faithfulFew[cat] = { items: [] };
        dayData.faithfulFew[cat].items.push({ id: uid(), text, done: false });
        inp.value = '';
        openGrowthCat = cat;
        refreshDailyUI();
        markDirty?.();
        return;
      }

      const growthRm = e.target.closest('[data-dl-growth-rm]');
      if(growthRm){
        const { dlGrowthRm: id, dlGrowthCat: cat } = growthRm.dataset;
        dayData.faithfulFew[cat].items = dayData.faithfulFew[cat].items.filter(x=> x.id !== id);
        openGrowthCat = cat;
        refreshDailyUI();
        markDirty?.();
        return;
      }
    });

    app.addEventListener('toggle', e=>{
      const det = e.target.closest?.('details[data-dl-cat]');
      if(!det || !isDaily?.()) return;
      if(det.open){
        openGrowthCat = det.dataset.dlCat;
        document.querySelectorAll('#sec-growth details[data-dl-cat]').forEach(d=>{
          if(d !== det) d.open = false;
        });
      }
    }, true);

    app.addEventListener('change', e=>{
      if(!isDaily?.() || (typeof isSaturdayRecovery === 'function' && isSaturdayRecovery())) return;
      const nn = e.target.closest('[data-dl-nn-check]');
      if(nn){
        const it = getNonNegItems().find(x=> x.id === nn.dataset.dlNnCheck);
        if(it && !it.released){
          it.done = nn.checked;
          if(window.faithStore){
            const task = window.faithStore.findTaskByLegacyMustDo(it.id, dateStr());
            if(task) window.faithStore.updateTask(task.id, { completed: !!it.done, completedAt: it.done ? new Date().toISOString() : null });
            window.faithStore.save();
          }
          const S = stew();
          const stewTask = S?.getTasks?.().find(t=>t.legacyMustDoId === it.id);
          if(stewTask) S.updateTask(stewTask.id, { status: it.done ? 'done' : 'todo' });
          const row = nn.closest('.dl-must-row');
          if(row){
            row.classList.toggle('done', it.done);
            const text = row.querySelector('.dl-must-text');
            if(text) text.classList.toggle('done', it.done);
          }
          refreshSectionBadge('sec-non-neg', 'mustdos');
          refreshProgressChrome();
          updateDailyScore();
          markDirty?.();
        }
        return;
      }
      const gr = e.target.closest('[data-dl-growth-check]');
      if(gr){
        const cat = gr.dataset.dlGrowthCat;
        const it = dayData.faithfulFew[cat]?.items?.find(x=> x.id === gr.dataset.dlGrowthCheck);
        if(it){ it.done = gr.checked; openGrowthCat = cat; refreshDailyUI(); markDirty?.(); }
      }
      if(e.target.dataset?.field === 'growthRep.done'){
        ensureGrowthRep();
        dayData.growthRep.done = e.target.checked;
        syncGrowthRepToLegacy();
        refreshSectionBadge('sec-growth', 'growth');
        refreshProgressChrome();
        markDirty?.();
      }
    });

    app.addEventListener('input', e=>{
      if(!isDaily?.()) return;
      const gt = e.target.closest('[data-dl-growth-text]');
      if(gt){
        const cat = gt.dataset.dlGrowthCat;
        const it = dayData.faithfulFew[cat]?.items?.find(x=> x.id === gt.dataset.dlGrowthText);
        if(it){ it.text = gt.value; markDirty?.(); }
        return;
      }
      const field = e.target.dataset?.field;
      if(!field) return;
      if(field === 'posture.aim'){
        setNestedField(field, e.target.value);
        refreshSectionBadge('sec-daily-aim', 'aim');
        refreshProgressChrome();
        markDirty?.();
        return;
      }
      if(field.startsWith('danger.')){
        setNestedField(field, e.target.value);
        refreshSectionBadge('sec-friction', 'plan');
        refreshProgressChrome();
        markDirty?.();
        return;
      }
      if(field.startsWith('execute.')){
        setNestedField(field, e.target.value);
        refreshSectionBadge('sec-friction', 'plan');
        markDirty?.();
        return;
      }
      if(field.startsWith('track.') || field.startsWith('learn.')){
        setNestedField(field, e.target.value);
        refreshSectionBadge('sec-evening-review', 'reflect');
        refreshProgressChrome();
        markDirty?.();
        return;
      }
      if(field === 'growthRep.text'){
        ensureGrowthRep();
        dayData.growthRep.text = e.target.value;
        syncGrowthRepToLegacy();
        refreshSectionBadge('sec-growth', 'growth');
        markDirty?.();
      }
    });

    app.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && e.target.id === 'dlNonNegAdd'){
        e.preventDefault();
        document.getElementById('dlNonNegAddBtn')?.click();
      }
      if(e.key === 'Enter' && e.target.id === 'dlAnchorAdd'){
        e.preventDefault();
        document.getElementById('dlAnchorAddBtn')?.click();
      }
      // Inline habit-title edit: Enter or Tab commits.
      const titleEl = e.target.closest?.('[data-dl-habit-title]');
      if(titleEl && (e.key === 'Enter' || e.key === 'Tab')){
        if(e.key === 'Enter') e.preventDefault();   // don't insert a newline
        titleEl.dataset.committing = '1';
        commitHabitTitle(titleEl.dataset.rowKind, titleEl.dataset.rowId, titleEl.textContent);
      }
      if(titleEl && e.key === 'Escape'){
        e.preventDefault();
        titleEl.dataset.committing = '1';   // cancel = re-render restores the stored title
        refreshDailyUI();
      }
    });

    // Commit on blur too (clicking away), unless a key already committed.
    app.addEventListener('focusout', e=>{
      const titleEl = e.target.closest?.('[data-dl-habit-title]');
      if(!titleEl) return;
      if(titleEl.dataset.committing){ delete titleEl.dataset.committing; return; }
      commitHabitTitle(titleEl.dataset.rowKind, titleEl.dataset.rowId, titleEl.textContent);
    });

    document.getElementById('categoryAddBtn')?.addEventListener('click', ()=>{
      if(!window.faithStore) return;
      const cats = window.faithStore.getDailyCategoryConfig();
      cats.push({ icon: '\u2022', title: 'New category', hint: '', enabled: true });
      window.faithStore.setDailyCategoryConfig(cats);
      renderCategorySettings();
      saveCategorySettingsFromDOM();
    });
    document.getElementById('categorySettings')?.addEventListener('input', saveCategorySettingsFromDOM);
    document.getElementById('categorySettings')?.addEventListener('change', saveCategorySettingsFromDOM);
    document.getElementById('categorySettings')?.addEventListener('click', e=>{
      if(e.target.closest('[data-cat-rm]')){
        const row = e.target.closest('[data-cat-row]');
        const idx = +row?.dataset.catRow;
        if(Number.isNaN(idx)) return;
        const cats = window.faithStore.getDailyCategoryConfig().filter((_,i)=> i !== idx);
        window.faithStore.setDailyCategoryConfig(cats);
        renderCategorySettings();
        saveCategorySettingsFromDOM();
      }
    });
    root.bindMiddayEvents?.();
  }

  root.__dailyHelpers = {
    getHabitRows, habitRowDone, habitRowStatus, getTopMustDos, getMoreMustDos, getNonNegItems,
    getAnchors, anchorDone, anchorCue, stewHabitCue, markAnchorKept, toggleStewHabit,
    addNonNeg, addAnchor, filled, dateStr, mustDoDisplay
  };

  root.hookDailyPhaseRefresh = function(){
    renderPhaseContent();
  };

  root.renderDailyLedger = renderDailyLedger;
  root.renderPhaseContent = renderPhaseContent;
  root.refreshDailySummary = refreshProgressChrome;
  root.refreshDailyUI = refreshDailyUI;
  root.updateDailyScore = updateDailyScore;
  root.bindDailyEvents = bindDailyEvents;
  root.renderCategorySettings = renderCategorySettings;
  root.refreshDailyGuideChrome = refreshProgressChrome;
  root.refreshTomorrowPrompt = refreshTomorrowPrompt;
  root.openTomorrowPlanning = openTomorrowPlanning;
  root.loadDailyLedger = async function(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return false;
    ensureGrowthRep();
    root.ensureEveningReview?.();
    renderPhaseContent();
    return true;
  };

})(typeof window !== 'undefined' ? window : globalThis);
