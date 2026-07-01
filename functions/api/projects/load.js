import { json, readJson, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';
import { decryptJson } from '../../_lib/crypto.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId']);
  const access = await ensureProjectAccess(supabase, user.id, body.projectId, 'read');
  const { data: docs, error: dErr } = await supabase.from('project_documents').select('document_type,content_enc,updated_at,updated_by').eq('project_id', body.projectId);
  if (dErr) throw dErr;
  const documents = {};
  for (const doc of docs || []) documents[doc.document_type] = await decryptJson(context.env, doc.content_enc);
  const { data: members, error: mErr } = await supabase.from('project_members_view').select('*').eq('project_id', body.projectId);
  if (mErr) throw mErr;
  return json({ project: access.project, documents, members });
}
