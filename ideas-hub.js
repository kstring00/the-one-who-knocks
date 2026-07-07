/**
 * Ideas Hub — local-first store (IdeasStore)
 */
(function(root){
  'use strict';

  const STORAGE_KEY = 'fs:ideas-hub';
  const ACTIVITY_KEY = 'fs:ideas-activity';
  const FOCUS_KEY = 'fs:ideas-focus-minutes';

  const STATUSES = ['captured','clarified','planned','in_progress','completed'];
  const LIFE_AREAS = ['ministry','career','content','health','income','other'];

  function uid(){
    if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
  }
  function nowIso(){ return new Date().toISOString(); }

  function blankClarification(){
    return { actualIdea:'', whyItMatters:'', whoItServes:'', problemSolved:'', worthBuilding:'' };
  }
  function blankSteps(){
    return { step1:'', step2:'', step3:'', doneLooksLike:'' };
  }
  function blankSchedule(){
    return { date:'', time:'', window:'' };
  }

  function normalizeIdea(raw){
    const r = raw || {};
    const status = STATUSES.includes(r.status) ? r.status : 'captured';
    return {
      id: r.id || uid(),
      title: String(r.title || r.text || '').trim(),
      description: String(r.description || r.text || '').trim(),
      status,
      lifeArea: LIFE_AREAS.includes(r.lifeArea) ? r.lifeArea : (r.category || 'other'),
      sourceType: ['text','voice','camera','quick','link'].includes(r.sourceType) ? r.sourceType : 'text',
      createdAt: r.createdAt || nowIso(),
      updatedAt: r.updatedAt || r.createdAt || nowIso(),
      favorite: !!r.favorite,
      pinned: !!r.pinned,
      clarification: { ...blankClarification(), ...(r.clarification || {}) },
      steps: { ...blankSteps(), ...(r.steps || {}) },
      schedule: { ...blankSchedule(), ...(r.schedule || {}) },
      firstAction: String(r.firstAction || r.flow?.firstAction || ''),
      developmentNotes: String(r.developmentNotes || r.development || ''),
      mustDoToday: r.mustDoToday != null ? !!r.mustDoToday : (r.flow?.addMustDo !== false),
      timeSpentMinutes: typeof r.timeSpentMinutes === 'number' ? r.timeSpentMinutes : 0,
      position: r.position && typeof r.position.x === 'number' ? { x:r.position.x, y:r.position.y } : null,
      attachments: Array.isArray(r.attachments) ? r.attachments.map(a=>({
        type: a.type || 'link', url: a.url || '', name: a.name || ''
      })) : [],
      activityLog: Array.isArray(r.activityLog) ? r.activityLog : [],
      legacyFlow: r.flow || null,
      legacyMustDoId: r.flow?.mustDoId || null,
      seedId: r.seedId || null
    };
  }

  function migrateLegacyIdea(old){
    const statusMap = { seedbed:'captured', active:'captured', growing:'in_progress', resting:'captured', harvested:'completed', promoted:'in_progress' };
    const f = old.flow || {};
    let status = statusMap[old.status] || 'captured';
    if(f.firstAction && f.scheduleDate) status = 'planned';
    if(old.status === 'growing') status = 'in_progress';
    if(f.steps?.[0] && !f.scheduleDate) status = 'clarified';
    const windowMap = { beforeWork:'before_work', duringWork:'during_work', afterWork:'after_work', eveningShutdown:'evening_shutdown' };
    return normalizeIdea({
      id: old.id,
      title: (old.text || '').split('\n')[0].slice(0, 120),
      description: old.text || '',
      status,
      lifeArea: old.category || 'other',
      sourceType: 'text',
      createdAt: old.createdAt,
      updatedAt: old.updatedAt,
      clarification: { actualIdea: old.text || '' },
      steps: { step1: f.steps?.[0]||'', step2: f.steps?.[1]||'', step3: f.steps?.[2]||'', doneLooksLike: f.doneDef||'' },
      schedule: { date: f.scheduleDate||'', time:'', window: windowMap[f.scheduleSlot] || '' },
      firstAction: f.firstAction || '',
      mustDoToday: f.addMustDo !== false,
      flow: f,
      activityLog: [{ id: uid(), type:'created', message:'Migrated from Seedbed', createdAt: old.createdAt || nowIso() }]
    });
  }

  function loadRaw(){
    try{
      const v = localStorage.getItem(STORAGE_KEY);
      if(!v) return null;
      const parsed = JSON.parse(v);
      if(Array.isArray(parsed)) return parsed;
      if(parsed && Array.isArray(parsed.ideas)) return parsed.ideas;
    }catch(e){
      console.warn('[IdeasStore] load failed, resetting', e);
      try{ localStorage.removeItem(STORAGE_KEY); }catch(_){}
    }
    return null;
  }

  function stripHeavyAttachments(ideas){
    return ideas.map(idea=>{
      if(!Array.isArray(idea.attachments) || !idea.attachments.length) return idea;
      const attachments = idea.attachments.map(a=>{
        if(!a.url || a.url.length < 2000) return a;
        const key = 'fs:ideas-attach:'+idea.id+':'+(a.name||'file');
        try{ localStorage.setItem(key, a.url); }catch(e){
          return { ...a, url:'', name:(a.name||'file')+' (stored locally)' };
        }
        return { type:a.type, url:'local:'+key, name:a.name||'attachment' };
      });
      return { ...idea, attachments };
    });
  }

  function saveRaw(ideas){
    try{
      const slim = stripHeavyAttachments(ideas);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      touchActivityDay(isoLocal(new Date()));
    }catch(e){
      console.warn('[IdeasStore] save failed', e);
      try{
        const slim = ideas.map(i=>({ ...i, attachments:[] }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      }catch(e2){ console.error('[IdeasStore] save fallback failed', e2); }
    }
  }

  function isoLocal(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function touchActivityDay(dateStr){
    try{
      const set = new Set(JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'));
      set.add(dateStr);
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify([...set].sort()));
    }catch(e){}
  }

  function getActivityDays(){
    try{ return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); }catch(e){ return []; }
  }

  const IdeasStore = {
    _ideas: null,

    init(legacyGlobalsIdeas){
      if(this._ideas) return this._ideas;
      try{
        let ideas = loadRaw();
        const legacy = Array.isArray(legacyGlobalsIdeas) ? legacyGlobalsIdeas : [];
        if((!ideas || !ideas.length) && legacy.length){
          ideas = legacy.map(migrateLegacyIdea);
          saveRaw(ideas);
        }
        if(!Array.isArray(ideas)) ideas = [];
        this._ideas = ideas.map(normalizeIdea);
      }catch(e){
        console.error('[IdeasStore] init error', e);
        this._ideas = [];
      }
      return this._ideas;
    },

    getIdeas(){
      if(!this._ideas) this.init([]);
      return [...this._ideas];
    },

    saveIdeas(ideas){
      this._ideas = ideas.map(normalizeIdea);
      saveRaw(this._ideas);
      return this._ideas;
    },

    getIdea(id){
      return this.getIdeas().find(i=> i.id === id) || null;
    },

    createIdea(input){
      const text = String(input?.text || input?.description || input?.title || '').trim();
      const firstLine = text.split('\n')[0].trim();
      const idea = normalizeIdea({
        title: input?.title || firstLine || 'Untitled idea',
        description: input?.description || text,
        status: 'captured',
        lifeArea: input?.lifeArea || 'other',
        sourceType: input?.sourceType || 'text',
        attachments: input?.attachments || [],
        position: input?.position || null,
        activityLog: [{ id: uid(), type:'created', message:'Idea captured', createdAt: nowIso() }]
      });
      const ideas = this.getIdeas();
      ideas.unshift(idea);
      this.saveIdeas(ideas);
      return idea;
    },

    updateIdea(id, updates){
      const ideas = this.getIdeas();
      const i = ideas.findIndex(x=> x.id === id);
      if(i < 0) return null;
      const prev = ideas[i];
      ideas[i] = normalizeIdea({ ...prev, ...updates, id, updatedAt: nowIso() });
      this.saveIdeas(ideas);
      return ideas[i];
    },

    deleteIdea(id){
      this.saveIdeas(this.getIdeas().filter(i=> i.id !== id));
    },

    moveIdeaStatus(id, status){
      if(!STATUSES.includes(status)) return null;
      const idea = this.getIdea(id);
      if(!idea) return null;
      const labels = { captured:'Captured', clarified:'Clarified', planned:'Planned', in_progress:'Moved to in progress', completed:'Completed' };
      const log = [...idea.activityLog, { id: uid(), type:'status', message: labels[status] || status, createdAt: nowIso() }];
      return this.updateIdea(id, { status, activityLog: log });
    },

    toggleFavorite(id){
      const idea = this.getIdea(id);
      if(!idea) return null;
      return this.updateIdea(id, { favorite: !idea.favorite });
    },

    pinIdea(id){
      const ideas = this.getIdeas().map(i=> ({ ...i, pinned: i.id === id }));
      this.saveIdeas(ideas);
      return this.getIdea(id);
    },

    addActivity(id, message, type){
      const idea = this.getIdea(id);
      if(!idea) return null;
      const log = [...idea.activityLog, { id: uid(), type: type || 'note', message, createdAt: nowIso() }];
      return this.updateIdea(id, { activityLog: log });
    },

    addTimeSpent(id, minutes){
      const idea = this.getIdea(id);
      if(!idea) return;
      this.updateIdea(id, { timeSpentMinutes: (idea.timeSpentMinutes || 0) + minutes });
    },

    getIdeasByStatus(status){
      if(!status || status === 'all') return this.getIdeas();
      return this.getIdeas().filter(i=> i.status === status);
    },

    getIdeaStats(){
      const ideas = this.getIdeas();
      const total = ideas.length;
      const captured = ideas.filter(i=> i.status === 'captured').length;
      const clarified = ideas.filter(i=> i.status === 'clarified').length;
      const planned = ideas.filter(i=> i.status === 'planned').length;
      const inProgress = ideas.filter(i=> i.status === 'in_progress').length;
      const completed = ideas.filter(i=> i.status === 'completed').length;
      const needClarificationPct = total ? Math.round(captured / total * 100) : 0;
      return { total, captured, clarified, planned, inProgress, completed, needClarificationPct };
    },

    getPipelineCounts(){
      const s = this.getIdeaStats();
      return {
        captured: s.captured,
        clarified: s.clarified,
        planned: s.planned,
        in_progress: s.inProgress,
        completed: s.completed
      };
    },

    getCurrentStreak(){
      const days = new Set(getActivityDays());
      this.getIdeas().forEach(i=>{
        days.add(isoLocal(new Date(i.createdAt)));
        days.add(isoLocal(new Date(i.updatedAt)));
      });
      let streak = 0;
      const d = new Date();
      d.setHours(12,0,0,0);
      for(let i = 0; i < 400; i++){
        const ds = isoLocal(d);
        if(days.has(ds)) streak++;
        else if(streak > 0) break;
        else if(i > 0) break;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    },

    getWeekActivity(){
      const days = new Set(getActivityDays());
      this.getIdeas().forEach(i=>{
        days.add(isoLocal(new Date(i.createdAt)));
        days.add(isoLocal(new Date(i.updatedAt)));
      });
      const out = [];
      const d = new Date();
      d.setHours(12,0,0,0);
      d.setDate(d.getDate() - 6);
      const labels = ['S','M','T','W','T','F','S'];
      for(let i = 0; i < 7; i++){
        const dow = d.getDay();
        out.push({ label: labels[dow], date: isoLocal(d), active: days.has(isoLocal(d)) });
        d.setDate(d.getDate() + 1);
      }
      return out;
    },

    getPinnedIdea(){
      return this.getIdeas().find(i=> i.pinned) || null;
    },

    searchIdeas(query){
      const q = String(query||'').trim().toLowerCase();
      if(!q) return this.getIdeas();
      return this.getIdeas().filter(i=>
        i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      );
    },

    getSparkBoardIdeas(){
      return this.getIdeas().filter(i=> i.status === 'captured' && i.position).slice(0, 6);
    }
  };

  root.IdeasStore = IdeasStore;
  root.IDEA_STATUSES = STATUSES;
  root.IDEA_LIFE_AREAS = LIFE_AREAS;

})(typeof window !== 'undefined' ? window : globalThis);
/**
 * Ideas Hub UI — render, capture, workspace, spark board
 */
(function(root){
  'use strict';

  const STATUS_LABELS = {
    captured:'Captured', clarified:'Clarified', planned:'Planned',
    in_progress:'In Progress', completed:'Completed'
  };
  const STATUS_SUBS = {
    captured:'raw thought', clarified:'taking shape', planned:'blueprint ready',
    in_progress:'in motion', completed:'brought to life'
  };
  const STATUS_ICONS = { captured:'✦', clarified:'◎', planned:'✎', in_progress:'〰', completed:'⚑' };
  const GROWTH_ASSETS = {
    captured:'assets/idea-seed.svg', clarified:'assets/idea-sprout.svg',
    planned:'assets/idea-young-tree.svg', in_progress:'assets/idea-fruit-tree.svg',
    completed:'assets/idea-harvest.svg'
  };
  const GROWTH_EMOJI = { captured:'🌱', clarified:'🌿', planned:'🌳', in_progress:'🍊', completed:'🧺' };
  const WINDOW_LABELS = {
    before_work:'Before Work', during_work:'During Work',
    after_work:'After Work', evening_shutdown:'Evening Shutdown'
  };
  const SLOT_TO_WINDOW = { beforeWork:'before_work', duringWork:'during_work', afterWork:'after_work', eveningShutdown:'evening_shutdown' };
  const WINDOW_TO_SLOT = { before_work:'beforeWork', during_work:'duringWork', after_work:'afterWork', evening_shutdown:'eveningShutdown' };
  const STICKY_COLORS = ['#5d4f85','#3e6a86','#8a6a1f','#44775a','#8a5a5a','#66754f'];

  const hub = {
    tab:'all', search:'', searchOpen:false,
    workspaceId:null, draft:null,
    wsOpenAt:null, mediaRecorder:null, audioChunks:[]
  };

  function esc(s){ return typeof root.esc === 'function' ? root.esc(s) : String(s??''); }
  function uid(){ return typeof root.uid === 'function' ? root.uid() : 'id-'+Date.now(); }
  function markDirty(){ if(typeof root.markDirty === 'function') root.markDirty(); }
  function showToast(msg, opts){ if(typeof root.showIdeaToast === 'function') root.showIdeaToast(msg, opts); else alert(msg); }

  function formatIdeaDate(isoStr){
    if(!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  }
  function formatIdeaTime(isoStr){
    if(!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  }
  function formatMinutes(m){
    const h = Math.floor(m/60), min = m%60;
    if(h && min) return h+'h '+min+'m';
    if(h) return h+'h';
    return min+'m';
  }
  function plural(n,s){ return n===1?s:s+'s'; }

  function syncGlobalsIdeas(){
    if(typeof root.globals === 'undefined') return;
    root.globals.ideasHub = IdeasStore.getIdeas();
  }

  function filteredIdeas(){
    let list = IdeasStore.searchIdeas(hub.search);
    if(hub.tab !== 'all') list = list.filter(i=> i.status === hub.tab);
    return list.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
  }

  function statusBadge(status){
    return '<span class="ih-badge ih-badge-'+status+'">'+STATUS_LABELS[status]+'</span>';
  }

  function stageSubtitle(st, n){
    const num = n || 0;
    switch(st){
      case 'captured': return num+' raw thought'+(num===1?'':'s');
      case 'clarified': return num+' taking shape';
      case 'planned': return num+' blueprint ready';
      case 'in_progress': return num+' in motion';
      case 'completed': return num+' brought to life';
      default: return '';
    }
  }

  function renderPipeline(){
    const el = document.getElementById('ihPipeline');
    if(!el) return;
    const c = IdeasStore.getPipelineCounts();
    const stages = ['captured','clarified','planned','in_progress','completed'];
    el.innerHTML = stages.map((st,i)=>{
      const n = c[st]||0;
      return (i ? '<div class="ih-pipe-arrow" aria-hidden="true"><span class="ih-pipe-dots"></span><span class="ih-pipe-chev">›</span></div>' : '')+
        '<button type="button" class="ih-pipe-stage'+(hub.tab===st?' on':'')+'" data-ih-pipe="'+st+'">'+
        '<span class="ih-pipe-icon">'+STATUS_ICONS[st]+'</span>'+
        '<span class="ih-pipe-count">'+n+'</span>'+
        '<span class="ih-pipe-label">'+STATUS_LABELS[st]+'</span>'+
        '<span class="ih-pipe-sub">'+stageSubtitle(st,n)+'</span></button>';
    }).join('');
  }

  function renderInbox(){
    return '<div class="ih-card ih-inbox">'+
      '<h3 class="ih-card-title ih-inbox-title">Inbox</h3>'+
      '<p class="ih-card-hint ih-inbox-hint">Capture ideas anywhere</p>'+
      '<textarea id="ihInboxText" class="ih-inbox-text" rows="4" placeholder="What\'s on your mind?"></textarea>'+
      '<div class="ih-inbox-tools">'+
      '<button type="button" class="ih-icon-btn" id="ihVoiceBtn" title="Voice note"><span class="ih-ico">🎤</span></button>'+
      '<button type="button" class="ih-icon-btn" id="ihCameraBtn" title="Photo"><span class="ih-ico">📷</span></button>'+
      '<button type="button" class="ih-icon-btn" id="ihLinkBtn" title="Link"><span class="ih-ico">🔗</span></button>'+
      '<button type="button" class="ih-icon-btn" id="ihAttachBtn" title="Attachment"><span class="ih-ico">📎</span></button>'+
      '<input type="file" id="ihCameraInput" accept="image/*" capture="environment" hidden>'+
      '<input type="file" id="ihAttachInput" hidden>'+
      '</div>'+
      '<div class="ih-inbox-foot"><button type="button" class="ih-btn-capture" id="ihCaptureBtn">+ Capture</button></div>'+
      '</div>';
  }

  function renderQuickCapture(){
    return '<div class="ih-card ih-quick">'+
      '<h3 class="ih-card-title">Quick Capture</h3>'+
      '<div class="ih-quick-grid">'+
      '<button type="button" class="ih-quick-btn" id="ihQuickVoice"><span class="ih-quick-ico">🎤</span><strong>Voice Note</strong><em>Tap to record</em></button>'+
      '<button type="button" class="ih-quick-btn" id="ihQuickCamera"><span class="ih-quick-ico">📷</span><strong>Camera Capture</strong><em>Take a photo</em></button>'+
      '<button type="button" class="ih-quick-btn" id="ihQuickNote"><span class="ih-quick-ico">✎</span><strong>Quick Note</strong><em>Jot it down</em></button>'+
      '</div></div>';
  }

  function renderSparkBoard(){
    const notes = IdeasStore.getIdeas().filter(i=> i.status==='captured').slice(0,6);
    const boardH = 168;
    const html = notes.map((idea,idx)=>{
      const x = idea.position?.x ?? (14 + (idx%3)*94);
      const y = idea.position?.y ?? (14 + Math.floor(idx/3)*58);
      const color = STICKY_COLORS[idx % STICKY_COLORS.length];
      const rot = [-2, 1, -1, 2, 0, -3][idx % 6];
      const text = (idea.title||idea.description||'Note').slice(0,48);
      return '<div class="ih-sticky" data-ih-sticky="'+idea.id+'" style="left:'+x+'px;top:'+y+'px;background:'+color+';transform:rotate('+rot+'deg)">'+
        esc(text)+'</div>';
    }).join('');
    return '<div class="ih-card ih-spark">'+
      '<h3 class="ih-card-title">Spark Board</h3>'+
      '<p class="ih-card-hint">A free-thinking space</p>'+
      '<div class="ih-spark-board" id="ihSparkBoard" style="min-height:'+boardH+'px">'+html+'</div>'+
      '<button type="button" class="ih-btn-ghost ih-add-sticky" id="ihAddSticky">+ Add note</button></div>';
  }

  function renderVault(){
    const statuses = (typeof IDEA_STATUSES !== 'undefined' && Array.isArray(IDEA_STATUSES))
      ? IDEA_STATUSES : ['captured','clarified','planned','in_progress','completed'];
    const tabs = [{id:'all',label:'All'}, ...statuses.map(s=>({id:s,label:STATUS_LABELS[s]}))];
    const ideas = filteredIdeas();
    const list = ideas.length ? ideas.map(ideaRow).join('') :
      '<div class="ih-empty">No ideas here yet. Capture something from the inbox.</div>';
    return '<div class="ih-card ih-vault">'+
      '<h3 class="ih-card-title ih-vault-title">Ideas Vault</h3>'+
      '<div class="ih-vault-head">'+
      '<div class="ih-tabs">'+tabs.map(t=>
        '<button type="button" class="ih-tab'+(hub.tab===t.id?' on':'')+'" data-ih-tab="'+t.id+'">'+t.label+'</button>'
      ).join('')+'</div>'+
      '<button type="button" class="ih-search-toggle'+(hub.searchOpen?' on':'')+'" id="ihSearchToggle" aria-label="Search">🔍</button>'+
      '</div>'+
      (hub.searchOpen ? '<input type="search" id="ihSearchInput" class="ih-search-inp" placeholder="Search ideas…" value="'+esc(hub.search)+'">' : '')+
      '<div class="ih-vault-list" id="ihVaultList">'+list+'</div>'+
      '<button type="button" class="ih-btn-gold ih-new-idea" id="ihNewIdea">+ New idea</button></div>';
  }

  function ideaRow(idea){
    const meta = STATUS_LABELS[idea.status]+' · '+formatIdeaDate(idea.createdAt)+' · '+formatIdeaTime(idea.createdAt);
    const desc = (idea.description||'').trim();
    const showDesc = desc && desc !== idea.title;
    return '<article class="ih-idea-row" data-ih-idea="'+idea.id+'">'+
      '<div class="ih-idea-main">'+
      '<div class="ih-idea-top"><h4 class="ih-idea-title">'+esc(idea.title||'Untitled')+'</h4>'+statusBadge(idea.status)+'</div>'+
      (showDesc ? '<p class="ih-idea-desc">'+esc(desc.slice(0,140))+'</p>' : '')+
      '<span class="ih-idea-meta">'+meta+'</span></div>'+
      '<div class="ih-idea-actions">'+
      '<button type="button" class="ih-star'+(idea.favorite?' on':'')+'" data-ih-fav="'+idea.id+'" aria-label="Favorite">'+(idea.favorite?'★':'☆')+'</button>'+
      '<details class="ih-more"><summary>⋯</summary>'+
      '<button type="button" data-ih-open="'+idea.id+'">Open workspace</button>'+
      '<button type="button" data-ih-pin="'+idea.id+'">Pin as focus</button>'+
      '<button type="button" class="ih-danger" data-ih-del="'+idea.id+'">Delete</button>'+
      '</details></div></article>';
  }

  function renderFocusCard(){
    const pinned = IdeasStore.getPinnedIdea();
    if(!pinned){
      return '<div class="ih-card ih-focus">'+
        '<div class="ih-focus-head"><span class="ih-crown">👑</span><h3 class="ih-card-title">Idea Focus</h3></div>'+
        '<p class="ih-focus-empty">Choose an idea to focus.</p></div>';
    }
    return '<div class="ih-card ih-focus">'+
      '<div class="ih-focus-head"><span class="ih-crown">👑</span><h3 class="ih-card-title">Idea Focus</h3></div>'+
      '<p class="ih-focus-title serif">'+esc(pinned.title)+'</p>'+
      '<p class="ih-focus-time">You\'ve spent '+formatMinutes(pinned.timeSpentMinutes||0)+' thinking about this.</p>'+
      '<button type="button" class="ih-btn-gold ih-open-ws" data-ih-open="'+pinned.id+'">Open Idea Workspace →</button></div>';
  }

  function renderInsights(){
    const s = IdeasStore.getIdeaStats();
    return '<div class="ih-card ih-insights">'+
      '<h3 class="ih-card-title">Insights</h3>'+
      '<div class="ih-stat-grid">'+
      statCell('💡', s.total, 'Total Ideas')+
      statCell('◎', s.needClarificationPct+'%', 'Need Clarification')+
      statCell('〰', s.inProgress, 'In Progress')+
      statCell('⚑', s.completed, 'Completed')+
      '</div></div>';
  }
  function statCell(icon, val, lbl){
    return '<div class="ih-stat"><span class="ih-stat-icon">'+icon+'</span>'+
      '<span class="ih-stat-val">'+val+'</span><span class="ih-stat-lbl">'+lbl+'</span></div>';
  }

  function renderStreak(){
    const days = IdeasStore.getWeekActivity();
    const streak = IdeasStore.getCurrentStreak();
    return '<div class="ih-card ih-streak">'+
      '<h3 class="ih-card-title">Idea Streak</h3>'+
      '<div class="ih-streak-row">'+
      days.map(d=>'<div class="ih-streak-day'+(d.active?' done':'')+'"><span class="ih-streak-lbl">'+d.label+'</span>'+
        (d.active?'<span class="ih-streak-check">✓</span>':'')+'</div>').join('')+
      '<div class="ih-streak-count"><span class="ih-streak-num">'+streak+'</span><span class="ih-streak-unit">days</span></div>'+
      '</div></div>';
  }

  function renderHub(){
    const left = document.getElementById('ihColLeft');
    const center = document.getElementById('ihColCenter');
    const right = document.getElementById('ihColRight');
    const pipeline = document.getElementById('ihPipeline');
    if(!left || !center || !right || !pipeline){
      console.error('[Ideas Hub] missing DOM nodes', { left:!!left, center:!!center, right:!!right, pipeline:!!pipeline });
      return;
    }
    try{
      left.innerHTML = renderInbox()+renderQuickCapture()+renderSparkBoard();
      center.innerHTML = renderVault();
      right.innerHTML = renderFocusCard()+renderInsights()+renderStreak();
      renderPipeline();
    }catch(e){
      console.error('[Ideas Hub] renderHub failed', e);
      pipeline.innerHTML = '<p class="ih-load-error">Could not render Ideas Hub: '+esc(e.message||'error')+'</p>';
    }
  }

  function growthVisual(status){
    const src = GROWTH_ASSETS[status] || GROWTH_ASSETS.captured;
    const em = GROWTH_EMOJI[status] || '🌱';
    return '<div class="ih-growth"><img src="'+src+'" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ih-growth-fallback\',textContent:\''+em+'\'}))">'+
      '<span class="ih-growth-label">'+STATUS_LABELS[status]+'</span></div>';
  }

  function draftFromIdea(idea){
    const todayIso = ()=>{
      const d = new Date();
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    };
    if(!idea){
      return {
        id:null, title:'', description:'', status:'captured', lifeArea:'other', favorite:false, pinned:false,
        clarification:{ actualIdea:'', whyItMatters:'', whoItServes:'', problemSolved:'', worthBuilding:'' },
        steps:{ step1:'', step2:'', step3:'', doneLooksLike:'' },
        schedule:{ date:todayIso(), time:'', window:'before_work' },
        firstAction:'', mustDoToday:true, activityLog:[]
      };
    }
    return JSON.parse(JSON.stringify(idea));
  }

  function renderWorkspace(){
    const panel = document.getElementById('ihWorkspace');
    const backdrop = document.getElementById('ihWorkspaceBackdrop');
    if(!panel) return;
    const d = hub.draft;
    if(!d){
      panel.hidden = true; backdrop.hidden = true; return;
    }
    panel.hidden = false; backdrop.hidden = false;
    const log = (d.activityLog||[]).slice().reverse().map(e=>
      '<div class="ih-log-item"><span class="ih-log-time">'+formatIdeaTime(e.createdAt)+'</span> '+esc(e.message)+'</div>'
    ).join('') || '<p class="ih-empty">No activity yet.</p>';

    panel.innerHTML =
      '<div class="ih-ws-head">'+
      '<button type="button" class="ih-ws-close" id="ihWsClose" aria-label="Close">×</button>'+
      '<input type="text" class="ih-ws-title serif" id="ihWsTitle" value="'+esc(d.title)+'" placeholder="Idea title">'+
      '<div class="ih-ws-toolbar">'+
      '<select id="ihWsStatus" class="ih-ws-select">'+(typeof IDEA_STATUSES !== 'undefined' ? IDEA_STATUSES : ['captured','clarified','planned','in_progress','completed']).map(s=>
        '<option value="'+s+'"'+(d.status===s?' selected':'')+'>'+STATUS_LABELS[s]+'</option>').join('')+'</select>'+
      '<button type="button" class="ih-star'+(d.favorite?' on':'')+'" id="ihWsFav">'+(d.favorite?'★':'☆')+'</button>'+
      '<button type="button" class="ih-btn-ghost" id="ihWsPin">Pin as Focus</button>'+
      '<button type="button" class="ih-danger ih-btn-ghost" id="ihWsDelete">Delete</button>'+
      '</div></div>'+
      '<div class="ih-ws-body">'+
      '<section class="ih-ws-section"><h4>Clarify</h4>'+
      clarifyField('What is the actual idea?','ihClActual', d.clarification?.actualIdea)+
      clarifyField('Why does this matter?','ihClWhy', d.clarification?.whyItMatters)+
      clarifyField('Who does this serve?','ihClWho', d.clarification?.whoItServes)+
      clarifyField('What problem does this solve?','ihClProblem', d.clarification?.problemSolved)+
      clarifyField('What would make this worth building?','ihClWorth', d.clarification?.worthBuilding)+
      '</section>'+
      '<section class="ih-ws-section ih-ws-develop"><h4>How it\'s developing</h4>'+
      '<p class="ih-hint">In your own words — what\'s changed, what you\'re learning, where it\'s going. No wrong format.</p>'+
      '<textarea id="ihDevelopment" class="ih-dev-notes" rows="7" placeholder="Started as a rough thought about… Now I\'m seeing… Next I want to…">'+esc(d.developmentNotes||'')+'</textarea>'+
      '</section>'+
      '<section class="ih-ws-section ih-ws-growth">'+growthVisual(d.status)+'</section>'+
      '<section class="ih-ws-section"><h4>Three Faithful Steps</h4>'+
      stepField('Step 1','ihStep1', d.steps?.step1)+
      stepField('Step 2','ihStep2', d.steps?.step2)+
      stepField('Step 3','ihStep3', d.steps?.step3)+
      stepField('Done looks like…','ihDone', d.steps?.doneLooksLike)+
      '</section>'+
      '<section class="ih-ws-section"><h4>Schedule</h4>'+
      '<div class="ih-sched-row"><label>Date <input type="date" id="ihSchedDate" value="'+(d.schedule?.date||'')+'"></label>'+
      '<label>Time <input type="time" id="ihSchedTime" value="'+(d.schedule?.time||'')+'"></label></div>'+
      '<div class="ih-window-btns" id="ihWindows">'+
      Object.entries(WINDOW_LABELS).map(([k,l])=>
        '<button type="button" class="ih-window-btn'+(d.schedule?.window===k?' on':'')+'" data-ih-window="'+k+'">'+l+'</button>'
      ).join('')+'</div></section>'+
      '<section class="ih-ws-section"><h4>First Action</h4>'+
      '<label class="ih-first-label">What is the very first physical action?</label>'+
      '<input type="text" class="ih-inp" id="ihFirstAction" value="'+esc(d.firstAction||'')+'" placeholder="Set up the tripod">'+
      '<label class="ih-check"><input type="checkbox" id="ihMustDo"'+(d.mustDoToday?' checked':'')+'> Make it a Must-Do today</label>'+
      '<button type="button" class="ih-btn-plant" id="ihPlantBtn">Plant it</button>'+
      '</section>'+
      '<section class="ih-ws-section"><h4>Activity Log</h4><div class="ih-log">'+log+'</div></section>'+
      '</div>';
  }

  function clarifyField(label, id, val){
    return '<label class="ih-cl-row"><span>'+label+'</span><textarea id="'+id+'" rows="2">'+esc(val||'')+'</textarea></label>';
  }
  function stepField(label, id, val){
    return '<label class="ih-step-row"><span>'+label+'</span><input type="text" class="ih-inp" id="'+id+'" value="'+esc(val||'')+'"></label>';
  }

  function readDraftFromDom(){
    const d = hub.draft;
    if(!d) return null;
    d.title = document.getElementById('ihWsTitle')?.value.trim() || 'Untitled idea';
    d.status = document.getElementById('ihWsStatus')?.value || d.status;
    d.clarification = {
      actualIdea: document.getElementById('ihClActual')?.value.trim()||'',
      whyItMatters: document.getElementById('ihClWhy')?.value.trim()||'',
      whoItServes: document.getElementById('ihClWho')?.value.trim()||'',
      problemSolved: document.getElementById('ihClProblem')?.value.trim()||'',
      worthBuilding: document.getElementById('ihClWorth')?.value.trim()||''
    };
    d.developmentNotes = document.getElementById('ihDevelopment')?.value.trim()||'';
    d.steps = {
      step1: document.getElementById('ihStep1')?.value.trim()||'',
      step2: document.getElementById('ihStep2')?.value.trim()||'',
      step3: document.getElementById('ihStep3')?.value.trim()||'',
      doneLooksLike: document.getElementById('ihDone')?.value.trim()||''
    };
    d.schedule = {
      date: document.getElementById('ihSchedDate')?.value||'',
      time: document.getElementById('ihSchedTime')?.value||'',
      window: d.schedule?.window || ''
    };
    d.firstAction = document.getElementById('ihFirstAction')?.value.trim()||'';
    d.mustDoToday = !!document.getElementById('ihMustDo')?.checked;
    return d;
  }

  function persistDraft(){
    readDraftFromDom();
    const d = hub.draft;
    if(!d) return;
    if(d.id){
      IdeasStore.updateIdea(d.id, d);
      hub.draft = IdeasStore.getIdea(d.id);
    } else {
      const created = IdeasStore.createIdea({
        title: d.title, description: d.description || d.title,
        lifeArea: d.lifeArea||'other', sourceType:'text'
      });
      hub.workspaceId = created.id;
      d.id = created.id;
      IdeasStore.updateIdea(created.id, d);
      hub.draft = IdeasStore.getIdea(created.id);
    }
    syncGlobalsIdeas();
    markDirty();
  }

  function closeWorkspace(){
    if(hub.wsOpenAt && hub.workspaceId){
      const mins = Math.round((Date.now() - hub.wsOpenAt) / 60000);
      if(mins > 0) IdeasStore.addTimeSpent(hub.workspaceId, mins);
    }
    hub.wsOpenAt = null;
    hub.workspaceId = null;
    hub.draft = null;
    document.getElementById('ihWorkspace')?.setAttribute('hidden','');
    document.getElementById('ihWorkspaceBackdrop')?.setAttribute('hidden','');
    document.body.classList.remove('ih-ws-open');
    renderHub();
  }

  function openWorkspace(id){
    if(hub.wsOpenAt && hub.workspaceId && hub.workspaceId !== id){
      const mins = Math.round((Date.now() - hub.wsOpenAt) / 60000);
      if(mins > 0) IdeasStore.addTimeSpent(hub.workspaceId, mins);
    }
    if(id){
      hub.draft = draftFromIdea(IdeasStore.getIdea(id));
      hub.workspaceId = id;
    } else {
      hub.draft = draftFromIdea(null);
      hub.workspaceId = null;
    }
    hub.wsOpenAt = Date.now();
    document.body.classList.add('ih-ws-open');
    renderWorkspace();
    document.getElementById('ihWsTitle')?.focus();
  }

  async function captureInbox(sourceType, extra){
    const text = document.getElementById('ihInboxText')?.value.trim();
    if(!text && !(extra?.attachments?.length)) return;
    const idea = IdeasStore.createIdea({
      text, sourceType: sourceType||'text',
      attachments: extra?.attachments || []
    });
    document.getElementById('ihInboxText').value = '';
    syncGlobalsIdeas();
    markDirty();
    showToast('Idea captured.');
    renderHub();
    return idea;
  }

  async function startVoiceCapture(){
    if(!navigator.mediaDevices?.getUserMedia){
      showToast('Voice recording not supported in this browser.');
      return;
    }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      hub.audioChunks = [];
      hub.mediaRecorder = new MediaRecorder(stream);
      hub.mediaRecorder.ondataavailable = e=>{ if(e.data.size) hub.audioChunks.push(e.data); };
      hub.mediaRecorder.onstop = ()=>{
        stream.getTracks().forEach(t=> t.stop());
        const blob = new Blob(hub.audioChunks, { type:'audio/webm' });
        const reader = new FileReader();
        reader.onload = ()=>{
          const idea = IdeasStore.createIdea({
            title:'Voice note', description:'Audio capture — transcription pending.',
            sourceType:'voice',
            attachments:[{ type:'audio', url: reader.result, name:'voice-note.webm' }]
          });
          syncGlobalsIdeas(); markDirty(); showToast('Voice note saved.'); renderHub();
        };
        reader.readAsDataURL(blob);
      };
      hub.mediaRecorder.start();
      showToast('Recording… click Voice again to stop.');
      const stop = ()=>{
        if(hub.mediaRecorder?.state === 'recording') hub.mediaRecorder.stop();
        document.getElementById('ihVoiceBtn')?.removeEventListener('click', stop);
        document.getElementById('ihQuickVoice')?.removeEventListener('click', stop);
      };
      document.getElementById('ihVoiceBtn')?.addEventListener('click', stop);
      document.getElementById('ihQuickVoice')?.addEventListener('click', stop);
    }catch(e){
      showToast('Microphone access denied.');
    }
  }

  function handleCameraFile(file){
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      IdeasStore.createIdea({
        title:'Photo capture', description: file.name,
        sourceType:'camera',
        attachments:[{ type:'image', url: reader.result, name: file.name }]
      });
      syncGlobalsIdeas(); markDirty(); showToast('Photo captured.'); renderHub();
    };
    reader.readAsDataURL(file);
  }

  function addSparkNote(){
    const idx = IdeasStore.getIdeas().filter(i=> i.position).length;
    IdeasStore.createIdea({
      title:'New note', description:'', sourceType:'quick',
      position:{ x: 12 + (idx%3)*88, y: 12 + Math.floor(idx/3)*52 }
    });
    syncGlobalsIdeas(); markDirty(); renderHub();
  }

  async function plantIdea(){
    readDraftFromDom();
    const d = hub.draft;
    if(!d.title?.trim()){ showToast('Add a title first.'); return; }
    if(!d.steps?.step1?.trim()){ showToast('Add at least Step 1.'); return; }
    if(!d.firstAction?.trim()){ showToast('Add your first physical action.'); return; }
    if(!d.schedule?.date){ showToast('Pick a schedule date.'); return; }

    persistDraft();
    const idea = IdeasStore.getIdea(hub.workspaceId);
    if(!idea) return;

    const newStatus = idea.status === 'captured' || idea.status === 'clarified' ? 'planned' : 'in_progress';
    IdeasStore.moveIdeaStatus(idea.id, newStatus);
    IdeasStore.addActivity(idea.id, 'Planted on calendar', 'plant');

    const slot = WINDOW_TO_SLOT[idea.schedule?.window] || 'beforeWork';
    const dateStr = idea.schedule.date;

    if(typeof root.getDayDataByDate === 'function' && typeof root.saveDayDataByDate === 'function'){
      const PIPE_SLOT_FIELDS = root.PIPE_SLOT_FIELDS || { beforeWork:'beforeWork', duringWork:'duringWork', afterWork:'afterWork', eveningShutdown:'eveningShutdown' };
      const field = PIPE_SLOT_FIELDS[slot] || 'beforeWork';
      const data = await root.getDayDataByDate(dateStr);
      data.execute[field] = idea.steps.step1;
      let mustDoId = null;
      if(idea.mustDoToday){
        if(!data.faithfulFew.mustDo.items) data.faithfulFew.mustDo.items = [];
        mustDoId = uid();
        data.faithfulFew.mustDo.items.push({ id:mustDoId, text:idea.firstAction, done:false });
      }
      await root.saveDayDataByDate(dateStr, data);

      const legacyFlow = {
        stage:4, steps:[idea.steps.step1, idea.steps.step2, idea.steps.step3],
        doneDef: idea.steps.doneLooksLike, scheduleDate: dateStr, scheduleSlot: slot,
        firstAction: idea.firstAction, addMustDo: idea.mustDoToday, mustDoId
      };
      const f = {
        text: idea.title, category: idea.lifeArea,
        steps: legacyFlow.steps, scheduleDate: dateStr, scheduleSlot: slot,
        firstAction: idea.firstAction, addMustDo: idea.mustDoToday
      };
      if(typeof root.syncPlantToCore === 'function'){
        await root.syncPlantToCore({ id:idea.id, flow:legacyFlow }, f, mustDoId);
      }
      if(typeof root.renderCalendar === 'function') root.renderCalendar();
    }

    hub.draft = IdeasStore.getIdea(idea.id);
    syncGlobalsIdeas();
    markDirty();
    showToast('Planted for '+formatIdeaDate(dateStr)+'.');
    renderWorkspace();
    renderHub();
  }

  function bindSparkDrag(){
    const board = document.getElementById('ihSparkBoard');
    if(!board || board.dataset.dragBound) return;
    board.dataset.dragBound = '1';
    let drag = null;
    board.addEventListener('mousedown', e=>{
      const note = e.target.closest('[data-ih-sticky]');
      if(!note) return;
      e.preventDefault();
      const rect = board.getBoundingClientRect();
      drag = {
        id: note.dataset.ihSticky,
        ox: e.clientX - note.offsetLeft,
        oy: e.clientY - note.offsetTop,
        board, note
      };
    });
    document.addEventListener('mousemove', e=>{
      if(!drag) return;
      const x = Math.max(0, Math.min(e.clientX - drag.board.getBoundingClientRect().left - drag.ox, drag.board.clientWidth - 80));
      const y = Math.max(0, Math.min(e.clientY - drag.board.getBoundingClientRect().top - drag.oy, drag.board.clientHeight - 40));
      drag.note.style.left = x+'px';
      drag.note.style.top = y+'px';
    });
    document.addEventListener('mouseup', ()=>{
      if(!drag) return;
      IdeasStore.updateIdea(drag.id, {
        position:{ x: parseFloat(drag.note.style.left), y: parseFloat(drag.note.style.top) }
      });
      syncGlobalsIdeas(); markDirty();
      drag = null;
    });
  }

  function bindHubEvents(){
    const panel = document.getElementById('ideasPanel');
    if(!panel) return;
    if(panel.dataset.ihBound){
      return;
    }
    panel.dataset.ihBound = '1';

    panel.addEventListener('click', e=>{
      if(e.target.id === 'ihCaptureBtn' || e.target.closest('#ihCaptureBtn')){
        captureInbox('text'); return;
      }
      if(e.target.closest('#ihVoiceBtn') || e.target.closest('#ihQuickVoice')){ startVoiceCapture(); return; }
      if(e.target.closest('#ihCameraBtn') || e.target.closest('#ihQuickCamera')){
        document.getElementById('ihCameraInput')?.click(); return;
      }
      if(e.target.closest('#ihQuickNote')){
        document.getElementById('ihInboxText')?.focus(); return;
      }
      if(e.target.closest('#ihLinkBtn')){
        const url = prompt('Paste a link URL:');
        if(url) captureInbox('text', { attachments:[{ type:'link', url, name:url }] });
        return;
      }
      if(e.target.closest('#ihAttachBtn')){
        document.getElementById('ihAttachInput')?.click(); return;
      }
      if(e.target.closest('#ihAddSticky')){ addSparkNote(); return; }
      if(e.target.closest('#ihNewIdea')){ openWorkspace(null); return; }
      if(e.target.closest('#ihSearchToggle')){
        hub.searchOpen = !hub.searchOpen; renderHub(); bindSparkDrag();
        if(hub.searchOpen) document.getElementById('ihSearchInput')?.focus();
        return;
      }
      const tab = e.target.closest('[data-ih-tab]');
      if(tab){ hub.tab = tab.dataset.ihTab; renderHub(); bindSparkDrag(); return; }
      const pipe = e.target.closest('[data-ih-pipe]');
      if(pipe){ hub.tab = pipe.dataset.ihPipe; renderHub(); bindSparkDrag(); return; }
      const row = e.target.closest('[data-ih-idea]');
      if(row && !e.target.closest('.ih-star') && !e.target.closest('.ih-more')){
        openWorkspace(row.dataset.ihIdea); return;
      }
      const open = e.target.closest('[data-ih-open]');
      if(open){ openWorkspace(open.dataset.ihOpen); return; }
      const fav = e.target.closest('[data-ih-fav]');
      if(fav){ e.stopPropagation(); IdeasStore.toggleFavorite(fav.dataset.ihFav); syncGlobalsIdeas(); markDirty(); renderHub(); bindSparkDrag(); return; }
      const pin = e.target.closest('[data-ih-pin]');
      if(pin){ IdeasStore.pinIdea(pin.dataset.ihPin); syncGlobalsIdeas(); markDirty(); renderHub(); bindSparkDrag(); return; }
      const del = e.target.closest('[data-ih-del]');
      if(del){
        if(confirm('Delete this idea?')){
          IdeasStore.deleteIdea(del.dataset.ihDel); syncGlobalsIdeas(); markDirty(); renderHub(); bindSparkDrag();
        }
        return;
      }
    });

    panel.addEventListener('input', e=>{
      if(e.target.id === 'ihSearchInput'){
        hub.search = e.target.value;
        const list = document.getElementById('ihVaultList');
        if(list){
          const ideas = filteredIdeas();
          list.innerHTML = ideas.length ? ideas.map(ideaRow).join('') :
            '<div class="ih-empty">No matching ideas.</div>';
        }
      }
    });

    panel.addEventListener('change', e=>{
      if(e.target.id === 'ihCameraInput') handleCameraFile(e.target.files?.[0]);
      if(e.target.id === 'ihAttachInput'){
        const f = e.target.files?.[0];
        if(f){
          const reader = new FileReader();
          reader.onload = ()=>{
            document.getElementById('ihInboxText').value += (document.getElementById('ihInboxText').value ? '\n' : '') + f.name;
          };
          reader.readAsDataURL(f);
        }
      }
    });

    document.getElementById('ihWorkspaceBackdrop')?.addEventListener('click', closeWorkspace);

    document.addEventListener('click', e=>{
      if(!document.getElementById('ihWorkspace') || document.getElementById('ihWorkspace').hidden) return;
      if(e.target.id === 'ihWsClose' || e.target.closest('#ihWsClose')){ closeWorkspace(); return; }
      if(e.target.id === 'ihWsFav'){
        readDraftFromDom(); persistDraft();
        IdeasStore.toggleFavorite(hub.workspaceId); hub.draft = IdeasStore.getIdea(hub.workspaceId);
        renderWorkspace(); renderHub(); return;
      }
      if(e.target.id === 'ihWsPin'){
        readDraftFromDom(); persistDraft();
        IdeasStore.pinIdea(hub.workspaceId); hub.draft = IdeasStore.getIdea(hub.workspaceId);
        renderHub(); renderWorkspace(); return;
      }
      if(e.target.id === 'ihWsDelete'){
        if(confirm('Delete this idea?')){
          IdeasStore.deleteIdea(hub.workspaceId); syncGlobalsIdeas(); markDirty(); closeWorkspace();
        }
        return;
      }
      if(e.target.id === 'ihPlantBtn'){ plantIdea(); return; }
      const win = e.target.closest('[data-ih-window]');
      if(win && document.getElementById('ihWorkspace')?.contains(win)){
        hub.draft.schedule = hub.draft.schedule || {};
        hub.draft.schedule.window = win.dataset.ihWindow;
        document.querySelectorAll('#ihWindows .ih-window-btn').forEach(b=>
          b.classList.toggle('on', b.dataset.ihWindow === win.dataset.ihWindow));
        return;
      }
      if(e.target.closest('#ihWorkspace') && (e.target.matches('input,textarea,select'))){
        clearTimeout(bindHubEvents._saveT);
        bindHubEvents._saveT = setTimeout(()=>{ readDraftFromDom(); persistDraft(); }, 600);
      }
      if(e.target.id === 'ihWsStatus'){
        readDraftFromDom();
        const st = e.target.value;
        if(hub.workspaceId) IdeasStore.moveIdeaStatus(hub.workspaceId, st);
        hub.draft.status = st;
        persistDraft();
        renderWorkspace();
        renderHub();
      }
    });

    const qa = document.getElementById('btnQuickAdd');
    if(qa && !qa.dataset.ihQuick){
      qa.dataset.ihQuick = '1';
      qa.addEventListener('click', e=>{
        if(typeof root.isIdeas === 'function' && root.isIdeas()){
          e.stopImmediatePropagation();
          openWorkspace(null);
        }
      }, true);
    }

    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape' && hub.draft && !document.getElementById('ihWorkspace')?.hidden){
        closeWorkspace();
      }
    });
    const saveBtn = document.getElementById('saveBtn');
    if(saveBtn && !saveBtn.dataset.ihSave){
      saveBtn.dataset.ihSave = '1';
      saveBtn.addEventListener('click', ()=>{
        if(typeof root.isIdeas === 'function' && root.isIdeas()){
          readDraftFromDom();
          if(hub.draft) persistDraft();
          syncGlobalsIdeas();
        }
      }, true);
    }
  }

  function loadIdeasHub(){
    const panel = document.getElementById('ideasPanel');
    const pipeline = document.getElementById('ihPipeline');
    const showError = (msg)=>{
      if(pipeline) pipeline.innerHTML = '<p class="ih-load-error">'+esc(msg)+' <button type="button" class="ih-btn-gold" onclick="location.reload()">Reload</button></p>';
      const grid = panel && panel.querySelector('.ih-grid');
      if(grid && !grid.querySelector('.ih-card')){
        grid.innerHTML = '<div class="ih-load-error" style="grid-column:1/-1"><p>'+esc(msg)+'</p></div>';
      }
    };
    try{
      if(typeof IdeasStore === 'undefined'){
        showError('Ideas Hub scripts failed to load. Hard-refresh (Cmd+Shift+R).');
        return;
      }
      const legacy = (typeof root.globals !== 'undefined' && root.globals)
        ? (root.globals.ideasHub || root.globals.ideas) : [];
      IdeasStore.init(Array.isArray(legacy) ? legacy : []);
      syncGlobalsIdeas();
      renderHub();
      bindHubEvents();
      bindSparkDrag();
    }catch(e){
      console.error('[Ideas Hub] load failed', e);
      showError('Ideas Hub could not start: '+(e.message||'unknown error'));
    }
  }

  root.loadIdeasHub = loadIdeasHub;
  root.bootIdeasHub = loadIdeasHub;
  root.openIdeaWorkspace = openWorkspace;
  root.openBlankIdeaWorkspace = ()=> openWorkspace(null);
  root.getHubIdeas = ()=> IdeasStore.getIdeas();
  root.getUntouchedHubIdeas = function(limit){
    return IdeasStore.getIdeas().filter(i=>
      i.status === 'captured' && !i.clarification?.actualIdea && !i.steps?.step1
    ).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')).slice(0, limit||3);
  };

  function autoBootIdeasHub(){
    function tryBoot(){
      var panel = document.getElementById('ideasPanel');
      if(panel && !panel.hidden && typeof root.loadIdeasHub === 'function'){
        root.loadIdeasHub();
      }
    }
    if(typeof document !== 'undefined'){
      if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', tryBoot);
      }
      document.addEventListener('click', function(e){
        if(e.target && e.target.closest && e.target.closest('[data-nav="ideas"]')){
          setTimeout(tryBoot, 0);
        }
      });
    }
  }
  autoBootIdeasHub();

})(typeof window !== 'undefined' ? window : globalThis);
