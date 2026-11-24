// ============================================================
// VISIT COUNTS — single source of truth for every volunteer's total
// Loaded by BOTH volunteer-app_14.html and admin-dashboard_7.html.
//
// HOW IT WORKS
//   Live total = baseline (exact count up to BASELINE_DATE, given by Nadouche)
//              + new visits AFTER BASELINE_DATE, counted automatically:
//                  • Google Calendar: confirmed visits (36-hour rule, cancelled excluded)
//                  • Portal log:      visits the volunteer logged in "Log Visit"
//                The HIGHER of the two is used, so a visit that is both in the
//                calendar AND logged in the portal is counted once, not twice.
//
// HOW TO EDIT
//   • Put each volunteer's exact total in `visits` (in private-data.gs, Apps Script). Match is by email, then phone,
//     then full name (any one is enough; case and spacing don't matter).
//   • A volunteer NOT listed here keeps the previous automatic count.
//   • To re-baseline later: update every `visits` and move BASELINE_DATE to that day.
// ============================================================

const BASELINE_DATE = '2026-11-05';   // counts below include every visit up to and including this day

// The LISTS (each volunteer's baseline, former volunteers) are personal data,
// so they are NOT in this public file. They live in the Apps Script project
// (private-data.gs) and are sent only to a signed-in user:
//   • the coordinator dashboard gets both lists;
//   • a volunteer gets only their own baseline entry.
// Format of one entry: { name: 'Full Legal Name', aliases: ['Other spelling'], email: '', phone: '', visits: 0 }
let VISIT_BASELINES = [];

// ── Helpers (shared) ────────────────────────────────────────
// Normalise a name: lower case, no accents, no "Sr/Br/Sister/Brother", hyphens → spaces
function _vcNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/^\s*(?:\d*\s*-?\s*v|c)\s*-\s*/, '')     // Baserow prefix "6V-", "0V-", "0-V", "C-"
    .replace(/[^a-z0-9 ]/g, ' ')                   // brackets, dashes, dates → spaces
    .replace(/^\s*(sr|br|sister|brother|sheikh|cheikh)\s+/, '')
    .replace(/\s+/g, ' ').trim();
}
// Display name from Baserow's "Full Legal Name and DOB" field:
// "6V-Doe Jane OUT note (1970/01/01)" → "Doe Jane"
function cleanVolunteerName(raw) {
  const orig = String(raw || '').trim();
  let n = orig;
  // Leading Baserow codes, possibly repeated: "C-", "V-", "6V-", "0V-", "0-V", "12V -"
  for (let i = 0; i < 3; i++) {
    n = n.replace(/^\s*(?:\d+\s*V\s*-|\d*\s*-\s*V\s*-?|C\s*-|V\s*-)\s*/i, '');
    // Status notes written before the name
    n = n.replace(/^\s*(?:the form was not completed|cancel(?:led|ed)? last min(?:ute)?)\s*[-:]\s*/i, '');
  }
  // Everything after the name: OUT…, (DOB…), ": note", " - note", "and Malik…", "4 now…"
  n = n.split(/\s+[OÒ]UT\b|\s*\(|\s*:\s|\s+-\s|\s+(?:and|et|&)\s+|\s+\d/i)[0];
  n = n.replace(/[\s,;:-]+$/, '').replace(/\s+/g, ' ').trim();
  return n || orig;
}
function _vcDigits(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
function _vcNames(b) { return [b.name].concat(b.aliases || []).map(_vcNorm).filter(Boolean); }
function _vcTokensIn(small, big) {
  const B = big.split(' ');
  return small.split(' ').every(t => B.includes(t));
}

// Returns the baseline entry for a volunteer, or null if not listed.
// Order: email → phone → exact name/alias → all words of one name inside the
// other (handles middle names, e.g. "Jane Doe" ↔ "Jane A. Doe") →
// single-name entries (e.g. "Jane") only when that first name is unique.
function findVisitBaseline({ name, email, phone } = {}) {
  const n = _vcNorm(name), e = String(email || '').toLowerCase().trim(), p = _vcDigits(phone);
  const B = VISIT_BASELINES;
  let hit = (e && B.find(b => String(b.email || '').toLowerCase().trim() === e))
         || (p.length >= 7 && B.find(b => _vcDigits(b.phone) === p))
         || (n && B.find(b => _vcNames(b).includes(n)));
  if (hit || !n) return hit || null;
  if (n.includes(' ')) {
    hit = B.find(b => _vcNames(b).some(x => x.includes(' ') && (_vcTokensIn(x, n) || _vcTokensIn(n, x))));
    if (hit) return hit;
  }
  const first = n.split(' ')[0];
  const singles = B.filter(b => _vcNames(b).some(x => x === first));
  const sameFirst = B.filter(b => _vcNames(b).some(x => x.split(' ')[0] === first));
  return singles.length === 1 && sameFirst.length === 1 ? singles[0] : null;
}

// Is a calendar event a real MUSLIM SENIOR VISIT?
// Must say "visit"/"visite" in the title; webinars, lectures, events,
// international days, meetings, trainings… and all-day events are excluded.
const NON_VISIT_KEYWORDS = ['webinar', 'webinaire', 'lecture', 'conference', 'conférence', 'international day',
  'journée', 'day of', 'meeting', 'réunion', 'training', 'formation', 'workshop', 'atelier', 'event', 'événement',
  'evenement', 'seminar', 'séminaire', 'ceremony', 'cérémonie', 'gala', 'fundraiser', 'collecte', 'interview', 'entrevue',
  'orientation', 'info session', 'session d', 'cancel', 'annul'];
function isSeniorVisitEvent(ev) {
  const title = String((ev && ev.title) || '').toLowerCase();
  if (!/\bvisite?s?\b/.test(title)) return false;
  if (NON_VISIT_KEYWORDS.some(k => title.includes(k))) return false;
  if (ev.allDay) return false;
  const start = new Date(ev.start), end = new Date(ev.end);
  if (!isNaN(start) && !isNaN(end) && (end - start) >= 20 * 3600 * 1000) return false;   // all-day / multi-day
  return true;
}

// ── Former / dismissed volunteers: NO access to the volunteer portal ──
// Their past visits stay in the counts above. Matched like baselines
// (email, phone, or full name / alias — never a first name alone).
let FORMER_VOLUNTEERS = [];   // filled from the server for the dashboard (see above)

// Called after sign-in with the data the server allows this user to see
function setPrivateVisitData(d) {
  if (d && Array.isArray(d.baselines)) VISIT_BASELINES = d.baselines;
  if (d && Array.isArray(d.former))    FORMER_VOLUNTEERS = d.former;
}
function isFormerVolunteer({ name, email, phone } = {}) {
  const n = _vcNorm(name), e = String(email || '').toLowerCase().trim(), p = _vcDigits(phone);
  return FORMER_VOLUNTEERS.some(f => {
    if (e && String(f.email || '').toLowerCase().trim() === e) return true;
    if (p.length >= 7 && _vcDigits(f.phone) === p) return true;
    if (!n) return false;
    // Only "every word of the blocked name appears in the volunteer's record" —
    // never the reverse, so an active "Jane Ali" is NOT blocked by "Sara Jane Ali".
    return _vcNames(f).some(x => x === n || (x.includes(' ') && _vcTokensIn(x, n)));
  });
}

// ── Organisation total (website "Live counter" + dashboard "Total Visits ✓") ──
// Distinct VISITS (a visit by 2 volunteers to the same senior counts ONCE),
// unlike the per-volunteer totals above (which add up to more).
const ORG_VISITS_BASELINE = 133;   // exact total of distinct visits up to and including BASELINE_DATE (Nadouche, 5 Nov 2026)
function liveOrgTotal(calendarSince, portalSince) {
  return ORG_VISITS_BASELINE + Math.max(Number(calendarSince) || 0, Number(portalSince) || 0);
}

// True when a visit date (YYYY-MM-DD…) is after the baseline day
function isAfterBaseline(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d > BASELINE_DATE;
}

// baseline + the higher of the two "new since baseline" counts
function liveVisitTotal(baselineVisits, calendarSince, portalSince) {
  const extra = Math.max(Number(calendarSince) || 0, Number(portalSince) || 0);
  return (Number(baselineVisits) || 0) + extra;
}
