import type { Session, SupabaseClient } from '@supabase/supabase-js';

// ===========================================================================
// Optional cloud backup/sync via Supabase. Entirely opt-in: when the env vars
// are absent the app stays 100% local. The whole AppState is stored as one
// jsonb row per user (last-write-wins) — backup & multi-device, not realtime
// collaboration. The client is loaded lazily so it never bloats the main bundle.
// ===========================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const TABLE = 'app_state';

export const isCloudConfigured = (): boolean => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
async function getClient(): Promise<SupabaseClient> {
  if (!isCloudConfigured()) throw new Error('Cadangan cloud belum dikonfigurasi.');
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    );
  }
  return clientPromise;
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Anda belum masuk.');
  return uid;
}

// ---------- auth ----------

export async function getSession(): Promise<Session | null> {
  if (!isCloudConfigured()) return null;
  const { data } = await (await getClient()).auth.getSession();
  return data.session;
}

export async function onAuthChange(cb: (session: Session | null) => void): Promise<() => void> {
  const { data } = (await getClient()).auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await (await getClient()).auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await (await getClient()).auth.signUp({ email, password });
  if (error) throw error;
  // When email confirmation is on, no session is returned until the user confirms.
  return { needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  await (await getClient()).auth.signOut();
}

// ---------- data ----------

export interface RemoteState {
  data: unknown;
  updatedAt: string;
}

export async function pullState(): Promise<RemoteState | null> {
  const client = await getClient();
  const uid = await requireUserId(client);
  const { data, error } = await client
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? { data: data.data, updatedAt: data.updated_at as string } : null;
}

export async function pushState(state: unknown): Promise<string> {
  const client = await getClient();
  const uid = await requireUserId(client);
  const updatedAt = new Date().toISOString();
  const { error } = await client
    .from(TABLE)
    .upsert({ user_id: uid, data: state, updated_at: updatedAt }, { onConflict: 'user_id' });
  if (error) throw error;
  return updatedAt;
}
