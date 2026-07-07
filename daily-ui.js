/**
 * Daily Ledger UI — First Fruits, Non-Negotiables, Growth Categories, Plan of Action
 */
(function(root){
  'use strict';

  let dailySubView = 'today';
  let stripHintDismissed = false;
  let sessionExpandId = null;

  const DURATIONS = [5, 10, 15, 30];

  function dateStr(){
    return iso(dayOf(typeof dayOffset === 'number' ? dayOffset : 0));
  }

  function getAnchors(){
    if(!window.faithStore) return [];
    return window.faithStore.getDailyAnchorConfig().filter(a=> a.enabled);
  }

  function getCategories(){
    if(!window.faithStore) return [];
    return window.faithStore.getDailyCategoryConfig().filter(c=> c.enabled);
  }

  function getNonNegItems(){
    return (dayData?.faithfulFew?.mustDo?.items || []).filter(it=> !it.anchorId);
  }

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

  function sessionSummaryLine(anchor){
    const sum = practiceSummary(anchor.id);
    if(!sum.count) return esc(anchor.title);
    let line = esc(anchor.title) + ' · ' + sum.count + ' session' + (sum.count === 1 ? '' : 's');
    if(sum.minutes) line += ' · ' + sum.minutes + ' min';
    return line;
  }

  function renderDayStrip(){
    const anchors = getAnchors();
    const chips = anchors.map(a=>{
      const done = anchorDone(a.id);
      const sum = practiceSummary(a.id);
      const cnt = sum.count ? ' ×' + sum.count : '';
      return '<button type="button" class="dl-chip'+(done?' done':'')+'" data-dl-strip-anchor="'+a.id+'" aria-pressed="'+(done?'true':'false')+'">'+
        '<span class="dl-chip-check" aria-hidden="true">'+(done?'✓':'')+'</span>'+
        '<span class="dl-chip-label">'+esc(a.title)+cnt+'</span></button>';
    }).join('');
    const nn = getNonNegItems();
    const nnChips = nn.map(it=>{
      const done = !!it.done && !it.released;
      return '<button type="button" class="dl-chip'+(done?' done':'')+(it.released?' released':'')+'" data-dl-strip-nn="'+it.id+'" aria-pressed="'+(done?'true':'false')+'">'+
        '<span class="dl-chip-check" aria-hidden="true">'+(done?'✓':(it.released?'—':''))+'</span>'+
        '<span class="dl-chip-label">'+esc(it.text || 'Untitled')+'</span></button>';
    }).join('');
    const hint = stripHintDismissed ? '' :
      '<p class="dl-strip-hint" id="dlStripHint">These follow you through the whole day.</p>';
    return '<div class="dl-day-strip" id="dlDayStrip" role="region" aria-label="Today\'s commitments">'+
      '<div class="dl-strip-row">'+chips+nnChips+'</div>'+hint+'</div>';
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

  function renderPrayerEntryRow(anchorId, idx){
    return '<div class="dl-prayer-entry" data-dl-prayer-idx="'+idx+'">'+
      '<input type="text" class="dl-hairline" data-dl-prayer-req="'+anchorId+'" data-dl-prayer-idx="'+idx+'" placeholder="What did I pray about?">'+
      '<input type="text" class="dl-hairline dl-secondary" data-dl-prayer-fruit="'+anchorId+'" data-dl-prayer-idx="'+idx+'" placeholder="How will this bear fruit? (optional)">'+
      '</div>';
  }

  function renderFirstFruits(){
    const anchors = getAnchors();
    const rows = anchors.map(a=>{
      const done = anchorDone(a.id);
      const kind = a.kind || window.faithStore?.getAnchorKind(a.id) || 'prayer';
      const expanded = sessionExpandId === a.id;
      const logAnother = done ? '<button type="button" class="dl-text-action" data-dl-log-another="'+a.id+'">+ log another</button>' : '';
      return '<div class="dl-item'+(done?' done':'')+(expanded?' expanded':'')+'" data-dl-ff="'+a.id+'">'+
        '<label class="dl-check-wrap">'+
        '<input type="checkbox" class="dl-check" data-dl-ff-check="'+a.id+'"'+(done?' checked':'')+' aria-label="'+esc(a.title)+'">'+
        '<span class="dl-item-main">'+sessionSummaryLine(a)+'</span></label>'+
        logAnother+
        (expanded ? renderSessionExpand(a, kind) : '')+
        '</div>';
    }).join('');
    return '<section class="dl-section daily-section" data-phases="morning day evening" id="sec-first-fruits">'+
      '<h3 class="dl-section-head serif">First Fruits</h3>'+
      '<div class="dl-list">'+rows+'</div></section>';
  }

  function renderNonNegItem(it){
    const done = !!it.done && !it.released;
    const badge = it.carryCount ? '<span class="dl-carry-badge" title="Carried forward">↻'+it.carryCount+'</span>' : '';
    const plan = it.carryPlan ? '<div class="dl-carry-plan">'+esc(it.carryPlan)+'</div>' : '';
    const cls = ['dl-item', done ? 'done' : '', it.released ? 'released' : ''].filter(Boolean).join(' ');
    return '<div class="'+cls+'" data-dl-nn="'+it.id+'">'+
      badge+
      '<label class="dl-check-wrap">'+
      '<input type="checkbox" class="dl-check" data-dl-nn-check="'+it.id+'"'+(done?' checked':'')+(it.released?' disabled':'')+'>'+
      '<span class="dl-item-main">'+esc(it.text)+'</span></label>'+plan+
      '</div>';
  }

  function renderNonNegotiables(){
    const items = getNonNegItems();
    const list = items.length ? items.map(renderNonNegItem).join('')
      : '<p class="dl-empty">Add your non-negotiables for today.</p>';
    return '<section class="dl-section daily-section" data-phases="morning day evening" id="sec-non-neg">'+
      '<h3 class="dl-section-head serif">Non-Negotiables</h3>'+
      '<div class="dl-list" id="dlNonNegList">'+list+'</div>'+
      '<div class="dl-add-row">'+
      '<input type="text" class="dl-hairline" id="dlNonNegAdd" placeholder="What must happen today?">'+
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

  function renderGrowthCategories(){
    const cats = getCategories();
    if(!cats.length){
      return '<section class="dl-section daily-section" data-phases="morning day" id="sec-growth">'+
        '<h3 class="dl-section-head serif">Growth Categories</h3>'+
        '<p class="dl-empty">No categories yet — add them under Settings → Daily Categories.</p></section>';
    }
    const acc = cats.map((c,i)=>{
      const items = dayData?.faithfulFew?.[c.id]?.items || [];
      const preview = items.length
        ? items.filter(x=> x.done).length + '/' + items.length + ' · ' + (items[0].text || '').slice(0, 36)
        : 'Tap to add';
      return '<details class="dl-accordion"'+(i===0?' open':'')+' data-dl-cat="'+c.id+'">'+
        '<summary><span class="dl-acc-icon">'+esc(c.icon)+'</span><span class="dl-acc-title">'+esc(c.title)+'</span>'+
        '<span class="dl-acc-preview">'+esc(preview)+'</span></summary>'+
        '<div class="dl-acc-body">'+
        '<p class="dl-hint">'+esc(c.hint)+'</p>'+
        renderMentorBorrow(c.id)+
        '<ul class="dl-growth-items" data-dl-growth-list="'+c.id+'">'+
        (items.length ? items.map(it=> renderGrowthItem(it, c.id)).join('')
          : '<li class="dl-empty-li">Nothing yet — add below.</li>')+
        '</ul>'+
        '<div class="dl-add-row">'+
        '<input type="text" class="dl-hairline" data-dl-growth-add="'+c.id+'" placeholder="Add item…">'+
        '<button type="button" class="dl-add-btn" data-dl-growth-add-btn="'+c.id+'">+</button></div>'+
        '</div></details>';
    }).join('');
    return '<section class="dl-section daily-section" data-phases="morning day" id="sec-growth">'+
      '<h3 class="dl-section-head serif">Growth Categories</h3>'+
      '<div class="dl-acc-grid">'+acc+'</div></section>';
  }

  function renderGrowthItem(it, catId){
    return '<li class="dl-item'+(it.done?' done':'')+'" data-dl-growth="'+it.id+'" data-dl-growth-cat="'+catId+'">'+
      '<label class="dl-check-wrap">'+
      '<input type="checkbox" class="dl-check" data-dl-growth-check="'+it.id+'" data-dl-growth-cat="'+catId+'"'+(it.done?' checked':'')+'>'+
      '<input type="text" class="dl-hairline dl-grow-text" data-dl-growth-text="'+it.id+'" data-dl-growth-cat="'+catId+'" value="'+esc(it.text)+'">'+
      '</label>'+
      '<button type="button" class="dl-rm" data-dl-growth-rm="'+it.id+'" data-dl-growth-cat="'+catId+'" aria-label="Remove">×</button></li>';
  }

  function schedField(path, label){
    return '<div class="dl-plan-row"><span class="dl-plan-label">'+esc(label)+'</span>'+
      '<input type="text" class="dl-hairline" data-field="'+path+'" placeholder="What happens in this window?" aria-label="'+esc(label)+' plan"></div>';
  }

  function renderPlanOfAction(){
    return '<section class="dl-section daily-section" data-phases="morning day" id="sec-plan">'+
      '<h3 class="dl-section-head serif">Plan of Action</h3>'+
      schedField('execute.beforeWork','Before Work')+
      schedField('execute.duringWork','During Work')+
      schedField('execute.afterWork','After Work')+
      schedField('execute.eveningShutdown','Evening Shutdown')+
      '</section>';
  }

  function renderEveningNonNegReview(){
    const items = getNonNegItems().filter(it=> !it.done && !it.released && !it.eveningAction);
    if(!items.length) return '';
    const rows = items.map(it=>
      '<div class="dl-review-row" data-dl-review="'+it.id+'">'+
      '<span class="dl-review-q">Didn\'t happen — carry to tomorrow?</span>'+
      '<span class="dl-review-item">'+esc(it.text)+'</span>'+
      '<div class="dl-review-actions">'+
      '<button type="button" class="dl-btn" data-dl-carry="'+it.id+'">Carry + plan</button>'+
      '<button type="button" class="dl-btn dl-btn-ghost" data-dl-release="'+it.id+'">Release</button></div>'+
      '<div class="dl-carry-field" hidden data-dl-carry-field="'+it.id+'">'+
      '<input type="text" class="dl-hairline" data-dl-carry-plan="'+it.id+'" placeholder="What will make it happen tomorrow?">'+
      '<button type="button" class="dl-btn dl-btn-primary" data-dl-carry-confirm="'+it.id+'">Confirm carry</button></div>'+
      '</div>'
    ).join('');
    return '<section class="dl-section daily-section" data-phases="evening" id="sec-evening-review">'+
      '<h3 class="dl-section-head serif">Non-Negotiables Review</h3>'+
      rows+'</section>';
  }

  function renderEveningSummary(){
    const s = window.faithStore?.getNonNegotiableSummary(dateStr(), dayData) || { kept:0, carried:0, released:0 };
    return '<section class="dl-section daily-section" data-phases="evening" id="sec-day-summary">'+
      '<p class="dl-summary-line">'+s.kept+' kept · '+s.carried+' carried · '+s.released+' released</p></section>';
  }

  function renderCarriedView(){
    const items = collectCarriedItems();
    const list = items.length ? items.map(it=>
      '<div class="dl-carried-row">'+
      '<span class="dl-carry-badge">↻'+it.carryCount+'</span>'+
      '<div><div class="dl-carried-text">'+esc(it.text)+'</div>'+
      (it.carryPlan ? '<div class="dl-carry-plan">'+esc(it.carryPlan)+'</div>' : '')+
      '<div class="dl-carried-meta">From '+esc(it.carriedFrom || '—')+' · target '+esc(it.targetDate || '—')+'</div></div></div>'
    ).join('') : '<p class="dl-empty">Nothing is riding the carry train.</p>';
    return '<div class="dl-carried-panel" id="dlCarriedPanel"'+(dailySubView==='carried'?'':' hidden')+'>'+
      '<h3 class="dl-section-head serif">Carried</h3>'+list+'</div>';
  }

  function collectCarriedItems(){
    const out = [];
    const today = dateStr();
    for(let off = -14; off <= 14; off++){
      const d = iso(dayOf((typeof dayOffset === 'number' ? dayOffset : 0) + off));
      const data = off === 0 ? dayData : null;
      if(off !== 0) continue;
      getNonNegItems().forEach(it=>{
        if(it.carryCount && !it.done && !it.released && d >= today)
          out.push({ ...it, targetDate: d, carriedFrom: it.carriedFrom });
      });
    }
    if(window._dlCarriedCache) return window._dlCarriedCache;
    return out.sort((a,b)=> (a.carriedFrom||'').localeCompare(b.carriedFrom||''));
  }

  async function refreshCarriedCache(){
    const out = [];
    for(let off = -30; off <= 7; off++){
      const d = iso(dayOf((typeof dayOffset === 'number' ? dayOffset : 0) + off));
      if(d < dateStr() && off < 0) continue;
      let data = off === 0 ? dayData : await getJSON('fs-day:'+d);
      if(!data) continue;
      data = typeof normalizeDaily === 'function' ? normalizeDaily(data) : data;
      (data.faithfulFew?.mustDo?.items || []).filter(it=> !it.anchorId && it.carryCount && !it.done && !it.released).forEach(it=>{
        out.push({ ...it, targetDate: d, carriedFrom: it.carriedFrom || d });
      });
    }
    window._dlCarriedCache = out.sort((a,b)=> (a.carriedFrom||'').localeCompare(b.carriedFrom||''));
    return window._dlCarriedCache;
  }

  function renderDailySidebar(){
    return (typeof ThoughtJournalCard === 'function' ? ThoughtJournalCard() : '')+
      '<div class="dl-rail-block"><h4 class="dl-rail-head serif">Today\'s Flow</h4>'+
      '<div class="dl-flow-list">'+
      ['Morning Setup','During the Day','Evening Review'].map((l,i)=>{
        const ph = ['morning','day','evening'][i];
        return '<button type="button" class="dl-flow-step" data-dl-goto-phase="'+ph+'">'+esc(l)+'</button>';
      }).join('')+'</div></div>'+
      '<div class="dl-rail-block"><h4 class="dl-rail-head serif">Scripture</h4>'+
      '<p class="dl-scripture">"Whatever you do, do it from the heart, as something done for the Lord and not for people."<cite>Colossians 3:23</cite></p></div>';
  }

  function renderDailyLedger(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return false;
    const main = document.getElementById('dailyMain');
    const sidebar = document.getElementById('dailySidebar');
    if(!main) return false;
    stripHintDismissed = localStorage.getItem('dl:stripHint') === '1';
    main.innerHTML =
      renderFirstFruits()+
      renderNonNegotiables()+
      renderGrowthCategories()+
      renderPlanOfAction()+
      renderEveningNonNegReview()+
      renderEveningSummary()+
      renderCarriedView();
    if(sidebar) sidebar.innerHTML = renderDailySidebar();
    const stripHost = document.getElementById('dlDayStripHost');
    if(stripHost) stripHost.innerHTML = renderDayStrip();
    if(typeof loadThoughtJournal === 'function') loadThoughtJournal();
    refreshCarriedCache().then(()=>{
      const panel = document.getElementById('dlCarriedPanel');
      if(panel && dailySubView === 'carried') renderCarriedPanelContent();
    });
    return true;
  }

  function renderCarriedPanelContent(){
    const panel = document.getElementById('dlCarriedPanel');
    if(!panel) return;
    const items = window._dlCarriedCache || [];
    panel.innerHTML = '<h3 class="dl-section-head serif">Carried</h3>'+
      (items.length ? items.map(it=>
        '<div class="dl-carried-row"><span class="dl-carry-badge">↻'+it.carryCount+'</span><div>'+
        '<div class="dl-carried-text">'+esc(it.text)+'</div>'+
        (it.carryPlan ? '<div class="dl-carry-plan">'+esc(it.carryPlan)+'</div>' : '')+
        '<div class="dl-carried-meta">From '+esc(it.carriedFrom||'—')+' · on '+esc(it.targetDate||'—')+'</div></div></div>'
      ).join('') : '<p class="dl-empty">Nothing is riding the carry train.</p>');
  }

  function refreshDailyUI(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return;
    const stripHost = document.getElementById('dlDayStripHost');
    if(stripHost) stripHost.innerHTML = renderDayStrip();
    const ff = document.getElementById('sec-first-fruits');
    if(ff){
      const sec = renderFirstFruits();
      ff.outerHTML = sec;
    }
    const nnList = document.getElementById('dlNonNegList');
    if(nnList){
      const items = getNonNegItems();
      nnList.innerHTML = items.length ? items.map(renderNonNegItem).join('') : '<p class="dl-empty">Add your non-negotiables for today.</p>';
    }
    const cats = getCategories();
    const growthSec = document.getElementById('sec-growth');
    if(growthSec && growthSec.querySelectorAll('details[data-dl-cat]').length !== cats.length){
      growthSec.outerHTML = renderGrowthCategories();
    }
    cats.forEach(c=>{
      const list = document.querySelector('[data-dl-growth-list="'+c.id+'"]');
      if(!list) return;
      const items = dayData?.faithfulFew?.[c.id]?.items || [];
      list.innerHTML = items.length ? items.map(it=> renderGrowthItem(it, c.id)).join('')
        : '<li class="dl-empty-li">Nothing yet — add below.</li>';
    });
    const review = document.getElementById('sec-evening-review');
    if(review) review.outerHTML = renderEveningNonNegReview() || '';
    const sum = document.getElementById('sec-day-summary');
    if(sum) sum.outerHTML = renderEveningSummary();
    updateDailyScore();
  }

  function updateDailyScore(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return;
    const el = document.getElementById('score');
    if(!el || !dayData) return;
    const nn = getNonNegItems();
    const done = nn.filter(it=> it.done && !it.released).length;
    const anchors = getAnchors();
    const ffDone = anchors.filter(a=> anchorDone(a.id)).length;
    const practice = window.faithStore?.getPracticeSummaryForDate(dateStr());
    let txt = ffDone + '/' + anchors.length + ' first fruits';
    if(practice?.totalSessions) txt += ' · ' + practice.totalSessions + ' sessions';
    if(nn.length) txt += ' · ' + done + '/' + nn.length + ' non-neg';
    el.textContent = txt;
    el.classList.toggle('gold', anchors.length && ffDone === anchors.length && (!nn.length || done === nn.length));
  }

  function dismissStripHint(){
    if(stripHintDismissed) return;
    stripHintDismissed = true;
    localStorage.setItem('dl:stripHint', '1');
    document.getElementById('dlStripHint')?.remove();
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
    if(typeof renderDashboard === 'function') renderDashboard();
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
    tom.faithfulFew.mustDo.items.push({
      id: uid(),
      text: it.text,
      done: false,
      carryCount: (it.carryCount || 0) + 1,
      carryPlan: plan.trim(),
      carriedFrom: dateStr()
    });
    if(typeof saveDayDataByDate === 'function') await saveDayDataByDate(iso(dayOf(tomorrowOff)), tom);
    if(faithStore){
      faithStore.syncMustDosFromDay(iso(dayOf(tomorrowOff)), tom);
      await faithStore.save();
    }
    window._dlCarriedCache = null;
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

  function addNonNeg(text){
    if(!text?.trim() || !dayData) return;
    if(!dayData.faithfulFew.mustDo.items) dayData.faithfulFew.mustDo.items = [];
    const itemId = uid();
    dayData.faithfulFew.mustDo.items.push({ id: itemId, text: text.trim(), done: false });
    if(window.faithStore){
      window.faithStore.createTask({
        title: text.trim(),
        date: dateStr(),
        timeSlot: 'beforeWork',
        tag: 'stewardship',
        legacyMustDoId: itemId
      });
      window.faithStore.save();
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
      '<button type="button" class="ff-rm" data-cat-rm aria-label="Remove">×</button></div>'
    ).join('');
  }

  function saveCategorySettingsFromDOM(){
    if(!window.faithStore) return;
    const rows = [...document.querySelectorAll('#categorySettings [data-cat-row]')];
    const cats = rows.map(row=>({
      icon: row.querySelector('[data-cat-icon]')?.value || '•',
      title: row.querySelector('[data-cat-title]')?.value || '',
      hint: row.querySelector('[data-cat-hint]')?.value || '',
      enabled: row.querySelector('[data-cat-enabled]')?.checked !== false
    }));
    window.faithStore.setDailyCategoryConfig(cats);
    window.faithStore.save();
  }

  function bindDailyEvents(){
    if(document.body.dataset.dlBound) return;
    document.body.dataset.dlBound = '1';
    const app = document.getElementById('app');

    app.addEventListener('click', async e=>{
      if(!isDaily?.() || (typeof isSaturdayRecovery === 'function' && isSaturdayRecovery())) return;

      const subTab = e.target.closest('[data-dl-sub]');
      if(subTab){
        dailySubView = subTab.dataset.dlSub;
        document.querySelectorAll('[data-dl-sub]').forEach(b=> b.classList.toggle('on', b.dataset.dlSub === dailySubView));
        document.querySelectorAll('#dailyMain .dl-section').forEach(s=>{
          s.style.display = dailySubView === 'carried' ? 'none' : '';
        });
        const panel = document.getElementById('dlCarriedPanel');
        if(panel){
          if(dailySubView === 'carried'){
            panel.removeAttribute('hidden');
            refreshCarriedCache().then(renderCarriedPanelContent);
          } else panel.setAttribute('hidden','');
        }
        return;
      }

      const gotoPhase = e.target.closest('[data-dl-goto-phase]');
      if(gotoPhase?.dataset.dlGotoPhase){
        setDailyPhase?.(gotoPhase.dataset.dlGotoPhase);
        return;
      }

      if(e.target.closest('#dlNonNegAddBtn')){
        addNonNeg(document.getElementById('dlNonNegAdd')?.value);
        const inp = document.getElementById('dlNonNegAdd');
        if(inp) inp.value = '';
        dismissStripHint();
        return;
      }

      const ffCheck = e.target.closest('[data-dl-ff-check]');
      if(ffCheck){
        dismissStripHint();
        const anchorId = ffCheck.dataset.dlFfCheck;
        if(!ffCheck.checked) return;
        if(!anchorDone(anchorId)){
          await logSession(anchorId, 0, []);
          sessionExpandId = anchorId;
          refreshDailyUI();
        } else {
          sessionExpandId = anchorId;
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
        dismissStripHint();
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
        dismissStripHint();
        return;
      }

      const stripAnchor = e.target.closest('[data-dl-strip-anchor]');
      if(stripAnchor){
        const id = stripAnchor.dataset.dlStripAnchor;
        const cb = document.querySelector('[data-dl-ff-check="'+id+'"]');
        if(cb && !cb.checked){ cb.click(); }
        else { sessionExpandId = id; refreshDailyUI(); }
        dismissStripHint();
        return;
      }

      const stripNn = e.target.closest('[data-dl-strip-nn]');
      if(stripNn){
        const cb = document.querySelector('[data-dl-nn-check="'+stripNn.dataset.dlStripNn+'"]');
        if(cb && !cb.disabled) cb.click();
        dismissStripHint();
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
        refreshDailyUI();
        markDirty?.();
        return;
      }

      const growthRm = e.target.closest('[data-dl-growth-rm]');
      if(growthRm){
        const { dlGrowthRm: id, dlGrowthCat: cat } = growthRm.dataset;
        dayData.faithfulFew[cat].items = dayData.faithfulFew[cat].items.filter(x=> x.id !== id);
        refreshDailyUI();
        markDirty?.();
        return;
      }
    });

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
          dismissStripHint();
          refreshDailyUI();
          markDirty?.();
        }
        return;
      }
      const gr = e.target.closest('[data-dl-growth-check]');
      if(gr){
        const cat = gr.dataset.dlGrowthCat;
        const it = dayData.faithfulFew[cat]?.items?.find(x=> x.id === gr.dataset.dlGrowthCheck);
        if(it){ it.done = gr.checked; refreshDailyUI(); markDirty?.(); }
      }
    });

    app.addEventListener('input', e=>{
      if(!isDaily?.()) return;
      const gt = e.target.closest('[data-dl-growth-text]');
      if(gt){
        const cat = gt.dataset.dlGrowthCat;
        const it = dayData.faithfulFew[cat]?.items?.find(x=> x.id === gt.dataset.dlGrowthText);
        if(it){ it.text = gt.value; markDirty?.(); }
      }
      if(e.target.dataset.field?.startsWith('execute.')) markDirty?.();
    });

    app.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && e.target.id === 'dlNonNegAdd'){
        e.preventDefault();
        document.getElementById('dlNonNegAddBtn')?.click();
      }
    });

    document.getElementById('categoryAddBtn')?.addEventListener('click', ()=>{
      if(!window.faithStore) return;
      const cats = window.faithStore.getDailyCategoryConfig();
      cats.push({ icon: '•', title: 'New category', hint: '', enabled: true });
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
  }

  root.renderDailyLedger = renderDailyLedger;
  root.refreshDailyUI = refreshDailyUI;
  root.updateDailyScore = updateDailyScore;
  root.bindDailyEvents = bindDailyEvents;
  root.renderCategorySettings = renderCategorySettings;
  root.loadDailyLedger = async function(){
    if(typeof isSaturdayRecovery === 'function' && isSaturdayRecovery()) return false;
    if(!document.getElementById('sec-first-fruits')) renderDailyLedger();
    populateFields?.(document.getElementById('dailyMain'), dayData);
    refreshDailyUI();
    await refreshCarriedCache();
    return true;
  };

})(typeof window !== 'undefined' ? window : globalThis);
