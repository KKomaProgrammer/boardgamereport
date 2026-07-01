import { json } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/supabase.js';
export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const { error } = await supabase.from('notifications').update({ unread: false }).eq('user_id', user.id);
  if (error) throw error;
  return json({ read: true });
}
