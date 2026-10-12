import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import StatTile from '../../components/StatTile';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import SportsEsportsRounded from '@mui/icons-material/SportsEsportsRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import { formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const PICKS = [
  { id: 'home', label: 'Home', col: 'home_odds' },
  { id: 'draw', label: 'Draw', col: 'draw_odds' },
  { id: 'away', label: 'Away', col: 'away_odds' },
];

export default function Bets() {
  const { profile: me } = useAuth();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [points, setPoints] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const [bettable, setBettable] = useState(true);
  const [pick, setPick] = useState({}); // matchId -> 'home'|'draw'|'away'
  const [stakes, setStakes] = useState({}); // matchId -> stake string
  const [placing, setPlacing] = useState(null);

  const load = useCallback(async () => {
    const [t, m, b, p] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*').eq('status', 'scheduled').order('scheduled_at'),
      supabase.from('bets').select('id, match_id, pick, odds, stake, status, payout, placed_at, settled_at').eq('user_id', me?.id).order('placed_at', { ascending: false }).limit(25),
      supabase.from('profiles').select('points').eq('id', me?.id).maybeSingle(),
    ]);
    if (b.error) {
      setBettable(false); // migration not run yet
    } else {
      setMyBets(b.data || []);
    }
    setTeams(t.data || []);
    setMatches(m.data || []);
    setPoints(p.data?.points ?? null);
    setLoaded(true);
  }, [me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'TBD';
  const openMatches = matches.filter((m) => m.home_odds || m.draw_odds || m.away_odds);

  const placeBet = async (m) => {
    const p = pick[m.id];
    const stake = Number(stakes[m.id] || 0);
    if (!p || !stake || stake < 1) return;
    const odds = Number(m[`${p}_odds`]);
    if (!odds) return;
    setPlacing(m.id);
    const { error } = await supabase
      .from('bets')
      .insert({ user_id: me.id, match_id: m.id, pick: p, odds, stake });
    setPlacing(null);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setMessage({ severity: 'success', text: `Bet placed: ${p.toUpperCase()} on ${teamName(m.home_team_id)} @ ${odds} for ${stake} points.` });
      setPick((prev) => ({ ...prev, [m.id]: null }));
      setStakes((prev) => ({ ...prev, [m.id]: '' }));
      load();
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading the betting board…" />;

  const myBetMatch = (bet) => matches.find((m) => m.id === bet.match_id);

  return (
    <div>
      <PageHeader
        title="Betting"
        subtitle="Virtual points only — for fun. No real money, ever."
      />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {!bettable ? (
        <GlassCard>
          <Alert severity="info" sx={{ m: 2 }}>
            The betting board is being set up — it will open as soon as the league admin
            publishes odds for the next matches.
          </Alert>
        </GlassCard>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StatTile
                icon={<AccountBalanceWalletRounded />}
                label="Your points"
                value={points == null ? '—' : points.toLocaleString()}
                sub="virtual points — start with 1,000"
                tone="green"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StatTile
                icon={<SportsEsportsRounded />}
                label="Open markets"
                value={openMatches.length}
                sub="matches with published odds"
                tone="blue"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <StatTile
                icon={<SportsEsportsRounded />}
                label="Your open bets"
                value={myBets.filter((b) => b.status === 'open').length}
                sub={`${myBets.filter((b) => b.status === 'won').length} won · ${myBets.filter((b) => b.status === 'lost').length} lost`}
                tone="amber"
              />
            </Grid>
          </Grid>

          <GlassCard title="Open markets" accent="red">
            {openMatches.length === 0 ? (
              <EmptyState message="No odds published yet. The league admin sets them on the Matches page — check back soon." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {openMatches.map((m) => {
                  const sel = pick[m.id];
                  const canPlace = sel && Number(stakes[m.id] || 0) >= 1;
                  return (
                    <Box
                      key={m.id}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: '1.5px solid',
                        borderColor: sel ? 'primary.main' : 'cardBorder',
                        bgcolor: 'background.paper',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 800 }}>
                          {teamName(m.home_team_id)} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>vs</Box> {teamName(m.away_team_id)}
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Week {m.week} · {formatDate(m.scheduled_at, true)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
                        {PICKS.map((p) => {
                          const odds = m[p.col];
                          const active = sel === p.id;
                          return (
                            <Button
                              key={p.id}
                              disabled={!odds}
                              onClick={() => setPick((prev) => ({ ...prev, [m.id]: active ? null : p.id }))}
                              sx={{
                                flexDirection: 'column',
                                height: 'auto',
                                py: 1,
                                borderRadius: 2,
                                border: '1.5px solid',
                                borderColor: active ? 'primary.main' : 'divider',
                                bgcolor: active ? 'rgba(22, 163, 74, 0.12)' : 'transparent',
                                fontWeight: 800,
                                color: odds ? 'inherit' : 'text.disabled',
                              }}
                            >
                              <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: active ? 'primary.main' : 'text.secondary' }}>
                                {p.label}
                              </Box>
                              <Box component="span" sx={{ fontSize: 18, fontWeight: 900 }}>
                                {odds ? odds.toFixed(2) : '—'}
                              </Box>
                            </Button>
                          );
                        })}
                      </Box>

                      {sel && (
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          <TextField
                            size="small"
                            label="Stake (points)"
                            type="number"
                            inputProps={{ min: 1, max: 10000, style: { width: 130 } }}
                            value={stakes[m.id] || ''}
                            onChange={(e) => setStakes((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          />
                          <Button
                            variant="contained"
                            disabled={!canPlace || placing === m.id}
                            onClick={() => placeBet(m)}
                          >
                            {placing === m.id ? 'Placing…' : `Bet ${sel.toUpperCase()} @ ${Number(m[`${sel}_odds`]).toFixed(2)}`}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </GlassCard>

          <GlassCard title={`My bets (${myBets.length})`} accent="blue">
            {myBets.length === 0 ? (
              <EmptyState message="No bets yet — pick a market above. It's all virtual points, so lose and learn freely." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {myBets.map((b) => {
                  const m = myBetMatch(b);
                  const label = m
                    ? `${b.pick === 'home' ? teamName(m.home_team_id) : b.pick === 'away' ? teamName(m.away_team_id) : 'Draw'} — ${teamName(m.home_team_id)} vs ${teamName(m.away_team_id)}`
                    : `Match ${b.pick}`;
                  return (
                    <Box
                      key={b.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flexWrap: 'wrap',
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Chip
                        label={b.status.toUpperCase()}
                        size="small"
                        color={b.status === 'won' ? 'success' : b.status === 'lost' ? 'error' : 'warning'}
                        sx={{ fontWeight: 800, fontSize: 11 }}
                      />
                      <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 180 }}>{label}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {b.stake} pts @ {Number(b.odds).toFixed(2)}
                      </Typography>
                      {b.status === 'won' && (
                        <Typography sx={{ fontWeight: 800, color: 'primary.main', whiteSpace: 'nowrap' }}>+{b.payout}</Typography>
                      )}
                      {b.status === 'lost' && (
                        <Typography sx={{ fontWeight: 800, color: 'error.main', whiteSpace: 'nowrap' }}>−{b.stake}</Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </GlassCard>

          <Alert severity="info">
            How it works: the league admin publishes odds per match. Pick a side, enter your
            stake and place the bet — points are deducted instantly. When the match is marked
            finished, bets settle automatically: winners receive <b>stake × odds</b> points and
            everyone gets a bell notification. All virtual, all for fun.
          </Alert>
        </Box>
      )}
    </div>
  );
}
