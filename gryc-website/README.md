# GRYC SYEP Site Monitor Portal — demo

A working demo of a digital replacement for the SYEP site monitor's paper packet:
the monitoring log, the multi-page worksite assessment, the mileage form, timesheet
pickup tracking, the childcare questionnaire, and the per-participant paperwork the
monitor has to account for.

Pure HTML/CSS/JavaScript — no build step, no backend. All data lives in the
browser's `localStorage`, so anything you enter persists across page loads and is
wiped by **Reset demo data** on the dashboard.

### Two version numbers, and they are not the same thing

**`?v=N` on the `assets/…` tags — bump on every change.** Without it the browser
keeps running the copy of `data.js` it already has, and nothing else in this
section can save you: `SEED_VERSION` lives *inside* the file the browser is
refusing to re-fetch, so the check never runs. This one-liner stamps all nine
pages:

```
node -e 'const fs=require("fs"),V=15;for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".html")))fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(/(href|src)="(assets\/(?:styles\.css|data\.js|app\.js))(\?v=\d+)?"/g,(_,a,p)=>a+`="${p}?v=${V}"`))'
```

**`SEED_VERSION` in `assets/data.js` — bump only when `seed()` or a record shape
changes.** Browsers holding an older database re-seed on the next load. Raising it
**wipes whatever is in the browser**, so leave it alone for markup, styling, or
behaviour changes.

The dashboard prints `build N` beside **Reset demo data**, read from the `?v=` the
browser actually fetched. If that number is behind, it is a cache problem and not
a code problem.

## Running it

Open `index.html` in a browser. Some browsers restrict `localStorage` on
`file://` URLs; if the demo looks empty, serve the folder instead:

```
python3 -m http.server 8777
# then open http://localhost:8777
```

**Login:** `ashtonreyes@gryc.org` / `monitor`

## Pages

| File | What it is |
|---|---|
| `index.html` | Sign-in |
| `dashboard.html` | All assigned worksites, weekly status chips, register a new site |
| `schedule.html` | "This Week" — outstanding tasks across all sites, week × site grid, mileage recap |
| `site.html` | One worksite: Overview / Worksite Application / Participants / Monitoring Log / Weekly |
| `assessment.html` | The weekly assessment — 7- or 8-step wizard plus a printable packet view |
| `childcare.html` | The per-participant childcare questionnaire, for childcare sites |
| `mileage.html` | MILEAGE FORM SYEP 2026 |
| `w9.html` | IRS Form W-9 — typed in as plain questions, laid out on the form, signed last |
| `i9.html` | USCIS Form I-9 — Section 1 by the employee, Section 2 by the employer, each signed last |
| `assets/data.js` | Program calendar, form definitions, seed data, all storage access |
| `assets/app.js` | Shared UI: header, modals, toasts, signature pad, form controls |
| `assets/styles.css` | Everything visual, including the print styles for the packet |

## What maps to which piece of paper

**Worksite Application** → the site record. Everything the application captures
(general information, sector/industry, cross streets and travel directions,
supervision and management, participants requested and the supervisor:participant
ratio, the weekly shift schedule, job titles and duties, Attachment 1 for childcare
sites, and the required certifications) lives on the site and pre-fills the
assessment. A site with no application on file says so and flags it on the worklist.

**Site Assignment Roster** → the Participants tab, with the same columns as the YEPS
*Worksite Assignments* export: Application ID, Last Name, First Name, Program,
Borough, Phone, Age, Cohort. Paste rows straight out of YEPS to import. Participants
who transferred or were terminated stay on the roster but drop out of the counts.

**Dates and times.** The assessment carries a single **date of visit** — the one printed
beside your name on page 1 and against both signatures on page 5. Times in and out live
on the monitoring log, where the paper form actually asks for them, and nowhere else.

**Monitoring Log** → Check in / Check out on the site page. Reason for visit is
"check all applicable" with the same three boxes as the paper form — Monitoring,
Time-Sheet Pick-Up, Other (with a write-in). Times are quarter-hour dropdowns,
because that is how the log is actually filled in.

**Worksite Assessment Report** → `assessment.html`, one step per section of the packet:

| Step | Packet page |
|---|---|
| Site & facility | p.1 — general info, date of visit, expected work mode, participants assigned/present, facility condition, hazardous conditions |
| Recordkeeping | p.2 — the nine recordkeeping boxes, plus the supervisor table (name / title / area / room / trained) |
| Attendance | p.2 — "are all participants accounted for", absences with reason and supervisor initial, work schedule |
| Operations | p.2 — the four Yes/No/N-A operations questions |
| Activities | p.3 — safe environment, the five Program Activities questions |
| Childcare | p.3 — childcare sites only: license/permit, ratio table, job duties, age ranges, daily responsibilities |
| Summary & sign | p.5 — Overall Report Summary, both signatures, Provider Supervisor follow-up block |
| Interviews | p.6 — two participant interviews, twelve questions each |

Filing the packet warns you if no monitoring log entry exists for that date — it does
not invent one, because the log needs times the assessment no longer asks for. The
read-only view lays every page out like the printed form and prints one packet page
per sheet.

**Answers that don't change week to week.** Most of the packet describes the site, not
the visit: the same supervisor, the same facility boxes, the same binder, the same
shift hours. **Reuse these answers** in the wizard header saves what is on screen as
that site's standing answers, and any week you have not started yet opens with them
already filled in. Weeks already filed or saved as drafts are left alone; the dialog
also offers to fill the current week in from them, or to forget them.

Which fields carry is decided once, in `ASSESSMENT_CARRY_GROUPS` in `assets/data.js`,
and the dialog prints both lists side by side so it is never a question of remembering
which boxes were sticky. The date of visit, who was assigned and present, absences,
hazards, the summary, the follow-up block, both signatures and the two interviews are
always typed fresh.

**Findings** are derived, not typed. Any unchecked facility item, missing record, "No"
on an operations or program-activity question, a hazard note, or a concerning interview
answer (including "Yes" to *do you have any questions, issues, or concerns?*) becomes a
flagged item. The form will not submit until the summary addresses them — there's an
**Insert findings** button that drops them into the summary box for you.

**Participant documents** → the roster's Referral Sheet, Week 3 Evaluation and Week 6
Evaluation are plain tick boxes, because the only record of them is the signed paper
in your folder. Anything not due yet still ticks — its column header just carries a
grey *Not due yet · wk N* chip so you can see you're running ahead.

A document the app can actually fill in is a **button** instead, and submitting the
form is what ticks it — so a tick never means "I clicked a box". That is decided by
`docsFor()` in `assets/data.js`: give a document a `form:` and its column becomes
**Fill out** / **✓ On file**.

**Childcare questionnaire** → `childcare.html`, one per participant at a childcare
site, reachable from the Childcare Questionnaire column on the roster. The questions
are the Childcare Site Questions off page 4 of the assessment packet, asked about one
youth instead of about the site: which licence or permit is on file and when it
expires, confirmation that the supervisor knows the DOH ratios and that participants
are never left alone with children, whether *this* youth's duties were outlined to
them, which age band they fall in, and what they actually do all day — plus supervisor
and youth signatures.

It fills itself in as far as it honestly can: the age band comes from the roster age,
the daily responsibilities from the job duties on the Worksite Application, and every
questionnaire after the first starts from the last one completed at that site, since
Q1, Q2 and Q5 are answered the same way for everyone there. Signatures are never
carried. A banner says where the answers came from. Completing it ticks the roster box;
**Mark as not received** unticks it and keeps the answers.

**Participant evaluations stay on paper.** The week 3 and week 6 forms are handed to
the supervisor ahead of the week and come back signed, so the app does not fill them
in — there is no evaluation form in here, on purpose. It tracks the one fact that
matters: whether the signed copy is in hand. That is the tick box on the roster.
The Weekly tab shows the count for weeks 3 and 6 and links back to the roster; the
worklist names whoever is still outstanding.

**Mileage form** → `mileage.html`. Date / Start Mileage / From / To / End Mileage /
Total Mileage, with the employee and supervisor signature footer. From and To are
dropdowns built from your saved locations plus every worksite address on file, with an
"Other address" escape hatch. A new trip pre-fills From and Start Mileage from where
your last one ended, and Total is computed from the odometer readings.

The demo opens with a summer's worth of trips — one driving day a week, out from home,
site to site, and back to the office with the timesheets. 8/3 is the sheet photographed
in the context folder, so that day reads exactly like the paper. The odometer runs
continuously from `ODOMETER_START` in `assets/data.js` (41940), so every row's Start
Mileage is the row above it's End Mileage and the Total column adds up to the distance
between the first and last reading — change that one number to move the whole summer.

**Timesheets** → the Weekly tab has a **Check off timesheets** list: one tick box per
active participant, so the count is always what you physically have in hand rather
than a number you typed. Ticking the first one stamps the pickup date automatically;
status moves pending → partial → all in on its own. The app tracks the pickup, not
the timesheet itself.

**Notes & reminders** → a scratchpad under the site cards on the dashboard, for
anything that has no box on a DYCD form: a roster discrepancy, something to raise
at the office, something to verify next visit. Notes can be pinned or ticked done.

**Form W-9** → `w9.html`, from the **Form W-9** section under the notes on the
dashboard. The payee answers plain questions — name and classification, then address
and TIN — and the third step lays the answers out on page 1 of the IRS form (Rev.
March 2024) to check before signing. The signed copy prints on its own sheet, with the
submission record on a second.

It is built to the IRS rules for taking W-9s electronically (Announcement 98-27,
repeated in the *Instructions for the Requester of Form W-9*):

| The rule | Where it lives |
|---|---|
| Same information as the paper form | Every line, box and exemption code, in the IRS's wording — the `W9_*` strings in `assets/data.js`. Help text in plain English stays in `w9.html`, never in those strings |
| Perjury statement in the paper form's language, immediately before the signature | Part II word for word, then *"By signing below you make the declaration above…"*, then the signature pad. Nothing sits in between |
| Signature is the final entry | Signing is what submits. Changing any answer above an existing signature wipes it, and a signed W-9 can't be edited — a change is a new W-9 |
| Reasonably certain the signer is the person on the form | The signer is either the signed-in account holder or someone signing in person whose photo ID the monitor has checked; the choice is recorded. For an individual, the line 1 name has to match the account holder's surname when they sign as themselves |
| Information received is the information sent; every access documented | A SHA-256 fingerprint of every answer and the signature is taken at signing and re-checked each time the form opens. The access log records start, each reopen, draft saves, signing, views, TIN reveals and prints, with who and which device |
| Hard copy on request, with the requester's statement that the named payee submitted it | **Print / Save PDF**. The form prints with the full TIN, which the screen masks unless **Show full TIN** is pressed |

Item 2 of the certification can be crossed out, as the paper form allows. A signed W-9
with item 2 crossed out, or with a TIN of *Applied For*, gets its own badge on the
dashboard.

**Don't enter real SSNs or EINs into the demo.** W-9s sit in `localStorage` with
everything else, unencrypted. They aren't seeded, so a browser that already has demo data
gets an empty W-9 list rather than a re-seed, and **Reset demo data** wipes them.

**Form I-9** → `i9.html`, from the **Form I-9** section under the W-9s. Edition 01/20/25,
signed twice, by two people, days apart:

- **Section 1** (steps 1–3) is the employee's: name, address, date of birth, SSN
  (voluntary unless the employer uses E-Verify) and citizenship or immigration status.
  Step 3 lays it out on the USCIS form, records who helped (Supplement A) and where it's
  being signed, and takes the signature. Signing locks it.
- **Section 2** (steps 4–5) opens once Section 1 is signed: the first day of employment,
  the documents the employee chose — List A, or List B plus List C, each with a picker
  that fills in the M-274's abbreviations — and the employer's certification and signature.

A completed I-9 prints as page 1, Supplement A if one was used, and the electronic record.
The electronic-I-9 rules are in 8 CFR 274a.2(e)–(i):

| The rule | Where it lives |
|---|---|
| Every attestation in the form's own words | The `I9_*` strings in `assets/data.js`, copied off the 01/20/25 edition, Lists of Acceptable Documents included |
| Instructions and document lists available while the form is filled in | **Instructions** (the USCIS PDF) and **Document lists** in the header of every step |
| A way to acknowledge the attestation was read before it is signed — (h)(1) | An *I have read the attestation above* box in front of the employee's, the preparer's and the employer's signature. Signing is refused without it |
| Signature affixed at the time of the transaction, and a record of who signed — (h)(1)(i)–(ii) | Each signature is stamped when **Sign** is pressed, with the account, how the signer was identified, and the device |
| A printed confirmation for the employee, on request — (h)(1)(iii) | **Print employee confirmation**: Section 1 with the SSN masked, Supplement A, and the signature record |
| Controls that detect alteration — (e)(1)(ii) | A SHA-256 fingerprint of Section 1 when the employee signs and of the whole form when the employer does. Both are re-checked every time the I-9 opens |
| An audit trail of every creation, change, correction and access — (g)(1)(iv) | Start, reopens, draft saves, both signatures, Section 1 reopened for correction (with the reason given), views, SSN reveals, prints and exports |
| Searchable records, legible hard copies, a summary file on request — (e)(1)(iv)–(v), (e)(8) | The dashboard's search box, **Print / Save PDF**, and **Export CSV** — every field of every I-9 in one spreadsheet |

Beyond the electronic rules:

- **The employee chooses the documents.** The anti-discrimination notice heads the
  documents step. The page offers every acceptable choice and asks which one was presented.
- **Minors.** For a youth under 18 with no List B identity document, the M-274 §4.2
  procedure is offered: a parent or legal guardian completes Section 1, *Individual under
  age 18* goes in the employee signature block and under List B, and the parent or guardian
  signs Supplement A. It only appears when the date of birth says under 18.
- **Deadlines.** Section 2 is due three business days after the first day. Weekends are
  skipped but holidays aren't, so a holiday week comes out a day early. The dashboard shows
  *Section 2 due* or *Section 2 overdue*, and a Section 1 signed after the first day is noted.
- **Expired documents are refused**, since the lists require unexpired documents.
- **Reverification.** For "an alien authorized to work", the record shows the earliest of
  the Section 1 date and the List A or List C expiration dates, and the dashboard badges it.
  Supplement B itself isn't built.
- **Retention.** The record shows the earliest date the I-9 can be destroyed: three years
  after the first day, or one year after employment ends if that's later.
- **Corrections.** Before Section 2 is signed, **Reopen Section 1 for correction** removes
  the employee's signature, logs the reason, and has them sign again. After Section 2 is
  signed nothing can be edited.
- **E-Verify.** `I9_EVERIFY` in `assets/data.js` is off. Turning it on makes the SSN
  required, notes the photo requirement for List B, and withdraws the parent-or-guardian
  procedure for minors — all three are E-Verify rules.

Not built yet: Supplement B, more than one preparer per I-9, dated notations after
completion, and storing photocopies of documents. The same rule as W-9s applies: **don't
enter real SSNs, A-Numbers or document numbers into the demo.**

## The demo's starting state

The calendar is SYEP Summer 2026 (six weeks, Jul 6 – Aug 14, Cohort A) and the current
week is read off the real clock, so the demo opens mid-program: weeks 1–4 are filed and
everything from week 5 on is outstanding.

All seven worksites are transcribed from the real Worksite Applications and YEPS
roster exports:

| Site | Type | Roster |
|---|---|---|
| Maspeth Town Hall, Inc. @ PS 229 | Nonprofit, childcare, Summer Rising | 9 |
| 229 Custodial | Public, NYCPS Custodial/Facilities | 1 |
| Walgreens At 80th Street | Private/For-Profit, retail | 6 |
| Maspeth Town Hall, Inc. @ IS 73 | Nonprofit, childcare, Summer Rising | 9 |
| GRYC @ PS 106 | Nonprofit, childcare, Summer Rising | 52 |
| Mimi & Coco Bakery and Bagel Shop | Private/For-Profit, retail | 2 |
| Glendale Bakery | Private/For-Profit, retail | 2 |

### Handwritten roster marks

The printed rosters carry pen marks, and `MARK_MEANING` at the top of
`assets/data.js` decides what each one means:

```js
var MARK_MEANING = {
  H: 'referral',   // highlighted  -> Referral Sheet in hand
  K: 'week3'       // margin check -> Week 3 Evaluation done
};
```

Crossed-out names become `status: 'Transferred'` and drop out of the active counts;
margin notes ("sick", "stopped coming") land in the participant's `note` and show as
a dot beside their name. If a mark means something else, change that one object
rather than re-transcribing the rosters.

## Known gaps

**GRYC @ PS 106 is a childcare site; its application says it isn't.** The Worksite
Application answers *ChildCare: No*, but the industry is Summer Camp and all 60
assignments are Child Care counselor roles, so the site record sets `childcare: true`.
It has no Attachment 1 on file, so the questionnaire asks which licence or permit the
supervisor holds instead of pre-filling it. The two Maspeth sites filed Attachment 1
and had their questionnaires collected at intake; PS 106's are still owed, which is why
it opens with 51 of them outstanding.

**Glendale Bakery's address.** The application says 65-50 Grand Ave; the real address
is 69-25 Grand Ave. The site record uses the real one and carries an `addressNote`
that renders as a callout on the Overview tab.

**Assessment page 4.** The photographed sheets are numbered 1, 2, 5 and 6, plus one
whose number is too faded to read — which sits between page 2 and the summary, so it
is page 3 (safe environment / Program Activities / Childcare). That leaves **page 4**
unaccounted for. The app prints 1, 2, 3, 5, 6 and simply has no page 4.

## Swapping in the real logo

Drop the real logo in as `assets/logo.png` — every page already prefers it and falls
back to the placeholder `assets/logo.svg` if it isn't there.

## If this becomes real

The only file that touches storage is `assets/data.js`. Replacing those functions with
API calls is the whole backend integration. Things a real build would need: per-monitor
accounts managed by the GRYC office, a YEPS import instead of copy/paste, supervisor
logins so they can sign without the monitor's device, PDF export in DYCD's exact
layout, photo attachments on findings, and offline support for sites with bad reception.

W-9s need more than that before a real TIN goes in: TINs encrypted at rest and visible
only to the office staff who file the 1099s; the access log and fingerprint written by the
server, not the browser; and payees signing from their own login or a one-time emailed
link instead of the monitor's device.

I-9s need all of that, plus what 8 CFR 274a.2(e)–(g) asks of any electronic I-9 system:
access limited to authorized staff, backup and recovery, training for whoever handles
them, a written description of the system and how records are created, changed and
checked (this README is a start), and destruction once the retention date passes.
