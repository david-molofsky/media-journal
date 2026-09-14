import dayjs from 'dayjs';
import { exportLibrary } from '@/services/importExport/importExportService';
import { downloadJson } from '@/utils/downloadJson';

/**
 * Downloads a complete copy of the current journal immediately before
 * a destructive Replace restore. The restore must not continue if
 * building the safety copy fails.
 */
export async function downloadPreRestoreBackup(): Promise<string> {
  const payload = await exportLibrary();
  const filename =
    `media-journal-before-restore-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;

  downloadJson(payload, filename);
  return filename;
}
