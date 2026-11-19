import { useEffect, useState, useCallback } from 'react';
import { seedState, WEBSITE_POOL } from './sample.js';
import { startOfDay, addDays } from './dates.js';

const KEY = 'caseload-assistant-v1';
export const uid = () => Math.random().toString(36).slice(2, 10);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable */
  }
  return seedState();
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export function normAddress(a = '') {
  return a.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Simulated sweep of the company website: reveals the next listings from the
// sample pool and matches any pre-market caseload property by address.
export function runSweep(state, count = 2) {
  const seen = new Set(state.website.map((w) => normAddress(w.address)));
  const fresh = WEBSITE_POOL.filter((w) => !seen.has(normAddress(w.address))).slice(0, count);
  const now = new Date().toISOString();
  const website = [...state.website, ...fresh.map((w) => ({ ...w, id: uid(), foundAt: now, tag: null }))];
  const alerts = [];
  const events = [...state.events];
  const properties = state.properties.map((p) => {
    if (p.status !== 'premarket') return p;
    const hit = website.find((w) => normAddress(w.address).startsWith(normAddress(p.address.split(',')[0])) || normAddress(w.address) === normAddress(p.address));
    if (!hit) return p;
    alerts.push({ id: uid(), propertyId: p.id, text: `${p.address.split(',')[0]} is now live on the website. Weekly update set up. Add seller details to finish the profile.` });
    // Weekly check-in: same weekday as go-live, starting next week.
    const first = addDays(startOfDay(new Date()), 7);
    first.setHours(10, 0, 0, 0);
    events.push({ id: uid(), title: `Weekly update, ${p.address.split(',')[0]}`, start: first.toISOString(), duration: 15, kind: 'task', propertyId: p.id, weekly: true });
    const profileAt = startOfDay(new Date());
    profileAt.setHours(17, 0, 0, 0);
    events.push({ id: uid(), title: `Add seller profile, ${p.address.split(',')[0]}`, start: profileAt.toISOString(), duration: 15, kind: 'task', propertyId: p.id });
    return { ...p, status: 'live', liveSince: now, price: p.price || hit.price, beds: p.beds || hit.beds, type: p.type || hit.type, needsProfile: true };
  });
  // Mark website listings that match caseload properties as "mine".
  const tagged = website.map((w) => (properties.some((p) => p.mine && normAddress(w.address) === normAddress(p.address)) ? { ...w, tag: 'mine', matched: true } : w));
  return { ...state, website: tagged, properties, events, lastSweep: now, alerts: [...(state.alerts || []), ...alerts], lastFound: fresh.length };
}

export function useStore() {
  const [state, setState] = useState(() => {
    let s = load();
    // "Nightly" sweep: run once per day on first open.
    if (!s.lastSweep || startOfDay(new Date(s.lastSweep)) < startOfDay(new Date())) s = runSweep(s, 2);
    return s;
  });
  useEffect(() => save(state), [state]);
  const update = useCallback((fn) => setState((s) => fn(s)), []);
  const reset = useCallback(() => setState(runSweep(seedState(), 2)), []);
  return [state, update, reset];
}
