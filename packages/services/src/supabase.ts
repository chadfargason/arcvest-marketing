import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export interface SupabaseConfig {
  url: string;
  anonKey?: string;
  serviceKey?: string;
}

/**
 * Get the Supabase client instance.
 * Uses service key if available (for server-side operations),
 * falls back to anon key for client-side operations.
 */
export function getSupabase(config?: SupabaseConfig): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const url = config?.url || process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const key = config?.serviceKey ||
              config?.anonKey ||
              process.env['SUPABASE_SERVICE_KEY'] ||
              process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!url || !key) {
    throw new Error('Supabase URL and key are required. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

/**
 * Create a new Supabase client instance (for isolated operations).
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  const url = config.url;
  const key = config.serviceKey || config.anonKey;

  if (!url || !key) {
    throw new Error('Supabase URL and key are required.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetSupabase(): void {
  supabaseInstance = null;
}
