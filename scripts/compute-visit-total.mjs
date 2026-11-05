// ============================================================
// Computes the organisation's EXACT total of distinct visits — the same
// number as the dashboard's "Total Visits ✓" — and writes visit-total.json.
// Run hourly by .github/workflows/visit-total.yml; the website reads it.
//
//   total = ORG_VISITS_BASELINE (visit-counts.js)
//         + max( calendar distinct confirmed visits after BASELINE_DATE,
//                portal-logged visits after BASELINE_DATE, one per senior per day )
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASEROW_TOKEN = 'SWKMnsqQrocyKfXg9TVb5mMWTGGb1Zsc';
const BASE_URL = 'https://api.baserow.io/api';
const VISITS_TABLE = 917197;
const CALENDAR_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwyR_3wuqhI1XHRmIq1PkL2R3Q3sosSqk1dg00WTL4oIoUQ-KBJRlzrQuLQTUSfBe-nZg/exec';

// Load the shared constants/helpers exactly as the portal and dashboard do
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'visit-counts.js'), 'utf8').replace(/^const /gm, 'var '), ctx);
const { ORG_VISITS_BASELINE, BASELINE_DATE, liveOrgTotal, isAfterBaseline, cleanVolunteerName } = ctx;

function extractVal(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(v => typeof v === 'object' ? (v.value || v.name || v.display_name || '') : String(v)).filter(Boolean).join(', ');
  if (typeof val === 'object') return String(val.value || val.name || val.display_name || val.label || '').trim();
  return String(val).trim();
}

const auth = { headers: { Authorization: `Token ${BASEROW_TOKEN}` } };

async function getFields() {
  const res = await fetch(`${BASE_URL}/database/fields/table/${VISITS_TABLE}/`, auth);
  if (!res.ok) throw new Error('Baserow fields ' + res.status);
  return (await res.json()).map(f => f.name);
}

async function getAllVisits() {
  let rows = [], next = `${BASE_URL}/database/rows/table/${VISITS_TABLE}/?user_field_names=true&size=200`;
  while (next) {
    const res = await fetch(next, auth);
    if (!res.ok) throw new Error('Baserow rows ' + res.status);
    const data = await res.json();
    rows = rows.concat(data.results || []);
    next = data.next ? String(data.next).replace(/^http:/, 'https:') : null;
  }
  return rows;
}

function pick(fields, candidates) {
  for (const c of candidates) { const m = fields.find(f => f.toLowerCase() === c.toLowerCase()); if (m) return m; }
  for (const c of candidates) { const m = fields.find(f => f.toLowerCase().includes(c.toLowerCase())); if (m) return m; }
  return null;
}

async function main() {
  const [fields, rows] = await Promise.all([getFields(), getAllVisits()]);
  const senF = pick(fields, ['Senior', 'Senior Name']) || 'Senior';
  const dateF = pick(fields, ['Date', 'Visit Date']) || 'Date';
  const statusF = pick(fields, ['Status', 'Statut', 'Visit Status']);

  const keys = new Set();
  rows.forEach(r => {
    if (statusF && extractVal(r[statusF]).toLowerCase() === 'upcoming') return;
    const d = extractVal(r[dateF]).slice(0, 10);
    if (!isAfterBaseline(d)) return;
    keys.add(cleanVolunteerName(extractVal(r[senF])).toLowerCase() + '|' + d);
  });
  const portalSince = keys.size;

  let calendarSince = null;
  try {
    const res = await fetch(`${CALENDAR_SCRIPT_URL}?all=1&since=${BASELINE_DATE}`, { redirect: 'follow' });
    const data = await res.json();
    if (data && data.success && typeof data.orgCompletedSince === 'number') calendarSince = data.orgCompletedSince;
  } catch (e) { /* bridge not updated yet → portal logs only */ }

  const total = liveOrgTotal(calendarSince, portalSince);
  const out = { total, baseline: ORG_VISITS_BASELINE, baselineDate: BASELINE_DATE, calendarSince, portalSince };

  // Only rewrite the file (and so only commit) when the numbers change
  const file = path.join(ROOT, 'visit-total.json');
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  const same = ['total', 'baseline', 'baselineDate', 'calendarSince', 'portalSince'].every(k => prev[k] === out[k]);
  if (!same) {
    fs.writeFileSync(file, JSON.stringify({ ...out, updatedAt: new Date().toISOString() }, null, 2) + '\n');
    console.log('Updated', out);
  } else {
    console.log('No change', out);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
