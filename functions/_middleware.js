import { handleOptions } from './_lib/response.js';
export async function onRequest(context) {
  const options = handleOptions(context.request);
  if (options) return options;
  try {
    return await context.next();
  } catch (error) {
    const status = error.status || 500;
    return new Response(JSON.stringify({ error: error.message || '서버 오류가 발생했습니다.' }), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
    });
  }
}
