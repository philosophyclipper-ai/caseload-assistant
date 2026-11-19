import { useState } from 'react';
import { shortAddress } from '../lib/agent.js';

// Chips for selected properties plus a searchable list of every address.
export default function PropertyPicker({ properties, selected, onChange, label = 'Property' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const chosen = selected.map((id) => properties.find((p) => p.id === id)).filter(Boolean);
  const matches = properties.filter((p) => !selected.includes(p.id) && p.address.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="inline">
        <span className="chip-label">{label}</span>
        {chosen.map((p) => (
          <span key={p.id} className="chip info">
            {shortAddress(p.address)}
            {p.beds ? ` · ${p.beds} bed` : ''}
            {p.price ? ` · ${p.price}` : ''}
            {p.mine ? ' · Mine' : ''}
            <button className="x" aria-label={`Remove ${shortAddress(p.address)}`} onClick={() => onChange(selected.filter((x) => x !== p.id))}>×</button>
          </span>
        ))}
        <button className="chip" style={{ borderStyle: 'dashed', minHeight: 44 }} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Close list' : 'Search all addresses'}
        </button>
      </div>
      {open && (
        <div className="stack" style={{ gap: 6 }}>
          <label className="lbl" htmlFor="addr-search">Search addresses</label>
          <input id="addr-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a street" autoFocus />
          <div className="searchlist">
            {matches.length === 0 && <div className="muted" style={{ padding: 12 }}>No matches</div>}
            {matches.map((p) => (
              <button key={p.id} onClick={() => { onChange([...selected, p.id]); setQ(''); setOpen(false); }}>
                <strong>{shortAddress(p.address)}</strong>
                <span className="muted"> · {p.address.split(',').slice(1).join(',').trim()} {p.mine ? '· Mine' : '· Not mine'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
