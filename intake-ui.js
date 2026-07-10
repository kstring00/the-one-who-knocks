/**
 * Begin the Day — guided morning intake.
 *
 * A calm, hand-holding sequence (under 2 minutes) that composes the day:
 * Welcome → Focus → Big Three → The Shelf → Send-off.
 * On the user's configured rest day: Welcome → rest line → Send-off.
 *
 * Everything writes into EXISTING stores:
 *  - today's fs-day record (focus)
 *  - faithStore + faithfulFew.mustDo (Big Three priorities with slots/durations)
 *  - StewStore (shelf blocks as calendar events, templates)
 *  - globals.myWeek (recurring rhythm offers) and globals.intake (launch state, prefs)
 */
(function(root){
  'use strict';

  /* ── all user-facing copy lives here ─────────────────────────── */
  const COPY = {
    verses: [
      ['Whatever you do, do it from the heart, as something done for the Lord.', 'Colossians 3:23'],
      ['Whoever is faithful in very little is also faithful in much.', 'Luke 16:10'],
      ['Seek first the kingdom of God and His righteousness.', 'Matthew 6:33'],
      ['Do not despise these small beginnings, for the Lord rejoices to see the work begin.', 'Zechariah 4:10'],
      ['Teach us to number our days, that we may gain a heart of wisdom.', 'Psalm 90:12'],
      ['His mercies never come to an end; they are new every morning.', 'Lamentations 3:22–23'],
      ['This is the day the Lord has made; let us rejoice and be glad in it.', 'Psalm 118:24'],
      ['Commit your work to the Lord, and your plans will be established.', 'Proverbs 16:3'],
      ['In the morning, Lord, you hear my voice; in the morning I lay my requests before you.', 'Psalm 5:3'],
      ['Be still, and know that I am God.', 'Psalm 46:10']
    ],
    skipAll: 'Skip to dashboard',
    skipStep: 'Skip this step',
    back: 'Back',
    welcome: {
      greeting: 'Good morning',
      begin: 'Begin'
    },
    firstFruits: {
      title: 'First things first.',
      question: 'Have you spent time with God yet?',
      done: 'Done',
      doneSub: 'Already spent time with Him',
      now: 'Doing it now',
      nowSub: 'A quiet 10 minutes, starting here',
      later: 'I’ll come back',
      laterSub: 'It stays open — no rush',
      timerDone: 'Done — time with God kept',
      timerHint: 'No hurry. This timer is a room, not a race.'
    },
    focus: {
      title: 'Focus of the day',
      why: 'A day without a focus gets spent by whoever asks loudest.\nNaming one thing decides in advance what today is for.',
      placeholder: 'One word or a short phrase…',
      suggestions: 'Or borrow one:',
      cont: 'Continue'
    },
    bigThree: {
      title: 'Today’s Big Three',
      sub: 'Choose up to three. Not a brainstorm — a decision.',
      suggested: 'Waiting for you:',
      typePlaceholder: 'Or type a new task — Enter to add',
      full: 'Three is enough. Release one to add another.',
      showIdeas: 'Show ideas',
      cont: 'Place them on the day'
    },
    shelf: {
      title: 'The Shelf',
      sub: 'Blocks you can set onto today. Drag to a slot, or tap to add.',
      templates: 'Your templates',
      common: 'Common blocks',
      rhythmOffer: 'you’ve reached for this twice this week. Make it part of your weekly rhythm?',
      rhythmYes: 'Yes, add weekly',
      rhythmNo: 'Not now',
      cont: 'Looks right'
    },
    soul: {
      title: 'How are you coming into today?',
      options: [
        ['strong', 'Strong'],
        ['steady', 'Steady'],
        ['tired', 'Tired'],
        ['heavy', 'Heavy']
      ]
    },
    rest: {
      line: 'It’s a rest day. Nothing to plan.',
      sub: 'The work will keep. Ceasing is also faithfulness.'
    },
    sendoff: {
      title: 'The day is composed.',
      begin: 'Begin the day',
      empty: 'A light day. Walk it faithfully.'
    },
    chip: 'Begin the day →'
  };

  const SLOTS = [
    ['beforeWork', 'Before Work'],
    ['duringWork', 'During Work'],
    ['afterWork', 'After Work'],
    ['eveningShutdown', 'Evening']
  ];
  const SLOT_LABEL = Object.fromEntries(SLOTS);
  const SLOT_START = { beforeWork: 6*60+30, duringWork: 9*60, afterWork: 17*60, eveningShutdown: 20*60 };
  const SLOT_END   = { beforeWork: 9*60, duringWork: 17*60, afterWork: 20*60, eveningShutdown: 22*60+30 };
  const DURATIONS = [[15,'15m'],[30,'30m'],[60,'1h'],[90,'1h 30m'],[120,'2h']];

  const COMMON_BLOCKS = [
    { id:'cb-prayer',    title:'Morning prayer',     min:20, category:'spiritual',     slot:'beforeWork',      why:'Beginning with God orders all that follows.', refs:'Ps 5:3' },
    { id:'cb-bible',     title:'Bible reading',      min:20, category:'spiritual',     slot:'beforeWork',      why:'A little daily input shapes a whole life.', refs:'Ps 119:105' },
    { id:'cb-workout',   title:'Workout',            min:60, category:'health',        slot:'afterWork',       why:'Movement lifts mood, focus, and sleep.', refs:'1 Cor 6:19' },
    { id:'cb-mealprep',  title:'Meal prep',          min:45, category:'personal',      slot:'eveningShutdown', why:'Deciding ahead protects tomorrow’s willpower.', refs:'Prov 21:5' },
    { id:'cb-commute',   title:'Commute',            min:30, category:'admin',         slot:'beforeWork',      why:'Guard the edges of the day with intention.', refs:'Eph 5:15-16' },
    { id:'cb-deepwork',  title:'Deep work',          min:90, category:'deepwork',      slot:'duringWork',      why:'Focused effort compounds; distraction scatters.', refs:'Col 3:23' },
    { id:'cb-admin',     title:'Admin / email hour', min:60, category:'admin',         slot:'duringWork',      why:'Batching small tasks frees the mind.', refs:'1 Cor 14:40' },
    { id:'cb-family',    title:'Family time',        min:60, category:'relationships', slot:'eveningShutdown', why:'Presence with people is never wasted.', refs:'Ps 127:3-5' },
    { id:'cb-rest',      title:'Rest',               min:45, category:'rest',          slot:'afterWork',       why:'Recovery makes work sustainable, not lazy.', refs:'Mark 6:31' },
    { id:'cb-budget',    title:'Budget check',       min:30, category:'admin',         slot:'eveningShutdown', why:'What gets watched gets stewarded.', refs:'Prov 27:23' },
    { id:'cb-journal',   title:'Journal',            min:15, category:'spiritual',     slot:'eveningShutdown', why:'Naming thoughts on paper lightens the load.', refs:'Phil 4:6' },
    { id:'cb-reflect',   title:'Evening reflection', min:15, category:'spiritual',     slot:'eveningShutdown', why:'Reviewing the day turns experience into wisdom.', refs:'Ps 90:12' },
    { id:'cb-mentor',    title:'Call a mentor',      min:30, category:'leadership',    slot:'afterWork',       why:'Wise counsel multiplies good decisions.', refs:'Prov 15:22' },
    { id:'cb-study',     title:'Study session',      min:60, category:'learning',      slot:'eveningShutdown', why:'Consistent learning compounds into mastery.', refs:'Prov 9:9' }
  ];

  /* ── starter Big-Three ideas for brand-new users (edit freely) ──
     Shown only when the user's own tasks/projects yield fewer than 4
     suggestions. The "why" is intake-only — it never follows the task
     into the day view. Slots are defaults; every pick stays editable. */
  const STARTERS = [
    { id:'st-quiet',   title:'Spend 10 quiet minutes with God',        min:15, slot:'beforeWork',      why:'Starting with stillness lowers stress and sets the day’s tone.', refs:'Ps 46:10; Mark 1:35' },
    { id:'st-move',    title:'Move your body — a walk counts',          min:30, slot:'afterWork',       why:'Exercise reliably lifts mood, focus, and sleep.',               refs:'1 Cor 6:19' },
    { id:'st-avoid',   title:'Do the one task you keep avoiding',       min:30, slot:'duringWork',      why:'Finishing what we dread frees more energy than it takes.',      refs:'Col 3:23' },
    { id:'st-braindump',title:'Write down what’s on your mind',         min:15, slot:'duringWork',      why:'Externalizing thoughts reduces mental load and worry.',         refs:'Phil 4:6; 1 Pet 5:7' },
    { id:'st-reach',   title:'Reach out to someone who matters',        min:15, slot:'afterWork',       why:'Strong relationships are the best predictor of wellbeing.',     refs:'Ecc 4:9-10; Heb 10:24-25' },
    { id:'st-prep',    title:'Prepare tomorrow’s food or clothes tonight',min:30, slot:'eveningShutdown',why:'Deciding in advance protects willpower for what matters.',      refs:'Prov 21:5; 6:6-8' },
    { id:'st-tidy',    title:'Tidy one small space',                    min:15, slot:'duringWork',      why:'Order in one corner quiets the whole mind.',                    refs:'1 Cor 14:40' },
    { id:'st-money',   title:'Look at your money honestly',             min:15, slot:'eveningShutdown', why:'What gets watched gets stewarded.',                             refs:'Prov 27:23-24; Luke 14:28' },
    { id:'st-read',    title:'Read something that grows you',           min:30, slot:'afterWork',       why:'Small consistent input compounds into wisdom.',                 refs:'Prov 9:9' },
    { id:'st-rest',    title:'Rest — actually rest',                    min:60, slot:'eveningShutdown', why:'Rest is commanded, not earned; recovery makes work last.',      refs:'Ex 20:8-10; Mark 6:31' },
    { id:'st-thank',   title:'Thank someone specifically',             min:15, slot:'afterWork',       why:'Practiced gratitude lifts mood and deepens relationships.',     refs:'1 Thess 5:18' },
    { id:'st-plan',    title:'Plan your top task for tomorrow',         min:15, slot:'eveningShutdown', why:'Ending with a plan reduces night worry and speeds tomorrow.',   refs:'Prov 16:3, 9' }
  ];

  /* ── state ───────────────────────────────────────────────────── */
  let st = null;      // { steps, i, ff, focus, picks, shelfAdds, soul, timer, offer }
  let timerHandle = null;

  function esc(s){ return typeof root.esc === 'function' ? root.esc(s) : String(s ?? ''); }
  function iso(d){ return d.toISOString().slice(0,10); }
  function todayStr(off){ const d = new Date(); d.setDate(d.getDate()+(off||0)); d.setHours(12,0,0,0); return iso(d); }
  function fmtTime(m){
    const h = Math.floor(m/60), min = m%60, ap = h>=12?'PM':'AM', h12 = h%12||12;
    return h12+(min?':'+String(min).padStart(2,'0'):'')+' '+ap;
  }
  function minsToInput(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  function fmtDur(min){ const h=Math.floor(min/60), m=min%60; return (h?h+'h':'')+(h&&m?' ':'')+(m?m+'m':''); }
  function S(){ return root.StewStore; }
  function fs(){ return root.faithStore; }
  function reduced(){ return matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function ensureIntake(){
    const g = root.globals;
    if(!g) return null;
    if(!g.intake || typeof g.intake !== 'object') g.intake = {};
    const it = g.intake;
    if(typeof it.restDay !== 'number') it.restDay = 0;   // Sunday
    if(!it.blockUse || typeof it.blockUse !== 'object') it.blockUse = {};
    if(!Array.isArray(it.hiddenBlocks)) it.hiddenBlocks = [];
    if(!Array.isArray(it.offeredRhythm)) it.offeredRhythm = [];
    return it;
  }
  function profileName(){
    if(typeof root.normalizeProfile === 'function' && root.userProfile){
      const p = root.normalizeProfile(root.userProfile);
      if(p?.name?.trim()) return p.name.trim();
    }
    if(root.userProfile?.name?.trim()) return root.userProfile.name.trim();
    try{
      const raw = localStorage.getItem('wsr:fs-profile') || localStorage.getItem('fs-profile');
      const p = raw ? JSON.parse(raw) : null;
      if(p?.name?.trim()) return p.name.trim();
    }catch(e){}
    return '';
  }
  function intakeSeenToday(){
    const it = ensureIntake();
    if(!it) return false;
    const today = todayStr();
    return it.lastDate === today || it.lastCompletedDate === today;
  }
  function verseForToday(){
    const n = todayStr().split('-').reduce((a,b)=>a+parseInt(b,10),0);
    return COPY.verses[n % COPY.verses.length];
  }
  function isRestDay(){
    const it = ensureIntake();
    return it && it.restDay >= 0 && new Date().getDay() === it.restDay;
  }
  function markDirty(){ root.markDirty?.(); }

  /* ── day record helpers (fs-day, existing structure) ─────────── */
  async function getToday(){
    let day = await root.getDayDataByDate(todayStr());
    if(typeof root.normalizeDaily === 'function') day = root.normalizeDaily(day);
    return day;
  }
  async function saveToday(day){
    await root.saveDayDataByDate(todayStr(), day);
    // If the Daily view is open its in-memory copy is now stale and the next
    // autosave would clobber this write — reload it from storage first.
    if(root.isDaily?.()){ try{ await root.loadDaily?.(); }catch(e){} }
    markDirty();
  }

  /* ── First Fruits ────────────────────────────────────────────── */
  function ffAnchors(){
    const f = fs();
    if(!f) return [];
    f.ensureDailyAnchors(todayStr());
    return f.getAnchorTasksForDate(todayStr());
  }
  function ffDone(){
    const a = ffAnchors();
    return a.length > 0 && a.every(t=>t.completed);
  }
  async function completeFirstFruits(){
    const f = fs();
    if(!f) return;
    ffAnchors().forEach(t=>{ if(!t.completed) f.updateTask(t.id, { completed:true, completedAt:new Date().toISOString() }); });
    await f.save();
    markDirty();
  }

  /* ── Big Three commit (dashboard/day-view structures) ────────── */
  async function commitBigThree(picks){
    const f = fs();
    if(!f || !picks.length) return;
    const dateStr = todayStr();
    f.ensureDailyAnchors(dateStr);
    const day = await getToday();
    if(!day.faithfulFew.mustDo.items) day.faithfulFew.mustDo.items = [];
    picks.forEach(p=>{
      const mustDoId = (typeof root.uid === 'function' ? root.uid() : 'id-'+Math.random().toString(36).slice(2));
      day.faithfulFew.mustDo.items.push({ id: mustDoId, text: p.title, done:false });
      f.createTask({ title: p.title, date: dateStr, tag:'stewardship', timeSlot: p.slot,
        durationMin: p.min, legacyMustDoId: mustDoId });
      // keep the calendar's Big Three card in agreement when the pick came from the task inbox
      if(p.stewTaskId && S()){
        S().updateTask(p.stewTaskId, { urgency:'today', dueDate:dateStr });
        S().toggleBigThree(dateStr, p.stewTaskId);
      }
    });
    await f.save();
    await saveToday(day);
  }

  /* ── Shelf commit (stew calendar events) ─────────────────────── */
  function nextStartInSlot(slot, min){
    const start = SLOT_START[slot], end = SLOT_END[slot];
    if(!S()) return start;
    const evs = S().eventsForDate(todayStr()).filter(e=>e.startMin >= start && e.startMin < end)
      .sort((a,b)=>a.startMin-b.startMin);
    let t = start;
    for(const e of evs){ if(e.startMin >= t + min) break; t = Math.max(t, e.endMin); }
    return Math.min(t, end - min);
  }
  function addShelfBlock(entry, slot){
    if(!S()) return null;
    const useSlot = slot || entry.slot;
    const start = nextStartInSlot(useSlot, entry.min);
    let ev;
    if(entry.templateId){
      ev = S().createEventFromTemplate(entry.templateId, todayStr(), start);
    } else {
      ev = S().createEvent({ title: entry.title, date: todayStr(), startMin: start,
        endMin: start + entry.min, category: entry.category || 'personal' });
    }
    if(ev && entry.commonId) trackCommonUse(entry.commonId);
    return ev;
  }
  function trackCommonUse(id){
    const it = ensureIntake();
    if(!it) return;
    const use = it.blockUse[id] = (it.blockUse[id]||[]).filter(d=>d >= todayStr(-7));
    if(!use.includes(todayStr())) use.push(todayStr());
    markDirty();
    if(use.length >= 2 && !it.offeredRhythm.includes(id)){
      const cb = COMMON_BLOCKS.find(b=>b.id===id);
      if(cb && st) st.offer = cb;
    }
  }
  function acceptRhythm(cb){
    const it = ensureIntake();
    root.ensureMyWeek?.();
    const dow = new Date().getDay();
    const start = SLOT_START[cb.slot];
    root.globals.myWeek[dow].push({ label: cb.title, start: minsToInput(start), end: minsToInput(start+cb.min) });
    it.offeredRhythm.push(cb.id);
    markDirty();
  }

  /* ── step machine ────────────────────────────────────────────── */
  function stepsFor(){
    return isRestDay()
      ? ['welcome','restline','sendoff']
      : ['welcome','focus','bigthree','shelf','sendoff'];
  }
  function launchIntake(manual){
    const it = ensureIntake();
    if(!it) return;
    it.lastDate = todayStr();
    if(!manual) markDirty();
    st = { steps: stepsFor(), i: 0, ff: null, focus: '', picks: [], shelfAdds: [], soul: null,
      timerEnd: 0, offer: null, suggestions: null };
    document.body.classList.add('intake-open');
    const ov = document.getElementById('intakeOverlay');
    if(!ov) return;
    ov.hidden = false;
    renderStep(true);
  }
  function maybeLaunchIntake(){
    const it = ensureIntake();
    if(!it) return;
    if(intakeSeenToday()) return;
    if(root.isGuide?.()) return;
    launchIntake(false);
  }
  function closeIntake(goDashboard){
    clearInterval(timerHandle); timerHandle = null;
    const it = ensureIntake();
    if(it) it.lastDate = todayStr();
    markDirty();
    st = null;
    const ov = document.getElementById('intakeOverlay');
    if(ov){ ov.hidden = true; ov.innerHTML = ''; }
    document.body.classList.remove('intake-open');
    if(goDashboard && typeof root.setMode === 'function') root.setMode('dashboard');
    root.updateDashIntakeUI?.();
  }
  function completedToday(){
    return ensureIntake()?.lastCompletedDate === todayStr();
  }
  function advance(n){
    clearInterval(timerHandle); timerHandle = null;
    st.i = Math.min(st.steps.length-1, st.i + (n||1));
    renderStep();
  }
  function goBack(){
    clearInterval(timerHandle); timerHandle = null;
    if(st.i > 0){ st.i--; renderStep(); }
  }
  async function finishIntake(){
    const it = ensureIntake();
    it.lastCompletedDate = todayStr();
    markDirty();
    closeIntake(true);
  }

  /* ── rendering ───────────────────────────────────────────────── */
  function frame(inner, opts){
    const step = st.steps[st.i];
    const dots = st.steps.map((s,idx)=>'<span class="intake-dot'+(idx===st.i?' on':'')+(idx<st.i?' past':'')+'"></span>').join('');
    return '<div class="intake-scene'+(step==='welcome'?' daybreak':'')+'">'+
      '<div class="intake-top">'+
      (st.i>0 ? '<button type="button" class="intake-quiet" data-in="back">‹ '+COPY.back+'</button>' : '<span></span>')+
      '<div class="intake-dots" aria-hidden="true">'+dots+'</div>'+
      '<button type="button" class="intake-quiet" data-in="skip-all">'+COPY.skipAll+'</button>'+
      '</div>'+
      '<div class="intake-step" id="intakeStep">'+inner+'</div>'+
      ((opts?.skippable!==false && step!=='welcome' && step!=='sendoff')
        ? '<button type="button" class="intake-quiet intake-skip-step" data-in="skip-step">'+COPY.skipStep+'</button>' : '')+
      '</div>';
  }
  function renderStep(first){
    const ov = document.getElementById('intakeOverlay');
    if(!ov || !st) return;
    const step = st.steps[st.i];
    const html = ({
      welcome: renderWelcome, firstfruits: renderFF, focus: renderFocus,
      bigthree: renderBigThree, shelf: renderShelf, soul: renderSoul,
      restline: renderRestLine, sendoff: renderSendoff
    })[step]();
    ov.innerHTML = frame(html, { });
    const el = ov.querySelector('#intakeStep');
    if(el && !reduced()){
      el.classList.add('enter');
      requestAnimationFrame(()=> requestAnimationFrame(()=> el.classList.remove('enter')));
    }
    if(step==='focus') ov.querySelector('#intakeFocusInput')?.focus();
    if(step==='firstfruits' && st.ff==='now') startTimer();
  }

  function renderWelcome(){
    const name = profileName();
    const v = verseForToday();
    const dateLine = new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' });
    const greet = name ? COPY.welcome.greeting+', '+esc(name) : COPY.welcome.greeting;
    return '<div class="intake-center">'+
      '<h1 class="intake-h serif">'+greet+'</h1>'+
      '<p class="intake-date">'+dateLine+'</p>'+
      '<p class="intake-verse serif">“'+esc(v[0])+'”<cite>'+esc(v[1])+'</cite></p>'+
      '<button type="button" class="intake-btn-primary" data-in="next">'+COPY.welcome.begin+'</button>'+
      '</div>';
  }

  function renderFF(){
    if(st.ff==='now') return renderTimer();
    return '<div class="intake-center">'+
      '<h2 class="intake-h serif">'+COPY.firstFruits.title+'</h2>'+
      '<p class="intake-sub">'+COPY.firstFruits.question+'</p>'+
      '<div class="intake-choices">'+
      '<button type="button" class="intake-choice" data-in="ff-done"><strong>'+COPY.firstFruits.done+'</strong><span>'+COPY.firstFruits.doneSub+'</span></button>'+
      '<button type="button" class="intake-choice" data-in="ff-now"><strong>'+COPY.firstFruits.now+'</strong><span>'+COPY.firstFruits.nowSub+'</span></button>'+
      '<button type="button" class="intake-choice" data-in="ff-later"><strong>'+COPY.firstFruits.later+'</strong><span>'+COPY.firstFruits.laterSub+'</span></button>'+
      '</div></div>';
  }
  function renderTimer(){
    const v = verseForToday();
    return '<div class="intake-center">'+
      '<div class="intake-timer serif" id="intakeTimer">10:00</div>'+
      '<p class="intake-verse serif">“'+esc(v[0])+'”<cite>'+esc(v[1])+'</cite></p>'+
      '<p class="intake-hint">'+COPY.firstFruits.timerHint+'</p>'+
      '<button type="button" class="intake-btn-primary" data-in="ff-timer-done">'+COPY.firstFruits.timerDone+'</button>'+
      '</div>';
  }
  function startTimer(){
    if(!st.timerEnd) st.timerEnd = Date.now() + 10*60*1000;
    clearInterval(timerHandle);
    const tick = ()=>{
      const el = document.getElementById('intakeTimer');
      if(!el){ clearInterval(timerHandle); return; }
      const left = Math.max(0, st.timerEnd - Date.now());
      const m = Math.floor(left/60000), s = Math.floor(left%60000/1000);
      el.textContent = m+':'+String(s).padStart(2,'0');
      if(left <= 0) clearInterval(timerHandle);
    };
    tick();
    timerHandle = setInterval(tick, 1000);
  }

  function focusSuggestions(){
    if(st.suggestions) return st.suggestions;
    const out = [];
    (S()?.getGoals()||[]).slice(0,3).forEach(g=>{
      if(g.title?.trim()) out.push(g.title.trim());
    });
    st.suggestions = out.slice(0,3);
    root.getDayDataByDate?.(todayStr(-1)).then(day=>{
      const yFocus = day?.focus?.trim();
      if(yFocus && !st.suggestions.includes(yFocus)){
        st.suggestions.push(yFocus);
        st.suggestions = st.suggestions.slice(0,3);
        if(st.steps[st.i]==='focus') renderStep();
      }
    }).catch(()=>{});
    root.getJSON?.(root.weekKeyFor?.(0)).then(w=>{
      const line = (w?.planWeek?.top3||'').split('\n').map(s=>s.trim()).filter(Boolean)[0];
      if(line && !st.suggestions.includes(line)){
        st.suggestions.push(line);
        st.suggestions = st.suggestions.slice(0,3);
        if(st.steps[st.i]==='focus') renderStep();
      }
    }).catch(()=>{});
    return st.suggestions;
  }
  function renderFocus(){
    const sugg = focusSuggestions();
    return '<div class="intake-center">'+
      '<h2 class="intake-h serif">'+COPY.focus.title+'</h2>'+
      '<p class="intake-why">'+COPY.focus.why.replace(/\n/g,'<br>')+'</p>'+
      '<input type="text" class="intake-focus-input serif" id="intakeFocusInput" maxlength="60" '+
      'value="'+esc(st.focus)+'" placeholder="'+COPY.focus.placeholder+'" aria-label="Today’s focus">'+
      (sugg.length ? '<p class="intake-hint">'+COPY.focus.suggestions+'</p>'+
        '<div class="intake-chip-row">'+sugg.map(s=>
          '<button type="button" class="intake-chip" data-in="focus-sugg" data-v="'+esc(s)+'">'+esc(s)+'</button>').join('')+'</div>' : '')+
      '<button type="button" class="intake-btn-primary" data-in="focus-set">'+COPY.focus.cont+'</button>'+
      '</div>';
  }

  // The user's OWN Big-Three candidates: yesterday's unfinished, the task
  // inbox, and project tasks. Cached on st.b3own for the session.
  async function bigThreeOwn(){
    if(st.b3own) return st.b3own;
    const out = [];
    try{
      const yday = await root.getDayDataByDate(todayStr(-1));
      (yday?.faithfulFew?.mustDo?.items||[]).filter(it=>!it.done && !it.released && it.text)
        .slice(0,3).forEach(it=> out.push({ title: it.text, source:'Yesterday, unfinished' }));
    }catch(e){}
    (S()?.overflowTasks()||[]).slice(0,4).forEach(t=>
      out.push({ title: t.title, source:'Task Shelf', stewTaskId: t.id, min: t.durationMin||undefined }));
    (S()?.getTasks({status:'todo'})||[]).filter(t=>t.projectId && !out.some(o=>o.stewTaskId===t.id))
      .slice(0,3).forEach(t=> out.push({ title: t.title, source: S().getProject(t.projectId)?.title || 'Project', stewTaskId: t.id, min: t.durationMin||undefined }));
    st.b3own = out.slice(0,8);
    return st.b3own;
  }
  // Rotate the starter library day-to-day so the list stays fresh.
  function rotatedStarters(){
    const seed = todayStr().split('-').reduce((a,b)=>a+parseInt(b,10),0);
    const off = seed % STARTERS.length;
    return STARTERS.slice(off).concat(STARTERS.slice(0, off));
  }
  // Blend own suggestions with starters. Starters fill the gap up to 5 when
  // the user has fewer than 4 of their own; once they have enough, starters
  // step aside until asked for via "show ideas".
  function b3SuggestionList(){
    const own = st.b3own || [];
    const enoughOwn = own.length >= 4;
    const showStarters = !enoughOwn || st.showStarters;
    let starters = [];
    if(showStarters){
      const count = enoughOwn ? 5 : Math.max(0, 5 - own.length);
      const ownTitles = new Set(own.map(o=>String(o.title).toLowerCase()));
      starters = rotatedStarters()
        .filter(s=>!ownTitles.has(s.title.toLowerCase()))
        .slice(0, count)
        .map(s=>({ title:s.title, min:s.min, slot:s.slot, why:s.why, refs:s.refs, starter:true }));
    }
    return { own, starters, enoughOwn };
  }
  function b3Remaining(){
    const { own, starters } = b3SuggestionList();
    return own.concat(starters).filter(sg=>!st.picks.some(p=>p.title===sg.title));
  }
  function renderBigThree(){
    if(!st.b3own) bigThreeOwn().then(()=>{ if(st && st.steps[st.i]==='bigthree') renderStep(); });
    const { enoughOwn } = b3SuggestionList();
    const remaining = b3Remaining();
    const full = st.picks.length >= 3;
    const pickRows = st.picks.map((p,idx)=>
      '<div class="intake-pick" data-idx="'+idx+'">'+
      '<span class="intake-pick-num">'+(idx+1)+'</span>'+
      '<span class="intake-pick-title">'+esc(p.title)+'</span>'+
      '<button type="button" class="intake-mini" data-in="pick-dur" data-idx="'+idx+'">'+fmtDur(p.min)+'</button>'+
      '<button type="button" class="intake-mini" data-in="pick-slot" data-idx="'+idx+'">'+SLOT_LABEL[p.slot]+'</button>'+
      '<button type="button" class="intake-x" data-in="pick-rm" data-idx="'+idx+'" aria-label="Remove">×</button>'+
      '</div>').join('');
    const suggHtml = remaining.length
      ? '<p class="intake-hint">'+COPY.bigThree.suggested+'</p>'+
        remaining.map((sg,i)=>{
          const sub = sg.starter ? (sg.why + (sg.refs ? ' ('+sg.refs+')' : '')) : sg.source;
          return '<button type="button" class="intake-sugg" data-in="b3-add" data-i="'+i+'"'+(full?' disabled':'')+'>'+
            '<span class="intake-sugg-title">'+esc(sg.title)+'</span>'+
            '<span class="intake-sugg-src">'+esc(sub)+'</span></button>';
        }).join('')
      : '';
    const showIdeasLink = (enoughOwn && !st.showStarters)
      ? '<button type="button" class="intake-quiet intake-show-ideas" data-in="b3-show-ideas">'+COPY.bigThree.showIdeas+'</button>'
      : '';
    return '<div class="intake-wide">'+
      '<h2 class="intake-h serif">'+COPY.bigThree.title+'</h2>'+
      '<p class="intake-sub">'+COPY.bigThree.sub+'</p>'+
      '<div class="intake-b3-grid">'+
      '<div class="intake-b3-left">'+
      suggHtml+
      '<input type="text" class="intake-type-input" id="intakeB3Input" placeholder="'+COPY.bigThree.typePlaceholder+'"'+(full?' disabled':'')+'>'+
      (full ? '<p class="intake-hint">'+COPY.bigThree.full+'</p>' : '')+
      showIdeasLink+
      '</div>'+
      '<div class="intake-agenda" id="intakeAgenda"><p class="intake-hint" style="margin-top:0">Today</p>'+
      (pickRows || '<p class="intake-empty">Your three will land here.</p>')+
      '</div></div>'+
      '<button type="button" class="intake-btn-primary" data-in="b3-done">'+COPY.bigThree.cont+'</button>'+
      '</div>';
  }
  function addPick(title, extra){
    if(st.picks.length >= 3 || !title.trim()) return;
    st.picks.push(Object.assign({ title: title.trim(), min: 30, slot: 'duringWork' }, extra||{}));
    renderStep();
    if(!reduced()){
      const rows = document.querySelectorAll('.intake-pick');
      rows[rows.length-1]?.classList.add('settle');
    }
  }

  function shelfEntries(){
    const it = ensureIntake();
    const tpls = (S()?.getTemplates()||[]).map(t=>({
      key:'tpl-'+t.id, templateId:t.id, title:t.title, min:t.endMin-t.startMin,
      category:t.category, slot: slotForMin(t.startMin) }));
    const commons = COMMON_BLOCKS.filter(b=>!it.hiddenBlocks.includes(b.id))
      .map(b=>({ key:b.id, commonId:b.id, title:b.title, min:b.min, category:b.category, slot:b.slot, why:b.why, refs:b.refs }));
    return { tpls, commons };
  }
  function slotForMin(m){
    if(m < SLOT_END.beforeWork) return 'beforeWork';
    if(m < SLOT_END.duringWork) return 'duringWork';
    if(m < SLOT_END.afterWork) return 'afterWork';
    return 'eveningShutdown';
  }
  function catColor(cat){
    const c = S()?.CATEGORIES.find(x=>x.id===cat);
    return c ? c.color : 'var(--gold)';
  }
  function shelfChip(e, group){
    const why = e.why ? esc(e.why + (e.refs ? ' ('+e.refs+')' : '')) : '';
    return '<button type="button" class="intake-shelf-chip" draggable="true" data-in="shelf-add" '+
      'data-key="'+esc(e.key)+'" data-group="'+group+'"'+(why?' title="'+why+'" data-why="'+why+'"':'')+' style="--cat:'+catColor(e.category)+'">'+
      '<span class="intake-shelf-dot"></span>'+esc(e.title)+
      '<span class="intake-shelf-dur">'+fmtDur(e.min)+'</span>'+
      (e.commonId ? '<span class="intake-hide-block" data-in="shelf-hide" data-key="'+e.key+'" title="Hide this block" aria-label="Hide '+esc(e.title)+'">×</span>' : '')+
      '</button>';
  }
  // Small tooltip for the block "why" on long-press (touch) — hover uses title.
  function showChipWhy(chip, text){
    let pop = document.getElementById('intakeWhyPop');
    if(!pop){ pop = document.createElement('div'); pop.id = 'intakeWhyPop'; pop.className = 'intake-why-pop'; document.body.appendChild(pop); }
    pop.textContent = text;
    const r = chip.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 248)) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';
    requestAnimationFrame(()=> pop.classList.add('show'));
    clearTimeout(pop._hideT);
    pop._hideT = setTimeout(()=> pop.classList.remove('show'), 2600);
  }
  function renderShelf(){
    const { tpls, commons } = shelfEntries();
    const slotsHtml = SLOTS.map(s=>{
      const items = st.shelfAdds.filter(a=>a.slot===s[0])
        .concat(st.picks.filter(p=>p.slot===s[0]).map(p=>({ title:p.title, min:p.min, pick:true })));
      return '<div class="intake-slot" data-slot="'+s[0]+'"><h4>'+s[1]+'</h4>'+
        (items.map(a=>'<div class="intake-slot-item'+(a.pick?' pick':'')+'" style="--cat:'+catColor(a.category||'personal')+'">'+
          esc(a.title)+' <span>'+fmtDur(a.min)+'</span>'+
          (a.pick?'':'<button type="button" class="intake-x" data-in="shelf-rm" data-ev="'+esc(a.eventId)+'" aria-label="Remove">×</button>')+
          '</div>').join('') || '<div class="intake-slot-empty">·</div>')+
        '</div>';
    }).join('');
    return '<div class="intake-wide">'+
      '<h2 class="intake-h serif">'+COPY.shelf.title+'</h2>'+
      '<p class="intake-sub">'+COPY.shelf.sub+'</p>'+
      (st.offer ? '<div class="intake-offer"><span>“'+esc(st.offer.title)+'” — '+COPY.shelf.rhythmOffer+'</span>'+
        '<button type="button" class="intake-mini" data-in="rhythm-yes">'+COPY.shelf.rhythmYes+'</button>'+
        '<button type="button" class="intake-quiet" data-in="rhythm-no">'+COPY.shelf.rhythmNo+'</button></div>' : '')+
      '<div class="intake-b3-grid">'+
      '<div class="intake-b3-left">'+
      (tpls.length ? '<p class="intake-hint">'+COPY.shelf.templates+'</p><div class="intake-shelf-tray">'+tpls.map(t=>shelfChip(t,'tpl')).join('')+'</div>' : '')+
      '<p class="intake-hint">'+COPY.shelf.common+'</p><div class="intake-shelf-tray">'+commons.map(c=>shelfChip(c,'common')).join('')+'</div>'+
      '</div>'+
      '<div class="intake-agenda intake-dropzone" id="intakeAgenda">'+slotsHtml+'</div>'+
      '</div>'+
      '<button type="button" class="intake-btn-primary" data-in="next">'+COPY.shelf.cont+'</button>'+
      '</div>';
  }

  function renderSoul(){
    return '<div class="intake-center">'+
      '<h2 class="intake-h serif">'+COPY.soul.title+'</h2>'+
      '<div class="intake-soul-row">'+COPY.soul.options.map(o=>
        '<button type="button" class="intake-choice intake-soul" data-in="soul" data-v="'+o[0]+'"><strong>'+o[1]+'</strong></button>').join('')+
      '</div></div>';
  }

  function renderRestLine(){
    return '<div class="intake-center">'+
      '<h2 class="intake-h serif">'+COPY.rest.line+'</h2>'+
      '<p class="intake-sub">'+COPY.rest.sub+'</p>'+
      '<button type="button" class="intake-btn-primary" data-in="next">Amen</button>'+
      '</div>';
  }

  function renderSendoff(){
    const pieces = [];
    if(st.focus) pieces.push('<div class="intake-so-focus serif settle-1">'+esc(st.focus)+'</div>');
    const slotRows = SLOTS.map(s=>{
      const items = st.picks.filter(p=>p.slot===s[0]).map(p=>'<strong>'+esc(p.title)+'</strong> · '+fmtDur(p.min))
        .concat(st.shelfAdds.filter(a=>a.slot===s[0]).map(a=>esc(a.title)+' · '+fmtDur(a.min)));
      if(!items.length) return '';
      return '<div class="intake-so-slot"><h4>'+s[1]+'</h4>'+items.map(x=>'<div class="intake-so-item">'+x+'</div>').join('')+'</div>';
    }).filter(Boolean).join('');
    pieces.push(slotRows ? '<div class="intake-so-timeline settle-2">'+slotRows+'</div>'
      : '<p class="intake-sub settle-2">'+COPY.sendoff.empty+'</p>');
    return '<div class="intake-center">'+
      '<h2 class="intake-h serif">'+COPY.sendoff.title+'</h2>'+
      '<div class="intake-so">'+pieces.join('')+'</div>'+
      '<button type="button" class="intake-btn-primary settle-3" data-in="finish">'+COPY.sendoff.begin+'</button>'+
      '</div>';
  }

  /* ── dashboard chip + focus banner ───────────────────────────── */
  async function updateDashIntakeUI(){
    const host = document.getElementById('dashFocus');
    if(!host) return;
    let html = '';
    try{
      const day = await root.getDayDataByDate(todayStr());
      if(day?.focus) html += '<div class="dash-focus-banner serif">Today: '+esc(day.focus)+'</div>';
    }catch(e){}
    if(!completedToday()) html += '<button type="button" class="dash-intake-chip" id="dashIntakeChip">'+COPY.chip+'</button>';
    host.innerHTML = html;
    document.getElementById('dashIntakeChip')?.addEventListener('click', ()=> launchIntake(true));
  }

  /* ── settings card ───────────────────────────────────────────── */
  function renderIntakeSettings(){
    const el = document.getElementById('intakeSettings');
    if(!el) return;
    const it = ensureIntake();
    if(!it) return;
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const profile = typeof root.normalizeProfile === 'function'
      ? root.normalizeProfile(root.userProfile)
      : (root.userProfile || {});
    el.innerHTML =
      '<label class="q" for="intakeNameInput">Your name (for the morning greeting)</label>'+
      '<input type="text" id="intakeNameInput" class="inp-sm" value="'+esc(profile.name||'')+'" placeholder="Optional">'+
      '<label class="q" for="intakeRestDay" style="margin-top:10px">Rest day (light morning intake)</label>'+
      '<select id="intakeRestDay" class="inp-sm">'+
      '<option value="-1"'+(it.restDay===-1?' selected':'')+'>No rest day</option>'+
      days.map((d,i)=>'<option value="'+i+'"'+(it.restDay===i?' selected':'')+'>'+d+'</option>').join('')+
      '</select>';
    document.getElementById('intakeNameInput')?.addEventListener('input', e=>{
      if(!root.userProfile){
        if(typeof root.blankProfile === 'function') root.userProfile = root.blankProfile();
        else root.userProfile = { name:'', about:'', faith:'', goals:['','',''], rhythm:'', nonNegotiables:[''], coaching:'' };
      }
      if(root.userProfile){
        root.userProfile.name = e.target.value.trim();
        root.userProfile.updatedAt = new Date().toISOString();
      }
      markDirty();
    });
    document.getElementById('intakeRestDay')?.addEventListener('change', e=>{
      ensureIntake().restDay = parseInt(e.target.value, 10); markDirty();
    });
  }

  /* ── events ──────────────────────────────────────────────────── */
  function bindIntake(){
    const ov = document.getElementById('intakeOverlay');
    if(!ov || ov.dataset.bound) return;
    ov.dataset.bound = '1';

    ov.addEventListener('click', async e=>{
      const el = e.target.closest('[data-in]');
      if(!el || !st) return;
      const act = el.dataset.in;
      switch(act){
        case 'skip-all': closeIntake(true); break;
        case 'skip-step': advance(); break;
        case 'back': goBack(); break;
        case 'next': advance(); break;
        case 'finish': await finishIntake(); break;
        case 'ff-done': st.ff='done'; await completeFirstFruits(); advance(); break;
        case 'ff-now': st.ff='now'; renderStep(); break;
        case 'ff-later': st.ff='later'; advance(); break;
        case 'ff-timer-done': st.ff='timer'; await completeFirstFruits(); advance(); break;
        case 'focus-sugg': st.focus = el.dataset.v; renderStep(); break;
        case 'focus-set': {
          st.focus = (document.getElementById('intakeFocusInput')?.value || st.focus).trim();
          if(st.focus){
            const day = await getToday();
            day.focus = st.focus;
            await saveToday(day);
            if(S()){
              const dm = S().getDayMeta(todayStr());
              if(!dm.theme) S().setDayMeta(todayStr(), { theme: st.focus });
            }
            if(!reduced()){
              document.getElementById('intakeFocusInput')?.classList.add('plant');
              setTimeout(()=>advance(), 420);
              return;
            }
          }
          advance(); break;
        }
        case 'b3-add': {
          const remaining = b3Remaining();
          const sg = remaining[+el.dataset.i];
          if(sg) addPick(sg.title, { stewTaskId: sg.stewTaskId, min: sg.min || 30, slot: sg.slot });
          break;
        }
        case 'b3-show-ideas': st.showStarters = true; renderStep(); break;
        case 'pick-rm': st.picks.splice(+el.dataset.idx,1); renderStep(); break;
        case 'pick-dur': {
          const p = st.picks[+el.dataset.idx];
          const i = DURATIONS.findIndex(d=>d[0]===p.min);
          p.min = DURATIONS[(i+1) % DURATIONS.length][0];
          renderStep(); break;
        }
        case 'pick-slot': {
          const p = st.picks[+el.dataset.idx];
          const i = SLOTS.findIndex(s=>s[0]===p.slot);
          p.slot = SLOTS[(i+1) % SLOTS.length][0];
          renderStep(); break;
        }
        case 'b3-done': await commitBigThree(st.picks); advance(); break;
        case 'shelf-add': {
          if(e.target.closest('[data-in="shelf-hide"]')) break;
          const entry = findShelfEntry(el.dataset.key);
          if(entry){
            const ev = addShelfBlock(entry);
            if(ev) st.shelfAdds.push({ title:entry.title, min:entry.min, slot:slotForMin(ev.startMin), category:entry.category, eventId:ev.id });
            renderStep();
          }
          break;
        }
        case 'shelf-hide': {
          e.stopPropagation();
          ensureIntake().hiddenBlocks.push(el.dataset.key);
          markDirty(); renderStep(); break;
        }
        case 'shelf-rm': {
          S()?.deleteEvent(el.dataset.ev);
          st.shelfAdds = st.shelfAdds.filter(a=>a.eventId!==el.dataset.ev);
          renderStep(); break;
        }
        case 'rhythm-yes': acceptRhythm(st.offer); st.offer=null; renderStep(); break;
        case 'rhythm-no': ensureIntake().offeredRhythm.push(st.offer.id); markDirty(); st.offer=null; renderStep(); break;
        case 'soul': {
          st.soul = el.dataset.v;
          const day = await getToday();
          day.soulCheck = st.soul;
          await saveToday(day);
          advance(); break;
        }
      }
    });

    ov.addEventListener('keydown', e=>{
      if(!st) return;
      if(e.key==='Escape'){ closeIntake(true); return; }
      if(e.key==='Enter' && e.target.id==='intakeB3Input' && e.target.value.trim()){
        addPick(e.target.value.trim());
        e.preventDefault();
      }
      if(e.key==='Enter' && e.target.id==='intakeFocusInput'){
        ov.querySelector('[data-in="focus-set"]')?.click();
        e.preventDefault();
      }
    });

    /* long-press a shelf block to reveal its "why" on touch devices */
    let lpTimer = null;
    const clearLp = ()=>{ clearTimeout(lpTimer); lpTimer = null; };
    ov.addEventListener('touchstart', e=>{
      const chip = e.target.closest?.('.intake-shelf-chip');
      if(!chip || !chip.dataset.why) return;
      lpTimer = setTimeout(()=> showChipWhy(chip, chip.dataset.why), 450);
    }, { passive:true });
    ov.addEventListener('touchend', clearLp);
    ov.addEventListener('touchmove', clearLp);
    ov.addEventListener('touchcancel', clearLp);

    /* drag from shelf tray onto a slot */
    ov.addEventListener('dragstart', e=>{
      const chip = e.target.closest?.('.intake-shelf-chip');
      if(chip) e.dataTransfer.setData('text/plain', chip.dataset.key);
    });
    ov.addEventListener('dragover', e=>{
      const slot = e.target.closest?.('.intake-slot');
      if(slot){ e.preventDefault(); slot.classList.add('drop-hover'); }
    });
    ov.addEventListener('dragleave', e=>{ e.target.closest?.('.intake-slot')?.classList.remove('drop-hover'); });
    ov.addEventListener('drop', e=>{
      const slot = e.target.closest?.('.intake-slot');
      if(!slot || !st) return;
      e.preventDefault();
      const entry = findShelfEntry(e.dataTransfer.getData('text/plain'));
      if(entry){
        const ev = addShelfBlock(entry, slot.dataset.slot);
        if(ev) st.shelfAdds.push({ title:entry.title, min:entry.min, slot:slot.dataset.slot, category:entry.category, eventId:ev.id });
        renderStep();
      }
    });
  }
  function findShelfEntry(key){
    const { tpls, commons } = shelfEntries();
    return tpls.concat(commons).find(x=>x.key===key) || null;
  }

  root.maybeLaunchIntake = function(){ bindIntake(); maybeLaunchIntake(); };
  root.launchIntake = function(manual){ bindIntake(); launchIntake(manual!==false); };
  root.updateDashIntakeUI = updateDashIntakeUI;
  root.renderIntakeSettings = renderIntakeSettings;
  root.intakeCompletedToday = completedToday;
  root.intakeSeenToday = intakeSeenToday;

})(typeof window !== 'undefined' ? window : globalThis);
