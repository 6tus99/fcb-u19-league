import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import Bets from './pages/fan/Bets';
import SocialFeed from './pages/social/SocialFeed';
import Messages from './pages/social/Messages';
import PlayerDashboard from './pages/player/PlayerDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import CommissionerDashboard from './pages/commissioner/CommissionerDashboard';
import MatchCenter from './pages/commissioner/MatchCenter';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageRequests from './pages/admin/ManageRequests';
import ManageTeams from './pages/admin/ManageTeams';
import ManageMatches from './pages/admin/ManageMatches';
import ManageNews from './pages/admin/ManageNews';
import ManageOfficials from './pages/admin/ManageOfficials';
import TeamMatches from './pages/team/TeamMatches';
import LeagueSettings from './pages/admin/LeagueSettings';
import InstallPrompt from './components/InstallPrompt';
import NotFound from './pages/NotFound';

function RoleHome() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return <LoadingSpinner message="Loading…" />;
  return <Navigate to={homeForRole(profile.role)} replace />;
}

// Old commissioner URLs keep working — they all live in Match Center now.
function OldLiveRedirect() {
  const { matchId } = useParams();
  return <Navigate to={`/commissioner/match-center/live${matchId ? `/${matchId}` : ''}`} replace />;
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
      <InstallPrompt />
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
          <Route path="/fan/betting" element={<Bets />} />
          <Route path="/social" element={<SocialFeed />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:userId" element={<Messages />} />
          <Route
            path="/editor/news"
            element={
              <ProtectedRoute roles={['editor', 'admin', 'commissioner']}>
                <ManageNews />
              </ProtectedRoute>
            }
          />

          {/* player */}
          <Route
            path="/player"
            element={
              <ProtectedRoute roles={['player']}>
                <PlayerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/player/matches"
            element={
              <ProtectedRoute roles={['player']}>
                <TeamMatches />
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
          <Route
            path="/manager/matches"
            element={
              <ProtectedRoute roles={['manager']}>
                <TeamMatches />
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
          {/* Match Center — fixtures, live control and reports in one place */}
          <Route
            path="/commissioner/match-center"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/match-center/matches"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/match-center/live"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/match-center/live/:matchId"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/match-center/reports"
            element={
              <ProtectedRoute roles={COMMISSIONER}>
                <MatchCenter />
              </ProtectedRoute>
            }
          />
          {/* Legacy URLs redirect into Match Center */}
          <Route path="/commissioner/live" element={<OldLiveRedirect />} />
          <Route path="/commissioner/live/:matchId" element={<OldLiveRedirect />} />
          <Route path="/commissioner/matches" element={<Navigate to="/commissioner/match-center/matches" replace />} />
          <Route path="/commissioner/events" element={<Navigate to="/commissioner/match-center/reports" replace />} />
          <Route path="/commissioner/reports" element={<Navigate to="/commissioner/match-center/reports" replace />} />

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
            path="/admin/requests"
            element={
              <ProtectedRoute roles={ADMIN}>
                <ManageRequests />
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
