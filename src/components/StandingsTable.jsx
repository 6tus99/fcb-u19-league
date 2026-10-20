import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import { useMediaQuery, useTheme } from '@mui/material';

const MINE_BG = 'rgba(74,222,128,0.12)';
const MINE_EDGE = '3px solid #4ade80';
const FIRST_BG = 'rgba(250,204,21,0.08)';
const SECOND_BG = 'rgba(203,213,225,0.05)';

export default function StandingsTable({ rows, myTeamId }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const isMineOf = (r) => Boolean(myTeamId) && r.team.id === myTeamId;

  // Small screens: a compact list with the full data, no horizontal
  // scrolling needed.
  if (isMobile) {
    return (
      <Box>
        {rows.map((r, i) => {
          const isMine = isMineOf(r);
          return (
            <Box
              key={r.team.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1,
                py: 1.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                borderLeft: isMine ? MINE_EDGE : '3px solid transparent',
                bgcolor: isMine ? MINE_BG : i === 0 ? FIRST_BG : i === 1 ? SECOND_BG : 'transparent',
              }}
            >
              <Typography
                sx={{
                  width: 24,
                  textAlign: 'center',
                  fontWeight: 800,
                  color: i === 0 ? 'secondary.main' : 'text.secondary',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </Typography>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: r.team.primary_color,
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {r.team.name}
                  </Typography>
                  {isMine && (
                    <Typography
                      sx={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        color: '#4ade80',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        flexShrink: 0,
                      }}
                    >
                      your team
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {r.P}P • {r.W}W {r.D}D {r.L}L • {r.GF}:{r.GA}
                  {r.GD > 0 ? ` (+${r.GD})` : ` (${r.GD})`}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, color: 'primary.main', fontSize: 17, flexShrink: 0 }}>
                {r.Pts}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  }

  // Larger screens: the full table.
  const header = ['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'];
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 620 }}>
        <TableHead>
          <TableRow>
            {header.map((h) => (
              <TableCell key={h} align={h === 'Team' ? 'left' : 'center'} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => {
            const isMine = isMineOf(r);
            return (
            <TableRow
              key={r.team.id}
              hover
              sx={
                isMine
                  ? { bgcolor: MINE_BG, borderLeft: MINE_EDGE }
                  : i === 0
                    ? { bgcolor: FIRST_BG }
                    : i === 1
                      ? { bgcolor: SECOND_BG }
                      : undefined
              }
            >
              <TableCell align="center" sx={{ fontWeight: 800, color: i === 0 ? 'secondary.main' : 'inherit' }}>
                {i + 1}
              </TableCell>
              <TableCell>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: r.team.primary_color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{r.team.name}</span>
                  {isMine && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#4ade80',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      your team
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell align="center">{r.P}</TableCell>
              <TableCell align="center">{r.W}</TableCell>
              <TableCell align="center">{r.D}</TableCell>
              <TableCell align="center">{r.L}</TableCell>
              <TableCell align="center">{r.GF}</TableCell>
              <TableCell align="center">{r.GA}</TableCell>
              <TableCell align="center">{r.GD > 0 ? `+${r.GD}` : r.GD}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: 'primary.main' }}>
                {r.Pts}
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
