export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization'
};
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...headers }
  });
}
export async function readJson(request) {
  if (request.method === 'GET') return Object.fromEntries(new URL(request.url).searchParams.entries());
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error('JSON 형식이 올바르지 않습니다.'); }
}
export function handleOptions(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return null;
}
export function requireFields(body, fields) {
  for (const f of fields) if (body[f] === undefined || body[f] === null || body[f] === '') throw new Error(`${f} 값이 필요합니다.`);
}
export function cleanText(value, max = 3000) {
  return String(value ?? '').trim().slice(0, max);
}
