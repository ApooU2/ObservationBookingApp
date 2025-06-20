import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Targeted extension error suppression
window.addEventListener('error', (event) => {
  if (event.filename && (
    event.filename.includes('chrome-extension://') ||
    event.filename.includes('egjidjbpglichdcondbcbdnbeeppgdph')
  )) {
    console.warn('[Extension Error Suppressed]:', event.message);
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.stack && (
    event.reason.stack.includes('chrome-extension://') ||
    event.reason.stack.includes('egjidjbpglichdcondbcbdnbeeppgdph')
  )) {
    console.warn('[Extension Promise Rejection Suppressed]:', event.reason.message);
    event.preventDefault();
    return false;
  }
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
