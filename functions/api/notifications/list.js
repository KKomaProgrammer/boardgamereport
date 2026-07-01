import { json } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return json({ notifications: data });
}
