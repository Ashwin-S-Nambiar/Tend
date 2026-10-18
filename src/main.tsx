import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { load } from './lib/db.ts';
import { checkPush, replan, watchPermission } from './lib/push.ts';
import { initTips } from './lib/tip.ts';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

initTips();
watchPermission();

const loaded = load().then(replan);
const standalone = document.documentElement.classList.contains('standalone');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hold = standalone
  ? new Promise((r) => setTimeout(r, still ? 300 : 1250))
  : Promise.resolve();
Promise.race([
  Promise.all([
    loaded,
    hold,
    Promise.race([
      document.fonts.ready,
      new Promise((r) => setTimeout(r, 600)),
    ]),
  ]),
  new Promise((r) => setTimeout(r, 2500)),
]).then(() =>
  requestAnimationFrame(() => {
    const root = document.documentElement;
    root.classList.add('ready', 'splashed');
    setTimeout(() => document.getElementById('splash')?.remove(), 400);
  }),
);

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
