import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess, getProfile } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId','targetUserId']);
  await ensureProjectAccess(supabase, user.id, body.projectId, 'edit');
  const role = ['editor','viewer','commenter'].includes(body.role) ? body.role : 'editor';
  const { data: invitation, error } = await supabase.from('invitations').insert({
    project_id: body.projectId, sender_id: user.id, receiver_id: body.targetUserId, role, ai_enabled: !!body.aiEnabled, status: 'pending'
  }).select('*').single();
  if (error) throw error;
  const sender = await getProfile(supabase, user.id);
  await supabase.from('notifications').insert({ user_id: body.targetUserId, actor_id: user.id, project_id: body.projectId, type: 'invite', title: `${sender?.nickname || '팀원'}님이 프로젝트에 초대했습니다.`, body: '알림에서 수락 또는 거절할 수 있습니다.' });
  return json({ sent: true, invitation }, 201);
}
