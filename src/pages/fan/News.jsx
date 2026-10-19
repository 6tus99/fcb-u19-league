import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';
import useAutoRefresh from '../../hooks/useAutoRefresh';

export default function News() {
  const [articles, setArticles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    supabase.from('news').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setArticles(data || []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, 30000);

  if (!loaded) return <LoadingSpinner message="Loading news…" />;

  return (
    <div>
      <PageHeader title="League News" subtitle="Official announcements and league updates" />
      {articles.length === 0 ? (
        <EmptyState message="No news yet." />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {articles.map((n) => (
            <Card
              key={n.id}
              component={RouterLink}
              to={`/news/${n.id}`}
              sx={{
                bgcolor: 'tint',
                border: '1px solid', borderColor: 'cardBorder',
                '&:hover': { borderColor: 'rgba(74,222,128,0.45)' },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  {n.image_url && (
                    <Box
                      component="img"
                      src={n.image_url}
                      sx={{
                        width: 88,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 2,
                        flexShrink: 0,
                        border: '1px solid',
                        borderColor: 'cardBorder',
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6">{n.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                      {n.body}
                    </Typography>
                  </Box>
                </Box>
                {(n.video_url || n.poll_options?.length > 0) && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {n.video_url && <Chip label="▶ video" size="small" sx={{ fontWeight: 700 }} />}
                    {n.poll_options?.length > 0 && <Chip label="📊 poll" size="small" sx={{ fontWeight: 700 }} />}
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {formatDate(n.created_at)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </div>
  );
}
