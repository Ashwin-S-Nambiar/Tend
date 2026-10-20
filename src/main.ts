import './site.css';
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

type Release = { assets?: { name: string; browser_download_url: string }[] };

// The apk is named for its version, so ask GitHub which one is latest. Until then, or if it fails,
// the buttons open the latest release page.
fetch('https://api.github.com/repos/Ashwin-S-Nambiar/Tend/releases/latest')
  .then((r) => (r.ok ? (r.json() as Promise<Release>) : null))
  .then((release) => {
    const apk = release?.assets?.find((a) => a.name.endsWith('.apk'));
    if (!apk) return;
    const links =
      document.querySelectorAll<HTMLAnchorElement>('[data-download]');
    for (const a of links) {
      a.href = apk.browser_download_url;
    }
  })
  .catch(() => {});
