import { json } from '../../_lib/response.js';
import { requireAuth } from '../../_lib/supabase.js';

export async function onRequest(context) {
  const { supabase, user } = await requireAuth(context);
  const { data: owned, error: ownedError } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (ownedError) throw ownedError;

  const { data: memberships, error: memberError } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', user.id)
    .eq('invite_status', 'accepted')
    .limit(80);
  if (memberError) throw memberError;

  const ids = [...new Set((memberships || []).map(item => item.project_id))].filter(Boolean);
  let joined = [];
  for (const id of ids) {
    const { data } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
    if (data && data.owner_id !== user.id) joined.push(data);
  }

  const projects = [...(owned || []), ...joined].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return json({ projects });
}
