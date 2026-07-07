/**
 * Profile — personal context for future AI coaching
 */
(function(root){
  'use strict';

  const PROFILE_KEY = 'fs-profile';
  const MAX_GOALS = 5;
  const MIN_GOAL_SLOTS = 3;

  function blankProfile(){
    return {
      name: '',
      about: '',
      faith: '',
      goals: ['', '', ''],
      rhythm: '',
      nonNegotiables: [''],
      coaching: '',
      nudgeDismissed: false,
      updatedAt: null
    };
  }

  function normalizeProfile(raw){
    const b = blankProfile();
    if(!raw || typeof raw !== 'object') return b;
    const goals = Array.isArray(raw.goals)
      ? raw.goals.map(g=> String(g || '').trim()).slice(0, MAX_GOALS)
      : b.goals;
    while(goals.length < MIN_GOAL_SLOTS) goals.push('');
    const nonNegotiables = Array.isArray(raw.nonNegotiables)
      ? raw.nonNegotiables.map(x=> String(x || '').trim())
      : b.nonNegotiables;
    if(!nonNegotiables.length) nonNegotiables.push('');
    return {
      name: String(raw.name || '').trim(),
      about: String(raw.about || '').trim(),
      faith: String(raw.faith || '').trim(),
      goals: goals.slice(0, MAX_GOALS),
      rhythm: String(raw.rhythm || '').trim(),
      nonNegotiables,
      coaching: String(raw.coaching || '').trim(),
      nudgeDismissed: !!raw.nudgeDismissed,
      updatedAt: raw.updatedAt || null
    };
  }

  function isProfileEmpty(profile){
    const p = normalizeProfile(profile);
    if(p.name || p.about || p.faith || p.rhythm || p.coaching) return false;
    if(p.goals.some(g=> g)) return false;
    if(p.nonNegotiables.some(n=> n)) return false;
    return true;
  }

  /** Plain-text block for a future AI system prompt. Skips empty fields. */
  function buildUserContext(profile){
    const p = normalizeProfile(profile);
    const blocks = [];
    if(p.name) blocks.push('Name: ' + p.name);
    if(p.about) blocks.push('About me: ' + p.about);
    if(p.faith) blocks.push('Faith & priorities: ' + p.faith);
    const goals = p.goals.filter(Boolean);
    if(goals.length) blocks.push('Goals right now:\n' + goals.map(g=> '- ' + g).join('\n'));
    if(p.rhythm) blocks.push('My rhythm: ' + p.rhythm);
    const nn = p.nonNegotiables.filter(Boolean);
    if(nn.length) blocks.push('Non-negotiables (never violate):\n' + nn.map(n=> '- ' + n).join('\n'));
    if(p.coaching) blocks.push('How I want to be coached: ' + p.coaching);
    return blocks.join('\n\n');
  }

  function renderListField(listKey, items, placeholder, addLabel){
    const rows = items.map((text, i)=>
      '<li class="profile-list-item">'+
      '<input type="text" class="profile-line" data-profile-list="'+listKey+'" data-profile-idx="'+i+'" value="'+esc(text)+'" placeholder="'+esc(placeholder)+'">'+
      '<button type="button" class="profile-rm" data-profile-rm="'+listKey+'" data-profile-idx="'+i+'" aria-label="Remove"'+(items.length <= 1 ? ' disabled' : '')+'>×</button></li>'
    ).join('');
    const canAdd = listKey === 'goals' ? items.length < MAX_GOALS : true;
    return '<ul class="profile-list" data-profile-list-wrap="'+listKey+'">'+rows+'</ul>'+
      (canAdd ? '<button type="button" class="btn-ghost profile-add" data-profile-add="'+listKey+'">'+esc(addLabel)+'</button>' : '');
  }

  function renderProfileForm(){
    const p = normalizeProfile(root.userProfile);
    return '<div class="profile-panel">'+
      '<p class="profile-intro">This stays in your account. It\'s used to personalize your coaching inside the app.</p>'+
      '<section class="profile-section">'+
      '<h3 class="serif">Name</h3>'+
      '<p class="profile-hint">What should your coach call you?</p>'+
      '<input type="text" class="profile-field" id="profileName" data-profile-field="name" value="'+esc(p.name)+'" placeholder="First name or nickname">'+
      '</section>'+
      '<section class="profile-section">'+
      '<h3 class="serif">About me</h3>'+
      '<p class="profile-hint">Work, season of life, family — whatever helps someone know your context.</p>'+
      '<textarea class="profile-field profile-ta" rows="4" data-profile-field="about" placeholder="I\'m in grad school, leading a small team, raising two kids…">'+esc(p.about)+'</textarea>'+
      '</section>'+
      '<section class="profile-section">'+
      '<h3 class="serif">Faith &amp; priorities</h3>'+
      '<p class="profile-hint">What matters most, and how you want to grow.</p>'+
      '<textarea class="profile-field profile-ta" rows="4" data-profile-field="faith" placeholder="Faithfulness in small things, leading with integrity, deeper prayer…">'+esc(p.faith)+'</textarea>'+
      '</section>'+
      '<section class="profile-section">'+
      '<h3 class="serif">Goals right now</h3>'+
      '<p class="profile-hint">Three to five short lines — what you\'re working toward this season.</p>'+
      renderListField('goals', p.goals, 'One goal…', '+ Add goal')+
      '</section>'+
      '<section class="profile-section">'+
      '<h3 class="serif">My rhythm</h3>'+
      '<p class="profile-hint">Typical schedule, work days, commute, morning and evening routines.</p>'+
      '<textarea class="profile-field profile-ta" rows="3" data-profile-field="rhythm" placeholder="Up at 6, commute 45 min, deep work before lunch, family after 5…">'+esc(p.rhythm)+'</textarea>'+
      '</section>'+
      '<section class="profile-section">'+
      '<h3 class="serif">Non-negotiables</h3>'+
      '<p class="profile-hint">Bedtime, sabbath, prayer time — advice should never cross these.</p>'+
      renderListField('nonNegotiables', p.nonNegotiables, 'e.g. In bed by 10pm', '+ Add non-negotiable')+
      '</section>'+
      '<section class="profile-section">'+
      '<h3 class="serif">How I want to be coached</h3>'+
      '<p class="profile-hint">Tone and style — direct, gentle, scripture-heavy, practical, etc.</p>'+
      '<textarea class="profile-field profile-ta" rows="3" data-profile-field="coaching" placeholder="Be direct but kind. Ground advice in Scripture. Keep it practical.">'+esc(p.coaching)+'</textarea>'+
      '</section>'+
      '</div>';
  }

  function renderProfileNudge(){
    const el = document.getElementById('dashProfileNudge');
    if(!el) return;
    const p = normalizeProfile(root.userProfile);
    if(!isProfileEmpty(p) || p.nudgeDismissed){
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML =
      '<div class="profile-nudge">'+
      '<p class="profile-nudge-text">Introduce yourself — set up your Profile so future coaching fits your life.</p>'+
      '<div class="profile-nudge-actions">'+
      '<button type="button" class="btn-gold" data-profile-nudge-go>Set up Profile</button>'+
      '<button type="button" class="profile-nudge-dismiss" data-profile-nudge-dismiss>Not now</button>'+
      '</div></div>';
  }

  function syncProfileFromDOM(){
    if(!root.userProfile) root.userProfile = blankProfile();
    const p = root.userProfile;
    document.querySelectorAll('[data-profile-field]').forEach(el=>{
      const key = el.dataset.profileField;
      if(key && key in p) p[key] = el.value;
    });
    document.querySelectorAll('[data-profile-list]').forEach(el=>{
      const listKey = el.dataset.profileList;
      const idx = +el.dataset.profileIdx;
      if(!Array.isArray(p[listKey]) || Number.isNaN(idx)) return;
      p[listKey][idx] = el.value;
    });
    p.updatedAt = new Date().toISOString();
    root.userProfile = normalizeProfile(p);
  }

  function renderProfile(){
    const main = document.getElementById('profileMain');
    if(!main) return;
    main.innerHTML = renderProfileForm();
  }

  async function loadProfile(){
    const raw = await getJSON(PROFILE_KEY);
    root.userProfile = normalizeProfile(raw);
    if(isProfile()) renderProfile();
    renderProfileNudge();
  }

  function bindProfileEvents(){
    if(document.body.dataset.profileBound) return;
    document.body.dataset.profileBound = '1';

    const app = document.getElementById('app') || document;
    app.addEventListener('input', e=>{
      if(!e.target.closest('#profileMain') && !e.target.closest('[data-profile-list]')) return;
      if(!isProfile?.()) return;
      syncProfileFromDOM();
      markDirty?.();
    });

    app.addEventListener('click', e=>{
      const go = e.target.closest('[data-profile-nudge-go]');
      if(go){ setMode?.('profile'); return; }

      const dismiss = e.target.closest('[data-profile-nudge-dismiss]');
      if(dismiss){
        root.userProfile = normalizeProfile(root.userProfile);
        root.userProfile.nudgeDismissed = true;
        root.userProfile.updatedAt = new Date().toISOString();
        renderProfileNudge();
        markDirty?.();
        return;
      }

      if(!isProfile?.()) return;

      const add = e.target.closest('[data-profile-add]');
      if(add){
        syncProfileFromDOM();
        const key = add.dataset.profileAdd;
        if(key === 'goals' && root.userProfile.goals.length >= MAX_GOALS) return;
        root.userProfile[key].push('');
        renderProfile();
        const inputs = document.querySelectorAll('[data-profile-list="'+key+'"]');
        inputs[inputs.length - 1]?.focus();
        markDirty?.();
        return;
      }

      const rm = e.target.closest('[data-profile-rm]');
      if(rm && !rm.disabled){
        syncProfileFromDOM();
        const key = rm.dataset.profileRm;
        const idx = +rm.dataset.profileIdx;
        if(root.userProfile[key].length <= 1) return;
        root.userProfile[key].splice(idx, 1);
        renderProfile();
        markDirty?.();
      }
    });
  }

  root.PROFILE_KEY = PROFILE_KEY;
  root.blankProfile = blankProfile;
  root.normalizeProfile = normalizeProfile;
  root.isProfileEmpty = isProfileEmpty;
  root.buildUserContext = buildUserContext;
  root.loadProfile = loadProfile;
  root.renderProfile = renderProfile;
  root.renderProfileNudge = renderProfileNudge;
  root.bindProfileEvents = bindProfileEvents;

})(typeof window !== 'undefined' ? window : globalThis);
