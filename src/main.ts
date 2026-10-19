import './site.css';
import { readLegacy, save } from './backup.ts';
import { startPips } from './pip.ts';

startPips();

const bar = document.querySelector<HTMLElement>('.dock');
const heroCta = document.querySelector('#hero-cta');
if (bar && heroCta) {
  new IntersectionObserver(([e]) => {
    const show = !!e && !e.isIntersecting && e.boundingClientRect.top < 0;
    bar.toggleAttribute('data-on', show);
    bar.inert = !show;
  }).observe(heroCta);
}

const legacy = readLegacy();
const note = document.querySelector<HTMLElement>('#move-note');
const live = document.querySelector<HTMLElement>('#move-status');

async function saveBackup() {
  const b = await legacy;
  if (!live) return;
  if (!b) {
    live.textContent =
      'There are no Tend medicines in this browser. Open this page in the browser you used Tend in.';
    return;
  }
  save(b);
  note?.removeAttribute('data-on');
  live.textContent = `Saved ${b.meds.length} ${b.meds.length === 1 ? 'medicine' : 'medicines'} and ${b.logs.length} ${b.logs.length === 1 ? 'log' : 'logs'}. In Tend for Android, go to You, then Restore.`;
}

for (const b of document.querySelectorAll('[data-save-backup]'))
  b.addEventListener('click', saveBackup);

legacy.then((b) => {
  if (!b || !note) return;
  const count = note.querySelector('[data-count]');
  if (count)
    count.textContent = `${b.meds.length} ${b.meds.length === 1 ? 'medicine' : 'medicines'}`;
  note.hidden = false;
  requestAnimationFrame(() => note.setAttribute('data-on', ''));
  note
    .querySelector('[data-close]')
    ?.addEventListener('click', () => note.removeAttribute('data-on'));
});
