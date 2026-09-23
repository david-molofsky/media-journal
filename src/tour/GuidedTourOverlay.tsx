import { useEffect, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useGuidedTour } from './GuidedTourContext';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 280;
const POLL_INTERVAL_MS = 250;

function measureTarget(targetId: string): SpotlightRect | null {
  const el = document.querySelector(`[data-tour-target="${targetId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

export function GuidedTourOverlay() {
  const {
    active,
    currentStep,
    nextStep,
    stepIndex,
    totalSteps,
    next,
    back,
    skipStep,
    endTour,
  } = useGuidedTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  // Measure (and re-measure on resize/scroll) the current step's
  // target. Ref/DOM reads only happen inside this effect, never
  // during render, per the React Compiler ref rule.
  useEffect(() => {
    (() => {
      if (!active || !currentStep || currentStep.centered || !currentStep.targetId) {
        setSpotlight(null);
        return;
      }
      const targetId = currentStep.targetId;
      const measure = () => setSpotlight(measureTarget(targetId));
      const timeout = setTimeout(measure, 120);
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
      return () => {
        clearTimeout(timeout);
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
      };
    })();
  }, [active, currentStep]);

  // Steps that require a real user action (e.g. tapping "Film")
  // auto-advance once the *next* step's target appears in the DOM,
  // rather than waiting for a Next click the tour can't itself supply.
  useEffect(() => {
    (() => {
      if (
        !active ||
        !currentStep?.autoAdvanceOnNextTargetAppears ||
        !nextStep?.targetId
      ) {
        return;
      }
      const targetId = nextStep.targetId;
      const interval = setInterval(() => {
        if (measureTarget(targetId)) {
          clearInterval(interval);
          next();
        }
      }, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    })();
  }, [active, currentStep, nextStep, next]);

  if (!active || !currentStep) return null;

  const isAutoAdvancing = Boolean(currentStep.autoAdvanceOnNextTargetAppears);
  const showSpotlight = Boolean(spotlight) && !currentStep.centered;

  const tooltipTop = spotlight
    ? Math.min(spotlight.top + spotlight.height + 12, window.innerHeight - 220)
    : undefined;
  const tooltipLeft = spotlight
    ? Math.max(12, Math.min(spotlight.left, window.innerWidth - TOOLTIP_WIDTH - 12))
    : undefined;

  return (
    <Backdrop
      open
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 10,
        backgroundColor: 'rgba(0,0,0,0.72)',
        alignItems: currentStep.centered || !spotlight ? 'center' : 'flex-start',
        justifyContent: 'center',
        // Let the app remain usable during spotlight steps. The tour cards
        // below opt back into pointer events so their controls still work.
        pointerEvents: currentStep.centered ? 'auto' : 'none',
      }}
    >
      {showSpotlight && spotlight && (
        <Box
          sx={{
            position: 'fixed',
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 2,
            boxShadow: (theme) => `0 0 0 4px ${theme.palette.primary.main}`,
            pointerEvents: 'none',
            transition: 'top 0.2s ease, left 0.2s ease',
          }}
        />
      )}

      {currentStep.centered || !spotlight ? (
        <Paper
          elevation={6}
          sx={{
            width: TOOLTIP_WIDTH + 20,
            p: 3,
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'primary.main',
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="h6" gutterBottom>
            {currentStep.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {currentStep.body}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
            {stepIndex === 0 ? (
              <>
                <Button color="inherit" onClick={endTour}>
                  Skip tour
                </Button>
                <Button variant="contained" onClick={next}>
                  Get started
                </Button>
              </>
            ) : currentStep.id === 'done' ? (
              <Button variant="contained" onClick={endTour}>
                Start exploring
              </Button>
            ) : (
              <Button variant="contained" onClick={next}>
                Next
              </Button>
            )}
          </Box>
        </Paper>
      ) : (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            top: tooltipTop,
            left: tooltipLeft,
            width: TOOLTIP_WIDTH,
            p: 2,
            border: '1px solid',
            borderColor: 'primary.main',
            pointerEvents: 'auto',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Step {stepIndex + 1} of {totalSteps}
            </Typography>
            <IconButton
              size="small"
              onClick={endTour}
              aria-label="End tour"
              sx={{ mt: -0.5, mr: -0.5 }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
            {currentStep.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            {currentStep.body}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5 }}>
            {renderProgressDots(stepIndex, totalSteps)}
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Button size="small" color="inherit" onClick={skipStep}>
              Skip
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {stepIndex > 0 && (
                <Button size="small" color="inherit" onClick={back}>
                  Back
                </Button>
              )}
              {!isAutoAdvancing && (
                <Button size="small" variant="contained" onClick={next}>
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      )}
    </Backdrop>
  );
}

function renderProgressDots(stepIndex: number, totalSteps: number) {
  return Array.from({ length: totalSteps }).map((_, i) => (
    <Box
      key={i}
      sx={{
        width: i === stepIndex ? 16 : 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: i === stepIndex ? 'primary.main' : 'action.disabled',
      }}
    />
  ));
}
