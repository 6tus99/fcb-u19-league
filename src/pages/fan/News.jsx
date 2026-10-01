import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function News() {
  const [articles, setArticles] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('news').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setArticles(data || []);
      setLoaded(true);
    });
  }, []);

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
                border: '1px solid', borderColor: 'divider',
                '&:hover': { borderColor: 'rgba(74,222,128,0.45)' },
              }}
            >
              <CardContent>
                <Typography variant="h6">{n.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                  {n.body}
                </Typography>
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
