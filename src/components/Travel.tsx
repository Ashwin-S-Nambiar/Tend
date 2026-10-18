import { useId, useMemo } from 'react';
import { useNow } from '../lib/hooks.ts';
import { routinesStore, travelStore } from '../lib/settings.ts';
import { useStore } from '../lib/store.ts';
import {
  dayKey,
  deviceZone,
  dueKey,
  fmtHere,
  fmtTime,
  zoneGap,
  zoneName,
} from '../lib/time.ts';
import { dismissTravel, setTravel } from '../lib/travel.ts';
import Icon from './Icon.tsx';
import { Switch } from './ui.tsx';

function gapText(min: number) {
  const m = Math.abs(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const size = r === 0 ? `${h} h` : r === 30 ? `${h}½ h` : `${h} h ${r} min`;
  return `${size} ${min > 0 ? 'ahead of' : 'behind'}`;
}

export function useTravel() {
  const t = useStore(travelStore);
  useNow();
  const here = deviceZone();
  return {
    ...t,
    here,
    away: here !== t.home,
    keeping: t.mode === 'home' && here !== t.home,
  };
}

export function TravelCard() {
  const t = useTravel();
  const routines = useStore(routinesStore);
  if (!t.away || t.mode === 'home' || t.seen === t.here) return null;
  const home = zoneName(t.home);
  const here = zoneName(t.here);
  const breakfast =
    routines.find((r) => r.id === 'breakfast')?.weekday ?? '08:00';
  const gap = zoneGap(t.home, t.here);
  return (
    <section
      className="surface fade-in grid gap-3 rounded-[24px] p-4 shadow-(--shadow)"
      aria-labelledby="travel-h"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 flex-none place-items-center rounded-[14px] bg-dusk-wash text-ink">
          <Icon name="globe" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="travel-h" className="font-bold text-[17px] leading-snug">
            You're on {here} time
          </h2>
          <p className="text-[15px] text-soft leading-snug">
            {home} is {gapText(gap)} {here}. Doses now follow the clock here, so
            breakfast is {fmtTime(breakfast)} local. If a medicine needs a
            steady gap, like insulin or the pill, keep {home} time.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-soft btn-sm press min-h-12"
          onClick={() => dismissTravel()}
        >
          Follow {here} time
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm press min-h-12"
          onClick={() => setTravel('home')}
        >
          Keep {home} time
        </button>
      </div>
    </section>
  );
}

export function TravelChip() {
  const t = useTravel();
  const now = useNow();
  if (!t.keeping) return null;
  return (
    <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[14px] text-pip-ink">
      <Icon name="globe" size={16} />
      {zoneName(t.home)} time ·{' '}
      {new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(now)}{' '}
      here
    </p>
  );
}

export function hereSuffix(key: string, keeping: boolean) {
  return keeping ? `, ${fmtHere(key)} here` : '';
}

export function TravelSettings() {
  const t = useTravel();
  const id = useId();
  const routines = useStore(routinesStore);
  const zones = useMemo(() => {
    const all =
      (
        Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf?.('timeZone') ?? [];
    return [...new Set([t.home, t.here, ...all])].sort();
  }, [t.home, t.here]);
  const breakfast =
    routines.find((r) => r.id === 'breakfast')?.weekday ?? '08:00';
  const sample = dueKey(dayKey(), breakfast);
  return (
    <div className="grid gap-2">
      <Switch
        on={t.mode === 'home'}
        onChange={(v) => setTravel(v ? 'home' : 'local')}
        label="Keep home time when travelling"
        hint={
          t.mode === 'home'
            ? `Doses stay on ${zoneName(t.home)} time wherever you are`
            : 'Doses follow the clock wherever you are'
        }
        icon="globe"
      />
      {t.mode === 'home' && (
        <div className="grid gap-2 pl-13">
          <label htmlFor={`${id}-zone`} className="label">
            Home time zone
          </label>
          <select
            id={`${id}-zone`}
            className="field"
            value={t.home}
            onChange={(e) => setTravel('home', e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {t.away && (
            <p className="text-[14px] text-soft">
              Breakfast at {fmtTime(breakfast)} {zoneName(t.home)} time is{' '}
              {fmtHere(sample)} here.
            </p>
          )}
          {t.here !== t.home && (
            <button
              type="button"
              className="btn btn-soft btn-sm press justify-self-start"
              onClick={() => setTravel('home', t.here)}
            >
              Make {zoneName(t.here)} home
            </button>
          )}
        </div>
      )}
    </div>
  );
}
