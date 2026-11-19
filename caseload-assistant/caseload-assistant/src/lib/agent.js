// Sample "AI" agent. Rule-based so the demo runs with no API key.
// Each function has the same inputs/outputs a real Claude call would have,
// so it can be swapped for a model call later without touching the pages.
import { findDay, findTime, withTime, addDays, startOfDay, fmtDay, fmtTime } from './dates.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export function shortAddress(address = '') {
  return address.split(',')[0].trim();
}

// Find properties whose street address appears in the text.
export function findProperties(text, properties) {
  const t = text.toLowerCase();
  return properties.filter((p) => {
    const short = shortAddress(p.address).toLowerCase();
    const noNumber = short.replace(/^\d+[a-z]?\s+/, '');
    return t.includes(short) || (noNumber.length > 4 && t.includes(noNumber));
  });
}

function splitClauses(text) {
  return text
    .split(/(?<=[.!?;])\s+|\n+|,?\s+(?:and then|then|also)\s+|,\s*and\s+(?=(?:call|ring|phone|chase|email|send|book|remind|follow|check|update|arrange)\b)|\s+and\s+(?=(?:call|ring|phone|chase|email|send|book|remind|follow|check|update|arrange)\b)/i)
    .map((s) => s.trim().replace(/[.!?]$/, ''))
    .filter(Boolean);
}

const WHEN = /\b(on |by |at |this |next )?(today|tomorrow|tonight|morning|afternoon|evening|next week|(mon|tues|tue|wednes|wed|thurs|thu|fri|satur|sat|sun)(day)?|\d{1,2}([:.]\d{2})?\s*(am|pm)?)\b/gi;
function stripWhen(s) {
  return s.replace(WHEN, '').replace(/\b(on|at|by|this|next)\s*$/i, '').replace(/\s+/g, ' ').trim();
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function classify(clause) {
  const c = clause.toLowerCase();
  if (/second viewing|viewing (on|at|for)|book (a |another )?viewing|arrange (a )?viewing/.test(c)) return 'viewing';
  if (/\b(call|ring|phone|speak to)\b/.test(c)) return 'call';
  if (/\b(chase|follow up|follow-up|check with|nudge)\b/.test(c)) return 'chase';
  if (/\b(email|send|write to)\b/.test(c)) return 'email';
  if (/\b(remind|reminder|don't forget|remember)\b/.test(c)) return 'reminder';
  if (/\bvaluation\b/.test(c)) return 'valuation';
  if (/\bviewing\b/.test(c) && /\b(went|was|happened|done|feedback)\b/.test(c)) return 'viewing-done';
  return null;
}

function who(c) {
  c = c.toLowerCase();
  if (/\bseller|vendor|client\b/.test(c)) return 'seller';
  if (/\bbuyer|viewer|purchaser|applicant\b/.test(c)) return 'buyer';
  if (/\blegal|solicitor|conveyanc|title\b/.test(c)) return 'internal legal';
  if (/\bsurveyor\b/.test(c)) return 'surveyor';
  if (/\bmortgage|broker|lender\b/.test(c)) return 'mortgage adviser';
  return null;
}

function nextWorkingSlot(base, h = 9, m = 30) {
  let d = addDays(startOfDay(base), 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return withTime(d, { h, m });
}

// Turn a couple of sentences into proposed calendar entries.
export function planFromPrompt(text, properties, selectedIds = [], now = new Date()) {
  const found = findProperties(text, properties);
  const ids = [...new Set([...selectedIds, ...found.map((p) => p.id)])];
  const prop = properties.find((p) => p.id === ids[0]);
  const addr = prop ? shortAddress(prop.address) : '';
  const tag = addr ? `, ${addr}` : '';
  const events = [];
  let viewingAt = null;

  const addrPatterns = properties.flatMap((p) => {
    const short = shortAddress(p.address);
    return [short, short.replace(/^\d+[a-z]?\s+/i, '')];
  }).filter((x) => x.length > 4).sort((a, b) => b.length - a.length);
  const stripAddr = (c) => addrPatterns.reduce((acc, a) => acc.replace(new RegExp(`\\s*\\b(at|for|about|re|on)?\\s*${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'ig'), ''), c);

  for (const raw of splitClauses(text)) {
    const kind = classify(raw);
    const clause = stripAddr(raw);
    if (!kind) continue;
    const day = findDay(clause, now);
    const time = findTime(clause);
    const person = who(clause);
    let start = day ? withTime(day, time || { h: 9, m: 30 }) : time ? withTime(startOfDay(now), time) : nextWorkingSlot(now);
    if (start < now && !day) start = nextWorkingSlot(now, time?.h ?? 9, time?.m ?? 30);
    const lower = clause.toLowerCase();

    if (kind === 'viewing') {
      const second = /second/.test(lower);
      events.push({ title: `${second ? 'Second viewing' : 'Viewing'}${tag}`, start, duration: 30, kind: 'event' });
      viewingAt = start;
    } else if (kind === 'call') {
      const about = lower.match(/\b(with|about|re)\b (.+)$/);
      const topic = about ? ` ${about[1]} ${stripWhen(about[2])}` : '';
      events.push({ title: cap(`call ${person || 'back'}${topic}`.trim()) + tag, start, duration: 15, kind: 'task', who: person });
    } else if (kind === 'chase') {
      const rest = clause.replace(/^.*?\b(chase|follow up with|follow up|follow-up|check with|nudge)\b\s*/i, '');
      events.push({ title: cap(`chase ${stripWhen(rest)}`.trim()) + tag, start, duration: 15, kind: 'task', who: person });
    } else if (kind === 'email') {
      events.push({ title: cap(`email ${person || 'update'}`) + tag, start, duration: 15, kind: 'task', who: person, email: true });
    } else if (kind === 'reminder') {
      const rest = clause.replace(/^.*?\b(remind me to|remind me|reminder to|reminder|don't forget to|remember to)\b\s*/i, '');
      const r = stripWhen(rest);
      events.push({ title: cap(r) + (addr && r.toLowerCase().includes(addr.toLowerCase()) ? '' : tag), start, duration: 15, kind: 'task' });
    } else if (kind === 'valuation') {
      events.push({ title: `Valuation${tag}`, start, duration: 60, kind: 'event' });
    } else if (kind === 'viewing-done') {
      events.push({ title: `Send viewing feedback to seller${tag}`, start: nextWorkingSlot(now, 10, 0), duration: 15, kind: 'task', who: 'seller', email: true });
    }
  }

  if (viewingAt) {
    const log = new Date(viewingAt.getTime() + 60 * 60 * 1000);
    events.push({ title: `Log viewing outcome${tag}`, start: log, duration: 15, kind: 'task', note: 'Prompts a caseload update' });
  }

  if (!events.length && text.trim()) {
    const day = findDay(text, now);
    const time = findTime(text);
    const start = day ? withTime(day, time || { h: 9, m: 30 }) : time ? withTime(startOfDay(now), time) : nextWorkingSlot(now);
    events.push({ title: cap(text.trim().replace(/[.!?]$/, '').slice(0, 80)), start, duration: 15, kind: 'task' });
  }

  return {
    propertyIds: ids,
    events: events.map((e) => ({ ...e, id: uid(), start: e.start.toISOString(), propertyId: ids[0] || null })),
  };
}

// Apply a short refinement instruction to proposed entries.
export function refineEvents(events, instruction, now = new Date()) {
  const ins = instruction.toLowerCase();
  const words = ins.split(/\W+/).filter((w) => w.length > 3 && !['move', 'make', 'change', 'push', 'bring', 'should', 'instead', 'from', 'with', 'into', 'afternoon', 'morning', 'earlier', 'later', 'minutes', 'tomorrow', 'remove', 'delete', 'drop'].includes(w));
  const target = (e) => !words.length || words.some((w) => e.title.toLowerCase().includes(w));
  let out = events.map((e) => ({ ...e }));
  const anyMatch = out.some((e) => words.length && words.some((w) => e.title.toLowerCase().includes(w)));
  const hits = (e) => (anyMatch ? target(e) : true);

  if (/\b(remove|delete|drop)\b/.test(ins)) {
    return anyMatch ? out.filter((e) => !target(e)) : out.slice(0, -1);
  }
  const day = findDay(ins, now);
  const time = findTime(ins);
  const dur = ins.match(/(\d+)\s*(min|minute|minutes|mins|hour|hours|hr)/);
  out = out.map((e) => {
    if (!hits(e)) return e;
    let start = new Date(e.start);
    if (day) start = withTime(day, { h: start.getHours(), m: start.getMinutes() });
    if (time) start = withTime(start, time);
    if (/\bearlier\b/.test(ins)) start = new Date(start.getTime() - 60 * 60 * 1000);
    if (/\blater\b/.test(ins)) start = new Date(start.getTime() + 60 * 60 * 1000);
    const duration = dur ? (+dur[1]) * (/h/.test(dur[2]) ? 60 : 1) : e.duration;
    return { ...e, start: start.toISOString(), duration };
  });
  return out;
}

// ---- Emails ----

function voiceStyle(voice = '') {
  const v = voice.toLowerCase();
  return {
    brief: /short|brief|concise|busy|to the point|factual/.test(v),
    warm: /warm|chatty|friendly|nervous|anxious|reassur/.test(v),
    formal: /formal|traditional|professional manner|sir|madam/.test(v),
    wantsRec: /recommend|clear next|decisive|direct/.test(v),
    prefersCall: /phone|call over email/.test(v),
  };
}

function lastNotes(prop, n = 2) {
  return [...(prop?.notes || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}

function nextStep(prop, prompt) {
  const p = prompt.toLowerCase();
  const recent = lastNotes(prop, 3).map((x) => x.text.toLowerCase()).join(' ');
  if (/offer/.test(p + recent)) return 'If an offer comes in I will call you straight away so we can talk through the position and whether to set a closing date.';
  if (/second viewing/.test(p + recent)) return 'If the second viewing goes well, I suggest we prepare for a closing date so we get the best result from any competing interest.';
  if (/quiet|no interest|slow|nothing/.test(p + recent)) return 'I would like to have a short strategy chat this week to look at the photos, the advert wording and the asking price together.';
  return 'I will keep the viewings coming and update you as soon as there is feedback.';
}

export function draftEmail({ recipient, prop, prompt, voice }) {
  const addr = prop ? shortAddress(prop.address) : '[address]';
  const s = voiceStyle(voice ?? prop?.voice);
  const notes = lastNotes(prop, 2);
  const promptLine = prompt?.trim() ? prompt.trim().replace(/\s+/g, ' ') : '';
  let subject = '';
  let body = '';

  if (recipient === 'seller') {
    subject = `Update on ${addr}`;
    const greet = s.formal ? 'Dear [Seller name],' : 'Hi [Seller first name],';
    const open = s.warm
      ? `I hope you are both keeping well. I wanted to give you a quick update on how things are going at ${addr}.`
      : `A quick update on ${addr}.`;
    const facts = promptLine
      ? toSecondPerson(promptLine)
      : notes.length
        ? notes.map((n) => n.text).join(' ')
        : 'There has been steady interest online this week.';
    const rec = s.wantsRec || !s.brief ? nextStep(prop, promptLine) : '';
    const call = s.prefersCall ? 'I will give you a ring as well so we can talk it through.' : '';
    const close = s.warm ? 'Please do call me any time if you have questions.' : '';
    body = [greet, open, facts, rec, call, close, 'Kind regards,\n[Your name]'].filter(Boolean).join('\n\n');
  } else if (recipient === 'buyer') {
    subject = `${addr} – following up`;
    body = [
      'Hi [Buyer first name],',
      '',
      `Thank you for coming to view ${addr}. I hope you enjoyed seeing it.`,
      '',
      promptLine ? toSecondPerson(promptLine) : 'I would love to hear your thoughts, good or bad, as the seller is keen for feedback.',
      '',
      'If you would like a second viewing, the Home Report, or to note interest with your solicitor, just reply to this email.',
      '',
      'Kind regards,',
      '[Your name]',
    ].join('\n');
  } else if (recipient === 'internal legal') {
    subject = `${addr} – legal query`;
    body = [
      'Hi [Name],',
      '',
      `Could you give me an update on ${addr}?`,
      '',
      promptLine || 'Specifically, where we are with the title and any outstanding queries.',
      '',
      'I am speaking to the seller this week so anything I can pass on would help.',
      '',
      'Thanks,',
      '[Your name]',
    ].join('\n');
  } else {
    subject = `${addr} – status summary`;
    const days = prop?.liveSince ? Math.round((Date.now() - new Date(prop.liveSince)) / 86400000) : null;
    body = [
      'Hi [Name],',
      '',
      `Status for ${addr}${prop?.price ? ` (${prop.price})` : ''}:`,
      '',
      days !== null ? `• On the market ${days} days` : '• Not yet on the market',
      `• ${prop?.notes?.filter((n) => /viewing/i.test(n.kind)).length || 0} viewings logged`,
      ...notes.map((n) => `• ${n.text}`),
      promptLine ? `• ${promptLine}` : '',
      '',
      'Thanks,',
      '[Your name]',
    ].join('\n');
  }
  return { subject, body };
}

function toSecondPerson(text) {
  return cap(
    text
      .replace(/\b(call|ring|phone) (the )?seller\b[^.]*\.?/gi, '')
      .replace(/\bchase (internal )?legal\b[^.]*\.?/gi, '')
      .replace(/\bthe seller('s)?\b/gi, (m, s) => (s ? 'your' : 'you'))
      .replace(/\s+/g, ' ')
      .trim(),
  ) || 'Things are moving along well.';
}

export function refineEmail(email, instruction) {
  const ins = instruction.toLowerCase();
  let { subject, body } = email;
  const lines = body.split('\n');
  if (/shorter|brief|concise|cut/.test(ins)) {
    const greet = lines[0];
    const sign = lines.slice(-2);
    const mid = lines.slice(1, -2).filter((l) => l.trim());
    const short = mid.slice(0, 2).map((l) => l.split(/(?<=\.)\s/)[0]);
    body = [greet, '', ...short.flatMap((l) => [l, '']), ...sign].join('\n');
  }
  if (/formal/.test(ins)) body = body.replace(/^Hi (\[[^\]]+\]),/, (m, n) => `Dear ${n.replace('first name', 'name')},`).replace('Thanks,', 'Kind regards,');
  if (/casual|friendl|warm/.test(ins)) body = body.replace(/^Dear (\[[^\]]+\]),/, 'Hi $1,').replace(/\n\nKind regards,/, '\n\nPlease do call me any time.\n\nBest wishes,');
  const add = instruction.match(/\b(?:add|mention|include)\b (?:that )?(.+)$/i);
  if (add) {
    const idx = body.lastIndexOf('\n\n');
    const sentence = cap(add[1].replace(/[.]$/, '')) + '.';
    body = body.slice(0, idx) + '\n\n' + sentence + body.slice(idx);
  }
  const subj = instruction.match(/subject (?:to |line )?["']?(.+?)["']?$/i);
  if (subj) subject = subj[1];
  return { subject, body };
}

// ---- Home report scan ----
const CONCERN_WORDS = ['damp', 'rot', 'woodworm', 'subsidence', 'movement', 'crack', 'asbestos', 'roof', 'wiring', 'electrical', 'drainage', 'boiler', 'japanese knotweed', 'flood', 'lintel', 'chimney', 'render', 'cladding', 'leak'];

export function scanHomeReport(text = '') {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const cat3 = [];
  const cat2 = [];
  const concerns = [];
  for (const l of lines) {
    const low = l.toLowerCase();
    const m = l.match(/^[a-z][a-z ,&'()/-]*?\s([123])\b(?:\s*[-–:].*)?$/i) || low.match(/(?:repair )?category:?\s*([123])\b/);
    const cat = m ? m[1] : null;
    if (cat === '3') cat3.push(l);
    else if (cat === '2') cat2.push(l);
    const w = CONCERN_WORDS.find((c) => low.includes(c));
    if (w && cat !== '1' && !concerns.includes(l)) concerns.push(l);
  }
  const value = text.match(/market value[^£\d]*£\s?([\d,]+)/i) || text.match(/valuation[^£\d]*£\s?([\d,]+)/i);
  const council = text.match(/council tax band[:\s]*([A-H])\b/i);
  const epc = text.match(/(?:epc|energy efficiency) (?:rating|band)[:\s]*([A-G])\b/i);
  return {
    marketValue: value ? `£${value[1]}` : null,
    councilTax: council ? council[1].toUpperCase() : null,
    epc: epc ? epc[1].toUpperCase() : null,
    cat3,
    cat2,
    concerns: concerns.filter((c) => !cat3.includes(c) && !cat2.includes(c)).slice(0, 8),
  };
}

// Pre-market brief, built from what was scanned plus seller context.
export function goLiveBrief(prop) {
  const r = prop.homeReport?.scan;
  const lines = [];
  lines.push(`Go-live call: ${shortAddress(prop.address)}`);
  if (r?.marketValue) lines.push(`Home report value ${r.marketValue}. Suggest marketing at offers over around ${r.marketValue}.`);
  if (r?.cat3?.length) lines.push(`Raise the Category 3 item(s) early, with a plan: ${r.cat3.join('; ')}.`);
  if (r?.cat2?.length) lines.push(`Category 2 items buyers may ask about: ${r.cat2.slice(0, 3).join('; ')}.`);
  if (r?.epc) lines.push(`EPC band ${r.epc}${'EFG'.includes(r.epc) ? ', so expect running-cost questions' : ''}.`);
  lines.push('Agree on viewing availability, who attends, and how they want updates (email, call, weekly day).');
  lines.push('Confirm goals, timescale and onward plans to set the strategy.');
  return lines;
}

// What to talk to the seller about next.
export function talkingPoint(prop, now = new Date()) {
  const notes = lastNotes(prop, 5);
  const last = notes[0];
  const ref = last ? last.date : prop.liveSince;
  const daysSince = ref ? Math.floor((now - new Date(ref)) / 86400000) : Infinity;
  if (!last && daysSince < 7) {
    return { text: 'Newly live. Agree on viewing availability and how the seller wants weekly updates.' };
  }
  if (!last || daysSince >= 7) {
    return {
      strategy: true,
      text: `Nothing logged for ${Number.isFinite(daysSince) ? `${daysSince} days` : 'this property yet'}. Time for a strategy discussion: review price, photos, advert wording and viewing feedback with the seller.`,
    };
  }
  const t = last.text.toLowerCase();
  if (/second viewing/.test(t)) return { text: 'Second viewing coming up. Prepare the seller for a possible closing date conversation.' };
  if (/offer/.test(t)) return { text: 'An offer is on the table. Talk through the position, conditions and timescale with the seller.' };
  if (/viewing/.test(t)) return { text: 'Share the latest viewing feedback with the seller and agree on any changes.' };
  return { text: `Follow up on: ${last.text}` };
}

export { fmtDay, fmtTime };
