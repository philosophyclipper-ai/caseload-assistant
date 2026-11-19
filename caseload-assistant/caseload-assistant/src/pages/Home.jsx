import { useEffect, useState } from 'react';
import PropertyPicker from '../components/PropertyPicker.jsx';
import ProposedEvents from '../components/ProposedEvents.jsx';
import EmailDraft from '../components/EmailDraft.jsx';
import { planFromPrompt, draftEmail, findProperties, shortAddress } from '../lib/agent.js';
import { buildIcs, download } from '../lib/exporters.js';
import { uid } from '../lib/store.js';
import { addDays, startOfDay } from '../lib/dates.js';

const OUTPUTS = [
  ['reminders', 'Reminders'],
  ['email', 'Email'],
  ['checkin', 'Check-in'],
];
const RECIPIENTS = [
  ['seller', 'Seller'],
  ['buyer', 'Buyer'],
  ['internal legal', 'Internal legal'],
  ['corporate', 'Corporate'],
];

const EXAMPLE = 'Viewing at 14 Example Terrace went well, they want a second viewing Saturday 11am. Call the seller Friday with feedback and chase legal about the title query.';

export default function Home({ state, update, notify, compose, openProperty }) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState([]);
  const [outputs, setOutputs] = useState(['reminders']);
  const [recipients, setRecipients] = useState(['seller']);
  const [saveNote, setSaveNote] = useState(true);
  const [result, setResult] = useState(null);

  // Hand-off from Diary/Caseload ("Open in compose").
  useEffect(() => {
    if (!compose) return;
    setText(compose.text || '');
    setSelected(compose.propertyId ? [compose.propertyId] : []);
    setOutputs(compose.outputs || ['email']);
    setRecipients(compose.recipients || ['seller']);
    setResult(null);
  }, [compose]);

  // Auto-add properties mentioned in the text as bubbles.
  useEffect(() => {
    const found = findProperties(text, state.properties).map((p) => p.id);
    if (found.some((id) => !selected.includes(id))) setSelected((s) => [...new Set([...s, ...found])]);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const prop = state.properties.find((p) => p.id === selected[0]);

  const generate = () => {
    if (!text.trim() && !selected.length) return notify('Type what happened, or pick a property');
    const plan = planFromPrompt(text, state.properties, selected);
    const p = state.properties.find((x) => x.id === plan.propertyIds[0]);
    const r = { events: [], emails: [], checkin: null, confirmed: false };
    if (outputs.includes('reminders')) r.events = plan.events;
    if (outputs.includes('email')) r.emails = recipients.map((rec) => ({ recipient: rec, ...draftEmail({ recipient: rec, prop: p, prompt: text }) }));
    if (outputs.includes('checkin') && p) {
      const d = addDays(startOfDay(new Date()), 7);
      d.setHours(10, 0, 0, 0);
      r.checkin = { id: uid(), title: `Weekly update, ${shortAddress(p.address)}`, start: d.toISOString(), duration: 15, kind: 'task', propertyId: p.id, weekly: true };
    }
    if (saveNote && p && text.trim()) {
      update((s) => ({
        ...s,
        properties: s.properties.map((x) => (x.id === p.id ? { ...x, notes: [...x.notes, { id: uid(), date: new Date().toISOString(), kind: /viewing/i.test(text) ? 'Viewing' : 'Note', text: text.trim() }] } : x)),
      }));
    }
    setSelected(plan.propertyIds);
    setResult(r);
  };

  const confirmEvents = () => {
    const evs = result.events.map((e) => ({ ...e }));
    update((s) => ({ ...s, events: [...s.events, ...evs] }));
    download('caseload-reminders.ics', buildIcs(evs), 'text/calendar');
    setResult({ ...result, confirmed: true });
    notify(`Added ${evs.length} to your diary. Open the .ics file to add them to Outlook.`);
  };

  const confirmCheckin = () => {
    update((s) => ({ ...s, events: [...s.events, result.checkin] }));
    download('weekly-checkin.ics', buildIcs([result.checkin]), 'text/calendar');
    setResult({ ...result, checkinDone: true });
    notify('Weekly check-in scheduled');
  };

  const untagged = state.website.filter((w) => !w.tag);
  const alerts = state.alerts || [];

  const tag = (w, mine) => {
    update((s) => {
      const exists = s.properties.find((p) => p.address.toLowerCase() === w.address.toLowerCase());
      const properties = exists
        ? s.properties.map((p) => (p.id === exists.id ? { ...p, mine } : p))
        : [...s.properties, { id: uid(), address: w.address, price: w.price, beds: w.beds, type: w.type, mine, status: 'live', liveSince: w.foundAt, voice: '', context: {}, notes: [], needsProfile: mine }];
      return { ...s, properties, website: s.website.map((x) => (x.id === w.id ? { ...x, tag: mine ? 'mine' : 'not' } : x)) };
    });
    notify(mine ? `${shortAddress(w.address)} added to your caseload` : `${shortAddress(w.address)} kept for reference only`);
  };

  return (
    <main className="page">
      <div className="row">
        <section className="main">
          <h1>What happened, and what needs doing?</h1>
          <div className="card">
            <div>
              <label className="lbl" htmlFor="prompt">Type a couple of sentences</label>
              <textarea id="prompt" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && generate()} />
              {!text && (
                <button className="btn link small" onClick={() => setText(EXAMPLE)}>Use example</button>
              )}
            </div>
            <PropertyPicker properties={state.properties} selected={selected} onChange={setSelected} />
            <div className="inline" role="group" aria-label="Produce">
              <span className="chip-label">Produce</span>
              {OUTPUTS.map(([id, label]) => (
                <button key={id} className="chip" aria-pressed={outputs.includes(id)} onClick={() => toggle(outputs, setOutputs, id)}>{label}</button>
              ))}
            </div>
            {outputs.includes('email') && (
              <div className="inline" role="group" aria-label="Email to">
                <span className="chip-label">Email to</span>
                {RECIPIENTS.map(([id, label]) => (
                  <button key={id} className="chip" aria-pressed={recipients.includes(id)} onClick={() => toggle(recipients, setRecipients, id)}>{label}</button>
                ))}
              </div>
            )}
            <div className="inline">
              <label className="inline grow" style={{ gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={saveNote} onChange={(e) => setSaveNote(e.target.checked)} style={{ width: 18, height: 18 }} />
                Save this as a note on the property
              </label>
              <button className="btn primary" onClick={generate}>Generate</button>
            </div>
          </div>

          {result && outputs.includes('reminders') && (
            <ProposedEvents events={result.events} confirmed={result.confirmed} onChange={(events) => setResult({ ...result, events, confirmed: false })} onConfirm={confirmEvents} />
          )}

          {result?.checkin && (
            <div className="card">
              <h2>Weekly check-in</h2>
              <div className="item">
                <div className="grow"><div className="t">{result.checkin.title}</div><div className="muted">Every week from {new Date(result.checkin.start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}, 10:00</div></div>
                <button className="btn primary" disabled={result.checkinDone} onClick={confirmCheckin}>{result.checkinDone ? 'Scheduled' : 'Schedule'}</button>
              </div>
            </div>
          )}

          {result?.emails.map((d, i) => (
            <EmailDraft
              key={d.recipient}
              draft={d}
              notify={notify}
              toneNote={d.recipient === 'seller' ? prop?.voice : ''}
              onChange={(nd) => setResult({ ...result, emails: result.emails.map((x, j) => (j === i ? { ...x, ...nd } : x)) })}
              onApprove={() => setResult({ ...result, emails: result.emails.map((x, j) => (j === i ? { ...x, approved: true } : x)) })}
            />
          ))}
        </section>

        <aside className="side">
          {alerts.map((a) => (
            <div key={a.id} className="card warn">
              <div style={{ fontWeight: 600 }}>Now live</div>
              <div>{a.text}</div>
              <div className="inline">
                <button className="btn" onClick={() => { update((s) => ({ ...s, alerts: s.alerts.filter((x) => x.id !== a.id) })); openProperty(a.propertyId); }}>Complete profile</button>
                <button className="btn link small" onClick={() => update((s) => ({ ...s, alerts: s.alerts.filter((x) => x.id !== a.id) }))}>Dismiss</button>
              </div>
            </div>
          ))}
          <div className="card">
            <h2>New on the website</h2>
            <div className="muted">Found by the nightly sweep or a manual check. Tag each one.</div>
            {untagged.length === 0 && <div className="muted">All caught up. Use “Run manual check” to look again.</div>}
            {untagged.map((w) => (
              <div key={w.id} className="item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div>
                  <div className="t">{shortAddress(w.address)}</div>
                  <div className="muted">{w.beds} bed {w.type.toLowerCase()} · {w.price}</div>
                </div>
                <div className="inline">
                  <button className="btn primary grow" style={{ flexBasis: 100 }} onClick={() => tag(w, true)}>Mine</button>
                  <button className="btn grow" style={{ flexBasis: 100 }} onClick={() => tag(w, false)}>Not mine</button>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2>How this demo works</h2>
            <ul className="flags muted">
              <li>“Add to calendar” saves an .ics file you open in Outlook.</li>
              <li>“Approve” saves an .eml file that opens as an unsent draft.</li>
              <li>AI replies are rule-based samples until a Claude key is added.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
