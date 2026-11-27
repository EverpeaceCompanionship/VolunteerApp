/* ============================================================
   Ten messages of gratitude — International Volunteer Day 2026
   Shared by the Volunteer Portal and the public website.

   • Shown from START to END (Ottawa time), then hides itself.
   • Portal  (data-mode="portal"):  the cover + TODAY's message
     (message N on day N; if a day's message isn't in yet, the
     latest earlier one stays up).
   • Website (data-mode="website"): the cover + the messages marked
     `website: true` (Nadia's message and the general team message).

   To add a message: add an entry to MESSAGES with its `day` (1–10).
   Text is shown exactly as written. No personal data here — this
   file is public.
   ============================================================ */
(function () {
  var START = '2026-11-27';        // day 1
  var END   = '2026-12-06';        // last day shown (day 10)
  var TOTAL = 10;

  var MESSAGES = [
    {
      day: 1,
      website: true,
      text: 'Our organization is only as strong as the hearts behind it, and your selfless dedication is the very reason we stand today. Thank you for turning compassion into action and carrying our mission forward when it matters most. May your generosity return to you tenfold —',
      highlight: 'Jazakum Allahou Khayra Al Jazae.',
      author: 'Nadia Olfa Kebaier',
      role: 'Founder & Chair, Board of Directors'
    }
    // { day: 2, text: '…', author: '…', role: '…' },
    // General team message for the website (added on Dec 5): { day: 9, website: true, text: '…', author: 'The Everpeace Companionship Team', role: '…' },
  ];

  var MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var DAYS_FR   = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

  function ottawaToday() {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      var g = function (t) { return p.filter(function (x) { return x.type === t; })[0].value; };
      return g('year') + '-' + g('month') + '-' + g('day');
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
  }
  function addDays(iso, n) {
    var a = iso.split('-').map(Number), d = new Date(Date.UTC(a[0], a[1] - 1, a[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function dayIndex(today) {
    var a = START.split('-').map(Number), b = today.split('-').map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 864e5) + 1;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  var base = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : 'https://everpeacecompanionship.github.io/VolunteerApp/';
  })();
  var LOGO = base + 'images/logo-gold-champagne.png';

  var CSS = '' +
  '.epg{display:flex;flex-direction:column;gap:18px;margin:0 0 22px;font-family:"EB Garamond",Georgia,serif}' +
  '.epg-card{position:relative;background:radial-gradient(ellipse at 50% 32%,#123068 0%,#0A2150 28%,#051635 62%,#030E24 100%);color:#FBF7EE;border-radius:10px;padding:26px;box-shadow:0 1px 2px rgba(5,22,53,.08),0 18px 40px -26px rgba(5,22,53,.6);overflow:hidden}' +
  '.epg-frame{position:relative;border:1px solid rgba(205,174,116,.55);outline:1px solid rgba(205,174,116,.35);outline-offset:4px;border-radius:2px;padding:34px 28px 22px}' +
  '.epg-star{position:absolute;width:12px;height:12px;color:#CDAE74}' +
  '.epg-star.tl{top:-11px;left:-11px}.epg-star.tr{top:-11px;right:-11px}.epg-star.bl{bottom:-11px;left:-11px}.epg-star.br{bottom:-11px;right:-11px}' +
  '.epg-logo{display:block;width:96px;height:auto;margin:0 auto}' +
  '.epg-kicker{font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:#CDAE74;font-weight:500}' +
  '.epg-cover{text-align:center}' +
  '.epg-cover .epg-kicker{margin:16px 0 14px}' +
  '.epg-h1{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(34px,6.2vw,62px);line-height:1.02;margin:0;color:#FBF7EE}' +
  '.epg-h1fr{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:clamp(20px,3vw,28px);color:#CDAE74;margin:4px 0 16px}' +
  '.epg-occ{font-size:13px;letter-spacing:.2em;text-transform:uppercase;font-weight:600;color:#FBF7EE}' +
  '.epg-occfr{font-style:italic;font-size:14px;color:#C9CCD6;margin:2px 0 14px}' +
  '.epg-dates{font-size:12.5px;letter-spacing:.24em;text-transform:uppercase;color:#CDAE74;font-weight:600}' +
  '.epg-motto{text-align:center;font-style:italic;font-size:12px;color:#C9CCD6;margin-top:26px}' +
  '.epg-msg{display:grid;grid-template-columns:minmax(170px,32%) 1fr;gap:0}' +
  '.epg-side{text-align:center;padding:8px 22px 8px 4px;border-right:1px solid rgba(205,174,116,.45);display:flex;flex-direction:column;align-items:center;justify-content:center}' +
  '.epg-side .epg-kicker{font-size:11.5px;letter-spacing:.28em;margin-top:12px;line-height:1.5}' +
  '.epg-dia{display:flex;align-items:center;gap:8px;margin:12px 0 8px}.epg-dia i{display:block;width:30px;height:1px;background:rgba(205,174,116,.6)}.epg-dia b{display:block;width:5px;height:5px;background:#CDAE74;transform:rotate(45deg)}' +
  '.epg-num{font-family:"Cormorant Garamond",Georgia,serif;font-size:56px;line-height:1;color:#CDAE74;font-weight:500}' +
  '.epg-month{font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;margin-top:4px}' +
  '.epg-dayfr{font-style:italic;font-size:14px;color:#C9CCD6;margin-top:2px}' +
  '.epg-count{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#CDAE74;margin-top:14px}' +
  '.epg-countfr{font-style:italic;font-size:12.5px;color:#C9CCD6}' +
  '.epg-body{padding:8px 6px 8px 30px;display:flex;flex-direction:column;justify-content:center}' +
  '.epg-body .epg-kicker{font-size:11.5px;letter-spacing:.24em}' +
  '.epg-thanks{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(40px,5.4vw,56px);line-height:1;margin:12px 0 0}' +
  '.epg-merci{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:24px;color:#CDAE74;margin:2px 0 14px}' +
  '.epg-quote{font-style:italic;font-weight:600;font-size:16px;line-height:1.55;margin:0;color:#FBF7EE}' +
  '.epg-quote em{color:#CDAE74;font-weight:500}' +
  '.epg-sign{font-family:"Great Vibes",cursive;font-size:34px;color:#CDAE74;margin:12px 0 0;line-height:1.1}' +
  '.epg-role{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#C9CCD6;margin-top:4px}' +
  '.epg-stack .epg-msg{grid-template-columns:1fr}.epg-stack .epg-side{border-right:0;border-bottom:1px solid rgba(205,174,116,.45);padding:0 0 18px}.epg-stack .epg-body{padding:18px 2px 0}.epg-stack .epg-card{padding:16px}.epg-stack .epg-frame{padding:26px 16px 18px}' +
  '@media (max-width:620px){.epg-card{padding:16px}.epg-frame{padding:26px 16px 18px}.epg-msg{grid-template-columns:1fr}.epg-side{border-right:0;border-bottom:1px solid rgba(205,174,116,.45);padding:0 0 18px}.epg-body{padding:18px 2px 0}.epg-num{font-size:46px}}';

  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z"/></svg>';
  function frame(inner) {
    return '<div class="epg-card"><div class="epg-frame">' +
      ['tl', 'tr', 'bl', 'br'].map(function (k) { return '<span class="epg-star ' + k + '">' + STAR + '</span>'; }).join('') +
      inner + '<div class="epg-motto">Your presence, their peace. · Votre présence, leur paix.</div></div></div>';
  }

  function coverHTML() {
    return frame('<div class="epg-cover">' +
      '<img class="epg-logo" src="' + LOGO + '" alt="Everpeace Companionship">' +
      '<div class="epg-kicker">Everpeace Companionship</div>' +
      '<h2 class="epg-h1">Ten messages of gratitude</h2>' +
      '<div class="epg-h1fr" lang="fr">Dix messages de gratitude</div>' +
      '<div class="epg-occ">Celebrating International Volunteer Day</div>' +
      '<div class="epg-occfr" lang="fr">Célébrons la Journée internationale des bénévoles</div>' +
      '<div class="epg-dates">27 November – 5 December 2026</div>' +
      '</div>');
  }

  function messageHTML(m) {
    var iso = addDays(START, m.day - 1), a = iso.split('-').map(Number);
    var wd = new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay();
    return frame('<div class="epg-msg">' +
      '<div class="epg-side">' +
        '<img class="epg-logo" src="' + LOGO + '" alt="">' +
        '<div class="epg-kicker">Everpeace<br>Companionship</div>' +
        '<div class="epg-dia" aria-hidden="true"><i></i><b></b><i></i></div>' +
        '<div class="epg-num">' + a[2] + '</div>' +
        '<div class="epg-month">' + MONTHS_EN[a[1] - 1] + ' ' + a[0] + '</div>' +
        '<div class="epg-dayfr" lang="fr">' + DAYS_FR[wd] + ' ' + a[2] + ' ' + MONTHS_FR[a[1] - 1] + '</div>' +
        '<div class="epg-count">Message ' + m.day + ' of ' + TOTAL + '</div>' +
        '<div class="epg-countfr" lang="fr">Message ' + m.day + ' sur ' + TOTAL + '</div>' +
      '</div>' +
      '<div class="epg-body">' +
        '<div class="epg-kicker">International Volunteer Day · 5 December</div>' +
        '<div class="epg-thanks">Thank you</div>' +
        '<div class="epg-merci" lang="fr">Merci</div>' +
        '<p class="epg-quote">“' + esc(m.text) + (m.highlight ? ' <em>' + esc(m.highlight) + '</em>' : '') + '”</p>' +
        '<div class="epg-sign">— ' + esc(m.author) + '</div>' +
        (m.role ? '<div class="epg-role">' + esc(m.role) + '</div>' : '') +
      '</div></div>');
  }

  function render() {
    var today = ottawaToday();
    var box = document.getElementById('ep-gratitude');
    if (!box) return;
    var wrap = box.closest && box.closest('[data-epg-wrap]');
    if (today < START || today > END) { box.innerHTML = ''; box.style.display = 'none'; if (wrap) wrap.style.display = 'none'; return; }
    if (wrap) wrap.style.display = '';
    var mode = box.getAttribute('data-mode') || 'portal';
    var n = dayIndex(today), shown = [];
    if (mode === 'website') {
      shown = MESSAGES.filter(function (m) { return m.website && m.day <= n; });
    } else {
      var avail = MESSAGES.filter(function (m) { return m.day <= n; }).sort(function (x, y) { return y.day - x.day; });
      if (avail.length) shown = [avail[0]];
    }
    if (!document.getElementById('epg-style')) {
      var st = document.createElement('style'); st.id = 'epg-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    box.className = mode === 'portal' ? 'epg epg-stack' : 'epg';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Ten messages of gratitude — International Volunteer Day');
    box.style.display = '';
    box.innerHTML = coverHTML() + shown.map(messageHTML).join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  // Roll over to the next message at midnight without a reload
  setInterval(function () { var b = document.getElementById('ep-gratitude'); if (b && b.dataset.day !== ottawaToday()) { b.dataset.day = ottawaToday(); render(); } }, 60000);
})();
