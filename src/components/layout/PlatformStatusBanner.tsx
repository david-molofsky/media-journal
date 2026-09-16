import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { checkStorageHealth, requestPersistentStorage } from '@/pwa/storageHealth';

const STORAGE_WARNING_RATIO = 0.8;

export function PlatformStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usageRatio, setUsageRatio] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    void checkStorageHealth().then((health) => {
      setPersisted(health.persisted);
      setUsageRatio(health.usageRatio);
    });
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const storageNearlyFull = usageRatio !== null && usageRatio >= STORAGE_WARNING_RATIO;
  const storageAtRisk = persisted === false;

  return (
    <Stack
      spacing={1}
      sx={{ mb: !online || (!dismissed && storageAtRisk) || storageNearlyFull ? 2 : 0 }}
    >
      {!online && (
        <Alert severity="info">
          You’re offline. Your journal remains available on this device.
        </Alert>
      )}
      {!dismissed && (storageAtRisk || storageNearlyFull) && (
        <Alert
          severity={storageNearlyFull ? 'warning' : 'info'}
          onClose={() => setDismissed(true)}
          action={
            storageAtRisk ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  void requestPersistentStorage().then(setPersisted);
                }}
              >
                Protect
              </Button>
            ) : undefined
          }
        >
          {storageNearlyFull
            ? 'Device storage is nearly full. Export a backup and free some space.'
            : 'Allow durable storage to reduce the chance of this device clearing journal data.'}
        </Alert>
      )}
    </Stack>
  );
}
