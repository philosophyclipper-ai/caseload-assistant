// Fictional sample data so the demo works with nothing connected.
import { addDays, startOfDay } from './dates.js';
import { scanHomeReport } from './agent.js';

const SAMPLE_REPORT = `Market value: £320,000
Council tax band: E
EPC rating: D
Chimney stacks 1
Roofing including roof space 2
Rainwater fittings 2
Main walls 1
Windows, external doors and joinery 2
Dampness, rot and infestation 3 - evidence of wet rot to timber below the kitchen window
Electricity 2 - installation appears dated, recommend inspection by a registered electrician
Drainage 1`;

export const WEBSITE_POOL = [
  { address: '7 Sample Gardens, Edinburgh, EH6 4AA', price: 'Offers over £245,000', beds: 2, type: 'Flat' },
  { address: '22 Placeholder Road, Edinburgh, EH10 5BB', price: 'Fixed price £410,000', beds: 4, type: 'Semi-detached house' },
  { address: '5 Draft Place, Edinburgh, EH11 2EF', price: 'Offers over £299,000', beds: 3, type: 'Main-door flat' },
  { address: '41 Mockup Street, Edinburgh, EH7 3DD', price: 'Offers over £189,000', beds: 1, type: 'Flat' },
  { address: '18 Fiction Place, Edinburgh, EH12 6EE', price: 'Offers over £525,000', beds: 4, type: 'Detached house' },
  { address: '9 Pretend Wynd, Musselburgh, EH21 7FF', price: 'Offers over £275,000', beds: 3, type: 'Terraced house' },
];

export function seedState() {
  const today = startOfDay(new Date());
  const at = (dayOffset, h, m = 0) => {
    const d = addDays(today, dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const p1 = 'p-example-terrace';
  const p2 = 'p-mock-avenue';
  const p3 = 'p-draft-place';
  return {
    version: 1,
    lastSweep: null,
    properties: [
      {
        id: p1,
        address: '14 Example Terrace, Edinburgh, EH3 9AB',
        price: 'Offers over £365,000',
        beds: 3,
        type: 'Terraced house',
        mine: true,
        status: 'live',
        liveSince: addDays(today, -12).toISOString(),
        voice: 'Busy professional, prefers short factual updates, wants a clear recommendation each time, dislikes jargon.',
        context: {
          goals: 'Sale agreed before their onward purchase completes in spring',
          reason: 'Relocating for work',
          situation: 'Already viewing in Glasgow',
          condition: 'Well presented, kitchen dated',
          concerns: 'Worried the dated kitchen will put buyers off',
          stakeholders: 'Joint owner (partner), mortgage lender',
          personality: 'Decisive, data-led',
        },
        homeReport: null,
        notes: [
          { id: 'n1', date: at(-1, 15, 30), kind: 'Viewing', text: 'First viewing went well. Couple liked the garden, unsure about the kitchen. Asked about a second viewing.' },
          { id: 'n2', date: at(-6, 10), kind: 'Weekly update', text: 'Reported 6 enquiries and 2 viewings booked. Seller happy to hold price for now.' },
          { id: 'n3', date: at(-10, 12), kind: 'Note', text: 'Seller flexible on entry date. Mention to interested parties.' },
        ],
      },
      {
        id: p2,
        address: '9 Mock Avenue, Edinburgh, EH9 1CD',
        price: 'Offers over £480,000',
        beds: 4,
        type: 'Detached house',
        mine: true,
        status: 'live',
        liveSince: addDays(today, -26).toISOString(),
        voice: 'Retired couple, warm and chatty, appreciate a phone call over email, nervous about the market.',
        context: { goals: 'Downsize to a bungalow nearby', reason: 'Downsizing', situation: '', condition: 'Good, original bathroom', concerns: 'Slow interest', stakeholders: 'Adult son helps with decisions', personality: 'Cautious' },
        homeReport: null,
        notes: [
          { id: 'n4', date: at(-9, 11), kind: 'Check-in', text: 'Two viewings, no second interest yet. Seller anxious.' },
        ],
      },
      {
        id: p3,
        address: '5 Draft Place, Edinburgh, EH11 2EF',
        price: '',
        beds: 3,
        type: 'Flat',
        mine: true,
        status: 'premarket',
        liveSince: null,
        voice: '',
        context: {},
        homeReport: null,
        notes: [],
      },
      {
        id: 'p-sample-lane',
        address: '27 Sample Lane, Edinburgh, EH16 4GG',
        price: 'Home report £320,000',
        beds: 3,
        type: 'Semi-detached house',
        mine: true,
        status: 'premarket',
        liveSince: null,
        voice: 'First-time seller, quite anxious, likes things explained step by step and reassurance.',
        context: { reason: 'Moving closer to family', goals: 'Sell by summer' },
        homeReport: { text: SAMPLE_REPORT, scan: scanHomeReport(SAMPLE_REPORT) },
        notes: [],
      },
    ],
    website: [], // listings found on the company website by the sweep
    events: [
      { id: 'e1', title: 'Viewing, 14 Example Terrace', start: at(-1, 15), duration: 30, kind: 'event', propertyId: p1, done: true },
      { id: 'e2', title: 'Weekly update, 9 Mock Avenue', start: at(0, 9, 30), duration: 15, kind: 'task', propertyId: p2 },
      { id: 'e3', title: 'Valuation, 5 Draft Place', start: at(0, 13), duration: 60, kind: 'event', propertyId: p3 },
      { id: 'e4', title: 'Log viewing feedback, 14 Example Terrace', start: at(0, 16), duration: 15, kind: 'task', propertyId: p1 },
      { id: 'w1', title: 'Weekly update, 14 Example Terrace', start: at(-5, 10), duration: 15, kind: 'task', propertyId: p1, weekly: true },
      { id: 'w2', title: 'Weekly update, 9 Mock Avenue', start: at(-19, 15), duration: 15, kind: 'task', propertyId: p2, weekly: true },
    ],
  };
}
