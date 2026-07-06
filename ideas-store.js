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
