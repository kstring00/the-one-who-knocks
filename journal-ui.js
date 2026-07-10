/**
 * Journal tab — hero, prompts, gratitude, consistency tracking
 */
(function(root){
  'use strict';

  const DEFAULT_REFLECTION_PROMPTS = [
    "Where did I see God's hand today?",
    'What challenged my faith or patience?',
    'What can I do better tomorrow?',
    'What am I carrying that I need to release to the Lord?',
    'Where did I notice faithfulness in small things today?'
  ];

  const JOURNAL_VERSES = [
    { text: 'Be still, and know that I am God.', ref: 'Psalm 46:10' },
    { text: 'The LORD is my shepherd; I shall not want.', ref: 'Psalm 23:1' },
    { text: 'Commit your work to the LORD, and your plans will be established.', ref: 'Proverbs 16:3' },
    { text: 'Whatever you do, do it from the heart, as something done for the Lord.', ref: 'Colossians 3:23' },
    { text: 'Cast all your anxiety on him because he cares for you.', ref: '1 Peter 5:7' },
    { text: 'Your word is a lamp for my feet, a light on my path.', ref: 'Psalm 119:105' },
    { text: 'Trust in the LORD with all your heart and lean not on your own understanding.', ref: 'Proverbs 3:5' }
  ];

  const CUSTOM_PROMPTS_KEY = 'fs:journal-custom-prompts';

  function getCustomPrompts(){
    try{ return JSON.parse(localStorage.getItem(CUSTOM_PROMPTS_KEY) || '[]'); }
    catch(e){ return []; }
  }

  function setCustomPrompts(list){
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(list));
    if(typeof root.scheduleCloudPush === 'function') root.scheduleCloudPush([CUSTOM_PROMPTS_KEY]);
  }

  function getAllPrompts(){
    return [...DEFAULT_REFLECTION_PROMPTS, ...getCustomPrompts()];
  }

  function verseForDate(dateStr){
    const d = new Date(dateStr + 'T12:00:00');
    const start = new Date(d.getFullYear(), 0, 0);
    const dayNum = Math.floor((d - start) / 86400000);
    return JOURNAL_VERSES[dayNum % JOURNAL_VERSES.length];
  }

  function normalizeJournal(raw){
    const g = raw?.gratitude;
    return {
      body: String(raw?.body || ''),
      gratitude: Array.isArray(g)
        ? [g[0] || '', g[1] || '', g[2] || '']
        : ['', '', ''],
      updated: raw?.updated || null
    };
  }

  function journalHasEntry(j){
    const body = (j?.body || '').trim();
    return body.length > 0;
  }

  function wordCount(text){
    const t = String(text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  async function computeJournalStats(refOffset, liveEntry){
    const r = await window.storage.list('journal:');
    const keys = r?.keys || [];
    const byDate = {};
    let totalWords = 0;

    await Promise.all(keys.map(async k=>{
      const j = await getJSON(k);
      if(!j) return;
      const date = k.slice(8);
      const words = wordCount(j.body);
      totalWords += words;
      byDate[date] = { words, hasEntry: journalHasEntry(j) };
    }));

    const off = typeof refOffset === 'number' ? refOffset : dayOffset;
    const todayStr = iso(dayOf(off));
    if(liveEntry){
      const words = wordCount(liveEntry.body);
      const prev = byDate[todayStr]?.words || 0;
      totalWords = totalWords - prev + words;
      byDate[todayStr] = { words, hasEntry: journalHasEntry(liveEntry) };
    }

    const weekStart = mondayOf(off);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let entriesThisWeek = 0;
    Object.entries(byDate).forEach(([date, info])=>{
      const d = new Date(date + 'T12:00:00');
      if(d >= weekStart && d < weekEnd && info.hasEntry) entriesThisWeek++;
    });

    let streak = 0;
    let streakOff = off;
    if(!byDate[todayStr]?.hasEntry) streakOff--;

    for(; streakOff >= -400; streakOff--){
      const ds = iso(dayOf(streakOff));
      if(byDate[ds]?.hasEntry) streak++;
      else if(streak > 0) break;
    }

    const weekPct = Math.min(100, Math.round(entriesThisWeek / 7 * 100));
    const streakLabel = streak === 1 ? '1 day' : streak + ' days';
    const weekSub = entriesThisWeek >= 5 ? 'Keep it up' : entriesThisWeek >= 1 ? 'Building rhythm' : 'Start today';

    return {
      entriesThisWeek,
      streak,
      streakLabel,
      totalWords,
      weekPct,
      weekSub
    };
  }

  function renderPromptsList(){
    const el = document.getElementById('journalPromptsList');
    if(!el) return;
    el.innerHTML = getAllPrompts().map((p, i)=>
      '<button type="button" class="journal-prompt-item" data-jprompt="'+i+'">'+
      '<span class="journal-prompt-num">'+(i+1)+'</span><span>'+esc(p)+'</span></button>'
    ).join('');
  }

  function renderSnapshot(stats){
    const el = document.getElementById('journalSnapshot');
    if(!el || !stats) return;
    el.innerHTML =
      '<div class="journal-stat-grid">'+
      '<div class="journal-stat"><span class="journal-stat-val">'+stats.entriesThisWeek+'</span>'+
      '<span class="journal-stat-lbl">Entries this week</span><span class="journal-stat-sub">'+esc(stats.weekSub)+'</span></div>'+
      '<div class="journal-stat"><span class="journal-stat-val">'+stats.streakLabel+'</span>'+
      '<span class="journal-stat-lbl">Current streak</span></div>'+
      '<div class="journal-stat"><span class="journal-stat-val">'+stats.totalWords.toLocaleString()+'</span>'+
      '<span class="journal-stat-lbl">Total words</span><span class="journal-stat-sub">All time</span></div>'+
      '</div>'+
      '<div class="journal-progress-wrap">'+
      '<div class="journal-progress-bar"><div class="journal-progress-fill" style="width:'+stats.weekPct+'%"></div></div>'+
      '<div class="journal-progress-meta"><span>'+stats.weekPct+'%</span></div></div>'+
      '<p class="journal-progress-caption">Faithfulness is built in the hidden moments.</p>';
  }

  function renderHero(dateStr){
    const v = verseForDate(dateStr);
    const verseEl = document.getElementById('journalVerseText');
    const refEl = document.getElementById('journalVerseRef');
    if(verseEl) verseEl.textContent = '"' + v.text + '"';
    if(refEl) refEl.textContent = v.ref;
  }

  function populateGratitude(){
    if(typeof journal === 'undefined' || !journal) return;
    [0, 1, 2].forEach(i=>{
      const inp = document.getElementById('journalGratitude' + (i + 1));
      if(inp) inp.value = journal.gratitude?.[i] || '';
    });
  }

  async function refreshJournalUI(){
    const dateStr = iso(dayOf(dayOffset));
    renderHero(dateStr);
    renderPromptsList();
    populateGratitude();
    await refreshJournalSnapshot();
  }

  let snapshotTimer = null;
  async function refreshJournalSnapshot(){
    const live = typeof journal !== 'undefined' ? journal : null;
    const stats = await computeJournalStats(dayOffset, live);
    renderSnapshot(stats);
  }

  function scheduleSnapshotRefresh(){
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(refreshJournalSnapshot, 500);
  }

  function dayOffsetFromDateStr(dateStr){
    const target = new Date(dateStr + 'T12:00:00');
    const base = dayOf(0);
    base.setHours(12, 0, 0, 0);
    return Math.round((target - base) / 86400000);
  }

  function formatJournalListDate(dateStr){
    const today = iso(dayOf(0));
    if(dateStr === today) return 'Today';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function updateJournalEntryHead(dateStr){
    const h = document.querySelector('.journal-entry-head h3');
    if(!h) return;
    const today = iso(dayOf(0));   // device clock, resolved now
    if(dateStr === today){
      h.textContent = "Today's entry";
    } else {
      h.textContent = formatJournalListDate(dateStr);
    }
    // Day-scope chip so it's obvious which day this entry belongs to.
    const chip = document.createElement('span');
    chip.className = 'day-scope-chip';
    chip.setAttribute('data-day-scope-chip', '');
    h.appendChild(chip);
    if(typeof root.refreshDayScopeUI === 'function') root.refreshDayScopeUI();
  }

  function syncJournalFromDom(){
    if(typeof journal === 'undefined') return;
    if(typeof normalizeJournal === 'function') journal = normalizeJournal(journal);
    const ta = document.getElementById('journalBody');
    if(ta) journal.body = ta.value;
    if(!journal.gratitude) journal.gratitude = ['', '', ''];
    [1, 2, 3].forEach(n=>{
      const el = document.getElementById('journalGratitude' + n);
      if(el) journal.gratitude[n - 1] = el.value;
    });
  }

  async function flushJournalEntry(){
    if(typeof dayOffset === 'undefined') return;
    syncJournalFromDom();
    const key = journalKeyFor(dayOffset);
    const hasContent = (journal.body || '').trim() || (journal.gratitude || []).some(g=> String(g).trim());
    if(hasContent){
      journal.updated = journal.updated || Date.now();
      await window.storage.set(key, JSON.stringify(journal));
      if(typeof setLocalSyncAt === 'function') setLocalSyncAt(key, Date.now());
      if(typeof scheduleCloudPush === 'function') scheduleCloudPush([key]);
    }
    if(typeof dirty !== 'undefined') dirty = false;
    if(typeof updateSaveState === 'function') updateSaveState('saved');
  }

  async function navigateToJournalDate(dateStr){
    if(!dateStr) return;
    const curDate = iso(dayOf(dayOffset));
    if(dateStr !== curDate) await flushJournalEntry();
    dayOffset = dayOffsetFromDateStr(dateStr);
    if(typeof loadJournal === 'function') await loadJournal();
  }

  async function renderJournalList(){
    const ul = document.getElementById('journalList');
    if(!ul) return;
    const r = await window.storage.list('journal:');
    const keys = (r?.keys || []).sort().reverse().slice(0, 30);
    const cur = iso(dayOf(dayOffset));
    ul.innerHTML = keys.map(k=>{
      const d = k.slice(8);
      return '<li><button type="button" class="'+(d === cur ? 'on' : '')+'" data-jdate="'+d+'">'+esc(formatJournalListDate(d))+'</button></li>';
    }).join('') || '<li class="hint">No past entries</li>';
  }

  function previewForMatch(text, q){
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if(!raw) return '';
    const i = raw.toLowerCase().indexOf(q.toLowerCase());
    const start = i < 0 ? 0 : Math.max(0, i - 40);
    const snip = raw.slice(start, start + 140);
    if(i < 0) return esc(snip);
    const rel = i - start;
    return esc(snip.slice(0, rel)) + '<mark>' + esc(snip.slice(rel, rel + q.length)) + '</mark>' + esc(snip.slice(rel + q.length));
  }

  async function searchJournalEntries(query){
    const host = document.getElementById('journalSearchResults');
    if(!host) return;
    const q = String(query || '').trim();
    if(!q){
      host.innerHTML = '';
      return;
    }
    const r = await window.storage.list('journal:');
    const keys = (r?.keys || []).sort().reverse();
    const rows = [];
    for(const k of keys){
      const j = normalizeJournal(await getJSON(k));
      const d = k.slice(8);
      const hay = [d, formatJournalListDate(d), j.body, ...(j.gratitude || [])].join('\n');
      if(!hay.toLowerCase().includes(q.toLowerCase())) continue;
      rows.push({ date:d, body:j.body || (j.gratitude || []).join(' ') });
      if(rows.length >= 30) break;
    }
    host.innerHTML = rows.length ? rows.map(r=>
      '<button type="button" class="journal-search-result" data-jdate="'+esc(r.date)+'">'+
      '<strong>'+esc(formatJournalListDate(r.date))+'</strong><span>'+previewForMatch(r.body, q)+'</span></button>'
    ).join('') : '<p class="app-empty-state">An honest line is enough to begin.</p>';
  }

  function insertAtCursor(ta, before, after){
    if(!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = ta.value;
    const sel = val.slice(s, e);
    ta.value = val.slice(0, s) + before + sel + after + val.slice(e);
    ta.selectionStart = s + before.length;
    ta.selectionEnd = s + before.length + sel.length;
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function lineBounds(ta){
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = ta.value;
    const start = val.lastIndexOf('\n', Math.max(0, s - 1)) + 1;
    const end = val.indexOf('\n', e);
    return { start, end: end === -1 ? val.length : end };
  }

  function prefixSelectionLines(ta, prefix){
    if(!ta) return;
    const b = lineBounds(ta);
    const val = ta.value;
    const block = val.slice(b.start, b.end);
    const next = block.split('\n').map(line=> line.startsWith(prefix) ? line : prefix + line).join('\n');
    ta.value = val.slice(0, b.start) + next + val.slice(b.end);
    ta.selectionStart = b.start + prefix.length;
    ta.selectionEnd = b.start + next.length;
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setHeading(ta, level){
    if(!ta) return;
    const b = lineBounds(ta);
    const val = ta.value;
    const line = val.slice(b.start, b.end).replace(/^#{1,6}\s+/, '');
    const prefix = '#'.repeat(level) + ' ';
    ta.value = val.slice(0, b.start) + prefix + line + val.slice(b.end);
    ta.selectionStart = ta.selectionEnd = b.start + prefix.length + line.length;
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function toggleChecklistLine(ta){
    if(!ta) return;
    const b = lineBounds(ta);
    const val = ta.value;
    let line = val.slice(b.start, b.end);
    if(/^- \[ \] /.test(line)) line = line.replace(/^- \[ \] /, '- [x] ');
    else if(/^- \[x\] /i.test(line)) line = line.replace(/^- \[x\] /i, '- [ ] ');
    else line = '- [ ] ' + line.replace(/^[-*]\s+/, '');
    ta.value = val.slice(0, b.start) + line + val.slice(b.end);
    ta.selectionStart = ta.selectionEnd = b.start + line.length;
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function applyTypingShortcut(ta){
    const b = lineBounds(ta);
    const before = ta.value.slice(b.start, ta.selectionStart);
    if(before === '[] '){
      ta.setRangeText('- [ ] ', b.start, ta.selectionStart, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function bindJournalEvents(){
    if(document.body.dataset.journalBound) return;
    document.body.dataset.journalBound = '1';

    document.getElementById('journalToolbar')?.addEventListener('click', e=>{
      const btn = e.target.closest('[data-jtool]');
      if(!btn) return;
      const ta = document.getElementById('journalBody');
      const t = btn.dataset.jtool;
      if(t === 'h1') setHeading(ta, 1);
      else if(t === 'h2') setHeading(ta, 2);
      else if(t === 'h3') setHeading(ta, 3);
      else if(t === 'bold') insertAtCursor(ta, '**', '**');
      else if(t === 'italic') insertAtCursor(ta, '_', '_');
      else if(t === 'bullet') prefixSelectionLines(ta, '- ');
      else if(t === 'num') prefixSelectionLines(ta, '1. ');
      else if(t === 'check') toggleChecklistLine(ta);
      else if(t === 'quote') prefixSelectionLines(ta, '> ');
    });

    document.getElementById('journalPromptsList')?.addEventListener('click', e=>{
      const btn = e.target.closest('[data-jprompt]');
      if(!btn) return;
      const prompts = getAllPrompts();
      const p = prompts[+btn.dataset.jprompt];
      if(!p) return;
      const ta = document.getElementById('journalBody');
      if(!ta) return;
      const prefix = ta.value.trim() ? '\n\n' : '';
      ta.value = ta.value + prefix + p + '\n';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.focus();
    });

    document.getElementById('journalAddPromptBtn')?.addEventListener('click', ()=>{
      const text = prompt('Add your own reflection prompt:');
      if(!text?.trim()) return;
      const custom = getCustomPrompts();
      custom.push(text.trim());
      setCustomPrompts(custom);
      renderPromptsList();
    });

    [1, 2, 3].forEach(n=>{
      document.getElementById('journalGratitude' + n)?.addEventListener('input', e=>{
        if(typeof journal === 'undefined') return;
        if(!journal.gratitude) journal.gratitude = ['', '', ''];
        journal.gratitude[n - 1] = e.target.value;
        journal.updated = Date.now();
        markDirty?.();
      });
    });

    document.getElementById('journalPastToggle')?.addEventListener('click', ()=>{
      document.getElementById('journalPastPanel')?.classList.toggle('open');
    });

    document.getElementById('journalList')?.addEventListener('click', async e=>{
      const btn = e.target.closest('[data-jdate]');
      if(!btn) return;
      e.preventDefault();
      await navigateToJournalDate(btn.dataset.jdate);
    });

    document.getElementById('journalSearch')?.addEventListener('input', e=>{
      clearTimeout(bindJournalEvents._searchT);
      bindJournalEvents._searchT = setTimeout(()=> searchJournalEntries(e.target.value), 180);
    });
    document.getElementById('journalSearchResults')?.addEventListener('click', async e=>{
      const btn = e.target.closest('[data-jdate]');
      if(!btn) return;
      e.preventDefault();
      await navigateToJournalDate(btn.dataset.jdate);
    });
    document.getElementById('journalBody')?.addEventListener('keyup', e=>{
      if(e.key === ' ') applyTypingShortcut(e.target);
    });
  }

  function journalPromptForDay(){
    const dateStr = iso(dayOf(typeof dayOffset === 'number' ? dayOffset : 0));
    return getAllPrompts()[0] || DEFAULT_REFLECTION_PROMPTS[0];
  }

  root.normalizeJournal = normalizeJournal;
  root.refreshJournalUI = refreshJournalUI;
  root.refreshJournalSnapshot = refreshJournalSnapshot;
  root.scheduleSnapshotRefresh = scheduleSnapshotRefresh;
  root.bindJournalEvents = bindJournalEvents;
  root.computeJournalStats = computeJournalStats;
  root.journalPromptForDay = journalPromptForDay;
  root.getAllJournalPrompts = getAllPrompts;
  root.verseForDate = verseForDate;
  root.renderJournalList = renderJournalList;
  root.searchJournalEntries = searchJournalEntries;
  root.navigateToJournalDate = navigateToJournalDate;
  root.updateJournalEntryHead = updateJournalEntryHead;
  root.flushJournalEntry = flushJournalEntry;

})(typeof window !== 'undefined' ? window : globalThis);
