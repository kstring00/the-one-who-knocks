/**
 * Mentorship seed data — default mentors and initial principle library.
 */
(function(root){
  'use strict';

  const THEME_KEYWORDS = {
    rest: ['rest', 'sabbath', 'off', 'vacation', 'sustainable', 'burnout', 'margin', 'recovery', 'disengaging'],
    boundaries: ['boundary', 'boundaries', 'limit', 'protect', 'professional lines', 'friend second'],
    accountability: ['accountability', 'accountable', 'ownership', 'follow through', 'commitments', 'lazy', 'laziness', 'show up'],
    systems: ['system', 'systems', 'process', 'workflow', 'structure', 'organized', 'organization', 'schedule', 'tools'],
    feedback: ['feedback', 'review', 'critique', 'input', 'constructive', 'hard truth', 'correction'],
    'developing-others': ['develop', 'mentor', 'coach', 'train', 'others', 'team', 'delegate', 'check-in', 'expectations', 'equip', 'point a', 'baby steps'],
    courage: ['courage', 'brave', 'hard conversation', 'confront', 'say what', 'uncomfortable', 'managing up'],
    priorities: ['priority', 'priorities', 'first', 'focus', 'important', 'urgency', 'matters most', 'end in mind', 'destination', 'revenue', 'sustainable']
  };

  function inferThemeTags(text){
    const t = String(text||'').toLowerCase();
    const tags = [];
    Object.entries(THEME_KEYWORDS).forEach(([tag, words])=>{
      if(words.some(w=> t.includes(w))) tags.push(tag);
    });
    return [...new Set(tags)];
  }

  function p(title, bullets, tags){
    return { title, detailBullets: bullets || [], themeTags: tags || inferThemeTags(title + ' ' + (bullets||[]).join(' ')) };
  }

  const INITIAL_MENTORSHIP_DATA = [
    {
      mentorId: 'mentor-ed',
      sourceQuestion: 'What small habits or disciplines have helped you stay effective when the pressure is high?',
      principles: [
        p('Stay organized', ['Paper organization.', 'Mental organization.'], ['systems', 'priorities']),
        p('Prioritize what matters most', [], ['priorities']),
        p('Breathe before reacting', [], ['courage', 'boundaries']),
        p('Create a plan of action as you prioritize', [], ['priorities', 'systems']),
        p('Be intentional about disengaging when needed', [], ['rest', 'boundaries']),
        p('Establish healthy boundaries and remain committed to them', ['Protect your energy by honoring those boundaries.'], ['boundaries']),
        p('Take the time off you\'ve been given', ['Rest is part of long-term effectiveness.'], ['rest'])
      ]
    },
    {
      mentorId: 'mentor-ed',
      sourceQuestion: 'What do you have zero tolerance for in your own life?',
      principles: [
        p('Zero tolerance for laziness', ['Physically.', 'Mentally.', 'Professionally.'], ['accountability']),
        p('Show up consistently', [], ['accountability']),
        p('Take ownership and be accountable', [], ['accountability'])
      ]
    },
    {
      mentorId: 'mentor-ed',
      sourceQuestion: 'How do you best develop others?',
      principles: [
        p('Be willing to listen', [], ['developing-others']),
        p('Ask thoughtful questions instead of assuming', [], ['developing-others', 'feedback']),
        p('Perform a needs-based analysis', ['Understand where someone is.', 'Understand where they want to go.', 'Help bridge the gap.'], ['developing-others']),
        p('Hold regular check-ins', [], ['developing-others', 'accountability']),
        p('Set clear expectations from the beginning', [], ['developing-others']),
        p('Give honest feedback consistently', [], ['developing-others', 'feedback']),
        p('Equip people with the tools and opportunities they need to grow', [], ['developing-others'])
      ]
    },
    {
      mentorId: 'mentor-ed',
      sourceQuestion: 'Start with the end in mind.',
      principles: [
        p('Start with the end in mind', [
          'Clarify the destination first.',
          'If someone wants to become the president, begin with that vision.',
          'Work backward from the end goal.',
          'Build the necessary skills and habits required for that future role.',
          'Let today\'s decisions align with tomorrow\'s objective.'
        ], ['priorities', 'developing-others'])
      ]
    },
    {
      mentorId: 'mentor-ed',
      sourceQuestion: 'Leadership Principles',
      principles: [
        p('Have the courage to say what most people won\'t', [
          'Speak the truth respectfully.',
          'Give constructive feedback, even when it\'s uncomfortable.',
          'Managing up well requires courage and wisdom.'
        ], ['courage', 'feedback']),
        p('Surround yourself with the right people', [
          'Be around people who challenge you to grow.',
          'Seek mentors who are ahead of you.',
          'Build relationships with people of integrity, humility, and excellence.',
          'Your environment shapes your standards.'
        ], ['developing-others'])
      ]
    },
    {
      mentorId: 'mentor-ed',
      sourceQuestion: 'Key Takeaways',
      principles: [
        p('Stay organized', [], ['systems']),
        p('Prioritize intentionally', [], ['priorities']),
        p('Breathe before reacting', [], ['courage']),
        p('Make a plan', [], ['priorities', 'systems']),
        p('Protect your boundaries', [], ['boundaries']),
        p('Rest when it\'s time to rest', [], ['rest']),
        p('Have zero tolerance for laziness', [], ['accountability']),
        p('Listen first', [], ['developing-others']),
        p('Ask better questions', [], ['developing-others']),
        p('Develop people based on their needs', [], ['developing-others']),
        p('Check in regularly', [], ['developing-others', 'accountability']),
        p('Set clear expectations', [], ['developing-others']),
        p('Start with the end in mind', [], ['priorities']),
        p('Have the courage to say what others won\'t', [], ['courage']),
        p('Surround yourself with people who make you better', [], ['developing-others'])
      ]
    },

    {
      mentorId: 'mentor-cd',
      sourceQuestion: 'How do you best prioritize and manage the responsibilities in front of you?',
      principles: [
        p('Practice effective time management', [], ['priorities', 'systems']),
        p('Use schedules intentionally', [], ['systems', 'priorities']),
        p('Utilize the systems and tools you\'ve been given', [], ['systems']),
        p('Prioritize tasks based on urgency and importance', [], ['priorities']),
        p('Stay organized for thoughtful decisions', ['Stay organized so you can make thoughtful decisions instead of reactive ones.'], ['systems', 'priorities']),
        p('Trust your systems rather than relying solely on memory', [], ['systems'])
      ]
    },
    {
      mentorId: 'mentor-cd',
      sourceQuestion: 'How do you best develop others as a leader?',
      principles: [
        p('Lead by example', [], ['developing-others', 'accountability']),
        p('Keep communication open', ['Be transparent.'], ['developing-others', 'feedback']),
        p('Recognize that every leader develops differently', [], ['developing-others']),
        p('Help people get from Point A to Point B', [], ['developing-others']),
        p('Break large goals into manageable baby steps', ['Structure goals so they are realistic and achievable.'], ['developing-others', 'systems']),
        p('Encourage regular self-assessment', [
          'Reflect on the steps you\'re taking.',
          'Evaluate how you\'re completing those steps.',
          'Adjust as needed.'
        ], ['developing-others', 'feedback'])
      ]
    },
    {
      mentorId: 'mentor-cd',
      sourceQuestion: 'Develop your own leadership philosophy.',
      principles: [
        p('Develop your own leadership philosophy', [
          'Make a list of the type of leader you want to become.',
          'Reflect on leaders you\'ve worked under.',
          'What qualities did they have?',
          'What would you like to emulate?',
          'What would you choose to do differently?',
          'Intentionally build your leadership style rather than copying someone else\'s.'
        ], ['developing-others', 'priorities'])
      ]
    },
    {
      mentorId: 'mentor-cd',
      sourceQuestion: 'How do you best deliver hard truth?',
      principles: [
        p('Rapport comes first', ['If trust hasn\'t been established, focus on building the relationship before delivering correction.'], ['feedback', 'developing-others']),
        p('Point out what the person is doing well', [], ['feedback']),
        p('Demonstrate genuine care', ['Let people know you\'re for them, not against them.'], ['developing-others', 'feedback']),
        p('Build trust before difficult conversations', ['Once rapport and trust are established, difficult conversations become much more effective.'], ['feedback', 'courage'])
      ]
    },
    {
      mentorId: 'mentor-cd',
      sourceQuestion: 'What\'s something you would challenge me with?',
      principles: [
        p('Grow clinically, not just operationally', [], ['priorities', 'developing-others']),
        p('Spend time learning about the families you serve', [], ['developing-others']),
        p('Get to know your clients beyond their behavior plans', [
          'Learn their stories.',
          'Understand their experiences.',
          'Discover what motivates them.',
          'Learn each client\'s reinforcement preferences and what truly makes them "tick."',
          'The better you understand the person, the better you\'ll be able to serve them.'
        ], ['developing-others'])
      ]
    },
    {
      mentorId: 'mentor-cd',
      sourceQuestion: 'Key Takeaways',
      principles: [
        p('Master your time', [], ['priorities', 'systems']),
        p('Use the tools and systems available to you', [], ['systems']),
        p('Lead by example', [], ['developing-others', 'accountability']),
        p('Keep communication open and transparent', [], ['developing-others', 'feedback']),
        p('Help people grow one step at a time', [], ['developing-others']),
        p('Break big goals into achievable milestones', [], ['developing-others', 'systems']),
        p('Reflect regularly on your own leadership', [], ['feedback', 'developing-others']),
        p('Learn from the leaders who have influenced you', [], ['developing-others']),
        p('Build rapport before correction', [], ['feedback']),
        p('Care first, then challenge', [], ['feedback', 'developing-others']),
        p('Grow your clinical understanding by learning client stories', [], ['developing-others']),
        p('Great leadership is both operational and relational', [], ['developing-others', 'priorities'])
      ]
    },

    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'What should receive the highest priority?',
      principles: [
        p('Focus on what keeps the organization healthy and sustainable', [], ['priorities']),
        p('Completed services are essential', ['In a for-profit ABA organization, completed services are essential.'], ['priorities', 'systems']),
        p('Revenue enables the mission', [
          'Revenue isn\'t about being cold-hearted—it\'s what allows the organization to continue serving clients.',
          'Support families.',
          'Pay employees.',
          'Invest in growth.',
          'Mission and financial stewardship go hand in hand.'
        ], ['priorities'])
      ]
    },
    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'What boundaries should a leader maintain?',
      principles: [
        p('Boundaries are essential', [], ['boundaries']),
        p('Don\'t allow people to blur professional lines', [], ['boundaries']),
        p('You are a leader first, friend second', ['Be approachable without sacrificing accountability.'], ['boundaries', 'accountability']),
        p('Healthy boundaries create clarity, consistency, and respect', [], ['boundaries'])
      ]
    },
    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'How should you receive feedback?',
      principles: [
        p('Be receptive to feedback', [], ['feedback']),
        p('Never assume you\'ve arrived as a leader', [], ['feedback', 'accountability']),
        p('Listen without becoming defensive', [], ['feedback']),
        p('View feedback as an opportunity to improve', ['View feedback as an opportunity to improve rather than a personal attack.', 'Humility accelerates growth.'], ['feedback'])
      ]
    },
    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'What role does accountability play?',
      principles: [
        p('Hold yourself accountable before expecting it from others', [], ['accountability']),
        p('Own mistakes quickly', [], ['accountability']),
        p('Follow through on commitments', [], ['accountability']),
        p('Model the behavior you expect from your team', [], ['accountability', 'developing-others']),
        p('Consistency builds trust', [], ['accountability'])
      ]
    },
    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'What qualities separate excellent leaders?',
      principles: [
        p('Diligence', [], ['accountability']),
        p('Strong work ethic', [], ['accountability']),
        p('Reliability', [], ['accountability']),
        p('Consistency', [], ['accountability']),
        p('Do the right work even when no one is watching', ['Excellence is built through faithful execution of small responsibilities.'], ['accountability'])
      ]
    },
    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'How do you avoid burnout?',
      principles: [
        p('Work hard, but don\'t neglect recovery', [], ['rest']),
        p('Sustainable leadership requires rest', [], ['rest']),
        p('Recognize your limits before you\'re forced to stop', [], ['rest', 'boundaries']),
        p('Pace yourself for the long term', [], ['rest', 'priorities']),
        p('Taking care of yourself enables you to better care for your team', [], ['rest', 'developing-others'])
      ]
    },
    {
      mentorId: 'mentor-doo',
      sourceQuestion: 'Key Takeaways',
      principles: [
        p('Prioritize the work that sustains the mission', [], ['priorities']),
        p('Understand that financial health enables client care', [], ['priorities']),
        p('Maintain clear professional boundaries', [], ['boundaries']),
        p('Be a leader first and a friend second', [], ['boundaries']),
        p('Welcome feedback with humility', [], ['feedback']),
        p('Hold yourself accountable', [], ['accountability']),
        p('Practice diligence and hard work daily', [], ['accountability']),
        p('Lead with consistency and integrity', [], ['accountability']),
        p('Avoid burnout by balancing effort with intentional rest', [], ['rest']),
        p('Long-term leadership requires endurance, not just intensity', [], ['rest', 'priorities'])
      ]
    }
  ];

  function seedMentorshipNotes(store, groups, opts){
    opts = opts || {};
    if(!store) return { created: 0 };
    store.ensureDefaultMentors();
    let created = 0;
    (groups || []).forEach(g=>{
      (g.principles || []).forEach(pr=>{
        if(!pr.title && !(pr.detailBullets||[]).length) return;
        const exists = store.data.principles.some(x=>
          x.mentorId === g.mentorId && x.sourceQuestion === g.sourceQuestion && x.title === pr.title
        );
        if(exists && !opts.replace) return;
        store.createPrinciple({
          mentorId: g.mentorId,
          sourceQuestion: g.sourceQuestion || '',
          title: pr.title || '',
          detailBullets: pr.detailBullets || [],
          themeTags: pr.themeTags?.length ? pr.themeTags : inferThemeTags((pr.title||'') + ' ' + (g.sourceQuestion||''))
        });
        created++;
      });
    });
    return { created };
  }

  function seedInitialMentorshipNotes(store, opts){
    if(!store) return { created: 0, skipped: true };
    store.ensureDefaultMentors();
    if(store.data.principles?.length && !(opts && opts.force)) return { created: 0, skipped: true };
    if(opts && opts.force) store.data.principles = [];
    return seedMentorshipNotes(store, INITIAL_MENTORSHIP_DATA, { replace: true });
  }

  function ensureMentorshipReady(store){
    if(!store) return;
    store.ensureDefaultMentors();
    if(!store.data.principles?.length){
      seedInitialMentorshipNotes(store);
    }
  }

  root.MentorshipSeed = {
    inferThemeTags,
    seedMentorshipNotes,
    seedInitialMentorshipNotes,
    ensureMentorshipReady,
    INITIAL_MENTORSHIP_DATA,
    THEME_KEYWORDS
  };

})(typeof window !== 'undefined' ? window : globalThis);
