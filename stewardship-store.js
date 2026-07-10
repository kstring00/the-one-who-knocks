/**
 * Stewardship Store — the relational data layer behind the calendar.
 *
 * Life Areas → Goals → Projects → Tasks (→ Subtasks) → Calendar Blocks → Reflections.
 * Habits, templates, and per-day metadata (theme, prayer, Big Three, evening
 * reflection) all hang off the same store so every object can link to the day.
 *
 * Persistence: single JSON document under the `fs-stewardship` storage key
 * (localStorage via window.storage, synced to the cloud like fs-globals).
 */
(function(root){
  'use strict';

  const STORAGE_KEY = 'fs-stewardship';
  const SAVE_DELAY = 600;

  const CATEGORIES = [
    { id:'spiritual',     label:'Spiritual',     color:'#b8892a' },
    { id:'work',          label:'Work',          color:'#5f7a99' },
    { id:'deepwork',      label:'Deep Work',     color:'#5b6ba8' },
    { id:'health',        label:'Health',        color:'#427a52' },
    { id:'rest',          label:'Rest',          color:'#6a9a94' },
    { id:'relationships', label:'Relationships', color:'#b06a76' },
    { id:'leadership',    label:'Leadership',    color:'#7a5fa0' },
    { id:'learning',      label:'Learning',      color:'#4a7c9b' },
    { id:'admin',         label:'Admin',         color:'#8a8071' },
    { id:'personal',      label:'Personal',      color:'#b07a4f' },
    { id:'recovery',      label:'Recovery',      color:'#7d8a98' }
  ];
  const LIFE_AREAS = ['Faith','Health','Leadership','Work','Relationships','Finances','Learning','Home'];
  const PRIORITIES = ['high','medium','low'];
  const URGENCIES = ['today','week','later','someday'];
  const ENERGIES = ['high','medium','low'];

  function uid(){
    if(typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
  }
  function nowIso(){ return new Date().toISOString(); }
  function todayStr(off){
    const d = new Date(); d.setDate(d.getDate()+(off||0)); d.setHours(12,0,0,0);
    return d.toISOString().slice(0,10);
  }
  function dowOf(dateStr){ return new Date(dateStr+'T12:00:00').getDay(); }
  function normalizeTags(arr){
    if(!Array.isArray(arr)) return [];
    return [...new Set(arr.map(t=>String(t||'').trim()).filter(Boolean))];
  }
  function parseClockToMin(t){
    const p = String(t||'').match(/^(\d{1,2}):(\d{2})/);
    if(!p) return null;
    const h = Math.max(0, Math.min(23, +p[1]));
    const m = Math.max(0, Math.min(59, +p[2]));
    return h*60+m;
  }
  function minsToClock(m){
    if(typeof m !== 'number') return null;
    return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  }

  // Start with an empty document, never null, so any accessor that runs
  // before load() resolves (e.g. a first render racing init) reads empty
  // arrays instead of throwing "Cannot read properties of null". load()
  // replaces this with the persisted data; `loaded` gates persistence so a
  // pre-load render can't save the blank over real data.
  let data = blankData();
  let loaded = false;
  let saveTimer = null;
  let readyPromise = null;

  function blankData(){
    return {
      version: 1,
      goals: [], projects: [], tasks: [], habits: [], events: [], templates: [],
      days: {},          // date → { theme, prayer, bigThree:[taskId], reflection, scripture }
      meta: { seeded: false, migrations: {} }
    };
  }

  /* ── normalization ─────────────────────────────────────────── */
  function normTask(t){
    const scheduledEventId = t.scheduledEventId || null;
    return {
      id: t.id || uid(), title: t.title || '', notes: t.notes || '',
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      urgency: URGENCIES.includes(t.urgency) ? t.urgency : 'week',
      energy: ENERGIES.includes(t.energy) ? t.energy : 'medium',
      durationMin: t.durationMin || null, dueDate: t.dueDate || '',
      goalId: t.goalId || null, projectId: t.projectId || null,
      status: t.status === 'done' || t.status === 'archived' ? t.status : 'todo',
      subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(s=>({ id:s.id||uid(), text:s.text||'', done:!!s.done })) : [],
      scheduled: !!(t.scheduled || scheduledEventId),
      startTime: t.startTime || null,
      timeSlot: t.timeSlot || null,
      scheduledEventId,
      tags: normalizeTags(t.tags),
      legacyCoreId: t.legacyCoreId || null,
      legacyMustDoId: t.legacyMustDoId || null,
      relatedIdeaId: t.relatedIdeaId || t.seedId || null,
      originalDate: t.originalDate || null,
      carriedFrom: t.carriedFrom || null,
      carryCount: t.carryCount || 0,
      createdAt: t.createdAt || nowIso(), updatedAt: t.updatedAt || null,
      completedAt: t.completedAt || null
    };
  }
  function normProject(p){
    const status = p.status === 'done' || p.status === 'completed' ? 'done'
      : (p.status === 'archived' || p.archived ? 'archived' : 'active');
    return {
      id: p.id || uid(),
      title: String(p.title || '').trim(),
      vision: p.vision || '',
      definedOutcome: p.definedOutcome || '',
      whyItMatters: p.whyItMatters || '',
      goalId: p.goalId || null,
      lifeArea: p.lifeArea || '',
      status,
      milestones: Array.isArray(p.milestones) ? p.milestones.map((m,i)=>({
        id: m.id || uid(),
        title: String(m.title || '').trim(),
        done: !!m.done,
        dueDate: m.dueDate || '',
        sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : i
      })) : [],
      notes: p.notes || '',
      targetDate: p.targetDate || p.dueDate || '',
      relatedIdeaId: p.relatedIdeaId || p.linkedSeedId || null,
      archived: status === 'archived',
      legacyCoreId: p.legacyCoreId || null,
      createdAt: p.createdAt || nowIso(),
      updatedAt: p.updatedAt || p.createdAt || nowIso(),
      completedAt: p.completedAt || null
    };
  }
  function normEvent(e){
    return {
      id: e.id || uid(), title: e.title || '', date: e.date || todayStr(),
      startMin: typeof e.startMin === 'number' ? e.startMin : 540,
      endMin: typeof e.endMin === 'number' ? e.endMin : 600,
      category: CATEGORIES.some(c=>c.id===e.category) ? e.category : 'personal',
      priority: PRIORITIES.includes(e.priority) ? e.priority : 'medium',
      energy: ENERGIES.includes(e.energy) ? e.energy : 'medium',
      goalId: e.goalId || null, projectId: e.projectId || null,
      taskIds: Array.isArray(e.taskIds) ? e.taskIds.slice() : [],
      habitIds: Array.isArray(e.habitIds) ? e.habitIds.slice() : [],
      legacyCoreTaskId: e.legacyCoreTaskId || null,
      notes: e.notes || '', reflection: e.reflection || '',
      done: !!e.done, completedAt: e.completedAt || null,
      createdAt: e.createdAt || nowIso(), updatedAt: e.updatedAt || null
    };
  }
  function normHabit(h){
    return {
      id: h.id || uid(), title: h.title || '', icon: h.icon || '○',
      frequency: ['daily','weekdays','weekly'].includes(h.frequency) ? h.frequency : 'daily',
      days: Array.isArray(h.days) ? h.days.slice() : [0],   // for weekly
      targetTime: ['morning','midday','evening','any'].includes(h.targetTime) ? h.targetTime : 'any',
      goalId: h.goalId || null, notes: h.notes || '',
      log: h.log && typeof h.log === 'object' ? h.log : {},
      createdAt: h.createdAt || nowIso()
    };
  }
  function normalize(raw){
    const d = Object.assign(blankData(), raw || {});
    d.goals = (d.goals||[]).map(g=>({
      id:g.id||uid(), title:g.title||'', lifeArea:g.lifeArea||'Faith', why:g.why||'',
      deadline:g.deadline||'', milestones:(g.milestones||[]).map(m=>({id:m.id||uid(),title:m.title||'',done:!!m.done})),
      createdAt:g.createdAt||nowIso()
    }));
    d.projects = (d.projects||[]).map(normProject);
    d.tasks = (d.tasks||[]).map(normTask);
    d.habits = (d.habits||[]).map(normHabit);
    d.events = (d.events||[]).map(normEvent);
    d.templates = (d.templates||[]).map(t=>Object.assign(normEvent(t), { id:t.id||uid(), date:'', done:false }));
    if(!d.days || typeof d.days !== 'object') d.days = {};
    if(!d.meta || typeof d.meta !== 'object') d.meta = {};
    if(!d.meta.migrations || typeof d.meta.migrations !== 'object') d.meta.migrations = {};
    return d;
  }

  /* ── persistence ───────────────────────────────────────────── */
  async function load(){
    try{
      const raw = await root.storage?.get(STORAGE_KEY);
      data = normalize(raw?.value ? JSON.parse(raw.value) : null);
    }catch(e){
      console.warn('[StewStore] load failed, starting fresh', e);
      data = blankData();
    }
    // New accounts start empty — no sample data. meta.seeded is kept so
    // existing stores keep their flag, but nothing is planted anymore.
    if(!data.meta.seeded) data.meta.seeded = true;
    loaded = true;
    return data;
  }
  function init(){
    if(!readyPromise) readyPromise = load();
    return readyPromise;
  }
  async function persistNow(){
    if(!data || !loaded) return;   // never write the blank placeholder over persisted data
    try{ await root.storage?.set(STORAGE_KEY, JSON.stringify(data)); }
    catch(e){ console.warn('[StewStore] save failed', e); }
    if(typeof root.scheduleCloudPush === 'function') root.scheduleCloudPush([STORAGE_KEY]);
  }
  function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(persistNow, SAVE_DELAY); }
  function touch(obj){ if(obj) obj.updatedAt = nowIso(); save(); }

  /* ── goals & projects ──────────────────────────────────────── */
  function getGoals(){ return data.goals; }
  function getGoal(id){ return data.goals.find(g=>g.id===id) || null; }
  function createGoal(p){ const g = normalize({goals:[p]}).goals[0]; data.goals.push(g); save(); return g; }
  function updateGoal(id,p){ const g = getGoal(id); if(g){ Object.assign(g,p); save(); } return g; }
  function deleteGoal(id){
    data.goals = data.goals.filter(g=>g.id!==id);
    data.projects.forEach(p=>{ if(p.goalId===id) p.goalId=null; });
    data.tasks.forEach(t=>{ if(t.goalId===id) t.goalId=null; });
    data.habits.forEach(h=>{ if(h.goalId===id) h.goalId=null; });
    data.events.forEach(e=>{ if(e.goalId===id) e.goalId=null; });
    save();
  }
  function goalProgress(id){
    const tasks = data.tasks.filter(t=>t.goalId===id && t.status!=='archived');
    const g = getGoal(id);
    const parts = tasks.length + (g ? g.milestones.length : 0);
    if(!parts) return null;
    const done = tasks.filter(t=>t.status==='done').length +
      (g ? g.milestones.filter(m=>m.done).length : 0);
    return Math.round(done/parts*100);
  }
  function getProjects(goalId, opts){
    let list = goalId ? data.projects.filter(p=>p.goalId===goalId) : data.projects;
    if(!opts?.includeArchived) list = list.filter(p=>p.status!=='archived' && !p.archived);
    return list;
  }
  function getProject(id){ return data.projects.find(p=>p.id===id) || null; }
  function createProject(p){ const o = normProject(p||{}); data.projects.push(o); save(); return o; }
  function updateProject(id,p){
    const o = getProject(id);
    if(o){ Object.assign(o,p); const n = normProject(o); Object.assign(o,n); save(); }
    return o;
  }
  function deleteProject(id){
    data.projects = data.projects.filter(p=>p.id!==id);
    data.tasks.forEach(t=>{ if(t.projectId===id) t.projectId=null; });
    data.events.forEach(e=>{ if(e.projectId===id) e.projectId=null; });
    save();
  }
  function archiveProject(id){ return updateProject(id, { status:'archived', archived:true }); }
  function restoreProject(id){ return updateProject(id, { status:'active', archived:false, completedAt:null }); }
  function completeProject(id){ return updateProject(id, { status:'done', archived:false, completedAt:nowIso() }); }
  function addProjectMilestone(projectId, title, dueDate){
    const p = getProject(projectId); if(!p || !String(title||'').trim()) return null;
    const m = { id: uid(), title: String(title).trim(), done:false, dueDate: dueDate || '', sortOrder:p.milestones.length };
    p.milestones.push(m); touch(p); return m;
  }
  function toggleProjectMilestone(projectId, milestoneId){
    const p = getProject(projectId); if(!p) return null;
    const m = p.milestones.find(x=>x.id===milestoneId); if(!m) return null;
    m.done = !m.done; touch(p); return m;
  }
  function projectProgress(projectId){
    const p = getProject(projectId); if(!p) return null;
    if(p.status === 'done') return { percent:100, done:1, total:1, label:'Complete' };
    const tasks = data.tasks.filter(t=>t.projectId===projectId && t.status!=='archived');
    const milestones = p.milestones || [];
    const total = tasks.length + milestones.length;
    if(!total) return { percent:null, done:0, total:0, label:'Not started' };
    const done = tasks.filter(t=>t.status==='done').length + milestones.filter(m=>m.done).length;
    return { percent:Math.round(done/total*100), done, total, label:Math.round(done/total*100)+'%' };
  }

  function migrateLegacyProjectTasks(core){
    if(!core || typeof core !== 'object') return { changed:false, skipped:true };
    const migrationKey = 'legacyProjectsToStewStore';
    if(data.meta.migrations[migrationKey]?.version === 1) return { changed:false, alreadyRan:true };
    const legacyProjects = Array.isArray(core.projects) ? core.projects : [];
    const legacyTasks = Array.isArray(core.tasks) ? core.tasks : [];
    const legacyProjectIds = new Set(legacyProjects.map(p=>p.id).filter(Boolean));
    const legacySeedIds = new Map((core.seeds||[]).map(s=>[s.id, s.legacyIdeaId || s.id]));
    let changed = false, projectCount = 0, taskCount = 0, eventCount = 0;

    legacyProjects.forEach(p=>{
      if(!p?.id && !p?.title) return;
      const existing = data.projects.find(x=>x.id===p.id || x.legacyCoreId===p.id);
      if(existing) return;
      data.projects.push(normProject({
        id: p.id,
        title: p.title,
        relatedIdeaId: legacySeedIds.get(p.linkedSeedId) || p.linkedSeedId || null,
        tags: p.tags,
        status: p.archived ? 'archived' : 'active',
        archived: !!p.archived,
        legacyCoreId: p.id,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }));
      changed = true; projectCount++;
    });

    legacyTasks
      .filter(t=>t && (t.projectId || legacyProjectIds.has(t.projectId)))
      .forEach(t=>{
        const project = data.projects.find(p=>p.id===t.projectId || p.legacyCoreId===t.projectId);
        if(!project) return;
        let task = data.tasks.find(x=>x.id===t.id || x.legacyCoreId===t.id);
        if(!task){
          task = normTask({
            id: t.id,
            title: t.title,
            notes: t.notes || '',
            projectId: project.id,
            status: t.completed ? 'done' : (t.archived ? 'archived' : 'todo'),
            completedAt: t.completedAt || null,
            dueDate: t.date || '',
            durationMin: t.durationMin || null,
            tags: t.tags || (t.tag && t.tag !== 'none' ? [t.tag] : []),
            relatedIdeaId: legacySeedIds.get(t.seedId) || t.seedId || null,
            legacyCoreId: t.id,
            legacyMustDoId: t.legacyMustDoId || null,
            originalDate: t.date || null,
            scheduled:false,
            startTime:null,
            timeSlot:null,
            scheduledEventId:null,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt
          });
          data.tasks.push(task);
          changed = true; taskCount++;
        }

        const startMin = t.timeSlot === 'timed' ? parseClockToMin(t.startTime) : null;
        if(startMin != null && t.date && !data.events.some(e=>e.legacyCoreTaskId===t.id)){
          const dur = t.durationMin || 45;
          const ev = normEvent({
            title: t.title,
            date: t.date,
            startMin,
            endMin: startMin + dur,
            category:'work',
            projectId: project.id,
            taskIds:[task.id],
            legacyCoreTaskId:t.id,
            createdAt:t.createdAt,
            updatedAt:t.updatedAt,
            done: !!t.completed,
            completedAt:t.completedAt || null
          });
          data.events.push(ev);
          task.scheduled = true;
          task.scheduledEventId = ev.id;
          task.startTime = t.startTime || null;
          task.timeSlot = 'timed';
          changed = true; eventCount++;
        }
      });

    data.meta.migrations[migrationKey] = {
      version: 1,
      migratedAt: nowIso(),
      projects: projectCount,
      tasks: taskCount,
      scheduledEvents: eventCount,
      schedulingRepair: 'Legacy project tasks with beforeWork/duringWork/afterWork/eveningShutdown but no explicit startTime were treated as old automatic time-window defaults and migrated as unscheduled Task Shelf tasks. Only timeSlot=timed with a startTime was converted into a calendar event.'
    };
    if(changed || projectCount || taskCount || eventCount) persistNow();
    else save();
    return { changed, projects:projectCount, tasks:taskCount, scheduledEvents:eventCount };
  }

  /* ── tasks & subtasks ──────────────────────────────────────── */
  function getTasks(f){
    let list = data.tasks;
    if(f?.goalId) list = list.filter(t=>t.goalId===f.goalId);
    if(f?.projectId) list = list.filter(t=>t.projectId===f.projectId);
    if(f?.status) list = list.filter(t=>t.status===f.status);
    return list;
  }
  function getTask(id){ return data.tasks.find(t=>t.id===id) || null; }
  function createTask(p){ const t = normTask(p||{}); data.tasks.push(t); save(); return t; }
  function updateTask(id,p){
    const t = getTask(id); if(!t) return null;
    Object.assign(t,p);
    if(p.status==='done' && !t.completedAt) t.completedAt = nowIso();
    if(p.status==='todo') t.completedAt = null;
    save(); return t;
  }
  function deleteTask(id){
    data.tasks = data.tasks.filter(t=>t.id!==id);
    data.events.forEach(e=>{ e.taskIds = e.taskIds.filter(x=>x!==id); });
    Object.values(data.days).forEach(dm=>{ if(dm.bigThree) dm.bigThree = dm.bigThree.filter(x=>x!==id); });
    save();
  }
  function toggleSubtask(taskId, subId){
    const t = getTask(taskId); if(!t) return;
    const s = t.subtasks.find(x=>x.id===subId); if(!s) return;
    s.done = !s.done;
    save();
  }
  function addSubtask(taskId, text){
    const t = getTask(taskId); if(!t) return null;
    const s = { id: uid(), text: text, done: false };
    t.subtasks.push(s); save(); return s;
  }
  const URGENCY_RANK = { today:0, week:1, later:2, someday:3 };
  const PRIORITY_RANK = { high:0, medium:1, low:2 };
  function overflowTasks(){
    return data.tasks
      .filter(t=>t.status==='todo' && !t.scheduledEventId)
      .sort((a,b)=> (URGENCY_RANK[a.urgency]-URGENCY_RANK[b.urgency]) ||
        (PRIORITY_RANK[a.priority]-PRIORITY_RANK[b.priority]));
  }
  /** Overflow moves: later-today | tomorrow | this-week | someday | archive */
  function moveTask(id, dest){
    const t = getTask(id); if(!t) return;
    if(dest==='archive'){ t.status='archived'; }
    else if(dest==='someday'){ t.urgency='someday'; t.dueDate=''; }
    else if(dest==='later-today'){ t.urgency='today'; t.dueDate=todayStr(); }
    else if(dest==='tomorrow'){ t.urgency='today'; t.dueDate=todayStr(1); }
    else if(dest==='this-week'){ t.urgency='week'; t.dueDate=''; }
    save();
  }

  /* ── habits ────────────────────────────────────────────────── */
  function getHabits(){ return data.habits; }
  function getHabit(id){ return data.habits.find(h=>h.id===id) || null; }
  function createHabit(p){ const h = normHabit(p||{}); data.habits.push(h); save(); return h; }
  function updateHabit(id,p){ const h = getHabit(id); if(h){ Object.assign(h,p); save(); } return h; }
  function deleteHabit(id){
    data.habits = data.habits.filter(h=>h.id!==id);
    data.events.forEach(e=>{ e.habitIds = e.habitIds.filter(x=>x!==id); });
    save();
  }
  function habitAppliesOn(h, dateStr){
    const dow = dowOf(dateStr);
    if(h.frequency==='daily') return true;
    if(h.frequency==='weekdays') return dow>=1 && dow<=5;
    return h.days.includes(dow);
  }
  function habitsForDate(dateStr){ return data.habits.filter(h=>habitAppliesOn(h,dateStr)); }
  function habitDone(id, dateStr){ const h = getHabit(id); return !!h?.log[dateStr]; }
  function toggleHabit(id, dateStr){
    const h = getHabit(id); if(!h) return;
    if(h.log[dateStr]) delete h.log[dateStr]; else h.log[dateStr] = true;
    save();
  }
  function habitStreak(id){
    const h = getHabit(id); if(!h) return 0;
    let streak = 0;
    for(let off=0; off>-120; off--){
      const d = todayStr(off);
      if(!habitAppliesOn(h,d)) continue;
      if(h.log[d]) streak++;
      else if(off===0) continue;   // today isn't over — an unchecked today doesn't break the streak
      else break;
    }
    return streak;
  }

  /* ── events & templates ────────────────────────────────────── */
  function getEvents(){ return data.events; }
  function getEvent(id){ return data.events.find(e=>e.id===id) || null; }
  function eventsForDate(dateStr){
    return data.events.filter(e=>e.date===dateStr).sort((a,b)=>a.startMin-b.startMin);
  }
  function createEvent(p){
    const e = normEvent(p||{});
    data.events.push(e);
    e.taskIds.forEach(tid=>{
      const t = getTask(tid);
      if(t){
        t.scheduled = true;
        t.scheduledEventId = e.id;
        t.startTime = minsToClock(e.startMin);
        t.timeSlot = 'timed';
      }
    });
    save(); return e;
  }
  function updateEvent(id,p){
    const e = getEvent(id); if(!e) return null;
    const oldTasks = e.taskIds.slice();
    Object.assign(e,p);
    if(p.done && !e.completedAt) e.completedAt = nowIso();
    if(p.done===false) e.completedAt = null;
    if(p.taskIds){
      oldTasks.filter(t=>!p.taskIds.includes(t)).forEach(tid=>{
        const t = getTask(tid);
        if(t && t.scheduledEventId===id){
          t.scheduled = false; t.scheduledEventId = null; t.startTime = null; t.timeSlot = null;
        }
      });
      p.taskIds.forEach(tid=>{
        const t = getTask(tid);
        if(t){ t.scheduled = true; t.scheduledEventId = id; t.startTime = minsToClock(e.startMin); t.timeSlot = 'timed'; }
      });
    }
    if(p.startMin != null || p.date != null){
      e.taskIds.forEach(tid=>{
        const t = getTask(tid);
        if(t && t.scheduledEventId===id){
          t.scheduled = true;
          t.startTime = minsToClock(e.startMin);
          t.timeSlot = 'timed';
        }
      });
    }
    touch(e); return e;
  }
  function deleteEvent(id){
    const e = getEvent(id); if(!e) return;
    e.taskIds.forEach(tid=>{
      const t = getTask(tid);
      if(t && t.scheduledEventId===id){
        t.scheduled = false; t.scheduledEventId = null; t.startTime = null; t.timeSlot = null;
      }
    });
    data.events = data.events.filter(x=>x.id!==id);
    save();
  }
  function duplicateEvent(id, dateStr){
    const e = getEvent(id); if(!e) return null;
    const copy = normEvent(Object.assign({}, e, {
      id:null, date:dateStr||e.date, done:false, completedAt:null, reflection:'', taskIds:[], createdAt:null
    }));
    data.events.push(copy); save(); return copy;
  }
  /** Complete an event and optionally sweep its linked work along with it. */
  function completeEvent(id, opts){
    const e = getEvent(id); if(!e) return null;
    e.done = true; e.completedAt = nowIso();
    if(opts?.reflection != null) e.reflection = opts.reflection;
    if(opts?.completeTasks) e.taskIds.forEach(tid=>updateTask(tid,{status:'done'}));
    if(opts?.checkHabits) e.habitIds.forEach(hid=>{ if(!habitDone(hid,e.date)) toggleHabit(hid,e.date); });
    touch(e); return e;
  }
  function getTemplates(){ return data.templates; }
  function saveTemplate(fromEventId, name){
    const e = getEvent(fromEventId); if(!e) return null;
    const tpl = normEvent(Object.assign({}, e, { id:null, date:'', done:false, completedAt:null, reflection:'', taskIds:[] }));
    tpl.title = name || e.title;
    data.templates.push(tpl); save(); return tpl;
  }
  function deleteTemplate(id){ data.templates = data.templates.filter(t=>t.id!==id); save(); }
  function createEventFromTemplate(tplId, dateStr, startMin){
    const tpl = data.templates.find(t=>t.id===tplId); if(!tpl) return null;
    const dur = tpl.endMin - tpl.startMin;
    const start = typeof startMin === 'number' ? startMin : tpl.startMin;
    return createEvent(Object.assign({}, tpl, {
      id:null, date:dateStr, startMin:start, endMin:start+dur, done:false, createdAt:null
    }));
  }
  /** Schedule an unscheduled task as a calendar block. */
  function scheduleTask(taskId, dateStr, startMin){
    const t = getTask(taskId); if(!t) return null;
    if(typeof startMin !== 'number') return null;
    const goal = t.goalId ? getGoal(t.goalId) : null;
    const catByArea = { Faith:'spiritual', Health:'health', Leadership:'leadership', Work:'work',
      Relationships:'relationships', Finances:'admin', Learning:'learning', Home:'personal' };
    const dur = t.durationMin || 45;
    return createEvent({
      title: t.title, date: dateStr, startMin: startMin, endMin: startMin + dur,
      category: goal ? (catByArea[goal.lifeArea] || 'work') : 'work',
      priority: t.priority, energy: t.energy,
      goalId: t.goalId, projectId: t.projectId, taskIds: [taskId]
    });
  }

  /* ── day meta: theme, prayer, Big Three, evening reflection ── */
  function getDayMeta(dateStr){
    if(!data.days[dateStr]) data.days[dateStr] = { theme:'', prayer:'', bigThree:[], reflection:'' };
    const dm = data.days[dateStr];
    if(!Array.isArray(dm.bigThree)) dm.bigThree = [];
    return dm;
  }
  function setDayMeta(dateStr, patch){
    Object.assign(getDayMeta(dateStr), patch); save();
  }
  function toggleBigThree(dateStr, taskId){
    const dm = getDayMeta(dateStr);
    if(dm.bigThree.includes(taskId)){
      dm.bigThree = dm.bigThree.filter(x=>x!==taskId);
    } else {
      if(dm.bigThree.length >= 3) return false;   // only three things get the crown
      dm.bigThree.push(taskId);
    }
    save(); return true;
  }

  /* ── Faithfulness Ring ─────────────────────────────────────── */
  /**
   * Gentle math: the score is the average of the rhythms that are actually in
   * play today (planned blocks kept, habits, Big Three). An empty day is an
   * invitation, not a zero.
   */
  function ringForDate(dateStr){
    const events = eventsForDate(dateStr);
    const plannedMin = events.reduce((s,e)=>s+(e.endMin-e.startMin),0);
    const keptMin = events.filter(e=>e.done).reduce((s,e)=>s+(e.endMin-e.startMin),0);
    const deepMin = events.filter(e=>e.category==='deepwork' && e.done).reduce((s,e)=>s+(e.endMin-e.startMin),0);
    const restMin = events.filter(e=>e.category==='rest' && e.done).reduce((s,e)=>s+(e.endMin-e.startMin),0);
    const habits = habitsForDate(dateStr);
    const habitsDone = habits.filter(h=>habitDone(h.id,dateStr)).length;
    const spiritualHabits = habits.filter(h=>h.targetTime==='morning' && h.goalId && getGoal(h.goalId)?.lifeArea==='Faith');
    const prayerDone = events.some(e=>e.category==='spiritual' && e.done) ||
      habits.some(h=>habitDone(h.id,dateStr) && (h.goalId ? getGoal(h.goalId)?.lifeArea==='Faith' : /pray|bible|scripture/i.test(h.title))) ||
      spiritualHabits.some(h=>habitDone(h.id,dateStr));
    const dm = getDayMeta(dateStr);
    const bigTotal = dm.bigThree.length;
    const bigDone = dm.bigThree.filter(tid=>getTask(tid)?.status==='done').length;

    const parts = [];
    if(events.length) parts.push(events.filter(e=>e.done).length/events.length);
    if(habits.length) parts.push(habitsDone/habits.length);
    if(bigTotal) parts.push(bigDone/bigTotal);
    const score = parts.length ? Math.round(parts.reduce((a,b)=>a+b,0)/parts.length*100) : null;

    return {
      plannedMin, keptMin, deepMin, restMin,
      eventsTotal: events.length, eventsDone: events.filter(e=>e.done).length,
      habitsTotal: habits.length, habitsDone,
      bigTotal, bigDone, prayerDone, score,
      keptPct: events.length ? events.filter(e=>e.done).length/events.length : 0,
      habitPct: habits.length ? habitsDone/habits.length : 0,
      bigPct: bigTotal ? bigDone/bigTotal : 0
    };
  }

  root.StewStore = {
    init, load, save,
    get data(){ return data; },
    CATEGORIES, LIFE_AREAS, PRIORITIES, URGENCIES, ENERGIES,
    getGoals, getGoal, createGoal, updateGoal, deleteGoal, goalProgress,
    getProjects, getProject, createProject, updateProject, deleteProject,
    archiveProject, restoreProject, completeProject, projectProgress,
    addProjectMilestone, toggleProjectMilestone,
    getTasks, getTask, createTask, updateTask, deleteTask, toggleSubtask, addSubtask,
    overflowTasks, moveTask, scheduleTask,
    getHabits, getHabit, createHabit, updateHabit, deleteHabit,
    habitsForDate, habitAppliesOn, habitDone, toggleHabit, habitStreak,
    getEvents, getEvent, eventsForDate, createEvent, updateEvent, deleteEvent,
    duplicateEvent, completeEvent,
    getTemplates, saveTemplate, deleteTemplate, createEventFromTemplate,
    getDayMeta, setDayMeta, toggleBigThree, ringForDate,
    migrateLegacyProjectTasks
  };

  root.runStewardshipStoreTests = async function(){
    const results = [];
    function assert(name, cond, detail){
      results.push({ name, pass: !!cond, detail: detail || '' });
      if(!cond) throw new Error(name+(detail ? ': '+detail : ''));
    }
    try{
      data = blankData();
      loaded = true;
      const legacy = {
        projects:[{ id:'legacy-project-1', title:'Legacy Project', archived:false, tags:['home'], createdAt:'2026-07-01T00:00:00Z' }],
        tasks:[
          { id:'legacy-task-1', title:'Legacy open task', projectId:'legacy-project-1', completed:false, date:'2026-07-10', timeSlot:'beforeWork', tag:'project' },
          { id:'legacy-task-2', title:'Legacy timed task', projectId:'legacy-project-1', completed:true, completedAt:'2026-07-09T12:00:00Z', date:'2026-07-11', timeSlot:'timed', startTime:'14:30', durationMin:30, tag:'project' }
        ]
      };
      const first = migrateLegacyProjectTasks(legacy);
      assert('legacy project migrates', first.projects === 1 && !!getProject('legacy-project-1'));
      assert('legacy tasks migrate', first.tasks === 2 && getTasks({projectId:'legacy-project-1'}).length === 2);
      assert('beforeWork legacy project task is unscheduled', !getTask('legacy-task-1').scheduledEventId && getTask('legacy-task-1').timeSlot == null);
      assert('explicit timed legacy task becomes event', first.scheduledEvents === 1 && !!getTask('legacy-task-2').scheduledEventId);
      migrateLegacyProjectTasks(legacy);
      assert('migration is idempotent', getProjects(null,{includeArchived:true}).length === 1 && getTasks({projectId:'legacy-project-1'}).length === 2);
      assert('completion state preserved', getTask('legacy-task-2').status === 'done');
      const prog = projectProgress('legacy-project-1');
      assert('progress counts tasks', prog.percent === 50, 'got '+prog.percent);
      assert('scheduleTask requires explicit time', scheduleTask('legacy-task-1', '2026-07-12', null) === null);
      const ev = scheduleTask('legacy-task-1', '2026-07-12', 10*60);
      assert('explicit schedule creates event', !!ev && getTask('legacy-task-1').scheduledEventId === ev.id);
      deleteEvent(ev.id);
      assert('deleting event preserves task', !!getTask('legacy-task-1') && !getTask('legacy-task-1').scheduledEventId);
      results.push({ name:'ALL STEWARDSHIP TESTS', pass:true, detail:results.length+' checks' });
      return { pass:true, fail:0, results };
    }catch(e){
      results.push({ name:'FAILED', pass:false, detail:e.message });
      return { pass:false, fail:1, results, error:e.message };
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
