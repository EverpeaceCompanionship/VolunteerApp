"""Build Everpeace-branded volunteer policy PDFs in the style of volunteer-code-of-conduct.pdf.
Usage: python3 build_policies.py OUTDIR
"""
import asyncio, base64, sys, pathlib
from playwright.async_api import async_playwright

OUT = pathlib.Path(sys.argv[1])
LOGO = base64.b64encode(open('/tmp/ec_logo.png', 'rb').read()).decode()
VERSION = 'Version 1.0 · November 2026'
FOOT = f'Ottawa, Ontario · everpeacecompanionship.org · {VERSION}'

CSS = """
@page { size: Letter; margin: 0.95in 0.9in 0.85in 0.9in; }
* { box-sizing: border-box; }
body { font-family: 'DejaVu Serif', Georgia, serif; font-size: 10.6pt; color: #1c1c1c; line-height: 1.5; margin: 0; }
.mast { text-align: center; }
.mast img { width: 1.05in; height: 1.05in; display: block; margin: 0 auto 10px; }
.org { font-family: 'DejaVu Sans', sans-serif; font-weight: 700; font-size: 10pt; letter-spacing: .38em; color: #14452f; }
.org-sub { font-family: 'DejaVu Sans', sans-serif; font-size: 7pt; letter-spacing: .22em; color: #5f5f5f; margin-top: 3px; }
.rule { border-top: 1px solid #adadad; margin: 10px 0; }
h1 { font-family: 'DejaVu Serif', serif; font-weight: 700; color: #14452f; font-size: 21pt; text-align: center; margin: 6px 0 2px; line-height: 1.2; }
.meta { font-family: 'DejaVu Sans', sans-serif; font-size: 7.2pt; letter-spacing: .14em; color: #5f5f5f; text-align: center; }
.mission { background: #f6f1e6; padding: 14px 26px; margin: 18px 0 16px; text-align: center; }
.mission .k { font-family: 'DejaVu Sans', sans-serif; font-size: 6.8pt; font-weight: 700; letter-spacing: .3em; color: #a8853f; margin-bottom: 5px; }
.mission p { font-style: italic; color: #14452f; margin: 0; font-size: 10pt; }
h2 { font-family: 'DejaVu Sans', sans-serif; font-weight: 700; font-size: 9pt; letter-spacing: .26em; color: #14452f; text-transform: uppercase;
     border-bottom: 1px solid #a8853f; padding-bottom: 5px; margin: 20px 0 9px; page-break-after: avoid; }
p { margin: 0 0 8px; text-align: justify; }
.lead { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; }
ol.num { padding-left: 0; list-style: none; counter-reset: n; margin: 0 0 6px; }
ol.num > li { counter-increment: n; position: relative; padding-left: 26px; margin-bottom: 9px; text-align: justify; page-break-inside: avoid; }
ol.num > li::before { content: counter(n) "."; position: absolute; left: 0; font-weight: 700; color: #14452f; }
ul { margin: 2px 0 8px; padding-left: 22px; } ul li { margin-bottom: 3px; }
b.t { color: #14452f; }
.ex { font-size: 9.4pt; color: #494949; font-style: italic; }
.box { border: 1px solid #d8cdb6; background: #fbf8f1; padding: 10px 14px; margin: 8px 0 12px; page-break-inside: avoid; }
.box .k { font-family: 'DejaVu Sans', sans-serif; font-size: 7pt; font-weight: 700; letter-spacing: .22em; color: #a8853f; margin-bottom: 4px; }
table.lines { width: 100%; border-collapse: collapse; margin: 6px 0 2px; }
table.lines td { padding: 0 6px; vertical-align: bottom; }
table.lines td:first-child { padding-left: 0; } table.lines td:last-child { padding-right: 0; }
.ln { border-bottom: 1px solid #1c1c1c; height: 30px; }
.lbl { font-family: 'DejaVu Sans', sans-serif; font-size: 6.8pt; letter-spacing: .2em; color: #5f5f5f; padding-top: 4px; text-transform: uppercase; }
.chk { font-family: 'DejaVu Sans', sans-serif; margin: 4px 0 4px 22px; }
.chk span { display: inline-block; width: 11px; height: 11px; border: 1px solid #1c1c1c; margin-right: 8px; vertical-align: -1px; }
.q { margin: 10px 0 2px; page-break-inside: avoid; }
.hadith { text-align: center; margin: 18px 30px 6px; color: #14452f; font-style: italic; }
.hadith small { display: block; font-style: normal; font-family: 'DejaVu Sans', sans-serif; font-size: 7.4pt; letter-spacing: .14em; color: #5f5f5f; margin-top: 4px; }
.attest { page-break-inside: avoid; }
.fine { font-family: 'DejaVu Sans', sans-serif; font-size: 7.6pt; color: #5f5f5f; margin-top: 14px; text-align: left; }
"""

def head(title):
    return f"""<div style="width:100%;margin:0 0.9in;font-family:'DejaVu Sans',sans-serif;font-size:6.6pt;letter-spacing:.2em;color:#717171;
      border-bottom:1px solid #dfdfdf;padding-bottom:5px;-webkit-print-color-adjust:exact">
      <b style="color:#14452f;letter-spacing:.3em">EVERPEACE COMPANIONSHIP</b> &nbsp;·&nbsp; {title}</div>"""

FOOTER = f"""<div style="width:100%;margin:0 0.9in;font-family:'DejaVu Sans',sans-serif;font-size:6.6pt;letter-spacing:.12em;color:#717171;
  border-top:1px solid #dfdfdf;padding-top:6px;display:flex;justify-content:space-between">
  <span>{FOOT}</span><span>Page <b style="font-family:'DejaVu Serif',serif;font-size:9pt;color:#1c1c1c"><span class="pageNumber"></span></b>
  of <b style="font-family:'DejaVu Serif',serif;font-size:9pt;color:#1c1c1c"><span class="totalPages"></span></b></span></div>"""

def mast(title):
    return f"""<div class="mast"><img src="data:image/png;base64,{LOGO}">
      <div class="org">EVERPEACE COMPANIONSHIP</div>
      <div class="org-sub">NOT-FOR-PROFIT CORPORATION · OTTAWA, ONTARIO, CANADA</div></div>
      <div class="rule"></div><h1>{title}</h1>
      <div class="meta">Volunteer Policy &nbsp;·&nbsp; {VERSION}</div><div class="rule"></div>
      <div class="mission"><div class="k">OUR MISSION</div><p>To reduce the loneliness and social isolation of Muslim seniors by building a
      structured network of volunteer companions who share their faith, language, and values, fostering meaningful relationships
      that promote dignity, spiritual well-being, and intergenerational connection.</p></div>"""

def lines(*labels):
    return '<table class="lines"><tr>' + ''.join('<td><div class="ln"></div></td>' for _ in labels) + '</tr><tr>' + \
           ''.join(f'<td class="lbl">{l}</td>' for l in labels) + '</tr></table>'

def sign_block(text, witness=True):
    s = f'<div class="attest"><h2>Volunteer Attestation</h2><p>{text}</p>' + lines('Volunteer full legal name (please print)') + \
        lines('Signature', 'Date (dd/mm/yyyy)')
    if witness:
        s += '<div style="height:6px"></div>' + lines('Witness name (please print)') + lines('Witness signature', 'Date (dd/mm/yyyy)') + \
             '<p class="fine">Anyone 18 or older may sign as your witness. Return the signed form to your Sector Coordinator or to the Executive Director.</p>'
    return s + '</div>'

HADITH = """<div class="hadith">“He is not of us who does not show mercy to our young ones and respect to our elders.”
  <small>— THE PROPHET ﷺ, SUNAN AL-TIRMIDHĪ</small></div>"""

# ─────────────────────────────────────────────────────────────
ABUSE = mast('Prevention of Abuse and Neglect') + """
<p class="lead"><b>Acknowledgement and Understanding of Prevention of Abuse and Neglect Practice and Procedure</b> — applies to every
Everpeace volunteer, whether visits take place in a senior’s home, a retirement home or a long-term care home.</p>

<h2>Our Commitment</h2>
<p>Every senior we visit has the right to be treated with dignity and respect, and to live free from threats, fear and harm.
Everpeace Companionship has <b>zero tolerance</b> for abuse or neglect of any kind. No senior shall be subjected to sexual, verbal,
physical, emotional or financial abuse, or to neglect, by a volunteer or by anyone else while in our care.</p>
<p>Many of the seniors we serve are isolated, frail or living with dementia, which makes them more vulnerable. As a trusted visitor,
you are often the person most likely to notice that something is wrong. This policy explains what abuse and neglect are, what you
must never do, and what you must do when you see or suspect harm.</p>

<h2>Definitions</h2>
<ol class="num">
<li><b class="t">Sexual abuse</b> — any touching, behaviour or remarks of a sexual nature, or sexual exploitation, directed towards a senior.
<div class="ex">Examples: sexual jokes with or around a senior, accepting sexual advances, referring to a senior’s body in vulgar terms, any
unwanted touching.</div></li>
<li><b class="t">Verbal abuse</b> — any threatening, intimidating, belittling or degrading words that diminish a senior’s sense of well-being,
dignity or self-worth.
<div class="ex">Examples: mocking the way a senior speaks, name-calling, insults, swearing, yelling or raising your voice.</div></li>
<li><b class="t">Physical abuse</b> — the use of physical force that causes injury or pain, or giving or withholding medication for an
improper purpose.
<div class="ex">Examples: slapping, pushing, pinching, shaking, rough handling, forcing food or drink, or confining a senior to a room, bed or
chair. Volunteers never give, hold back or handle medication.</div></li>
<li><b class="t">Emotional abuse</b> — threatening, insulting, intimidating or humiliating gestures, actions or remarks, including imposed
isolation, shunning, ignoring, or treating a senior like a child (infantilization).
<div class="ex">Examples: humiliating or threatening a senior, ignoring them, excluding them from decisions about their own life, or
mocking their faith, culture or memory.</div></li>
<li><b class="t">Financial abuse</b> — any misuse or misappropriation of a senior’s money, property or belongings.
<div class="ex">Examples: borrowing or taking money, gifts or possessions; pressuring a senior to sign documents, sell property or change a will;
fraud, forgery or misuse of a Power of Attorney. Our Code of Conduct already forbids accepting money, gift cards or valuables, even when
offered freely.</div></li>
<li><b class="t">Neglect</b> — failing to provide, or to get help for, the care, assistance or attention a senior needs for their health,
safety or well-being, including a pattern of inaction.
<div class="ex">Examples: ignoring a senior who is in distress, noticing a fall, injury or unsafe condition and saying nothing, or
leaving a dependent senior without help you had agreed to arrange.</div></li>
</ol>

<h2>Warning Signs to Watch For</h2>
<ul>
<li>Unexplained bruises, burns, cuts or injuries, or explanations that do not fit the injury.</li>
<li>A senior who seems afraid, withdrawn, anxious or unusually quiet around a particular person.</li>
<li>Poor hygiene, weight loss, dehydration, unsafe living conditions or missing glasses, hearing aids or mobility aids.</li>
<li>Missing money or belongings, unpaid bills, sudden changes to banking or legal documents, or a new “friend” taking control of finances.</li>
<li>A carer or relative who will not let you see the senior alone, or who speaks for them.</li>
</ul>

<h2>What You Must Do — Reporting Procedure</h2>
<ol class="num">
<li><b class="t">If a senior is in immediate danger, call 911 first.</b> Stay with the senior if it is safe to do so.</li>
<li><b class="t">Report to Everpeace the same day.</b> Tell your Sector Coordinator or the Executive Director as soon as possible — never
later than the same day. Do not wait to be certain: a reasonable suspicion is enough.</li>
<li><b class="t">In a long-term care or retirement home, also tell the staff in charge</b> (charge nurse or manager). Under Ontario law,
anyone — including visitors and volunteers — who has reasonable grounds to suspect abuse or neglect of a resident must report it.</li>
<li><b class="t">Write down what you saw or heard</b> — date, time, place, the people involved and the senior’s own words — and log a
follow-up in the Volunteer Portal. Stick to facts; do not investigate, confront the suspected person or promise the senior secrecy.</li>
<li><b class="t">Keep it confidential.</b> Discuss the report only with Everpeace leadership and the authorities involved.</li>
</ol>
<div class="box"><div class="k">WHO TO CALL IN ONTARIO</div>
Emergency: <b>911</b> &nbsp;·&nbsp; Long-term care homes — Family Support and Action Line: <b>1-866-434-0144</b> (daily 8:30 a.m.–7 p.m.)<br>
Retirement homes — Retirement Homes Regulatory Authority: <b>1-855-275-7472</b><br>
Seniors Safety Line (24/7, free, confidential, 200+ languages): <b>1-866-299-1011</b><br>
A senior living at home: Ottawa Police non-emergency line, after informing Everpeace.</div>

<h2>Protection and Consequences</h2>
<p>No volunteer will face retaliation for reporting abuse or neglect in good faith. Any volunteer who abuses or neglects a senior, or who
knowingly fails to report it, will be removed from visits immediately and may be dismissed from Everpeace Companionship. Where the law
requires it, Everpeace will report the matter to the police or the appropriate authority.</p>
""" + HADITH + sign_block("""By signing below, I confirm that I have read and understand the Everpeace Companionship Prevention of Abuse and Neglect
Practice and Procedure. I agree to follow it and to report any abuse or neglect I see or suspect. I understand that a violation of this
policy will lead to disciplinary action, up to and including dismissal.""")

# ─────────────────────────────────────────────────────────────
CONF = mast('Pledge of Confidentiality and Privacy') + """
<h2>Why Confidentiality Matters</h2>
<p>Seniors and their families open their homes and their lives to us. Through your volunteer work you will learn personal information —
and sometimes personal health information — about seniors, their families, care facilities and fellow volunteers. Protecting that
information is a matter of trust (<i>amānah</i>) and is required by Canada’s <i>Personal Information Protection and Electronic Documents
Act</i> (PIPEDA) and, in care settings, Ontario’s <i>Personal Health Information Protection Act</i> (PHIPA).</p>

<h2>What Is Confidential</h2>
<p>Any information that could identify a person, or that you learn because of your volunteer role, including:</p>
<ul>
<li>names, addresses, phone numbers, photos, ages and dates of birth;</li>
<li>physical or mental health, including memory loss, diagnoses, medications, care plans and family health history;</li>
<li>family situations, finances, conflicts, religious practice and anything a senior tells you in confidence;</li>
<li>information about other volunteers and about Everpeace partner facilities and their staff;</li>
<li>everything you see in the Volunteer Portal, visit assignments, calendars and coordinator messages.</li>
</ul>
<p>Information is still confidential if you leave out a name but the person could reasonably be recognized.</p>

<h2>My Pledge</h2>
<ol class="num">
<li><b class="t">Respect privacy.</b> At all times I will respect the privacy of the seniors I visit, their families, facility staff and fellow
volunteers.</li>
<li><b class="t">Need to know only.</b> I will access, use or share confidential information only when I need it for my volunteer role, and
only with designated Everpeace staff or the care team.</li>
<li><b class="t">No gossip, no sharing.</b> I will not discuss seniors or what happens during visits with my family, friends, community members
or other volunteers, including at the mosque, at events or in group chats.</li>
<li><b class="t">No photos, recordings or posts.</b> I will not photograph or record seniors, their homes or facilities, or post identifying
information on social media, without express written authorization from Everpeace administration.</li>
<li><b class="t">Protect my access.</b> I will keep my Volunteer Portal password private, never let anyone else use my account, and log out on
shared devices.</li>
<li><b class="t">Keep records safe.</b> I will not copy, alter, keep or take away notes or documents containing confidential information,
and I will delete visit-related messages once they are no longer needed.</li>
<li><b class="t">Report breaches.</b> If I share information by mistake, or learn that it has been misused, I will tell my Sector Coordinator
or the Executive Director right away.</li>
</ol>

<div class="box"><div class="k">EXAMPLES OF PRIVACY BREACHES</div>
Looking up or asking for information you do not need for your visits · telling someone a senior’s diagnosis or address · sharing a
visit photo in a WhatsApp group · discussing a senior’s family conflict with others · letting someone use your portal login · altering
a visit log or record.</div>

<h2>Limits of Confidentiality</h2>
<p>Confidentiality never prevents you from protecting a senior. If you believe a senior is being harmed, neglected or exploited, or is at
risk of harming themselves or others, you must report it as set out in the <b>Prevention of Abuse and Neglect</b> policy. Never promise a
senior that you will keep this kind of information secret.</p>

<h2>Duration and Consequences</h2>
<p>This pledge stays in force during my volunteer service and <b>after it ends</b>, for as long as the information remains confidential.
I understand that breaching it may lead to disciplinary action, up to and including dismissal, and may carry legal consequences.</p>
""" + sign_block("""By signing below, I confirm that I have read and understood this Pledge of Confidentiality and Privacy, and I agree to abide by
it during and after my volunteer service with Everpeace Companionship.""")

# ─────────────────────────────────────────────────────────────
def yesno(text, what):
    return f'<div class="q">{text}</div><div class="chk"><span></span>No</div>' \
           f'<div class="chk"><span></span>Yes, and every {what} (with details and outcome) is disclosed in Section C.</div>'

DETAIL = lines('Name of offence / finding', 'Date') + lines('Court or regulatory authority and its location') + \
         lines('Brief description and outcome') + '<div class="ln"></div>'

DECL = mast('Declaration of Offences and Misconduct') + """
<p class="lead"><b>For persons applying for or holding a volunteer position with Everpeace Companionship.</b></p>
<p>Everpeace volunteers spend time with vulnerable older adults, often alone with them or in long-term care homes. To keep seniors safe,
Everpeace requires every volunteer to provide a Police Vulnerable Sector Check and to disclose the offences and acts of professional
misconduct listed below. These categories follow those that Ontario long-term care homes must screen for under section 81 of the
<i>Fixing Long-Term Care Act, 2021</i> and Ontario Regulation 246/22.</p>
<p><b>Instructions:</b> 1. Read Section A. &nbsp;2. Answer every question in Section B and complete Section C if needed. &nbsp;3. Sign Section D.
A “yes” answer does not automatically exclude you; each disclosure is reviewed confidentially and individually.</p>

<h2>Section A — Important Information</h2>
<ol class="num">
<li><b class="t">Offence</b> means conduct or a violation punishable under criminal law or under a federal or provincial statute.</li>
<li><b class="t">Professional misconduct</b> means behaviour that is professionally unsuitable, potentially dangerous, incompetent, disruptive,
abusive or illegal, as found by a regulatory authority, professional association or body that regulates a profession, occupation or
activity.</li>
</ol>
<div class="box"><div class="k">OFFENCES TO DISCLOSE</div>
(a) Any offence under the <i>Fixing Long-Term Care Act, 2021</i>, the <i>Long-Term Care Homes Act, 2007</i>, the <i>Nursing Homes Act</i>, the
<i>Charitable Institutions Act</i> or the <i>Homes for the Aged and Rest Homes Act</i>.<br>
(b) Any offence referred to in section 742.1 of the <i>Criminal Code</i> (Canada) (conditional sentences served in the community).<br>
(c) Any offence under the <i>Cannabis Act</i>, the <i>Controlled Drugs and Substances Act</i> or the <i>Food and Drugs Act</i> (Canada).<br>
(d) Any other provincial or federal offence involving (i) improper or incompetent treatment or care of a vulnerable person, (ii) abuse or
neglect of a vulnerable person, (iii) unlawful conduct that intentionally caused harm or a risk of harm to a vulnerable person, or
(iv) misuse or misappropriation of a vulnerable person’s money.</div>
<div class="box"><div class="k">ACTS OF PROFESSIONAL MISCONDUCT TO DISCLOSE</div>
(a) Misconduct as a member of a health profession under the <i>Regulated Health Professions Act, 1991</i>.<br>
(b) Misconduct as a member of a regulated profession under the <i>Fair Access to Regulated Professions and Compulsory Trades Act, 2006</i>.<br>
(c) Misconduct under any other scheme governing a profession, occupation or activity.</div>
<p>If you are unsure whether something must be disclosed, speak confidentially with the Executive Director before signing.</p>

<h2>Section B — Disclosure</h2>
<p><b>Offences — charges, orders and convictions.</b> Since the date of the Police Vulnerable Sector Check I provided to Everpeace Companionship:</p>
""" + yesno('1. I have been charged with one or more of the offences listed in Section A.', 'charge') + \
      yesno('2. I have been the subject of an order by a judge or justice of the peace (including a peace bond, probation order, prohibition order or arrest warrant) in respect of an offence listed in Section A.', 'order') + \
      yesno('3. I have been convicted of, or received another outcome for, one or more of the offences listed in Section A.', 'conviction') + """
<p style="margin-top:12px"><b>Professional misconduct — proceedings and findings.</b></p>
""" + yesno('4. Except for any proceeding that ended more than 5 years ago, I was or am the subject of a proceeding that could lead to a finding of professional misconduct listed in Section A.', 'proceeding') + \
      yesno('5. Except where any suspension ended, or (if there was no suspension) the finding was made, more than 5 years ago, I was found guilty of an act of professional misconduct listed in Section A.', 'finding') + """

<h2>Section C — Details</h2>
<p>If you answered “yes” to any question in Section B, give the date, the name and location of the court or regulatory authority, and a brief
description and outcome of each charge, order, conviction, proceeding or finding. Attach additional pages if needed.</p>
""" + DETAIL + '<div style="height:12px"></div>' + DETAIL + """

<div class="attest"><h2>Section D — Verification</h2>
<p>I declare that the information I have provided in this form is true and complete. I understand that a false or incomplete declaration
may result in the refusal or termination of my volunteer position.</p>
<p>I understand that, for as long as I volunteer with Everpeace Companionship, I must inform the Executive Director as soon as I become
aware of any charge, order, conviction or other outcome, or of the start of any proceeding or finding of guilt, relating to the offences
and acts of professional misconduct set out in Section A.</p>
""" + lines('Volunteer full legal name (please print)') + lines('Signature', 'Date (dd/mm/yyyy)') + """
<p class="fine"><b>Privacy notice.</b> Everpeace Companionship collects this personal information solely to assess suitability for volunteer
work with vulnerable seniors. It is kept confidential, stored securely with access limited to the Executive Director, and handled in
accordance with PIPEDA. It is not shared with partner facilities without your consent unless required by law. Questions may be
directed to the Executive Director of Everpeace Companionship.</p></div>
"""

DOCS = [
    ('volunteer-prevention-of-abuse.pdf', 'Prevention of Abuse and Neglect', ABUSE),
    ('volunteer-confidentiality-pledge.pdf', 'Pledge of Confidentiality and Privacy', CONF),
    ('volunteer-offence-declaration.pdf', 'Declaration of Offences and Misconduct', DECL),
]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        for fname, title, body in DOCS:
            await pg.set_content(f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>')
            await pg.pdf(path=str(OUT / fname), format='Letter', print_background=True, display_header_footer=True,
                         header_template=head(title), footer_template=FOOTER,
                         margin={'top': '0.95in', 'bottom': '0.85in', 'left': '0.9in', 'right': '0.9in'})
            print('built', fname)
        await b.close()

asyncio.run(main())
