/**
 * Faithfulness System — unified data layer (Phase 1)
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
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  function normalizeTask(raw){
    const t = raw || {};
    return {
      id: t.id || uid(),
      title: String(t.title || '').trim(),
      date: t.date || todayIso(),
      timeSlot: TIME_SLOTS.includes(t.timeSlot) ? t.timeSlot : 'beforeWork',
      durationMin: typeof t.durationMin === 'number' ? t.durationMin : null,
      tag: TASK_TAGS.includes(t.tag) ? t.tag : 'none',
      seedId: t.seedId || null,
      stepNumber: typeof t.stepNumber === 'number' ? t.stepNumber : null,
      projectId: t.projectId || null,
      completed: !!t.completed,
      completedAt: t.completedAt || null,
      createdAt: t.createdAt || nowIso(),
      updatedAt: t.updatedAt || t.createdAt || nowIso(),
      legacyMustDoId: t.legacyMustDoId || null
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
      flow: s.flow || null
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
      createdAt: j.createdAt || nowIso(),
      updatedAt: j.updatedAt || j.createdAt || nowIso()
    };
  }

  function normalizeQuickNote(raw){
    const n = raw || {};
    return {
      id: n.id || uid(),
      text: String(n.text || '').trim(),
      createdAt: n.createdAt || nowIso(),
      updatedAt: n.updatedAt || nowIso(),
      promotedTo: n.promotedTo || null
    };
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
      if(task.seedId && !wasComplete){
        watering = this._waterOnTaskComplete(task, opts);
        seedHarvested = this._maybeHarvestSeed(task.seedId);
      }
      await this.save();
      return { task: normalizeTask(task), watering, seedHarvested };
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
      const tasks = this.getTasksForDate(dateStr);
      const open = tasks.filter(t=> !t.completed);
      const growing = this.data.seeds.filter(s=> s.status === 'active').length;
      const nextBlock = this._nextScheduleBlock(dateStr, opts?.now);
      return {
        prioritiesLeft: open.length,
        tasksCompleted: tasks.filter(t=> t.completed).length,
        tasksTotal: tasks.length,
        seedsGrowing: growing,
        nextBlockLabel: nextBlock?.label || null,
        nextBlockTime: nextBlock?.startTime || null
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
              timeSlot: 'beforeWork',
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
            timeSlot: 'beforeWork',
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
