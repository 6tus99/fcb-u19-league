import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import BrightnessAutoRounded from '@mui/icons-material/BrightnessAutoRounded';
import { useThemeMode } from '../context/ThemeContext';

const OPTIONS = [
  { id: 'system', label: 'Match device', icon: <BrightnessAutoRounded /> },
  { id: 'light', label: 'Light', icon: <LightModeRounded /> },
  { id: 'dark', label: 'Dark', icon: <DarkModeRounded /> },
];

export default function ThemeToggleFloat() {
  const { choice, setChoice } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState(null);
  const active = OPTIONS.find((o) => o.id === choice) || OPTIONS[0];

  return (
    <>
      <Box sx={{ position: 'fixed', top: 12, right: 12, zIndex: 1200 }}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Theme settings"
          title={`Theme: ${active.label}`}
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'cardBorder',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'tint' },
          }}
        >
          {active.icon}
        </IconButton>
      </Box>
      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { borderRadius: 2.5, border: '1px solid', borderColor: 'cardBorder' } } }}
      >
        {OPTIONS.map((o) => (
          <MenuItem
            key={o.id}
            selected={o.id === choice}
            onClick={() => {
              setChoice(o.id);
              setAnchorEl(null);
            }}
            sx={{ gap: 1.5, minWidth: 170 }}
          >
            {o.icon}
            <Typography sx={{ fontWeight: o.id === choice ? 800 : 600 }}>{o.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
