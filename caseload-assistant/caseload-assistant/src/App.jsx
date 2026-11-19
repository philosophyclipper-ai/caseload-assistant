import { useState, useCallback } from 'react';
import { useStore, runSweep } from './lib/store.js';
import { fmtDayTime } from './lib/dates.js';
import Home from './pages/Home.jsx';
import Diary from './pages/Diary.jsx';
import Caseload from './pages/Caseload.jsx';

const PAGES = [
  ['home', 'Home'],
  ['diary', 'Diary'],
  ['caseload', 'Caseload'],
];

export default function App() {
  const [state, update, reset] = useStore();
  const [page, setPage] = useState('home');
  const [toast, setToast] = useState('');
  // Hand-off into the Home composer from other pages.
  const [compose, setCompose] = useState(null);
  const [focusProperty, setFocusProperty] = useState(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const manualCheck = () => {
    update((s) => {
      const next = runSweep(s, 2);
      notify(next.lastFound ? `Found ${next.lastFound} new listing${next.lastFound > 1 ? 's' : ''} on the website` : 'No new listings since the last check');
      return next;
    });
  };

  const openCompose = (payload) => {
    setCompose({ ...payload, key: Date.now() });
    setPage('home');
    window.scrollTo(0, 0);
  };
  const openProperty = (id) => {
    setFocusProperty(id);
    setPage('caseload');
    window.scrollTo(0, 0);
  };

  const shared = { state, update, notify, openCompose, openProperty };

  return (
    <>
      <div className="demo-banner">
        Demo with sample data and sample AI replies. Nothing is sent anywhere.{' '}
        <button className="btn link small" onClick={() => { if (confirm('Reset all demo data?')) reset(); }}>Reset demo</button>
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">Caseload Assistant</div>
          <nav className="nav" aria-label="Main">
            {PAGES.map(([id, label]) => (
              <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
                {label}
              </button>
            ))}
          </nav>
          <span className="sweep">Last website sweep: {state.lastSweep ? fmtDayTime(state.lastSweep) : 'never'}</span>
          <button className="btn outline" onClick={manualCheck}>Run manual check</button>
        </div>
      </header>
      {page === 'home' && <Home {...shared} compose={compose} />}
      {page === 'diary' && <Diary {...shared} />}
      {page === 'caseload' && <Caseload {...shared} focusId={focusProperty} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
