# CLAUDE.md — Everpeace Companionship / Adopt a Muslim Senior
## Permanent Project Memory — Read This Before Every Coding Session

---

## 1. PROJECT PURPOSE

**Adopt a Muslim Senior** is a volunteer companionship program run by **Everpeace Companionship** (Ottawa, Ontario), affiliated with Islamic Care Center Ottawa and Muslim Family Services of Ottawa. The program matches Muslim volunteers with Muslim seniors for regular companionship visits.

The coordinator is **Nadouche** (Founder & Executive Director). She manages volunteers, assigns visits, and tracks everything through this system.

This system has two components:
- **Volunteer Portal** — used by volunteers to see their assigned visit, submit availability, log visits, and complete training
- **Admin Dashboard** — used only by Nadouche to see all volunteer availability, manage seniors, match volunteers with seniors, and track total visits

---

## 2. LIVE URLS & FILES

| File | URL | Who uses it |
|------|-----|-------------|
| `volunteer-app_14_1.html` | `everpeacecompanionship.github.io/VolunteerApp/volunteer-app_14_1.html` | All volunteers |
| `admin-dashboard_7.html` (or latest) | `everpeacecompanionship.github.io/VolunteerApp/admin-dashboard_7.html` | Nadouche only |
| `calendar-bridge.gs` | Deployed at Google Apps Script (see Section 7) | Server-side bridge |

**GitHub Repo:** `github.com/EverpeaceCompanionship/VolunteerApp` (public)

> ⚠️ File names change on every download due to browser incrementing (e.g. `_14_1`, `_14_2`). Always work from the uploaded file, never from memory of a previous version.

---

## 3. ARCHITECTURE

```
Volunteer's Browser
    │
    ├── volunteer-app_14.html (single HTML file, all CSS + JS inline)
    │       │
    │       ├── Baserow API (database) ──► Tables: Volunteers, Seniors, Visits
    │       │
    │       └── Google Apps Script URL ──► calendar-bridge.gs ──► Nadouche's Google Calendar
    │
Nadouche's Browser
    │
    └── admin-dashboard.html (single HTML file, all CSS + JS inline)
            │
            └── Baserow API (same tables)
```

Everything is **static HTML** deployed via **GitHub Pages**. No server, no backend. All logic is client-side JavaScript.

---

## 4. CONFIG VALUES (NEVER CHANGE THESE WITHOUT NADOUCHE'S APPROVAL)

```javascript
// Baserow
BASEROW_TOKEN    = 'SWKMnsqQrocyKfXg9TVb5mMWTGGb1Zsc'
VOLUNTEERS_TABLE = 988315   // "Volunteers" table
SENIORS_TABLE    = 917379   // "Seniors List for visits" table
VISITS_TABLE     = 917197   // "Calls and Visits Follow-up" table
BASE_URL         = 'https://api.baserow.io/api'

// Google Calendar Bridge
CALENDAR_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwyR_3wuqhI1XHRmIq1PkL2R3Q3sosSqk1dg00WTL4oIoUQ-KBJRlzrQuLQTUSfBe-nZg/exec'

// EmailJS (NOT YET CONFIGURED — keys are currently empty strings)
EMAILJS_PUBLIC_KEY  = ''
EMAILJS_SERVICE_ID  = ''
EMAILJS_TEMPLATE_ID = ''
```

---

## 5. BASEROW DATA STRUCTURE

### Volunteers Table (988315)
| Baserow Column | Purpose |
|---------------|---------|
| `Full Legal Name` | Volunteer's full name |
| `Email` | Login identifier + used by calendar bridge |
| `Phone` (various names) | Login identifier + used by calendar bridge |
| `Active` | Boolean — shows ✓ in status widget |
| `Password_Hash` | SHA-256 hex of their password (set by volunteer on first login) |
| `Availability Schedule` | Plain text of submitted availability slots |
| `Matched_Senior` or `Assigned Senior` | Fallback assignment if no calendar/Upcoming row |

### Seniors Table (917379) — "Seniors List for visits"
| Baserow Column | Purpose |
|---------------|---------|
| `Name` | Senior's full name (**exact column name confirmed by Nadouche**) |
| `Address` | Physical address (**exact**) |
| `Phone number` | Contact phone (**exact**) |
| `Email` | Contact email |
| `Visit availability` | When senior is available (**exact**) |
| `Language spoken` | Language preferences |
| `What time they want` | Preferred visit time |
| `Participation & Visit Preferences` | Special notes/accommodations |

### Visits Table (917197) — "Calls and Visits Follow-up"
| Baserow Column | Purpose |
|---------------|---------|
| `Volunteer` | Volunteer's name |
| `Senior` | Senior's name |
| `Date` | Visit date |
| `Duration` | Visit duration |
| `Senior Mood` | How senior seemed |
| `Notes` | Visit notes OR JSON (see below) |
| `Follow-up needed` | Follow-up flag |
| `Status` | `'Completed'` = logged visit, `'Upcoming'` = admin-assigned match |

> ⚠️ **CRITICAL — Notes field dual use:**
> - For **volunteer-logged visits** (Status: Completed): Notes = plain text
> - For **admin-assigned matches** (Status: Upcoming): Notes = JSON string:
>   ```json
>   {"seniorName":"...", "address":"...", "date":"2026-08-08", "time":"14:00 – 15:30", "duration":"1.5h", "coordinatorNotes":"..."}
>   ```
>   The volunteer app parses this JSON to display the visit details. This is the ONLY reliable way to pass all visit info.

---

## 6. VOLUNTEER APP — FULL FEATURE LIST

### Authentication (2-Step Login)
1. **Step 1:** Enter email OR phone → `findVolunteer()` searches Volunteers table
2. **Step 2a:** Volunteer has a password → `verifyPassword()` checks SHA-256 hash
3. **Step 2b:** First login → `createPassword()` sets password in Baserow
4. **Step 2c:** Forgot password → OTP via EmailJS → `verifyOTPCode()` → set new password
5. **Change Password:** Accessible from footer on main screen
6. Password strength meter on creation screen
7. Eye toggle on all password fields

> ⚠️ EmailJS is NOT configured yet (keys are empty strings). Forgot password flow shows "not configured" message and tells volunteer to contact coordinator.

### Stats Bar
- **Total Visits:** From Google Calendar (calendar bridge) — count of past events mentioning volunteer's email/phone
- **Status:** ✓ or – from `Active` field in Baserow

### Tab: My Visit
- Reads from Google Calendar first (if `CALENDAR_SCRIPT_URL` is set)
- Shows: Senior Name (big), 🏠 Address + Google Maps link, 📅 Date (formatted), 🕐 Time, ⏱️ Duration, 📝 Coordinator Notes
- "No special instructions" shown if coordinator notes empty
- Falls back to Baserow Visits table for 'Upcoming' rows if calendar fails
- Falls back to `Matched_Senior` field on volunteer record as last resort
- `looksLikeAddress()` detects when old records stored address in name field

### Tab: Availability
- 2-week calendar grid (14 days from today)
- Each day: AM / Afternoon / Evening time pills
- Frequency selector: 1 / 2-3 / Flexible visits
- Saves to `Availability Schedule` field in Volunteers table via PATCH
- Uses `findBestField()` to find the right column name

### Tab: Log Visit
- Fields: Date, Senior Name (editable), Duration, Senior Mood, Notes, Follow-up needed
- Senior name auto-fills from My Visit if available
- Uses `buildVisitPayload()` with `getTableFields()` + `findBestField()` for smart field detection
- Saves to Visits table with Status: 'Completed'
- ⚠️ Does NOT increment a counter — visit count comes from calendar

### Tab: Training
- 8 modules: 5 video, 3 PDF (2 available, 6 coming soon)
- Progress tracked in **localStorage** scoped to volunteer's email: `ep_training_done_{email}`
- Filter by: All / Videos / Documents
- Progress bar + percentage
- "Mark as done / Undo" per module
- Content is hardcoded in `TRAINING_COURSES` array — edit there to add/change resources
- Currently available: tr1 (Mental Health webinar), tr2 (Do's and Don'ts webinar), tr6 (Slide deck)

### Bilingual (EN / FR)
- Toggle button in header switches all UI text
- All strings in `T.en` and `T.fr` translation objects
- Calendar availability days/months also translated

### Design Rules — NEVER CHANGE
- **Colors:** `--green-dark: #1B4332`, `--green: #2D6A4F`, `--gold: #C9A84C`, `--cream: #FAF7F2`
- **Fonts:** Playfair Display (headings) + Lato (body)
- **Bismillah** in Arabic always at top of content area
- **Arabesque header pattern** — gold diamond SVG pattern on dark green
- **Everpeace Companionship logo** embedded as base64 in header
- Max container width: 540px (mobile-first)
- Islamic moon (☽) decorative element on visit cards

---

## 7. GOOGLE CALENDAR BRIDGE (calendar-bridge.gs)

**Deployed Web App URL:**
`https://script.google.com/macros/s/AKfycbwyR_3wuqhI1XHRmIq1PkL2R3Q3sosSqk1dg00WTL4oIoUQ-KBJRlzrQuLQTUSfBe-nZg/exec`

**How it works:**
- Accepts GET request with `?email=...&phone=...`
- Searches **Nadouche's Google Calendar** (regular @gmail.com account)
- Search window: **3 years back → 60 days ahead** (updated from 90 days to catch all historical visits)
- Matches events where volunteer's email OR phone digits appear **anywhere in the event description**
- Returns: `{ success, upcoming[], completedTotal, completedThisMonth, recentCompleted[] }`

**Cancellation logic:**
- Event deleted from calendar → not returned → not counted ✓
- Event title contains 'cancel', 'cancelled', 'annulé', 'annulée', 'annule' → excluded ✓

**Completion threshold:** 36 hours after event start = confirmed completed (the "day after" rule)

**How Nadouche formats calendar events:**
- Volunteer's email AND phone number are written in the event description
- The bridge searches for these to match events to volunteers
- Format is free-text — no strict template required

---

## 8. ADMIN DASHBOARD — FULL FEATURE LIST

### Authentication
- Simple PIN stored as `ADMIN_PIN` constant in JS
- Nadouche must change this before each upload (open in Notepad → Ctrl+F → ADMIN_PIN)

### Stats Strip (4 tiles)
1. **Volunteers** — count from Volunteers table
2. **Seniors** — count from Seniors table
3. **Submitted Availability** — count of volunteers with non-empty Availability Schedule
4. **Total Visits ✓** — count of Visits table rows NOT marked 'Upcoming' + `HISTORICAL_VISITS = 25` offset (pre-app visits)

### Tab: Availability
- **Volunteer List** with filter (All / Has Availability / No Availability Yet) and search
- Availability chips color-coded: AM = yellow, PM = blue, Evening = purple
- **Availability Calendar** (interactive, sits ABOVE the list)
  - Month view: full grid, green chips = volunteers, gold chips = seniors
  - Week view: 7 columns × 3 time slots grid
  - Day view: detailed list of everyone available with their time slots
  - Click any day → zooms to Day view
  - ← → navigation by month/week/day
  - Seniors parsed with day-name fallback (e.g. "Mondays" → shows on every Monday for 60 days)

### Tab: Seniors
- Shows all seniors with: Name, 📍 Address, 📞 Phone (clickable tel: link), 📧 Email, 🗣️ Language, 📅 Availability, ⏰ Preferred time, 💡 Notes
- Search by name or address

### Tab: Match Builder
- Select volunteer + senior from dropdowns
- Set date, start time, duration, language
- Add coordinator notes (optional)
- "Generate Calendar Event →" → produces copy-ready Google Calendar event description
- **"📨 Send to Volunteer Portal"** → saves to Visits table as 'Upcoming' with JSON in Notes field
- Confirmation: "✓ Saved! The volunteer will see this in their My Visit tab"
- Session list of proposed matches (not saved, cleared on close)

---

## 9. KEY HELPER FUNCTIONS (MUST PRESERVE)

### In Volunteer App
| Function | Purpose |
|----------|---------|
| `extractVal(val)` | Converts any Baserow field type (string/object/array) to plain string |
| `getVolunteerField(vol, candidates[])` | Finds field value using exact then fuzzy name matching |
| `getVolunteerEmail()` | Gets volunteer's email from Baserow row |
| `getVolunteerPhone()` | Gets volunteer's phone digits from Baserow row |
| `getVolunteerName()` | Gets volunteer's full name |
| `findBestField(fields, candidates[])` | Matches our expected field name against actual Baserow columns |
| `getTableFields(tableId)` | Fetches actual column names from Baserow table |
| `buildVisitPayload(fields, data)` | Builds Visits table row with smart field mapping |
| `looksLikeAddress(str)` | Detects if a string is an address not a name |
| `cleanPhone(p)` | Strips non-digits from phone |
| `extractVal()` | Must handle: string, number, boolean, array, {value:...} object |

### In Admin Dashboard
| Function | Purpose |
|----------|---------|
| `getVolField(row, candidates[])` | Same as getVolunteerField — handles all Baserow types |
| `extractVal(val)` | Same Baserow type handler |
| `getSeniorName/Address/Phone/Email/Avail/Lang/Time/Prefs(r)` | Senior field getters with correct exact column names |
| `findBestFieldAdmin(fields, candidates[])` | Field name fuzzy matcher for admin |
| `getTableFieldsAdmin(tableId)` | Gets Baserow column names |
| `buildCalAvailMap()` | Builds availability map for calendar rendering |
| `renderCalMonth/Week/Day()` | Calendar view renderers |

---

## 10. CRITICAL BUGS ALREADY FIXED — DO NOT REVERT

1. **Race condition in visit counter:** `loadVisitCount()` returns immediately if `CALENDAR_SCRIPT_URL` is set. Previously it ran simultaneously with `loadCalendarVisit()` and overwrote the correct calendar count with a wrong Baserow count.

2. **[object Object] display:** `extractVal()` properly handles Baserow linked records, select fields, and arrays that return objects instead of plain strings.

3. **Address shown as senior name:** `looksLikeAddress()` detects when old records stored the address in the 'Senior' field and re-routes it to the address section of the display.

4. **JSON in Notes field:** Admin saves match info as JSON to Notes field. Volunteer app tries `JSON.parse(rawNotes)` first; falls back to individual field lookup. This is the only reliable way to pass senior name, address, date, time, duration all together.

5. **Calendar bridge search window:** Changed from 90 days to 3 years back to capture all historical visits since project started.

6. **Senior field names:** After Nadouche confirmed exact column names, all admin dashboard getters use exact matches first: `'Name'`, `'Address'`, `'Phone number'`, `'Visit availability'`.

---

## 11. BUSINESS RULES (MUST PRESERVE IN ALL FUTURE CODE)

- **Official visits are in Google Calendar only** — Baserow visits table is secondary record-keeping
- **Cancelled = deleted from calendar OR 'CANCELLED' in event title** — never count these
- **Visit confirmed after 36 hours** (day-after rule) — events < 36h ago = upcoming, not completed
- **Coordinator submits availability deadline: Wednesday** — volunteers must submit by then
- **Assignments given by Friday** — volunteers expect this
- **Historical visits offset: 25** — added to admin total because visits pre-date the app
- **Volunteer privacy:** Each volunteer sees ONLY their own visits — calendar bridge filters by their email/phone
- **Password stored as SHA-256 hex in Baserow** — never store plain text passwords
- **Training progress stored in localStorage** — scoped to volunteer email so shared devices work

---

## 12. KNOWN LIMITATIONS & PENDING ITEMS

| Item | Status |
|------|--------|
| EmailJS for forgot password | ⏳ Not configured — keys are empty strings. Volunteers told to contact coordinator. |
| Calendar bridge: only 1 calendar | ⚠️ Reads Nadouche's default calendar only |
| Admin PIN in JS | ⚠️ Not secure (visible in source) — acceptable for internal tool |
| Training courses tr3-tr5, tr7-tr8 | ⏳ Marked "Coming Soon" — URLs to be added when ready |
| Volunteer portal file naming | ⚠️ Gets _1, _2 etc. appended on each download — update live URL accordingly |

---

## 13. THINGS THAT MUST NEVER BE REMOVED OR SIMPLIFIED

- The **2-step login flow** (find volunteer → password step) — do not collapse into 1 step
- The **Training tab** with all 8 modules and localStorage progress tracking
- The **bilingual EN/FR** translation system — all new strings must be added to both `T.en` and `T.fr`
- The **Bismillah Arabic text** at top of volunteer portal
- The **Everpeace Companionship logo** embedded as base64 in the admin dashboard header
- The **Bismillah + larger moon** in the admin dashboard (added intentionally)
- The **Google Maps link** on the address in My Visit display
- The **"Send to Volunteer Portal" button** in Match Builder
- The **HISTORICAL_VISITS = 25** offset in admin total visits counter
- The **JSON Notes field format** for Upcoming visits — changing this breaks My Visit display

---

## 14. WORKFLOW: HOW A VISIT IS CREATED AND SEEN

```
1. Volunteers submit availability → Baserow Volunteers table (Availability Schedule field)
2. Nadouche sees availability in Admin Dashboard calendar
3. Nadouche creates match in Match Builder → clicks "Send to Volunteer Portal"
   → Saves to Visits table: Status=Upcoming, Notes=JSON with all details
4. Nadouche ALSO creates a Google Calendar event with volunteer email+phone in description
5. Volunteer logs in → My Visit tab:
   a. Tries Google Calendar first → shows upcoming confirmed events
   b. Falls back to Visits table Upcoming row → shows match from admin dashboard
6. After visit: volunteer clicks Log Visit tab → fills in form → saves to Visits table
7. Visit counter: calendar bridge counts past events for that volunteer (completedTotal)
8. Admin sees total in dashboard (Visits table non-Upcoming rows + 25 historical offset)
```

---

## 15. WHEN ADDING NEW FEATURES — CHECKLIST

- [ ] Read the current uploaded file first — never assume it matches a previous version
- [ ] Add new translation strings to BOTH `T.en` and `T.fr`
- [ ] New Baserow fields: use `findBestField()` for flexible matching
- [ ] Never hardcode Baserow field names — always use the smart field detection helpers
- [ ] Test that the Training tab still renders after changes
- [ ] Test that the login flow (all 3 steps) still works
- [ ] Verify the visit counter race condition fix is still intact (loadVisitCount returns early)
- [ ] Do not change the Notes field JSON format for Upcoming visits
- [ ] Preserve the `extractVal()` function — it handles all Baserow field types
