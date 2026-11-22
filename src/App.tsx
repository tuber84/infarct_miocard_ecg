import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { TrainingPanel, type TrainingSubPanel } from './components/TrainingPanel';
import { CaseId } from './core/types';
import {
  isIosSafari,
  isStandalonePwa,
  preferTrainingHome,
} from './platform/runtime';

const AtlasView = lazy(() => import('./components/AtlasView'));
const IOS_INSTALL_DISMISSED_KEY = 'cardioatlas.iosInstallDismissed.v1';

interface AppHistoryState {
  __cardioAtlas: true;
  mode: 'atlas' | 'training';
  atlasCase: CaseId;
  panel: TrainingSubPanel;
}

export default function App() {
  const [mode, setMode] = useState<'atlas' | 'training'>(
    preferTrainingHome ? 'training' : 'atlas'
  );
  const [atlasCase, setAtlasCase] = useState<CaseId>('lad_prox');
  const [trainingPanel, setTrainingPanel] = useState<TrainingSubPanel>('patient');
  const [showIosInstallHint, setShowIosInstallHint] = useState<boolean>(() => {
    if (!isIosSafari || isStandalonePwa || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(IOS_INSTALL_DISMISSED_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const stateRef = useRef({ mode, atlasCase, panel: trainingPanel });
  stateRef.current = { mode, atlasCase, panel: trainingPanel };

  const dismissIosInstallHint = useCallback(() => {
    setShowIosInstallHint(false);
    try {
      window.localStorage.setItem(IOS_INSTALL_DISMISSED_KEY, '1');
    } catch {
      // Игнорируем отказ хранилища: скрываем подсказку до конца текущей сессии.
    }
  }, []);

  useEffect(() => {
    const initial: AppHistoryState = {
      __cardioAtlas: true,
      mode: stateRef.current.mode,
      atlasCase: stateRef.current.atlasCase,
      panel: stateRef.current.panel,
    };
    window.history.replaceState(initial, '');

    const onPopState = (event: PopStateEvent) => {
      const st = event.state as Partial<AppHistoryState> | null;
      if (!st || !st.__cardioAtlas) return;
      if (st.mode === 'atlas' || st.mode === 'training') {
        setMode(st.mode);
      }
      if (st.atlasCase) {
        setAtlasCase(st.atlasCase);
      }
      if (st.panel === 'patient' || st.panel === 'data' || st.panel === 'answer') {
        setTrainingPanel(st.panel);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToMode = useCallback((nextMode: 'atlas' | 'training', nextCase?: CaseId) => {
    const targetCase = nextCase ?? stateRef.current.atlasCase;
    const targetPanel = stateRef.current.panel;
    if (
      nextMode === stateRef.current.mode &&
      targetCase === stateRef.current.atlasCase
    ) {
      return;
    }
    setMode(nextMode);
    if (nextCase) {
      setAtlasCase(nextCase);
    }
    const nextState: AppHistoryState = {
      __cardioAtlas: true,
      mode: nextMode,
      atlasCase: targetCase,
      panel: targetPanel,
    };
    window.history.pushState(nextState, '');
  }, []);

  const handleTrainingPanelChange = useCallback(
    (nextPanel: TrainingSubPanel, historyMode: 'push' | 'replace') => {
      if (nextPanel === stateRef.current.panel) return;
      setTrainingPanel(nextPanel);
      const nextState: AppHistoryState = {
        __cardioAtlas: true,
        mode: stateRef.current.mode,
        atlasCase: stateRef.current.atlasCase,
        panel: nextPanel,
      };
      if (historyMode === 'push') {
        window.history.pushState(nextState, '');
      } else {
        window.history.replaceState(nextState, '');
      }
    },
    []
  );

  return (
    <>
      <nav aria-label="Режим приложения" className="safe-top safe-x flex gap-2 border-b bg-white pb-2">
        <button
          onClick={() => navigateToMode('atlas')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'atlas' ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Атлас
        </button>
        <button
          onClick={() => navigateToMode('training')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'training' ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Тренировка
        </button>
      </nav>
      {showIosInstallHint && (
        <div
          role="note"
          className="safe-x flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 py-2 text-xs text-amber-950"
        >
          <span>
            Для офлайн-работы на iPhone: нажмите «Поделиться» → «На экран Домой».
          </span>
          <button
            type="button"
            onClick={dismissIosInstallHint}
            className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900"
          >
            Понятно
          </button>
        </div>
      )}
      <div className="safe-bottom">
        {mode === 'training' ? (
          <TrainingPanel
            onOpenAtlas={(id) => navigateToMode('atlas', id)}
            panel={trainingPanel}
            onPanelChange={handleTrainingPanelChange}
          />
        ) : (
          <Suspense
            fallback={
              <div className="flex min-h-[240px] items-center justify-center p-6 text-sm text-slate-500">
                Загрузка атласа и 3D-модели…
              </div>
            }
          >
            <AtlasView key={atlasCase} initialCaseId={atlasCase} />
          </Suspense>
        )}
      </div>
    </>
  );
}
