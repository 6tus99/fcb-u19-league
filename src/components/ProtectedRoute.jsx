import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export function homeForRole(role) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'commissioner':
      return '/commissioner';
    case 'manager':
      return '/manager';
    case 'player':
      return '/player';
    default:
      return '/fan';
  }
}

export default function ProtectedRoute({ roles, children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingSpinner message="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <LoadingSpinner message="Loading your profile…" />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={homeForRole(profile.role)} replace />;
  return children;
}
