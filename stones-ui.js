/**
 * Stones — Joshua 4. Twelve stones from the riverbed, kept so that when your
 * children ask "what do these mean," you can tell them what God did.
 *
 * Deliberately small. A list of two kinds of thing:
 *   - Truth  — something the person believes (handed back to steady them).
 *   - Marker — something they survived or watched God do (proof they've done
 *              hard things before).
 *
 * Nothing here is ever "done." No stages, no progress, no completion.
 * One record: { id, type:'truth'|'marker', text, source, date }.
 * Stored under fs-stones, synced like everything else, works signed-out.
 */
(function(root){
  'use strict';

  const STORAGE_KEY = 'fs-stones';
  const SHOW_ODDS = 3;          // dashboard card appears roughly one day in three
  const REPEAT_WINDOW_DAYS = 30; // don't resurface the same stone within this many days
  const PICKS_CAP = 90;

  // Never null, so a render that races init reads empty instead of throwing.
  let data = { version: 1, stones: [], picks: [] };
  let loaded = false;

  function esc(s){ return typeof root.esc === 'function' ? root.esc(s) : String(s ?? ''); }
  function uid(){
    if(typeof root.uid === 'function') return root.uid();
    if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'stone-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function todayStr(offset){
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    d.setHours(12, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  function normalize(raw){
    const out = { version: 1, stones: [], picks: [] };
    if(Array.isArray(raw?.stones)){
      out.stones = raw.stones
        .filter(s => s && typeof s.text === 'string' && s.text.trim())
        .map(s => ({
          id: s.id || uid(),
          type: s.type === 'marker' ? 'marker' : 'truth',
          text: String(s.text).trim(),
          source: String(s.source || '').trim(),
          date: s.date || todayStr()
        }));
    }
    if(Array.isArray(raw?.picks)){
      out.picks = raw.picks
        .filter(p => p && p.date)
        .map(p => ({ date: p.date, id: p.id || null }))
        .slice(-PICKS_CAP);
    }
    return out;
  }

  async function load(){
    try{
      const r = await root.storage?.get(STORAGE_KEY);
      data = normalize(r?.value ? JSON.parse(r.value) : null);
    }catch(e){
      console.warn('[Stones] load failed, starting empty', e);
      data = { version: 1, stones: [], picks: [] };
    }
    loaded = true;
    return data;
  }

  let readyPromise = null;
  function init(){
    if(!readyPromise) readyPromise = load();
    return readyPromise;
  }

  async function reload(){ readyPromise = load(); return readyPromise; }

  async function persist(){
    if(!loaded) return;   // never write the blank placeholder over persisted data
    try{ await root.storage?.set(STORAGE_KEY, JSON.stringify(data)); }
    catch(e){ console.warn('[Stones] save failed', e); }
    if(typeof root.setLocalSyncAt === 'function') root.setLocalSyncAt(STORAGE_KEY, Date.now());
    if(typeof root.scheduleCloudPush === 'function') root.scheduleCloudPush([STORAGE_KEY]);
  }

  /* ── data ops (newest first) ─────────────────────────────────── */
  function list(){ return data.stones.slice(); }

  function add(p){
    const text = String(p?.text || '').trim();
    if(!text) return null;
    const stone = {
      id: uid(),
      type: p?.type === 'marker' ? 'marker' : 'truth',
      text,
      source: String(p?.source || '').trim(),
      date: todayStr()
    };
    data.stones.unshift(stone);   // newest first
    persist();
    return stone;
  }

  function update(id, p){
    const s = data.stones.find(x => x.id === id);
    if(!s) return null;
    if(typeof p.text === 'string') s.text = p.text.trim();
    if(p.type === 'truth' || p.type === 'marker') s.type = p.type;
    if(typeof p.source === 'string') s.source = p.source.trim();
    persist();
    return s;
  }

  function remove(id){
    const before = data.stones.length;
    data.stones = data.stones.filter(x => x.id !== id);
    if(data.stones.length !== before) persist();
  }

  /* ── dashboard pick: one stone, some mornings, never twice running ── */
  function dateHash(str){
    let h = 0;
    for(let i = 0; i < str.length; i++){ h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function daysBetween(a, b){
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }

  /** The stone to surface on the dashboard today, or null. Decision is recorded
   *  so it's stable within a day and can enforce the no-repeat rules. */
  function stoneForToday(){
    if(!data.stones.length) return null;
    const today = todayStr();

    const existing = data.picks.find(p => p.date === today);
    if(existing){
      return existing.id ? (data.stones.find(s => s.id === existing.id) || null) : null;
    }

    // Never twice in a row: if yesterday surfaced a stone, rest today.
    const yesterday = todayStr(-1);
    const yPick = data.picks.find(p => p.date === yesterday);
    let show = !(yPick && yPick.id);
    // Otherwise, roughly one morning in three.
    if(show) show = (dateHash(today) % SHOW_ODDS === 0);

    let chosen = null;
    if(show){
      const recentIds = data.picks
        .filter(p => p.id && daysBetween(p.date, today) <= REPEAT_WINDOW_DAYS)
        .map(p => p.id);
      let pool = data.stones.filter(s => !recentIds.includes(s.id));
      if(!pool.length){
        // everything shown recently — avoid only the most recent, then anything
        const lastId = [...data.picks].reverse().find(p => p.id)?.id;
        pool = data.stones.filter(s => s.id !== lastId);
        if(!pool.length) pool = data.stones.slice();
      }
      chosen = pool[dateHash(today) % pool.length] || null;
    }

    data.picks.push({ date: today, id: chosen ? chosen.id : null });
    if(data.picks.length > PICKS_CAP) data.picks = data.picks.slice(-PICKS_CAP);
    persist();
    return chosen;
  }

  /* ── dashboard card (quiet; text + source, no buttons) ───────── */
  function renderStoneCard(){
    const stone = stoneForToday();
    if(!stone) return '';
    return '<aside class="stone-card" aria-label="A stone worth keeping">'+
      '<div class="stone-card-mark" aria-hidden="true">'+ (stone.type === 'marker' ? '⛰' : '◈') +'</div>'+
      '<div class="stone-card-body">'+
        '<p class="stone-card-text serif">'+esc(stone.text)+'</p>'+
        (stone.source ? '<p class="stone-card-source">'+esc(stone.source)+'</p>' : '')+
      '</div>'+
    '</aside>';
  }

  /* ── the tab ─────────────────────────────────────────────────── */
  let formOpen = false;
  let editingId = null;
  let draftType = 'truth';

  function fmtDate(dateStr){
    if(!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    if(isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderForm(){
    const editing = editingId ? data.stones.find(s => s.id === editingId) : null;
    const text = editing ? editing.text : '';
    const source = editing ? editing.source : '';
    const type = editing ? editing.type : draftType;
    return '<div class="stone-form" id="stoneForm">'+
      '<div class="stone-form-toggle" role="group" aria-label="Kind of stone">'+
        '<button type="button" class="stone-seg'+(type==='truth'?' on':'')+'" data-stone-type-btn="truth">Truth</button>'+
        '<button type="button" class="stone-seg'+(type==='marker'?' on':'')+'" data-stone-type-btn="marker">Marker</button>'+
      '</div>'+
      '<p class="stone-form-hint" id="stoneFormHint">'+ (type==='marker'
          ? 'Something you survived, finished, or watched God do. Evidence.'
          : 'Something you believe. A conviction, a line worth living by.') +'</p>'+
      '<textarea id="stoneText" class="stone-textarea" rows="3" placeholder="Set it down in your own words…">'+esc(text)+'</textarea>'+
      '<input type="text" id="stoneSource" class="stone-source-input" placeholder="Where it came from — a verse, a person, a day (optional)" value="'+esc(source)+'">'+
      '<div class="stone-form-actions">'+
        '<button type="button" class="stone-save-btn" id="stoneSaveBtn">'+(editing ? 'Save changes' : 'Set it down')+'</button>'+
        '<button type="button" class="stone-cancel-btn" id="stoneCancelBtn">Cancel</button>'+
      '</div>'+
    '</div>';
  }

  function renderStoneRow(s){
    const label = s.type === 'marker' ? 'Marker' : 'Truth';
    return '<li class="stone-item stone-'+s.type+'" data-stone-id="'+esc(s.id)+'">'+
      '<div class="stone-item-main">'+
        '<span class="stone-tag stone-tag-'+s.type+'">'+label+'</span>'+
        '<p class="stone-item-text serif">'+esc(s.text)+'</p>'+
        (s.source ? '<p class="stone-item-source">'+esc(s.source)+'</p>' : '')+
        '<p class="stone-item-date">Set down '+esc(fmtDate(s.date))+'</p>'+
      '</div>'+
      '<div class="stone-item-actions">'+
        '<button type="button" class="stone-mini" data-stone-edit="'+esc(s.id)+'" aria-label="Edit this stone">Edit</button>'+
        '<button type="button" class="stone-mini stone-mini-quiet" data-stone-remove="'+esc(s.id)+'" aria-label="Remove this stone">Remove</button>'+
      '</div>'+
    '</li>';
  }

  function renderStonesPanel(){
    const panel = document.getElementById('stonesBody');
    if(!panel) return;
    const stones = list();
    let html = '';

    html += '<div class="stones-top">'+
      (formOpen ? '' : '<button type="button" class="stone-setdown-btn" id="stoneSetDownBtn">＋ Set down a stone</button>')+
    '</div>';

    if(formOpen) html += renderForm();

    if(!stones.length && !formOpen){
      html += '<div class="stones-empty">'+
        '<div class="stones-empty-mark" aria-hidden="true">◈</div>'+
        '<p class="stones-empty-lead serif">Set down what you will need to remember later.</p>'+
        '<p class="stones-empty-body">A stone can be a truth God taught you or a remembered victory He carried you through.</p>'+
      '</div>';
    } else if(stones.length){
      html += '<ul class="stones-list">'+ stones.map(renderStoneRow).join('') +'</ul>';
    }

    panel.innerHTML = html;
  }

  function openForm(type){
    formOpen = true;
    editingId = null;
    draftType = (type === 'marker') ? 'marker' : 'truth';
    renderStonesPanel();
    document.getElementById('stoneText')?.focus();
  }
  function openEdit(id){
    const s = data.stones.find(x => x.id === id);
    if(!s) return;
    formOpen = true;
    editingId = id;
    draftType = s.type;
    renderStonesPanel();
    document.getElementById('stoneText')?.focus();
  }
  function closeForm(){
    formOpen = false;
    editingId = null;
    renderStonesPanel();
  }

  function saveForm(){
    const ta = document.getElementById('stoneText');
    const src = document.getElementById('stoneSource');
    const text = (ta?.value || '').trim();
    if(!text){ ta?.focus(); return; }
    const source = (src?.value || '').trim();
    if(editingId) update(editingId, { text, source, type: draftType });
    else add({ type: draftType, text, source });
    closeForm();
  }

  function loadStones(){
    init().then(renderStonesPanel);
  }

  function bindStonesEvents(){
    const panel = document.getElementById('stonesPanel');
    if(!panel || panel.dataset.bound) return;
    panel.dataset.bound = '1';

    panel.addEventListener('click', e=>{
      if(e.target.closest('#stoneSetDownBtn')){ openForm(draftType); return; }
      const seg = e.target.closest('[data-stone-type-btn]');
      if(seg){
        draftType = seg.dataset.stoneTypeBtn === 'marker' ? 'marker' : 'truth';
        panel.querySelectorAll('.stone-seg').forEach(b=> b.classList.toggle('on', b === seg));
        const hint = document.getElementById('stoneFormHint');
        if(hint) hint.textContent = draftType === 'marker'
          ? 'Something you survived, finished, or watched God do. Evidence.'
          : 'Something you believe. A conviction, a line worth living by.';
        return;
      }
      if(e.target.closest('#stoneSaveBtn')){ saveForm(); return; }
      if(e.target.closest('#stoneCancelBtn')){ closeForm(); return; }
      const edit = e.target.closest('[data-stone-edit]');
      if(edit){ openEdit(edit.dataset.stoneEdit); return; }
      const rm = e.target.closest('[data-stone-remove]');
      if(rm){
        const s = data.stones.find(x => x.id === rm.dataset.stoneRemove);
        const label = s && s.type === 'marker' ? 'marker' : 'stone';
        if(confirm('Remove this '+label+'? Nothing here is ever deleted automatically — this only removes it because you asked.')){
          remove(rm.dataset.stoneRemove);
          renderStonesPanel();
        }
        return;
      }
    });

    panel.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && (e.metaKey || e.ctrlKey) && formOpen){ e.preventDefault(); saveForm(); }
    });
  }

  root.StonesStore = { init, reload, list, add, update, remove, stoneForToday, get loaded(){ return loaded; } };
  root.renderStoneCard = renderStoneCard;
  root.renderStonesPanel = renderStonesPanel;
  root.loadStones = loadStones;
  root.bindStonesEvents = bindStonesEvents;
  root.openStoneForm = openForm;

})(typeof window !== 'undefined' ? window : globalThis);
