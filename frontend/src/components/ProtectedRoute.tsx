import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { dashboardPath, type Role } from '../types';
import { Spinner } from './ui';

export function ProtectedRoute({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Logged in but wrong role -> bounce to their own dashboard.
  if (role && user.role !== role) return <Navigate to={dashboardPath(user.role)} replace />;

  return <>{children}</>;
}
