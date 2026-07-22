import { useEffect, useRef, useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { lookupByIsbn } from '@/services/metadata/openLibraryService';
import type { SearchResult } from '@/services/metadata/openLibraryService';

interface IsbnScanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Same signature as MetadataSearch's onFill — the scan result is
   * handed off identically, so EntryForm doesn't need to know or care
   * whether a field came from typing a search or scanning a barcode. */
  onFill: (title: string, fields: Record<string, string>, genres?: string[]) => void;
}

type ScanPhase = 'scanning' | 'looking-up' | 'found' | 'not-found' | 'camera-denied';

/** How often to run detection against the live video frame. Faster
 * than this wastes CPU/battery for no real benefit — barcodes don't
 * move fast enough on screen to need it, and BarcodeDetector.detect()
 * itself isn't free. */
const DETECT_INTERVAL_MS = 300;

/** Only treat a detected EAN-13 as an ISBN if it starts with the
 * actual ISBN prefix range — avoids false-positive lookups from
 * unrelated EAN-13 barcodes that happen to be in frame (see chat). */
function isIsbnPrefix(value: string): boolean {
  return value.startsWith('978') || value.startsWith('979');
}

export function IsbnScanDialog({ open, onClose, onFill }: IsbnScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [scannedIsbn, setScannedIsbn] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback(async (isbn: string) => {
    stopCamera();
    setScannedIsbn(isbn);
    setPhase('looking-up');
    try {
      const found = await lookupByIsbn(isbn);
      if (found) {
        setResult(found);
        setPhase('found');
      } else {
        setPhase('not-found');
      }
    } catch {
      setPhase('not-found');
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setPhase('scanning');
    setResult(null);
    setScannedIsbn(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current ??= new BarcodeDetector({ formats: ['ean_13'] });

      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) return;
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          const isbnMatch = barcodes.find((b) => isIsbnPrefix(b.rawValue));
          if (isbnMatch) void handleDetected(isbnMatch.rawValue);
        } catch {
          // Transient detect() failures (e.g. a frame mid-transition)
          // are expected and safely ignored — the next tick retries.
        }
      }, DETECT_INTERVAL_MS);
    } catch {
      setPhase('camera-denied');
    }
  }, [handleDetected]);

  useEffect(() => {
    (async () => {
      if (open) await startCamera();
      else stopCamera();
    })();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUseResult = () => {
    if (!result) return;
    onFill(result.title, result.fields, result.genres);
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Scan barcode</DialogTitle>
      <DialogContent>
        {phase === 'scanning' && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Point at the ISBN barcode on the back cover
            </Typography>
            <Box
              sx={{
                position: 'relative',
                bgcolor: 'black',
                borderRadius: 2,
                height: 280,
                overflow: 'hidden',
              }}
            >
              <Box
                component="video"
                ref={videoRef}
                muted
                playsInline
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 200,
                  height: 110,
                  border: '2px solid',
                  borderColor: 'primary.main',
                  borderRadius: 1,
                  pointerEvents: 'none',
                }}
              />
            </Box>
          </Stack>
        )}

        {phase === 'looking-up' && (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Looking up {scannedIsbn}…
            </Typography>
          </Stack>
        )}

        {phase === 'found' && result && (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <Alert severity="success" variant="outlined" sx={{ width: '100%' }}>
              ISBN recognised — {scannedIsbn}
            </Alert>
            <Typography variant="body1" fontWeight={600}>
              {result.title}
            </Typography>
            {result.subtitle && (
              <Typography variant="body2" color="text.secondary">
                {result.subtitle}
              </Typography>
            )}
          </Stack>
        )}

        {phase === 'not-found' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Read the barcode ({scannedIsbn}), but couldn't find a match in Open Library. This can
              happen with single comic issues (which use a different barcode type) or less common
              editions.
            </Alert>
          </Stack>
        )}

        {phase === 'camera-denied' && (
          <Alert severity="info" variant="outlined">
            Camera access is needed to scan — you can also enter details manually below.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {phase === 'scanning' && <Button onClick={handleClose}>Cancel</Button>}
        {phase === 'found' && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleUseResult}>
              Use this
            </Button>
          </>
        )}
        {phase === 'not-found' && (
          <>
            <Button onClick={handleClose}>Enter manually instead</Button>
            <Button variant="contained" onClick={() => void startCamera()}>
              Scan again
            </Button>
          </>
        )}
        {phase === 'camera-denied' && <Button onClick={handleClose}>Close</Button>}
      </DialogActions>
    </Dialog>
  );
}
