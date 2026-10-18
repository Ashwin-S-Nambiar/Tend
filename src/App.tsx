import { useEffect } from 'react';
import { ModeContext, useMode } from './app/layout.ts';
import { Rail, Sidebar, TabBar } from './app/Nav.tsx';
import { useShortcuts } from './app/shortcuts.ts';
import { useTheme } from './app/theme.ts';
import Toaster from './components/Toaster.tsx';
import { useData } from './lib/db.ts';
import { useKeyboardInset } from './lib/hooks.ts';
import { navigate, type Route, screenOf, useRoute } from './lib/route.ts';
import { onboardedStore } from './lib/settings.ts';
import { useStore } from './lib/store.ts';
import DoseSheet from './screens/DoseSheet.tsx';
import History, { DayPanel } from './screens/History.tsx';
import MedicineDetail from './screens/MedicineDetail.tsx';
import MedicineEdit from './screens/MedicineEdit.tsx';
import Medicines from './screens/Medicines.tsx';
import NotFound from './screens/NotFound.tsx';
import PipLab from './screens/PipLab.tsx';
import Routines from './screens/Routines.tsx';
import Today, { TodayPanel } from './screens/Today.tsx';
import Welcome from './screens/Welcome.tsx';
import You from './screens/You.tsx';

function Main({ route, panel }: { route: Route; panel: boolean }) {
  switch (route.name) {
    case 'today':
    case 'dose':
      return <Today />;
    case 'medicines':
    case 'new':
    case 'edit':
      return <Medicines />;
    case 'medicine':
      return panel ? (
        <Medicines selected={route.id} />
      ) : (
        <MedicineDetail id={route.id} />
      );
    case 'history':
      return <History />;
    case 'day':
      return panel ? (
        <History selected={route.date} />
      ) : (
        <DayPanel date={route.date} page />
      );
    case 'routines':
      return <Routines />;
    case 'you':
      return <You />;
    default:
      return <NotFound />;
  }
}

function Panel({ route }: { route: Route }) {
  switch (route.name) {
    case 'today':
    case 'dose':
      return <TodayPanel />;
    case 'medicine':
      return <MedicineDetail id={route.id} inPanel />;
    case 'medicines':
    case 'new':
    case 'edit':
      return <MedicineDetail inPanel />;
    case 'history':
      return <DayPanel />;
    case 'day':
      return <DayPanel date={route.date} />;
    default:
      return null;
  }
}

export default function App() {
  const route = useRoute();
  const mode = useMode();
  const onboarded = useStore(onboardedStore);
  const { ready, meds } = useData();
  useTheme();
  useKeyboardInset();
  useShortcuts(route);

  useEffect(() => {
    if (ready && !onboarded && meds.length === 0 && route.name === 'today')
      navigate('/welcome', { replace: true });
  }, [ready, onboarded, meds.length, route.name]);

  if (route.name === 'welcome') {
    return (
      <ModeContext.Provider value={mode}>
        <Welcome />
        <Toaster />
      </ModeContext.Provider>
    );
  }
  if (route.name === 'pip') return <PipLab />;

  const screen = screenOf(route);
  const panel = mode === 'lap' || mode === 'desk';
  const ctx = panel ? Panel({ route }) : null;
  const missing = route.name === 'missing';

  return (
    <ModeContext.Provider value={mode}>
      <div
        className="shell mx-auto flex h-dvh max-w-[2560px] overflow-hidden"
        data-mode={mode}
        style={
          {
            '--dock': mode === 'phone' && !missing ? '68px' : '0px',
          } as React.CSSProperties
        }
      >
        {!missing && mode === 'land' && <Rail current={screen} slim />}
        {!missing && (mode === 'tab' || mode === 'lap') && (
          <Rail current={screen} />
        )}
        {!missing && mode === 'desk' && <Sidebar current={screen} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className="relative flex min-h-0 flex-1 [view-transition-name:screen]"
            id="main"
          >
            <Main route={route} panel={panel} />
          </main>
          {!missing && mode === 'phone' && <TabBar current={screen} />}
        </div>
        {ctx && (
          <aside
            className="scroller hidden w-[clamp(320px,26vw,400px)] flex-none py-6 pr-6 lap:block"
            aria-label="Details"
          >
            {ctx}
          </aside>
        )}
      </div>
      {route.name === 'dose' && <DoseSheet due={route.due} />}
      {(route.name === 'new' || route.name === 'edit') && (
        <MedicineEdit id={route.name === 'edit' ? route.id : undefined} />
      )}
      <Toaster />
    </ModeContext.Provider>
  );
}
