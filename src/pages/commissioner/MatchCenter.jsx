import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import PageHeader from '../../components/PageHeader';
import LiveMatchControl from './LiveMatchControl';
import MatchReports from './MatchReports';
import ManageMatches from '../admin/ManageMatches';

// Match Center — the grouped entity for all match-related commissioner
// pages: fixtures (Matches), live control and reports. Each tab is its
// own URL so it can be shared / deep-linked.
export default function MatchCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const p = location.pathname;
  const value = p.startsWith('/commissioner/match-center/live')
    ? 1
    : p.startsWith('/commissioner/match-center/reports')
      ? 2
      : 0;

  const tabs = [
    { label: 'Matches', to: '/commissioner/match-center/matches', content: <ManageMatches /> },
    { label: 'Live Match', to: '/commissioner/match-center/live', content: <LiveMatchControl /> },
    { label: 'Reports', to: '/commissioner/match-center/reports', content: <MatchReports /> },
  ];

  return (
    <div>
      <PageHeader title="Match Center" subtitle="Fixtures, live control and reports — all in one place" />
      <Tabs
        value={value}
        onChange={(_, i) => navigate(tabs[i].to)}
        fullWidth
        sx={{
          mb: 3,
          bgcolor: 'tint',
          border: '1px solid',
          borderColor: 'cardBorder',
          borderRadius: 2.5,
          '& .MuiTab-root': { fontWeight: 700, minHeight: 44, minWidth: 0 },
        }}
      >
        {tabs.map((t) => (
          <Tab key={t.to} label={t.label} />
        ))}
      </Tabs>
      {tabs[value].content}
    </div>
  );
}
