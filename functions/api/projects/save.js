import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';
import { encryptJson } from '../../_lib/crypto.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId','workspaceType','content']);
  if (!['video_workspace','ppt_workspace'].includes(body.workspaceType)) throw Object.assign(new Error('workspaceType 값이 올바르지 않습니다.'), { status: 400 });
  await ensureProjectAccess(supabase, user.id, body.projectId, 'edit');
  const content_enc = await encryptJson(context.env, body.content);
  const { error } = await supabase.from('project_documents').upsert({
    project_id: body.projectId, document_type: body.workspaceType, content_enc, updated_by: user.id, updated_at: new Date().toISOString()
  }, { onConflict: 'project_id,document_type' });
  if (error) throw error;
  await supabase.from('projects').update({ current_mode: body.mode === 'video' ? 'video' : 'ppt', updated_at: new Date().toISOString() }).eq('id', body.projectId);
  if (body.makeVersion) await supabase.from('project_versions').insert({ project_id: body.projectId, document_type: body.workspaceType, content_enc, created_by: user.id, summary: body.summary || '자동 저장 버전' });
  return json({ saved: true, updated_at: new Date().toISOString() });
}
