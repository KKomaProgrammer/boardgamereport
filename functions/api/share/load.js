import { json, readJson, requireFields } from '../../_lib/response.js';
import { getSupabase } from '../../_lib/supabase.js';
import { decryptJson } from '../../_lib/crypto.js';
export async function onRequest(context) {
  const supabase = getSupabase(context.env, true);
  const body = await readJson(context.request);
  requireFields(body, ['slug']);
  const { data: share, error: sErr } = await supabase.from('share_links').select('*').eq('slug', body.slug).eq('is_public', true).maybeSingle();
  if (sErr) throw sErr;
  if (!share) throw Object.assign(new Error('공유 링크를 찾을 수 없습니다.'), { status: 404 });
  if (share.expires_at && new Date(share.expires_at) < new Date()) throw Object.assign(new Error('만료된 공유 링크입니다.'), { status: 410 });
  if (share.password_hash) {
    if (!body.password) throw Object.assign(new Error('비밀번호가 필요합니다.'), { status: 401 });
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(body.password))).then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''));
    if (hash !== share.password_hash) throw Object.assign(new Error('비밀번호가 올바르지 않습니다.'), { status: 403 });
  }
  const { data: project, error: pErr } = await supabase.from('projects').select('id,title,description,current_mode,updated_at').eq('id', share.project_id).single();
  if (pErr) throw pErr;
  const { data: docs, error: dErr } = await supabase.from('project_documents').select('document_type,content_enc').eq('project_id', share.project_id);
  if (dErr) throw dErr;
  const documents = {};
  for (const doc of docs || []) documents[doc.document_type] = await decryptJson(context.env, doc.content_enc);
  return json({ share, project, documents });
}
