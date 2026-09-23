import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import {
  denyAnalyticsConsent,
  grantAnalyticsConsent,
  trackCurrentPageView,
} from '@/services/analytics/analyticsService';
import { useGuidedTour } from '@/tour/GuidedTourContext';

const CONSENT_KEY = 'mediaJournalAnalyticsConsent';

export function AnalyticsConsentPrompt() {
  const { active: tourActive } = useGuidedTour();
  const [open, setOpen] = useState(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    return consent !== 'granted' && consent !== 'denied';
  });

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);

    if (consent === 'granted') {
      grantAnalyticsConsent();
    } else if (consent === 'denied') {
      denyAnalyticsConsent();
    }
  }, []);

  const choose = (consent: 'granted' | 'denied') => {
    localStorage.setItem(CONSENT_KEY, consent);

    if (consent === 'granted') {
      grantAnalyticsConsent();
      trackCurrentPageView();
    } else {
      denyAnalyticsConsent();
    }

    setOpen(false);
  };

  return (
    <Dialog open={open && !tourActive}>
      <DialogTitle>Help improve Media Journal?</DialogTitle>

      <DialogContent>
        <DialogContentText>
          Allow anonymous usage analytics to help improve features and understand where
          people encounter problems. Media titles, ratings and personal journal data are
          never sent.
        </DialogContentText>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => choose('denied')}>No thanks</Button>

        <Button variant="contained" onClick={() => choose('granted')}>
          Allow analytics
        </Button>
      </DialogActions>
    </Dialog>
  );
}
