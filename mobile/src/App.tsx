import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell, type Tab } from './components/AppShell';
import { Spinner } from './lib/ui';
import Login from './pages/Login';
import type { Role } from './types';

const StockList = lazy(() => import('./pages/stock/StockList'));
const RecordMovement = lazy(() => import('./pages/stock/RecordMovement'));
const RequestsQueue = lazy(() => import('./pages/stock/RequestsQueue'));
const Deliveries = lazy(() => import('./pages/stock/Deliveries'));
const DailyUpdate = lazy(() => import('./pages/engineer/DailyUpdate'));
const RequestMaterials = lazy(() => import('./pages/engineer/RequestMaterials'));
const PhotoCapture = lazy(() => import('./pages/engineer/PhotoCapture'));
const ActivityLog = lazy(() => import('./pages/engineer/ActivityLog'));

const STOCK_TABS: Tab[] = [
  { to: '/s/stock', label: 'Stock', icon: 'box' },
  { to: '/s/record', label: 'Record', icon: 'plus' },
  { to: '/s/requests', label: 'Requests', icon: 'clipboard' },
  { to: '/s/deliveries', label: 'Deliver', icon: 'truck' },
];

const ENG_TABS: Tab[] = [
  { to: '/e/update', label: 'Update', icon: 'clipboard' },
  { to: '/e/materials', label: 'Materials', icon: 'box' },
  { to: '/e/photo', label: 'Photo', icon: 'camera' },
  { to: '/e/log', label: 'Log', icon: 'list' },
];

function Splash() {
  return (
    <div className="grid h-[100dvh] place-items-center">
      <Spinner />
    </div>
  );
}

function RequireRole({ roles, tabs }: { roles: Role[]; tabs: Tab[] }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <AppShell tabs={tabs} />;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'stock_handler') return <Navigate to="/s/stock" replace />;
  if (user.role === 'site_engineer') return <Navigate to="/e/update" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireRole roles={['stock_handler']} tabs={STOCK_TABS} />}>
          <Route path="/s/stock" element={<StockList />} />
          <Route path="/s/record" element={<RecordMovement />} />
          <Route path="/s/requests" element={<RequestsQueue />} />
          <Route path="/s/deliveries" element={<Deliveries />} />
        </Route>
        <Route element={<RequireRole roles={['site_engineer']} tabs={ENG_TABS} />}>
          <Route path="/e/update" element={<DailyUpdate />} />
          <Route path="/e/materials" element={<RequestMaterials />} />
          <Route path="/e/photo" element={<PhotoCapture />} />
          <Route path="/e/log" element={<ActivityLog />} />
        </Route>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
