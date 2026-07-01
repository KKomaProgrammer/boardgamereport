import { json } from '../../_lib/response.js';
export async function onRequest({ env }) {
  return json({
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY || '',
    demoMode: !(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY && env.APP_SECRET)
  });
}
