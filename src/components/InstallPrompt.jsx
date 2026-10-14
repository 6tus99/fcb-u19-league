import React, { useEffect, useRef, useState } from 'react';
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
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';

const isIOSDevice = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true);

/**
 * PWA install nudge for phones.
 *  - New Chrome (Android): uses the native install prompt
 *    (beforeinstallprompt) — one tap and it installs.
 *  - Older Chrome / iOS / anything that never fires that event:
 *    the pill still appears after a few seconds and shows the
 *    manual steps (Share -> Add to Home Screen on iOS,
 *    menu -> Install app on Android).
 * Only shows on narrow screens, never when the app is already
 * installed, and can be dismissed forever.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const deferredRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMode, setHelpMode] = useState('ios');
  const [fallback, setFallback] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('fcb-install-dismissed') === '1'
  );

  useEffect(() => {
    if (isStandalone()) return; // already running as the installed app

    const onPrompt = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const mq = window.matchMedia('(max-width: 900px)');
    setNarrow(mq.matches);
    const onChange = (ev) => setNarrow(ev.matches);
    mq.addEventListener('change', onChange);

    // Browsers that never fire the install event (old Chrome on
    // Android Go, iOS Safari, ...): show the manual-steps pill instead.
    const t = window.setTimeout(() => {
      if (!deferredRef.current && !isStandalone()) setFallback(true);
    }, 6000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      mq.removeEventListener('change', onChange);
      window.clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem('fcb-install-dismissed', '1');
    setDismissed(true);
  };

  if (dismissed || !narrow || isStandalone()) return null;
  if (!deferred && !fallback) return null;

  const onInstall = () => {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice
        .then((choice) => {
          if (choice.outcome === 'accepted') {
            setDeferred(null);
            setFallback(false);
          }
        })
        .catch(() => {});
    } else {
      setHelpMode(isIOSDevice() ? 'ios' : 'android');
      setHelpOpen(true);
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

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {helpMode === 'ios' ? 'Install on iPhone / iPad' : 'Install on Android'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            {helpMode === 'ios' ? (
              <>
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
              </>
            ) : (
              <>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <MoreVertRounded color="primary" sx={{ mt: 0.25 }} />
                  <Typography>
                    In Chrome, tap the <b>three-dot menu (⋮)</b> at the top right.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Typography sx={{ fontWeight: 800, width: 24, textAlign: 'center' }}>2</Typography>
                  <Typography>
                    Choose <b>“Install app”</b> (on some phones it says <b>“Add to Home screen”</b>).
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Typography sx={{ fontWeight: 800, width: 24, textAlign: 'center' }}>3</Typography>
                  <Typography>
                    Tap <b>Install</b> — the FCB U19 icon now lives on your home screen, opens full
                    screen, and works even with weak data.
                  </Typography>
                </Box>
                <Box sx={{ mt: 0.5, p: 1.25, borderRadius: 2, bgcolor: 'rgba(30,58,138,0.08)' }}>
                  <Typography variant="body2" color="text.secondary">
                    No “Install app” in the menu? Make sure you're using <b>Chrome</b> (updated from
                    the Play Store) and that the phone has a few GB of free storage — both are
                    required to install apps from the web.
                  </Typography>
                </Box>
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)} variant="contained" sx={{ fontWeight: 800 }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
