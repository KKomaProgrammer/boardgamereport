import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId','userId','role']);
  const access = await ensureProjectAccess(supabase, user.id, body.projectId, 'read');
  if (access.project.owner_id !== user.id) throw Object.assign(new Error('소유자만 권한을 변경할 수 있습니다.'), { status: 403 });
  const role = ['editor','viewer','commenter'].includes(body.role) ? body.role : 'viewer';
  const { error } = await supabase.from('project_members').update({ role, ai_enabled: !!body.aiEnabled, updated_at: new Date().toISOString() }).eq('project_id', body.projectId).eq('user_id', body.userId);
  if (error) throw error;
  await supabase.from('notifications').insert({ user_id: body.userId, actor_id: user.id, project_id: body.projectId, type: 'role_changed', title: '프로젝트 권한이 변경되었습니다.', body: `새 권한: ${role}` });
  return json({ updated: true });
}
