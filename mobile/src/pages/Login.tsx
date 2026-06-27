import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { Button, ErrorText, inputClass } from '../lib/ui';
import { Icon } from '../lib/icons';

const DEMO = [
  { label: 'Stock Handler', email: 'stock@constructai.dev' },
  { label: 'Site Engineer', email: 'engineer@constructai.dev' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setGate(false);
    try {
      const user = await login(email.trim(), password);
      if (user.role === 'stock_handler') navigate('/s/stock', { replace: true });
      else if (user.role === 'site_engineer') navigate('/e/update', { replace: true });
      else setGate(true); // managers / vendors use the web dashboard
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blueprint flex min-h-[100dvh] flex-col justify-center px-6 py-10 text-white">
      <div className="animate-fade-up mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-glow">
            <Icon name="building" className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Construct<span className="text-amber-300">AI</span> Field
          </h1>
          <p className="mt-1 text-sm text-slate-400">Post from site — stock, requests, updates & photos</p>
        </div>

        {gate ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-center text-sm text-amber-100">
            This app is for <strong>stock handlers</strong> and <strong>site engineers</strong>. Managers
            and vendors use the web dashboard.
            <button
              onClick={() => setGate(false)}
              className="mt-3 block w-full rounded-xl bg-white/10 py-2.5 font-semibold text-white active:bg-white/20"
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <ErrorText>{error}</ErrorText>
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Log in'}
            </Button>
          </form>
        )}

        {!gate && (
          <div className="mt-6">
            <p className="mb-2 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Demo accounts · password123
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword('password123');
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 active:bg-white/10"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
