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
