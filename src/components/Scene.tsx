import type { Scene as SceneName } from '../lib/types.ts';

const STARS = [
  [8, 22, 1.2],
  [22, 58, 0.9],
  [34, 14, 1],
  [47, 40, 0.8],
  [58, 70, 1.1],
  [66, 18, 0.9],
  [79, 52, 1.2],
  [91, 30, 0.8],
  [14, 82, 0.8],
  [72, 86, 0.9],
] as const;

export function SceneArt({
  scene,
  className = '',
}: {
  scene: SceneName;
  className?: string;
}) {
  return (
    <div className={`scene ${className}`} data-scene={scene} aria-hidden="true">
      {scene === 'night' && (
        <div className="stars">
          {[0, 1].map((i) => (
            <svg
              key={i}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {STARS.map(([x, y, r]) => (
                <ellipse
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  rx={r * 0.55}
                  ry={r}
                  fill="var(--star)"
                />
              ))}
            </svg>
          ))}
        </div>
      )}
      <span className="orb" />
      <svg
        className="hills"
        viewBox="0 0 300 80"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 46 Q 80 6 160 40 T 300 30 V80 H0Z" />
      </svg>
    </div>
  );
}

export function SceneIcon({
  scene,
  size = 26,
}: {
  scene: SceneName;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      {scene === 'morning' && (
        <>
          <circle cx="13" cy="15" r="7" fill="var(--sun)" />
          <path
            d="M3 21 Q 13 15 23 21"
            stroke="var(--sun)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
      {scene === 'afternoon' && (
        <circle cx="13" cy="13" r="9" fill="var(--noon)" />
      )}
      {scene === 'evening' && (
        <path d="M3 18a10 10 0 0 1 20 0Z" fill="var(--dusk)" />
      )}
      {scene === 'night' && (
        <path d="M17 4a9 9 0 1 0 5 15A8 8 0 0 1 17 4Z" fill="var(--star)" />
      )}
    </svg>
  );
}
