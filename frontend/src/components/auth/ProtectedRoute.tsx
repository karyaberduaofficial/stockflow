import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { RoleName } from '../../types';
import { ForbiddenPage } from '../../pages/ForbiddenPage';

interface ProtectedRouteProps {
  allowedRoles?: RoleName[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated } = useAuth();
  const { logForbiddenAttempt } = useStore();
  const location = useLocation();
  const lastLoggedKey = useRef<string>('');

  const isUnauthorized =
    isAuthenticated &&
    user &&
    user.role !== 'guest_pending' &&
    allowedRoles &&
    !allowedRoles.includes(user.role);

  useEffect(() => {
    if (isUnauthorized && user && allowedRoles) {
      const key = `${user.email}:${location.pathname}`;
      if (lastLoggedKey.current !== key) {
        lastLoggedKey.current = key;
        logForbiddenAttempt(user, location.pathname, allowedRoles);
      }
    }
  }, [isUnauthorized, user, location.pathname, allowedRoles, logForbiddenAttempt]);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Quarantine newly signed-in unapproved Google users strictly to /pending-approval
  if (user.role === 'guest_pending' || user.status === 'pending_approval') {
    if (location.pathname !== '/pending-approval') {
      return <Navigate to="/pending-approval" replace />;
    }
    return <>{children}</>;
  }

  if (isUnauthorized && allowedRoles) {
    return <ForbiddenPage attemptedPath={location.pathname} requiredRoles={allowedRoles} />;
  }

  return <>{children}</>;
};
