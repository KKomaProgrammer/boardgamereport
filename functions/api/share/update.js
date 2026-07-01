import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['shareId','projectId']);
  await ensureProjectAccess(supabase, user.id, body.projectId, 'edit');
  const { error } = await supabase.from('share_links').update({
    is_public: body.isPublic !== false, expires_at: body.expiresAt || null, scope: body.scope || 'all', updated_at: new Date().toISOString()
  }).eq('id', body.shareId).eq('project_id', body.projectId);
  if (error) throw error;
  return json({ updated: true });
}
