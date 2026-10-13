import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';

const isIOSDevice = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * PWA install nudge for phones:
 *  - Android Chrome: uses the native install prompt (beforeinstallprompt).
 *  - iOS Safari: no native prompt exists, so a dialog explains the
 *    Share -> "Add to Home Screen" steps.
 * Shows only on narrow screens and can be dismissed forever.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('fcb-install-dismissed') === '1'
  );

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const mq = window.matchMedia('(max-width: 900px)');
    setNarrow(mq.matches);
    const onChange = (ev) => setNarrow(ev.matches);
    mq.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      mq.removeEventListener('change', onChange);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem('fcb-install-dismissed', '1');
    setDismissed(true);
  };

  if (dismissed || !narrow) return null;
  // iOS never fires beforeinstallprompt — still offer the how-to dialog.
  if (deferred === null && !isIOSDevice()) return null;

  const onInstall = () => {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') setDeferred(null);
      });
    } else {
      setIosHelp(true);
    }
  };

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 88,
          left: 16,
          right: 16,
          zIndex: 1250,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: 3,
          bgcolor: '#166534',
          color: '#fff',
          boxShadow: '0 10px 28px rgba(2,6,23,0.45)',
          border: '1px solid rgba(74,222,128,0.4)',
        }}
      >
        <DownloadRounded fontSize="small" sx={{ flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>
          Install FCB U19 — it works like an app on your phone
        </Typography>
        <Button
          onClick={onInstall}
          size="small"
          sx={{
            borderRadius: 999,
            fontWeight: 800,
            bgcolor: '#4ade80',
            color: '#052e16',
            '&:hover': { bgcolor: '#86efac' },
          }}
        >
          Install
        </Button>
        <IconButton size="small" onClick={dismiss} aria-label="Dismiss install suggestion" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </Box>

      <Dialog open={iosHelp} onClose={() => setIosHelp(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Install on iPhone / iPad</DialogTitle>
        <DialogContent>
          <Typography sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <ShareRounded color="primary" sx={{ mt: 0.25 }} />
              <Typography>
                Tap the <b>Share</b> button at the bottom of the screen (the square with an arrow).
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Typography sx={{ fontWeight: 800, width: 24, textAlign: 'center' }}>2</Typography>
              <Typography>
                Scroll down and choose <b>“Add to Home Screen”</b>.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Typography sx={{ fontWeight: 800, width: 24, textAlign: 'center' }}>3</Typography>
              <Typography>
                Tap <b>Add</b> — the FCB U19 icon now lives on your home screen, opens full
                screen, and works even with weak data.
              </Typography>
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosHelp(false)} variant="contained" sx={{ fontWeight: 800 }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
