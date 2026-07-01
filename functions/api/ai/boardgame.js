import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';
import { generateSuggestion } from '../../_lib/ai.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId']);
  const access = await ensureProjectAccess(supabase, user.id, body.projectId, 'read');
  if (!access.ai_enabled) throw Object.assign(new Error('AI 사용 권한이 없습니다.'), { status: 403 });
  const suggestion = await generateSuggestion(context.env, '보드게임 규칙과 밸런스 점검', body.text || body.prompt || '');
  return json({ suggestion });
}
