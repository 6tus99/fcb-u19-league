import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';

const MINE_BG = 'rgba(74,222,128,0.12)';
const MINE_EDGE = '3px solid #4ade80';
const FIRST_BG = 'rgba(250,204,21,0.08)';
const SECOND_BG = 'rgba(203,213,225,0.05)';

// One table for every screen. The trimmed view (detailed={false}) shrinks
// its columns to fit the device width (down to ~320px, e.g. iPhone SE 2).
// The detailed view is Google-style: the position and team name stay
// pinned on the left while the stats columns scroll sideways.
export default function StandingsTable({ rows, myTeamId, detailed = true }) {
  const numCell = (w) => ({
    width: w,
    px: { xs: 0.25, sm: 1 },
    py: { xs: 0.6, sm: 1 },
    fontSize: { xs: 10.5, sm: 13.5 },
  });

  // The pinned (# and Team) cells need an opaque background that matches
  // their row, otherwise the columns scrolling underneath would show
  // through.
  const pinned = (left, i, isMine) => ({
    position: 'sticky',
    left,
    zIndex: 1,
    bgcolor: isMine ? MINE_BG : i === 0 ? FIRST_BG : i === 1 ? SECOND_BG : 'tint',
    borderRight: detailed ? '1px solid' : undefined,
    borderColor: 'divider',
  });

  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ tableLayout: 'fixed', width: '100%', ...(detailed ? { minWidth: 560 } : {}) }}>
        <TableHead>
          <TableRow>
            <TableCell align="center" sx={{ ...numCell(26), fontWeight: 800, ...(detailed ? { ...pinned(0, -1, false), bgcolor: 'tint', zIndex: 2 } : {}) }}>
              #
            </TableCell>
            <TableCell
              sx={{
                px: { xs: 0.5, sm: 1.5 },
                py: { xs: 0.6, sm: 1 },
                fontSize: { xs: 10.5, sm: 13.5 },
                fontWeight: 800,
                whiteSpace: 'nowrap',
                ...(detailed ? { ...pinned(26, -1, false), bgcolor: 'tint', zIndex: 2 } : {}),
              }}
            >
              Team
            </TableCell>
            <TableCell align="center" sx={{ ...numCell(22), fontWeight: 800 }}>
              P
            </TableCell>
            <TableCell align="center" sx={{ ...numCell(22), fontWeight: 800 }}>
              W
            </TableCell>
            <TableCell align="center" sx={{ ...numCell(22), fontWeight: 800 }}>
              D
            </TableCell>
            <TableCell align="center" sx={{ ...numCell(22), fontWeight: 800 }}>
              L
            </TableCell>
            {detailed && (
              <>
                <TableCell align="center" sx={{ ...numCell(24), fontWeight: 800 }}>
                  GF
                </TableCell>
                <TableCell align="center" sx={{ ...numCell(24), fontWeight: 800 }}>
                  GA
                </TableCell>
                <TableCell align="center" sx={{ ...numCell(26), fontWeight: 800 }}>
                  GD
                </TableCell>
              </>
            )}
            <TableCell align="center" sx={{ ...numCell(30), fontWeight: 800 }}>
              Pts
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => {
            const isMine = Boolean(myTeamId) && r.team.id === myTeamId;
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
                <TableCell
                  align="center"
                  sx={{
                    ...numCell(26),
                    fontWeight: 800,
                    color: i === 0 ? 'secondary.main' : 'inherit',
                    ...(detailed ? pinned(0, i, isMine) : {}),
                  }}
                >
                  {i + 1}
                </TableCell>
                <TableCell sx={{ px: { xs: 0.5, sm: 1.5 }, py: { xs: 0.6, sm: 1 }, ...(detailed ? pinned(26, i, isMine) : {}) }}>
                  <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: r.team.primary_color,
                        display: 'inline-block',
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: { xs: 10.5, sm: 13.5 },
                        lineHeight: 1.15,
                        wordBreak: 'break-word',
                      }}
                    >
                      {r.team.name}
                      {isMine && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 8.5,
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
                  </span>
                </TableCell>
                <TableCell align="center" sx={numCell(22)}>
                  {r.P}
                </TableCell>
                <TableCell align="center" sx={numCell(22)}>
                  {r.W}
                </TableCell>
                <TableCell align="center" sx={numCell(22)}>
                  {r.D}
                </TableCell>
                <TableCell align="center" sx={numCell(22)}>
                  {r.L}
                </TableCell>
                {detailed && (
                  <>
                    <TableCell align="center" sx={numCell(24)}>
                      {r.GF}
                    </TableCell>
                    <TableCell align="center" sx={numCell(24)}>
                      {r.GA}
                    </TableCell>
                    <TableCell align="center" sx={numCell(26)}>
                      {r.GD > 0 ? `+${r.GD}` : r.GD}
                    </TableCell>
                  </>
                )}
                <TableCell align="center" sx={{ ...numCell(30), fontWeight: 800, color: 'primary.main' }}>
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
