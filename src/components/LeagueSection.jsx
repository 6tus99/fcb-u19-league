import React from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { leagueSection } from '../utils/navigationSections';

// Preserve existing fixture/team URLs (including notification deep links),
// while presenting all three pages as sections of Standings.
export default function LeagueSection() {
  const { pathname } = useLocation();
  return (
    <>
      <Tabs value={leagueSection(pathname)} variant="fullWidth" aria-label="Standings sections"
        sx={{ mb: 2, bgcolor: 'tint', border: '1px solid', borderColor: 'cardBorder', borderRadius: 2.5,
          '& .MuiTab-root': { minWidth: 0, minHeight: 44, px: 0.5, fontSize: { xs: 12, sm: 14 }, fontWeight: 800, color: 'primary.main' } }}>
        <Tab component={RouterLink} to="/standings" value="/standings" label="Table" />
        <Tab component={RouterLink} to="/matches" value="/matches" label="Matches" />
        <Tab component={RouterLink} to="/teams" value="/teams" label="Teams" />
      </Tabs>
      <Outlet />
    </>
  );
}
