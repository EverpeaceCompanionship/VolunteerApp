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
//   • Put each volunteer's exact total in `visits`. Match is by email, then phone,
//     then full name (any one is enough; case and spacing don't matter).
//   • A volunteer NOT listed here keeps the previous automatic count.
//   • To re-baseline later: update every `visits` and move BASELINE_DATE to that day.
// ============================================================

const BASELINE_DATE = '2026-11-05';   // counts below include every visit up to and including this day

// Source: Google Calendar export "All the visits till today 2026_11_05" (132 visits, 29 May → 3 Nov 2026).
// Each volunteer named in a visit gets 1 (a visit by 2 volunteers counts for both).
// Eid visits (29 May – 7 Jun) assigned from Nadouche's list (5 Nov); Nadia's total = her own list (2 Eid + 20).
// Grandpa Daniel Eid visits of 3, 5 and 6 June were done by Habiba Hadiri (former volunteer).
const VISIT_BASELINES = [
  // { name: 'Full Legal Name', aliases: ['Other spelling'], email: '', phone: '', visits: 0 },
  { name: "Nadia Olfa Kebaier", aliases: ["Nadia Kebaier", "Nadia Olfa"], email: '', phone: '', visits: 22 },
  { name: "Rai Muhammad Wassay", aliases: ["Rai Mohammad Wassay"], email: '', phone: '', visits: 8 },
  { name: "Lorin Soultan", aliases: ["Lori Lee Soultan", "Lori Soultan"], email: '', phone: '', visits: 7 },
  { name: "Mohammed Abdelghani", aliases: ["Mohamed Abdelghani", "Muhammad Abdelghani"], email: '', phone: '', visits: 7 },
  { name: "Muaad Ali Saleh Al-Shaibi", aliases: ["Muaad Al-Shaibi", "Muaad Al Shaibi"], email: '', phone: '', visits: 7 },
  { name: "Nusaybah Elfarawi", aliases: ["Nusayba Elfarawi"], email: '', phone: '', visits: 7 },
  { name: "Abdurrahman Elfarawi", aliases: [], email: '', phone: '', visits: 6 },
  { name: "Omar Badr", aliases: [], email: '', phone: '', visits: 6 },
  { name: "Roxana Ghoreishi", aliases: [], email: '', phone: '', visits: 7 },
  { name: "Muhammad Maahir", aliases: ["Muhammed Maahir", "Mohammed Maahir"], email: '', phone: '', visits: 5 },
  { name: "Muhammad Qasim", aliases: ["Mohammed Qasim", "Mohamed Qasim"], email: '', phone: '', visits: 5 },
  { name: "Thanaa Al Shaibi", aliases: ["Thana Al Shaibi", "Thanaa Al-Shaibi"], email: '', phone: '', visits: 5 },
  { name: "Naeem Ahmed", aliases: [], email: '', phone: '', visits: 5 },
  { name: "Ryma Iskounene", aliases: [], email: '', phone: '', visits: 5 },
  { name: "Habib Ur Rahman Bharti", aliases: ["Habib-ur-Rahman Bharti", "Habib Rahman Bharti"], email: '', phone: '', visits: 3 },
  { name: "Habiba Hadiri", aliases: ["Sophia Amani"], email: '', phone: '', visits: 6, former: true },   // former volunteer — Eid 3, 5, 6 Jun + 12, 14, 18 Jun
  { name: "Ilham Rahimi", aliases: ["İlham Rahimi"], email: '', phone: '', visits: 3 },
  { name: "Lydia Boumaarafi", aliases: [], email: '', phone: '', visits: 3 },
  { name: "Malak Beshr", aliases: [], email: '', phone: '', visits: 4 },
  { name: "Sajeda Almalki", aliases: [], email: '', phone: '', visits: 3 },
  { name: "Sawsan Ibrahim", aliases: ["Sawssan Ibrahim"], email: '', phone: '', visits: 3 },
  { name: "Zeinab Karbo", aliases: ["Zeineb Karbo"], email: '', phone: '', visits: 4 },
  { name: "Zeineb Rais", aliases: ["Zeinab Rais"], email: '', phone: '', visits: 3 },
  { name: "Abdou El Bashtaly", aliases: [], email: '', phone: '', visits: 2 },
  { name: "Aimanete Aboufatma", aliases: [], email: '', phone: '', visits: 2 },
  { name: "Asma Abdisamad", aliases: [], email: '', phone: '', visits: 2 },
  { name: "Hassan Yassin", aliases: ["Hassen Yassin"], email: '', phone: '', visits: 3 },
  { name: "Mohamed Abdel Baky", aliases: ["Mohammed Abdel Baky", "Mohamed Abdelbaky"], email: '', phone: '', visits: 2 },
  { name: "Randa Hassan", aliases: [], email: '', phone: '', visits: 3 },
  { name: "Eman Selim", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Amal Khan", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Asma Jawed", aliases: [], email: '', phone: '', visits: 2 },
  { name: "Awa Diop", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Aya Gadi", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Faduma Hagi", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Faiza Ahmed-Hassan", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Hosai Zurmati-Halim", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Khadija Siddiqi", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Kongling Bai", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Leila Abdi", aliases: [], email: '', phone: '', visits: 0 },   // 9 Jul visit (Adam) unconfirmed — volunteer stopped responding
  { name: "Mandeek Mohamud", aliases: [], email: '', phone: '', visits: 1, former: true },
  { name: "Manel", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Mayar Ahrir", aliases: ["Mayar Amri"], email: '', phone: '', visits: 1, former: true },
  { name: "Melek Delice", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Nourhan Mohamed", aliases: [], email: '', phone: '', visits: 1 },
  { name: "Maryam Maafi", aliases: ["Oummou Rayan"], email: '', phone: '', visits: 1, former: true },   // calendar: "Sr Oummou Rayan", 29 Jul
  { name: "Wafa", aliases: [], email: '', phone: '', visits: 1 },
];

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
// "6V-Hadiri Habiba OUT for safety reasons (1969/01/01)" → "Hadiri Habiba"
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
// other (handles middle names, e.g. "Lorin Soultan" ↔ "Lorin A. Soultan") →
// single-name entries (e.g. "Mandeek") only when that first name is unique.
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
const FORMER_VOLUNTEERS = [
  { name: 'Habiba Hadiri',   aliases: ['Sophia Amani'], email: '', phone: '', note: 'Dismissed June 2026' },
  { name: 'Mandeek Mohamud', aliases: [],               email: '', phone: '', note: 'Former volunteer (1 visit)' },
  { name: 'Maryam Maafi',    aliases: ['Oummou Rayan'], email: '', phone: '', note: 'Former volunteer (1 visit)' },
  { name: 'Mayar Ahrir',     aliases: ['Mayar Amri'],   email: '', phone: '', note: 'Former volunteer (1 visit)' },
  // ── Inactive — blocked FOR NOW (5 Nov 2026). To let someone back in, delete their line. ──
  { name: 'Laura Sicoli',       aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Sufia Quazi',        aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Ines Attouchi',      aliases: ['Inès Attouchi'], email: '', phone: '', note: 'Inactive' },
  { name: 'Abdul Waheed Butt',  aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Armeen Mazhar',      aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Mariam Abouseta',    aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Suha Maryam Ali',    aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Hafsah Butt',        aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Zaiba Fatima Ali',   aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Hafsa Khan Younis',  aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Houdayfa Karbo',     aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Najma Bhati',        aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Souad Djama',        aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Leila Abdi',         aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Natasha Hernandez',  aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Wassim Abu Zarad',   aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Rayan Ghoreishi',    aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Halima Osmane',      aliases: [], email: '', phone: '', note: 'Inactive' },
  { name: 'Hannah Karimah',     aliases: [], email: '', phone: '', note: 'Inactive — "Hannah mom of Karimah"' },
];
function isFormerVolunteer({ name, email, phone } = {}) {
  const n = _vcNorm(name), e = String(email || '').toLowerCase().trim(), p = _vcDigits(phone);
  return FORMER_VOLUNTEERS.some(f => {
    if (e && String(f.email || '').toLowerCase().trim() === e) return true;
    if (p.length >= 7 && _vcDigits(f.phone) === p) return true;
    if (!n) return false;
    // Only "every word of the blocked name appears in the volunteer's record" —
    // never the reverse, so an active "Maryam Ali" is NOT blocked by "Suha Maryam Ali".
    return _vcNames(f).some(x => x === n || (x.includes(' ') && _vcTokensIn(x, n)));
  });
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
