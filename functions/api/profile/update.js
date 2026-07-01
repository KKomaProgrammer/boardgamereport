import { json, readJson, cleanText } from '../../_lib/response.js';
import { requireAuth, normalizeNickname } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const body = await readJson(context.request);
  const updates = { updated_at: new Date().toISOString() };
  if (body.nickname !== undefined) {
    const nickname = cleanText(body.nickname, 30);
    if (nickname.length < 2) throw Object.assign(new Error('닉네임은 2글자 이상이어야 합니다.'), { status: 400 });
    updates.nickname = nickname;
    updates.nickname_norm = normalizeNickname(nickname);
  }
  if (body.email || body.password) {
    const authUpdates = {};
    if (body.email) authUpdates.email = cleanText(body.email, 120);
    if (body.password) authUpdates.password = String(body.password);
    const { error: authError } = await supabase.auth.admin.updateUserById(user.id, authUpdates);
    if (authError) throw authError;
  }
  const { data, error } = await supabase.from('profiles').upsert({ id: user.id, ...updates }).select('*').single();
  if (error) throw error;
  return json({ profile: data });
}
