// ============================================================
// Computes the organisation's EXACT total of distinct visits — the same
// number as the dashboard's "Total Visits ✓" — and writes visit-total.json.
// Run hourly by .github/workflows/visit-total.yml; the website reads it.
//
//   total = ORG_VISITS_BASELINE (visit-counts.js)
//         + max( calendar distinct confirmed visits after BASELINE_DATE,
//                portal-logged visits after BASELINE_DATE, one per senior per day )
//
// 🔒 No Baserow token here: both numbers come from the Everpeace secure server's
// public endpoint (?all=1&since=…), which returns counts only — no names.
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CALENDAR_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxc52C0-arbpnF4sx3Ejs0LRRK-H1xgNgVZ4fmmyZ6xH9it8B0vYBqxW-dN3npxscot/exec';

// Load the shared constants/helpers exactly as the portal and dashboard do
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'visit-counts.js'), 'utf8').replace(/^const /gm, 'var '), ctx);
const { ORG_VISITS_BASELINE, BASELINE_DATE, liveOrgTotal } = ctx;

async function main() {
  const res = await fetch(`${CALENDAR_SCRIPT_URL}?all=1&since=${BASELINE_DATE}`, { redirect: 'follow' });
  const data = await res.json();
  // Server unreachable or not updated → stop WITHOUT touching the file,
  // so the website keeps the last correct number.
  if (!data || !data.success || typeof data.portalSince !== 'number' || typeof data.orgCompletedSince !== 'number') {
    throw new Error('Secure server did not return the counts: ' + JSON.stringify(data).slice(0, 200));
  }
  const calendarSince = data.orgCompletedSince;
  const portalSince = data.portalSince;

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
