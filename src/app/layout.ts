import { createContext, useContext } from 'react';
import { useMedia } from '../lib/hooks.ts';

export type Mode = 'phone' | 'land' | 'tab' | 'lap' | 'desk';

export function useMode(): Mode {
  const land = useMedia('(orientation: landscape) and (max-height: 500px)');
  const desk = useMedia('(min-width: 1440px)');
  const lap = useMedia('(min-width: 1024px)');
  const tab = useMedia('(min-width: 600px)');
  if (land) return 'land';
  if (desk) return 'desk';
  if (lap) return 'lap';
  if (tab) return 'tab';
  return 'phone';
}

export const ModeContext = createContext<Mode>('phone');

export const useLayout = () => {
  const mode = useContext(ModeContext);
  return {
    mode,
    panel: mode === 'lap' || mode === 'desk',
    wide: mode !== 'phone' && mode !== 'land',
  };
};
