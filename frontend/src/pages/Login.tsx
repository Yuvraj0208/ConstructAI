import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';
import { dashboardPath, ROLE_LABELS, type Role } from '../types';
import { AuthShell } from '../components/AuthShell';
import { Button, ErrorText, inputClass, labelClass } from '../components/ui';

const DEMO_ACCOUNTS: Record<Role, string> = {
  manager: 'manager@constructai.dev',
  stock_handler: 'stock@constructai.dev',
  site_engineer: 'engineer@constructai.dev',
  vendor: 'vendor1@constructai.dev',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roleHint = params.get('role') as Role | null;

  const [email, setEmail] = useState(roleHint ? DEMO_ACCOUNTS[roleHint] ?? '' : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(role: Role) {
    setEmail(DEMO_ACCOUNTS[role]);
    setPassword('password123');
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={roleHint ? `Logging in as ${ROLE_LABELS[roleHint]}` : 'Log in to your account'}
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-indigo-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorText>{error}</ErrorText>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <p className="mb-2 font-semibold text-slate-700">Try a demo account (password: password123)</p>
        <div className="flex flex-wrap gap-2">
          {(['manager', 'stock_handler', 'site_engineer', 'vendor'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => fillDemo(r)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
