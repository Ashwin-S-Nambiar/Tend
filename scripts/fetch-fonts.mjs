import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

const families = [
  ['Gabarito', 'wght@500..900', 'gabarito'],
  ['Rethink Sans', 'wght@400..800', 'rethinksans'],
];

const out = 'public/fonts';
await mkdir(out, { recursive: true });
const faces = [];

for (const [family, axes, dir] of families) {
  const slug = family.toLowerCase().replaceAll(' ', '-');
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:${axes}&display=swap`,
      { headers: { 'user-agent': UA } },
    )
  ).text();
  for (const block of css.split('/* ').slice(1)) {
    const subset = block.slice(0, block.indexOf(' */'));
    if (subset !== 'latin' && subset !== 'latin-ext') continue;
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    const range = block.match(/unicode-range: ([^;]+);/)?.[1];
    const weight = block.match(/font-weight: ([^;]+);/)?.[1];
    if (!url || !range || !weight) continue;
    const file = `${slug}-${subset}.woff2`;
    const res = await fetch(url);
    await writeFile(join(out, file), Buffer.from(await res.arrayBuffer()));
    faces.push({ family, file, range, weight });
  }
  const ofl = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/OFL.txt`,
  );
  if (ofl.ok) await writeFile(join(out, `${slug}-OFL.txt`), await ofl.text());
  else console.warn(`no OFL for ${family}`);
}

await writeFile('scripts/faces.json', JSON.stringify(faces, null, 2));
console.log(faces.map((f) => `${f.file} ${f.weight}`).join('\n'));
