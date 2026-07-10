/**
 * During the Day — midday check-in dashboard for Daily Ledger
 */
(function(root){
  'use strict';

  const SCRIPTURE = {
    text: 'Whatever you do, do it from the heart, as something done for the Lord and not for people.',
    ref: 'Colossians 3:23'
  };
  const WHAT_CHANGED = [
    { id:'energy', label:'Energy dropped' },
    { id:'schedule', label:'Schedule changed' },
    { id:'workLong', label:'Work ran long' },
    { id:'unexpected', label:'Unexpected responsibility' },
    { id:'emotional', label:'Emotional load' },
    { id:'temptation', label:'Temptation / distraction' },
    { id:'overplanned', label:'I overplanned' },
    { id:'better', label:'Something better became important' }
  ];
  const AUDIBLE_OPTIONS = [
    { id:'keep', title:'Keep the plan', sub:'The plan is still realistic. Continue.', msg:'Good. Choose the next visible step.' },
    { id:'reduce', title:'Reduce the plan', sub:'Keep the goal, lower the size.', msg:'Faithfulness can be smaller and still real.' },
    { id:'reschedule', title:'Reschedule', sub:'Move this to a better window.', msg:'Move it intentionally, not vaguely.' },
    { id:'release', title:'Release with peace', sub:'Let this go today without spiraling.', msg:'Release what wisdom says to release. Do not use release as escape.' }
  ];
  const FRICTION_PULL = ['Phone','Fatigue','Hunger','Anxiety','Avoidance','Boredom','Shame','Overwhelm','Temptation','Too many choices'];
  const FRICTION_SUPPORT = [
    'Take a 5-minute reset','Remove the distraction','Ask for help','Eat / hydrate',
    'Pray / breathe','Lower the scope','Change environment','Start with 2 minutes'
  ];
  const ALIGN_COPY = {
    onTrack: 'Good. Keep choosing faithfulness in the next step.',
    drifting: 'Noticing drift is stewardship. What is one small reset you can make right now?',
    reset: 'Resetting is faithfulness. Use Call an Audible below to adjust wisely.'
  };

  function H(){ return root.__dailyHelpers || {}; }
  function ensureDayCheckIn(){
    if(!dayData) return;
    const base = {
      alignment:'',
      habits:{},
      audible:{ whatChanged:[], adjustment:'', note:'' },
      nextStep:'',
      nextStepCommitted:false,
      friction:{ pull:[], support:'' },
      middayComplete:false
    };
    if(!dayData.dayCheckIn) dayData.dayCheckIn = {...base};
    else {
      dayData.dayCheckIn = {
        ...base,
        ...dayData.dayCheckIn,
        audible:{ ...base.audible, ...(dayData.dayCheckIn.audible||{}) },
        friction:{ ...base.friction, ...(dayData.dayCheckIn.friction||{}) },
        habits:{ ...(dayData.dayCheckIn.habits||{}) }
      };
    }
  }

  function habitKey(row){ return row.type === 'stew' ? 'stew:'+row.stewId : 'anch:'+row.id; }
  function isMorningIncomplete(){
    ensureDayCheckIn();
    if(dayData?.phaseComplete?.morning) return false;
    const aim = dayData?.posture?.aim?.trim();
    const top = H().getTopMustDos?.() || [];
    return !aim && !top.length;
  }

  function habitDisposition(key){
    return dayData?.dayCheckIn?.habits?.[key]?.disposition || '';
  }

  function mustDoDisplay(it){
    if(it.reducedText?.trim()) return it.reducedText.trim();
    return it.text || '';
  }

  function mustDoStatus(it){
    if(it.done && !it.released) return 'Complete';
    if(it.released || it.middayStatus === 'released') return 'Released';
    if(it.middayStatus === 'rescheduled') return 'Rescheduled';
    if(it.reducedText) return 'Reduced';
    return 'Still possible';
  }

  function renderDayHero(){
    return '<header class="dd-hero gr-card">'+
      '<div class="dd-hero-kicker">Midday Check-In</div>'+
      '<h2 class="dd-hero-title serif">Reguide toward this morning\u2019s plan.</h2>'+
      '<p class="dd-hero-sub">Pause, notice, adjust, and take the next faithful step.</p></header>';
  }

  function renderQuickSetup(){
    if(!isMorningIncomplete()) return '';
    return '<section class="dd-card gr-card" id="dd-quick-setup">'+
      '<p class="dd-card-kicker">Gentle start</p>'+
      '<h3 class="dd-card-title serif">Morning setup was not completed yet</h3>'+
      '<p class="dd-helper">You can still reguide the day from here.</p>'+
      '<label class="dl-label">Today\u2019s aim</label>'+
      '<input type="text" class="dl-hairline" data-field="posture.aim" placeholder="One word or phrase\u2026">'+
      '<label class="dl-label">One must-do</label>'+
      '<input type="text" class="dl-hairline" id="ddQuickMustDo" placeholder="What still matters most?">'+
      '<button type="button" class="dl-btn dl-btn-primary" data-dd-quick-add>Save quick aim</button></section>';
  }

  function renderAlignment(){
    ensureDayCheckIn();
    const aim = dayData?.posture?.aim?.trim();
    const align = dayData.dayCheckIn.alignment || '';
    const prominent = align === 'reset' || align === 'drifting';
    const pills = [
      ['onTrack','On track'],
      ['drifting','Drifting'],
      ['reset','Need to reset']
    ].map(([id,label])=>
      '<button type="button" class="dd-pill'+(align===id?' on':'')+'" data-dd-alignment="'+id+'">'+label+'</button>'
    ).join('');
    const copy = align && ALIGN_COPY[align]
      ? '<p class="dd-microcopy">'+esc(ALIGN_COPY[align])+'</p><p class="dd-grace">Noticing drift is stewardship. Resetting is faithfulness.</p>'
      : '';
    return '<section class="dd-card gr-card'+(prominent?' dd-highlight':'')+'" id="dd-alignment">'+
      '<p class="dd-card-kicker">Section 1</p>'+
      '<h3 class="dd-card-title serif">Alignment Check</h3>'+
      '<p class="dd-question">Am I still living toward today\u2019s aim?</p>'+
      (aim
        ? '<div class="dd-aim-show"><span class="dd-aim-label">Today\u2019s Aim</span><span class="dd-aim-value">'+esc(aim)+'</span></div>'
        : '<p class="dd-empty">No aim set yet — add one above or in Morning Setup.</p>')+
      '<div class="dd-pill-row" role="group" aria-label="Alignment">'+pills+'</div>'+copy+
      '</section>';
  }

  function renderDayHabitRow(row){
    const key = habitKey(row);
    const done = H().habitRowDone?.(row);
    let status = done ? 'Complete' : 'Needs attention';
    const disp = habitDisposition(key);
    if(disp === 'released') status = 'Released';
    else if(disp === 'evening') status = 'Still possible';
    else if(!done) status = 'Needs attention';
    let cue = '';
    if(row.type === 'stew'){
      const h = root.StewStore?.getHabit?.(row.stewId);
      cue = H().stewHabitCue?.(h) || '';
    } else cue = H().anchorCue?.(row.anchor) || '';
    const menu = !done ? '<div class="dd-mini-actions">'+
      ['stillPossible','evening','released'].map(v=>{
        const labels = { stillPossible:'Still possible', evening:'Move to evening', released:'Let go today' };
        return '<button type="button" class="dd-mini-btn'+(disp===v?' on':'')+'" data-dd-habit-disposition="'+v+'" data-dd-habit-key="'+key+'">'+labels[v]+'</button>';
      }).join('')+'</div>'+
      (disp==='released' ? '<p class="dd-release-msg">Released without guilt. Learn and continue.</p>' : '')
      : '';
    return '<div class="dd-compact-row'+(done?' done':'')+'" data-dd-habit="'+key+'">'+
      '<input type="checkbox" class="dl-check" data-dd-day-habit-check="'+key+'"'+(done?' checked':'')+' aria-label="'+esc(row.title)+'">'+
      '<div class="dd-row-main"><span class="dd-row-title">'+esc(row.title)+'</span>'+
      (cue ? '<span class="dd-row-meta">'+esc(cue)+'</span>' : '')+menu+'</div>'+
      '<span class="dd-status'+(done?' complete':'')+'">'+esc(status)+'</span></div>';
  }

  function renderMiddayIntro(){
    return '<section class="gr-card dl-cc-card dd-intro-card">'+
      '<div class="dl-phase-kicker">Midday Check-In</div>'+
      '<h3 class="dl-cc-title serif">Reguide toward this morning\u2019s plan.</h3>'+
      '<p class="dl-cc-hint">Pause, notice, adjust, and take the next faithful step.</p></section>';
  }

  function renderAlignmentCard(){
    ensureDayCheckIn();
    const aim = dayData?.posture?.aim?.trim();
    const align = dayData.dayCheckIn.alignment || '';
    const prominent = align === 'reset' || align === 'drifting';
    const pills = [
      ['onTrack','On track'],
      ['drifting','Drifting'],
      ['reset','Need to reset']
    ].map(([id,label])=>
      '<button type="button" class="dd-pill'+(align===id?' on':'')+'" data-dd-alignment="'+id+'">'+label+'</button>'
    ).join('');
    const copy = align && ALIGN_COPY[align]
      ? '<p class="dd-microcopy">'+esc(ALIGN_COPY[align])+'</p>'
      : '';
    return '<section class="dd-card gr-card dl-cc-card'+(prominent?' dd-highlight':'')+'" id="dd-alignment">'+
      '<h3 class="dl-cc-title serif">Alignment Check</h3>'+
      '<p class="dd-question">Am I still living toward today\u2019s aim?</p>'+
      (aim
        ? '<div class="dd-aim-show"><span class="dd-aim-label">Today\u2019s Aim</span><span class="dd-aim-value">'+esc(aim)+'</span></div>'
        : '<p class="dd-empty">No aim set yet — add one in quick setup or Morning Setup.</p>')+
      '<div class="dd-pill-row" role="group" aria-label="Alignment">'+pills+'</div>'+copy+
      '</section>';
  }

  function renderHabitsCheck(){
    const rows = H().getHabitRows?.() || [];
    const kept = rows.filter(r=> H().habitRowDone?.(r)).length;
    const summary = rows.length ? kept+' of '+rows.length+' kept today' : 'No habits yet';
    const list = rows.length ? rows.map(renderDayHabitRow).join('')
      : '<p class="dd-empty">Add non-negotiables in Morning Setup.</p>';
    return '<section class="dd-card gr-card dl-cc-card" id="dd-habits">'+
      '<h3 class="dl-cc-title serif">Non-Negotiables Check</h3>'+
      '<p class="dd-summary">'+esc(summary)+'</p>'+
      '<div class="dd-compact-list">'+list+'</div></section>';
  }

  function renderDayMustDoRow(it, pri){
    const done = !!it.done && !it.released;
    const status = mustDoStatus(it);
    const display = mustDoDisplay(it);
    const showOrig = it.reducedText && it.originalText;
    const reduceOpen = it.middayAction === 'reduce' && !it.reducedText;
    const menu = !done && !it.released
      ? '<div class="dd-mini-actions">'+
        [['keep','Keep today'],['later','Push later'],['reduce','Reduce scope'],['done','Done']].map(([a,l])=>
          '<button type="button" class="dd-mini-btn'+(it.middayAction===a?' on':'')+'" data-dd-must-act="'+a+'" data-dd-must-id="'+it.id+'">'+l+'</button>'
        ).join('')+'</div>'+
        (reduceOpen || it.reducedText
          ? '<div class="dd-reduce-field"><label class="dl-label">Smallest faithful version</label>'+
            '<input type="text" class="dl-hairline" data-dd-reduce-text="'+it.id+'" value="'+esc(it.reducedText||'')+'" placeholder="Draft the outline\u2026"></div>'
          : '')+
        (showOrig ? '<p class="dd-orig-line">Original: '+esc(it.originalText)+'</p>' : '')
      : '';
    return '<div class="dd-compact-row'+(done?' done':'')+'" data-dd-must="'+it.id+'">'+
      '<span class="dl-priority">'+pri+'</span>'+
      '<input type="checkbox" class="dl-check" data-dd-must-check="'+it.id+'"'+(done?' checked':'')+(it.released?' disabled':'')+'>'+
      '<div class="dd-row-main"><span class="dd-row-title">'+esc(display)+'</span>'+menu+'</div>'+
      '<span class="dd-status">'+esc(status)+'</span></div>';
  }

  function renderTop3Check(){
    const top = H().getTopMustDos?.() || [];
    const list = top.length ? top.map((it,i)=> renderDayMustDoRow(it, i+1)).join('')
      : '<p class="dd-empty">No must-dos yet — add one in quick setup or Morning Setup.</p>';
    return '<section class="dd-card gr-card dl-cc-card" id="dd-top3">'+
      '<h3 class="dl-cc-title serif">Top 3 Check</h3>'+
      '<p class="dd-question">What still matters most?</p>'+
      '<div class="dd-compact-list">'+list+'</div></section>';
  }

  function renderCallAudible(){
    ensureDayCheckIn();
    const a = dayData.dayCheckIn.audible || {};
    const align = dayData.dayCheckIn.alignment;
    const prominent = align === 'reset' || align === 'drifting';
    const chips = WHAT_CHANGED.map(c=>
      '<button type="button" class="dd-chip'+(a.whatChanged?.includes(c.id)?' on':'')+'" data-dd-changed="'+c.id+'">'+esc(c.label)+'</button>'
    ).join('');
    const cards = AUDIBLE_OPTIONS.map(o=>
      '<button type="button" class="dd-option-card'+(a.adjustment===o.id?' on':'')+'" data-dd-audible="'+o.id+'">'+
      '<span class="dd-option-title">'+esc(o.title)+'</span>'+
      '<span class="dd-option-sub">'+esc(o.sub)+'</span></button>'
    ).join('');
    const msg = a.adjustment ? AUDIBLE_OPTIONS.find(o=> o.id===a.adjustment)?.msg : '';
    return '<section class="dd-card gr-card dl-cc-card'+(prominent?' dd-prominent':'')+'" id="dd-audible">'+
      '<h3 class="dl-cc-title serif">Call an Audible</h3>'+
      '<p class="dd-helper">When the day changes, faithfulness may require adjustment.</p>'+
      '<p class="dd-question">What changed?</p>'+
      '<div class="dd-chip-row">'+chips+'</div>'+
      '<p class="dd-question">What is the wise adjustment?</p>'+
      '<div class="dd-option-grid">'+cards+'</div>'+
      (msg ? '<p class="dd-guidance">'+esc(msg)+'</p>' : '')+
      '</section>';
  }

  function renderNextStep(){
    ensureDayCheckIn();
    const committed = dayData.dayCheckIn.nextStepCommitted;
    const step = dayData.dayCheckIn.nextStep || '';
    return '<section class="dd-card gr-card dl-cc-card dd-next-step" id="dd-next-step">'+
      '<h3 class="dl-cc-title serif">Next Faithful Step</h3>'+
      '<p class="dd-question">What is the next 10-minute action?</p>'+
      '<label class="dl-label">Right now, I will\u2026</label>'+
      '<input type="text" class="dl-hairline" id="ddNextStepInput" data-field="dayCheckIn.nextStep" value="'+esc(step)+'" placeholder="Put on gym clothes\u2026">'+
      '<button type="button" class="dl-btn dl-btn-primary" data-dd-commit-step>Commit Next Step</button>'+
      (committed && step ? '<p class="dd-commit-msg">Good. Do this before anything else.</p>' : '')+
      '</section>';
  }

  function renderFrictionCheck(){
    ensureDayCheckIn();
    const f = dayData.dayCheckIn.friction || {};
    const pullChips = FRICTION_PULL.map((l,i)=>
      '<button type="button" class="dd-chip'+(f.pull?.includes(l)?' on':'')+'" data-dd-friction-pull="'+esc(l)+'">'+esc(l)+'</button>'
    ).join('');
    const supportChips = FRICTION_SUPPORT.map(l=>
      '<button type="button" class="dd-chip'+(f.support===l?' on':'')+'" data-dd-friction-support="'+esc(l)+'">'+esc(l)+'</button>'
    ).join('');
    return '<details class="dd-card gr-card dd-friction-details" id="dd-friction">'+
      '<summary><span class="dd-card-title serif">Friction Check</span><span class="dd-optional">Optional</span></summary>'+
      '<p class="dd-question">What is pulling me off course right now?</p>'+
      '<div class="dd-chip-row">'+pullChips+'</div>'+
      '<p class="dd-question">If this is true, what support do you need?</p>'+
      '<div class="dd-chip-row">'+supportChips+'</div></details>';
  }

  function renderDuringDayDashboard(){
    ensureDayCheckIn();
    return '<div class="dd-dashboard dl-phase-view" id="sec-day-dashboard">'+
      renderQuickSetup()+
      '<div class="dl-grid-2 dd-top-grid">'+
      renderMiddayIntro()+
      renderAlignmentCard()+
      '</div>'+
      '<div class="dl-grid-2">'+
      renderHabitsCheck()+
      renderTop3Check()+
      '</div>'+
      '<div class="dl-grid-2">'+
      renderCallAudible()+
      renderNextStep()+
      '</div>'+
      renderFrictionCheck()+
      '</div>';
  }

  function renderDaySidebar(){
    const tip = typeof helpTip === 'function' ? helpTip(8,'A quiet margin — optional, not required.') : '';
    const verse = SCRIPTURE.text.length > 64 ? SCRIPTURE.text.slice(0,64)+'\u2026' : SCRIPTURE.text;
    return '<div class="dl-rail-journal" id="thoughtJournal" aria-label="Thought journal">'+
      '<h4 class="serif">Thought Journal'+tip+'</h4>'+
      '<p class="dl-rail-q">What is on your heart right now?</p>'+
      '<textarea id="thoughtJournalText" placeholder="Optional\u2026" aria-label="Thought journal"></textarea>'+
      '<div class="thought-journal-meta" id="thoughtJournalMeta"></div></div>'+
      '<div class="dl-rail-block dl-scripture-block dd-scripture-compact"><h4 class="dl-rail-head serif">Today\u2019s Scripture</h4>'+
      '<p class="dl-scripture dd-scripture-sm">"'+esc(verse)+'"<cite>'+esc(SCRIPTURE.ref)+'</cite></p></div>'+
      '<div class="gr-how"><h4 class="serif">How This Works</h4><ol>'+
      '<li>Check your aim</li><li>Review habits and must-dos</li><li>Notice what changed</li>'+
      '<li>Call an audible if needed</li><li>Choose the next faithful step</li></ol></div>';
  }

  function syncDayActionBar(){
    const bar = document.getElementById('dailyStickyBar');
    if(!bar) return;
    bar.hidden = false;
    const phase = typeof dailyPhase === 'string' ? dailyPhase : 'morning';
    const mark = bar.querySelector('[data-gr-act="mark-phase"]');
    const commit = bar.querySelector('[data-gr-act="commit-next-step"]');
    const clear = bar.querySelector('[data-gr-act="clear-day"]');
    if(phase === 'day'){
      if(mark) mark.textContent = 'Mark Midday Check-In Complete';
      if(commit) commit.hidden = false;
    } else {
      if(mark) mark.textContent = phase === 'morning' ? 'Mark Morning Complete' : 'Mark Evening Complete';
      if(commit) commit.hidden = true;
    }
    if(clear) clear.hidden = false;
  }

  function refreshDuringDayUI(){
    if(typeof dailyPhase !== 'string' || dailyPhase !== 'day') return;
    const main = document.getElementById('dailyMain');
    if(!main) return;
    main.innerHTML = renderDuringDayDashboard();
    populateFields?.(main, dayData);
  }

  function findHabitRow(key){
    const rows = H().getHabitRows?.() || [];
    return rows.find(r=> habitKey(r) === key);
  }

  async function handleDayHabitCheck(key, checked){
    const row = findHabitRow(key);
    if(!row) return;
    if(row.type === 'stew'){
      if(checked && !H().habitRowDone?.(row)) await H().toggleStewHabit?.(row.stewId);
      else if(!checked && H().habitRowDone?.(row)) await H().toggleStewHabit?.(row.stewId);
    } else if(checked && !H().habitRowDone?.(row)){
      await H().markAnchorKept?.(row.id);
    }
    refreshDuringDayUI();
    markDirty?.();
  }

  function applyMustDoAction(id, action){
    const it = (H().getNonNegItems?.() || []).find(x=> x.id === id);
    if(!it) return;
    it.middayAction = action;
    if(action === 'done'){ it.done = true; it.middayStatus = 'complete'; }
    else if(action === 'keep'){ it.middayStatus = 'onTrack'; it.released = false; }
    else if(action === 'later'){ it.middayStatus = 'rescheduled'; it.rescheduledTo = 'later'; }
    else if(action === 'reduce'){
      it.middayStatus = 'reduced';
      if(!it.originalText) it.originalText = it.text;
    }
    markDirty?.();
    refreshDuringDayUI();
  }

  function applyReduceText(id, text){
    const it = (H().getNonNegItems?.() || []).find(x=> x.id === id);
    if(!it) return;
    if(!it.originalText) it.originalText = it.text;
    it.reducedText = text;
    it.middayStatus = 'reduced';
    markDirty?.();
  }

  function commitNextStep(){
    ensureDayCheckIn();
    const inp = document.getElementById('ddNextStepInput');
    if(inp) dayData.dayCheckIn.nextStep = inp.value.trim();
    if(!dayData.dayCheckIn.nextStep?.trim()) return;
    dayData.dayCheckIn.nextStepCommitted = true;
    markDirty?.();
    refreshDuringDayUI();
  }

  function bindMiddayEvents(){
    if(document.body.dataset.middayBound) return;
    document.body.dataset.middayBound = '1';
    const app = document.getElementById('app');

    app.addEventListener('click', async e=>{
      if(!isDaily?.() || (typeof isSaturdayRecovery === 'function' && isSaturdayRecovery())) return;
      if(typeof dailyPhase !== 'string' || dailyPhase !== 'day') return;

      const align = e.target.closest('[data-dd-alignment]');
      if(align){
        ensureDayCheckIn();
        dayData.dayCheckIn.alignment = align.dataset.ddAlignment;
        markDirty?.();
        refreshDuringDayUI();
        return;
      }

      const changed = e.target.closest('[data-dd-changed]');
      if(changed){
        ensureDayCheckIn();
        const id = changed.dataset.ddChanged;
        const arr = dayData.dayCheckIn.audible.whatChanged || [];
        const i = arr.indexOf(id);
        if(i >= 0) arr.splice(i, 1); else arr.push(id);
        dayData.dayCheckIn.audible.whatChanged = arr;
        markDirty?.();
        refreshDuringDayUI();
        return;
      }

      const audible = e.target.closest('[data-dd-audible]');
      if(audible){
        ensureDayCheckIn();
        dayData.dayCheckIn.audible.adjustment = audible.dataset.ddAudible;
        markDirty?.();
        refreshDuringDayUI();
        return;
      }

      const fPull = e.target.closest('[data-dd-friction-pull]');
      if(fPull){
        ensureDayCheckIn();
        const l = fPull.dataset.ddFrictionPull;
        const arr = dayData.dayCheckIn.friction.pull || [];
        const i = arr.indexOf(l);
        if(i >= 0) arr.splice(i, 1); else arr.push(l);
        dayData.dayCheckIn.friction.pull = arr;
        markDirty?.();
        refreshDuringDayUI();
        return;
      }

      const fSup = e.target.closest('[data-dd-friction-support]');
      if(fSup){
        ensureDayCheckIn();
        const l = fSup.dataset.ddFrictionSupport;
        dayData.dayCheckIn.friction.support = dayData.dayCheckIn.friction.support === l ? '' : l;
        markDirty?.();
        refreshDuringDayUI();
        return;
      }

      const hDisp = e.target.closest('[data-dd-habit-disposition]');
      if(hDisp){
        ensureDayCheckIn();
        const key = hDisp.dataset.ddHabitKey;
        if(!dayData.dayCheckIn.habits[key]) dayData.dayCheckIn.habits[key] = {};
        dayData.dayCheckIn.habits[key].disposition = hDisp.dataset.ddHabitDisposition;
        if(hDisp.dataset.ddHabitDisposition === 'released'){
          dayData.dayCheckIn.habits[key].released = true;
        }
        markDirty?.();
        refreshDuringDayUI();
        return;
      }

      const mustAct = e.target.closest('[data-dd-must-act]');
      if(mustAct){
        applyMustDoAction(mustAct.dataset.ddMustId, mustAct.dataset.ddMustAct);
        return;
      }

      const hCheck = e.target.closest('[data-dd-day-habit-check]');
      if(hCheck){
        e.preventDefault();
        await handleDayHabitCheck(hCheck.dataset.ddDayHabitCheck, hCheck.checked);
        return;
      }

      if(e.target.closest('[data-dd-commit-step]')){
        commitNextStep();
        return;
      }

      const grAct = e.target.closest('[data-gr-act="commit-next-step"]');
      if(grAct && document.getElementById('dailyStickyBar')?.contains(grAct)){
        commitNextStep();
        return;
      }

      if(e.target.closest('[data-dd-quick-add]')){
        const aimInp = document.querySelector('[data-field="posture.aim"]');
        if(aimInp?.value?.trim()) setNested?.(dayData, 'posture.aim', aimInp.value.trim());
        const md = document.getElementById('ddQuickMustDo')?.value?.trim();
        if(md) H().addNonNeg?.(md);
        markDirty?.();
        refreshDuringDayUI();
        return;
      }
    });

    app.addEventListener('change', e=>{
      if(!isDaily?.() || dailyPhase !== 'day') return;
      const mc = e.target.closest('[data-dd-must-check]');
      if(mc){
        const it = (H().getNonNegItems?.() || []).find(x=> x.id === mc.dataset.ddMustCheck);
        if(it && !it.released){
          it.done = mc.checked;
          if(window.faithStore){
            const task = window.faithStore.findTaskByLegacyMustDo(it.id, H().dateStr?.());
            if(task) window.faithStore.updateTask(task.id, { completed: !!it.done, completedAt: it.done ? new Date().toISOString() : null });
            window.faithStore.save();
          }
          markDirty?.();
          refreshDuringDayUI();
        }
      }
    });

    app.addEventListener('input', e=>{
      if(!isDaily?.() || dailyPhase !== 'day') return;
      const red = e.target.closest('[data-dd-reduce-text]');
      if(red){
        applyReduceText(red.dataset.ddReduceText, red.value);
      }
      if(e.target.dataset?.field === 'dayCheckIn.nextStep'){
        ensureDayCheckIn();
        dayData.dayCheckIn.nextStep = e.target.value;
        dayData.dayCheckIn.nextStepCommitted = false;
        markDirty?.();
      }
    });
  }

  root.renderDuringDayDashboard = renderDuringDayDashboard;
  root.renderDaySidebar = renderDaySidebar;
  root.refreshDuringDayUI = refreshDuringDayUI;
  root.syncDayActionBar = syncDayActionBar;
  root.ensureDayCheckIn = ensureDayCheckIn;
  root.bindMiddayEvents = bindMiddayEvents;
  root.commitNextStep = commitNextStep;

})(typeof window !== 'undefined' ? window : globalThis);
