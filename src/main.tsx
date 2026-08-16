/**
 * @file main.tsx
 * @description Application entry point.
 *
 * Initializes i18next before mounting the React tree so that all
 * components have access to translations on first render.
 *
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// i18n must be imported before App so translations are ready on mount.
import './i18n/index';

import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
