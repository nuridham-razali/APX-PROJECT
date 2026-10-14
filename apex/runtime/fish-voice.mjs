import {spokenText} from '../lib/spoken-text.mjs';
export const NOVA_VOICE_ID = '3a7bcde726774da88cef935fb2d64da3';
export const FISH_MODEL = 's2.1-pro-free';

export function fishStatus(env = process.env, assistant = 'NOVA') {
  const voiceId=assistant==='APEX'?(env.APEX_FISH_VOICE_ID?.trim()||''):NOVA_VOICE_ID;
  return {ready: Boolean(env.FISH_API_KEY?.trim()) && /^[a-f0-9]{32}$/i.test(voiceId), provider: 'Fish Audio', voiceId, model: FISH_MODEL, local: false};
}

export async function fishSpeak(body, {env = process.env, fetchImpl = fetch, signal} = {}) {
  const assistant=body.assistant==='APEX'?'APEX':'NOVA',status=fishStatus(env,assistant);
  if (!env.FISH_API_KEY?.trim()) throw new Error(`${assistant} voice needs FISH_API_KEY in the private .env.local file.`);
  if(!status.ready)throw new Error('APEX voice needs a valid APEX_FISH_VOICE_ID in .env.local. Choose a Fish Audio voice; ElevenLabs voice IDs cannot be used with Fish Audio.');
  if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1500) throw new Error('Speech text must contain 1–1500 characters.');
  const text=assistant==='APEX'?spokenText(body.text):body.text;if(!text)throw new Error('Speech text has no spoken content.');
  let response;
  try {
    response = await fetchImpl('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {'Authorization': `Bearer ${env.FISH_API_KEY.trim()}`, 'Content-Type': 'application/json', model: FISH_MODEL},
      body: JSON.stringify({text, reference_id: status.voiceId, format: 'mp3', latency: 'normal', prosody: {speed: 1, volume: 0, normalize_loudness: true}}),
      signal: signal || AbortSignal.timeout(120000),
    });
  } catch { throw new Error('Fish Audio could not be reached. Try again later.'); }
  if (!response.ok) {
    const reasons = {401: 'Fish Audio API key was rejected.', 402: 'Fish Audio free tier is unavailable for this account.', 429: 'Fish Audio free tier rate limit reached.', 503: 'Fish Audio free tier is temporarily unavailable.'};
    throw new Error(reasons[response.status] || 'Fish Audio could not generate this voice. Check voice access and account settings.');
  }
  // Limit the streamed response before converting to base64; never reflect upstream errors or credentials.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Fish Audio returned no audio.');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8000000) { await reader.cancel(); throw new Error('Fish Audio response is too large.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new Error('Fish Audio returned no audio.');
  return {audio: Buffer.concat(chunks).toString('base64'), mime: 'audio/mpeg', voice: status.voiceId, provider: 'Fish Audio', model: FISH_MODEL};
}
