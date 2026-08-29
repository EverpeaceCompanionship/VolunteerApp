// ============================================================
// ADOPT A MUSLIM SENIOR — Google Calendar Bridge
// ============================================================
// SETUP:
//   1. Go to script.google.com → New Project
//   2. Paste this entire file (replacing the default function)
//   3. Click Deploy → New Deployment → Web App
//   4. Execute as: Me | Who has access: Anyone
//   5. Copy the URL → paste into volunteer-app_13.html as CALENDAR_SCRIPT_URL
// ============================================================

const COMPLETED_THRESHOLD_HOURS = 36; // hours after visit before it counts as "confirmed done"
const CANCELLED_KEYWORDS = ['cancel', 'cancelled', 'annulé', 'annulée', 'annule'];

function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const email  = (e.parameter.email  || '').toLowerCase().trim();
    const rawPhone = e.parameter.phone || '';
    const phone  = rawPhone.replace(/\D/g, '');

    if (!email && phone.length < 7) {
      return output.setContent(JSON.stringify({
        success: false,
        error: 'No identifier provided (email or phone required)'
      }));
    }

    const cal  = CalendarApp.getDefaultCalendar();
    const now  = new Date();

    // Search window: 3 years back → 60 days ahead (captures all visits since project start)
    const windowStart = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const allEvents = cal.getEvents(windowStart, windowEnd);

    // Keep only events that mention this volunteer's email or phone
    const matched = allEvents.filter(ev => {
      const title = (ev.getTitle()       || '').toLowerCase();
      const desc  = (ev.getDescription() || '').toLowerCase();
      const combined = title + '\n' + desc;

      if (email && combined.includes(email)) return true;

      if (phone.length >= 7) {
        const last10 = phone.slice(-10);
        const digits = combined.replace(/\D/g, '');
        if (digits.includes(last10)) return true;
      }

      return false;
    });

    // Threshold: event must be > 36h in the past to count as "confirmed completed"
    const confirmedCutoff = new Date(now.getTime() - COMPLETED_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Current month for monthly stats
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const upcoming  = [];
    const completed = [];
    let   thisMonth = 0;

    matched.forEach(ev => {
      const title = ev.getTitle() || '';

      // Skip anything explicitly marked cancelled in the title
      if (CANCELLED_KEYWORDS.some(kw => title.toLowerCase().includes(kw))) return;

      const startTime = ev.getStartTime();
      const endTime   = ev.getEndTime();

      const eventData = {
        title:       title,
        start:       startTime.toISOString(),
        end:         endTime.toISOString(),
        location:    ev.getLocation() || '',
        description: ev.getDescription() || '',
        seniorName:  extractSeniorName(title, ev.getDescription() || '')
      };

      if (startTime < confirmedCutoff) {
        // Past confirmed visit
        completed.push(eventData);
        if (startTime >= monthStart) thisMonth++;
      } else {
        // Upcoming or very recent
        upcoming.push(eventData);
      }
    });

    // Sort upcoming soonest-first; completed most-recent-first
    upcoming.sort( (a, b) => new Date(a.start) - new Date(b.start));
    completed.sort((a, b) => new Date(b.start) - new Date(a.start));

    return output.setContent(JSON.stringify({
      success:          true,
      upcoming:         upcoming.slice(0, 10),
      completedTotal:   completed.length,
      completedThisMonth: thisMonth,
      recentCompleted:  completed.slice(0, 5)
    }));

  } catch (err) {
    return output.setContent(JSON.stringify({
      success: false,
      error:   err.toString()
    }));
  }
}

// -------------------------------------------------------
// Extract senior name from event title or description
// Supports patterns like:
//   "Visit with Sr. Fatima"
//   "Senior: Fatima Al-Hassan"
//   "Aîné(e): Fatima Al-Hassan"
// -------------------------------------------------------
function extractSeniorName(title, desc) {
  const patterns = [
    /senior\s*[:\-–]\s*([^\n\r,;]+)/i,
    /a[iî]n[ée]\s*[:\-–]\s*([^\n\r,;]+)/i,
    /(?:visit\s+with|visite\s+avec)\s+([^\n\r,;—–-]+)/i,
  ];

  const combined = title + '\n' + desc;
  for (const re of patterns) {
    const m = combined.match(re);
    if (m && m[1]) return m[1].trim();
  }

  return '';
}
