/**
 * POST /api/mentor — Stewardship Mentor (serverless).
 * ANTHROPIC_API_KEY lives only here. Never expose to the client.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const { buildMentorSystemPrompt } = require('../mentor-system-prompt.js');

const BILLING_MODE = 'free_daily';
const DAILY_ALLOWANCE = 20;
const COST_TABLE = { message: 1 };
const RATE_LIMIT_PER_MIN = 5;
const METER_KEY = 'mentor-meter';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 400;
const MAX_HISTORY = 20;

const ERR_UNAVAILABLE = "I can't reach you right now. What's the one thing you already know you should do next?";
const ERR_SIGNED_OUT = 'The Stewardship Mentor needs you to be signed in — your rhythm and your data stay yours that way.';
const ERR_ZERO_BALANCE = "We've talked a lot today. Sit with what you have. I'll be here in the morning.";

function localDateStr(tzOffsetMin){
  const now = Date.now();
  const local = new Date(now - (typeof tzOffsetMin === 'number' ? tzOffsetMin : 0) * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function defaultMeter(tzOffsetMin){
  return {
    balance: DAILY_ALLOWANCE,
    resetDate: localDateStr(tzOffsetMin),
    recentCalls: [],
    logs: []
  };
}

function normalizeMeter(raw, tzOffsetMin){
  const base = defaultMeter(tzOffsetMin);
  if(!raw || typeof raw !== 'object') return base;
  const today = localDateStr(tzOffsetMin);
  let balance = typeof raw.balance === 'number' ? raw.balance : base.balance;
  if(raw.resetDate !== today && BILLING_MODE === 'free_daily'){
    balance = DAILY_ALLOWANCE;
  }
  return {
    balance,
    resetDate: today,
    recentCalls: Array.isArray(raw.recentCalls) ? raw.recentCalls.filter(t=> typeof t === 'number') : [],
    logs: Array.isArray(raw.logs) ? raw.logs.slice(-100) : []
  };
}

async function loadMeter(supabase, userId, tzOffsetMin){
  const { data, error } = await supabase.from('app_data')
    .select('data')
    .eq('user_id', userId)
    .eq('key', METER_KEY)
    .maybeSingle();
  if(error && error.code !== 'PGRST116') console.warn('[mentor] meter load', error.message);
  return normalizeMeter(data?.data, tzOffsetMin);
}

async function saveMeter(supabase, userId, meter){
  const { error } = await supabase.from('app_data').upsert({
    user_id: userId,
    key: METER_KEY,
    data: meter
  }, { onConflict: 'user_id,key' });
  if(error) console.warn('[mentor] meter save', error.message);
}

function rateLimited(meter){
  const cutoff = Date.now() - 60 * 1000;
  const recent = (meter.recentCalls || []).filter(t=> t >= cutoff);
  return recent.length >= RATE_LIMIT_PER_MIN;
}

function trimHistory(history){
  if(!Array.isArray(history)) return [];
  return history
    .filter(m=> m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map(m=> ({ role: m.role, content: m.content.slice(0, 4000) }));
}

function sendSSE(res, obj){
  res.write('data: ' + JSON.stringify(obj) + '\n\n');
}

module.exports = async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return res.status(405).json({ error: ERR_UNAVAILABLE });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;

  if(!apiKey || !supabaseUrl || !supabaseAnon){
    console.error('[mentor] missing env');
    return res.status(503).json({ error: ERR_UNAVAILABLE });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if(!token){
    return res.status(401).json({ error: ERR_SIGNED_OUT });
  }

  let body = {};
  try{
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  }catch(e){
    return res.status(400).json({ error: ERR_UNAVAILABLE });
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: 'Bearer ' + token } }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if(userErr || !userData?.user?.id){
    return res.status(401).json({ error: ERR_SIGNED_OUT });
  }
  const userId = userData.user.id;

  const tzOffset = typeof body.tzOffset === 'number' ? body.tzOffset : 0;
  let meter = await loadMeter(supabase, userId, tzOffset);

  if(meter.balance <= 0){
    return res.status(402).json({ error: ERR_ZERO_BALANCE, balance: 0 });
  }

  const now = Date.now();
  meter.recentCalls = (meter.recentCalls || []).filter(t=> t >= now - 60 * 1000);
  if(rateLimited(meter)){
    return res.status(429).json({ error: ERR_UNAVAILABLE, balance: meter.balance });
  }

  const message = String(body.message || '').trim();
  if(!message) return res.status(400).json({ error: ERR_UNAVAILABLE });

  const history = trimHistory(body.history);
  const context = String(body.context || '').slice(0, 4000);
  const source = String(body.source || 'general').slice(0, 64);
  const userName = String(body.userName || '').slice(0, 80);

  const systemPrompt = buildMentorSystemPrompt(
    userName,
    localDateStr(tzOffset)
  );

  const contextBlock = context
    ? '\n\n---\nAPP CONTEXT (' + source + '):\n' + context
    : '';

  const messages = [
    ...history,
    { role: 'user', content: message + contextBlock }
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let inputTokens = 0;
  let outputTokens = 0;
  let streamError = null;

  try{
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: [{
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }],
        messages
      })
    });

    if(!anthropicRes.ok){
      const errText = await anthropicRes.text().catch(()=> '');
      console.error('[mentor] anthropic', anthropicRes.status, errText.slice(0, 200));
      sendSSE(res, { type: 'error', error: ERR_UNAVAILABLE });
      return res.end();
    }

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for(const line of lines){
        if(!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if(payload === '[DONE]') continue;
        let evt;
        try{ evt = JSON.parse(payload); }catch(e){ continue; }

        if(evt.type === 'message_start' && evt.message?.usage){
          inputTokens = evt.message.usage.input_tokens || inputTokens;
        }
        if(evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta'){
          const text = evt.delta.text || '';
          if(text) sendSSE(res, { type: 'token', text });
        }
        if(evt.type === 'message_delta' && evt.usage){
          outputTokens = evt.usage.output_tokens || outputTokens;
        }
        if(evt.type === 'error'){
          streamError = evt.error?.message || 'stream error';
        }
      }
    }

    if(streamError){
      sendSSE(res, { type: 'error', error: ERR_UNAVAILABLE });
      return res.end();
    }

    meter.balance = Math.max(0, meter.balance - (COST_TABLE.message || 1));
    meter.recentCalls.push(now);
    meter.logs = (meter.logs || []).concat([{
      ts: now,
      source,
      input_tokens: inputTokens,
      output_tokens: outputTokens
    }]).slice(-100);
    await saveMeter(supabase, userId, meter);

    sendSSE(res, {
      type: 'done',
      balance: meter.balance,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens }
    });
    res.end();
  }catch(e){
    console.error('[mentor] stream failed', e?.message || e);
    if(!res.headersSent){
      return res.status(503).json({ error: ERR_UNAVAILABLE });
    }
    sendSSE(res, { type: 'error', error: ERR_UNAVAILABLE });
    res.end();
  }
};
