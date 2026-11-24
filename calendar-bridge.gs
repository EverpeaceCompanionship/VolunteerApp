// ============================================================
// EVERPEACE COMPANIONSHIP — SECURE SERVER (Google Apps Script)
// Baserow proxy + Google Calendar bridge, in ONE script.
// ============================================================
//
// WHY THIS EXISTS
//   The volunteer portal and the coordinator dashboard are public web pages
//   (GitHub Pages). Anything written inside them can be read by anyone.
//   So the Baserow token, the coordinator password and the private lists
//   (visit baselines, former volunteers) live ONLY here, on Google's servers:
//     • Baserow token            → Script Properties  (BASEROW_TOKEN)
//     • Coordinator password(s)  → Script Properties  (ADMIN_PASSWORD, COORDINATOR_PASSWORD)
//     • Extra calendar IDs       → Script Properties  (EXTRA_CALENDAR_IDS, comma-separated)
//     • Baselines / former list  → second file in this project: private-data.gs
//   Pages ask this script for data; the script checks WHO is asking:
//     • a volunteer gets only their own record, own visits, own calendar events,
//       the seniors' NAMES (for the Log Visit list) and their assigned senior;
//     • the coordinator (password) gets the full tables;
//     • the public gets only two numbers (organisation visit total).
//
// RUNS AS: coordinator@everpeacecompanionship.org   (Execute as: Me · Access: Anyone)
//   "Anyone" is required so the pages can call it; every request is still
//   checked below. Nothing is returned without a valid sign-in, except the
//   two public counts.
//
// UPDATING (keeps the same URL — do NOT create a "New deployment"):
//   Deploy → Manage deployments → ✏️ Edit → Version: "New version" → Deploy
// ============================================================

// ── Baserow tables ───────────────────────────────────────────
const BASEROW_API = 'https://api.baserow.io/api';
const T_VOLUNTEERS = 988315;
const T_SENIORS    = 917379;
const T_VISITS     = 917197;
const ALLOWED_TABLES = [T_VOLUNTEERS, T_SENIORS, T_VISITS];

// ── Sessions & lockout ───────────────────────────────────────
const VOLUNTEER_SESSION_HOURS = 12;
const ADMIN_SESSION_HOURS     = 8;
const MAX_FAILED_ATTEMPTS     = 5;     // then locked for LOCK_MINUTES
const LOCK_MINUTES            = 15;
const CODE_MINUTES            = 10;    // emailed verification code lifetime
const MAX_CODES_PER_WINDOW    = 3;     // emails per volunteer per LOCK_MINUTES
const MAX_CODE_TRIES          = 5;     // wrong codes before the code is cancelled

// ── Calendar rules (unchanged from the calendar bridge) ──────
const COMPLETED_THRESHOLD_HOURS = 36;   // hours after a visit before it counts as "confirmed done"
const CANCELLED_KEYWORDS = ['cancel', 'cancelled', 'annulé', 'annulée', 'annule'];
const NON_VISIT_KEYWORDS = ['webinar', 'webinaire', 'lecture', 'conference', 'conférence', 'international day',
  'journée', 'day of', 'meeting', 'réunion', 'training', 'formation', 'workshop', 'atelier', 'event', 'événement',
  'evenement', 'seminar', 'séminaire', 'ceremony', 'cérémonie', 'gala', 'fundraiser', 'collecte', 'interview', 'entrevue',
  'orientation', 'info session', 'session d'];

// ============================================================
// ONE-TIME SETUP — select "setup" in the toolbar and click ▶ Run.
// Approves the permissions and checks the configuration.
// ============================================================
function setup() {
  sessionSecret_();
  const p = PropertiesService.getScriptProperties();
  const problems = [];
  if (!p.getProperty('BASEROW_TOKEN'))  problems.push('BASEROW_TOKEN is missing');
  if (!p.getProperty('ADMIN_PASSWORD')) problems.push('ADMIN_PASSWORD is missing');
  else if (p.getProperty('ADMIN_PASSWORD').length < 10) problems.push('ADMIN_PASSWORD should be at least 10 characters');
  if (p.getProperty('BASEROW_TOKEN')) {
    const f = tableFields_(T_VISITS, true);
    Logger.log('✓ Baserow reachable — Visits table has ' + f.length + ' columns');
  }
  Logger.log('✓ Calendars: ' + visitCalendars_().map(c => c.getName()).join(', '));
  Logger.log('✓ Email: ' + MailApp.getRemainingDailyQuota() + ' verification emails left today');
  Logger.log('✓ Private data: ' + privateBaselines_().length + ' baselines, ' + privateFormer_().length + ' former volunteers');
  Logger.log(problems.length ? '⚠️ ' + problems.join(' · ') : '✓ Configuration complete');
}

// ============================================================
// ENTRY POINTS
// ============================================================

// GET — public, numbers only:  ?all=1&since=YYYY-MM-DD
//   → { success, visitsOnly, since, orgCompletedSince, portalSince }
// Used by the website counter (GitHub Action) and the dashboard's total.
function doGet(e) {
  const p = (e && e.parameter) || {};
  const since = String(p.since || '').trim();
  if (p.all === '1' && /^\d{4}-\d{2}-\d{2}$/.test(since)) {
    const cache = CacheService.getScriptCache();
    const key = 'orgcounts:' + since;
    const hit = cache.get(key);
    if (hit) return json_(JSON.parse(hit));
    try {
      const out = {
        success: true, visitsOnly: true, since: since,
        orgCompletedSince: orgCalendarSince_(since),
        portalSince: orgPortalSince_(since)
      };
      cache.put(key, JSON.stringify(out), 300);   // 5 min
      return json_(out);
    } catch (err) {
      return json_({ success: false, error: 'Server error' });
    }
  }
  return json_({ success: false, error: 'Sign-in required' });
}

// POST — everything else. Body (text/plain): JSON { action, session, ...data }
function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'BAD_REQUEST', message: 'Invalid request' }); }
  try {
    const fn = ACTIONS[req.action];
    if (!fn) throw apiError_('BAD_REQUEST', 'Unknown action');
    const out = fn(req) || {};
    out.ok = true;
    return json_(out);
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code, message: err.message });
    console.error(err);
    return json_({ ok: false, error: 'SERVER', message: 'Server error — please try again.' });
  }
}

const ACTIONS = {
  // ── Volunteer sign-in ──
  lookup:          (r) => actLookup_(r),
  login:           (r) => actLogin_(r),
  requestCode:     (r) => actRequestCode_(r),
  checkCode:       (r) => actCheckCode_(r),
  createPassword:  (r) => actCreatePassword_(r),
  resetPassword:   (r) => actResetPassword_(r),
  // ── Volunteer (signed in) ──
  changePassword:  (r) => actChangePassword_(r),
  fields:          (r) => actFields_(r),
  myVisits:        (r) => actMyVisits_(r),
  seniorNames:     (r) => actSeniorNames_(r),
  assignedSenior:  (r) => actAssignedSenior_(r),
  saveAvailability:(r) => actSaveAvailability_(r),
  logVisit:        (r) => actLogVisit_(r),
  myCalendar:      (r) => actMyCalendar_(r),
  // ── Coordinator (signed in) ──
  adminLogin:      (r) => actAdminLogin_(r),
  adminRows:       (r) => actAdminRows_(r),
  adminCreateVisit:(r) => actAdminCreateVisit_(r),
  adminCalendar:   (r) => actAdminCalendar_(r),
};

// ============================================================
// VOLUNTEER ACTIONS
// ============================================================

// Step 1 of the login: does this email/phone belong to a volunteer?
// Returns only the first name and whether a password exists.
function actLookup_(r) {
  const v = findVolunteerByLogin_(r.email, r.phone);
  if (!v) return { found: false };
  if (isFormerRecord_(v, r.email, r.phone)) return { found: true, former: true };
  return { found: true, former: false, hasPassword: !!passwordHashOf_(v), firstName: firstNameOf_(v) };
}

function actLogin_(r) {
  const v = findVolunteerByLogin_(r.email, r.phone);
  if (!v) throw apiError_('NOT_FOUND', 'Volunteer not found');
  if (isFormerRecord_(v, r.email, r.phone)) throw apiError_('FORMER', 'Access removed');
  const lockKey = 'vol:' + v.id;
  checkLock_(lockKey);
  const stored = passwordHashOf_(v);
  if (!stored) throw apiError_('NO_PASSWORD', 'No password yet');
  if (hashPassword_(String(r.password || ''), v.id) !== stored) {
    recordFailure_(lockKey);
    throw apiError_('WRONG_PASSWORD', 'Wrong password');
  }
  clearFailures_(lockKey);
  return volunteerSessionResponse_(v, r.email, r.phone);
}

// ── Emailed verification code (first sign-in and "Forgot password") ──
// The code goes ONLY to the email address on the volunteer's Baserow record,
// never to an address typed in the page.
function actRequestCode_(r) {
  const v = findVolunteerByLogin_(r.email, r.phone);
  if (!v) throw apiError_('NOT_FOUND', 'Volunteer not found');
  if (isFormerRecord_(v, r.email, r.phone)) throw apiError_('FORMER', 'Access removed');
  const purpose = r.purpose === 'reset' ? 'reset' : 'create';
  if (purpose === 'create' && passwordHashOf_(v)) throw apiError_('HAS_PASSWORD', 'A password already exists');
  const to = fieldVal_(v, ['Email', 'E-mail', 'Mail']).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw apiError_('NO_EMAIL', 'No email address on file');

  const cache = CacheService.getScriptCache();
  const sentKey = 'otpsent:' + v.id;
  const sent = Number(cache.get(sentKey) || 0);
  if (sent >= MAX_CODES_PER_WINDOW) throw apiError_('LOCKED', 'Too many codes requested — please wait ' + LOCK_MINUTES + ' minutes.');
  cache.put(sentKey, String(sent + 1), LOCK_MINUTES * 60);

  const code = newCode_();
  const expires = Date.now() + CODE_MINUTES * 60e3;
  cache.put('otp:' + v.id, JSON.stringify({ h: codeHash_(code, v.id), p: purpose, n: 0, exp: expires }), CODE_MINUTES * 60);
  sendCodeEmail_(to, firstNameOf_(v), code, purpose, r.lang === 'fr' ? 'fr' : 'en');
  return { sent: true, to: maskEmail_(to), minutes: CODE_MINUTES };
}

// Checks the code without using it up (so the page can move to "choose a password")
function actCheckCode_(r) {
  const v = findVolunteerByLogin_(r.email, r.phone);
  if (!v) throw apiError_('NOT_FOUND', 'Volunteer not found');
  verifyCode_(v, r.code, r.purpose === 'reset' ? 'reset' : 'create', false);
  return { valid: true };
}

// First login only: the record has no password yet + emailed code
function actCreatePassword_(r) {
  const v = findVolunteerByLogin_(r.email, r.phone);
  if (!v) throw apiError_('NOT_FOUND', 'Volunteer not found');
  if (isFormerRecord_(v, r.email, r.phone)) throw apiError_('FORMER', 'Access removed');
  if (passwordHashOf_(v)) throw apiError_('HAS_PASSWORD', 'A password already exists');
  const pw = String(r.password || '');
  if (pw.length < 8) throw apiError_('BAD_REQUEST', 'Password too short');
  verifyCode_(v, r.code, 'create', true);
  updateRow_(T_VOLUNTEERS, v.id, { [passwordFieldName_()]: hashPassword_(pw, v.id) });
  clearFailures_('vol:' + v.id);
  return volunteerSessionResponse_(getRow_(T_VOLUNTEERS, v.id), r.email, r.phone);
}

// Forgot password: emailed code → new password (old sessions stop working)
function actResetPassword_(r) {
  const v = findVolunteerByLogin_(r.email, r.phone);
  if (!v) throw apiError_('NOT_FOUND', 'Volunteer not found');
  if (isFormerRecord_(v, r.email, r.phone)) throw apiError_('FORMER', 'Access removed');
  const pw = String(r.password || '');
  if (pw.length < 8) throw apiError_('BAD_REQUEST', 'Password too short');
  verifyCode_(v, r.code, 'reset', true);
  updateRow_(T_VOLUNTEERS, v.id, { [passwordFieldName_()]: hashPassword_(pw, v.id) });
  clearFailures_('vol:' + v.id);   // a successful reset also lifts the wrong-password lock
  return volunteerSessionResponse_(getRow_(T_VOLUNTEERS, v.id), r.email, r.phone);
}

function verifyCode_(v, code, purpose, consume) {
  const cache = CacheService.getScriptCache();
  const key = 'otp:' + v.id;
  const raw = cache.get(key);
  if (!raw) throw apiError_('CODE_EXPIRED', 'Code expired — please request a new one');
  const o = JSON.parse(raw);
  if (Date.now() > o.exp) { cache.remove(key); throw apiError_('CODE_EXPIRED', 'Code expired — please request a new one'); }
  const entered = String(code || '').replace(/\D/g, '');
  if (o.p !== purpose || !safeEqual_(codeHash_(entered, v.id), o.h)) {
    o.n++;
    if (o.n >= MAX_CODE_TRIES) { cache.remove(key); throw apiError_('CODE_EXPIRED', 'Too many wrong codes — please request a new one'); }
    cache.put(key, JSON.stringify(o), Math.max(1, Math.floor((o.exp - Date.now()) / 1000)));
    throw apiError_('CODE_INVALID', 'Incorrect code');
  }
  if (consume) cache.remove(key);
}

// 6 digits from a random UUID (Java SecureRandom behind Utilities.getUuid)
function newCode_() {
  const hex = Utilities.getUuid().replace(/-/g, '');
  return String(parseInt(hex.slice(0, 12), 16) % 1000000).padStart(6, '0');
}
function codeHash_(code, id) {
  return hex_(Utilities.computeHmacSha256Signature(String(code) + ':' + id, sessionSecret_()));
}
function maskEmail_(e) {
  const parts = String(e).split('@');
  return parts[0].slice(0, 1) + '•••@' + (parts[1] || '');
}

function sendCodeEmail_(to, firstName, code, purpose, lang) {
  const fr = lang === 'fr';
  const hello = fr ? 'Bonjour' : 'Hello';
  const why = purpose === 'reset'
    ? (fr ? 'Voici votre code pour choisir un nouveau mot de passe du portail des bénévoles :' : 'Here is your code to choose a new volunteer portal password:')
    : (fr ? 'Voici votre code pour créer le mot de passe de votre portail des bénévoles :' : 'Here is your code to create your volunteer portal password:');
  const exp = fr ? 'Ce code expire dans ' + CODE_MINUTES + ' minutes.' : 'This code expires in ' + CODE_MINUTES + ' minutes.';
  const notYou = fr ? 'Si vous n’avez rien demandé, ignorez ce courriel : votre compte ne change pas.'
                    : 'If you didn’t ask for this, ignore this email — nothing changes on your account.';
  const subject = (fr ? 'Votre code Everpeace : ' : 'Your Everpeace code: ') + code;
  const name = firstName ? ' ' + firstName : '';
  const body = hello + name + ',\n\n' + why + '\n\n    ' + code + '\n\n' + exp + '\n' + notYou + '\n\nEverpeace Companionship';
  const html =
    '<div style="font-family:Georgia,serif;background:#FBF7EE;padding:24px">' +
    '<div style="max-width:440px;margin:auto;background:#051635;color:#FBF7EE;border:1px solid #CDAE74;padding:28px;text-align:center">' +
    '<div style="letter-spacing:.2em;font-size:12px;color:#CDAE74">EVERPEACE COMPANIONSHIP</div>' +
    '<p style="font-size:16px">' + hello + escHtml_(name) + ',</p><p style="font-size:14px;line-height:1.5">' + why + '</p>' +
    '<div style="font-size:34px;letter-spacing:10px;color:#CDAE74;margin:18px 0;font-family:Courier,monospace">' + code + '</div>' +
    '<p style="font-size:12px">' + exp + '</p><p style="font-size:12px;color:#C9CCD6">' + notYou + '</p></div></div>';
  MailApp.sendEmail({ to: to, subject: subject, body: body, htmlBody: html, name: 'Everpeace Companionship' });
}
function escHtml_(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function actChangePassword_(r) {
  const ctx = requireVolunteer_(r);
  const lockKey = 'vol:' + ctx.vol.id;
  checkLock_(lockKey);
  if (hashPassword_(String(r.current || ''), ctx.vol.id) !== passwordHashOf_(ctx.vol)) {
    recordFailure_(lockKey);
    throw apiError_('WRONG_PASSWORD', 'Wrong current password');
  }
  clearFailures_(lockKey);
  const next = String(r.next || '');
  if (next.length < 8) throw apiError_('BAD_REQUEST', 'Password too short');
  updateRow_(T_VOLUNTEERS, ctx.vol.id, { [passwordFieldName_()]: hashPassword_(next, ctx.vol.id) });
  // New session (the old one stops working because the password changed)
  return volunteerSessionResponse_(getRow_(T_VOLUNTEERS, ctx.vol.id), ctx.session.em, ctx.session.ph);
}

// Column names only (no data) — volunteers and coordinator
function actFields_(r) {
  requireAnySession_(r);
  const table = Number(r.table);
  if (ALLOWED_TABLES.indexOf(table) < 0) throw apiError_('FORBIDDEN', 'Table not allowed');
  return { fields: tableFields_(table) };
}

// The volunteer's own rows of the Visits table (same rule as the portal's
// rowBelongsToVolunteer: full name, or a row that stores only the first name)
function actMyVisits_(r) {
  const ctx = requireVolunteer_(r);
  return { rows: myVisitRows_(ctx.vol) };
}

// Senior NAMES only — for the "Senior visited" list in Log Visit
function actSeniorNames_(r) {
  requireVolunteer_(r);
  const rows = allRows_(T_SENIORS).map(s => ({ Name: fieldVal_(s, ['Name', 'Full Legal Name', 'Nom']) }))
    .filter(s => s.Name);
  return { rows: rows };
}

// Fallback for My Visit: the senior named in the volunteer's own
// Matched_Senior / Assigned Senior field — only the fields the card shows
function actAssignedSenior_(r) {
  const ctx = requireVolunteer_(r);
  const name = ['Matched_Senior', 'Senior', 'Assigned Senior', 'Matched Senior']
    .map(k => extractVal_(ctx.vol[k])).filter(Boolean)[0] || '';
  if (!name) return { results: [] };
  const found = brGet_(BASEROW_API + '/database/rows/table/' + T_SENIORS +
    '/?user_field_names=true&size=5&search=' + encodeURIComponent(name));
  const results = (found.results || []).slice(0, 1).map(s => ({
    'Name':               fieldVal_(s, ['Name', 'Full Legal Name']),
    'Address':            fieldVal_(s, ['Address']),
    'Language spoken':    fieldVal_(s, ['Language spoken', 'languages', 'Languages']),
    'Visit availability': fieldVal_(s, ['Visit availability', 'Availability']),
    'Participation & Visit Preferences': fieldVal_(s, ['Participation & Visit Preferences', 'Special accomodation', 'Notes'])
  }));
  return { results: results };
}

// Availability tab — writes ONLY an availability column of the volunteer's own row
function actSaveAvailability_(r) {
  const ctx = requireVolunteer_(r);
  const field = String(r.field || '');
  const fields = tableFields_(T_VOLUNTEERS);
  if (fields.indexOf(field) < 0 || !/avail|disponib|schedule/i.test(field) || /password|hash/i.test(field)) {
    throw apiError_('FORBIDDEN', 'Field not allowed');
  }
  const value = String(r.value == null ? '' : r.value).slice(0, 5000);
  updateRow_(T_VOLUNTEERS, ctx.vol.id, { [field]: value });
  return { saved: true };
}

// Log Visit — creates a "Completed" row for THIS volunteer only
function actLogVisit_(r) {
  const ctx = requireVolunteer_(r);
  const fields = tableFields_(T_VISITS);
  const row = cleanRow_(r.row, fields);
  const statusF = pickField_(fields, ['Status', 'Statut', 'Visit Status']);
  if (statusF && String(row[statusF] || '').toLowerCase() === 'upcoming') throw apiError_('FORBIDDEN', 'Not allowed');
  const volF = pickField_(fields, ['Volunteer', 'Volunteer Name', 'Nom Bénévole', 'Bénévole']);
  if (volF) {
    // Always this volunteer's clean name — a volunteer can't log a visit for someone else
    row[volF] = cleanVolunteerName_(volunteerNameOf_(ctx.vol));
  }
  return { row: createRow_(T_VISITS, row) };
}

// My Visit / visit counter — this volunteer's calendar events only.
// The email/phone come from the session (what they signed in with) or their
// own Baserow record — never from the request.
function actMyCalendar_(r) {
  const ctx = requireVolunteer_(r);
  const email = (ctx.session.em || fieldVal_(ctx.vol, ['Email', 'email', 'E-mail', 'Mail'])).toLowerCase();
  const phone = (ctx.session.ph && ctx.session.ph.length >= 7) ? ctx.session.ph
    : fieldVal_(ctx.vol, ['Phone', 'phone', 'Tel', 'Phone Number', 'Mobile', 'Number']).replace(/\D/g, '');
  return volunteerCalendar_(email, phone, r.since, true);
}

// ============================================================
// COORDINATOR ACTIONS
// ============================================================

function actAdminLogin_(r) {
  checkLock_('admin');
  const pw = String(r.password || '');
  const props = PropertiesService.getScriptProperties();
  const accounts = [['admin', props.getProperty('ADMIN_PASSWORD')], ['coordinator', props.getProperty('COORDINATOR_PASSWORD')]]
    .filter(a => a[1]);
  if (!accounts.length) throw apiError_('SERVER', 'Coordinator password not configured');
  const hit = accounts.filter(a => safeEqual_(a[1], pw))[0];
  if (!hit) { recordFailure_('admin', 10); throw apiError_('WRONG_PASSWORD', 'Incorrect password'); }
  clearFailures_('admin');
  const session = sign_({ r: 'a', who: hit[0], pv: adminPasswordVersion_(hit[0]), exp: Date.now() + ADMIN_SESSION_HOURS * 3600e3 });
  return { session: session, privateData: { baselines: privateBaselines_(), former: privateFormer_() } };
}

function actAdminRows_(r) {
  requireAdmin_(r);
  const table = Number(r.table);
  if (ALLOWED_TABLES.indexOf(table) < 0) throw apiError_('FORBIDDEN', 'Table not allowed');
  return { rows: allRows_(table).map(stripSecrets_) };
}

// Match Builder → "Send to Volunteer Portal"
function actAdminCreateVisit_(r) {
  requireAdmin_(r);
  const row = cleanRow_(r.row, tableFields_(T_VISITS));
  return { row: createRow_(T_VISITS, row) };
}

// Live Visit Counter — counts only (no event details)
function actAdminCalendar_(r) {
  requireAdmin_(r);
  const res = volunteerCalendar_(String(r.email || '').toLowerCase().trim(), String(r.phone || '').replace(/\D/g, ''), r.since, false);
  return { success: res.success, error: res.error, completedTotal: res.completedTotal, completedSince: res.completedSince, visitsOnly: true };
}

// ============================================================
// SESSIONS (signed tokens — nothing stored)
// ============================================================

function sessionSecret_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SESSION_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SESSION_SECRET', s); }
  return s;
}

function sign_(payload) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const sig  = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, sessionSecret_()));
  return body + '.' + sig;
}

function readSession_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw apiError_('AUTH', 'Please sign in again');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], sessionSecret_()));
  if (!safeEqual_(expected, parts[1])) throw apiError_('AUTH', 'Please sign in again');
  let p;
  try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); }
  catch (e) { throw apiError_('AUTH', 'Please sign in again'); }
  if (!p || !p.exp || Date.now() > p.exp) throw apiError_('AUTH', 'Session expired — please sign in again');
  return p;
}

function volunteerSessionResponse_(vol, email, phone) {
  const em = String(email || '').toLowerCase().trim();
  const ph = String(phone || '').replace(/\D/g, '');
  const session = sign_({ r: 'v', id: vol.id, pv: passwordHashOf_(vol).slice(0, 12), em: em, ph: ph,
    exp: Date.now() + VOLUNTEER_SESSION_HOURS * 3600e3 });
  const ident = { name: volunteerNameOf_(vol), email: em || fieldVal_(vol, ['Email', 'E-mail', 'Mail']), phone: ph || fieldVal_(vol, ['Phone', 'Tel', 'Phone Number', 'Mobile']) };
  const baseline = findBaseline_(ident);
  return { session: session, volunteer: stripSecrets_(vol), privateData: { baselines: baseline ? [baseline] : [], former: [] } };
}

// Valid volunteer session + fresh record. Stops working when the password
// changes or the volunteer is added to the former-volunteer list.
function requireVolunteer_(r) {
  const s = readSession_(r.session);
  if (s.r !== 'v') throw apiError_('AUTH', 'Please sign in again');
  let vol;
  try { vol = getRow_(T_VOLUNTEERS, s.id); } catch (e) { throw apiError_('AUTH', 'Please sign in again'); }
  if (passwordHashOf_(vol).slice(0, 12) !== s.pv) throw apiError_('AUTH', 'Please sign in again');
  if (isFormerRecord_(vol, s.em, s.ph)) throw apiError_('FORMER', 'Access removed');
  return { session: s, vol: vol };
}

function requireAdmin_(r) {
  const s = readSession_(r.session);
  if (s.r !== 'a' || s.pv !== adminPasswordVersion_(s.who)) throw apiError_('AUTH', 'Please sign in again');
  return s;
}

function requireAnySession_(r) {
  const s = readSession_(r.session);
  return s.r === 'a' ? requireAdmin_(r) : requireVolunteer_(r);
}

// Changing ADMIN_PASSWORD / COORDINATOR_PASSWORD signs out that account everywhere
function adminPasswordVersion_(who) {
  const pw = PropertiesService.getScriptProperties().getProperty(who === 'coordinator' ? 'COORDINATOR_PASSWORD' : 'ADMIN_PASSWORD') || '';
  return hex_(Utilities.computeHmacSha256Signature(pw, sessionSecret_())).slice(0, 12);
}

// ── Failed-attempt lockout ──
function checkLock_(key) {
  const n = Number(CacheService.getScriptCache().get('fail:' + key) || 0);
  const max = key === 'admin' ? 10 : MAX_FAILED_ATTEMPTS;
  if (n >= max) throw apiError_('LOCKED', 'Too many attempts — please wait ' + LOCK_MINUTES + ' minutes.');
}
function recordFailure_(key) {
  const c = CacheService.getScriptCache();
  c.put('fail:' + key, String(Number(c.get('fail:' + key) || 0) + 1), LOCK_MINUTES * 60);
}
function clearFailures_(key) { CacheService.getScriptCache().remove('fail:' + key); }

// ============================================================
// PASSWORDS — same scheme the portal always used, so existing passwords keep working
//   SHA-256( password + ':EVP2025:' + volunteerRowId ), hex
// ============================================================
function hashPassword_(password, volunteerId) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    password + ':EVP2025:' + String(volunteerId), Utilities.Charset.UTF_8));
}
function passwordHashOf_(vol) {
  return fieldVal_(vol, ['Password_Hash', 'password_hash', 'PasswordHash', 'Password Hash']);
}
function passwordFieldName_() {
  return pickField_(tableFields_(T_VOLUNTEERS), ['Password_Hash', 'PasswordHash', 'Password Hash']) || 'Password_Hash';
}
function stripSecrets_(row) {
  const out = {};
  Object.keys(row || {}).forEach(k => { if (!/password|hash/i.test(k)) out[k] = row[k]; });
  return out;
}

// ============================================================
// BASEROW
// ============================================================
function brToken_() {
  const t = PropertiesService.getScriptProperties().getProperty('BASEROW_TOKEN');
  if (!t) throw apiError_('SERVER', 'Server not configured (BASEROW_TOKEN)');
  return t;
}
function brRequest_(method, url, body) {
  const opt = { method: method, headers: { Authorization: 'Token ' + brToken_() }, muteHttpExceptions: true };
  if (body !== undefined) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code >= 300) throw new Error('Baserow ' + method + ' ' + code + ': ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
function brGet_(url) { return brRequest_('get', url); }
function allRows_(table, extra) {
  let rows = [], next = BASEROW_API + '/database/rows/table/' + table + '/?user_field_names=true&size=200' + (extra || '');
  while (next) {
    const d = brGet_(next);
    rows = rows.concat(d.results || []);
    next = d.next ? String(d.next).replace(/^http:/, 'https:') : null;
  }
  return rows;
}
function getRow_(table, id) {
  return brGet_(BASEROW_API + '/database/rows/table/' + table + '/' + Number(id) + '/?user_field_names=true');
}
function createRow_(table, data) {
  return brRequest_('post', BASEROW_API + '/database/rows/table/' + table + '/?user_field_names=true', data);
}
function updateRow_(table, id, data) {
  return brRequest_('patch', BASEROW_API + '/database/rows/table/' + table + '/' + Number(id) + '/?user_field_names=true', data);
}
function tableFields_(table, noCache) {
  const cache = CacheService.getScriptCache();
  const key = 'fields:' + table;
  if (!noCache) { const hit = cache.get(key); if (hit) return JSON.parse(hit); }
  const data = brGet_(BASEROW_API + '/database/fields/table/' + table + '/');
  const names = Array.isArray(data) ? data.map(f => f.name) : [];
  cache.put(key, JSON.stringify(names), 600);
  return names;
}
// Keep only real columns; plain values only
function cleanRow_(row, fields) {
  const out = {};
  Object.keys(row || {}).forEach(k => {
    if (fields.indexOf(k) < 0 || /password|hash/i.test(k)) return;
    const v = row[k];
    if (v === null || ['string', 'number', 'boolean'].indexOf(typeof v) >= 0) out[k] = typeof v === 'string' ? v.slice(0, 10000) : v;
  });
  if (!Object.keys(out).length) throw apiError_('BAD_REQUEST', 'Nothing to save');
  return out;
}

// ============================================================
// FIELD HELPERS — same rules as the portal (extractVal / getVolunteerField / findBestField)
// ============================================================
function extractVal_(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(v => typeof v === 'object' && v ? (v.value || v.name || v.display_name || '') : String(v)).filter(Boolean).join(', ');
  if (typeof val === 'object') return String(val.value || val.name || val.display_name || val.label || '').trim();
  return String(val).trim();
}
function fieldVal_(row, candidates) {
  if (!row) return '';
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find(x => x.toLowerCase() === c.toLowerCase());
    if (k && row[k] !== null && row[k] !== undefined && row[k] !== '') return extractVal_(row[k]);
  }
  for (const c of candidates) {
    const k = keys.find(x => x.toLowerCase().includes(c.toLowerCase()));
    if (k && row[k] !== null && row[k] !== undefined && row[k] !== '') return extractVal_(row[k]);
  }
  return '';
}
function pickField_(fields, candidates) {
  for (const c of candidates) { const m = fields.find(f => f.toLowerCase() === c.toLowerCase()); if (m) return m; }
  for (const c of candidates) { const m = fields.find(f => f.toLowerCase().includes(c.toLowerCase())); if (m) return m; }
  return null;
}
function volunteerNameOf_(vol) { return fieldVal_(vol, ['Full Legal Name', 'Name', 'Full Name', 'Nom']); }
function firstNameOf_(vol) { return cleanVolunteerName_(volunteerNameOf_(vol)).split(' ')[0] || ''; }
function cleanPhone_(p) { return extractVal_(p).replace(/\D/g, ''); }

// Same search as the portal's old findVolunteer(): email in any "mail" column,
// else the last 10 phone digits in any phone-like column
function findVolunteerByLogin_(email, phone) {
  const e = String(email || '').trim().toLowerCase();
  const pd = cleanPhone_(phone);
  if (!e && pd.length < 7) return null;
  const rows = allRows_(T_VOLUNTEERS);
  for (const row of rows) {
    const keys = Object.keys(row);
    if (e) {
      for (const key of keys) {
        const kl = key.toLowerCase();
        if ((kl.includes('mail') || kl.includes('email')) && extractVal_(row[key]).toLowerCase() === e) return row;
      }
    }
    if (pd.length >= 7) {
      for (const key of keys) {
        const kl = key.toLowerCase();
        if (kl.includes('phone') || kl.includes('tel') || kl.includes('mobile') || (kl.includes('number') && !kl.includes('visit'))) {
          const last = cleanPhone_(row[key]).slice(-10);
          if (last.length >= 7 && last === pd.slice(-10)) return row;
        }
      }
    }
  }
  return null;
}

function isFormerRecord_(vol, email, phone) {
  return isFormer_({
    name:  volunteerNameOf_(vol),
    email: fieldVal_(vol, ['Email', 'E-mail', 'Mail']) || email,
    phone: fieldVal_(vol, ['Phone', 'Tel', 'Phone Number', 'Mobile']) || phone
  });
}

// Same rule as the portal's rowBelongsToVolunteer()
function rowBelongsTo_(rowVolValue, fullName) {
  const v = extractVal_(rowVolValue).toLowerCase().replace(/\s+/g, ' ').trim();
  const full = String(fullName || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!v || !full) return false;
  if (v === full || v.includes(full)) return true;
  const cv = cleanVolunteerName_(v).toLowerCase(), cf = cleanVolunteerName_(full).toLowerCase();
  if (cv && cf && cv.includes(' ') && cv === cf) return true;
  const firstClean = cf.split(' ')[0];
  if (firstClean.length > 1 && cv === firstClean) return true;
  const first = full.split(' ')[0];
  return first.length > 1 && v === first;
}

function myVisitRows_(vol) {
  const fullName = volunteerNameOf_(vol);
  const first = (fullName.split(' ')[0] || '').trim();
  const cleanFirst = (cleanVolunteerName_(fullName).split(' ')[0] || '').trim();
  if (!first) return [];
  const fields = tableFields_(T_VISITS);
  const volF = pickField_(fields, ['Volunteer', 'Volunteer Name', 'Bénévole', 'Nom Bénévole']) || 'Volunteer';
  const seen = {};
  const out = [];
  [first, cleanFirst].filter((x, i, a) => x && a.indexOf(x) === i).forEach(term => {
    allRows_(T_VISITS, '&search=' + encodeURIComponent(term)).forEach(row => {
      if (seen[row.id] || !rowBelongsTo_(row[volF], fullName)) return;
      seen[row.id] = true;
      out.push(row);
    });
  });
  return out;
}

// ============================================================
// VISIT COUNTS — copy of the helpers in visit-counts.js (keep in sync).
// The LISTS (baselines, former volunteers) are in private-data.gs only.
// ============================================================
function privateBaselines_() { return typeof EC_VISIT_BASELINES !== 'undefined' ? EC_VISIT_BASELINES : []; }
function privateFormer_()    { return typeof EC_FORMER_VOLUNTEERS !== 'undefined' ? EC_FORMER_VOLUNTEERS : []; }

function vcNorm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/^\s*(?:\d*\s*-?\s*v|c)\s*-\s*/, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/^\s*(sr|br|sister|brother|sheikh|cheikh)\s+/, '')
    .replace(/\s+/g, ' ').trim();
}
function cleanVolunteerName_(raw) {
  const orig = String(raw || '').trim();
  let n = orig;
  for (let i = 0; i < 3; i++) {
    n = n.replace(/^\s*(?:\d+\s*V\s*-|\d*\s*-\s*V\s*-?|C\s*-|V\s*-)\s*/i, '');
    n = n.replace(/^\s*(?:the form was not completed|cancel(?:led|ed)? last min(?:ute)?)\s*[-:]\s*/i, '');
  }
  n = n.split(/\s+[OÒ]UT\b|\s*\(|\s*:\s|\s+-\s|\s+(?:and|et|&)\s+|\s+\d/i)[0];
  n = n.replace(/[\s,;:-]+$/, '').replace(/\s+/g, ' ').trim();
  return n || orig;
}
function vcDigits_(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
function vcNames_(b) { return [b.name].concat(b.aliases || []).map(vcNorm_).filter(Boolean); }
function vcTokensIn_(small, big) { const B = big.split(' '); return small.split(' ').every(t => B.indexOf(t) >= 0); }

function findBaseline_(id) {
  const n = vcNorm_(id.name), e = String(id.email || '').toLowerCase().trim(), p = vcDigits_(id.phone);
  const B = privateBaselines_();
  let hit = (e && B.find(b => String(b.email || '').toLowerCase().trim() === e))
         || (p.length >= 7 && B.find(b => vcDigits_(b.phone) === p))
         || (n && B.find(b => vcNames_(b).indexOf(n) >= 0));
  if (hit || !n) return hit || null;
  if (n.includes(' ')) {
    hit = B.find(b => vcNames_(b).some(x => x.includes(' ') && (vcTokensIn_(x, n) || vcTokensIn_(n, x))));
    if (hit) return hit;
  }
  const first = n.split(' ')[0];
  const singles = B.filter(b => vcNames_(b).some(x => x === first));
  const sameFirst = B.filter(b => vcNames_(b).some(x => x.split(' ')[0] === first));
  return singles.length === 1 && sameFirst.length === 1 ? singles[0] : null;
}
function isFormer_(id) {
  const n = vcNorm_(id.name), e = String(id.email || '').toLowerCase().trim(), p = vcDigits_(id.phone);
  return privateFormer_().some(f => {
    if (e && String(f.email || '').toLowerCase().trim() === e) return true;
    if (p.length >= 7 && vcDigits_(f.phone) === p) return true;
    if (!n) return false;
    return vcNames_(f).some(x => x === n || (x.includes(' ') && vcTokensIn_(x, n)));
  });
}

// Portal-logged visits after `since`, one per senior per day (dashboard formula)
function orgPortalSince_(since) {
  const fields = tableFields_(T_VISITS);
  const senF = pickField_(fields, ['Senior', 'Senior Name']) || 'Senior';
  const dateF = pickField_(fields, ['Date', 'Visit Date']) || 'Date';
  const statusF = pickField_(fields, ['Status', 'Statut', 'Visit Status']);
  const keys = {};
  allRows_(T_VISITS).forEach(r => {
    if (statusF && extractVal_(r[statusF]).toLowerCase() === 'upcoming') return;
    const d = extractVal_(r[dateF]).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d <= since) return;
    keys[cleanVolunteerName_(extractVal_(r[senF])).toLowerCase() + '|' + d] = true;
  });
  return Object.keys(keys).length;
}

// ============================================================
// GOOGLE CALENDAR (logic unchanged from calendar-bridge.gs)
// ============================================================

// The account's default calendar + EXTRA_CALENDAR_IDS (Script Property, comma-separated)
function visitCalendars_() {
  const cals = [CalendarApp.getDefaultCalendar()];
  const extra = String(PropertiesService.getScriptProperties().getProperty('EXTRA_CALENDAR_IDS') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  extra.forEach(id => { const c = CalendarApp.getCalendarById(id); if (c) cals.push(c); });
  return cals;
}

// Events from every calendar, without duplicates
function getVisitCalendarEvents_(start, end) {
  const seen = {};
  const out = [];
  visitCalendars_().forEach(c => c.getEvents(start, end).forEach(ev => {
    const key = (ev.getTitle() || '').toLowerCase().trim() + '|' + ev.getStartTime().getTime();
    const id = ev.getId();
    if (seen[id] || seen[key]) return;
    seen[id] = seen[key] = true;
    out.push(ev);
  }));
  return out;
}

function isSeniorVisitTitle_(title) {
  const t = String(title || '').toLowerCase();
  if (!/\bvisite?s?\b/.test(t)) return false;
  return !NON_VISIT_KEYWORDS.some(k => t.includes(k));
}

function sinceEnd_(sinceParam) {
  const s = String(sinceParam || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)) + 1)   // start of next day
    : null;
}

// Organisation: distinct confirmed senior visits after `since`
function orgCalendarSince_(since) {
  const end = sinceEnd_(since);
  const cutoff = new Date(Date.now() - COMPLETED_THRESHOLD_HOURS * 3600e3);
  const seen = {};
  getVisitCalendarEvents_(end, cutoff).forEach(ev => {
    const title = ev.getTitle() || '';
    if (CANCELLED_KEYWORDS.some(kw => title.toLowerCase().includes(kw))) return;
    if (!isSeniorVisitTitle_(title) || ev.isAllDayEvent()) return;
    if (ev.getStartTime() < end) return;
    seen[title.toLowerCase().trim() + '|' + ev.getStartTime().getTime()] = true;
  });
  return Object.keys(seen).length;
}

// One volunteer: events whose title/description contain their email or phone
function volunteerCalendar_(email, phone, sinceParam, withEvents) {
  if (!email && phone.length < 7) return { success: false, error: 'No identifier' };
  const sinceEnd = sinceEnd_(sinceParam);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 365 * 24 * 3600e3);   // 3 years back
  const windowEnd   = new Date(now.getTime() + 60 * 24 * 3600e3);        // 60 days ahead
  const matched = getVisitCalendarEvents_(windowStart, windowEnd).filter(ev => {
    const combined = ((ev.getTitle() || '') + '\n' + (ev.getDescription() || '')).toLowerCase();
    if (email && combined.includes(email)) return true;
    if (phone.length >= 7 && combined.replace(/\D/g, '').includes(phone.slice(-10))) return true;
    return false;
  });
  const confirmedCutoff = new Date(now.getTime() - COMPLETED_THRESHOLD_HOURS * 3600e3);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const upcoming = [], completed = [];
  let thisMonth = 0, sinceCount = 0;
  matched.forEach(ev => {
    const title = ev.getTitle() || '';
    if (CANCELLED_KEYWORDS.some(kw => title.toLowerCase().includes(kw))) return;
    if (!isSeniorVisitTitle_(title) || ev.isAllDayEvent()) return;
    const start = ev.getStartTime();
    // Only what the portal shows — the event description (contact details) is NOT sent
    const data = {
      title: title, start: start.toISOString(), end: ev.getEndTime().toISOString(),
      location: ev.getLocation() || '', seniorName: extractSeniorName_(title, ev.getDescription() || '')
    };
    if (start < confirmedCutoff) {
      completed.push(data);
      if (start >= monthStart) thisMonth++;
      if (sinceEnd && start >= sinceEnd) sinceCount++;
    } else {
      upcoming.push(data);
    }
  });
  upcoming.sort((a, b) => new Date(a.start) - new Date(b.start));
  completed.sort((a, b) => new Date(b.start) - new Date(a.start));
  const out = {
    success: true, visitsOnly: true,
    completedTotal: completed.length, completedThisMonth: thisMonth,
    completedSince: sinceEnd ? sinceCount : null, since: sinceEnd ? String(sinceParam) : null
  };
  if (withEvents) { out.upcoming = upcoming.slice(0, 10); out.recentCompleted = completed.slice(0, 5); }
  return out;
}

// "Visit with Sr. Fatima" · "Senior: Fatima Al-Hassan" · "Aîné(e): Fatima Al-Hassan"
function extractSeniorName_(title, desc) {
  const patterns = [
    /senior\s*[:\-–]\s*([^\n\r,;]+)/i,
    /a[iî]n[ée]\s*[:\-–]\s*([^\n\r,;]+)/i,
    /(?:visit\s+with|visite\s+avec)\s+([^\n\r,;—–-]+)/i,
  ];
  const combined = title + '\n' + desc;
  for (const re of patterns) { const m = combined.match(re); if (m && m[1]) return m[1].trim(); }
  return '';
}

// ============================================================
// SMALL UTILITIES
// ============================================================
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function apiError_(code, message) { const e = new Error(message); e.code = code; return e; }
function hex_(bytes) { return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join(''); }
function safeEqual_(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
