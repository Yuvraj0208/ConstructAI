import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, apiError } from '../api/client';
import { dashboardPath, ROLE_LABELS, type Industry, type Role } from '../types';
import { AuthShell } from '../components/AuthShell';
import { Button, ErrorText, inputClass, labelClass } from '../components/ui';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roleHint = (params.get('role') as Role | null) ?? 'stock_handler';

  const [industries, setIndustries] = useState<Industry[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(roleHint);
  const [industryId, setIndustryId] = useState<number | ''>('');
  const [city, setCity] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Industry[]>('/industries')
      .then((res) => {
        setIndustries(res.data);
        if (res.data.length && industryId === '') setIndustryId(res.data[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await signup({
        full_name: fullName,
        email,
        password,
        role,
        city: city || undefined,
        industry_id: industryId === '' ? undefined : industryId,
        company_name: role === 'vendor' ? companyName || undefined : undefined,
      });
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Pick your role to get the right workspace"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorText>{error}</ErrorText>

        <div>
          <label className={labelClass}>I am a…</label>
          <div className="grid grid-cols-3 gap-2">
            {(['stock_handler', 'manager', 'vendor'] as Role[]).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                  role === r
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Full name</label>
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        {role === 'vendor' && (
          <div>
            <label className={labelClass}>Company name</label>
            <input
              className={inputClass}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. UltraTech Supplies"
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Industry</label>
            <select
              className={inputClass}
              value={industryId}
              onChange={(e) => setIndustryId(e.target.value ? Number(e.target.value) : '')}
            >
              {industries.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai"
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
