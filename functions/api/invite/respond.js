import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['invitationId','response']);
  const response = body.response === 'accepted' ? 'accepted' : 'declined';
  const { data: inv, error } = await supabase.from('invitations').select('*').eq('id', body.invitationId).eq('receiver_id', user.id).maybeSingle();
  if (error) throw error;
  if (!inv) throw Object.assign(new Error('초대를 찾을 수 없습니다.'), { status: 404 });
  await supabase.from('invitations').update({ status: response, responded_at: new Date().toISOString() }).eq('id', inv.id);
  if (response === 'accepted') {
    await supabase.from('project_members').upsert({ project_id: inv.project_id, user_id: user.id, role: inv.role, ai_enabled: inv.ai_enabled, invite_status: 'accepted' }, { onConflict: 'project_id,user_id' });
  }
  await supabase.from('notifications').insert({ user_id: inv.sender_id, actor_id: user.id, project_id: inv.project_id, type: 'invite_response', title: `초대가 ${response === 'accepted' ? '수락' : '거절'}되었습니다.`, body: '' });
  return json({ responded: true, status: response });
}
