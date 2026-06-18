import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useStore } from '../store/appStore';
import {
  getSession,
  isCloudConfigured,
  onAuthChange,
  pullState,
  pushState,
  signIn,
  signOut,
  signUp,
} from '../lib/cloud';
import { IconDownload } from './icons';

type Msg = { ok: boolean; text: string } | null;

export default function CloudPanel() {
  const configured = isCloudConfigured();
  const exportJSON = useStore((s) => s.exportJSON);
  const importJSON = useStore((s) => s.importJSON);

  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!configured) return;
    let unsub: (() => void) | undefined;
    getSession().then(setSession);
    onAuthChange(setSession).then((fn) => (unsub = fn));
    return () => unsub?.();
  }, [configured]);

  if (!configured) {
    return (
      <div className="card p-5">
        <h3 className="mb-1 font-semibold">Cadangan cloud (opsional)</h3>
        <p className="text-sm text-slate-500">
          Belum aktif. Aktifkan dengan menyetel <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">VITE_SUPABASE_URL</code> dan{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">VITE_SUPABASE_ANON_KEY</code> saat build, lalu terapkan migrasi
          di <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">supabase/migrations</code>. Lihat <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">docs/SUPABASE.md</code>.
        </p>
      </div>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message || 'Terjadi kesalahan.' });
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = () => run(async () => { await signIn(email.trim(), password); });
  const doSignUp = () =>
    run(async () => {
      const { needsConfirmation } = await signUp(email.trim(), password);
      setMsg({
        ok: true,
        text: needsConfirmation ? 'Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk.' : 'Akun dibuat & masuk.',
      });
    });
  const doSignOut = () => run(async () => { await signOut(); });

  const doPush = () =>
    run(async () => {
      const at = await pushState(JSON.parse(exportJSON()));
      setMsg({ ok: true, text: `Tersimpan ke cloud (${new Date(at).toLocaleString('id-ID')}).` });
    });

  const doPull = () =>
    run(async () => {
      const remote = await pullState();
      if (!remote) {
        setMsg({ ok: false, text: 'Belum ada data di cloud untuk akun ini.' });
        return;
      }
      if (!confirm('Ganti SEMUA data di perangkat ini dengan data dari cloud?')) return;
      const res = importJSON(JSON.stringify(remote.data));
      setMsg(
        res.ok
          ? { ok: true, text: `Dipulihkan dari cloud (${new Date(remote.updatedAt).toLocaleString('id-ID')}).` }
          : { ok: false, text: res.error ?? 'Data cloud tidak valid.' },
      );
    });

  return (
    <div className="card p-5">
      <h3 className="mb-1 font-semibold">Cadangan cloud (opsional)</h3>
      {!session ? (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Masuk untuk menyimpan & menyinkronkan data antar perangkat. Data hanya bisa diakses oleh akun Anda.
          </p>
          <div className="space-y-2">
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input className="input" type="password" placeholder="Kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={doSignIn} disabled={busy || !email.trim() || !password}>
                Masuk
              </button>
              <button className="btn-outline flex-1" onClick={doSignUp} disabled={busy || !email.trim() || !password}>
                Daftar
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Masuk sebagai <span className="font-medium text-slate-700 dark:text-slate-200">{session.user.email}</span>.
          </p>
          <div className="flex flex-col gap-2">
            <button className="btn-primary justify-start" onClick={doPush} disabled={busy}>
              <IconDownload width={16} height={16} className="rotate-180" /> Unggah ke cloud (timpa cloud)
            </button>
            <button className="btn-outline justify-start" onClick={doPull} disabled={busy}>
              <IconDownload width={16} height={16} /> Ambil dari cloud (timpa perangkat)
            </button>
            <button className="btn-ghost justify-start text-rose-600" onClick={doSignOut} disabled={busy}>
              Keluar
            </button>
          </div>
        </>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
    </div>
  );
}
