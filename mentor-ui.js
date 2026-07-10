/**
 * Stewardship Mentor — slide-in panel, streaming chat, action chips.
 */
(function(root){
  'use strict';

  const PROMPT_CHIPS = [
    'What should I do next?',
    'Help me plan today',
    'Help me reduce this',
    'Turn this thought into action'
  ];

  const ACTION_LABELS = {
    must_do: 'Add to Must-Dos',
    growth_rep: 'Add as Growth Rep',
    journal: 'Save to Journal',
    stone: 'Set down as a stone.'
  };

  const ERR_UNAVAILABLE = "I can't reach you right now. What's the one thing you already know you should do next?";
  const ERR_SIGNED_OUT = 'The Stewardship Mentor needs you to be signed in — your rhythm and your data stay yours that way.';
  const ERR_ZERO = "We've talked a lot today. Sit with what you have. I'll be here in the morning.";

  let history = [];
  let balance = null;
  let streaming = false;
  let abortCtrl = null;
  let pendingSource = 'general';
  let pendingPrompt = '';

  function esc(s){
    return typeof root.esc === 'function' ? root.esc(s) : String(s ?? '');
  }

  function reduced(){
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function profileName(){
    if(typeof root.normalizeProfile === 'function' && root.userProfile){
      const p = root.normalizeProfile(root.userProfile);
      if(p?.name?.trim()) return p.name.trim();
    }
    return '';
  }

  async function getAccessToken(){
    const client = root.sb || (typeof window !== 'undefined' ? window.sb : null);
    if(!client) return null;
    try{
      const { data: { session } } = await client.auth.getSession();
      return session?.access_token || null;
    }catch(e){ return null; }
  }

  function isSignedIn(){
    return typeof root.isSignedIn === 'function' ? root.isSignedIn() : !!root.authUser;
  }

  /* ── stream parsing: strip [[ACTION]] and [[CARE]] without flashing ── */
  const ACTION_RE = /\[\[ACTION\]\]([\s\S]*?)\[\[\/ACTION\]\]/g;
  const CARE_MARK = '[[CARE]]';

  function parseAssistantText(raw){
    let text = raw || '';
    let care = false;
    if(text.includes(CARE_MARK)){
      care = true;
      text = text.split(CARE_MARK).join('').trim();
    }
    const actions = [];
    let m;
    const re = new RegExp(ACTION_RE.source, 'g');
    while((m = re.exec(raw)) !== null){
      try{
        const obj = JSON.parse(m[1].trim());
        if(obj?.type && ACTION_LABELS[obj.type]) actions.push(obj);
      }catch(e){}
    }
    text = text.replace(ACTION_RE, '').trim();
    return { text, actions, care };
  }

  function stripPartialMarkers(buf){
    const markers = ['[[ACTION]]', '[[/ACTION]]', '[[CARE]]'];
    let safe = buf;
    for(const mk of markers){
      for(let len = mk.length - 1; len >= 1; len--){
        const partial = mk.slice(0, len);
        if(safe.endsWith(partial)) safe = safe.slice(0, -len);
      }
    }
    return safe;
  }

  function visibleFromBuffer(buf){
    const cleaned = stripPartialMarkers(buf);
    const parsed = parseAssistantText(cleaned);
    return parsed;
  }

  /* ── panel open/close ─────────────────────────────────────────── */
  function openMentorPanel(opts){
    opts = opts || {};
    pendingSource = opts.source || 'general';
    pendingPrompt = opts.prompt || '';

    const panel = document.getElementById('mentorPanel');
    const backdrop = document.getElementById('mentorBackdrop');
    if(!panel || !backdrop) return;

    backdrop.hidden = false;
    panel.hidden = false;
    requestAnimationFrame(()=>{
      backdrop.classList.add('open');
      panel.classList.add('open');
    });
    document.body.classList.add('mentor-open');

    renderPanelChrome();
    renderHistory();

    if(pendingPrompt){
      const p = pendingPrompt;
      pendingPrompt = '';
      sendMessage(p, pendingSource);
    } else {
      document.getElementById('mentorInput')?.focus();
    }
  }

  function closeMentorPanel(){
    if(abortCtrl) abortCtrl.abort();
    streaming = false;
    const panel = document.getElementById('mentorPanel');
    const backdrop = document.getElementById('mentorBackdrop');
    backdrop?.classList.remove('open');
    panel?.classList.remove('open');
    document.body.classList.remove('mentor-open');
    setTimeout(()=>{
      if(backdrop) backdrop.hidden = true;
      if(panel) panel.hidden = true;
    }, reduced() ? 0 : 260);
  }

  function renderPanelChrome(){
    const signedIn = isSignedIn();

    const lowBal = balance !== null && balance <= 3 && balance > 0;
    const zeroBal = balance === 0;

    const statusEl = document.getElementById('mentorStatus');
    if(statusEl){
      if(!signedIn) statusEl.textContent = ERR_SIGNED_OUT;
      else if(zeroBal) statusEl.textContent = ERR_ZERO;
      else if(lowBal) statusEl.textContent = balance + ' conversation' + (balance === 1 ? '' : 's') + ' left today';
      else statusEl.textContent = '';
    }

    const input = document.getElementById('mentorInput');
    const send = document.getElementById('mentorSend');
    const disabled = !signedIn || zeroBal || streaming;
    if(input){
      input.disabled = disabled;
      input.placeholder = !signedIn ? 'Sign in to ask the mentor…' : (zeroBal ? 'Available again tomorrow' : 'Ask what faithfulness looks like from here…');
    }
    if(send) send.disabled = disabled;

    const chips = document.getElementById('mentorPromptChips');
    if(chips){
      chips.hidden = history.length > 0;
      if(!chips.dataset.filled){
        chips.innerHTML = PROMPT_CHIPS.map(p=>
          '<button type="button" class="mentor-prompt-chip" data-mentor-chip="'+esc(p)+'">'+esc(p)+'</button>'
        ).join('');
        chips.dataset.filled = '1';
      }
    }
  }

  function renderHistory(){
    const log = document.getElementById('mentorChat');
    if(!log) return;
    log.innerHTML = history.map((msg, idx)=> renderMessage(msg, idx)).join('');
    log.scrollTop = log.scrollHeight;
    renderPanelChrome();
  }

  function renderMessage(msg, idx){
    if(msg.role === 'user'){
      return '<div class="mentor-msg user"><div class="mentor-bubble">'+esc(msg.content)+'</div></div>';
    }
    const parsed = parseAssistantText(msg.content);
    const actionsHtml = msg.care
      ? renderCareCard()
      : (msg.actions || []).map((a, i)=> renderActionChip(a, idx, i, msg.confirmed)).join('');
    return '<div class="mentor-msg assistant">'+
      '<div class="mentor-bubble">'+formatText(parsed.text)+'</div>'+
      (actionsHtml ? '<div class="mentor-actions">'+actionsHtml+'</div>' : '')+
      '</div>';
  }

  function formatText(t){
    return esc(t).replace(/\n/g, '<br>');
  }

  function renderCareCard(){
    return '<div class="mentor-care-card">'+
      '<p class="mentor-care-lead">You do not have to carry this alone.</p>'+
      '<p>If you are in crisis, please reach someone who can be with you in person or by phone.</p>'+
      '<p><strong>988 Suicide &amp; Crisis Lifeline</strong> — call or text <strong>988</strong> (US)</p>'+
      '<p>Reach a pastor, counselor, or someone who loves you. That is faithfulness too.</p>'+
      '</div>';
  }

  function renderActionChip(action, msgIdx, actIdx, confirmed){
    const key = msgIdx + '-' + actIdx;
    const done = confirmed && confirmed[key];
    if(done){
      return '<span class="mentor-action-chip done">Added ✓</span>';
    }
    const label = ACTION_LABELS[action.type] || 'Apply';
    return '<button type="button" class="mentor-action-chip" data-mentor-action="'+esc(key)+'" data-action-type="'+esc(action.type)+'" data-action-text="'+esc(action.text||'')+'" data-stone-type="'+esc(action.stone_type||'')+'">'+esc(label)+'</button>';
  }

  function appendStreamingBubble(){
    const log = document.getElementById('mentorChat');
    if(!log) return null;
    const el = document.createElement('div');
    el.className = 'mentor-msg assistant streaming';
    el.innerHTML = '<div class="mentor-bubble"><span class="mentor-typing">…</span></div>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function sendMessage(text, source){
    const message = (text || '').trim();
    if(!message || streaming) return;

    if(!isSignedIn()){
      history.push({ role: 'assistant', content: ERR_SIGNED_OUT });
      renderHistory();
      return;
    }

    streaming = true;
    renderPanelChrome();

    history.push({ role: 'user', content: message });
    renderHistory();

    const token = await getAccessToken();
    if(!token){
      history.push({ role: 'assistant', content: ERR_SIGNED_OUT });
      streaming = false;
      renderHistory();
      return;
    }

    const streamEl = appendStreamingBubble();
    const bubble = streamEl?.querySelector('.mentor-bubble');
    let rawBuf = '';

    abortCtrl = new AbortController();

    try{
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          message,
          history: history.slice(0, -1),
          context: root.buildMentorContext?.(source || pendingSource) || '',
          source: source || pendingSource,
          userName: profileName()
        }),
        signal: abortCtrl.signal
      });

      if(res.status === 401){
        history.push({ role: 'assistant', content: ERR_SIGNED_OUT });
        streamEl?.remove();
        streaming = false;
        renderHistory();
        return;
      }

      if(res.status === 402){
        balance = 0;
        history.push({ role: 'assistant', content: ERR_ZERO });
        streamEl?.remove();
        streaming = false;
        renderHistory();
        return;
      }

      if(!res.ok || !res.body){
        const errJson = await res.json().catch(()=> ({}));
        history.push({ role: 'assistant', content: errJson.error || ERR_UNAVAILABLE });
        streamEl?.remove();
        streaming = false;
        renderHistory();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';

      while(true){
        const { done, value } = await reader.read();
        if(done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const parts = sseBuf.split('\n\n');
        sseBuf = parts.pop() || '';

        for(const part of parts){
          const line = part.split('\n').find(l=> l.startsWith('data: '));
          if(!line) continue;
          let evt;
          try{ evt = JSON.parse(line.slice(6)); }catch(e){ continue; }

          if(evt.type === 'token'){
            rawBuf += evt.text || '';
            const vis = visibleFromBuffer(rawBuf);
            if(bubble) bubble.innerHTML = formatText(vis.text) || '<span class="mentor-typing">…</span>';
          }
          if(evt.type === 'error'){
            rawBuf = evt.error || ERR_UNAVAILABLE;
            if(bubble) bubble.innerHTML = formatText(rawBuf);
          }
          if(evt.type === 'done'){
            if(typeof evt.balance === 'number') balance = evt.balance;
          }
        }
        const log = document.getElementById('mentorChat');
        if(log) log.scrollTop = log.scrollHeight;
      }

      const final = parseAssistantText(rawBuf);
      const assistantMsg = {
        role: 'assistant',
        content: rawBuf,
        actions: final.care ? [] : final.actions,
        care: final.care,
        confirmed: {}
      };
      history.push(assistantMsg);
      streamEl?.remove();
      renderHistory();
    }catch(e){
      if(e.name !== 'AbortError'){
        history.push({ role: 'assistant', content: ERR_UNAVAILABLE });
        streamEl?.remove();
        renderHistory();
      }
    }finally{
      streaming = false;
      abortCtrl = null;
      renderPanelChrome();
    }
  }

  /* ── action chip writes (existing stores only) ─────────────────── */
  function getTopMustDos(){
    return root.__dailyHelpers?.getTopMustDos?.() || [];
  }

  function applyMustDo(text){
    const top = getTopMustDos();
    if(top.length >= 3){
      return { needReplace: true, items: top };
    }
    root.__dailyHelpers?.addNonNeg?.(text) || addMustDoFallback(text);
    return { ok: true };
  }

  function addMustDoFallback(text){
    if(!root.dayData) return;
    if(!root.dayData.faithfulFew.mustDo.items) root.dayData.faithfulFew.mustDo.items = [];
    const itemId = (typeof root.uid === 'function' ? root.uid() : 'id-' + Date.now());
    root.dayData.faithfulFew.mustDo.items.push({ id: itemId, text: text.trim(), done: false });
    if(root.faithStore){
      root.faithStore.createTask({ title: text.trim(), date: root.iso?.(root.dayOf?.(root.dayOffset || 0)), tag: 'stewardship', legacyMustDoId: itemId });
      root.faithStore.save();
    }
    root.refreshDailyUI?.();
    root.markDirty?.();
  }

  function applyGrowthRep(text){
    if(!root.dayData) return;
    if(!root.dayData.growthRep) root.dayData.growthRep = { category:'', text:'', done:false };
    root.dayData.growthRep.text = text.trim();
    root.markDirty?.();
    root.refreshDailyUI?.();
  }

  function applyJournal(text){
    if(typeof root.journal === 'undefined') return;
    const line = text.trim();
    if(!line) return;
    root.journal.body = (root.journal.body || '').trim()
      ? (root.journal.body.trim() + '\n\n' + line)
      : line;
    root.journal.updated = Date.now();
    root.markDirty?.();
    const je = document.getElementById('journalBody');
    if(je) je.value = root.journal.body;
  }

  function showReplacePicker(items, text, msgIdx, actIdx){
    const host = document.getElementById('mentorReplaceHost');
    if(!host) return;
    host.hidden = false;
    host.innerHTML = '<p class="mentor-replace-q">All three slots are full. Replace which one?</p>'+
      items.map((it, i)=>
        '<button type="button" class="mentor-replace-btn" data-replace-idx="'+i+'" data-msg="'+msgIdx+'" data-act="'+actIdx+'" data-text="'+esc(it.text)+'">'+
        esc((i+1) + '. ' + (it.text || 'Must-do'))+'</button>'
      ).join('')+
      '<button type="button" class="mentor-quiet" data-replace-cancel>Cancel</button>';
    host._pendingText = text;
  }

  function hideReplacePicker(){
    const host = document.getElementById('mentorReplaceHost');
    if(host){ host.hidden = true; host.innerHTML = ''; host._pendingText = null; }
  }

  function replaceMustDoAt(idx, newText){
    const items = root.dayData?.faithfulFew?.mustDo?.items;
    if(!items || !items[idx]) return;
    items[idx].text = newText.trim();
    items[idx].done = false;
    items[idx].released = false;
    root.markDirty?.();
    root.refreshDailyUI?.();
  }

  function handleAction(type, text, msgIdx, actIdx, stoneType){
    const t = (text || '').trim();
    if(!t) return;

    if(type === 'must_do'){
      const result = applyMustDo(t);
      if(result.needReplace){
        showReplacePicker(result.items, t, msgIdx, actIdx);
        return;
      }
    } else if(type === 'growth_rep'){
      applyGrowthRep(t);
    } else if(type === 'journal'){
      applyJournal(t);
    } else if(type === 'stone'){
      // Only writes on this tap — never before.
      root.StonesStore?.add({ type: stoneType === 'marker' ? 'marker' : 'truth', text: t, source: 'Mentor' });
      if(typeof root.renderStonesPanel === 'function' && root.isStones?.()) root.renderStonesPanel();
    }

    const msg = history[msgIdx];
    if(msg){
      if(!msg.confirmed) msg.confirmed = {};
      msg.confirmed[msgIdx + '-' + actIdx] = true;
    }
    renderHistory();
  }

  function bindMentorEvents(){
    if(document.body.dataset.mentorBound) return;
    document.body.dataset.mentorBound = '1';

    document.getElementById('btnAskMentor')?.addEventListener('click', ()=> openMentorPanel({}));
    document.getElementById('mentorClose')?.addEventListener('click', closeMentorPanel);
    document.getElementById('mentorBackdrop')?.addEventListener('click', closeMentorPanel);

    document.getElementById('mentorPanel')?.addEventListener('click', e=>{
      const chip = e.target.closest('[data-mentor-chip]');
      if(chip){
        sendMessage(chip.dataset.mentorChip, pendingSource);
        return;
      }
      const act = e.target.closest('[data-mentor-action]');
      if(act){
        const parts = act.dataset.mentorAction.split('-');
        const msgIdx = +parts[0];
        const actIdx = +parts[1];
        handleAction(act.dataset.actionType, act.dataset.actionText, msgIdx, actIdx, act.dataset.stoneType);
        return;
      }
      const rep = e.target.closest('[data-replace-idx]');
      if(rep){
        const newText = document.getElementById('mentorReplaceHost')?._pendingText || rep.dataset.text;
        replaceMustDoAt(+rep.dataset.replaceIdx, newText);
        const msgIdx = +rep.dataset.msg;
        const actIdx = +rep.dataset.act;
        const msg = history[msgIdx];
        if(msg){ if(!msg.confirmed) msg.confirmed = {}; msg.confirmed[msgIdx + '-' + actIdx] = true; }
        hideReplacePicker();
        renderHistory();
        return;
      }
      if(e.target.closest('[data-replace-cancel]')) hideReplacePicker();
    });

    document.getElementById('mentorSend')?.addEventListener('click', ()=>{
      const input = document.getElementById('mentorInput');
      const v = input?.value?.trim();
      if(v){ input.value = ''; sendMessage(v, pendingSource); }
    });

    document.getElementById('mentorInput')?.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        document.getElementById('mentorSend')?.click();
      }
    });

    document.getElementById('app')?.addEventListener('click', e=>{
      const btn = e.target.closest('[data-mentor-open]');
      if(!btn) return;
      e.preventDefault();
      openMentorPanel({
        source: btn.dataset.mentorSource || 'daily-ledger',
        prompt: btn.dataset.mentorPrompt || ''
      });
    });

    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape' && document.body.classList.contains('mentor-open')) closeMentorPanel();
    });
  }

  root.openMentorPanel = openMentorPanel;
  root.closeMentorPanel = closeMentorPanel;
  root.bindMentorEvents = bindMentorEvents;

})(typeof window !== 'undefined' ? window : globalThis);
