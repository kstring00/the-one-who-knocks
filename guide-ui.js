/**
 * Guide — built-in tutorial and onboarding
 */
(function(root){
  'use strict';

  const GUIDE_KEY = 'fs-guide';

  /** Edit all Guide copy here. */
  const GUIDE_CONTENT = {
    startHere: {
      title: 'Start here',
      intro: 'Five small steps to make the app yours. Each one links where you need to go.',
      steps: [
        {
          id: 'profile',
          title: 'Set up your Profile',
          text: 'Who you are, your rhythm, and non-negotiables — so coaching and priorities can fit your life.',
          link: { view: 'profile' }
        },
        {
          id: 'firstFruits',
          title: 'Keep your first non-negotiable',
          text: 'Open the Daily Ledger, write in a daily non-negotiable that matters to you, and check it off.',
          link: { view: 'daily', hash: 'sec-first-fruits' }
        },
        {
          id: 'goalProject',
          title: 'Add one goal and one project',
          text: 'In Planning, name a goal that matters this season, then add a project underneath it.',
          link: { view: 'dashboard', stewView: 'planning' }
        },
        {
          id: 'mentors',
          title: 'Name your mentors',
          text: 'Add the people who speak into your life — or leave space while you search for one.',
          link: { view: 'settings', hash: 'mentorSettings' }
        },
        {
          id: 'eveningReview',
          title: 'Complete your first evening review',
          text: 'On your Dashboard day view, write a few honest lines in Evening reflection.',
          link: { view: 'dashboard', stewView: 'day' }
        }
      ]
    },
    areas: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        for: 'Your home base — today\'s theme, schedule, habits, and the Task Shelf.',
        bullets: [
          'Start in Day view: name the day, crown your Big Three, and see your timeline.',
          'Drag tasks from the Task Shelf onto an hour when you\'re ready.',
          'Use Planning for goals → projects → tasks; Week and Month for the wider picture.',
          'The Faithfulness Ring scores stewardship, not perfection — an empty day is an invitation.'
        ],
        tryView: 'dashboard',
        tryLabel: 'Open your dashboard',
        hint: 'Today lives here — theme, time blocks, habits, and the Task Shelf.'
      },
      {
        id: 'rhythms',
        title: 'Rhythms',
        for: 'Daily, Weekly, and Monthly reviews — morning setup, honest carry-over, and zooming out.',
        bullets: [
          'Daily Ledger: your non-negotiables first, then today\'s must-dos, growth, and your plan of action.',
          'Weekly review: adjust, experiment, triage ideas — a few honest minutes.',
          'Monthly review: celebrate fruit, realign, multiply what\'s working.',
          'Miss a day without guilt; carry what matters, release the rest.'
        ],
        tryView: 'daily',
        tryLabel: 'Open Daily Ledger',
        hint: 'Morning setup and evening review — small rhythms that compound over time.'
      },
      {
        id: 'ideas',
        title: 'Ideas',
        for: 'Capture fast, act deliberately — a seedbed for what\'s not today\'s work.',
        bullets: [
          'Drop ideas in the inbox; don\'t let them compete with today\'s priorities.',
          'Move a few into Growing with a clear first action and schedule.',
          'Rest ideas gently when the season isn\'t right.',
          'Promote to tasks or calendar when you\'re ready to steward them.'
        ],
        tryView: 'ideas',
        tryLabel: 'Open Ideas Hub',
        hint: 'Capture fast, act deliberately — ideas here don\'t compete with today.'
      },
      {
        id: 'journal',
        title: 'Journal',
        for: 'Honest lines with no audience — one day per page.',
        bullets: [
          'Write morning pages, evening debrief, or anything in between.',
          'Gratitude and prompts rotate so you\'re never staring at a blank page.',
          'Consistency is tracked gently — not for streaks, but for showing up.',
          'Your entries stay private in your account.'
        ],
        tryView: 'journal',
        tryLabel: 'Write today\'s entry',
        hint: 'One day per page — no audience, just honest lines.'
      },
      {
        id: 'prayer',
        title: 'Prayer Log',
        for: 'A simple log of what you\'re carrying and what God has answered.',
        bullets: [
          'Add requests as they come; mark answered when grace shows up.',
          'Filter by waiting or answered when you want to remember.',
          'Keep it plain — a few words is enough.',
          'Prayer belongs beside your calendar, not buried in notes.'
        ],
        tryView: 'prayer',
        tryLabel: 'Open Prayer Log',
        hint: 'Carry requests and answered prayers in one quiet list.'
      },
      {
        id: 'projects',
        title: 'Projects',
        for: 'Faithful work over time — linked tasks show real progress.',
        bullets: [
          'Create a project and tie it to a growing idea if you like.',
          'Add tasks with dates when you\'re ready to schedule them.',
          'Progress comes from completed tasks, not wishful thinking.',
          'Projects also appear in Planning on your dashboard.'
        ],
        tryView: 'projects',
        tryLabel: 'View projects',
        hint: 'Longer work in one place — progress from tasks you actually complete.'
      },
      {
        id: 'mentorship',
        title: 'Mentorship',
        for: 'Principles and threads from the people who shape how you lead and live.',
        bullets: [
          'Name mentors in Settings so their wisdom has a home.',
          'Capture principles as they come — tagged and searchable.',
          'Queue questions for your next conversation.',
          'Borrow a principle onto a hard day in the Daily Ledger.'
        ],
        tryView: 'mentorship-threads',
        tryLabel: 'Open Mentorship',
        hint: 'Wisdom from real mentors — captured, tagged, ready when you need it.'
      },
      {
        id: 'profile',
        title: 'Profile',
        for: 'A quiet introduction — context for future coaching inside the app.',
        bullets: [
          'Name, rhythm, goals, and non-negotiables — all optional.',
          'Autosaves as you type; syncs with your account.',
          'Coaching isn\'t live yet; this prepares the ground.',
          'You can update it anytime life shifts.'
        ],
        tryView: 'profile',
        tryLabel: 'Set up Profile',
        hint: 'Introduce yourself once — so future coaching can meet you where you are.'
      }
    ],
    expect: {
      title: 'What to expect',
      philosophy: {
        heading: 'The philosophy',
        paragraphs: [
          'Faithfulness over performance. First things first — Bible and prayer before the inbox.',
          'Small things done consistently. Stewardship, not scorekeeping. The ring and numbers are mirrors, not grades.'
        ]
      },
      success: {
        heading: 'What success looks like',
        bullets: [
          'Weeks reviewed honestly — adjusted, not abandoned.',
          'Priorities that survive contact with real life.',
          'Ideas captured instead of lost.',
          'A walk with God that comes first — not streaks or perfect days.'
        ]
      },
      asks: {
        heading: 'What it asks of you',
        bullets: [
          '~5 minutes each morning: your non-negotiables and today\'s priorities.',
          '~5 minutes each evening: a short reflection.',
          'One honest weekly review.',
          'Miss days without guilt — the system is built for starting again.'
        ]
      }
    }
  };

  const HINT_VIEWS = {
    dashboard: 'dashboard',
    daily: 'rhythms',
    weekly: 'rhythms',
    monthly: 'rhythms',
    ideas: 'ideas',
    journal: 'journal',
    prayer: 'prayer',
    projects: 'projects',
    profile: 'profile'
  };

  function blankGuide(){
    return {
      checklist: {},
      hintsDismissed: {},
      onboardingDone: false,
      updatedAt: null
    };
  }

  function normalizeGuide(raw){
    const b = blankGuide();
    if(!raw || typeof raw !== 'object') return b;
    return {
      checklist: raw.checklist && typeof raw.checklist === 'object' ? { ...raw.checklist } : {},
      hintsDismissed: raw.hintsDismissed && typeof raw.hintsDismissed === 'object' ? { ...raw.hintsDismissed } : {},
      onboardingDone: !!raw.onboardingDone,
      updatedAt: raw.updatedAt || null
    };
  }

  function esc(s){
    if(typeof root.esc === 'function') return root.esc(s);
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function isoToday(){
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function detectChecklist(){
    const out = {};
    const steps = GUIDE_CONTENT.startHere.steps;

    if(typeof root.isProfileEmpty === 'function' && root.userProfile){
      out.profile = !root.isProfileEmpty(root.userProfile);
    }

    if(root.faithStore){
      const today = isoToday();
      root.faithStore.ensureDailyAnchors(today);
      const anchors = root.faithStore.getAnchorTasksForDate(today);
      out.firstFruits = anchors.some(t => t.completed);
      if(!out.firstFruits){
        const tasks = root.faithStore.data?.tasks || [];
        out.firstFruits = tasks.some(t => t.anchorId && t.completed);
      }
      const mentors = root.faithStore.getMentors();
      out.mentors = mentors.some(m => String(m.name || '').trim());
    }

    if(root.StewStore){
      const goals = root.StewStore.getGoals();
      out.goalProject = goals.some(g => root.StewStore.getProjects(g.id).length > 0);
      const days = root.StewStore.data?.days || {};
      out.eveningReview = Object.values(days).some(dm => String(dm?.reflection || '').trim());
    }

    steps.forEach(s => { if(!(s.id in out)) out[s.id] = false; });
    return out;
  }

  function mergeChecklist(detected){
    const merged = { ...root.guideData.checklist };
    let changed = false;
    Object.keys(detected).forEach(id => {
      if(detected[id] && !merged[id]){ merged[id] = true; changed = true; }
    });
    if(changed){
      root.guideData.checklist = merged;
      root.guideData.updatedAt = new Date().toISOString();
      root.markDirty?.();
    }
    return merged;
  }

  function checklistProgress(merged){
    const total = GUIDE_CONTENT.startHere.steps.length;
    const done = GUIDE_CONTENT.startHere.steps.filter(s => merged[s.id]).length;
    return { done, total };
  }

  function renderStartHere(merged){
    const prog = checklistProgress(merged);
    const rows = GUIDE_CONTENT.startHere.steps.map((s, i) => {
      const done = !!merged[s.id];
      return '<li class="guide-step'+(done ? ' done' : '')+'">'+
        '<span class="guide-step-num" aria-hidden="true">'+(done ? '✓' : (i + 1))+'</span>'+
        '<div class="guide-step-body">'+
        '<strong>'+esc(s.title)+'</strong>'+
        '<p>'+esc(s.text)+'</p>'+
        (done ? '' : '<button type="button" class="btn-ghost guide-step-go" data-guide-go="'+esc(s.id)+'">Go there →</button>')+
        '</div></li>';
    }).join('');
    return '<section class="guide-section" id="guide-start">'+
      '<h3 class="serif">'+esc(GUIDE_CONTENT.startHere.title)+'</h3>'+
      '<p class="guide-intro">'+esc(GUIDE_CONTENT.startHere.intro)+'</p>'+
      '<p class="guide-progress">'+prog.done+' of '+prog.total+' complete</p>'+
      '<ol class="guide-checklist">'+rows+'</ol></section>';
  }

  function renderAreas(){
    const cards = GUIDE_CONTENT.areas.map(a =>
      '<article class="guide-card" id="guide-area-'+a.id+'">'+
      '<h4 class="serif">'+esc(a.title)+'</h4>'+
      '<p class="guide-card-for">'+esc(a.for)+'</p>'+
      '<ul class="guide-bullets">'+a.bullets.map(b => '<li>'+esc(b)+'</li>').join('')+'</ul>'+
      '<button type="button" class="btn-gold guide-try" data-guide-try="'+esc(a.tryView)+'">'+esc(a.tryLabel)+'</button>'+
      '</article>'
    ).join('');
    return '<section class="guide-section" id="guide-areas">'+
      '<h3 class="serif">How each part works</h3>'+
      '<div class="guide-cards">'+cards+'</div></section>';
  }

  function renderExpect(){
    const e = GUIDE_CONTENT.expect;
    return '<section class="guide-section" id="guide-expect">'+
      '<h3 class="serif">'+esc(e.title)+'</h3>'+
      '<div class="guide-expect-block"><h4>'+esc(e.philosophy.heading)+'</h4>'+
      e.philosophy.paragraphs.map(p => '<p>'+esc(p)+'</p>').join('')+'</div>'+
      '<div class="guide-expect-block"><h4>'+esc(e.success.heading)+'</h4>'+
      '<ul>'+e.success.bullets.map(b => '<li>'+esc(b)+'</li>').join('')+'</ul></div>'+
      '<div class="guide-expect-block"><h4>'+esc(e.asks.heading)+'</h4>'+
      '<ul>'+e.asks.bullets.map(b => '<li>'+esc(b)+'</li>').join('')+'</ul></div>'+
      '</section>';
  }

  function renderGuide(){
    const main = document.getElementById('guideMain');
    if(!main) return;
    const detected = detectChecklist();
    const merged = mergeChecklist(detected);
    main.innerHTML = '<div class="guide-doc">'+
      renderStartHere(merged)+renderAreas()+renderExpect()+'</div>';
  }

  function stepLink(stepId){
    return GUIDE_CONTENT.startHere.steps.find(s => s.id === stepId)?.link;
  }

  function openGuideLink(link){
    if(!link) return;
    if(link.stewView){
      try{ localStorage.setItem('stew:view', link.stewView); }catch(x){}
    }
    if(typeof root.setMode === 'function') root.setMode(link.view);
    if(link.hash){
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.getElementById(link.hash);
          if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, link.view === 'dashboard' ? 400 : 150);
      });
    }
  }

  function openGuideCard(areaId){
    if(typeof root.setMode === 'function') root.setMode('guide');
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById('guide-area-' + areaId);
        if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });
  }

  function hintAreaForView(){
    const vm = root.viewMode;
    if(typeof vm === 'string' && vm.startsWith('mentorship')) return 'mentorship';
    return HINT_VIEWS[vm] || null;
  }

  function renderViewHint(){
    const bar = document.getElementById('contextHintBar');
    if(!bar) return;
    bar.hidden = true;
    bar.innerHTML = '';
  }

  function updateGuideHelpButton(){
    const btn = document.getElementById('btnGuideHelp');
    if(!btn) return;
    const areaId = hintAreaForView();
    if(areaId && !root.isGuide?.()){
      btn.hidden = false;
      btn.dataset.guideCard = areaId;
    } else {
      btn.hidden = true;
      delete btn.dataset.guideCard;
    }
  }

  function dismissHint(areaId){
    if(!root.guideData) return;
    root.guideData.hintsDismissed[areaId] = true;
    root.guideData.updatedAt = new Date().toISOString();
    renderViewHint();
    root.markDirty?.();
  }

  async function loadGuide(){
    const raw = await root.getJSON?.(GUIDE_KEY);
    root.guideData = normalizeGuide(raw);
    if(root.isGuide?.()) renderGuide();
    renderViewHint();
    updateGuideHelpButton();
  }

  function looksLikeExistingUser(){
    if(root.guideData?.checklist && Object.values(root.guideData.checklist).some(Boolean)) return true;
    if(root.userProfile && typeof root.isProfileEmpty === 'function' && !root.isProfileEmpty(root.userProfile)) return true;
    if(root.faithStore){
      const tasks = root.faithStore.data?.tasks || [];
      if(tasks.some(t => t.completed)) return true;
      if((root.faithStore.getMentors?.() || []).some(m => String(m.name || '').trim())) return true;
    }
    if(root.StewStore){
      if((root.StewStore.getGoals?.() || []).length > 0) return true;
      const days = root.StewStore.data?.days || {};
      if(Object.values(days).some(dm => String(dm?.reflection || '').trim())) return true;
    }
    return false;
  }

  function maybeGuideOnboarding(){
    if(!root.isSignedIn?.() || !root.guideData) return false;
    if(root.guideData.onboardingDone) return false;
    if(looksLikeExistingUser()){
      root.guideData.onboardingDone = true;
      root.guideData.updatedAt = new Date().toISOString();
      root.markDirty?.();
      return false;
    }
    root.guideData.onboardingDone = true;
    root.guideData.updatedAt = new Date().toISOString();
    root.markDirty?.();
    if(typeof root.setMode === 'function'){
      root.setMode('guide');
      requestAnimationFrame(() => {
        document.getElementById('guide-start')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
    return true;
  }

  function bindGuideEvents(){
    if(document.body.dataset.guideBound) return;
    document.body.dataset.guideBound = '1';

    document.addEventListener('click', e => {
      const go = e.target.closest('[data-guide-go]');
      if(go){ openGuideLink(stepLink(go.dataset.guideGo)); return; }

      const tryBtn = e.target.closest('[data-guide-try]');
      if(tryBtn){
        const view = tryBtn.dataset.guideTry;
        if(view === 'dashboard'){
          try{ localStorage.setItem('stew:view', 'day'); }catch(x){}
        }
        root.setMode?.(view);
        return;
      }

      const card = e.target.closest('[data-guide-card]');
      if(card){ openGuideCard(card.dataset.guideCard); return; }

      const dismiss = e.target.closest('[data-hint-dismiss]');
      if(dismiss){ dismissHint(dismiss.dataset.hintDismiss); return; }

      const help = e.target.closest('#btnGuideHelp');
      if(help){
        const areaId = help.dataset.guideCard || hintAreaForView();
        if(areaId) openGuideCard(areaId);
        return;
      }
    });

    document.addEventListener('input', e => {
      if(e.target.dataset?.daymeta === 'reflection'){
        setTimeout(() => refreshGuideUI(), 600);
      }
    });
  }

  function refreshGuideUI(){
    if(root.isGuide?.()) renderGuide();
    renderViewHint();
    updateGuideHelpButton();
  }

  root.GUIDE_KEY = GUIDE_KEY;
  root.GUIDE_CONTENT = GUIDE_CONTENT;
  root.guideData = null;
  root.blankGuide = blankGuide;
  root.normalizeGuide = normalizeGuide;
  root.loadGuide = loadGuide;
  root.renderGuide = renderGuide;
  root.renderViewHint = renderViewHint;
  root.updateGuideHelpButton = updateGuideHelpButton;
  root.refreshGuideUI = refreshGuideUI;
  root.openGuideCard = openGuideCard;
  root.maybeGuideOnboarding = maybeGuideOnboarding;
  root.bindGuideEvents = bindGuideEvents;
  root.detectGuideChecklist = detectChecklist;

})(typeof window !== 'undefined' ? window : globalThis);
