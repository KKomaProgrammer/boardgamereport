import { json, readJson, requireFields, cleanText } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';

const FALLBACK_PATTERNS = ['billing','credit','credits','quota','insufficient_quota','rate_limit','rate limit','usage limit','limit exceeded','payment','balance'];

function isFallbackError(status, text) {
  const value = String(text || '').toLowerCase();
  return status === 402 || status === 429 || FALLBACK_PATTERNS.some(pattern => value.includes(pattern));
}

function buildSpritePrompt({ prompt, cols, rows }) {
  const count = cols * rows;
  return [
    `Create one clean printable board game sprite sheet with exactly ${cols} columns and ${rows} rows, total ${count} separate sprites.`,
    'Each cell must contain one centered icon or token with consistent style, equal spacing, no text, no labels, no numbers, no watermark.',
    'Use a modern board-game production style suitable for school presentation materials.',
    'Keep every sprite visually separated so a web app can crop the sheet by grid cells.',
    `Theme: ${prompt}`
  ].join('\n');
}

async function readJsonSafe(res) {
  const raw = await res.text();
  try { return { raw, data: raw ? JSON.parse(raw) : null }; } catch { return { raw, data: null }; }
}

function extractGeminiImage(data) {
  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
    }
  }
  return '';
}

async function callOpenAIImage(env, imagePrompt) {
  if (!env.OPENAI_API_KEY) throw Object.assign(new Error('OPENAI_API_KEY가 없습니다.'), { fallbackAllowed: true });
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt: imagePrompt,
      size: env.OPENAI_IMAGE_SIZE || '1024x1024',
      n: 1
    })
  });
  const { raw, data } = await readJsonSafe(res);
  if (!res.ok) {
    const message = data?.error?.message || raw || `OpenAI 이미지 요청 실패: ${res.status}`;
    throw Object.assign(new Error(message), { provider: 'openai', status: res.status, fallbackAllowed: isFallbackError(res.status, `${message}\n${raw}`) });
  }
  const item = data?.data?.[0] || {};
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item.url) return item.url;
  throw Object.assign(new Error('OpenAI 이미지 응답에서 이미지를 찾지 못했습니다.'), { provider: 'openai' });
}

async function callGeminiImage(env, imagePrompt) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY가 없습니다.');
  const model = env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    })
  });
  const { raw, data } = await readJsonSafe(res);
  if (!res.ok) {
    const message = data?.error?.message || raw || `Gemini 이미지 요청 실패: ${res.status}`;
    throw Object.assign(new Error(message), { provider: 'gemini', status: res.status });
  }
  const image = extractGeminiImage(data);
  if (!image) throw Object.assign(new Error('Gemini 이미지 응답에서 이미지를 찾지 못했습니다.'), { provider: 'gemini' });
  return image;
}

export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId', 'prompt']);
  const access = await ensureProjectAccess(supabase, user.id, body.projectId, 'read');
  if (!access.ai_enabled) throw Object.assign(new Error('AI 사용 권한이 없습니다.'), { status: 403 });

  const [colsRaw, rowsRaw] = String(body.layout || '4x4').split('x').map(v => Number(v));
  const cols = [2,3,4,5,6].includes(colsRaw) ? colsRaw : 4;
  const rows = [2,3,4,5,6].includes(rowsRaw) ? rowsRaw : 4;
  const prompt = cleanText(body.prompt, 800);
  const imagePrompt = buildSpritePrompt({ prompt, cols, rows });

  try {
    const imageDataUrl = await callOpenAIImage(context.env, imagePrompt);
    return json({ imageDataUrl, provider: 'openai', cols, rows, prompt }, 201);
  } catch (openaiError) {
    if (context.env.GEMINI_API_KEY && openaiError.fallbackAllowed) {
      const imageDataUrl = await callGeminiImage(context.env, imagePrompt);
      return json({ imageDataUrl, provider: 'gemini', fallbackFrom: 'openai', cols, rows, prompt }, 201);
    }
    if (!context.env.OPENAI_API_KEY && context.env.GEMINI_API_KEY) {
      const imageDataUrl = await callGeminiImage(context.env, imagePrompt);
      return json({ imageDataUrl, provider: 'gemini', cols, rows, prompt }, 201);
    }
    throw openaiError;
  }
}
