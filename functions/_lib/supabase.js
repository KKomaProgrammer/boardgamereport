function getBaseUrl(env) {
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL 환경변수가 없습니다.');
  return String(env.SUPABASE_URL).replace(/\/$/, '');
}

function getKey(env, service = false) {
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY;
  if (!key) throw new Error(service ? 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.' : 'SUPABASE_ANON_KEY 환경변수가 없습니다.');
  return key;
}

function makeError(message, status = 500, details = null) {
  const error = new Error(message || 'Supabase 요청 실패');
  error.status = status;
  error.details = details;
  return error;
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

class RestQuery {
  constructor(env, key, table) {
    this.env = env;
    this.key = key;
    this.table = table;
    this.method = 'GET';
    this.params = new URLSearchParams();
    this.body = undefined;
    this.headers = {};
    this.asSingle = false;
    this.asMaybeSingle = false;
  }

  select(columns = '*') {
    this.params.set('select', columns);
    return this;
  }

  eq(column, value) {
    this.params.append(column, `eq.${String(value)}`);
    return this;
  }

  ilike(column, value) {
    this.params.append(column, `ilike.${String(value)}`);
    return this;
  }

  order(column, options = {}) {
    const direction = options.ascending === false ? 'desc' : 'asc';
    this.params.set('order', `${column}.${direction}`);
    return this;
  }

  limit(count) {
    this.params.set('limit', String(count));
    return this;
  }

  insert(value) {
    this.method = 'POST';
    this.body = value;
    this.headers.prefer = 'return=representation';
    return this;
  }

  update(value) {
    this.method = 'PATCH';
    this.body = value;
    this.headers.prefer = 'return=representation';
    return this;
  }

  upsert(value, options = {}) {
    this.method = 'POST';
    this.body = value;
    const preferences = ['resolution=merge-duplicates', 'return=representation'];
    this.headers.prefer = preferences.join(',');
    if (options.onConflict) this.params.set('on_conflict', options.onConflict);
    return this;
  }

  single() {
    this.asSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.asMaybeSingle = true;
    return this.execute();
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    const url = new URL(`${getBaseUrl(this.env)}/rest/v1/${this.table}`);
    for (const [key, value] of this.params.entries()) url.searchParams.append(key, value);

    const headers = {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      'content-type': 'application/json',
      ...this.headers
    };

    const init = { method: this.method, headers };
    if (this.body !== undefined) init.body = JSON.stringify(this.body);

    const res = await fetch(url.toString(), init);
    const payload = await parseResponse(res);

    if (!res.ok) {
      const message = payload?.message || payload?.error_description || payload?.error || `Supabase REST 오류: ${res.status}`;
      return { data: null, error: makeError(message, res.status, payload) };
    }

    let data = payload;
    if (this.asSingle || this.asMaybeSingle) {
      if (Array.isArray(payload)) {
        if (payload.length === 0 && this.asMaybeSingle) data = null;
        else if (payload.length === 1) data = payload[0];
        else if (payload.length === 0) return { data: null, error: makeError('결과가 없습니다.', 404) };
        else return { data: null, error: makeError('결과가 2개 이상입니다.', 406) };
      }
    }

    return { data, error: null };
  }
}

export function getSupabase(env, service = false) {
  const key = getKey(env, service);
  return {
    from(table) {
      return new RestQuery(env, key, table);
    },
    auth: {
      async getUser(token) {
        const res = await fetch(`${getBaseUrl(env)}/auth/v1/user`, {
          headers: {
            apikey: getKey(env, false),
            authorization: `Bearer ${token}`
          }
        });
        const data = await parseResponse(res);
        if (!res.ok) return { data: { user: null }, error: makeError(data?.msg || data?.message || '사용자 인증 실패', res.status, data) };
        return { data: { user: data }, error: null };
      },
      admin: {
        async updateUserById(userId, updates) {
          const res = await fetch(`${getBaseUrl(env)}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
            method: 'PUT',
            headers: {
              apikey: getKey(env, true),
              authorization: `Bearer ${getKey(env, true)}`,
              'content-type': 'application/json'
            },
            body: JSON.stringify(updates || {})
          });
          const data = await parseResponse(res);
          if (!res.ok) return { data: null, error: makeError(data?.msg || data?.message || '사용자 정보 변경 실패', res.status, data) };
          return { data, error: null };
        }
      }
    }
  };
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
