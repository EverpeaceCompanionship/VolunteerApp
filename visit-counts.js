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

const VISIT_BASELINES = [
  // { name: 'Full Legal Name', email: 'name@example.com', phone: '6135550000', visits: 0 },
];

// ── Helpers (shared) ────────────────────────────────────────
function _vcNorm(s)   { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function _vcDigits(s) { return String(s || '').replace(/\D/g, '').slice(-10); }

// Returns the baseline entry for a volunteer, or null if not listed
function findVisitBaseline({ name, email, phone } = {}) {
  const n = _vcNorm(name), e = _vcNorm(email), p = _vcDigits(phone);
  return VISIT_BASELINES.find(b => e && _vcNorm(b.email) === e)
      || VISIT_BASELINES.find(b => p.length >= 7 && _vcDigits(b.phone) === p)
      || VISIT_BASELINES.find(b => n && _vcNorm(b.name) === n)
      || null;
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
