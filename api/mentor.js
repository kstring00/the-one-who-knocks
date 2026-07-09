/**
 * POST /api/mentor — Stewardship Mentor (serverless).
 * ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY live only here. Never
 * expose either to the client. The meter is server-authoritative: the
 * user's identity comes only from a verified Supabase JWT, and the balance
 * lives in a service-role-only table (see supabase-mentor-meter.sql).
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const { buildMentorSystemPrompt } = require('../mentor-system-prompt.js');

const DAILY_ALLOWANCE = 20;
const RATE_LIMIT_PER_MIN = 5;
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 400;
const MAX_HISTORY = 20;

const ERR_UNAVAILABLE = "I can't reach you right now. What's the one thing you already know you should do next?";
const ERR_SIGNED_OUT = 'The Stewardship Mentor needs you to be signed in — your rhythm and your data stay yours that way.';
const ERR_ZERO_BALANCE = "We've talked a lot today. Sit with what you have. I'll be here in the morning.";

/** Today's date in UTC — used only for the prompt's date line. Never derived
 *  from the request body, so it can't be gamed to refill the meter. */
function utcDateStr(){
  return new Date().toISOString().slice(0, 10);
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if(!apiKey || !supabaseUrl || !serviceKey){
    console.error('[mentor] missing env (need ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    return res.status(503).json({ error: ERR_UNAVAILABLE });
  }

  // ── Identity: verify the Supabase JWT server-side; trust nothing in the body ──
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if(!token){
    return res.status(401).json({ error: ERR_SIGNED_OUT });
  }

  // Service-role client: bypasses RLS so it can write the meter, and validates
  // the caller's JWT via getUser(token). The user_id is derived ONLY from here.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if(userErr || !userData?.user?.id){
    return res.status(401).json({ error: ERR_SIGNED_OUT });
  }
  const userId = userData.user.id;   // never from req.body

  let body = {};
  try{
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  }catch(e){
    return res.status(400).json({ error: ERR_UNAVAILABLE });
  }

  const message = String(body.message || '').trim();
  if(!message) return res.status(400).json({ error: ERR_UNAVAILABLE });

  // ── Reserve BEFORE calling Claude — single atomic statement in Postgres ──
  // (rate-limit window + balance decrement). No read-then-write race, and an
  // aborted stream still costs the reserved message.
  let reserved;
  try{
    const { data, error } = await supabase.rpc('mentor_reserve', {
      p_user_id: userId,
      p_allowance: DAILY_ALLOWANCE,
      p_rate_limit: RATE_LIMIT_PER_MIN
    });
    if(error) throw error;
    reserved = Array.isArray(data) ? data[0] : data;
  }catch(e){
    console.error('[mentor] reserve failed', e?.message || e);
    return res.status(503).json({ error: ERR_UNAVAILABLE });
  }

  if(reserved?.rate_limited){
    return res.status(429).json({ error: ERR_UNAVAILABLE, balance: reserved.balance });
  }
  if(!reserved || reserved.allowed !== true){
    return res.status(402).json({ error: ERR_ZERO_BALANCE, balance: 0 });
  }
  const balance = reserved.balance;   // post-decrement balance

  async function refund(){
    try{ await supabase.rpc('mentor_refund', { p_user_id: userId }); }
    catch(e){ console.warn('[mentor] refund failed', e?.message || e); }
  }

  const history = trimHistory(body.history);
  const context = String(body.context || '').slice(0, 4000);
  const source = String(body.source || 'general').slice(0, 64);
  const userName = String(body.userName || '').slice(0, 80);

  // System prompt built exactly as before — interpolation untouched (mentor-system-prompt.js).
  const systemPrompt = buildMentorSystemPrompt(userName, utcDateStr());

  const contextBlock = context
    ? '\n\n---\nAPP CONTEXT (' + source + '):\n' + context
    : '';

  const messages = [
    ...history,
    { role: 'user', content: message + contextBlock }
  ];

  let anthropicRes;
  try{
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
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
  }catch(e){
    // Network error before any tokens streamed → refund the reserved message.
    console.error('[mentor] anthropic fetch failed', e?.message || e);
    await refund();
    return res.status(503).json({ error: ERR_UNAVAILABLE });
  }

  if(!anthropicRes.ok){
    // 4xx/5xx before any tokens streamed → refund.
    const errText = await anthropicRes.text().catch(()=> '');
    console.error('[mentor] anthropic', anthropicRes.status, errText.slice(0, 200));
    await refund();
    return res.status(503).json({ error: ERR_UNAVAILABLE });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let tokensStreamed = false;
  let streamError = null;

  try{
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
          const u = evt.message.usage;
          inputTokens = u.input_tokens || inputTokens;
          cacheReadTokens = u.cache_read_input_tokens || 0;
          cacheCreationTokens = u.cache_creation_input_tokens || 0;
        }
        if(evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta'){
          const text = evt.delta.text || '';
          if(text){ tokensStreamed = true; sendSSE(res, { type: 'token', text }); }
        }
        if(evt.type === 'message_delta' && evt.usage){
          outputTokens = evt.usage.output_tokens || outputTokens;
        }
        if(evt.type === 'error'){
          streamError = evt.error?.message || 'stream error';
        }
      }
    }

    // Cache visibility: a nonzero cache_read on the 2nd+ message in a
    // conversation means the system block is caching. If it stays 0, the
    // prefix is under the model's minimum (2048 tokens for Sonnet 4.6) and
    // the placeholder prompt simply won't cache — report, don't hide.
    console.log('[mentor] usage', JSON.stringify({
      source,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: cacheReadTokens,
      cache_creation_input_tokens: cacheCreationTokens
    }));

    if(streamError){
      // Only refund if it failed before any tokens reached the client.
      if(!tokensStreamed) await refund();
      sendSSE(res, { type: 'error', error: ERR_UNAVAILABLE });
      return res.end();
    }

    // Only the balance crosses to the client (drives the ≤3-left soft line).
    // Token counts stay server-side in the usage log above — never shipped.
    sendSSE(res, { type: 'done', balance });
    res.end();
  }catch(e){
    // A mid-flight stream abort is NOT refunded — we already paid Anthropic.
    console.error('[mentor] stream failed', e?.message || e);
    if(!tokensStreamed) await refund();
    if(!res.headersSent){
      return res.status(503).json({ error: ERR_UNAVAILABLE });
    }
    sendSSE(res, { type: 'error', error: ERR_UNAVAILABLE });
    res.end();
  }
};
