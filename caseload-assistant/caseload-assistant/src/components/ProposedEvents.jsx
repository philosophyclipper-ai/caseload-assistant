import { useState } from 'react';
import { refineEvents } from '../lib/agent.js';

function toLocalInput(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function ProposedEvents({ events, onChange, onConfirm, confirmed }) {
  const [refine, setRefine] = useState('');
  const set = (id, patch) => onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const applyRefine = () => {
    if (!refine.trim()) return;
    onChange(refineEvents(events, refine));
    setRefine('');
  };

  return (
    <div className="card">
      <div className="inline">
        <h2 className="grow">Proposed calendar entries</h2>
        {confirmed && <span className="badge">Added</span>}
      </div>
      {events.length === 0 && <div className="muted">Nothing to add. Try mentioning a time, a call, a chase or a viewing.</div>}
      {events.map((e) => (
        <div key={e.id} className="item">
          <div className="grow stack" style={{ gap: 6 }}>
            <label className="lbl" htmlFor={`t-${e.id}`} style={{ margin: 0 }}>{e.kind === 'event' ? 'Event' : 'Reminder'}</label>
            <input id={`t-${e.id}`} type="text" value={e.title} onChange={(ev) => set(e.id, { title: ev.target.value })} />
            {e.note && <span className="muted">{e.note}</span>}
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label className="lbl" htmlFor={`d-${e.id}`}>When</label>
            <input id={`d-${e.id}`} type="datetime-local" value={toLocalInput(e.start)} onChange={(ev) => ev.target.value && set(e.id, { start: new Date(ev.target.value).toISOString() })} />
          </div>
          <button className="btn small" aria-label={`Remove ${e.title}`} onClick={() => onChange(events.filter((x) => x.id !== e.id))}>Remove</button>
        </div>
      ))}
      <div className="inline" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <label className="lbl" htmlFor="refine-events">Refine these</label>
          <input id="refine-events" type="text" value={refine} onChange={(e) => setRefine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyRefine()} placeholder="e.g. move the seller call to the afternoon · remove the chase" />
        </div>
        <button className="btn" onClick={applyRefine}>Refine</button>
        <button className="btn primary" disabled={!events.length} onClick={onConfirm}>
          Add {events.length} to calendar
        </button>
      </div>
    </div>
  );
}
