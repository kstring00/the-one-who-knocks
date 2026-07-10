/**
 * With Little — unified data layer (Phase 1)
 * Single source of truth for Tasks, Seeds, Schedule, Projects, Journal, QuickNotes.
 */
(function(root){
  'use strict';

  const CORE_KEY = 'fs-core';
  const CORE_VERSION = 1;

  const TIME_SLOTS = ['beforeWork','duringWork','afterWork','eveningShutdown','timed'];
  const TASK_TAGS = ['project','growth','stewardship','none'];
  const SEED_STATUSES = ['active','resting','released','harvested'];
  const WATERING_TYPES = ['stepCompleted','manualNote','harvestNote'];

  function uid(){
    if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
  }
  function nowIso(){ return new Date().toISOString(); }
  function todayIso(d){
    const x = d ? new Date(d) : new Date();
    return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  }

  function blankCore(){
    return {
      version: CORE_VERSION,
      tasks: [],
      scheduleBlocks: [],
      seeds: [],
      waterings: [],
      projects: [],
      journalEntries: [],
      quickNotes: [],
      dailyAnchors: null,
      mentors: [],
      principles: [],
      applications: [],
      mentorshipSessions: [],
      queuedQuestions: [],
      practiceSessions: [],
      dailyCategories: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  // No hardcoded anchors — each user defines their own non-negotiables.
  // Existing users keep whatever anchors are already stored in fs-core.
  const DEFAULT_DAILY_ANCHORS = [];

  const DEFAULT_DAILY_CATEGORIES = [
    { id: 'body', icon: '♥', title: 'Body', hint: 'How am I stewarding my body today?', enabled: true, sortOrder: 0 },
    { id: 'order', icon: '☰', title: 'Order', hint: 'Is my space and schedule in order?', enabled: true, sortOrder: 1 },
    { id: 'leadership', icon: '◎', title: 'Leadership Development', hint: 'How am I growing as a leader, and what step is in place?', enabled: true, sortOrder: 2 },
    { id: 'skill', icon: '✦', title: 'Skill / Talent', hint: 'How am I measuring today?', enabled: true, sortOrder: 3 }
  ];

  function normalizeDailyAnchor(raw){
    const a = raw || {};
    const kind = a.kind === 'bible' ? 'bible'
      : (a.kind === 'prayer' ? 'prayer'
      : (a.kind === 'habit' ? 'habit'
      : (a.id === 'bible' ? 'bible' : 'prayer')));
    return {
      id: a.id || uid(),
      title: String(a.title || '').trim(),
      durationMin: typeof a.durationMin === 'number' ? a.durationMin : (a.durationMin == null ? null : Number(a.durationMin) || null),
      enabled: a.enabled !== false,
      kind,
      stewHabitId: a.stewHabitId || null
    };
  }

  function normalizeDailyCategory(raw){
    const c = raw || {};
    return {
      id: c.id || uid(),
      icon: String(c.icon || '•').trim(),
      title: String(c.title || '').trim(),
      hint: String(c.hint || '').trim(),
      enabled: c.enabled !== false,
      sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : 0
    };
  }

  function normalizePracticeSession(raw){
    const s = raw || {};
    const kind = s.kind === 'bible' ? 'bible' : 'prayer';
    return {
      id: s.id || uid(),
      kind,
      anchorId: s.anchorId || null,
      date: s.date || todayIso(),
      minutes: typeof s.minutes === 'number' ? s.minutes : (Number(s.minutes) || 0),
      entries: Array.isArray(s.entries) ? s.entries.map(e=> ({
        request: String(e?.request || '').trim(),
        fruit: String(e?.fruit || '').trim(),
        passage: String(e?.passage || '').trim(),
        takeaway: String(e?.takeaway || '').trim()
      })) : [],
      createdAt: s.createdAt || nowIso()
    };
  }

  function getDefaultDailyCategories(){
    return DEFAULT_DAILY_CATEGORIES.map(c=> normalizeDailyCategory({ ...c }));
  }

  function getDefaultDailyAnchors(){
    return DEFAULT_DAILY_ANCHORS.map(a=> ({ ...a }));
  }

  function normalizeTags(arr){
    if(!Array.isArray(arr)) return [];
    return [...new Set(arr.map(t=> String(t||'').trim()).filter(Boolean))];
  }

  function normalizeTask(raw){
    const t = raw || {};
    return {
      id: t.id || uid(),
      title: String(t.title || '').trim(),
      date: t.date || todayIso(),
      timeSlot: TIME_SLOTS.includes(t.timeSlot) ? t.timeSlot : null,
      durationMin: typeof t.durationMin === 'number' ? t.durationMin : null,
      tag: TASK_TAGS.includes(t.tag) ? t.tag : 'none',
      tags: normalizeTags(t.tags),
      seedId: t.seedId || null,
      stepNumber: typeof t.stepNumber === 'number' ? t.stepNumber : null,
      projectId: t.projectId || null,
      completed: !!t.completed,
      completedAt: t.completedAt || null,
      createdAt: t.createdAt || nowIso(),
      updatedAt: t.updatedAt || t.createdAt || nowIso(),
      legacyMustDoId: t.legacyMustDoId || null,
      anchorId: t.anchorId || null,
      scheduled: !!(t.scheduled || (TIME_SLOTS.includes(t.timeSlot) && (t.timeSlot !== 'timed' || t.startTime))),
      startTime: t.startTime || '',
      sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : null,
      principleId: t.principleId || null
    };
  }

  function normalizeScheduleBlock(raw){
    const b = raw || {};
    return {
      id: b.id || uid(),
      label: String(b.label || '').trim(),
      sublabel: String(b.sublabel || '').trim(),
      startTime: b.startTime || '',
      endTime: b.endTime || '',
      recurring: b.recurring || null,
      date: b.date || null,
      createdAt: b.createdAt || nowIso(),
      updatedAt: b.updatedAt || b.createdAt || nowIso()
    };
  }

  function normalizeSeed(raw){
    const s = raw || {};
    let status = s.status || 'active';
    if(s.status === 'growing' || s.status === 'seedbed') status = 'active';
    if(!SEED_STATUSES.includes(status)) status = 'active';
    return {
      id: s.id || uid(),
      title: String(s.title || '').trim(),
      lifeArea: s.lifeArea || 'other',
      why: String(s.why || '').trim(),
      status,
      createdAt: s.createdAt || nowIso(),
      updatedAt: s.updatedAt || s.createdAt || nowIso(),
      legacyIdeaId: s.legacyIdeaId || null,
      flow: s.flow || null,
      tags: normalizeTags(s.tags)
    };
  }

  function normalizeWatering(raw){
    const w = raw || {};
    return {
      id: w.id || uid(),
      seedId: w.seedId,
      type: WATERING_TYPES.includes(w.type) ? w.type : 'stepCompleted',
      text: String(w.text || '').trim(),
      date: w.date || todayIso(),
      createdAt: w.createdAt || nowIso()
    };
  }

  function normalizeProject(raw){
    const p = raw || {};
    return {
      id: p.id || uid(),
      title: String(p.title || '').trim(),
      linkedSeedId: p.linkedSeedId || null,
      tags: normalizeTags(p.tags),
      archived: !!p.archived,
      createdAt: p.createdAt || nowIso(),
      updatedAt: p.updatedAt || p.createdAt || nowIso()
    };
  }

  function normalizeJournalEntry(raw){
    const j = raw || {};
    return {
      id: j.id || uid(),
      date: j.date || todayIso(),
      promptText: String(j.promptText || '').trim(),
      body: String(j.body || ''),
      tags: normalizeTags(j.tags),
      createdAt: j.createdAt || nowIso(),
      updatedAt: j.updatedAt || j.createdAt || nowIso()
    };
  }

  function normalizeQuickNote(raw){
    const n = raw || {};
    return {
      id: n.id || uid(),
      text: String(n.text || '').trim(),
      tags: normalizeTags(n.tags),
      createdAt: n.createdAt || nowIso(),
      updatedAt: n.updatedAt || nowIso(),
      promotedTo: n.promotedTo || null
    };
  }

  const QUESTION_STATUSES = ['queued', 'asked'];

  function normalizeMentor(raw){
    const m = raw || {};
    return {
      id: m.id || uid(),
      label: String(m.label || '').trim() || 'M',
      role: String(m.role || '').trim(),
      name: String(m.name || '').trim(),
      nextSessionDate: m.nextSessionDate || '',
      sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : 0
    };
  }

  function normalizePrinciple(raw){
    const p = raw || {};
    return {
      id: p.id || uid(),
      mentorId: p.mentorId || '',
      sourceQuestion: String(p.sourceQuestion || '').trim(),
      title: String(p.title || '').trim(),
      detailBullets: Array.isArray(p.detailBullets) ? p.detailBullets.map(b=> String(b||'').trim()).filter(Boolean) : [],
      themeTags: normalizeTags(p.themeTags),
      createdAt: p.createdAt || nowIso()
    };
  }

  function normalizeApplication(raw){
    const a = raw || {};
    return {
      id: a.id || uid(),
      principleId: a.principleId || '',
      taskId: a.taskId || null,
      note: String(a.note || '').trim(),
      date: a.date || todayIso(),
      createdAt: a.createdAt || nowIso()
    };
  }

  function normalizeSessionEntry(raw){
    const s = raw || {};
    return {
      id: s.id || uid(),
      mentorId: s.mentorId || '',
      date: s.date || todayIso(),
      notes: String(s.notes || ''),
      attachedApplicationIds: Array.isArray(s.attachedApplicationIds) ? s.attachedApplicationIds : [],
      attachedQuestionIds: Array.isArray(s.attachedQuestionIds) ? s.attachedQuestionIds : [],
      createdAt: s.createdAt || nowIso()
    };
  }

  function normalizeQueuedQuestion(raw){
    const q = raw || {};
    return {
      id: q.id || uid(),
      mentorId: q.mentorId || '',
      text: String(q.text || '').trim(),
      status: QUESTION_STATUSES.includes(q.status) ? q.status : 'queued',
      askedInSessionId: q.askedInSessionId || null,
      sortOrder: typeof q.sortOrder === 'number' ? q.sortOrder : 0,
      createdAt: q.createdAt || nowIso()
    };
  }

  // New accounts start with zero mentors — the Mentorship view shows a
  // "Who speaks life into you?" setup until the user names their own.
  function getDefaultMentors(){
    return [];
  }

  function normalizeCore(raw){
    const c = raw && typeof raw === 'object' ? raw : {};
    const base = blankCore();
    return {
      ...base,
      ...c,
      version: CORE_VERSION,
      tasks: (c.tasks || []).map(normalizeTask),
      scheduleBlocks: (c.scheduleBlocks || []).map(normalizeScheduleBlock),
      seeds: (c.seeds || []).map(normalizeSeed),
      waterings: (c.waterings || []).map(normalizeWatering),
      projects: (c.projects || []).map(normalizeProject),
      journalEntries: (c.journalEntries || []).map(normalizeJournalEntry),
      quickNotes: (c.quickNotes || []).map(normalizeQuickNote),
      dailyAnchors: (c.dailyAnchors || getDefaultDailyAnchors()).map(normalizeDailyAnchor),
      mentors: (c.mentors || []).map(normalizeMentor),
      principles: (c.principles || []).map(normalizePrinciple),
      applications: (c.applications || []).map(normalizeApplication),
      mentorshipSessions: (c.mentorshipSessions || []).map(normalizeSessionEntry),
      queuedQuestions: (c.queuedQuestions || []).map(normalizeQueuedQuestion),
      practiceSessions: (c.practiceSessions || []).map(normalizePracticeSession),
      dailyCategories: (c.dailyCategories || getDefaultDailyCategories()).map(normalizeDailyCategory),
      updatedAt: c.updatedAt || base.updatedAt
    };
  }

  class FaithfulnessStore {
    constructor(storageAdapter){
      this.storage = storageAdapter;
      this.data = blankCore();
      this._listeners = new Set();
    }

    onChange(fn){ this._listeners.add(fn); return ()=> this._listeners.delete(fn); }
    _emit(){ this.data.updatedAt = nowIso(); this._listeners.forEach(fn=>{ try{ fn(this.data); }catch(e){ console.warn(e); } }); }

    async load(){
      const raw = await this._get(CORE_KEY);
      this.data = normalizeCore(raw ? JSON.parse(raw) : null);
      return this.data;
    }

    async save(){
      this.data.updatedAt = nowIso();
      await this._set(CORE_KEY, JSON.stringify(this.data));
      this._emit();
      return true;
    }

    async _get(key){
      const r = await this.storage.get(key);
      return r?.value ?? null;
    }
    async _set(key, value){
      return this.storage.set(key, value);
    }

    getSnapshot(){ return JSON.parse(JSON.stringify(this.data)); }

    // ——— Tasks ———
    createTask(partial){
      const task = normalizeTask({ ...partial, id: uid(), createdAt: nowIso(), updatedAt: nowIso() });
      this.data.tasks.push(task);
      return task;
    }

    updateTask(id, patch){
      const task = this.data.tasks.find(t=> t.id===id);
      if(!task) return null;
      Object.assign(task, patch, { updatedAt: nowIso() });
      return normalizeTask(task);
    }

    getTask(id){ return this.data.tasks.find(t=> t.id===id) || null; }

    getTasksForDate(date){
      return this.data.tasks.filter(t=> t.date === date);
    }

    /** Tasks shown on the day schedule (excludes First Fruits anchors and Daily priorities). */
    getScheduleTasksForDate(date){
      return this.data.tasks.filter(t=> t.date === date && !t.anchorId && !t.legacyMustDoId && t.timeSlot);
    }

    _scheduleTaskSort(a, b){
      const ao = a.sortOrder != null ? a.sortOrder : 999999;
      const bo = b.sortOrder != null ? b.sortOrder : 999999;
      if(ao !== bo) return ao - bo;
      return (a.createdAt||'').localeCompare(b.createdAt||'');
    }

    moveScheduleTask(id, direction){
      const task = this.getTask(id);
      if(!task || !task.timeSlot) return false;
      const peers = this.getScheduleTasksForDate(task.date)
        .filter(t=> t.timeSlot === task.timeSlot)
        .sort((a,b)=> this._scheduleTaskSort(a,b));
      const idx = peers.findIndex(t=> t.id === id);
      if(idx < 0) return false;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if(swap < 0 || swap >= peers.length) return false;
      const a = peers[idx];
      const b = peers[swap];
      const aOrder = a.sortOrder != null ? a.sortOrder : idx;
      const bOrder = b.sortOrder != null ? b.sortOrder : swap;
      this.updateTask(a.id, { sortOrder: bOrder });
      this.updateTask(b.id, { sortOrder: aOrder });
      return true;
    }

    /** Must-Do / Faithful Few priorities — excludes anchor tasks */
    getPriorityTasksForDate(date){
      return this.data.tasks.filter(t=> t.date === date && t.legacyMustDoId && !t.anchorId);
    }

    getAnchorTasksForDate(date){
      const cfg = this.getDailyAnchorConfig();
      const order = cfg.map(a=> a.id);
      return this.data.tasks
        .filter(t=> t.date === date && t.anchorId)
        .sort((a,b)=> order.indexOf(a.anchorId) - order.indexOf(b.anchorId));
    }

    getDailyAnchorConfig(){
      if(!this.data.dailyAnchors?.length) this.data.dailyAnchors = getDefaultDailyAnchors();
      return this.data.dailyAnchors;
    }

    setDailyAnchorConfig(anchors){
      this.data.dailyAnchors = (anchors || []).map(normalizeDailyAnchor);
      return this.data.dailyAnchors;
    }

    getDailyCategoryConfig(){
      if(!this.data.dailyCategories?.length) this.data.dailyCategories = getDefaultDailyCategories();
      return this.data.dailyCategories.slice().sort((a,b)=> (a.sortOrder||0) - (b.sortOrder||0));
    }

    setDailyCategoryConfig(categories){
      this.data.dailyCategories = (categories || []).map((c,i)=> normalizeDailyCategory({ ...c, sortOrder: i }));
      return this.data.dailyCategories;
    }

    logPracticeSession(partial){
      const s = normalizePracticeSession({ ...partial, id: uid(), createdAt: nowIso() });
      this.data.practiceSessions.push(s);
      const anchor = this.getDailyAnchorConfig().find(a=> a.id === s.anchorId);
      if(s.kind === 'prayer' && s.entries?.length){
        s.entries.forEach(e=>{
          if(!e.request && !e.fruit) return;
          if(typeof window !== 'undefined' && typeof window.addPrayerFromSession === 'function'){
            window.addPrayerFromSession({ request: e.request, fruitLine: e.fruit, askedDate: s.date, sessionId: s.id });
          }
        });
      }
      if(s.kind === 'bible' && s.entries?.length){
        s.entries.forEach(e=>{
          if(!e.passage && !e.takeaway) return;
          this.appendBibleReadingJournal(s.date, e.passage, e.takeaway);
        });
      }
      const task = this.data.tasks.find(t=> t.date === s.date && t.anchorId === s.anchorId);
      if(task && !task.completed){
        task.completed = true;
        task.completedAt = nowIso();
      }
      return s;
    }

    getPracticeSessionsForDate(dateStr, kind){
      return (this.data.practiceSessions || [])
        .filter(s=> s.date === dateStr && (!kind || s.kind === kind))
        .sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
    }

    getPracticeSummaryForDate(dateStr){
      const sessions = this.getPracticeSessionsForDate(dateStr);
      const byAnchor = {};
      sessions.forEach(s=>{
        if(!byAnchor[s.anchorId]) byAnchor[s.anchorId] = { count: 0, minutes: 0, kind: s.kind };
        byAnchor[s.anchorId].count++;
        byAnchor[s.anchorId].minutes += s.minutes || 0;
      });
      const prayer = sessions.filter(s=> s.kind === 'prayer');
      const bible = sessions.filter(s=> s.kind === 'bible');
      return {
        byAnchor,
        prayerCount: prayer.length,
        prayerMinutes: prayer.reduce((n,s)=> n + (s.minutes||0), 0),
        bibleCount: bible.length,
        bibleMinutes: bible.reduce((n,s)=> n + (s.minutes||0), 0),
        totalSessions: sessions.length
      };
    }

    getAnchorKind(anchorId){
      const a = this.getDailyAnchorConfig().find(x=> x.id === anchorId);
      return a?.kind || (anchorId === 'bible' ? 'bible' : 'prayer');
    }

    ensureDailyAnchors(dateStr){
      const cfg = this.getDailyAnchorConfig().filter(a=> a.enabled);
      cfg.forEach(a=>{
        let task = this.data.tasks.find(t=> t.date === dateStr && t.anchorId === a.id);
        if(!task){
          this.createTask({
            title: a.title,
            date: dateStr,
            tag: 'stewardship',
            anchorId: a.id,
            durationMin: a.durationMin,
            tags: ['First Fruits']
          });
        } else if(task.title !== a.title || task.durationMin !== a.durationMin){
          this.updateTask(task.id, { title: a.title, durationMin: a.durationMin, tags: ['First Fruits'] });
        }
      });
    }

    syncAnchorsToDay(dateStr, dayData){
      if(!dayData?.faithfulFew?.mustDo) return dayData;
      if(!dayData.faithfulFew.mustDo.items) dayData.faithfulFew.mustDo.items = [];
      const anchors = this.getAnchorTasksForDate(dateStr);
      anchors.forEach(task=>{
        let it = dayData.faithfulFew.mustDo.items.find(x=> x.anchorId === task.anchorId);
        if(!it){
          it = { id: uid(), text: task.title, done: !!task.completed, anchorId: task.anchorId };
          dayData.faithfulFew.mustDo.items.unshift(it);
          if(!task.legacyMustDoId){
            task.legacyMustDoId = it.id;
          }
        } else {
          it.text = task.title;
          it.done = !!task.completed;
          if(!task.legacyMustDoId) task.legacyMustDoId = it.id;
        }
      });
      const anchorIds = new Set(anchors.map(a=> a.anchorId));
      dayData.faithfulFew.mustDo.items.sort((a,b)=>{
        const aA = a.anchorId && anchorIds.has(a.anchorId) ? 0 : 1;
        const bA = b.anchorId && anchorIds.has(b.anchorId) ? 0 : 1;
        if(aA !== bA) return aA - bA;
        return 0;
      });
      return dayData;
    }

    deleteTask(id){
      const i = this.data.tasks.findIndex(t=> t.id === id);
      if(i < 0) return false;
      this.data.tasks.splice(i, 1);
      return true;
    }

    async deleteTaskAndSave(id){
      this.deleteTask(id);
      await this.save();
      return true;
    }

    syncMustDosFromDay(dateStr, dayData){
      this.ensureDailyAnchors(dateStr);
      this.syncAnchorsToDay(dateStr, dayData);
      if(!dayData?.faithfulFew?.mustDo?.items) return;
      dayData.faithfulFew.mustDo.items.forEach(it=>{
        if(!it?.id || it.anchorId) return;
        let task = this.findTaskByLegacyMustDo(it.id, dateStr);
        if(!task){
          this.createTask({
            title: it.text || '',
            date: dateStr,
            tag: 'stewardship',
            legacyMustDoId: it.id,
            completed: !!it.done
          });
        } else {
          if(task.title !== (it.text||'')) this.updateTask(task.id, { title: it.text||'' });
          if(!!task.completed !== !!it.done){
            if(it.done) task.completed = true;
            else { task.completed = false; task.completedAt = null; }
            task.updatedAt = nowIso();
          }
        }
      });
    }

    getAllTags(){
      const set = new Set();
      const add = e=> (e.tags||[]).forEach(t=> set.add(t));
      this.data.tasks.forEach(add);
      this.data.seeds.forEach(add);
      this.data.projects.forEach(add);
      this.data.journalEntries.forEach(add);
      this.data.quickNotes.forEach(add);
      return [...set].sort((a,b)=> a.localeCompare(b));
    }

    findByTag(tag){
      const t = String(tag||'').trim();
      if(!t) return { tasks:[], seeds:[], projects:[], journalEntries:[], quickNotes:[] };
      const has = e=> (e.tags||[]).includes(t);
      return {
        tasks: this.data.tasks.filter(has),
        seeds: this.data.seeds.filter(has),
        projects: this.data.projects.filter(has),
        journalEntries: this.data.journalEntries.filter(has),
        quickNotes: this.data.quickNotes.filter(has)
      };
    }

    setEntityTags(type, id, tags){
      const list = normalizeTags(tags);
      const map = {
        task: 'tasks', seed: 'seeds', project: 'projects',
        journal: 'journalEntries', note: 'quickNotes'
      };
      const key = map[type];
      if(!key) return null;
      const ent = this.data[key].find(x=> x.id === id);
      if(!ent) return null;
      ent.tags = list;
      ent.updatedAt = nowIso();
      return ent;
    }

    async updateEntityTags(type, id, tags){
      const ent = this.setEntityTags(type, id, tags);
      if(ent) await this.save();
      return ent;
    }

    getTasksBySeed(seedId){
      return this.data.tasks.filter(t=> t.seedId === seedId);
    }

    getTasksByProject(projectId){
      return this.data.tasks.filter(t=> t.projectId === projectId);
    }

    /**
     * Complete a task from any surface — calendar, daily, dashboard.
     * Enforces: one Task entity, complete everywhere; auto-watering if seedId.
     */
    async completeTask(id, opts){
      const task = this.getTask(id);
      if(!task) throw new Error('Task not found: '+id);
      const wasComplete = task.completed;
      task.completed = true;
      task.completedAt = task.completedAt || nowIso();
      task.updatedAt = nowIso();

      let watering = null;
      let seedHarvested = false;
      let needsPrincipleHarvest = false;
      if(task.seedId && !wasComplete){
        watering = this._waterOnTaskComplete(task, opts);
        seedHarvested = this._maybeHarvestSeed(task.seedId);
      }
      if(task.principleId && !wasComplete && !opts?.skipPrincipleHarvest){
        needsPrincipleHarvest = true;
      }
      await this.save();
      return { task: normalizeTask(task), watering, seedHarvested, needsPrincipleHarvest };
    }

    async uncompleteTask(id){
      const task = this.getTask(id);
      if(!task) return null;
      task.completed = false;
      task.completedAt = null;
      task.updatedAt = nowIso();
      await this.save();
      return task;
    }

    _waterOnTaskComplete(task, opts){
      const seed = this.getSeed(task.seedId);
      const seedTasks = this.getTasksBySeed(task.seedId).filter(t=> t.stepNumber != null);
      const numbered = seedTasks.filter(t=> t.stepNumber).sort((a,b)=> a.stepNumber - b.stepNumber);
      const allDone = numbered.length > 0 && numbered.every(t=> t.completed);
      const type = allDone ? 'harvestNote' : 'stepCompleted';
      const w = normalizeWatering({
        id: uid(),
        seedId: task.seedId,
        type,
        text: opts?.wateringText || task.title,
        date: task.date,
        createdAt: nowIso()
      });
      this.data.waterings.push(w);
      return w;
    }

    _maybeHarvestSeed(seedId){
      const seed = this.getSeed(seedId);
      if(!seed) return false;
      const steps = this.getTasksBySeed(seedId).filter(t=> t.stepNumber != null);
      if(!steps.length) return false;
      const allDone = steps.every(t=> t.completed);
      if(allDone && seed.status !== 'harvested'){
        seed.status = 'harvested';
        seed.updatedAt = nowIso();
        this.data.waterings.push(normalizeWatering({
          id: uid(), seedId, type: 'harvestNote',
          text: 'Harvested — all steps complete',
          date: todayIso(), createdAt: nowIso()
        }));
        return true;
      }
      return false;
    }

    findTaskByLegacyMustDo(mustDoId, date){
      return this.data.tasks.find(t=> t.legacyMustDoId === mustDoId && t.date === date) || null;
    }

    // ——— Seeds ———
    createSeed(partial){
      const seed = normalizeSeed({ ...partial, id: uid(), createdAt: nowIso(), updatedAt: nowIso() });
      this.data.seeds.push(seed);
      return seed;
    }

    updateSeed(id, patch){
      const seed = this.getSeed(id);
      if(!seed) return null;
      Object.assign(seed, patch, { updatedAt: nowIso() });
      return normalizeSeed(seed);
    }

    getSeed(id){ return this.data.seeds.find(s=> s.id===id) || null; }

    getSeedByLegacyIdea(ideaId){
      return this.data.seeds.find(s=> s.legacyIdeaId === ideaId) || null;
    }

    getWateringsForSeed(seedId){
      return this.data.waterings.filter(w=> w.seedId === seedId)
        .sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
    }

    getRecentlyWateredSeeds(limit){
      const bySeed = {};
      this.data.waterings.forEach(w=>{
        if(!bySeed[w.seedId] || w.createdAt > bySeed[w.seedId]) bySeed[w.seedId] = w.createdAt;
      });
      return this.data.seeds
        .filter(s=> bySeed[s.id] && s.status === 'active')
        .sort((a,b)=> (bySeed[b.id]||'').localeCompare(bySeed[a.id]||''))
        .slice(0, limit || 3);
    }

    addWatering(partial){
      const w = normalizeWatering({ ...partial, id: uid(), createdAt: nowIso() });
      this.data.waterings.push(w);
      return w;
    }

    // ——— Schedule ———
    createScheduleBlock(partial){
      const block = normalizeScheduleBlock({ ...partial, id: uid(), createdAt: nowIso(), updatedAt: nowIso() });
      this.data.scheduleBlocks.push(block);
      return block;
    }

    updateScheduleBlock(id, patch){
      const b = this.data.scheduleBlocks.find(x=> x.id === id);
      if(!b) return null;
      Object.assign(b, patch, { updatedAt: nowIso() });
      return normalizeScheduleBlock(b);
    }

    deleteScheduleBlock(id){
      const i = this.data.scheduleBlocks.findIndex(x=> x.id === id);
      if(i < 0) return false;
      this.data.scheduleBlocks.splice(i, 1);
      return true;
    }

    getScheduleBlocksForDate(dateStr){
      const dow = new Date(dateStr+'T12:00:00').getDay();
      return this.data.scheduleBlocks.filter(b=>{
        if(b.date) return b.date === dateStr;
        if(b.recurring?.daysOfWeek) return b.recurring.daysOfWeek.includes(dow);
        return false;
      });
    }

    // ——— Projects ———
    createProject(partial){
      const p = normalizeProject({ ...partial, id: uid(), createdAt: nowIso(), updatedAt: nowIso() });
      this.data.projects.push(p);
      return p;
    }

    updateProject(id, patch){
      const p = this.data.projects.find(x=> x.id === id);
      if(!p) return null;
      Object.assign(p, patch, { updatedAt: nowIso() });
      return normalizeProject(p);
    }

    archiveProject(id){
      return this.updateProject(id, { archived: true });
    }

    getActiveProjects(){
      return this.data.projects.filter(p=> !p.archived);
    }

    // ——— Mentorship ———
    // Kept for API compatibility; new accounts intentionally start with no mentors.
    ensureDefaultMentors(){
      return false;
    }

    getMentors(){
      return (this.data.mentors || []).slice().sort((a,b)=> (a.sortOrder||0) - (b.sortOrder||0));
    }

    getMentor(id){
      return this.getMentors().find(m=> m.id === id) || null;
    }

    setMentorConfig(mentors){
      this.data.mentors = (mentors || []).map(normalizeMentor);
      return this.data.mentors;
    }

    createMentor(partial){
      const m = normalizeMentor({ ...partial, id: uid(), sortOrder: this.data.mentors.length });
      this.data.mentors.push(m);
      return m;
    }

    updateMentor(id, patch){
      const m = this.data.mentors.find(x=> x.id === id);
      if(!m) return null;
      Object.assign(m, patch);
      return normalizeMentor(m);
    }

    deleteMentor(id){
      const i = this.data.mentors.findIndex(x=> x.id === id);
      if(i < 0) return false;
      this.data.mentors.splice(i, 1);
      this.data.principles = this.data.principles.filter(p=> p.mentorId !== id);
      this.data.queuedQuestions = this.data.queuedQuestions.filter(q=> q.mentorId !== id);
      this.data.mentorshipSessions = this.data.mentorshipSessions.filter(s=> s.mentorId !== id);
      return true;
    }

    createPrinciple(partial){
      const p = normalizePrinciple({ ...partial, id: uid(), createdAt: nowIso() });
      this.data.principles.push(p);
      return p;
    }

    updatePrinciple(id, patch){
      const p = this.data.principles.find(x=> x.id === id);
      if(!p) return null;
      Object.assign(p, patch);
      return normalizePrinciple(p);
    }

    deletePrinciple(id){
      const i = this.data.principles.findIndex(x=> x.id === id);
      if(i < 0) return false;
      this.data.principles.splice(i, 1);
      this.data.applications = this.data.applications.filter(a=> a.principleId !== id);
      this.data.tasks.forEach(t=> { if(t.principleId === id) t.principleId = null; });
      return true;
    }

    getPrinciple(id){
      return this.data.principles.find(p=> p.id === id) || null;
    }

    getPrinciplesByMentor(mentorId){
      return this.data.principles.filter(p=> p.mentorId === mentorId)
        .sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
    }

    getPrinciplesGroupedByQuestion(mentorId){
      const groups = {};
      this.getPrinciplesByMentor(mentorId).forEach(p=>{
        const key = p.sourceQuestion || '(Uncategorized)';
        if(!groups[key]) groups[key] = [];
        groups[key].push(p);
      });
      return groups;
    }

    getApplicationsByPrinciple(principleId){
      return this.data.applications.filter(a=> a.principleId === principleId)
        .sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.createdAt||'').localeCompare(a.createdAt||''));
    }

    getApplicationCount(principleId){
      return this.data.applications.filter(a=> a.principleId === principleId).length;
    }

    createApplication(partial){
      const a = normalizeApplication({ ...partial, id: uid(), createdAt: nowIso() });
      this.data.applications.push(a);
      return a;
    }

    logPrincipleApplication(principleId, { note, date, taskId }){
      return this.createApplication({
        principleId,
        note: note || '',
        date: date || todayIso(),
        taskId: taskId || null
      });
    }

    putPrincipleToWork(principleId, { title, date, timeSlot, startTime }){
      const principle = this.getPrinciple(principleId);
      if(!principle) return null;
      const task = this.createTask({
        title: title || principle.title,
        date: date || todayIso(),
        timeSlot: timeSlot || null,
        startTime: startTime || '',
        tag: 'stewardship',
        principleId
      });
      return task;
    }

    createSessionEntry(partial){
      const s = normalizeSessionEntry({ ...partial, id: uid(), createdAt: nowIso() });
      this.data.mentorshipSessions.push(s);
      return s;
    }

    updateSessionEntry(id, patch){
      const s = this.data.mentorshipSessions.find(x=> x.id === id);
      if(!s) return null;
      Object.assign(s, patch);
      return normalizeSessionEntry(s);
    }

    getSessionsByMentor(mentorId){
      return this.data.mentorshipSessions.filter(s=> s.mentorId === mentorId)
        .sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    }

    getLastSession(mentorId){
      return this.getSessionsByMentor(mentorId)[0] || null;
    }

    getApplicationsSinceDate(mentorId, sinceDate){
      const pids = new Set(this.getPrinciplesByMentor(mentorId).map(p=> p.id));
      return this.data.applications.filter(a=> pids.has(a.principleId) && (!sinceDate || a.date > sinceDate))
        .sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    }

    startNewSession(mentorId, { date, notes }){
      const last = this.getLastSession(mentorId);
      const since = last?.date || '';
      const apps = this.getApplicationsSinceDate(mentorId, since);
      const askedToday = this.data.queuedQuestions.filter(q=>
        q.mentorId === mentorId && q.status === 'asked' && q.askedInSessionId == null &&
        (!since || (q.createdAt||'').slice(0,10) >= since)
      );
      return this.createSessionEntry({
        mentorId,
        date: date || todayIso(),
        notes: notes || '',
        attachedApplicationIds: apps.map(a=> a.id),
        attachedQuestionIds: askedToday.map(q=> q.id)
      });
    }

    buildSessionPrepText(mentorId){
      const mentor = this.getMentor(mentorId);
      const last = this.getLastSession(mentorId);
      const since = last?.date || '';
      const apps = this.getApplicationsSinceDate(mentorId, since);
      const queued = this.getQueuedQuestions(mentorId);
      const lines = [];
      lines.push('Session prep — ' + (mentor?.label || '') + ' (' + (mentor?.role || '') + ')');
      lines.push('Date: ' + todayIso());
      lines.push('');
      lines.push('What I practiced:');
      if(!apps.length) lines.push('  (none logged since last session)');
      apps.forEach(a=>{
        const p = this.getPrinciple(a.principleId);
        lines.push('  · ' + (p?.title || 'Principle') + ' — ' + a.date + (a.note ? ': ' + a.note : ''));
      });
      lines.push('');
      lines.push('Questions for this session:');
      if(!queued.length) lines.push('  (queue empty)');
      queued.forEach(q=> lines.push('  · ' + q.text));
      return lines.join('\n');
    }

    createQueuedQuestion(partial){
      const qs = this.data.queuedQuestions.filter(q=> q.mentorId === partial.mentorId && q.status === 'queued');
      const q = normalizeQueuedQuestion({
        ...partial,
        id: uid(),
        sortOrder: qs.length,
        createdAt: nowIso()
      });
      this.data.queuedQuestions.push(q);
      return q;
    }

    updateQueuedQuestion(id, patch){
      const q = this.data.queuedQuestions.find(x=> x.id === id);
      if(!q) return null;
      Object.assign(q, patch);
      return normalizeQueuedQuestion(q);
    }

    deleteQueuedQuestion(id){
      const i = this.data.queuedQuestions.findIndex(x=> x.id === id);
      if(i < 0) return false;
      this.data.queuedQuestions.splice(i, 1);
      return true;
    }

    getQueuedQuestions(mentorId){
      return this.data.queuedQuestions.filter(q=> q.mentorId === mentorId && q.status === 'queued')
        .sort((a,b)=> (a.sortOrder||0) - (b.sortOrder||0));
    }

    getAskedQuestions(mentorId){
      return this.data.queuedQuestions.filter(q=> q.mentorId === mentorId && q.status === 'asked')
        .sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    }

    reorderQueuedQuestions(mentorId, orderedIds){
      orderedIds.forEach((id, i)=>{
        const q = this.data.queuedQuestions.find(x=> x.id === id);
        if(q && q.mentorId === mentorId) q.sortOrder = i;
      });
    }

    markQuestionAsked(questionId, sessionId){
      const q = this.data.queuedQuestions.find(x=> x.id === questionId);
      if(!q) return null;
      q.status = 'asked';
      q.askedInSessionId = sessionId || null;
      const principle = this.createPrinciple({
        mentorId: q.mentorId,
        sourceQuestion: q.text,
        title: '',
        detailBullets: [],
        themeTags: []
      });
      return { question: normalizeQueuedQuestion(q), principle };
    }

    getMentorStats(mentorId){
      const principles = this.getPrinciplesByMentor(mentorId);
      const withApps = principles.filter(p=> this.getApplicationCount(p.id) > 0).length;
      return { total: principles.length, practiced: withApps };
    }

    getPrinciplesByTheme(themeTag){
      const tag = String(themeTag||'').trim().toLowerCase();
      return this.data.principles.filter(p=>
        p.themeTags.some(t=> t.toLowerCase() === tag)
      );
    }

    getAllThemeTags(){
      const set = new Set();
      this.data.principles.forEach(p=> p.themeTags.forEach(t=> set.add(t)));
      return [...set].sort();
    }

    getThreadsGrouped(){
      const groups = {};
      this.data.principles.forEach(p=>{
        (p.themeTags.length ? p.themeTags : ['untagged']).forEach(tag=>{
          const key = tag.toLowerCase();
          if(!groups[key]) groups[key] = { tag, principles: [] };
          groups[key].principles.push(p);
        });
      });
      return Object.values(groups).sort((a,b)=> a.tag.localeCompare(b.tag));
    }

    matchPrinciplesForDanger(text, limit){
      const q = String(text||'').toLowerCase();
      if(!q.trim()) return [];
      const words = q.split(/\W+/).filter(w=> w.length > 2);
      if(!words.length) return [];
      const scored = this.data.principles.map(p=>{
        const hay = (p.title + ' ' + p.sourceQuestion + ' ' + p.themeTags.join(' ')).toLowerCase();
        let score = 0;
        words.forEach(w=> { if(hay.includes(w)) score++; });
        return { principle: p, score };
      }).filter(x=> x.score > 0);
      scored.sort((a,b)=> b.score - a.score);
      return scored.slice(0, limit || 3).map(x=> x.principle);
    }

    completePrincipleHarvest(taskId, note){
      const task = this.getTask(taskId);
      if(!task?.principleId) return null;
      return this.logPrincipleApplication(task.principleId, {
        note: note || task.title,
        date: task.date,
        taskId: task.id
      });
    }

    getOldestUnwateredActiveSeed(){
      const watered = new Set(this.data.waterings.map(w=> w.seedId));
      return this.data.seeds
        .filter(s=> s.status === 'active' && !watered.has(s.id))
        .sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''))[0] || null;
    }

    getNextStepForSeed(seedId){
      const tasks = this.getTasksBySeed(seedId).filter(t=> t.stepNumber != null);
      const pending = tasks.filter(t=> !t.completed).sort((a,b)=> a.stepNumber - b.stepNumber);
      if(pending.length) return pending[0];
      const seed = this.getSeed(seedId);
      if(seed?.flow?.steps){
        const idx = (seed.flow.stepsDone || []).findIndex((d,i)=> !d && seed.flow.steps[i]?.trim());
        if(idx >= 0) return { title: seed.flow.steps[idx], stepNumber: idx + 1, seedId, pending: true };
      }
      return null;
    }

    projectHasTaskThisWeek(projectId, weekStartStr){
      const start = new Date(weekStartStr + 'T12:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return this.data.tasks.some(t=>{
        if(t.projectId !== projectId) return false;
        const d = new Date(t.date + 'T12:00:00');
        return d >= start && d < end;
      });
    }

    getProject(id){ return this.data.projects.find(p=> p.id===id) || null; }

    /** Derived — never stored manually */
    getProjectPercentComplete(projectId){
      const tasks = this.getTasksByProject(projectId);
      if(!tasks.length) return 0;
      const done = tasks.filter(t=> t.completed).length;
      return Math.round(done / tasks.length * 100);
    }

    // ——— Journal ———
    upsertJournalEntry(partial){
      const existing = this.data.journalEntries.find(j=> j.date === partial.date);
      if(existing){
        Object.assign(existing, partial, { updatedAt: nowIso() });
        return normalizeJournalEntry(existing);
      }
      const entry = normalizeJournalEntry({ ...partial, id: uid(), createdAt: nowIso(), updatedAt: nowIso() });
      this.data.journalEntries.push(entry);
      return entry;
    }

    getJournalForDate(date){ return this.data.journalEntries.find(j=> j.date === date) || null; }

    appendBibleReadingJournal(dateStr, passage, takeaway){
      const block = (passage ? String(passage).trim() + '\n\n' : '') + String(takeaway || '').trim();
      if(!block.trim()) return null;
      const line = '【Bible reading】\n' + block;
      const existing = this.getJournalForDate(dateStr);
      if(existing){
        existing.body = existing.body ? existing.body.trim() + '\n\n---\n\n' + line : line;
        existing.tags = normalizeTags([...(existing.tags||[]), 'bible-reading']);
        existing.updatedAt = nowIso();
        return normalizeJournalEntry(existing);
      }
      const entry = normalizeJournalEntry({ id: uid(), date: dateStr, body: line, tags: ['bible-reading'], createdAt: nowIso(), updatedAt: nowIso() });
      this.data.journalEntries.push(entry);
      return entry;
    }

    getNonNegotiableSummary(dateStr, dayData){
      const items = (dayData?.faithfulFew?.mustDo?.items || []).filter(it=> !it.anchorId);
      const kept = items.filter(it=> it.done && !it.released).length;
      const carried = items.filter(it=> it.eveningAction === 'carry').length;
      const released = items.filter(it=> it.released).length;
      return { kept, carried, released, total: items.length };
    }

    // ——— Quick notes ———
    createQuickNote(text){
      const note = normalizeQuickNote({ id: uid(), text, createdAt: nowIso(), updatedAt: nowIso() });
      this.data.quickNotes.unshift(note);
      return note;
    }

    promoteNoteToTask(noteId, taskPartial){
      const note = this.data.quickNotes.find(n=> n.id === noteId);
      if(!note) return null;
      const task = this.createTask({ title: note.text, ...taskPartial });
      note.promotedTo = { type: 'task', id: task.id };
      note.updatedAt = nowIso();
      return task;
    }

    promoteNoteToSeed(noteId, seedPartial){
      const note = this.data.quickNotes.find(n=> n.id === noteId);
      if(!note) return null;
      const seed = this.createSeed({ title: note.text, ...seedPartial });
      note.promotedTo = { type: 'seed', id: seed.id };
      note.updatedAt = nowIso();
      return seed;
    }

    // ——— Dashboard summary helpers ———
    getDashboardSummary(dateStr, opts){
      this.ensureDailyAnchors(dateStr);
      const anchors = this.getAnchorTasksForDate(dateStr);
      const priorities = this.getPriorityTasksForDate(dateStr);
      const all = [...anchors, ...priorities];
      const anchorOpen = anchors.filter(t=> !t.completed);
      const priOpen = priorities.filter(t=> !t.completed);
      const growing = this.data.seeds.filter(s=> s.status === 'active').length;
      const nextBlock = this._nextScheduleBlock(dateStr, opts?.now);
      const anchorDone = anchors.filter(t=> t.completed).length;
      const practice = this.getPracticeSummaryForDate(dateStr);
      const practiceLine = [];
      if(practice.prayerCount) practiceLine.push('Prayer ×'+practice.prayerCount);
      if(practice.bibleMinutes) practiceLine.push('Word '+practice.bibleMinutes+'m');
      else if(practice.bibleCount) practiceLine.push('Word ×'+practice.bibleCount);
      const pl = practiceLine.length ? practiceLine.join(', ') + ' today' : '';
      return {
        prioritiesLeft: priOpen.length,
        tasksCompleted: all.filter(t=> t.completed).length,
        tasksTotal: all.length,
        seedsGrowing: growing,
        nextBlockLabel: nextBlock?.label || null,
        nextBlockTime: nextBlock?.startTime || null,
        firstFruitsDone: anchorDone,
        firstFruitsTotal: anchors.length,
        firstFruitsComplete: anchors.length > 0 && anchorDone === anchors.length,
        practiceSummary: practice,
        practiceLine: pl
      };
    }

    _nextScheduleBlock(dateStr, now){
      const blocks = this.getScheduleBlocksForDate(dateStr);
      const timed = this.data.tasks.filter(t=> t.date === dateStr && t.timeSlot === 'timed' && !t.completed);
      const nowMin = now ? now.getHours()*60+now.getMinutes() : null;
      let best = null;
      blocks.forEach(b=>{
        if(!b.startTime) return;
        const [h,m] = b.startTime.split(':').map(Number);
        const mins = h*60+m;
        if(nowMin != null && mins <= nowMin) return;
        if(!best || mins < best._mins) best = { ...b, _mins: mins };
      });
      if(best) delete best._mins;
      return best;
    }

    // ——— Legacy migration ———
    async migrateFromLegacy(legacy){
      if(this.data._legacyMigrated) return { migrated: false, skipped: true };
      if(!legacy) return { migrated: false };
      let changed = false;
      const globals = legacy.globals || {};
      const getDay = legacy.getDayJSON;

      // Ideas → Seeds
      (globals.ideas || []).forEach(idea=>{
        if(this.getSeedByLegacyIdea(idea.id)) return;
        const statusMap = { growing:'active', seedbed:'active', resting:'resting', released:'released', harvested:'harvested', active:'active', promoted:'active' };
        this.createSeed({
          legacyIdeaId: idea.id,
          title: idea.text || 'Untitled',
          lifeArea: idea.category || 'other',
          why: idea.flow?.doneDef || '',
          status: statusMap[idea.status] || 'active',
          flow: idea.flow || null,
          createdAt: idea.createdAt,
          updatedAt: idea.updatedAt || idea.createdAt
        });
        changed = true;
      });

      // myWeek → recurring ScheduleBlocks
      if(globals.myWeek){
        for(let dow=0; dow<7; dow++){
          (globals.myWeek[dow] || []).forEach(block=>{
            const exists = this.data.scheduleBlocks.some(b=>
              b.recurring?.daysOfWeek?.[0] === dow && b.label === block.label && b.startTime === block.start
            );
            if(exists) return;
            this.createScheduleBlock({
              label: block.label || 'Block',
              sublabel: '',
              startTime: block.start || '',
              endTime: block.end || '',
              recurring: { daysOfWeek: [dow], pattern: 'weekly' }
            });
            changed = true;
          });
        }
      }

      // Must-dos + execute slots from recent days (async)
      if(typeof getDay === 'function'){
        const today = new Date();
        for(let i=-7; i<=30; i++){
          const d = new Date(today);
          d.setDate(d.getDate()+i);
          const dateStr = todayIso(d);
          const day = await getDay('fs-day:'+dateStr);
          if(!day) continue;
          const mustItems = day.faithfulFew?.mustDo?.items || [];
          mustItems.forEach(it=>{
            if(!it.text) return;
            if(this.data.tasks.some(t=> t.legacyMustDoId === it.id && t.date === dateStr)) return;
            const seed = this._findSeedForMustDo(it, globals.ideas);
            this.createTask({
              title: it.text,
              date: dateStr,
              tag: seed ? 'growth' : 'stewardship',
              seedId: seed?.id || null,
              completed: !!it.done,
              completedAt: it.done ? nowIso() : null,
              legacyMustDoId: it.id
            });
            changed = true;
          });
          const slotMap = [
            ['beforeWork','beforeWork'],['duringWork','duringWork'],
            ['afterWork','afterWork'],['eveningShutdown','eveningShutdown']
          ];
          slotMap.forEach(([field, slot])=>{
            const text = day.execute?.[field];
            if(!text) return;
            if(this.data.tasks.some(t=> t.date===dateStr && t.timeSlot===slot && t.title===text && t.seedId)) return;
            const linked = this._findSeedForExecute(text, dateStr, globals.ideas);
            if(linked){
              this.createTask({
                title: text,
                date: dateStr,
                timeSlot: slot,
                tag: 'growth',
                seedId: linked.id,
                stepNumber: 1,
                completed: !!linked.flow?.stepsDone?.[0]
              });
              changed = true;
            }
          });
        }
      }

      if(changed){
        this.data._legacyMigrated = true;
        await this.save();
      }
      return { migrated: changed };
    }

    _findSeedForMustDo(mustDoItem, ideas){
      for(const idea of ideas || []){
        const seed = this.getSeedByLegacyIdea(idea.id);
        if(seed && idea.flow?.mustDoId === mustDoItem.id) return seed;
      }
      return null;
    }

    _findSeedForExecute(text, dateStr, ideas){
      for(const idea of ideas || []){
        const seed = this.getSeedByLegacyIdea(idea.id);
        if(!seed?.flow) continue;
        if(seed.flow.scheduleDate === dateStr && seed.flow.steps?.[0] === text) return seed;
      }
      return null;
    }

    /** Sync task completion back to legacy daily must-do for coexistence */
    syncTaskToLegacyDay(task, dayData){
      if(!dayData || !task.legacyMustDoId) return dayData;
      const items = dayData.faithfulFew?.mustDo?.items;
      if(!items) return dayData;
      const it = items.find(x=> x.id === task.legacyMustDoId);
      if(it) it.done = task.completed;
      return dayData;
    }

    syncLegacyMustDoToTask(mustDoId, date, done, dayData){
      let task = this.findTaskByLegacyMustDo(mustDoId, date);
      if(!task && dayData){
        const it = dayData.faithfulFew?.mustDo?.items?.find(x=> x.id === mustDoId);
        if(it){
          task = this.createTask({
            title: it.text,
            date,
            tag: 'stewardship',
            legacyMustDoId: mustDoId,
            completed: !!done
          });
        }
      }
      if(!task) return null;
      if(done && !task.completed) return this.completeTask(task.id);
      if(!done && task.completed) return this.uncompleteTask(task.id);
      return { task };
    }
  }

  /** In-memory storage for tests */
  function createMemoryStorage(){
    const map = new Map();
    return {
      async get(key){ return map.has(key) ? { value: map.get(key) } : null; },
      async set(key, value){ map.set(key, value); return true; },
      _dump: ()=> Object.fromEntries(map)
    };
  }

  /** Run Phase 1 acceptance tests — returns { pass, fail, results } */
  async function runFaithfulnessStoreTests(storeFactory){
    const results = [];
    function assert(name, cond, detail){
      results.push({ name, pass: !!cond, detail: detail || '' });
      if(!cond) throw new Error(name+(detail ? ': '+detail : ''));
    }

    try{
      const storage = createMemoryStorage();
      const store = storeFactory ? storeFactory(storage) : new FaithfulnessStore(storage);
      await store.load();

      const seed = store.createSeed({ title: 'Launch video', lifeArea: 'content', status: 'active' });
      assert('create seed', !!seed.id, seed.id);

      const task = store.createTask({
        title: 'Set up tripod',
        date: '2026-07-05',
        timeSlot: 'beforeWork',
        tag: 'growth',
        seedId: seed.id,
        stepNumber: 1
      });
      await store.save();
      assert('create task', store.getTask(task.id)?.title === 'Set up tripod');

      const calTasks = store.getTasksForDate('2026-07-05');
      assert('task on calendar', calTasks.some(t=> t.id === task.id));

      const { task: completed, watering } = await store.completeTask(task.id);
      assert('complete task', completed.completed === true);
      assert('watering created', !!watering && watering.seedId === seed.id);
      assert('calendar shows complete', store.getTask(task.id).completed === true);

      const waters = store.getWateringsForSeed(seed.id);
      assert('watering logged', waters.length >= 1);

      const project = store.createProject({ title: 'YouTube channel' });
      const t1 = store.createTask({ title: 'A', date: '2026-07-05', projectId: project.id, tag: 'project' });
      store.createTask({ title: 'B', date: '2026-07-05', projectId: project.id, tag: 'project' });
      await store.completeTask(t1.id);
      const pct = store.getProjectPercentComplete(project.id);
      assert('project percent derived', pct === 50, 'got '+pct);

      results.push({ name: 'ALL TESTS', pass: true, detail: results.length+' checks' });
      return { pass: true, fail: 0, results };
    }catch(e){
      results.push({ name: 'FAILED', pass: false, detail: e.message });
      return { pass: false, fail: 1, results, error: e.message };
    }
  }

  root.FaithfulnessStore = FaithfulnessStore;
  root.FaithfulnessStoreCORE_KEY = CORE_KEY;
  root.createMemoryStorage = createMemoryStorage;
  root.runFaithfulnessStoreTests = runFaithfulnessStoreTests;
  root.normalizeFaithfulnessCore = normalizeCore;

})(typeof window !== 'undefined' ? window : globalThis);
