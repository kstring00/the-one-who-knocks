/**
 * Weekly & Monthly guided stewardship reviews.
 * Preserves existing weekData / monthData field paths.
 */
(function(root){
  'use strict';

  let weekOpen = 'scorecard';
  let monthOpen = 'entrusted';
  let weekScoreStats = null;
  let fruitNoteOpen = null;

  function filled(v){ return !!(v && String(v).trim()); }
  function tip(n, t){ return root.helpTip?.(n, t) || ''; }

  function statusBadge(state){
    const map = {
      complete: ['done','Complete'],
      progress: ['progress','In progress'],
      empty: ['','Not started']
    };
    const m = map[state] || map.empty;
    return '<span class="gr-status '+m[0]+'">'+m[1]+'</span>';
  }

  function sectionState(filledCount, total){
    if(!total || !filledCount) return 'empty';
    if(filledCount >= total) return 'complete';
    return 'progress';
  }

  function compactField(path, label, ph){
    return '<div class="gr-field">'+
      (label ? '<label>'+esc(label)+'</label>' : '')+
      '<textarea rows="2" data-field="'+path+'" placeholder="'+esc(ph||'')+'"></textarea></div>';
  }

  function compactInput(path, label, ph){
    return '<div class="gr-field">'+
      (label ? '<label>'+esc(label)+'</label>' : '')+
      '<input type="text" data-field="'+path+'" placeholder="'+esc(ph||'')+'"></div>';
  }

  function accordion(id, num, title, question, helper, state, body, kind){
    const open = (kind === 'week' ? weekOpen : monthOpen) === id;
    return '<details class="gr-card" id="sec-'+id+'" data-gr-acc="'+id+'" data-gr-kind="'+kind+'"'+(open?' open':'')+'>'+
      '<summary class="gr-card-head">'+
      '<div><h3>'+esc(title)+tip(num, helper || question || title)+'</h3>'+
      (question ? '<p class="gr-card-q">'+esc(question)+'</p>' : '')+
      '</div>'+
      '<div class="gr-card-meta">'+statusBadge(state)+'<span class="gr-chevron" aria-hidden="true">▾</span></div>'+
      '</summary>'+
      '<div class="gr-card-body">'+
      (helper ? '<p class="gr-helper">'+esc(helper)+'</p>' : '')+
      body+'</div></details>';
  }

  function progressPills(steps, active, kind){
    return '<div class="gr-progress" role="navigation" aria-label="Review progress">'+
      steps.map((s,i)=>{
        const st = s.state || 'empty';
        const on = active === s.id;
        return '<button type="button" class="gr-pill'+(on?' on':'')+(st==='complete'?' done':'')+'" data-gr-goto="'+s.id+'" data-gr-kind="'+kind+'">'+
          '<span class="gr-pill-num">'+(i+1)+'</span>'+esc(s.label)+'</button>';
      }).join('')+'</div>';
  }

  function summaryCards(cards){
    return '<div class="gr-summary">'+cards.map(c=>
      '<div class="gr-sum-card'+(c.accent?' accent':'')+'">'+
      '<div class="gr-sum-kicker">'+esc(c.kicker)+'</div>'+
      '<div class="gr-sum-value">'+esc(c.value)+'</div>'+
      (c.meta ? '<div class="gr-sum-meta">'+esc(c.meta)+'</div>' : '')+
      (c.status ? '<div class="gr-sum-status '+esc(c.statusClass||'')+'">'+esc(c.status)+'</div>' : '')+
      '</div>'
    ).join('')+'</div>';
  }

  function howWorks(title, steps){
    return '<div class="gr-how"><h4 class="serif">'+esc(title)+'</h4><ol>'+
      steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></div>';
  }

  function showSticky(id, show){
    const el = document.getElementById(id);
    if(!el) return;
    if(show) el.removeAttribute('hidden');
    else el.setAttribute('hidden','');
  }

  /* ── Weekly status helpers ─────────────────────────────────── */
  function weekSectionStates(w){
    const notes = w?.scorecardNotes || {};
    const noteCount = Object.values(notes).filter(filled).length;
    return {
      scorecard: weekScoreStats ? (noteCount >= 1 ? 'complete' : 'progress') : (noteCount ? 'progress' : 'empty'),
      patterns: sectionState(
        ['repeating','momentum','drained','neglected','positiveCompound','negativeCompound']
          .filter(k=> filled(w?.patternRecognition?.[k])).length, 6),
      fruit: sectionState(
        ['usedWell','discovered','buried','practiceNext'].filter(k=> filled(w?.talentReview?.[k])).length, 4),
      neighbor: sectionState(
        ['whoInFront','howServed','followUp'].filter(k=> filled(w?.neighborLove?.[k])).length, 3),
      experiment: sectionState(
        ['test','why','success','block','ifThen'].filter(k=> filled(w?.experiment?.[k])).length, 5),
      plan: sectionState(
        ['top3','deadlines','studyBlocks','workResp','bodyHealth','sabbath'].filter(k=> filled(w?.planWeek?.[k])).length, 6)
    };
  }

  function weekSummaryCards(w, stats){
    const pcts = stats || {};
    const keys = ['mustDo','body','order','leadership','skill','journal','study','guardrail'];
    const labels = {
      mustDo:'Must-dos', body:'Body', order:'Order', leadership:'Leadership',
      skill:'Skill', journal:'Journal', study:'Study', guardrail:'Guardrail'
    };
    let strongest = '—', needs = '—', best = -1, worst = 101;
    keys.forEach(k=>{
      const p = pcts[k] ?? 0;
      if(p > best){ best = p; strongest = labels[k]; }
      if(p < worst){ worst = p; needs = labels[k]; }
    });
    const overall = keys.length ? Math.round(keys.reduce((a,k)=> a+(pcts[k]||0), 0) / keys.length) : 0;
    const focus = filled(w?.nextWeekFocus) ? w.nextWeekFocus
      : (filled(w?.planWeek?.top3) ? String(w.planWeek.top3).split('\n')[0].slice(0,48) : 'Choose one focus');
    return summaryCards([
      { kicker:'Faithfulness Score', value: overall+'%', meta:'Across daily ledgers this week', accent:true },
      { kicker:'Strongest Rhythm', value: strongest, meta: best>=0 ? best+'% consistency' : 'Complete a few days first' },
      { kicker:'Needs Attention', value: needs, meta: worst<=100 ? worst+'% this week' : '—' },
      { kicker:"Next Week's Focus", value: focus.slice(0,40)+(focus.length>40?'…':''), meta: filled(w?.nextWeekFocus)?'Set':'Pick in Plan the Week' }
    ]);
  }

  function renderScorecardGrid(stats){
    const items = [
      ['mustDo','Must-dos'],['body','Body habit'],['order','Order habit'],
      ['leadership','Leadership practice'],['skill','Skill / talent'],
      ['journal','Journal'],['study','Scripture / study'],['guardrail','Recovery guardrail']
    ];
    return '<div class="gr-score-grid" id="weekScorecard">'+items.map(([k,label])=>{
      const pct = stats?.[k] ?? 0;
      return '<div class="gr-score-item'+(pct<40?' low':'')+'">'+
        '<div class="name">'+esc(label)+'</div>'+
        '<div class="gr-score-bar"><i style="width:'+pct+'%"></i></div>'+
        '<div class="gr-score-pct">'+pct+'%</div></div>';
    }).join('')+'</div>';
  }

  function renderWeeklySidebar(w){
    const st = weekSectionStates(w);
    const done = Object.values(st).filter(s=> s==='complete').length;
    return '<div class="gr-rail-card"><h4 class="serif">Weekly Summary</h4>'+
      '<p class="gr-rail-line">'+done+' of 6 sections complete</p>'+
      (w?.reviewComplete ? '<p class="gr-rail-line" style="color:var(--green)">✓ Week marked complete</p>' : '')+
      '</div>'+
      '<div class="gr-rail-card"><h4 class="serif">Scripture</h4>'+
      '<p class="gr-rail-line" style="font-style:italic">"Teach us to number our days, that we may gain a heart of wisdom."</p>'+
      '<p class="gr-rail-line" style="color:var(--gold-text)">Psalm 90:12</p></div>'+
      '<div class="gr-rail-card"><h4 class="serif">Next Week Focus</h4>'+
      '<p class="gr-rail-line">'+(filled(w?.nextWeekFocus)?esc(w.nextWeekFocus):'Not set yet — choose one priority below.')+'</p></div>'+
      howWorks('How This Works',[
        'Review what happened',
        'Notice patterns',
        'Name the fruit',
        'Choose one experiment',
        'Plan the week'
      ]);
  }

  function renderGuidedWeekly(){
    const main = document.getElementById('weeklyMain');
    const rail = document.getElementById('weeklySidebar');
    if(!main || !weekData) return;
    const w = weekData;
    const st = weekSectionStates(w);
    const steps = [
      { id:'scorecard', label:'Scorecard', state:st.scorecard },
      { id:'patterns', label:'Patterns', state:st.patterns },
      { id:'fruit', label:'Fruit', state:st.fruit },
      { id:'neighbor', label:'Neighbor Love', state:st.neighbor },
      { id:'experiment', label:'Experiment', state:st.experiment },
      { id:'plan', label:'Plan', state:st.plan }
    ];

    const scoreBody =
      renderScorecardGrid(weekScoreStats)+
      '<details class="gr-prompt"><summary>Notes (optional)</summary><div class="gr-field">'+
      ['mustDo','body','order','leadership','skill','journal','study','guardrail','overall'].map(k=>{
        const labels = {mustDo:'Must-do notes',body:'Body',order:'Order',leadership:'Leadership',skill:'Skill',
          journal:'Journal',study:'Study',guardrail:'Guardrail',overall:'Overall reflection'};
        return compactField('scorecardNotes.'+k, labels[k], 'A line or two…');
      }).join('')+'</div></details>';

    const patternPrompts = [
      ['repeating','What kept appearing?'],
      ['momentum','What gave life?'],
      ['drained','What drained me?'],
      ['neglected','Where did I show consistency?'],
      ['positiveCompound','Where did small faithfulness compound positively?'],
      ['negativeCompound','Where did small neglect compound negatively?']
    ];
    const patternBody = '<div class="gr-acc-one">'+patternPrompts.map(([k,q],i)=>
      '<details class="gr-prompt" data-gr-one'+(i===0?' open':'')+'>'+
      '<summary>'+esc(q)+'</summary>'+
      compactField('patternRecognition.'+k, '', 'Write freely…')+
      '</details>'
    ).join('')+'</div>';

    const fruitBody = '<div class="gr-compact-grid">'+
      compactField('talentReview.usedWell','What did I use well this week?','Gifts, skills, time…')+
      compactField('talentReview.discovered','Where did I decrease?','What I set aside for others…')+
      compactField('talentReview.buried','What did I bury or neglect?','Honest inventory…')+
      compactField('talentReview.practiceNext','What needs practice next week?','One deliberate rep…')+
      '</div>';

    const neighborBody =
      compactField('neighborLove.whoInFront','Who was in front of me this week?','Names…')+
      compactField('neighborLove.howServed','How did I serve them practically?','One concrete act…')+
      compactField('neighborLove.followUp','Who needs follow-up?','A call, a note, a visit…');

    const experimentBody =
      compactInput('experiment.test','Experiment name','One system or habit to test')+
      compactField('experiment.why','Why it matters','')+
      compactField('experiment.success','What would count as success?','')+
      compactField('experiment.block','What could block it?','')+
      compactField('experiment.ifThen','Minimum version / if-then','If X, then Y…');

    const planBody = '<div class="gr-acc-one">'+[
      ['top3','Top 3 priorities'],
      ['deadlines','Important deadlines'],
      ['studyBlocks','Study blocks'],
      ['workResp','Work support blocks'],
      ['bodyHealth','Budget / bill / body commitments'],
      ['sabbath','Sabbatical / rest protection']
    ].map(([k,label],i)=>
      '<details class="gr-prompt" data-gr-one'+(i===0?' open':'')+'>'+
      '<summary>'+esc(label)+'</summary>'+
      compactField('planWeek.'+k, '', '')+
      '</details>'
    ).join('')+
    '<div style="margin-top:10px">'+compactInput('nextWeekFocus',"Next week's one focus",'The one thing that matters most…')+'</div></div>';

    main.innerHTML =
      progressPills(steps, weekOpen, 'week')+
      weekSummaryCards(w, weekScoreStats)+
      accordion('scorecard',1,'Faithfulness Scorecard','How consistent was the week?','Completion across daily ledgers.',st.scorecard,scoreBody,'week')+
      accordion('patterns',2,'Pattern Recognition','What kept repeating this week?','Only one prompt open at a time.',st.patterns,patternBody,'week')+
      accordion('fruit',3,'Fruit Review','Steward the gifts God entrusted to you.','',st.fruit,fruitBody,'week')+
      accordion('neighbor',4,'Neighbor Love','Who was in front of me this week?','Relational and actionable.',st.neighbor,neighborBody,'week')+
      accordion('experiment',5,'One Weekly Experiment','What one system or habit should I test next week?','Keep it small enough to finish.',st.experiment,experimentBody,'week')+
      accordion('plan',6,'Plan the Week','Set yourself up on purpose.','Expand one area at a time.',st.plan,planBody,'week');

    if(rail) rail.innerHTML = renderWeeklySidebar(w);
    showSticky('weeklyStickyBar', true);
    showSticky('monthlyStickyBar', false);
    populateFields?.(main, w);
  }

  /* ── Monthly ───────────────────────────────────────────────── */
  function monthSectionStates(m){
    return {
      entrusted: sectionState(Object.values(m?.entrusted||{}).filter(filled).length, 7),
      multiplied: sectionState(Object.values(m?.multiplied||{}).filter(filled).length, 6),
      buried: sectionState(['avoided','whyAvoided','support'].filter(k=> filled(m?.buried?.[k])).length, 3),
      compounded: sectionState(['smallAct','smallNeglect'].filter(k=> filled(m?.compounded?.[k])).length, 2),
      fruit: sectionState((m?.fruitOfSpirit||[]).filter(f=> f.rating>0).length, 9),
      theme: filled(m?.theme) ? 'complete' : 'empty',
      keystone: filled(m?.keystone) ? 'complete' : 'empty'
    };
  }

  function monthSummaryCards(m){
    const st = monthSectionStates(m);
    const card = (kicker, value, state)=>({
      kicker, value,
      status: state==='complete'?'Complete':state==='progress'?'In progress':'Not started',
      statusClass: state==='complete'?'done':state==='progress'?'progress':''
    });
    return summaryCards([
      card('Entrusted', 'What was given to me?', st.entrusted),
      card('Multiplied', 'What grew through faithfulness?', st.multiplied),
      card('Neglected', 'What needs honest attention?', st.buried),
      Object.assign(card('Keystone', filled(m?.keystone)?m.keystone.slice(0,36):'What one system will matter most?', st.keystone), { accent:true })
    ]);
  }

  function renderFruitGridCompact(m){
    const fruits = m?.fruitOfSpirit || [];
    return '<div class="gr-fruit-grid" id="fruitGrid">'+fruits.map((f,i)=>{
      let btns = '';
      for(let r=1;r<=5;r++) btns += '<button type="button" class="rate-pill'+(f.rating===r?' on':'')+'" data-fruit="'+i+'" data-v="'+r+'">'+r+'</button>';
      const noteOpen = fruitNoteOpen === i;
      return '<div class="gr-fruit-card'+(noteOpen?' note-open':'')+'" data-fruit-card="'+i+'">'+
        '<h4>'+esc(f.name)+'</h4>'+
        '<div class="rating-pills">'+btns+'</div>'+
        '<button type="button" class="gr-fruit-note-toggle" data-gr-fruit-note="'+i+'">'+(filled(f.note)?'Edit note':'Add note')+'</button>'+
        '<div class="gr-fruit-note"><textarea class="ta-sm" rows="2" data-field="fruitOfSpirit.'+i+'.note" placeholder="Optional note…"></textarea></div>'+
        '</div>';
    }).join('')+'</div>';
  }

  function renderMonthlySidebar(m){
    const st = monthSectionStates(m);
    const rated = (m?.fruitOfSpirit||[]).filter(f=> f.rating>0).length;
    const top = [...(m?.fruitOfSpirit||[])].filter(f=> f.rating>0).sort((a,b)=> b.rating-a.rating)[0];
    return '<div class="gr-rail-card"><h4 class="serif">Month Summary</h4>'+
      '<p class="gr-rail-line">'+Object.values(st).filter(s=> s==='complete').length+' of 7 sections complete</p>'+
      (m?.reviewComplete ? '<p class="gr-rail-line" style="color:var(--green)">✓ Month marked complete</p>' : '')+
      '</div>'+
      '<div class="gr-rail-card"><h4 class="serif">Fruit Snapshot</h4>'+
      '<p class="gr-rail-line">'+rated+'/9 fruits rated'+(top ? ' · strongest: '+esc(top.name) : '')+'</p></div>'+
      '<div class="gr-rail-card"><h4 class="serif">Next Month Theme</h4>'+
      '<p class="gr-rail-line">'+(filled(m?.theme)?esc(m.theme):'Not chosen yet')+'</p></div>'+
      '<div class="gr-rail-card"><h4 class="serif">Keystone System</h4>'+
      '<p class="gr-rail-line">'+(filled(m?.keystone)?esc(m.keystone):'Not set yet')+'</p></div>'+
      howWorks('How This Works',[
        'Name what was entrusted',
        'Notice what multiplied',
        'Admit what was buried',
        'Recognize what compounded',
        'Rate the fruit',
        'Choose a theme',
        'Build one keystone system'
      ]);
  }

  function renderGuidedMonthly(){
    const main = document.getElementById('monthlyMain');
    const rail = document.getElementById('monthlySidebar');
    if(!main || !monthData) return;
    const m = monthData;
    const st = monthSectionStates(m);
    const steps = [
      { id:'entrusted', label:'Entrusted', state:st.entrusted },
      { id:'multiplied', label:'Multiplied', state:st.multiplied },
      { id:'buried', label:'Buried', state:st.buried },
      { id:'compounded', label:'Compounded', state:st.compounded },
      { id:'fruit', label:'Fruit', state:st.fruit },
      { id:'theme', label:'Theme', state:st.theme },
      { id:'keystone', label:'Keystone', state:st.keystone }
    ];

    const entrustedBody = '<div class="gr-compact-grid">'+
      ['work','school','body','money','relationships','faith','opportunities'].map(k=>
        compactField('entrusted.'+k, k.charAt(0).toUpperCase()+k.slice(1), '')
      ).join('')+'</div>';

    const multipliedBody = '<div class="gr-compact-grid">'+
      ['skills','habits','relationships','knowledge','leadership','service'].map(k=>
        compactField('multiplied.'+k, k.charAt(0).toUpperCase()+k.slice(1), '')
      ).join('')+'</div>';

    const buriedBody =
      compactField('buried.avoided','What did I avoid?','')+
      compactField('buried.whyAvoided','Why did I avoid it?','')+
      compactField('buried.support','What support or system would help next month?','');

    const compoundedBody = '<div class="gr-compact-grid">'+
      compactField('compounded.smallAct','Small act that helped more than expected','')+
      compactField('compounded.smallNeglect','Small neglect that cost more than expected','')+
      '</div>';

    const themeChips = ['Order','Diligence','Peace','Courage','Faithfulness','Stewardship','Multiplication']
      .map(c=>'<button type="button" class="gr-chip" data-gr-theme-chip="'+esc(c)+'">'+esc(c)+'</button>').join('');
    const themeBody =
      compactInput('theme','',"Order before overflow · Diligence in hidden places · Faithful with little…")+
      '<div class="gr-chips">'+themeChips+'</div>';

    const keystoneChips = ['Morning setup','Budget check-in','Weekly planning','No-phone evening','Workout schedule','Study block system']
      .map(c=>'<button type="button" class="gr-chip" data-gr-keystone-chip="'+esc(c)+'">'+esc(c)+'</button>').join('');
    const keystoneBody =
      compactField('keystone','','The one system that unlocks faithfulness…')+
      '<div class="gr-chips">'+keystoneChips+'</div>';

    main.innerHTML =
      progressPills(steps, monthOpen, 'month')+
      monthSummaryCards(m)+
      accordion('entrusted',1,'First Fruits','What was entrusted to me this month?','Name the areas God gave you to steward.',st.entrusted,entrustedBody,'month')+
      accordion('multiplied',2,'Multiplied','What did I multiply?','Where did faithfulness create growth?',st.multiplied,multipliedBody,'month')+
      accordion('buried',3,'Buried','What did I bury or neglect?','Not shame — honest inventory.',st.buried,buriedBody,'month')+
      accordion('compounded',4,'Compounded','What small details compounded?','The power of small acts.',st.compounded,compoundedBody,'month')+
      accordion('fruit',5,'Fruit of the Spirit Check','Galatians 5:22–23','Rate each fruit. Notes stay optional.',st.fruit,renderFruitGridCompact(m),'month')+
      accordion('theme',6,"Next Month's Theme",'What word or phrase will carry the month?','',st.theme,themeBody,'month')+
      accordion('keystone',7,'Keystone System','What one system will make the biggest difference?','',st.keystone,keystoneBody,'month');

    if(rail) rail.innerHTML = renderMonthlySidebar(m);
    showSticky('monthlyStickyBar', true);
    showSticky('weeklyStickyBar', false);
    populateFields?.(main, m);
  }

  async function computeGuidedWeekScorecard(){
    const mon = mondayOf(weekOffset);
    const days = [];
    for(let i=0;i<7;i++){ const d=new Date(mon); d.setDate(mon.getDate()+i); days.push(iso(d)); }
    const stats = {mustDo:0,body:0,order:0,leadership:0,skill:0,journal:0,study:0,guardrail:0};
    for(const ds of days){
      const dd = await getJSON('fs-day:'+ds);
      if(dd){
        FF_KEYS.forEach(f=>{ if(ffCategoryComplete(ffGetItems(dd, f.key))) stats[f.key]++; });
        if(dd.execute?.studyBlock?.done) stats.study++;
        if(dd.danger?.guardrailKept) stats.guardrail++;
      }
      const j = await getJSON('journal:'+ds);
      if(j?.body?.trim()) stats.journal++;
    }
    weekScoreStats = {};
    Object.keys(stats).forEach(k=>{ weekScoreStats[k] = Math.round(stats[k]/7*100); });
    return weekScoreStats;
  }

  async function loadGuidedWeekly(){
    weekData = normalizeWeekly(await getJSON(weekKeyFor(weekOffset)));
    await computeGuidedWeekScorecard();
    renderGuidedWeekly();
    renderIdeaTriage?.();
  }

  async function loadGuidedMonthly(){
    monthData = normalizeMonth(await getJSON(monthKeyFor(monthOffset)));
    fruitNoteOpen = null;
    renderGuidedMonthly();
  }

  function openSection(kind, id){
    if(kind === 'week'){ weekOpen = id; renderGuidedWeekly(); }
    else { monthOpen = id; renderGuidedMonthly(); }
    setTimeout(()=> document.getElementById('sec-'+id)?.scrollIntoView({ behavior:'smooth', block:'start' }), 40);
  }

  function bindReviewEvents(){
    if(document.body.dataset.grReviewBound) return;
    document.body.dataset.grReviewBound = '1';
    const app = document.getElementById('app') || document.body;

    app.addEventListener('click', async e=>{
      const goto = e.target.closest('[data-gr-goto]');
      if(goto){
        openSection(goto.dataset.grKind, goto.dataset.grGoto);
        return;
      }

      const act = e.target.closest('[data-gr-act]');
      if(act){
        const a = act.dataset.grAct;
        if(a === 'save-week' || a === 'save-month'){ await save?.(); return; }
        if(a === 'mark-week'){
          if(weekData){ weekData.reviewComplete = true; markDirty?.(); renderGuidedWeekly(); await save?.(); }
          return;
        }
        if(a === 'mark-month'){
          if(monthData){ monthData.reviewComplete = true; markDirty?.(); renderGuidedMonthly(); await save?.(); }
          return;
        }
        if(a === 'carry-week'){
          if(!weekData) return;
          const focus = (weekData.nextWeekFocus || weekData.planWeek?.top3 || '').trim();
          if(!focus){ alert('Set a next-week focus first.'); return; }
          weekData.nextWeekFocus = focus.split('\n')[0].slice(0,120);
          markDirty?.();
          renderGuidedWeekly();
          await save?.();
          return;
        }
        if(a === 'carry-month'){
          if(!monthData?.theme?.trim()){ alert('Choose a theme first.'); return; }
          markDirty?.();
          await save?.();
          return;
        }
        if(a === 'clear-week' || a === 'clear-month'){ clearCurrent?.(); return; }
      }

      const themeChip = e.target.closest('[data-gr-theme-chip]');
      if(themeChip && monthData){
        monthData.theme = themeChip.dataset.grThemeChip;
        markDirty?.();
        renderGuidedMonthly();
        return;
      }
      const keyChip = e.target.closest('[data-gr-keystone-chip]');
      if(keyChip && monthData){
        monthData.keystone = keyChip.dataset.grKeystoneChip;
        markDirty?.();
        renderGuidedMonthly();
        return;
      }

      const fruitNote = e.target.closest('[data-gr-fruit-note]');
      if(fruitNote){
        const i = +fruitNote.dataset.grFruitNote;
        fruitNoteOpen = fruitNoteOpen === i ? null : i;
        document.querySelectorAll('[data-fruit-card]').forEach(card=>{
          const idx = +card.dataset.fruitCard;
          card.classList.toggle('note-open', fruitNoteOpen === idx);
        });
        return;
      }

      const fruit = e.target.closest('[data-fruit]');
      if(fruit && isMonthly?.() && monthData){
        monthData.fruitOfSpirit[+fruit.dataset.fruit].rating = +fruit.dataset.v;
        markDirty?.();
        renderGuidedMonthly();
        return;
      }
    });

    app.addEventListener('toggle', e=>{
      const det = e.target.closest('details.gr-card[data-gr-acc]');
      if(!det || !det.open) return;
      const kind = det.dataset.grKind;
      const id = det.dataset.grAcc;
      if(kind === 'week') weekOpen = id;
      else monthOpen = id;
      document.querySelectorAll('details.gr-card[data-gr-kind="'+kind+'"]').forEach(d=>{
        if(d !== det) d.open = false;
      });
    }, true);

    app.addEventListener('toggle', e=>{
      const prompt = e.target.closest('details.gr-prompt[data-gr-one]');
      if(!prompt || !prompt.open) return;
      const wrap = prompt.parentElement;
      wrap?.querySelectorAll('details.gr-prompt[data-gr-one]').forEach(d=>{
        if(d !== prompt) d.open = false;
      });
    }, true);
  }

  root.renderGuidedWeekly = renderGuidedWeekly;
  root.renderGuidedMonthly = renderGuidedMonthly;
  root.loadGuidedWeekly = loadGuidedWeekly;
  root.loadGuidedMonthly = loadGuidedMonthly;
  root.bindReviewEvents = bindReviewEvents;
  root.computeGuidedWeekScorecard = computeGuidedWeekScorecard;

})(typeof window !== 'undefined' ? window : globalThis);
