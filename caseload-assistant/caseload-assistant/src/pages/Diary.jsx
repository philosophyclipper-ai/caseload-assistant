import { useState } from 'react';
import { planFromPrompt, shortAddress, talkingPoint } from '../lib/agent.js';
import { addDays, startOfDay, sameDay, fmtTime, fmtDay } from '../lib/dates.js';
import { buildIcs, download } from '../lib/exporters.js';

// Expand weekly events into the days being shown.
function occurrences(e, day) {
  const start = new Date(e.start);
  if (!e.weekly) return sameDay(start, day) ? start : null;
  const diff = Math.round((startOfDay(day) - startOfDay(start)) / 86400000);
  if (diff < 0 || diff % 7 !== 0) return null;
  const d = new Date(day);
  d.setHours(start.getHours(), start.getMinutes(), 0, 0);
  return d;
}

function nextOccurrence(e, from) {
  let d = new Date(e.start);
  if (!e.weekly) return d;
  while (d < startOfDay(from)) d = addDays(d, 7);
  return d;
}

export default function Diary({ state, update, notify, openCompose, openProperty }) {
  const [quick, setQuick] = useState('');
  const today = startOfDay(new Date());
  const days = [-1, 0, 1, 2, 3].map((n) => addDays(today, n));
  const propById = Object.fromEntries(state.properties.map((p) => [p.id, p]));

  const addQuick = () => {
    if (!quick.trim()) return;
    const plan = planFromPrompt(quick, state.properties, []);
    const evs = plan.events.filter((e) => !/^Log viewing outcome/.test(e.title)).slice(0, 4);
    update((s) => ({ ...s, events: [...s.events, ...evs] }));
    download('reminder.ics', buildIcs(evs), 'text/calendar');
    notify(`Added: ${evs.map((e) => `${e.title} (${fmtDay(e.start)} ${fmtTime(e.start)})`).join('; ')}`);
    setQuick('');
  };

  const toggleDone = (id) => update((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)) }));

  const weekly = state.events
    .filter((e) => e.weekly)
    .map((e) => ({ e, next: nextOccurrence(e, today), p: propById[e.propertyId] }))
    .sort((a, b) => a.next - b.next);

  const quiet = state.properties
    .filter((p) => p.mine && p.status === 'live')
    .map((p) => ({ p, tp: talkingPoint(p) }))
    .filter((x) => x.tp.strategy && !state.events.some((e) => e.weekly && e.propertyId === x.p.id));

  const tasks = state.events
    .filter((e) => e.kind === 'task' && !e.done && !e.weekly && new Date(e.start) >= today)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <main className="page stack" style={{ gap: 20 }}>
      <h1>Diary</h1>
      <div className="card">
        <div className="inline" style={{ alignItems: 'flex-end' }}>
          <div className="grow">
            <label className="lbl" htmlFor="quick">Quick reminder</label>
            <input id="quick" type="text" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuick()} placeholder="Ring the surveyor about 5 Draft Place tomorrow at 2" />
          </div>
          <button className="btn primary" onClick={addQuick}>Add reminder</button>
        </div>
      </div>

      <div className="cal-wrap">
        <div className="cal">
          {days.map((d, i) => {
            const items = state.events
              .map((e) => ({ e, at: occurrences(e, d) }))
              .filter((x) => x.at)
              .sort((a, b) => a.at - b.at);
            return (
              <div key={i} className={`cal-day ${i === 0 ? 'past' : ''} ${i === 1 ? 'today' : ''}`}>
                <div className="cal-head">{i === 0 ? 'Yesterday · ' : i === 1 ? 'Today · ' : ''}{fmtDay(d)}</div>
                {items.length === 0 && <div className="muted">Nothing booked</div>}
                {items.map(({ e, at }) => (
                  <label key={e.id} className={`ev ${e.kind === 'task' ? 'task' : ''} ${e.done ? 'done' : ''}`}>
                    <input type="checkbox" checked={!!e.done} onChange={() => toggleDone(e.id)} aria-label={`Mark ${e.title} done`} />
                    <span><strong>{fmtTime(at)}</strong> {e.title}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="row">
        <section className="card grow" style={{ flexBasis: 380 }}>
          <h2>Upcoming weekly check-ins</h2>
          {weekly.length === 0 && <div className="muted">No weekly check-ins yet. They are set up when a property goes live.</div>}
          {weekly.map(({ e, next, p }) => {
            const t = p ? talkingPoint(p) : { text: '' };
            return (
              <div key={e.id} className={`item ${t.strategy ? 'warn' : ''}`}>
                <div className="grow">
                  <div className="t">{p ? shortAddress(p.address) : e.title}</div>
                  <div style={{ fontSize: 13 }} className={t.strategy ? '' : 'muted'}>{fmtDay(next)} · {t.text}</div>
                </div>
                {t.strategy ? (
                  <button className="btn small" onClick={() => openProperty(p.id)}>Start strategy discussion</button>
                ) : (
                  <button className="btn small" onClick={() => openCompose({ text: `Weekly update. ${t.text}`, propertyId: e.propertyId, outputs: ['email'], recipients: ['seller'] })}>Draft update</button>
                )}
              </div>
            );
          })}
          {quiet.map(({ p, tp }) => (
            <div key={p.id} className="item warn">
              <div className="grow">
                <div className="t">{shortAddress(p.address)}</div>
                <div style={{ fontSize: 13 }}>{tp.text}</div>
              </div>
              <button className="btn small" onClick={() => openProperty(p.id)}>Start strategy discussion</button>
            </div>
          ))}
        </section>

        <section className="card grow" style={{ flexBasis: 380 }}>
          <h2>Upcoming tasks</h2>
          {tasks.length === 0 && <div className="muted">No open tasks.</div>}
          {tasks.map((e) => (
            <div key={e.id} className="item">
              <div className="grow">
                <div className="t">{e.title}</div>
                <div className="muted">{fmtDay(e.start)}, {fmtTime(e.start)}</div>
              </div>
              <button className="btn small" onClick={() => openCompose({ text: e.title, propertyId: e.propertyId, outputs: ['email'], recipients: [e.who && e.who !== 'surveyor' && e.who !== 'mortgage adviser' ? e.who : 'seller'] })}>Open in compose</button>
              <button className="btn small" onClick={() => toggleDone(e.id)}>Done</button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
