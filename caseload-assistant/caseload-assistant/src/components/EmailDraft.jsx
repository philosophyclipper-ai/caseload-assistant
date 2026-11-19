import { useState } from 'react';
import { refineEmail } from '../lib/agent.js';
import { buildEml, download, slug } from '../lib/exporters.js';

const LABEL = { seller: 'Seller', buyer: 'Buyer', 'internal legal': 'Internal legal', corporate: 'Corporate' };

export default function EmailDraft({ draft, onChange, onApprove, notify, toneNote }) {
  const [refine, setRefine] = useState('');
  const id = `email-${draft.recipient.replace(/\s/g, '-')}`;

  const applyRefine = () => {
    if (!refine.trim()) return;
    onChange(refineEmail(draft, refine));
    setRefine('');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      notify('Email copied');
    } catch {
      notify('Copy blocked by the browser. Select the text instead.');
    }
  };
  const approve = () => {
    download(`${slug(draft.subject)}.eml`, buildEml(draft), 'message/rfc822');
    onApprove?.(draft);
    notify('Draft saved. Open the .eml file and Outlook shows it as an unsent draft.');
  };

  return (
    <div className="card">
      <div className="inline">
        <h2 className="grow">Email draft to {LABEL[draft.recipient] || draft.recipient}</h2>
        {draft.approved && <span className="badge">Approved</span>}
      </div>
      {toneNote && <div className="muted">Tone from seller voice: {toneNote}</div>}
      <div>
        <label className="lbl" htmlFor={`${id}-subj`}>Subject</label>
        <input id={`${id}-subj`} type="text" value={draft.subject} onChange={(e) => onChange({ ...draft, subject: e.target.value })} />
      </div>
      <div>
        <label className="lbl" htmlFor={`${id}-body`}>Body</label>
        <textarea id={`${id}-body`} className="email-edit" value={draft.body} onChange={(e) => onChange({ ...draft, body: e.target.value })} rows={10} />
      </div>
      <div className="inline" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <label className="lbl" htmlFor={`${id}-refine`}>Refine this email</label>
          <input id={`${id}-refine`} type="text" value={refine} onChange={(e) => setRefine(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyRefine()} placeholder="e.g. shorter · more formal · add that the entry date is flexible" />
        </div>
        <button className="btn" onClick={applyRefine}>Refine</button>
      </div>
      <div className="inline right">
        <button className="btn" onClick={copy}>Copy text</button>
        <button className="btn primary" onClick={approve}>Approve and save as draft</button>
      </div>
    </div>
  );
}
