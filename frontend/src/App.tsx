import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { dashboardPath } from './types';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Spinner } from './components/ui';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Dashboards are code-split so the heavy charting bundle loads only when needed.
const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'));
const StockDashboard = lazy(() => import('./pages/stock/StockDashboard'));
const VendorDashboard = lazy(() => import('./pages/vendor/VendorDashboard'));
const SiteEngineerDashboard = lazy(() => import('./pages/engineer/SiteEngineerDashboard'));

/** Send logged-in users straight to their dashboard; everyone else sees Landing. */
function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={dashboardPath(user.role)} replace /> : <Landing />;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/app/manager"
        element={
          <ProtectedRoute role="manager">
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/stock"
        element={
          <ProtectedRoute role="stock_handler">
            <StockDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/vendor"
        element={
          <ProtectedRoute role="vendor">
            <VendorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/engineer"
        element={
          <ProtectedRoute role="site_engineer">
            <SiteEngineerDashboard />
          </ProtectedRoute>
        }
      />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
