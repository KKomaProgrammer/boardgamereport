import { createClient } from '@supabase/supabase-js';

export function getSupabase(env, service = false) {
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL 환경변수가 없습니다.');
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  if (!key) throw new Error(service ? 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.' : 'SUPABASE_ANON_KEY 환경변수가 없습니다.');
  return createClient(env.SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireAuth(context) {
  const auth = context.request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
  const supabase = getSupabase(context.env, true);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('인증 토큰이 올바르지 않습니다.'), { status: 401 });
  return { supabase, user: data.user };
}
export async function getProfile(supabase, userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function ensureProjectAccess(supabase, userId, projectId, need = 'read') {
  const { data: project, error: pErr } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (pErr) throw pErr;
  if (!project) throw Object.assign(new Error('프로젝트를 찾을 수 없습니다.'), { status: 404 });
  if (project.owner_id === userId) return { project, role: 'owner', ai_enabled: true };
  const { data: member, error: mErr } = await supabase.from('project_members').select('*').eq('project_id', projectId).eq('user_id', userId).maybeSingle();
  if (mErr) throw mErr;
  if (!member || member.invite_status !== 'accepted') throw Object.assign(new Error('프로젝트 접근 권한이 없습니다.'), { status: 403 });
  const editRoles = ['owner', 'editor'];
  if (need === 'edit' && !editRoles.includes(member.role)) throw Object.assign(new Error('수정 권한이 없습니다.'), { status: 403 });
  if (need === 'owner') throw Object.assign(new Error('소유자만 실행할 수 있습니다.'), { status: 403 });
  return { project, role: member.role, ai_enabled: !!member.ai_enabled };
}
export function normalizeNickname(nickname) {
  return String(nickname || '').trim().toLowerCase().replace(/\s+/g, '');
}
