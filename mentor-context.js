/**
 * Stewardship Mentor — compact context builder (client).
 */
(function(root){
  'use strict';

  const TOKEN_CAP_CHARS = 3200;

  function esc(s){
    return typeof root.esc === 'function' ? root.esc(s) : String(s ?? '');
  }

  function todayStr(){
    if(typeof root.iso === 'function' && typeof root.dayOf === 'function'){
      return root.iso(root.dayOf(typeof root.dayOffset === 'number' ? root.dayOffset : 0));
    }
    return new Date().toISOString().slice(0, 10);
  }

  function currentTimeWindow(){
    const h = new Date().getHours();
    if(h < 9) return 'Morning';
    if(h < 17) return 'Work / School';
    if(h < 20) return 'After Work';
    return 'Evening Shutdown';
  }

  function buildDailyLedgerContext(){
    const day = root.dayData;
    if(!day) return 'Daily Ledger — no day data loaded yet.';

    const lines = [];
    const aim = day.posture?.aim?.trim() || day.focus?.trim();
    if(aim) lines.push("Today's aim: " + aim);
    else lines.push("Today's aim: (not set)");

    const top = (root.__dailyHelpers?.getTopMustDos?.() || []);
    if(top.length){
      lines.push('Top 3 must-dos:');
      top.forEach((it, i)=>{
        const st = it.done && !it.released ? 'done' : 'open';
        lines.push('  ' + (i + 1) + '. [' + st + '] ' + (it.text || '').trim());
      });
    } else {
      lines.push('Top 3 must-dos: (none yet)');
    }

    const rep = day.growthRep;
    if(rep?.text?.trim()){
      const cat = rep.category ? ' (' + rep.category + ')' : '';
      const st = rep.done ? 'complete' : 'in progress';
      lines.push('Growth rep' + cat + ': ' + rep.text.trim() + ' [' + st + ']');
    } else {
      lines.push('Growth rep: (not set)');
    }

    lines.push('Current time window: ' + currentTimeWindow());

    const rows = root.__dailyHelpers?.getHabitRows?.() || [];
    if(rows.length){
      const kept = rows.filter(r=> root.__dailyHelpers?.habitRowDone?.(r)).length;
      lines.push('Habits today: ' + kept + ' of ' + rows.length + ' kept');
      const stew = root.StewStore || null;
      const streakRows = rows
        .map(r=>{
          const id = r.stewHabitId || (r.type === 'stew' ? r.stewId : null);
          const streak = id && stew?.habitStreak ? stew.habitStreak(id) : 0;
          return { title: r.title || 'habit', streak, done: root.__dailyHelpers?.habitRowDone?.(r) };
        })
        .filter(r=> r.streak > 1 || r.done)
        .slice(0, 6);
      if(streakRows.length){
        lines.push('Active habit streaks:');
        streakRows.forEach(r=>{
          const mark = r.done ? '✓ ' : '';
          const streak = r.streak > 1 ? ' (' + r.streak + 'd streak)' : '';
          lines.push('  ' + mark + r.title + streak);
        });
      }
    } else {
      lines.push('Habits: (none configured)');
    }

    const intakeDone = typeof root.intakeCompletedToday === 'function' && root.intakeCompletedToday();
    lines.push('Begin the Day intake today: ' + (intakeDone ? 'complete' : 'not complete'));

    return truncateContext(lines.join('\n'));
  }

  function truncateContext(text){
    if(text.length <= TOKEN_CAP_CHARS) return text;
    return text.slice(0, TOKEN_CAP_CHARS) + '\n… [context truncated]';
  }

  function buildMentorContext(source){
    const src = source || 'general';
    if(src === 'daily-plan' || src === 'daily-top3' || src === 'daily-growth' || src === 'daily-ledger'){
      return buildDailyLedgerContext();
    }
    return buildDailyLedgerContext();
  }

  root.buildMentorContext = buildMentorContext;
})(typeof window !== 'undefined' ? window : globalThis);
