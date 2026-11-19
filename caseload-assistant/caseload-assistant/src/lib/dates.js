export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function fmtDay(d) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDayTime(d) {
  return `${fmtDay(d)}, ${fmtTime(d)}`;
}

// Find a day reference in text, relative to `base`. Returns a Date or null.
export function findDay(text, base = new Date()) {
  const t = text.toLowerCase();
  if (/\btoday\b|\bthis (morning|afternoon|evening)\b|\btonight\b/.test(t)) return startOfDay(base);
  if (/\btomorrow\b/.test(t)) return addDays(startOfDay(base), 1);
  if (/\bnext week\b/.test(t)) return addDays(startOfDay(base), 7);
  for (let i = 0; i < 7; i++) {
    const name = DAYS[i];
    const re = new RegExp(`\\b(next )?(${name}|${name.slice(0, 3)})\\b`);
    const m = t.match(re);
    if (m) {
      let diff = (i - base.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      if (m[1]) diff += diff < 7 ? 7 : 0;
      return addDays(startOfDay(base), diff);
    }
  }
  return null;
}

// Find a clock time in text. Returns {h, m} or null.
export function findTime(text) {
  const t = text.toLowerCase();
  let m = t.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/);
  if (m) {
    let h = +m[1];
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    return { h, m: +m[2] };
  }
  m = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let h = +m[1];
    if (m[2] === 'pm' && h < 12) h += 12;
    if (m[2] === 'am' && h === 12) h = 0;
    return { h, m: 0 };
  }
  m = t.match(/\bat (\d{1,2})\b/);
  if (m) {
    let h = +m[1];
    if (h < 8) h += 12; // "at 2" in office hours means 14:00
    return { h, m: 0 };
  }
  if (/\bmorning\b/.test(t)) return { h: 10, m: 0 };
  if (/\bafternoon\b/.test(t)) return { h: 14, m: 0 };
  if (/\bevening\b|\btonight\b/.test(t)) return { h: 17, m: 30 };
  if (/\blunch\b/.test(t)) return { h: 12, m: 30 };
  return null;
}

export function withTime(day, time) {
  const d = new Date(day);
  d.setHours(time.h, time.m, 0, 0);
  return d;
}
