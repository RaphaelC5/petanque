import { useRef, useState } from 'react';
import { useStore } from './state/store';
import { importFromFile } from './storage/persistence';
import { HomeView } from './components/views/HomeView';
import { PlayersView } from './components/views/PlayersView';
import { ConstitutionView } from './components/views/ConstitutionView';
import { DashboardView } from './components/views/DashboardView';
import { Toast } from './components/common';

export type View =
  | { name: 'home' }
  | { name: 'players' }
  | { name: 'constitution'; tournamentId: string }
  | { name: 'dashboard'; tournamentId: string };

export function App() {
  const { state, replaceState, exportData } = useStore();
  const [view, setView] = useState<View>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = await importFromFile(file);
      replaceState(imported);
      setView({ name: 'home' });
      flash('Données importées ✅');
    } catch {
      flash('Fichier invalide ❌');
    }
  };

  const current =
    view.name === 'constitution' || view.name === 'dashboard'
      ? state.tournaments.find((t) => t.id === view.tournamentId)
      : undefined;

  return (
    <>
      <header className="app-header">
        <div className="brand" onClick={() => setView({ name: 'home' })}>
          <span className="logo">🌞</span>
          <div>
            <div className="title">Semaine des Copains</div>
            <div className="subtitle">Marseille · Tournois de pétanque</div>
          </div>
        </div>
        <div className="spacer" />
        <div className="header-actions">
          <button className="btn btn-sm" onClick={() => setView({ name: 'players' })}>
            👥 Joueurs
          </button>
          <button className="btn btn-sm" onClick={exportData}>
            ⬇️ Exporter
          </button>
          <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
            ⬆️ Importer
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              onImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main className="container">
        {view.name === 'home' && <HomeView setView={setView} flash={flash} />}
        {view.name === 'players' && <PlayersView flash={flash} />}
        {view.name === 'constitution' && current && (
          <ConstitutionView tournament={current} setView={setView} flash={flash} />
        )}
        {view.name === 'dashboard' && current && (
          <DashboardView tournament={current} setView={setView} flash={flash} />
        )}
        {(view.name === 'constitution' || view.name === 'dashboard') && !current && (
          <div className="empty">
            <span className="emoji">🤷</span>
            Tournoi introuvable.
            <div className="mt">
              <button className="btn btn-primary" onClick={() => setView({ name: 'home' })}>
                Retour à l'accueil
              </button>
            </div>
          </div>
        )}
      </main>

      <Toast message={toast} />
    </>
  );
}
