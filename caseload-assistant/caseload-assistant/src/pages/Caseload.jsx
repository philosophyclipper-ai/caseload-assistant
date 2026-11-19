import { useEffect, useState } from 'react';
import { shortAddress, scanHomeReport, goLiveBrief, talkingPoint } from '../lib/agent.js';
import { fmtDay, fmtTime } from '../lib/dates.js';
import { uid } from '../lib/store.js';
import { buildIcs, download } from '../lib/exporters.js';

const CONTEXT_FIELDS = [
  ['goals', 'Goals'],
  ['reason', 'Reason for sale'],
  ['situation', 'Situation'],
  ['personality', 'Personality type'],
  ['condition', 'Condition of the property'],
  ['concerns', 'Concerns'],
  ['stakeholders', 'Other stakeholders (roles, not names)'],
];
const NOTE_KINDS = ['Viewing', 'Check-in', 'Call', 'Note', 'Offer'];

function wordCount(s = '') {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function AddPremarket({ onAdd, onCancel }) {
  const [address, setAddress] = useState('');
  const [beds, setBeds] = useState('');
  const [report, setReport] = useState('');
  const [pdf, setPdf] = useState('');
  return (
    <div className="card">
      <h2>Add a pre-market property</h2>
      <div className="muted">Paste the address exactly as it appears on the handover so it matches the website when it goes live.</div>
      <div>
        <label className="lbl" htmlFor="pm-addr">Address</label>
        <input id="pm-addr" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Street Name, Edinburgh, EH1 1AA" />
      </div>
      <div style={{ maxWidth: 160 }}>
        <label className="lbl" htmlFor="pm-beds">Bedrooms</label>
        <input id="pm-beds" type="number" min="0" value={beds} onChange={(e) => setBeds(e.target.value)} />
      </div>
      <div>
        <label className="lbl" htmlFor="pm-pdf">Home report PDF</label>
        <input id="pm-pdf" type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0]?.name || '')} />
        <div className="muted">The demo keeps the file name only. Paste the text below for the scan.</div>
      </div>
      <div>
        <label className="lbl" htmlFor="pm-text">Home report text</label>
        <textarea id="pm-text" rows={6} value={report} onChange={(e) => setReport(e.target.value)} placeholder={'Market value: £300,000\nDampness, rot and infestation 3\nRoofing including roof space 2\nEPC rating: E'} />
      </div>
      <div className="inline right">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={!address.trim()} onClick={() => onAdd({ address: address.trim(), beds: beds ? +beds : null, report, pdf })}>Add and scan</button>
      </div>
    </div>
  );
}

export default function Caseload({ state, update, notify, openCompose, focusId }) {
  const mine = state.properties.filter((p) => p.mine);
  const [sel, setSel] = useState(focusId || mine[0]?.id);
  const [adding, setAdding] = useState(false);
  const [logText, setLogText] = useState('');
  const [logKind, setLogKind] = useState('Viewing');
  const [checkAt, setCheckAt] = useState('');
  useEffect(() => { if (focusId) setSel(focusId); }, [focusId]);

  const p = state.properties.find((x) => x.id === sel);
  const setP = (patch) => update((s) => ({ ...s, properties: s.properties.map((x) => (x.id === sel ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) }));

  const addPremarket = ({ address, beds, report, pdf }) => {
    const id = uid();
    const scan = report.trim() ? scanHomeReport(report) : null;
    update((s) => ({
      ...s,
      properties: [...s.properties, { id, address, beds, price: scan?.marketValue ? `Home report £${scan.marketValue.slice(1)}` : '', type: '', mine: true, status: 'premarket', liveSince: null, voice: '', context: {}, notes: [], homeReport: report.trim() || pdf ? { text: report, pdf, scan } : null }],
    }));
    setSel(id);
    setAdding(false);
    notify('Added. It will be marked live when the sweep finds it on the website.');
  };

  const log = () => {
    if (!logText.trim()) return;
    setP((x) => ({ notes: [...x.notes, { id: uid(), date: new Date().toISOString(), kind: logKind, text: logText.trim() }] }));
    setLogText('');
    notify('Logged');
  };

  const scheduleCheck = () => {
    if (!checkAt) return notify('Pick a date and time first');
    const ev = { id: uid(), title: `Check-in, ${shortAddress(p.address)}`, start: new Date(checkAt).toISOString(), duration: 15, kind: 'task', propertyId: p.id, who: 'seller' };
    update((s) => ({ ...s, events: [...s.events, ev] }));
    download('check-in.ics', buildIcs([ev]), 'text/calendar');
    setCheckAt('');
    notify(`Check-in booked for ${fmtDay(ev.start)} ${fmtTime(ev.start)}`);
  };

  const live = mine.filter((x) => x.status === 'live');
  const pre = mine.filter((x) => x.status === 'premarket');
  const notMine = state.properties.filter((x) => !x.mine);

  const tp = p && p.status === 'live' ? talkingPoint(p) : null;
  const scan = p?.homeReport?.scan;
  const postcode = p?.address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)?.[0];
  const days = p?.liveSince ? Math.max(0, Math.round((Date.now() - new Date(p.liveSince)) / 86400000)) : null;

  const ListBtn = ({ x }) => {
    const quiet = x.status === 'live' && talkingPoint(x).strategy;
    return (
      <button aria-current={x.id === sel ? 'true' : undefined} className={quiet && x.id !== sel ? 'warn' : ''} onClick={() => { setSel(x.id); setAdding(false); }}>
        <div style={{ fontWeight: 600 }}>{shortAddress(x.address)}</div>
        <div className="muted" style={quiet && x.id !== sel ? { color: 'inherit' } : {}}>
          {x.beds ? `${x.beds} bed` : ''}{x.needsProfile ? ' · profile needed' : ''}{quiet ? ' · strategy due' : ''}{x.status === 'premarket' ? (x.homeReport ? ' · home report added' : ' · add home report') : ''}
        </div>
      </button>
    );
  };

  return (
    <main className="page">
      <div className="row">
        <aside className="side" style={{ flex: '1 1 260px' }}>
          <h1>Caseload</h1>
          <button className="btn outline" onClick={() => setAdding(true)}>Add pre-market property</button>
          <div className="plist">
            <div className="section-label">On the market</div>
            {live.map((x) => <ListBtn key={x.id} x={x} />)}
            <div className="section-label">Pre-market</div>
            {pre.length === 0 && <div className="muted">None</div>}
            {pre.map((x) => <ListBtn key={x.id} x={x} />)}
            {notMine.length > 0 && <div className="section-label">Other listings ({notMine.length}, reference only)</div>}
          </div>
        </aside>

        <section className="main">
          {adding && <AddPremarket onAdd={addPremarket} onCancel={() => setAdding(false)} />}
          {!adding && !p && <div className="card">Pick a property.</div>}
          {!adding && p && (
            <>
              <div className="card">
                <div className="inline">
                  <h2 className="grow" style={{ fontSize: 24 }}>{shortAddress(p.address)}</h2>
                  {p.status === 'live' ? <span className="badge">On the market · day {days}</span> : <span className="badge grey">Pre-market</span>}
                </div>
                <div className="muted">{p.address}</div>
                <div className="facts">
                  <div><div className="k">Price</div><div className="v">{p.price || '—'}</div></div>
                  <div><div className="k">Bedrooms</div><div className="v">{p.beds ?? '—'}</div></div>
                  <div><div className="k">Type</div><div className="v">{p.type || '—'}</div></div>
                  <div><div className="k">Viewings logged</div><div className="v">{p.notes.filter((n) => n.kind === 'Viewing').length}</div></div>
                </div>
              </div>

              {p.needsProfile && (
                <div className="card warn">
                  <div style={{ fontWeight: 600 }}>Now live: finish the seller profile</div>
                  <div>Add the seller's goals, situation, reason for sale, concerns, the property's condition and anyone else involved. Use roles, not names.</div>
                  <div><button className="btn" onClick={() => setP({ needsProfile: false })}>Mark profile complete</button></div>
                </div>
              )}

              {tp && (
                <div className={`card ${tp.strategy ? 'warn' : 'good'}`}>
                  <div><strong>{tp.strategy ? 'Strategy discussion due' : 'Next talking point'}:</strong> {tp.text}</div>
                  <div className="inline">
                    <button className="btn" onClick={() => openCompose({ text: tp.strategy ? 'Suggest a short strategy chat this week to review price, photos and advert wording.' : tp.text, propertyId: p.id, outputs: ['email', 'reminders'], recipients: ['seller'] })}>
                      {tp.strategy ? 'Draft strategy email' : 'Draft seller update'}
                    </button>
                  </div>
                </div>
              )}

              <div className="row">
                <div className="card grow" style={{ flexBasis: 300 }}>
                  <label htmlFor="voice"><h2>Seller voice</h2></label>
                  <div className="muted">10 to 20 words on who they are and how they like to be spoken to. It shapes tone and next steps.</div>
                  <textarea id="voice" rows={3} value={p.voice} onChange={(e) => setP({ voice: e.target.value })} placeholder="e.g. Busy professional, prefers short factual updates, wants a clear recommendation each time." />
                  <div className="muted" style={{ color: wordCount(p.voice) > 20 ? 'var(--danger-ink)' : undefined }}>{wordCount(p.voice)} words</div>
                </div>
              </div>

              <div className="card">
                <h2>Seller context</h2>
                <div className="muted">Brief working notes only. No contact details, ID or financial information.</div>
                <div className="fields">
                  {CONTEXT_FIELDS.map(([k, label]) => (
                    <div key={k}>
                      <label className="lbl" htmlFor={`ctx-${k}`}>{label}</label>
                      <input id={`ctx-${k}`} type="text" value={p.context?.[k] || ''} onChange={(e) => setP((x) => ({ context: { ...x.context, [k]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              </div>

              {(p.status === 'premarket' || p.homeReport) && (
                <div className="card">
                  <h2>Pre-market research</h2>
                  {!p.homeReport && (
                    <div className="stack">
                      <label className="lbl" htmlFor="hr-text">Paste home report text to scan</label>
                      <textarea id="hr-text" rows={5} placeholder={'Market value: £300,000\nDampness, rot and infestation 3'} onBlur={(e) => e.target.value.trim() && setP({ homeReport: { text: e.target.value, scan: scanHomeReport(e.target.value) } })} />
                      <div className="muted">Click away from the box to scan.</div>
                    </div>
                  )}
                  {scan && (
                    <div className="row">
                      <div className="item warn grow" style={{ flexDirection: 'column', alignItems: 'flex-start', flexBasis: 220 }}>
                        <div className="t">Home report flags</div>
                        {scan.cat3.length ? <ul className="flags">{scan.cat3.map((l) => <li key={l}><strong>Cat 3:</strong> {l}</li>)}</ul> : <div>No Category 3 items found</div>}
                        {scan.cat2.length > 0 && <ul className="flags">{scan.cat2.map((l) => <li key={l}>Cat 2: {l}</li>)}</ul>}
                        {scan.concerns.length > 0 && <ul className="flags">{scan.concerns.map((l) => <li key={l}>Check: {l}</li>)}</ul>}
                        <div className="muted" style={{ color: 'inherit' }}>Always read the report yourself: the scan can miss items.</div>
                      </div>
                      <div className="item grow" style={{ flexDirection: 'column', alignItems: 'flex-start', flexBasis: 220 }}>
                        <div className="t">Key facts</div>
                        <div>Market value: {scan.marketValue || 'not found'}</div>
                        <div>EPC: {scan.epc || 'not found'}</div>
                        <div>Council tax: {scan.councilTax || 'not found'}</div>
                      </div>
                    </div>
                  )}
                  <div className="item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div className="t">Area, target buyer and recent sale prices</div>
                    <div className="muted">With Claude connected, this becomes a researched brief. In the demo, use these public sources{postcode ? ` for ${postcode.toUpperCase()}` : ''}:</div>
                    <div className="inline">
                      <a className="btn small" href="https://scotlis.ros.gov.uk/" target="_blank" rel="noreferrer">ScotLIS sold prices</a>
                      <a className="btn small" href="https://simd.scot/" target="_blank" rel="noreferrer">SIMD area data</a>
                      <a className="btn small" href={`https://www.google.com/maps/search/${encodeURIComponent(`schools near ${postcode || p.address}`)}`} target="_blank" rel="noreferrer">Schools nearby</a>
                      <a className="btn small" href={`https://www.google.com/maps/search/${encodeURIComponent(`train station near ${postcode || p.address}`)}`} target="_blank" rel="noreferrer">Transport</a>
                    </div>
                  </div>
                  {p.homeReport && (
                    <div className="card good">
                      <h3>Go-live call brief</h3>
                      <ul className="flags">{goLiveBrief(p).slice(1).map((l) => <li key={l}>{l}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              <div className="card">
                <h2>Diary</h2>
                <div className="inline" style={{ alignItems: 'flex-end' }}>
                  <div style={{ flex: '0 1 150px' }}>
                    <label className="lbl" htmlFor="log-kind">Type</label>
                    <select id="log-kind" value={logKind} onChange={(e) => setLogKind(e.target.value)}>
                      {NOTE_KINDS.map((k) => <option key={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="grow">
                    <label className="lbl" htmlFor="log">Log a viewing, check-in or note</label>
                    <input id="log" type="text" value={logText} onChange={(e) => setLogText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && log()} placeholder="Viewing done, liked the garden, unsure about the kitchen" />
                  </div>
                  <button className="btn primary" onClick={log}>Log it</button>
                </div>
                <div className="inline" style={{ alignItems: 'flex-end' }}>
                  <div style={{ flex: '0 1 240px' }}>
                    <label className="lbl" htmlFor="check-at">Schedule a check-in</label>
                    <input id="check-at" type="datetime-local" value={checkAt} onChange={(e) => setCheckAt(e.target.value)} />
                  </div>
                  <button className="btn" onClick={scheduleCheck}>Schedule</button>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {p.notes.length === 0 && <div className="muted">Nothing logged yet.</div>}
                  {[...p.notes].sort((a, b) => b.date.localeCompare(a.date)).map((n) => (
                    <div key={n.id} className="note">
                      <div className="muted">{fmtDay(n.date)} · {n.kind}</div>
                      <div>{n.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
