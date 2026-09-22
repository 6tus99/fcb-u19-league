import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';

export default function StandingsTable({ rows }) {
  const header = ['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'];
  return (
    <TableContainer>
      <Table size="small">
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
          {rows.map((r, i) => (
            <TableRow
              key={r.team.id}
              hover
              sx={
                i === 0
                  ? { bgcolor: 'rgba(250,204,21,0.08)' }
                  : i === 1
                    ? { bgcolor: 'rgba(203,213,225,0.05)' }
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
                      backgroundColor: r.team.color,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{r.team.name}</span>
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
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
