import { json, readJson, cleanText, requireFields } from '../../_lib/response.js';
import { requireAuth, ensureProjectAccess } from '../../_lib/supabase.js';
function randomSlug(){ return Math.random().toString(36).replace(/[^a-z0-9]/g,'').slice(0,4); }
function validSlug(s){ return /^[a-z0-9_-]{4,32}$/.test(s); }
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  requireFields(body, ['projectId']);
  await ensureProjectAccess(supabase, user.id, body.projectId, 'edit');
  const scope = ['all','ppt','video','boardgame'].includes(body.scope) ? body.scope : 'all';
  let slug = cleanText(body.customId, 32).toLowerCase() || randomSlug();
  if (!validSlug(slug)) throw Object.assign(new Error('공유 ID는 영문 소문자, 숫자, -, _ 조합 4~32자여야 합니다.'), { status: 400 });
  for (let i=0;i<8;i++) {
    const { data: exists } = await supabase.from('share_links').select('id').eq('slug', slug).maybeSingle();
    if (!exists) break;
    if (body.customId) throw Object.assign(new Error('이미 사용 중인 공유 ID입니다.'), { status: 409 });
    slug = randomSlug();
  }
  const password_hash = body.password ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(body.password))).then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')) : null;
  const { data, error } = await supabase.from('share_links').insert({ project_id: body.projectId, slug, scope, expires_at: body.expiresAt || null, password_hash, created_by: user.id, is_public: true }).select('*').single();
  if (error) throw error;
  const origin = new URL(context.request.url).origin;
  return json({ share: data, url: `${origin}/s/${slug}/` }, 201);
}
