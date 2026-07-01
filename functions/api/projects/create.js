import { json, readJson, cleanText, requireFields } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/supabase.js';
import { encryptJson } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['title']);
  const mode = ['video','ppt'].includes(body.mode) ? body.mode : 'ppt';
  const { data: project, error } = await supabase.from('projects').insert({
    title: cleanText(body.title, 120),
    description: cleanText(body.description, 1000),
    owner_id: user.id,
    current_mode: mode
  }).select('*').single();
  if (error) throw error;
  await supabase.from('project_members').insert({ project_id: project.id, user_id: user.id, role: 'owner', ai_enabled: true, invite_status: 'accepted' });
  const initialDocs = {
    video_workspace: { scenes: [], editor: { clips: [] } },
    ppt_workspace: { template:'classic', slides:[{ title: project.title, body:'첫 슬라이드 내용을 입력하세요.', notes:'' }] }
  };
  for (const [type, content] of Object.entries(initialDocs)) {
    await supabase.from('project_documents').insert({ project_id: project.id, document_type: type, content_enc: await encryptJson(context.env, content), updated_by: user.id });
  }
  return json({ project }, 201);
}
