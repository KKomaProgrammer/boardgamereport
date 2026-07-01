import { json } from '../../_lib/response.js';
import { requireAuth, getProfile } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const profile = await getProfile(supabase, user.id);
  return json({ user: { id: user.id, email: user.email }, profile });
}
