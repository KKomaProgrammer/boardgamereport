import { json } from '../../_lib/response.js';

export async function onRequest({ env }) {
  const siteUrl = env.PUBLIC_SITE_URL || (env.CF_PAGES_URL ? `https://${env.CF_PAGES_URL}` : '');
  return json({
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY || '',
    authReady: !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    siteUrl
  });
}
