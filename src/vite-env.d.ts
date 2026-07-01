/// <reference types="vite/client" />

// Minimal type shim for the Google Identity Services library loaded via
// the <script src="https://accounts.google.com/gsi/client"> tag in
// index.html. Only the subset used by googleDriveService.ts is declared.
interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: {
            access_token: string;
            expires_in: number;
            error?: string;
            error_description?: string;
          }) => void;
        }) => {
          requestAccessToken: (override?: { prompt?: string }) => void;
        };
      };
    };
  };
}
