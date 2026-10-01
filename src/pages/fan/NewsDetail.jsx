import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function NewsDetail() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('news').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      setArticle(data);
      setLoaded(true);
    });
  }, [id]);

  if (!loaded) return <LoadingSpinner message="Loading article…" />;
  if (!article) return <EmptyState message="Article not found." />;

  return (
    <Box>
      <Link component={RouterLink} to="/news" variant="body2" sx={{ fontWeight: 600 }}>
        ← All news
      </Link>
      <Paper sx={{ mt: 1.5, p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'tint' }}>
        <Typography variant="h4">{article.title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          {formatDate(article.created_at)}
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{article.body}</Typography>
      </Paper>
    </Box>
  );
}
