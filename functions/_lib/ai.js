import { cleanText } from './response.js';

const BILLING_OR_QUOTA_PATTERNS = [
  'billing',
  'credit',
  'credits',
  'quota',
  'insufficient_quota',
  'rate_limit',
  'rate limit',
  'usage limit',
  'limit exceeded',
  'payment',
  'balance'
];

function buildPrompt(task, content) {
  return [
    'BoardLab Studio의 학교 보드게임부 발표 제작 보조 AI입니다.',
    '학생이 직접 작성한 내용을 대신 완성하지 말고, 발표 준비에 도움이 되는 짧고 적용 가능한 제안만 한국어로 작성하세요.',
    '결과는 제안 카드에 표시되므로 불필요한 설명, 면책 문구, 긴 원리 설명은 빼세요.',
    '',
    `작업 종류: ${task}`,
    '',
    '입력 내용:',
    content || '(입력 내용 없음)'
  ].join('\n');
}

function isBillingOrQuotaError(status, payloadText) {
  const text = String(payloadText || '').toLowerCase();
  return status === 402 || status === 429 || BILLING_OR_QUOTA_PATTERNS.some(pattern => text.includes(pattern));
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function extractGeminiText(data) {
  return (data?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function callOpenAI(env, prompt) {
  if (!env.OPENAI_API_KEY) throw Object.assign(new Error('OPENAI_API_KEY가 없습니다.'), { fallbackAllowed: true });
  const model = env.OPENAI_MODEL || 'gpt-4.1-mini';
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: Number(env.AI_MAX_OUTPUT_TOKENS || 900)
    })
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!res.ok) {
    const message = data?.error?.message || raw || `OpenAI 요청 실패: ${res.status}`;
    throw Object.assign(new Error(message), {
      provider: 'openai',
      status: res.status,
      fallbackAllowed: isBillingOrQuotaError(res.status, `${message}\n${raw}`)
    });
  }
  const text = extractOpenAIText(data);
  if (!text) throw Object.assign(new Error('OpenAI 응답에서 텍스트를 찾지 못했습니다.'), { provider: 'openai' });
  return text;
}

async function callGemini(env, prompt) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY가 없습니다.');
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: '너는 학교 발표 준비를 돕는 간결한 한국어 보조 AI다.' }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: Number(env.AI_MAX_OUTPUT_TOKENS || 900),
        temperature: Number(env.AI_TEMPERATURE || 0.7)
      }
    })
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!res.ok) {
    const message = data?.error?.message || raw || `Gemini 요청 실패: ${res.status}`;
    throw Object.assign(new Error(message), { provider: 'gemini', status: res.status });
  }
  const text = extractGeminiText(data);
  if (!text) throw Object.assign(new Error('Gemini 응답에서 텍스트를 찾지 못했습니다.'), { provider: 'gemini' });
  return text;
}

async function callLegacyEndpoint(env, task, content) {
  if (!env.AI_ENDPOINT || !env.AI_API_KEY) return null;
  const res = await fetch(env.AI_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify({ task, input: content })
  });
  if (!res.ok) throw new Error('AI 요청에 실패했습니다.');
  const data = await res.json();
  return data.suggestion || data.output || data.text || JSON.stringify(data).slice(0, 2000);
}

export async function generateSuggestion(env, task, text) {
  const content = cleanText(text, 6000);
  const prompt = buildPrompt(task, content);

  try {
    return await callOpenAI(env, prompt);
  } catch (openaiError) {
    if (env.GEMINI_API_KEY && openaiError.fallbackAllowed) {
      try {
        return await callGemini(env, prompt);
      } catch (geminiError) {
        throw new Error(`GPT 사용이 불가능해 Gemini로 재시도했지만 실패했습니다. GPT 오류: ${openaiError.message} / Gemini 오류: ${geminiError.message}`);
      }
    }

    const legacyResult = await callLegacyEndpoint(env, task, content);
    if (legacyResult) return legacyResult;

    if (env.GEMINI_API_KEY && !env.OPENAI_API_KEY) return await callGemini(env, prompt);
    if (env.OPENAI_API_KEY) throw openaiError;
  }

  return `OPENAI_API_KEY와 GEMINI_API_KEY가 아직 연결되지 않았습니다.\n\n${task} 기준으로는 다음처럼 정리할 수 있습니다.\n- 핵심 목적을 한 문장으로 먼저 말하기\n- 규칙과 절차를 번호로 나누기\n- 발표용 문장은 짧게 만들기\n- 팀원이 적용 버튼을 눌렀을 때만 저장하기\n\n입력 일부: ${content.slice(0, 500)}`;
}
