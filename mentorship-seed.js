/**
 * Mentorship seed data — default mentors; import notes via seedMentorshipNotes().
 */
(function(root){
  'use strict';

  const THEME_KEYWORDS = {
    rest: ['rest', 'sabbath', 'off', 'vacation', 'sustainable', 'burnout', 'margin'],
    boundaries: ['boundary', 'boundaries', 'no', 'limit', 'protect'],
    accountability: ['accountability', 'accountable', 'follow up', 'check in'],
    systems: ['system', 'systems', 'process', 'workflow', 'structure'],
    feedback: ['feedback', 'review', 'critique', 'input'],
    'developing-others': ['develop', 'mentor', 'coach', 'train', 'others', 'team', 'delegate'],
    courage: ['courage', 'brave', 'hard conversation', 'confront'],
    priorities: ['priority', 'priorities', 'first', 'focus', 'important']
  };

  function inferThemeTags(text){
    const t = String(text||'').toLowerCase();
    const tags = [];
    Object.entries(THEME_KEYWORDS).forEach(([tag, words])=>{
      if(words.some(w=> t.includes(w))) tags.push(tag);
    });
    return tags;
  }

  /**
   * Import structured notes:
   * [{ mentorId, sourceQuestion, principles: [{ title, detailBullets[], themeTags[] }] }]
   */
  function seedMentorshipNotes(store, groups, opts){
    opts = opts || {};
    if(!store) return { created: 0 };
    store.ensureDefaultMentors();
    let created = 0;
    (groups || []).forEach(g=>{
      (g.principles || []).forEach(p=>{
        if(!p.title && !(p.detailBullets||[]).length) return;
        const exists = store.data.principles.some(x=>
          x.mentorId === g.mentorId && x.sourceQuestion === g.sourceQuestion && x.title === p.title
        );
        if(exists && !opts.replace) return;
        store.createPrinciple({
          mentorId: g.mentorId,
          sourceQuestion: g.sourceQuestion || '',
          title: p.title || '',
          detailBullets: p.detailBullets || [],
          themeTags: p.themeTags?.length ? p.themeTags : inferThemeTags((p.title||'') + ' ' + (g.sourceQuestion||''))
        });
        created++;
      });
    });
    return { created };
  }

  function ensureMentorshipReady(store){
    if(!store) return;
    store.ensureDefaultMentors();
  }

  root.MentorshipSeed = {
    inferThemeTags,
    seedMentorshipNotes,
    ensureMentorshipReady,
    THEME_KEYWORDS
  };

})(typeof window !== 'undefined' ? window : globalThis);
