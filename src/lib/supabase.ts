import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase-types";

export function createServiceSupabaseClient(supabaseUrl: string, secretKey: string) {
  return createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createBrowserSupabaseClient(
  supabaseUrl: string,
  publishableKey: string,
  getAccessToken: () => Promise<string>,
) {
  return createClient<Database>(supabaseUrl, publishableKey, {
    accessToken: getAccessToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
