import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { AuthProvider, useAuth } from './context/AuthContext';
import SetupScreen from './components/SetupScreen';
import LoadingSpinner from './components/LoadingSpinner';
import AppLayout from './components/AppLayout';
import ProtectedRoute, { homeForRole } from './components/ProtectedRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import FanDashboard from './pages/fan/FanDashboard';
import Matches from './pages/fan/Matches';
import MatchDetail from './pages/fan/MatchDetail';
import Standings from './pages/fan/Standings';
import Teams from './pages/fan/Teams';
import TeamDetail from './pages/fan/TeamDetail';
import News from './pages/fan/News';
import NewsDetail from './pages/fan/NewsDetail';
import PlayerDashboard from './pages/player/PlayerDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import CommissionerDashboard from './pages/commissioner/CommissionerDashboard';
import LiveMatchControl from './pages/commissioner/LiveMatchControl';
import MatchEvents from './pages/commissioner/MatchEvents';
import MatchReports from './pages/commissioner/MatchReports';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageTeams from './pages/admin/ManageTeams';
import ManageMatches from './pages/admin/ManageMatches';
import ManageNews from './pages/admin/ManageNews';
import ManageOfficials from './pages/admin/ManageOfficials';
import LeagueSettings from './pages/admin/LeagueSettings';
import NotFound from './pages/NotFound';

function RoleHome() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return <LoadingSpinner message="Loading…" />;
  return <Navigate to={homeForRole(profile.role)} replace />;
}

function AuthedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

const ADMIN = ['admin'];
const COMMISSIONER = ['commissioner', 'admin'];

export default function App() {
  if (!isConfigured) return <SetupScreen />;

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<AuthedLayout />}>
          <Route path="/" element={<RoleHome />} />

          {/* shared / fan area */}
          <Route path="/fan" element={<FanDashboard />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<NewsDetail />} />

          {/* player */}
          <Route
            path="/player"
            element={
              <ProtectedRoute roles={['player']}>
                <PlayerDashboard />
              </ProtectedRoute>
            }
          />

          {/* manager */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute roles={['manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />

          {/* commissioner */}
          <Route
            path="/commissioner"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <CommissionerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/live"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <LiveMatchControl />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/live/:matchId"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <LiveMatchControl />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/events"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchEvents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/reports"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchReports />
              </ProtectedRoute>
            }
          />

          {/* admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={ADMIN}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={ADMIN}>
                <ManageUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/teams"
            element={
              <ProtectedRoute roles={ADMIN}>
                <ManageTeams />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/matches"
            element={
              <ProtectedRoute roles={ADMIN}>
                <ManageMatches />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/news"
            element={
              <ProtectedRoute roles={ADMIN}>
                <ManageNews />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/officials"
            element={
              <ProtectedRoute roles={ADMIN}>
                <ManageOfficials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute roles={ADMIN}>
                <LeagueSettings />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
