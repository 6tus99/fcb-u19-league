import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Records audio from the microphone in the browser.
 * Returns:
 *  - recording, seconds  — live state for the UI (timer, red dot)
 *  - blob                — the finished clip (null until a recording is done)
 *  - start / stop / cancel / clearBlob
 * Throws from start() if the microphone is blocked or unsupported.
 */
export default function useVoiceRecorder(maxSeconds = 60) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const start = useCallback(async () => {
    if (recRef.current && recRef.current.state !== 'inactive') return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recRef.current = rec;
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      setBlob(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      setRecording(false);
      cleanup();
    };
    setSeconds(0);
    setBlob(null);
    setRecording(true);
    rec.start(250);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= maxSeconds) {
          if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
          return s + 1;
        }
        return s + 1;
      });
    }, 1000);
  }, [maxSeconds]);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    setRecording(false);
  }, []);

  const cancel = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.onstop = null;
      recRef.current.stop();
    }
    cleanup();
    setRecording(false);
    setBlob(null);
    setSeconds(0);
  }, []);

  const clearBlob = useCallback(() => {
    setBlob(null);
    setSeconds(0);
  }, []);

  useEffect(() => () => cleanup(), []);

  return { recording, seconds, blob, start, stop, cancel, clearBlob };
}
