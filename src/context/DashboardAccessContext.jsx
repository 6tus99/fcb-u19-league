import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isDashboardPath } from '../utils/dashboardAccess';

const DashboardAccessContext = createContext(null);

export function DashboardAccessProvider({ children }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [grant, setGrant] = useState(null);
  const identity = user?.id && profile?.id === user.id ? `${user.id}:${profile.role}` : '';
  const inside = isDashboardPath(location.pathname);

  // Memory only: a reload/new tab must verify again. Leaving the restricted
  // area, logging out or changing account/role also revokes the visit grant.
  useEffect(() => {
    if (!inside || !identity) setGrant(null);
    else setGrant((current) => current === identity ? current : null);
  }, [inside, identity]);

  useEffect(() => {
    const lock = () => setGrant(null);
    const restore = (event) => { if (event.persisted) lock(); };
    window.addEventListener('pagehide', lock);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('pagehide', lock);
      window.removeEventListener('pageshow', restore);
    };
  }, []);

  const unlock = useCallback((verifiedIdentity) => {
    if (inside && identity && verifiedIdentity === identity) setGrant(identity);
  }, [inside, identity]);
  const value = useMemo(() => ({
    identity, unlocked: Boolean(inside && identity && grant === identity), unlock,
  }), [inside, identity, grant, unlock]);

  return <DashboardAccessContext.Provider value={value}>{children}</DashboardAccessContext.Provider>;
}

export function useDashboardAccess() {
  const value = useContext(DashboardAccessContext);
  if (!value) throw new Error('Dashboard access provider is missing.');
  return value;
}
