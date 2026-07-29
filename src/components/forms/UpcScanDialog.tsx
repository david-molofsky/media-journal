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
import { lookupFilmByUpc } from '@/services/metadata/upcmdbService';
import type { SearchResult } from '@/services/metadata/openLibraryService';
import { toUpc12 } from '@/utils/upcBarcode';

interface UpcScanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Same signature as MetadataSearch's / IsbnScanDialog's onFill — the
   * scan result is handed off identically, so EntryForm doesn't need to
   * know or care which source produced it. */
  onFill: (title: string, fields: Record<string, string>, genres?: string[]) => void;
}

type ScanPhase =
  | 'scanning'
  | 'looking-up'
  | 'found'
  | 'not-found'
  | 'tmdb-not-found'
  | 'service-error'
  | 'camera-denied';

/** Same interval as IsbnScanDialog — see its comment for reasoning. */
const DETECT_INTERVAL_MS = 300;

export function UpcScanDialog({ open, onClose, onFill }: UpcScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const detectorAltRef = useRef<BarcodeDetector | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [scannedUpc, setScannedUpc] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback(async (upc: string) => {
    stopCamera();
    setScannedUpc(upc);
    setPhase('looking-up');
    const outcome = await lookupFilmByUpc(upc);
    if (outcome.status === 'found') {
      setResult(outcome.result);
      setPhase('found');
    } else {
      setPhase(outcome.status);
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setPhase('scanning');
    setResult(null);
    setScannedUpc(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Two separate single-format detectors rather than one detector
      // constructed with `formats: ['upc_a', 'ean_13']` — on real
      // devices, requesting upc_a alongside another format silently
      // broke detection entirely (zero results for *either* format),
      // even though ean_13 alone (see IsbnScanDialog) works fine. This
      // matches a known class of Android barcode-engine quirk where
      // combined-format requests can misbehave even when each format
      // works individually.
      detectorRef.current ??= new BarcodeDetector({ formats: ['upc_a'] });
      detectorAltRef.current ??= new BarcodeDetector({ formats: ['ean_13'] });

      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current || !detectorAltRef.current) return;
        try {
          const [upcBarcodes, eanBarcodes] = await Promise.all([
            detectorRef.current.detect(videoRef.current),
            detectorAltRef.current.detect(videoRef.current),
          ]);
          for (const barcode of [...upcBarcodes, ...eanBarcodes]) {
            const upc = toUpc12(barcode);
            // Diagnostic aid for real-device UPC scan issues — safe to
            // leave in permanently, this only logs while the scan
            // dialog is actively open and scanning.
            console.debug('[UpcScanDialog] detected barcode', {
              format: barcode.format,
              rawValue: barcode.rawValue,
              accepted: Boolean(upc),
            });
            if (upc) {
              void handleDetected(upc);
              break;
            }
          }
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
              Point at the UPC barcode on the disc case
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
              Looking up {scannedUpc}…
            </Typography>
          </Stack>
        )}

        {phase === 'found' && result && (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <Alert severity="success" variant="outlined" sx={{ width: '100%' }}>
              UPC recognised — matched via IMDb
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
              Read the barcode ({scannedUpc}), but couldn't find a match in UPCMDB. This can happen
              with less common editions, box sets, or region variants.
            </Alert>
          </Stack>
        )}

        {phase === 'tmdb-not-found' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              UPCMDB matched this barcode, but the title couldn't be found on TMDB. This is rare —
              try entering it manually below instead.
            </Alert>
          </Stack>
        )}

        {phase === 'service-error' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Couldn't reach the lookup service just now. You can try again, or enter details
              manually below.
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
        {(phase === 'not-found' || phase === 'tmdb-not-found' || phase === 'service-error') && (
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
