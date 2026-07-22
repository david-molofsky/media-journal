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
import {
  lookupComicByUpc,
  resolveSeriesSelection,
  type RankedSeriesCandidate,
} from '@/services/metadata/upcitemdbService';
import type { SearchResult } from '@/services/metadata/openLibraryService';
import { toUpc12 } from '@/utils/upcBarcode';

interface ComicUpcScanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Same signature as every other search/scan source's onFill — see
   * IsbnScanDialog.tsx / UpcScanDialog.tsx. */
  onFill: (title: string, fields: Record<string, string>, genres?: string[]) => void;
}

type ScanPhase =
  | 'scanning'
  | 'looking-up'
  | 'found'
  | 'choose-series'
  | 'series-only'
  | 'not-found'
  | 'no-match'
  | 'service-error'
  | 'camera-denied';

/** Same interval as the other scan dialogs — see IsbnScanDialog.tsx. */
const DETECT_INTERVAL_MS = 300;

/** A resolved series (or series+issue) fill result carries a signal —
 * the presence of `issueStart` — for whether issue-level credits were
 * actually fetched (phase 'found') or only series/publisher (phase
 * 'series-only'). See resolveSeriesSelection in upcitemdbService.ts:
 * it only adds issueStart/issueEnd when getIssueDetails succeeded. */
function hasIssueDetails(result: SearchResult): boolean {
  return 'issueStart' in result.fields;
}

export function ComicUpcScanDialog({ open, onClose, onFill }: ComicUpcScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [scannedUpc, setScannedUpc] = useState<string | null>(null);
  const [rawTitle, setRawTitle] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [candidates, setCandidates] = useState<RankedSeriesCandidate[]>([]);
  const [pendingIssueNumber, setPendingIssueNumber] = useState<string | null>(null);

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

    const outcome = await lookupComicByUpc(upc);
    switch (outcome.status) {
      case 'not-found':
        setPhase('not-found');
        return;
      case 'service-error':
        setPhase('service-error');
        return;
      case 'no-match':
        setRawTitle(outcome.rawTitle);
        setPhase('no-match');
        return;
      case 'choose':
        setCandidates(outcome.candidates);
        setPendingIssueNumber(outcome.issueNumber);
        setPhase('choose-series');
        return;
      case 'auto': {
        const resolved = await resolveSeriesSelection(outcome.match, outcome.issueNumber);
        setResult(resolved);
        setPhase(hasIssueDetails(resolved) ? 'found' : 'series-only');
        return;
      }
    }
  }, [stopCamera]);

  const handleSelectCandidate = useCallback(async (candidate: SearchResult) => {
    setPhase('looking-up');
    const resolved = await resolveSeriesSelection(candidate, pendingIssueNumber);
    setResult(resolved);
    setPhase(hasIssueDetails(resolved) ? 'found' : 'series-only');
  }, [pendingIssueNumber]);

  const startCamera = useCallback(async () => {
    setPhase('scanning');
    setResult(null);
    setScannedUpc(null);
    setRawTitle(null);
    setCandidates([]);
    setPendingIssueNumber(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current ??= new BarcodeDetector({ formats: ['upc_a', 'ean_13'] });

      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) return;
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          for (const barcode of barcodes) {
            const upc = toUpc12(barcode);
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
      <DialogTitle>Scan issue barcode</DialogTitle>
      <DialogContent>
        {phase === 'scanning' && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Point at the UPC barcode on the cover or back page
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
              {scannedUpc ? `Looking up ${scannedUpc}…` : 'Fetching issue details…'}
            </Typography>
          </Stack>
        )}

        {phase === 'found' && result && (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <Alert severity="success" variant="outlined" sx={{ width: '100%' }}>
              Matched to a ComicVine series and issue
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

        {phase === 'series-only' && result && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Matched the series, but couldn't read an issue number off the barcode listing. Series
              and Publisher are filled in — enter the issue number after applying this, then use
              "Fetch issue details" as usual.
            </Alert>
            <Box>
              <Typography variant="body1" fontWeight={600}>
                {result.title}
              </Typography>
              {result.fields['publisher'] && (
                <Typography variant="body2" color="text.secondary">
                  {result.fields['publisher']}
                </Typography>
              )}
            </Box>
          </Stack>
        )}

        {phase === 'choose-series' && (
          <Stack spacing={1.5}>
            <Alert severity="info" variant="outlined">
              Found a barcode match, but a few ComicVine series look close. Which one is it?
            </Alert>
            <Stack spacing={1}>
              {candidates.map(({ result: candidate }) => (
                <Box
                  key={candidate.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {candidate.title}
                    </Typography>
                    {candidate.subtitle && (
                      <Typography variant="caption" color="text.secondary">
                        {candidate.subtitle}
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => void handleSelectCandidate(candidate)}
                  >
                    Select
                  </Button>
                </Box>
              ))}
            </Stack>
          </Stack>
        )}

        {phase === 'not-found' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Read the barcode ({scannedUpc}), but couldn't find a match in the product database.
              This can happen with less common or newer issues.
            </Alert>
          </Stack>
        )}

        {phase === 'no-match' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Read the barcode as "{rawTitle}" — but nothing close came up on ComicVine. This can
              happen with less common or newer listings. Try entering it manually below.
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
        {(phase === 'found' || phase === 'series-only') && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleUseResult}>
              Use this
            </Button>
          </>
        )}
        {phase === 'choose-series' && <Button onClick={handleClose}>Enter manually instead</Button>}
        {(phase === 'not-found' || phase === 'no-match' || phase === 'service-error') && (
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
