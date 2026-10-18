import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { load } from './lib/db.ts';
import { checkPush, replan } from './lib/push.ts';
import { initTips } from './lib/tip.ts';

const type = new URLSearchParams(location.search).get('type');
if (type === 'a' || type === 'b' || type === 'c') {
  try {
    sessionStorage.setItem('tend:type', type);
  } catch {}
}
try {
  const t = sessionStorage.getItem('tend:type');
  if (t) document.documentElement.dataset.type = t;
} catch {}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

initTips();

load().then(() => {
  replan();
  const reveal = () =>
    requestAnimationFrame(() =>
      document.documentElement.classList.add('ready'),
    );
  Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 600)),
  ]).then(reveal);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => checkPush())
      .catch(() => {});
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'logged') load();
    if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
      history.pushState(
        { depth: Number(history.state?.depth ?? 0) + 1 },
        '',
        e.data.url,
      );
      dispatchEvent(new PopStateEvent('popstate'));
    }
  });
} else checkPush();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) load().then(replan);
});
