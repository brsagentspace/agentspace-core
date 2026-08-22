/**
 * @file main.tsx
 * @description Application entry point.
 *
 * Initializes i18next before mounting the React tree so that all
 * components have access to translations on first render.
 *
 * @module main
 */

import ReactDOM from 'react-dom/client';

// i18n must be imported before App so translations are ready on mount.
import './i18n/index';

// Terminal font, bundled: xterm measures its cell grid from it at open(),
// so it must never arrive late (or not at all, offline) from a CDN.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { installCloseGuard } from './services/closeGuard';

// Confirm before Cmd+W kills running terminal sessions.
void installCloseGuard();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
