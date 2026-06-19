import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import './styles/index.css';

// Minimal path-based routing — avoids pulling in a router dependency for the
// single static /privacy page. The server's SPA fallback serves index.html for
// any path, so a normal <a href="/privacy"> works.
const path = window.location.pathname.replace(/\/+$/, '');
const Root = path === '/privacy' ? PrivacyPolicy : App;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
