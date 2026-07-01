import { json, readJson, cleanText } from '../../_lib/response.js';
import { requireAuth, normalizeNickname } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase } = await requireAuth(context);
  const body = await readJson(context.request);
  const q = normalizeNickname(cleanText(body.query, 40));
  if (q.length < 1) return json({ users: [] });
  const { data, error } = await supabase.from('profiles').select('id,nickname,avatar_color,updated_at').ilike('nickname_norm', `%${q}%`).limit(8);
  if (error) throw error;
  return json({ users: data });
}
