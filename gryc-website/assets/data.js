/* ==========================================================================
   GRYC SYEP Site Monitor Portal — data layer

   The shapes in this file mirror the actual paperwork:
     · site         -> DYCD "Worksite Application"
     · participant  -> YEPS "Worksite Assignments" roster export
     · assessment   -> DYCD "SYEP/WLG Worksite Assessment Report" (6 pages)
     · log entry    -> "Monitoring Log" (Worksite Pre-Assessment Report, p.4)
     · mileage      -> "MILEAGE FORM SYEP 2026"

   Demo build: everything persists to localStorage. Swap this file for real
   API calls when the backend exists; the rest of the app only talks to GRYC.*
   ========================================================================== */

window.GRYC = (function () {
  'use strict';

  var KEY = 'gryc_syep_db';
  var SESSION = 'gryc_syep_session';

  /* Bump this whenever the seed data or the shape of a record changes.
     A browser holding an older copy re-seeds itself on next load instead of
     quietly showing stale sites. Raising it WIPES whatever is in the browser,
     so leave it alone for changes that are only markup, styling or behaviour —
     those ride on the ?v= cache stamp below instead. */
  var SEED_VERSION = 7;

  /* Read straight off this file's own <script src="assets/data.js?v=N">, so it
     reports the build the browser actually fetched rather than the one on disk.
     That is the difference between diagnosing a cache and guessing at one. */
  var BUILD = (function () {
    var s = typeof document !== 'undefined' && document.currentScript;
    var m = s && /[?&]v=(\d+)/.exec(s.src || '');
    return m ? m[1] : 'dev';
  })();

  /* Storage keys used by earlier builds, cleared on upgrade. */
  var LEGACY_KEYS = ['gryc_syep_db_v1', 'gryc_syep_db_v2'];

  /* ---- program identity ---------------------------------------------- */

  var PROGRAM = {
    initiative: 'SYEP',
    cycle: 'SYEP 2026',
    provider: 'Greater Ridgewood Youth Council, Inc.',
    organization: 'Greater Ridgewood Youth Council, Inc. - SYEP',
    timesheetProvider: 'The Greater Ridgewood Youth Council Inc.-QNS-OY',
    cohort: 'Cohort A (7/6/2026)',
    serviceOption: 'Older Youth',
    startDate: '2026-07-06',
    endDate: '2026-08-14',
    maxWeeklyHours: 25
  };

  /* ---- program calendar (Summer 2026) --------------------------------
     `start`/`end` are the Mon–Fri work week. `ending` is the Saturday the
     timesheet is dated to ("Week Ending 8/01/2026").                     */

  var WEEKS = [
    { n: 1, start: '2026-07-06', end: '2026-07-10', ending: '2026-07-11' },
    { n: 2, start: '2026-07-13', end: '2026-07-17', ending: '2026-07-18' },
    { n: 3, start: '2026-07-20', end: '2026-07-24', ending: '2026-07-25' },
    { n: 4, start: '2026-07-27', end: '2026-07-31', ending: '2026-08-01' },
    { n: 5, start: '2026-08-03', end: '2026-08-07', ending: '2026-08-08' },
    { n: 6, start: '2026-08-10', end: '2026-08-14', ending: '2026-08-15' }
  ];

  /* ---- worksite application vocabulary -------------------------------- */

  var WORKSITE_TYPES  = ['Nonprofit', 'Private/For-Profit', 'Public'];
  var SECTORS         = ['Non-Profit', 'Private/For-Profit', 'Public'];
  var IMPLEMENTATION  = ['In-Person', 'Remote', 'A Hybrid Model (Both)'];
  var BOROUGHS        = ['Queens', 'Brooklyn', 'Manhattan', 'Bronx', 'Staten Island'];
  var LICENSE_TYPES   = ['SACC License Number', 'DOH License Number', 'Camp Permit', 'BEDS Code'];
  var DAYS            = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAY_LABELS      = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ==========================================================================
     WORKSITE ASSESSMENT REPORT — the packet, page by page
     ========================================================================== */

  /* --- p.1 Facility: "check all items as it may apply" ----------------- */

  var FACILITY_ITEMS = [
    { id: 'lighting',  text: 'Adequate lighting' },
    { id: 'vent',      text: 'Adequate ventilation' },
    { id: 'clean',     text: 'Adequately clean facility' },
    { id: 'bathroom',  text: 'Adequate bathroom facilities' },
    { id: 'exits',     text: 'Accessible emergency exits' },
    { id: 'fire',      text: 'Fire extinguishers/sprinkler system' }
  ];

  /* --- p.2 Recordkeeping: "check if forms are available" --------------- */

  var RECORDKEEPING_ITEMS = [
    { id: 'enroll',    text: 'Participant Enrollment Documentation', em: 'Individually' },
    { id: 'timesheet', text: 'Copy of Weekly Timesheets:', em: 'For Hard Copy ONLY' },
    { id: 'dol',       text: 'DOL Permitted Working Hours for Minors Under 18 Years' },
    { id: 'drugfree',  text: 'NYS Drug Free Workplace Requirements' },
    { id: 'monlog',    text: 'Monitoring Log' },
    { id: 'referral',  text: 'Participant Worksite Referral' },
    { id: 'ccletter',  text: 'Participant Referral Letter for Childcare Sites' },
    { id: 'evalform',  text: 'Participant Evaluation Form' },
    { id: 'roster',    text: 'Site Assignment Roster' }
  ];

  /* --- p.2 Operations (Yes / No / N/A) --------------------------------- */

  var OPERATIONS_Q = [
    { id: 'op1', n: 1, text: 'Were you able to easily identify and locate participant supervisors?' },
    { id: 'op2', n: 2, text: 'Is there adequate supervision of participants?' },
    { id: 'op3', n: 3, text: 'Are the work activities in compliance with Child Labor Laws?' },
    { id: 'op4', n: 4, text: 'Does the worksite have adequate knowledge of time and attendance procedures?' }
  ];

  /* --- p.4 Program Activities (Yes / No) ------------------------------- */

  var PROGRAM_ACTIVITY_Q = [
    { id: 'pa1', n: 1, text: 'In your observation, is the supervisor/participant ratio sufficient for this site?' },
    { id: 'pa2', n: 2, text: 'Were participants fully engaged in work activities?' },
    { id: 'pa3', n: 3, text: 'Are the work activities age-appropriate for youth assigned?' },
    { id: 'pa4', n: 4, text: 'During your observation, was the work activity consistent with the Worksite Application?' },
    { id: 'pa5', n: 5, text: 'Have participants been offered to work the maximum hours allowed according to the site schedule?' }
  ];

  /* --- p.4 Childcare site questions ------------------------------------ */

  var CHILDCARE_RATIOS = [
    { age: 'Up to age 5', normal: '1:6' },
    { age: 'Ages 6-7',    normal: '1:9' },
    { age: '8 and older', normal: '1:12' }
  ];
  var CHILDCARE_TRIP_RATIO = '1:5 (All Ages)';
  var CHILDCARE_NOTE = 'SYEP/WLG participants are not allowed to be left alone with the children at any time.';
  var CHILDCARE_DOCS = [
    { id: 'license', text: 'License', em: '(SACC, DOH Center, Homebase)' },
    { id: 'camp',    text: 'Camp Permit' }
  ];

  /* The same "check the age range of the youth" box, asked about one youth at
     a time on the per-participant questionnaire. `min`/`max` let the form
     pre-pick the band off the roster age instead of making you read it. */
  var CHILDCARE_AGE_RANGES = [
    { id: 'younger', text: 'Younger Youth', em: '14-15 years old', max: 15 },
    { id: 'older',   text: 'Older Youth',   em: '16+ years old',   min: 16 }
  ];

  /* --- p.6 Participant Interviews --------------------------------------
     Q1 (DOB + last name) and Q2 (type of work) are free text; Q3-Q12 are
     two-option picks. Q6 and Q7 use their own option pairs.               */

  var INTERVIEW_Q = [
    { id: 'q3',  n: 3,  text: 'Do you find your job interesting?',                                    opts: ['Yes', 'No'] },
    { id: 'q4',  n: 4,  text: 'Do you have enough tools or supplies to do your job?',                  opts: ['Yes', 'No'] },
    { id: 'q5',  n: 5,  text: 'Do you know who your supervisor is?',                                   opts: ['Yes', 'No'] },
    { id: 'q6',  n: 6,  text: 'How do you complete your sign-in sheet?',                               opts: ['Paper', 'Online'] },
    { id: 'q7',  n: 7,  text: 'Do you sign in when you arrive and sign out when you leave?', pre: 'For Paper ONLY:', opts: ['Yes', 'No'] },
    { id: 'q8',  n: 8,  text: 'Do you receive a lunch break?',                                         opts: ['Yes', 'No'] },
    { id: 'q9',  n: 9,  text: 'Did you receive your debit card?',                                      opts: ['Yes', 'No'] },
    { id: 'q10', n: 10, text: 'Have you been able to access your money?',                              opts: ['Yes', 'No'] },
    { id: 'q11', n: 11, text: 'Do you feel safe while working at this site?  Are there any concerns?', opts: ['Yes', 'No'] },
    { id: 'q12', n: 12, text: 'Do you have any questions, issues, or concerns?',                       opts: ['Yes', 'No'] }
  ];
  /* Answers that mean "look into this" rather than "all good". */
  var INTERVIEW_FLAGS = {
    q3: 'No', q4: 'No', q5: 'No', q7: 'No', q8: 'No', q9: 'No', q10: 'No', q11: 'No', q12: 'Yes'
  };

  var INTERVIEW_MODES = ['In-Person', 'Phone Interview'];
  var INTERNSHIP_MODES = ['In-Person', 'Virtually', 'A Hybrid Model (Both)'];
  var INTERVIEWS_REQUIRED = 2;

  /* --- absence reasons, worded as the form suggests --------------------- */

  var ABSENCE_REASONS = [
    'Never reported to work',
    'Terminated',
    'Transferred',
    'Not scheduled to be working',
    'Performing work activities off-site',
    'Attending educational activities',
    'Called out sick',
    'Excused — approved by GRYC',
    'Unexcused — no call',
    'Other'
  ];

  /* ==========================================================================
     MONITORING LOG
     ========================================================================== */

  var VISIT_REASONS = [
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'timesheet',  label: 'Time-Sheet Pick-Up' },
    { id: 'other',      label: 'Other' }
  ];

  /* Times in 15-minute increments, the way the paper log is filled in. */
  function buildTimeSlots(fromHour, toHour) {
    var out = [];
    for (var h = fromHour; h <= toHour; h++) {
      for (var m = 0; m < 60; m += 15) {
        if (h === toHour && m > 0) break;
        out.push(pad(h) + ':' + pad(m));
      }
    }
    return out;
  }
  var TIME_SLOTS = buildTimeSlots(6, 21);

  /* Snap any "HH:MM" to the nearest quarter hour so the selects always match. */
  function snap15(t) {
    if (!t) return '';
    var p = String(t).split(':');
    var h = +p[0], m = +p[1] || 0;
    m = Math.round(m / 15) * 15;
    if (m === 60) { m = 0; h += 1; }
    if (h > 23) h = 23;
    return pad(h) + ':' + pad(m);
  }

  /* The week 3 and week 6 Participant Evaluations are not filled in here. The
     paper forms go out to the supervisor ahead of the week and come back
     signed, so the app tracks one thing about them: whether the signed copy is
     in hand. That is the tick box on the roster, and nothing else. */

  /* ==========================================================================
     FORM W-9 — Request for Taxpayer Identification Number and Certification

     Everything the payee reads and certifies to is copied word for word off
     the Rev. March 2024 form. Announcement 98-27 lets a requester take W-9s
     electronically only if the submission carries exactly the same
     information as the paper form and the perjury statement uses the paper
     form's language, so plain-English help belongs in the hints on w9.html,
     never in these strings.
     ========================================================================== */

  var W9_REV = 'Rev. March 2024';

  /* GRYC's own name and address: the requester on a W-9, the employer on an
     I-9. Copied onto each form when it is started, so a signed form keeps
     the address it was given. */
  var ORG = {
    name: PROGRAM.provider,
    address: '59-03 Summerfield St',
    city: 'Ridgewood, NY 11385'
  };
  var W9_REQUESTER = ORG;

  /* Line 3a, in the order the boxes are printed. */
  var W9_CLASSES = [
    { id: 'individual',  label: 'Individual/sole proprietor' },
    { id: 'ccorp',       label: 'C corporation' },
    { id: 'scorp',       label: 'S corporation' },
    { id: 'partnership', label: 'Partnership' },
    { id: 'trust',       label: 'Trust/estate' },
    { id: 'llc',         label: 'LLC' },
    { id: 'other',       label: 'Other (see instructions)' }
  ];
  var W9_LLC_CODES = [
    { id: 'C', label: 'C corporation' },
    { id: 'S', label: 'S corporation' },
    { id: 'P', label: 'Partnership' }
  ];

  /* Line 4, as listed under "Exempt payee code" and "Exemption from FATCA
     reporting code" in the Specific Instructions. */
  var W9_EXEMPT_PAYEE_CODES = [
    ['1',  'An organization exempt from tax under section 501(a), any IRA, or a custodial account under section 403(b)(7) if the account satisfies the requirements of section 401(f)(2).'],
    ['2',  'The United States or any of its agencies or instrumentalities.'],
    ['3',  'A state, the District of Columbia, a U.S. commonwealth or territory, or any of their political subdivisions or instrumentalities.'],
    ['4',  'A foreign government or any of its political subdivisions, agencies, or instrumentalities.'],
    ['5',  'A corporation.'],
    ['6',  'A dealer in securities or commodities required to register in the United States, the District of Columbia, or a U.S. commonwealth or territory.'],
    ['7',  'A futures commission merchant registered with the Commodity Futures Trading Commission.'],
    ['8',  'A real estate investment trust.'],
    ['9',  'An entity registered at all times during the tax year under the Investment Company Act of 1940.'],
    ['10', 'A common trust fund operated by a bank under section 584(a).'],
    ['11', 'A financial institution as defined under section 581.'],
    ['12', 'A middleman known in the investment community as a nominee or custodian.'],
    ['13', 'A trust exempt from tax under section 664 or described in section 4947.']
  ];
  var W9_FATCA_CODES = [
    ['A', 'An organization exempt from tax under section 501(a) or any individual retirement plan as defined in section 7701(a)(37).'],
    ['B', 'The United States or any of its agencies or instrumentalities.'],
    ['C', 'A state, the District of Columbia, a U.S. commonwealth or territory, or any of their political subdivisions or instrumentalities.'],
    ['D', 'A corporation the stock of which is regularly traded on one or more established securities markets, as described in Regulations section 1.1472-1(c)(1)(i).'],
    ['E', 'A corporation that is a member of the same expanded affiliated group as a corporation described in Regulations section 1.1472-1(c)(1)(i).'],
    ['F', 'A dealer in securities, commodities, or derivative financial instruments (including notional principal contracts, futures, forwards, and options) that is registered as such under the laws of the United States or any state.'],
    ['G', 'A real estate investment trust.'],
    ['H', 'A regulated investment company as defined in section 851 or an entity registered at all times during the tax year under the Investment Company Act of 1940.'],
    ['I', 'A common trust fund as defined in section 584(a).'],
    ['J', 'A bank as defined in section 581.'],
    ['K', 'A broker.'],
    ['L', 'A trust exempt from tax under section 664 or described in section 4947(a)(1).'],
    ['M', 'A tax-exempt trust under a section 403(b) plan or section 457(g) plan.']
  ];

  /* Part II. Numbered when it is rendered, so item 2 can be crossed out on
     its own the way the certification instructions say to. */
  var W9_CERT_INTRO = 'Under penalties of perjury, I certify that:';
  var W9_CERT = [
    'The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and',
    'I am not subject to backup withholding because (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and',
    'I am a U.S. citizen or other U.S. person (defined below); and',
    'The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.'
  ];
  var W9_CERT_INSTRUCTIONS =
    'You must cross out item 2 above if you have been notified by the IRS that you are currently subject to ' +
    'backup withholding because you have failed to report all interest and dividends on your tax return. For ' +
    'real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of ' +
    'secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and, ' +
    'generally, payments other than interest and dividends, you are not required to sign the certification, ' +
    'but you must provide your correct TIN. See the instructions for Part II, later.';

  /* What "(defined below)" in certification item 3 points to. */
  var W9_US_PERSON = [
    'An individual who is a U.S. citizen or U.S. resident alien;',
    'A partnership, corporation, company, or association created or organized in the United States or under the laws of the United States;',
    'An estate (other than a foreign estate); or',
    'A domestic trust (as defined in Regulations section 301.7701-7).'
  ];

  var US_STATES = ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE ' +
    'NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI AA AE AP').split(' ');

  /* ==========================================================================
     FORM I-9 — Employment Eligibility Verification (Edition 01/20/25)

     Same rule as the W-9: everything anyone attests to is copied word for
     word off the form, and plain-English help lives in i9.html. The rules
     for doing it electronically are 8 CFR 274a.2(e)–(i): an audit trail of
     every access, controls that catch alteration, an acknowledgment that
     each attestation was read before it is signed, a record of who signed,
     a printed confirmation for the employee on request, searchable records,
     and legible hard copies.
     ========================================================================== */

  var I9_EDITION = '01/20/25';
  var I9_OMB = 'OMB No. 1615-0047';
  var I9_EXPIRES = '05/31/2027';
  var I9_EMPLOYER = ORG;

  /* Does GRYC use E-Verify? If so the instructions make the SSN mandatory,
     only List B documents with a photograph count, and the M-274 bars a
     parent from standing in for a minor's List B document. One switch
     turns on all three. */
  var I9_EVERIFY = false;

  var I9_START_HERE =
    'Employers must ensure the form instructions are available to employees when completing this form. ' +
    'Employers are liable for failing to comply with the requirements for completing this form. See below ' +
    'and the Instructions.';
  var I9_ANTI_DISCRIMINATION =
    'All employees can choose which acceptable documentation to present for Form I-9. Employers cannot ask ' +
    'employees for documentation to verify information in Section 1, or specify which acceptable documentation ' +
    'employees must present for Section 2 or Supplement B, Reverification and Rehire. Treating employees ' +
    'differently based on their citizenship, immigration status, or national origin may be illegal.';
  var I9_S1_HEAD =
    'Employees must complete and sign Section 1 of Form I-9 no later than the first day of employment, but ' +
    'not before accepting a job offer.';
  var I9_S1_ATTEST =
    'I am aware that federal law provides for imprisonment and/or fines for false statements, or the use of ' +
    'false documents, in connection with the completion of this form. I attest, under penalty of perjury, ' +
    'that this information, including my selection of the box attesting to my citizenship or immigration ' +
    'status, is true and correct.';
  var I9_STATUS_PROMPT =
    'Check one of the following boxes to attest to your citizenship or immigration status (See page 2 and 3 ' +
    'of the instructions.):';
  var I9_STATUSES = [
    { id: 'citizen',  text: 'A citizen of the United States' },
    { id: 'national', text: 'A noncitizen national of the United States (See Instructions.)' },
    { id: 'lpr',      text: 'A lawful permanent resident (Enter USCIS or A-Number.)' },
    { id: 'alien',    text: 'An alien authorized to work until' }
  ];
  var I9_PREPARER_NOTE =
    'If a preparer and/or translator assisted you in completing Section 1, that person MUST complete the ' +
    'Preparer and/or Translator Certification on Page 3.';
  var I9_S2_HEAD =
    'Employers or their authorized representative must complete and sign Section 2 within three business ' +
    'days after the employee\'s first day of employment, and must physically examine, or examine consistent ' +
    'with an alternative procedure authorized by the Secretary of DHS, documentation from List A OR a ' +
    'combination of documentation from List B and List C. Enter any additional documentation in the ' +
    'Additional Information box; see Instructions.';
  var I9_ALT_PROCEDURE = 'Check here if you used an alternative procedure authorized by DHS to examine documents.';
  var I9_S2_CERT =
    'I attest, under penalty of perjury, that (1) I have examined the documentation presented by the ' +
    'above-named employee, (2) the above-listed documentation appears to be genuine and to relate to the ' +
    'employee named, and (3) to the best of my knowledge, the employee is authorized to work in the United States.';
  var I9_SUPP_A_INSTRUCTIONS =
    'This supplement must be completed by any preparer and/or translator who assists an employee in ' +
    'completing Section 1 of Form I-9. The preparer and/or translator must enter the employee\'s name in the ' +
    'spaces provided above. Each preparer or translator must complete, sign, and date a separate ' +
    'certification area. Employers must retain completed supplement sheets with the employee\'s completed Form I-9.';
  var I9_PREPARER_ATTEST =
    'I attest, under penalty of perjury, that I have assisted in the completion of Section 1 of this form ' +
    'and that to the best of my knowledge the information is true and correct.';

  /* M-274 §4.2: a minor with no List B document can have a parent or legal
     guardian complete Section 1, writing this in the employee signature
     block and signing Supplement A; the employer writes it under List B. */
  var I9_MINOR = 'Individual under age 18';

  /* Page 2, the Lists of Acceptable Documents, word for word. The employee
     has to be able to read it while completing the form. */
  var I9_LISTS = {
    intro: [
      'All documents containing an expiration date must be unexpired.',
      '* Documents extended by the issuing authority are considered unexpired.',
      'Employees may present one selection from List A or a combination of one selection from List B and one selection from List C.',
      'Examples of many of these documents appear in the Handbook for Employers (M-274).'
    ],
    A: {
      title: 'LIST A', sub: 'Documents that Establish Both Identity and Employment Authorization',
      items: [
        'U.S. Passport or U.S. Passport Card',
        'Permanent Resident Card or Alien Registration Receipt Card (Form I-551)',
        'Foreign passport that contains a temporary I-551 stamp or temporary I-551 printed notation on a machine-readable immigrant visa',
        'Employment Authorization Document that contains a photograph (Form I-766)',
        'For an individual temporarily authorized to work for a specific employer because of his or her status or parole: a. Foreign passport; and b. Form I-94 or Form I-94A that has the following: (1) The same name as the passport; and (2) An endorsement of the individual\'s status or parole as long as that period of endorsement has not yet expired and the proposed employment is not in conflict with any restrictions or limitations identified on the form.',
        'Passport from the Federated States of Micronesia (FSM) or the Republic of the Marshall Islands (RMI) with Form I-94 or Form I-94A indicating nonimmigrant admission under the Compact of Free Association Between the United States and the FSM or RMI'
      ]
    },
    B: {
      title: 'LIST B', sub: 'Documents that Establish Identity',
      items: [
        'Driver\'s license or ID card issued by a State or outlying possession of the United States provided it contains a photograph or information such as name, date of birth, sex, height, eye color, and address',
        'ID card issued by federal, state or local government agencies or entities, provided it contains a photograph or information such as name, date of birth, sex, height, eye color, and address',
        'School ID card with a photograph',
        'Voter\'s registration card',
        'U.S. Military card or draft record',
        'Military dependent\'s ID card',
        'U.S. Coast Guard Merchant Mariner Card',
        'Native American tribal document',
        'Driver\'s license issued by a Canadian government authority'
      ],
      minorsHead: 'For persons under age 18 who are unable to present a document listed above:',
      minors: ['School record or report card', 'Clinic, doctor, or hospital record', 'Day-care or nursery school record']
    },
    C: {
      title: 'LIST C', sub: 'Documents that Establish Employment Authorization',
      items: [
        'A Social Security Account Number card, unless the card includes one of the following restrictions: (1) NOT VALID FOR EMPLOYMENT (2) VALID FOR WORK ONLY WITH INS AUTHORIZATION (3) VALID FOR WORK ONLY WITH DHS AUTHORIZATION',
        'Certification of report of birth issued by the Department of State (Forms DS-1350, FS-545, FS-240)',
        'Original or certified copy of birth certificate issued by a State, county, municipal authority, or territory of the United States bearing an official seal',
        'Native American tribal document',
        'U.S. Citizen ID Card (Form I-197)',
        'Identification Card for Use of Resident Citizen in the United States (Form I-179)',
        'Employment authorization document issued by the Department of Homeland Security'
      ],
      note: 'The Form I-766, Employment Authorization Document, is a List A, Item Number 4. document, not a List C document.'
    },
    receipts: {
      head: 'Acceptable Receipts',
      sub: 'May be presented in lieu of a document listed above for a temporary period. For receipt validity dates, see the M-274.',
      A: [
        'Receipt for a replacement of a lost, stolen, or damaged List A document.',
        'Form I-94 issued to a lawful permanent resident that contains an I-551 stamp and a photograph of the individual.',
        'Form I-94 with “RE” notation or refugee stamp issued to a refugee.'
      ],
      B: ['Receipt for a replacement of a lost, stolen, or damaged List B document.'],
      C: ['Receipt for a replacement of a lost, stolen, or damaged List C document.']
    }
  };

  /* What each choice puts in Section 2's Document Title and Issuing Authority
     boxes, using the M-274's own abbreviations (Appendix A). A List A choice
     that is really two documents fills two rows. {st} becomes the employee's
     state, as in "NY DL". `minor` choices are only offered under 18. */
  var I9_PICK = {
    A: [
      { label: 'U.S. Passport',                                  docs: [['U.S. Passport', 'U.S. Department of State']] },
      { label: 'U.S. Passport Card',                             docs: [['U.S. Passport Card', 'U.S. Department of State']] },
      { label: 'Permanent Resident Card (Form I-551)',           docs: [['Form I-551', 'USCIS']] },
      { label: 'Alien Registration Receipt Card (Form I-551)',   docs: [['Form I-551', 'USCIS']] },
      { label: 'Foreign passport with a temporary I-551 stamp',  docs: [['Foreign Passport', ''], ['I-551 Stamp', '']] },
      { label: 'Foreign passport with a temporary I-551 notation on a machine-readable immigrant visa',
                                                                 docs: [['Foreign Passport', ''], ['MRIV', '']] },
      { label: 'Employment Authorization Document (Form I-766)', docs: [['Form I-766', 'USCIS']] },
      { label: 'Foreign passport with Form I-94 or I-94A (work for a specific employer)',
                                                                 docs: [['Foreign Passport', ''], ['Form I-94', 'CBP']] },
      { label: 'FSM passport with Form I-94 or I-94A',           docs: [['FSM Passport', ''], ['Form I-94', 'CBP']] },
      { label: 'RMI passport with Form I-94 or I-94A',           docs: [['RMI Passport', ''], ['Form I-94', 'CBP']] },
      { label: 'Receipt — replacement of a lost, stolen, or damaged List A document', docs: [['Receipt: replacement ', '']] },
      { label: 'Receipt — Form I-94 with I-551 stamp and photograph', docs: [['Receipt: Form I-94 w/I-551 stamp, photo', 'CBP']] },
      { label: 'Receipt — Form I-94 with refugee stamp',          docs: [['Receipt: Form I-94 w/refugee stamp', 'CBP']] }
    ],
    B: [
      { label: 'Driver’s license issued by a state',             docs: [['{st} DL', '{st} DMV']] },
      { label: 'ID card issued by a state',                      docs: [['{st} ID', '{st} DMV']] },
      { label: 'ID card from a federal, state, or local government agency', docs: [['Government ID', '']] },
      { label: 'School ID card with a photograph',               docs: [['School ID', '']] },
      { label: 'Voter’s registration card',                      docs: [['Voter\'s registration card', '']] },
      { label: 'U.S. Military card or draft record',             docs: [['U.S. Military card', '']] },
      { label: 'Military dependent’s ID card',                   docs: [['Military dependent\'s ID card', '']] },
      { label: 'U.S. Coast Guard Merchant Mariner Card',         docs: [['USCG Merchant Mariner card', 'USCG']] },
      { label: 'Native American tribal document',                docs: [['Native American tribal document', '']] },
      { label: 'Driver’s license issued by a Canadian government authority', docs: [['Canadian DL', '']] },
      { label: 'Under 18 — school record',       minor: true,    docs: [['School record (under age 18)', '']] },
      { label: 'Under 18 — report card',         minor: true,    docs: [['Report card (under age 18)', '']] },
      { label: 'Under 18 — clinic record',       minor: true,    docs: [['Clinic record (under age 18)', '']] },
      { label: 'Under 18 — doctor record',       minor: true,    docs: [['Doctor record (under age 18)', '']] },
      { label: 'Under 18 — hospital record',     minor: true,    docs: [['Hospital record (under age 18)', '']] },
      { label: 'Under 18 — day-care record',     minor: true,    docs: [['Day-care record (under age 18)', '']] },
      { label: 'Under 18 — nursery school record', minor: true,  docs: [['Nursery school record (under age 18)', '']] },
      { label: 'Receipt — replacement of a lost, stolen, or damaged List B document', docs: [['Receipt: replacement ', '']] }
    ],
    C: [
      { label: 'Social Security card without a restriction',     docs: [['SS Card', 'SSA']] },
      { label: 'Certification of Birth Abroad (Form FS-545)',    docs: [['Form FS-545', 'U.S. Department of State']] },
      { label: 'Certification of Report of Birth (Form DS-1350)', docs: [['Form DS-1350', 'U.S. Department of State']] },
      { label: 'Consular Report of Birth Abroad (Form FS-240)',  docs: [['Form FS-240', 'U.S. Department of State']] },
      { label: 'U.S. birth certificate — original or certified copy with an official seal', docs: [['Birth Certificate', '']] },
      { label: 'Native American tribal document',                docs: [['Native American tribal document', '']] },
      { label: 'U.S. Citizen ID Card (Form I-197)',              docs: [['Form I-197', '']] },
      { label: 'Identification Card for Use of Resident Citizen in the United States (Form I-179)', docs: [['Form I-179', '']] },
      { label: 'Employment authorization document issued by DHS (List C #7)', docs: [['Employment Auth. document (DHS) List C #7', 'DHS']] },
      { label: 'Receipt — replacement of a lost, stolen, or damaged List C document', docs: [['Receipt: replacement ', '']] }
    ]
  };

  /* ==========================================================================
     helpers
     ========================================================================== */

  function uid(p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDays(iso, n) {
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fmtDate(iso, opts) {
    if (!iso) return '—';
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtShort(iso) { return fmtDate(iso, { month: 'short', day: 'numeric' }); }

  /* 2026-08-06 -> 08/06/26, the way it is written on the forms. */
  function fmtSlash(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[1] + '/' + p[2] + '/' + p[0].slice(2);
  }

  function fmtTime(t) {
    if (!t) return '—';
    var p = String(t).split(':'), h = +p[0], m = p[1];
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + m + ' ' + ap;
  }

  function minutes(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }

  function currentWeek() {
    var t = todayISO(), last = WEEKS[0];
    for (var i = 0; i < WEEKS.length; i++) if (t >= WEEKS[i].start) last = WEEKS[i];
    return last.n;
  }

  function week(n) {
    for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].n === +n) return WEEKS[i];
    return null;
  }

  function weekOf(iso) {
    for (var i = 0; i < WEEKS.length; i++) {
      if (iso >= WEEKS[i].start && iso <= WEEKS[i].ending) return WEEKS[i].n;
    }
    return null;
  }

  function initials(name) {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (s) { return s[0]; }).join('').toUpperCase() || '?';
  }

  /* Participant name helpers — the roster is Last, First. */
  function pname(p)   { return p ? ((p.first || '') + ' ' + (p.last || '')).trim() || (p.last || '—') : '—'; }
  function proster(p) { return p ? (p.last || '—') + (p.first ? ', ' + p.first : '') : '—'; }

  function age(dob, onISO) {
    if (!dob) return null;
    var d = dob.split('-'), t = (onISO || todayISO()).split('-');
    var a = +t[0] - +d[0];
    if (+t[1] < +d[1] || (+t[1] === +d[1] && +t[2] < +d[2])) a--;
    return a;
  }

  /* ==========================================================================
     seed
     ========================================================================== */

  /* Roster rows, transcribed from the YEPS "Worksite Assignments" export:
       [appId, last, first, borough, phone, age, marks, status, note, dob]

     `marks` records what was written on the printed roster by hand:
       H = highlighted   K = check in the margin
       C = circled       X = crossed out / struck through
     How those map onto the tracked documents lives in MARK_MEANING below,
     so a wrong guess is one line to fix rather than a re-transcription.   */

  var MARK_MEANING = {
    H: 'referral',   // highlighted  -> Referral Sheet in hand
    K: 'week3'       // margin check -> Week 3 Evaluation done
  };

  function roster(rows, cohort) {
    return rows.map(function (r) {
      var marks = r[6] || '';
      var docs = { referral: false, week3: false, week6: false, childcare: false };
      Object.keys(MARK_MEANING).forEach(function (m) {
        if (marks.indexOf(m) > -1) docs[MARK_MEANING[m]] = true;
      });
      return {
        id: uid('p'),
        appId: r[0] || '',
        last: r[1] || '',
        first: r[2] || '',
        program: 'Lottery',
        borough: r[3] || 'Queens',
        phone: r[4] || '',
        age: r[5] || null,
        dob: r[9] || '',
        specialProject: 'None',
        accepted: 'No',
        cohort: cohort || PROGRAM.cohort,
        serviceOption: PROGRAM.serviceOption,
        status: r[7] || 'Active',
        marks: marks,
        note: r[8] || '',
        docs: docs,
        /* Filled-in copies of the participant forms the app actually fills in —
           right now just the childcare questionnaire, keyed the same way its
           tick box is. */
        forms: {}
      };
    });
  }

  function sup(o) {
    return {
      id: uid('sv'),
      name: o.name, title: o.title || '', email: o.email || '',
      phone: o.phone || '', fax: o.fax || '',
      signAttendance: o.sign !== false,
      siteRep: !!o.rep, keyMgmt: !!o.key, isSupervisor: o.sv !== false,
      area: o.area || '', room: o.room || '', trained: o.trained !== false
    };
  }

  function blankSite(o) {
    return {
      id: o.id, monitorId: o.monitorId || 'u1', emoji: o.emoji || '🏢',
      name: o.name,
      applicationName: o.applicationName || '',
      dycdId: o.dycdId || '',
      siteStatus: o.siteStatus || 'Approved-Active',
      worksiteType: o.worksiteType || 'Nonprofit',

      /* general information */
      address: o.address || '', room: o.room || '',
      borough: o.borough || 'Queens', zip: o.zip || '',
      crossStreets: o.crossStreets || '', travel: o.travel || '',
      addressNote: o.addressNote || '',
      cityAgency: o.cityAgency || 'No', agency: o.agency || '',
      doeBuilding: o.doeBuilding || 'No',
      summerRising: o.summerRising || 'No', summerRisingSite: o.summerRisingSite || '',
      sector: o.sector || 'Non-Profit', industry: o.industry || '',
      cityAffiliate: o.cityAffiliate || '',
      implementation: o.implementation || 'In-Person',
      description: o.description || '', website: o.website || '',
      childcare: !!o.childcare, natureEnv: o.natureEnv || 'No',

      /* supervision and management */
      ftEmployees: o.ftEmployees || '', supervisingStaff: o.supervisingStaff || '',
      supervisors: o.supervisors || [],

      /* job duties and schedule */
      requested: o.requested || 0,
      ratioSup: o.ratioSup || '', ratioPart: o.ratioPart || '',
      fullHours: o.fullHours || '', hoursCommitment: o.hoursCommitment || '',
      schedules: o.schedules || [],
      staggered: o.staggered || 'No',
      jobs: o.jobs || [],

      /* attachment 1 — childcare */
      cc: o.cc || null,

      /* required attachments and certifications */
      certs: o.certs || { investigation: '', detail: '', licenseCopy: false, assurances: '' },

      /* Assessment answers the monitor has told us are the same every week.
         Applied to a week that has no assessment started yet. */
      assessmentDefaults: o.assessmentDefaults || null,

      participants: o.participants || [],
      log: [], weeks: {},
      applicationOnFile: o.applicationOnFile !== false
    };
  }

  function seed() {
    var monitorName = 'Ashton Reyes';

    var db = {
      seedVersion: SEED_VERSION,
      program: PROGRAM,
      users: [
        { id: 'u1', name: monitorName, email: 'ashtonreyes@gryc.org', password: 'monitor',
          role: 'Site Monitor', phone: '(718) 366-3541', title: 'SYEP Site Monitor' },
        { id: 'u2', name: 'Alicia Rivera', email: 'arivera@gryc.org', password: 'demo',
          role: 'Site Monitor', phone: '(718) 366-3542', title: 'SYEP Site Monitor' }
      ],
      sites: [],
      mileage: [],
      locations: [],
      notes: [],
      w9s: [],
      i9s: []
    };

    /* Boilerplate that the childcare applications all reuse verbatim. */
    var ccDuties =
      'Provide assistance to group leader with children/campers. Support transitions between ' +
      'activities, distribute lunch, monitor campers while on trips, promote safe play. Assists ' +
      'with song, dance, physical activities, arts and crafts, etc.';
    var ccRestrict =
      'Participants assigned to these duties must be in compliance with required background ' +
      'screenings and state and local health laws applicable to individuals working in these types ' +
      'of facilities, and worksites are responsible for any fees incurred during this process. ' +
      'Refer to the Worksite Handbook for all guidance and regulations.';
    var mthDescription =
      'Maspeth Town Hall is now a thriving community center providing a variety of services ' +
      'including After School Programs, Summer Camp, Mommy & Me Toddler Groups, Senior Classes ' +
      'in Art, Chair Yoga, Tai Chi and more cultural and recreational activities.';
    var handbook = 'Refer to the Worksite Handbook for all guidance and regulations.';

    /* ---------------------------------------------------------------- s1
       Maspeth Town Hall, Inc. @ PS 229 — childcare / Summer Rising      */

    db.sites.push(blankSite({
      id: 's1', emoji: '🧸',
      name: 'Maspeth Town Hall, Inc. @ PS 229',
      worksiteType: 'Nonprofit',
      address: '67-25 51st Rd', borough: 'Queens', zip: '11377',
      crossStreets: 'Maurice Ave & 69th Street',
      travel: 'Bus Q18, Q47, Q60\nR train to 69 St or the 7 train to 61 St in Woodside',
      cityAgency: 'No', doeBuilding: 'Yes', summerRising: 'Yes',
      sector: 'Non-Profit', industry: 'Summer Camp', implementation: 'In-Person',
      description: mthDescription,
      website: 'https://www.maspethtownhall.org',
      childcare: true, natureEnv: 'No',
      ftEmployees: '350', supervisingStaff: '2',
      supervisors: [
        sup({ name: 'Finocchiaro, Lorraine', title: 'Summer Camp Director',
              email: 'lfinocchiaro@maspethtownhall.org', phone: '718-335-6049',
              rep: true, key: true, area: 'Summer Camp' }),
        sup({ name: 'Pauta, Sharyn', title: 'Summer Camp Director',
              email: 'spauta@maspethtownhall.org', phone: '718-335-6049',
              rep: false, key: false, area: 'Summer Camp' })
      ],
      requested: 24, ratioSup: '2', ratioPart: '24', fullHours: 'N',
      schedules: [
        { name: 'Shift 1', sun: '', mon: '08:00 AM to 01:00 PM', tue: '08:00 AM to 01:00 PM',
          wed: '08:00 AM to 01:00 PM', thu: '08:00 AM to 01:00 PM', fri: '08:00 AM to 01:00 PM', sat: '' },
        { name: 'Shift 2', sun: '', mon: '01:00 PM to 06:00 PM', tue: '01:00 PM to 06:00 PM',
          wed: '01:00 PM to 06:00 PM', thu: '01:00 PM to 06:00 PM', fri: '01:00 PM to 06:00 PM', sat: '' }
      ],
      staggered: 'Yes',
      jobs: [
        { category: 'Child Care', title: 'Counselor/Camp Counselor', duties: ccDuties,
          restrictions: ccRestrict, assigned: 12, must18: '',
          special: 'Assist with the implantation of daily plans and activites, monitory children ' +
                   'and participant activites. Maintain program site equipment.' },
        { category: 'Child Care', title: 'Counselor/Camp Counselor', duties: ccDuties,
          restrictions: ccRestrict, assigned: 12, must18: '',
          special: 'Provide assitance to Group Leaders with children/campers, transitioning between ' +
                   'activites, distributing lunch, monitoring campers while on trips, promote safe ' +
                   'play. Song, dance, physical activity, arts and crafts, etc.' }
      ],
      cc: {
        facilityType: 'Other:  School Age ChildCare',
        startDate: '2026-07-01', endDate: '2026-08-12',
        childrenServed: '535', trips: 'No', outdoor: 'No',
        screening: 'None of the Above', fingerprinted: 'No',
        licenseType: 'SACC License Number', licenseNumber: '00074148', licenseExp: '2026-08-12',
        outOfCity: 'No'
      },
      certs: { investigation: 'No', detail: '', licenseCopy: true, assurances: 'Yes' },
      participants: roster([
        ['6659987', 'Civili',     'Grasi',   'Queens',    '646-257-0990', 19, 'H'],
        ['4780867', 'Espinal',    'Matthew', 'Queens',    '347-848-3282', 19, 'C'],
        ['8801104', 'Exinord',    'Alexandre', 'Manhattan', '718-662-0728', 18, 'H'],
        ['4266710', 'Faican',     'Willian', 'Queens',    '929-557-6014', 16, ''],
        ['7923383', 'Garcia',     'Audrey',  'Queens',    '646-837-2403', 18, 'C'],
        ['2916376', 'Guerbi',     'Sonia',   'Queens',    '929-293-9073', 16, 'C'],
        ['4882612', 'McConnell',  'Max',     'Queens',    '718-271-4084', 16, 'HC'],
        ['2118011', 'Rodriguez',  'Emanuel', 'Queens',    '917-861-1542', 18, 'C'],
        ['6629090', 'Saquinaula', 'Paul',    'Queens',    '347-629-1926', 17, 'C']
      ])
    }));

    /* ---------------------------------------------------------------- s2
       P.S. 229 Emanuel Kaplan — custodial, city agency                  */

    db.sites.push(blankSite({
      id: 's2', emoji: '🧹',
      name: '229 Custodial',
      applicationName: 'P.S. 229 Emanuel Kaplan',
      worksiteType: 'Public',
      address: '67-25 51st Rd', borough: 'Queens', zip: '11377',
      crossStreets: 'Maurice Ave / 69th Street',
      travel: 'Q47 and Q18',
      cityAgency: 'Yes', agency: 'NYCPS - Custodial/Facilities',
      doeBuilding: 'Yes', summerRising: 'Yes',
      sector: 'Public', industry: 'Educational Services',
      cityAffiliate: 'NYCPS - Custodial/Facilities',
      implementation: 'In-Person',
      description: 'Public School 229Q - elementary',
      childcare: false, natureEnv: 'No',
      ftEmployees: '150', supervisingStaff: '2',
      supervisors: [
        sup({ name: 'Twardowski, Arkadiusz', title: 'Custodian Engineer',
              email: 'Atwardowski@schools.nyc.gov', phone: '718-446-2120',
              rep: true, key: true, area: 'School' }),
        sup({ name: 'Gallino, Richard', title: 'Fireman',
              email: 'cq229@schools.nyc.gov', phone: '718-446-2120',
              rep: false, key: false, area: 'School' })
      ],
      requested: 3, ratioSup: '2', ratioPart: '3', fullHours: 'Y',
      schedules: [
        { name: 'Day shift', sun: '', mon: '08:00 AM to 01:00 PM', tue: '08:00 AM to 01:00 PM',
          wed: '08:00 AM to 01:00 PM', thu: '08:00 AM to 01:00 PM', fri: '08:00 AM to 01:00 PM', sat: '' }
      ],
      staggered: 'No',
      jobs: [
        { category: 'Maintenance', title: 'Janitor Assistant/Custodian',
          duties: 'Assist with mopping, sweeping, cleaning dust, and garbage removal. Use of mild ' +
                  'cleaning astringents with supervision.',
          restrictions: 'SYEP participants may not operate motor vehicles and should not be tasked ' +
                        'with lifting more than 50 lbs. Participants over the age of 18 must receive ' +
                        'proper training before handling hazardous equipment and must be supervised at ' +
                        'all times. Participants under the age of 18 may not utilize equipment declared ' +
                        'hazardous. Participants under the age of 18 are also prohibited from utilizing ' +
                        'power-driven saws and woodworking machines, manufacturing equipment, and/or ' +
                        'hazardous chemicals.\n\n' + handbook,
          assigned: 3, must18: '',
          special: 'Must be willing to assist with summer cleaning/organizing classrooms.' }
      ],
      certs: { investigation: 'No', detail: '', licenseCopy: false, assurances: 'Yes' },
      participants: roster([
        ['7716436', 'Hillel', 'Noah', 'Queens', '917-445-2368', 17, 'H', 'Active', '', '2009-06-01']
      ])
    }));

    /* ---------------------------------------------------------------- s3
       Walgreens 09869 — private/for-profit retail                       */

    db.sites.push(blankSite({
      id: 's3', emoji: '💊',
      name: 'Walgreens At 80th Street',
      applicationName: 'Walgreens 09869',
      dycdId: '09869', worksiteType: 'Private/For-Profit',
      address: '80-11 Eliot Ave', borough: 'Queens', zip: '11379',
      crossStreets: '80 st & 81 st',
      travel: 'Q38 BUS to Queens center mall subway station',
      cityAgency: 'No', doeBuilding: 'No', summerRising: 'No',
      sector: 'Private/For-Profit', industry: 'Retail', implementation: 'In-Person',
      description: 'Drug store chain',
      childcare: false, natureEnv: 'No',
      ftEmployees: '28', supervisingStaff: '2',
      supervisors: [
        sup({ name: 'Christides, George', title: 'Store manager',
              email: 'mgr.09869@store.walgreens.com', phone: '718-505-8192', fax: '718-505-8198',
              rep: true, key: true, area: 'Sales floor' }),
        sup({ name: 'Simmons, Jasroy', title: 'Emerging store manager',
              email: 'str.09869@store.walgreens.com', phone: '718-505-8192', fax: '718-505-8198',
              rep: false, key: true, area: 'Sales floor' })
      ],
      requested: 7, ratioSup: '2', ratioPart: '7', fullHours: 'Y',
      schedules: [
        { name: 'Customer service associate',
          sun: '08:00 AM to 05:00 PM', mon: '07:00 AM to 09:00 PM', tue: '07:00 AM to 09:00 PM',
          wed: '07:00 AM to 09:00 PM', thu: '07:00 AM to 09:00 PM', fri: '07:00 AM to 09:00 PM',
          sat: '07:00 AM to 07:00 PM' }
      ],
      staggered: 'Yes',
      jobs: [
        { category: 'Other', title: 'Other:  Customer service associate',
          duties: 'Other:  Assist customers with opening and closing locked merchandise, helping ' +
                  'customers find what they need, Checking for outdated merchandise, rotating ' +
                  'merchandise, FIFO(First in first out), Facing: ensuring items are placed in front ' +
                  'of the correct pricing sticker, packing out warehouse & merchandise on the shelves, ' +
                  'printing pictures from digital photo lab, assisting with digital orders & curbside ' +
                  'pickups, cleaning, sweeping & mopping.',
          restrictions: handbook, assigned: 7, must18: '',
          special: 'Must speak fluent English, Must like to interact with people' }
      ],
      certs: { investigation: 'No', detail: '', licenseCopy: false, assurances: 'Yes' },
      participants: roster([
        ['9792428', 'Alvarado', 'Jayden',  'Queens', '516-312-6445', 19, 'H'],
        ['3206464', 'Cruz',     'Maximus', 'Queens', '929-317-8773', 16, ''],
        ['8132925', 'Flores',   'Arleth',  'Queens', '929-433-8442', 16, ''],
        ['6526396', 'Morales',  'Nelson',  'Queens', '347-416-4623', 17, 'X', 'Transferred',
         'Crossed off the roster.'],
        ['3167523', 'Parra',    'Imran',   'Queens', '646-477-8012', 18, 'H'],
        ['7933543', 'Romero',   'Eliana',  'Queens', '718-683-7953', 16, 'H']
      ])
    }));

    /* ---------------------------------------------------------------- s4
       Maspeth Town Hall, Inc. @ IS 73 — childcare / Summer Rising       */

    db.sites.push(blankSite({
      id: 's4', emoji: '🏫',
      name: 'Maspeth Town Hall, Inc. @ IS 73',
      worksiteType: 'Nonprofit',
      address: '70-02 54th Ave', borough: 'Queens', zip: '11378',
      crossStreets: '79th Street & 66th Avenue',
      travel: 'Q47, Q54, Q58\nM train to Middle Village–Metropolitan Ave',
      cityAgency: 'No', doeBuilding: 'Yes', summerRising: 'Yes',
      sector: 'Non-Profit', industry: 'Summer Camp', implementation: 'In-Person',
      description: mthDescription,
      website: 'https://www.maspethtownhall.org',
      childcare: true, natureEnv: 'No',
      ftEmployees: '350', supervisingStaff: '2',
      supervisors: [
        sup({ name: 'Balan, Adrian', title: 'Summer Camp Director',
              email: 'abalan@maspethtownhall.org', phone: '718-335-6049',
              rep: true, key: true, area: 'Summer Camp' }),
        sup({ name: 'Carrera, Louis', title: 'Summer Camp Director',
              email: 'loucarrera@maspethtownhall.org', phone: '718-335-6049',
              rep: false, key: true, area: 'Summer Camp' })
      ],
      requested: 24, ratioSup: '2', ratioPart: '24', fullHours: 'Y',
      schedules: [
        { name: 'Shift 1', sun: '', mon: '08:00 AM to 01:00 PM', tue: '08:00 AM to 01:00 PM',
          wed: '08:00 AM to 01:00 PM', thu: '08:00 AM to 01:00 PM', fri: '08:00 AM to 01:00 PM', sat: '' },
        { name: 'Shift 2', sun: '', mon: '01:00 PM to 06:00 PM', tue: '01:00 PM to 06:00 PM',
          wed: '01:00 PM to 06:00 PM', thu: '01:00 PM to 06:00 PM', fri: '01:00 PM to 06:00 PM', sat: '' }
      ],
      staggered: 'Yes',
      jobs: [
        { category: 'Child Care', title: 'Counselor/Camp Counselor', duties: ccDuties,
          restrictions: ccRestrict, assigned: 12, must18: '',
          special: 'Assist with the implantation of daily plans and activites, monitory children and ' +
                   'participant activites. Maintain program site equipment. Escorting the children on ' +
                   'field trips.' },
        { category: 'Child Care', title: 'Counselor/Camp Counselor', duties: ccDuties,
          restrictions: ccRestrict, assigned: 12, must18: '',
          special: 'Provide assitance to Group Leaders with children/campers, transitioning between ' +
                   'activites, distributing lunch, monitoring campers while on trips, promote safe ' +
                   'play. Song, dance, physical activity, arts and crafts, etc.' }
      ],
      cc: {
        facilityType: 'Other:  School Age ChildCare',
        startDate: '2026-07-01', endDate: '2026-08-14',
        childrenServed: '231', trips: 'No', outdoor: 'No',
        screening: 'None of the Above', fingerprinted: 'No',
        licenseType: 'SACC License Number', licenseNumber: '00230447', licenseExp: '2027-09-14',
        outOfCity: 'No'
      },
      certs: { investigation: 'No', detail: '', licenseCopy: true, assurances: 'Yes' },
      participants: roster([
        ['8622586', 'Cruz Nuesi', 'Kassidy',   'Queens',   '718-669-6766', 19, 'K'],
        ['5876325', 'Frodella',   'Sophia',    'Queens',   '929-409-2421', 18, 'K'],
        ['8750669', 'Izquierdo',  'Gianna',    'Queens',   '917-558-4301', 20, 'HK'],
        ['8620589', 'Lewis',      'Arianna',   'Brooklyn', '347-385-8992', 18, 'H'],
        ['5813416', 'Medina',     'Anthony',   'Queens',   '347-423-0298', 21, 'H'],
        ['5654152', 'Mencia',     'Michael',   'Queens',   '646-210-9342', 19, 'HK'],
        ['7871991', 'Muffoletto', 'Giancarlo', 'Queens',   '347-624-8777', 18, 'HX', 'Transferred',
         'Last name crossed out on the roster.'],
        ['5281665', 'Muratovic',  'Samina',    'Queens',   '347-383-3490', 19, 'H'],
        ['3156255', 'Muzio',      'Nicole',    'Queens',   '718-416-0478', 17, 'HK']
      ])
    }));

    /* ---------------------------------------------------------------- s5
       GRYC @ PS 106 — our own Summer Rising site, biggest roster        */

    db.sites.push(blankSite({
      id: 's5', emoji: '🎒',
      name: 'GRYC @ PS 106',
      worksiteType: 'Nonprofit',
      address: '242 Cooper St', borough: 'Brooklyn', zip: '11207',
      crossStreets: 'Cooper Street Between Wilson and Knickerbocker',
      travel: 'PS 384\n\nSubway: L train (Wilson Av).\nBuses: B20, B26, B60',
      cityAgency: 'No', doeBuilding: 'Yes', summerRising: 'Yes',
      sector: 'Non-Profit', industry: 'Summer Camp', implementation: 'In-Person',
      description: 'The mission of the Greater Ridgewood Youth Council is to improve the quality of ' +
                   'life for youths and families in the borough of Queens through service.',
      website: 'https://www.greaterridgewoodyouthcouncil.org',
      /* The application has ChildCare: No, but the site is a Summer Rising camp
         and every job on it is a Child Care job, so it is treated as one here:
         the assessment asks the Childcare Site Questions and every participant
         owes a childcare questionnaire. */
      childcare: true, natureEnv: 'No',
      ftEmployees: '33', supervisingStaff: '5',
      supervisors: [
        sup({ name: 'Munoz, Nicole', title: 'Director', email: 'nmunoz@thegryc.org',
              phone: '718-456-5437', rep: true, key: true, area: 'Camp' }),
        sup({ name: 'Garcia, Sasha', title: 'Assistant Director/Site Supervisor',
              email: 'sgarcia@thegryc.org', phone: '718-456-5437', area: 'Camp' }),
        sup({ name: 'Garcia, Katelyn', title: 'Instructor',
              email: 'katelynashleighgarcia@gmail.com', phone: '718-456-5437', area: 'Camp' }),
        sup({ name: 'Filemon, Joshuah', title: 'Instructor',
              email: 'jfilemon@schools.nyc.gov', phone: '718-456-5437', area: 'Camp' }),
        sup({ name: 'Coffiel, Trent', title: 'Progarm Aide',
              email: 'trentcoffiel@thegryc.org', phone: '718-456-5437', area: 'Camp' })
      ],
      requested: 60, ratioSup: '5', ratioPart: '60', fullHours: 'Y',
      schedules: [
        { name: 'Schedule 1', sun: '', mon: '08:00 AM to 01:00 PM', tue: '08:00 AM to 01:00 PM',
          wed: '08:00 AM to 01:00 PM', thu: '08:00 AM to 01:00 PM', fri: '08:00 AM to 01:00 PM', sat: '' },
        { name: 'Schedule 2', sun: '', mon: '12:00 PM to 05:00 PM', tue: '12:00 PM to 05:00 PM',
          wed: '12:00 PM to 05:00 PM', thu: '12:00 PM to 05:00 PM', fri: '12:00 PM to 05:00 PM', sat: '' },
        { name: 'Schedule 3', sun: '', mon: '01:00 PM to 06:00 PM', tue: '01:00 PM to 06:00 PM',
          wed: '01:00 PM to 06:00 PM', thu: '01:00 PM to 06:00 PM', fri: '01:00 PM to 06:00 PM', sat: '' }
      ],
      staggered: 'Yes',
      jobs: [
        { category: 'Child Care', title: 'Counselor/Camp Counselor', duties: ccDuties,
          restrictions: ccRestrict, assigned: 60, must18: '',
          special: '18+ must be fingerprinted in PETS.' }
      ],
      certs: { investigation: 'No', detail: '', licenseCopy: false, assurances: 'Yes' },
      participants: roster([
        ['6554243', 'Altamirano',        'Donald',     'Brooklyn',      '347-528-9420', 19, ''],
        ['9810184', 'Andagana',          'Brithany',   'Brooklyn',      '612-364-7929', 16, ''],
        ['8735622', 'Barrett',           'Amira',      'Brooklyn',      '347-667-5272', 17, ''],
        ['2115182', 'Bello',             'Franchesca', 'Brooklyn',      '718-223-7889', 17, 'H'],
        ['9402260', 'Brown',             'Tatyana',    'Queens',        '347-793-9292', 19, ''],
        ['6606248', 'Butler',            'Kimara',     'Brooklyn',      '347-356-3859', 19, ''],
        ['2881675', 'Camara',            'Bintou',     'Queens',        '347-651-3840', 17, 'HC'],
        ['9600589', 'Caraballo Reynoso', 'Jasmeryn',   'Brooklyn',      '347-661-7249', 17, 'H'],
        ['9072890', 'Carmona',           'Jeremy',     'Brooklyn',      '929-592-9250', 16, 'HC'],
        ['7499347', 'Cheng',             'Michael',    'Queens',        '347-730-9351', 17, ''],
        ['7713056', 'Cintron',           'Symphony',   'Brooklyn',      '347-581-3451', 17, ''],
        ['4428169', 'Collado',           'Jazlene',    'Brooklyn',      '929-337-4637', 17, ''],
        ['7352226', 'Compere',           'Madison',    'Queens',        '347-636-2065', 17, 'H', 'Active',
         'Marked "sick" on the roster.'],
        ['7599134', 'Cottle',            'Destiny',    'Brooklyn',      '646-243-5465', 19, ''],
        ['3910977', 'Dargan',            'Trevor',     'Brooklyn',      '718-756-2107', 22, 'H'],
        ['2939018', 'Das',               'Pooja',      'Brooklyn',      '929-698-5458', 17, 'H'],
        ['8174922', 'Delacruz',          'Bismary',    'Brooklyn',      '718-216-5528', 17, ''],
        ['3874116', 'Diaz',              'Jaylin',     'Brooklyn',      '718-902-0709', 18, 'H'],
        ['5954254', 'Duran',             'Stheissy',   'Brooklyn',      '929-452-9049', 18, 'H'],
        ['3820179', 'Duranta',           'Yamin',      'Brooklyn',      '929-593-9601', 18, ''],
        ['2828544', 'Ellis',             'Amari',      'Queens',        '347-901-6668', 18, 'H'],
        ['8302824', 'Elmaliki',          'Esma',       'Brooklyn',      '646-963-5613', 19, ''],
        ['9522648', 'Elssaid',           'Dlal',       'Staten Island', '929-427-6004', 17, ''],
        ['6905581', 'Gonzalez Ramos',    'Evelyn',     'Brooklyn',      '718-749-7292', 16, 'H'],
        ['2754173', 'Greene',            'Kashi',      'Brooklyn',      '929-584-0585', 17, 'H'],
        ['4016978', 'Guerra',            'Emily',      'Brooklyn',      '917-935-3970', 17, 'H'],
        ['6649408', 'Harris',            'Nazalia',    'Brooklyn',      '929-510-6424', 17, ''],
        ['9533624', 'Hinds',             'Masiya',     'Brooklyn',      '347-339-9530', 17, 'H', 'Terminated',
         'Marked "stopped coming" on the roster.'],
        ['4339127', 'Jimenez Castillo',  'Richar',     'Queens',        '347-600-1440', 17, ''],
        ['7520567', 'King',              'Josiyah',    'Brooklyn',      '929-767-7130', 18, 'HC'],
        ['2324252', 'King-Bey',          'Auriyanna',  'Brooklyn',      '929-743-1774', 19, ''],
        ['2886342', 'Liverman',          'Tajhmere',   'Brooklyn',      '347-388-9646', 17, ''],
        ['4329317', 'Maldonado',         'Jhomal',     'Brooklyn',      '347-489-8633', 16, ''],
        ['7107294', 'Maysonet',          'Lauren',     'Brooklyn',      '347-657-8542', 18, ''],
        ['6638299', 'McLean',            'Annabelle',  'Brooklyn',      '917-327-8353', 16, ''],
        ['4459285', 'McLean',            'James',      'Brooklyn',      '917-327-8353', 16, ''],
        ['6170038', 'Narvaez',           'Samantha',   'Queens',        '929-582-1906', 17, ''],
        ['8023697', 'Paul',              'Kiana',      'Brooklyn',      '347-968-9944', 19, 'H'],
        ['9193627', 'Pena',              'Armando',    'Brooklyn',      '929-530-0538', 16, ''],
        ['6085847', 'Pinnock',           'Demi',       'Brooklyn',      '917-379-3977', 18, ''],
        ['3016481', 'Polanco',           'Josmeilyn',  'Brooklyn',      '347-387-8305', 16, 'H'],
        ['6520389', 'Quimis',            'Ariana',     'Brooklyn',      '929-461-2776', 18, 'H'],
        ['2926456', 'Reyes',             'Andrew',     'Brooklyn',      '718-314-9073', 18, 'H'],
        ['4694960', 'Reyes',             'Robert',     'Brooklyn',      '917-579-5208', 16, ''],
        ['7737943', 'Roopchand',         'Saliyah',    'Brooklyn',      '929-264-8465', 16, ''],
        ['8837750', 'Rosero',            'Jadyanne',   'Staten Island', '646-428-4718', 17, 'H'],
        ['7639234', 'Rosero',            'Jaylene',    'Staten Island', '929-327-7232', 20, ''],
        ['9961704', 'Santos',            'Allan',      'Brooklyn',      '347-743-4646', 18, 'H', 'Active',
         'Marked "sick" on the roster.'],
        ['6121097', 'Severe',            'Harley',     'Brooklyn',      '347-231-6766', 18, 'H'],
        ['6904274', 'Thomas',            'Taliyah',    'Queens',        '929-365-5245', 16, 'H'],
        ['6519730', 'Waldron',           'Simyon',     'Brooklyn',      '347-579-1078', 17, 'HC'],
        ['4126333', 'Watson',            'Jada',       'Brooklyn',      '718-812-6456', 19, 'H']
      ])
    }));

    /* ---------------------------------------------------------------- s6
       Mimi & Coco Bakery and Bagel Shop                                 */

    db.sites.push(blankSite({
      id: 's6', emoji: '🥯',
      name: 'Mimi & Coco Bakery and Bagel Shop',
      worksiteType: 'Private/For-Profit',
      address: '71-02 Grand Avenue', room: 'Ground Floor', borough: 'Queens', zip: '11378',
      crossStreets: 'Grand Avenue and 71st Street',
      travel: 'Q58, Q59, and R, M trains to Grand Avenue.',
      cityAgency: 'No', doeBuilding: 'No', summerRising: 'No',
      sector: 'Private/For-Profit', industry: 'Retail', implementation: 'In-Person',
      description: 'Mimi & Coco Bakery & Bagels | Fresh daily baked goods | Original Recipes | ' +
                   'Breakfast, Lunch & Diner | Bagels, Sweet Bread | Catering Service | ' +
                   'Free Local Delivery',
      website: 'https://www.mimiandcocobagels.com/',
      childcare: false, natureEnv: 'No',
      ftEmployees: '4', supervisingStaff: '2',
      supervisors: [
        sup({ name: 'Scardino, Giuseppe', title: 'Owner',
              email: 'giuseppescardino69@gmail.com', phone: '718-997-0957',
              rep: true, key: true, area: 'Front of house' }),
        sup({ name: 'Casarrubias, Claudia', title: 'Co-owner',
              email: 'claudia.casarrubias.0@gmail.com', phone: '347-867-7539',
              rep: false, key: true, sign: false, area: 'Front of house' })
      ],
      requested: 2, ratioSup: '2', ratioPart: '2', fullHours: 'Y',
      schedules: [
        { name: 'Youth 1', sun: '', mon: '09:00 AM to 02:00 PM', tue: '09:00 AM to 02:00 PM',
          wed: '09:00 AM to 02:00 PM', thu: '09:00 AM to 02:00 PM', fri: '09:00 AM to 02:00 PM', sat: '' },
        { name: 'Youth 2', sun: '', mon: '01:00 PM to 06:00 PM', tue: '01:00 PM to 06:00 PM',
          wed: '01:00 PM to 06:00 PM', thu: '01:00 PM to 06:00 PM', fri: '01:00 PM to 06:00 PM', sat: '' }
      ],
      staggered: 'Yes',
      jobs: [
        { category: 'Business/Office', title: 'Customer Service Representative',
          duties: 'Provide sales assistance to help build sales marketing. Social and willing to ' +
                  'provide advice with regard to purchases.',
          restrictions: handbook, assigned: 1, must18: '',
          special: 'Willing to learn how to assist customers when purchasing baked goods and ' +
                   'handling goods.' },
        { category: 'Business/Office', title: 'Cashier',
          duties: 'Maintain cash register and help customers pack purchases. (Must be 18 years old & up.)',
          restrictions: handbook, assigned: 1, must18: 'Yes',
          special: 'Assist with cash register transactions, supervised by the manager.' }
      ],
      certs: { investigation: 'No', detail: '', licenseCopy: false, assurances: 'Yes' },
      participants: roster([
        ['5516004', 'Casino',  'Zach',    'Queens', '646-509-4118', 18, ''],
        ['4827738', 'Chudzik', 'Natalie', 'Queens', '646-584-3081', 17, '']
      ])
    }));

    /* ---------------------------------------------------------------- s7
       Glendale Bakery                                                    */

    db.sites.push(blankSite({
      id: 's7', emoji: '🍰',
      name: 'Mimi and Coco Pastry and Cakes LLC / dba Glendale Bakery',
      worksiteType: 'Private/For-Profit',
      address: '69-25 Grand Ave', room: 'Ground Floor', borough: 'Queens', zip: '11378',
      addressNote: 'The application lists 65-50 Grand Ave — 69-25 Grand Ave is the real address.',
      crossStreets: 'Grand Avenue and 71st Street',
      travel: 'Q58, Q59, and R and M trains to Grand Avenue-Newtown',
      cityAgency: 'No', doeBuilding: 'No', summerRising: 'No',
      sector: 'Private/For-Profit', industry: 'Retail', implementation: 'In-Person',
      description: 'Glendale Bakery makes fresh-baked goods like pies, cakes, cookies, sandwiches, ' +
                   'and other desserts products.',
      website: 'https://postmates.com/store/glendale-ba',
      childcare: false, natureEnv: 'No',
      ftEmployees: '4', supervisingStaff: '2',
      supervisors: [
        sup({ name: 'Lopez Campero, Mauricio', title: 'Owner',
              email: 'mauricio17@gmail.com', phone: '917-797-9418',
              rep: true, key: true, area: 'Front of house' }),
        sup({ name: 'Alcantara, Levi', title: 'Supervisor',
              email: 'levis0928@hotmail.com', phone: '347-326-3222',
              rep: false, key: false, sign: false, area: 'Front of house' })
      ],
      requested: 2, ratioSup: '2', ratioPart: '2', fullHours: 'Y',
      schedules: [
        { name: 'Youth 2', sun: '', mon: '09:00 AM to 02:00 PM', tue: '09:00 AM to 02:00 PM',
          wed: '09:00 AM to 02:00 PM', thu: '09:00 AM to 02:00 PM', fri: '09:00 AM to 02:00 PM', sat: '' },
        { name: 'Youth 1', sun: '', mon: '01:00 PM to 06:00 PM', tue: '01:00 PM to 06:00 PM',
          wed: '01:00 PM to 06:00 PM', thu: '01:00 PM to 06:00 PM', fri: '01:00 PM to 06:00 PM', sat: '' }
      ],
      staggered: 'No',
      jobs: [
        { category: 'Business/Office', title: 'Cashier',
          duties: 'Maintain cash register and help customers pack purchases. (Must be 18 years old & up.)',
          restrictions: handbook, assigned: 1, must18: 'Yes',
          special: 'Assist with cash register transactions.' },
        { category: 'Business/Office', title: 'Customer Service Representative',
          duties: 'Provide sales assistance to help build sales marketing. Social and willing to ' +
                  'provide advice with regard to purchases.',
          restrictions: handbook, assigned: 1, must18: '',
          special: 'Will assist customers in handling their orders and greeting them.' }
      ],
      certs: { investigation: 'No', detail: '', licenseCopy: false, assurances: 'Yes' },
      participants: roster([
        ['3757609', 'Kurylowicz', 'Adam',    'Queens', '347-833-0909', 16, 'H'],
        ['6904782', 'Sotamba',    'Valeria', 'Queens', '347-605-6914', 18, 'H']
      ])
    }));

    /* ---- saved mileage locations ------------------------------------- */

    db.locations = [
      { id: uid('loc'), monitorId: 'u1', label: 'Home', address: '84-12 57 Rd', kind: 'home' },
      { id: uid('loc'), monitorId: 'u1', label: 'GRYC Office', address: '59-03 Summerfield St', kind: 'hq' }
    ];

    /* ---- mileage ------------------------------------------------------
       One driving day a week: out from home, site to site, and back to the
       office with the timesheets. The 8/3 rows are the sheet photographed in
       the context folder, so that day reads exactly like the paper.

       The odometer runs straight through the summer from ODOMETER_START, so
       Start Mileage on any row is the End Mileage of the row above it and the
       column adds up down the page — which is the thing a hand-written sheet
       gets wrong and the reason it is computed here rather than typed.     */

    var ODOMETER_START = 41940;

    db.mileage = (function () {
      var HOME   = '84-12 57 Rd',      OFFICE    = '59-03 Summerfield St';
      var PS229  = '67-25 51st Rd',    WALGREENS = '80-11 Eliot Ave',
          IS73   = '70-02 54th Ave',   PS106     = '242 Cooper St',
          BAGEL  = '71-02 Grand Avenue', GLENDALE = '69-25 Grand Ave';

      /* [date, from, to, miles driven] */
      var trips = [
        ['2026-07-07', HOME,      PS229,     2.1],
        ['2026-07-07', PS229,     WALGREENS, 2.4],
        ['2026-07-07', WALGREENS, OFFICE,    1.9],

        ['2026-07-14', HOME,      BAGEL,     2.6],
        ['2026-07-14', BAGEL,     GLENDALE,  0.4],
        ['2026-07-14', GLENDALE,  PS229,     2.2],
        ['2026-07-14', PS229,     OFFICE,    1.6],

        ['2026-07-21', HOME,      PS106,     5.2],
        ['2026-07-21', PS106,     IS73,      4.1],
        ['2026-07-21', IS73,      OFFICE,    2.3],

        ['2026-07-28', HOME,      PS229,     2.1],
        ['2026-07-28', PS229,     WALGREENS, 2.4],
        ['2026-07-28', WALGREENS, BAGEL,     1.5],
        ['2026-07-28', BAGEL,     OFFICE,    1.4],

        /* the photographed sheet */
        ['2026-08-03', HOME,      PS106,     5.2],
        ['2026-08-03', PS106,     IS73,      4.1],
        ['2026-08-03', IS73,      OFFICE,    2.3],

        ['2026-08-10', HOME,      PS106,     5.2],
        ['2026-08-10', PS106,     IS73,      4.1],
        ['2026-08-10', IS73,      OFFICE,    2.3]
      ];

      /* One decimal, and no trailing ".0" — the way it is written by hand. */
      function num(n) { return String(Math.round(n * 10) / 10); }

      var odo = ODOMETER_START;
      return trips.map(function (t) {
        var start = odo;
        odo = Math.round((odo + t[3]) * 10) / 10;
        return {
          id: uid('ml'), monitorId: 'u1', date: t[0],
          startMileage: num(start), from: t[1], to: t[2],
          endMileage: num(odo), total: num(t[3])
        };
      });
    })();

    /* ---- a couple of reminders so the notes panel is not empty -------- */

    db.notes = [
      { id: uid('nt'), monitorId: 'u1', text: 'Glendale Bakery — application still shows 65-50 Grand Ave. ' +
        'Real address is 69-25 Grand Ave. Ask the office to correct it in YEPS.',
        pinned: true, done: false, createdAt: '2026-08-03T09:15:00' },
      { id: uid('nt'), monitorId: 'u1', text: 'Muffoletto (IS 73) and Morales (Walgreens) are crossed off ' +
        'the printed rosters — confirm with Nicole whether they transferred or were terminated.',
        pinned: false, done: false, createdAt: '2026-08-03T09:20:00' }
    ];

    backfill(db, monitorName);
    return db;
  }

  /* ---- history so the demo opens with weeks 1-4 already closed out ---- */

  function backfill(db, monitorName) {
    var visitTimes = [['11:45', '12:00'], ['08:30', '08:45'], ['13:00', '13:15'], ['11:00', '11:15'], ['12:15', '12:30'], ['10:00', '10:15']];

    db.sites.forEach(function (s, si) {
      var t = visitTimes[si % visitTimes.length];
      if (!s.participants.length) { s.weeks[currentWeek()] = emptyWeek(s); return; }

      [1, 2, 3, 4].forEach(function (wn) {
        var w = week(wn);
        var visitDate = addDays(w.start, (si % 5));

        s.log.push({
          id: uid('lg'), date: visitDate,
          monitor: monitorName,
          reasons: wn % 2 === 0 ? ['monitoring', 'timesheet'] : ['timesheet'],
          otherText: '',
          timeIn: t[0], timeOut: t[1], notes: ''
        });

        var collected = {};
        activeParticipants(s).forEach(function (p) { collected[p.id] = true; });

        s.weeks[wn] = {
          timesheets: syncTimesheets(s, {
            status: 'collected', collectedOn: visitDate, collected: collected, note: ''
          }),
          assessment: sampleAssessment(s, wn, visitDate, monitorName, si)
        };
      });

      /* Sites that filed Attachment 1 with their application collected the
         childcare questionnaires at intake. PS 106 was only identified as a
         childcare site mid-program, so its questionnaires are still owed —
         everything else comes from what was marked on the printed roster. */
      if (s.childcare && s.cc) s.participants.forEach(function (p) { p.docs.childcare = true; });

      s.weeks[5] = emptyWeek(s);
    });

    /* one site already handed over this week's sheets */
    if (db.sites[3]) {
      var s4 = db.sites[3], got = {};
      /* all but the last one handed in — shows the partial state */
      activeParticipants(s4).slice(0, -1).forEach(function (p) { got[p.id] = true; });
      s4.weeks[5].timesheets = syncTimesheets(s4, {
        status: 'collected', collectedOn: '2026-08-03', collected: got,
        note: 'Dropped at the front desk Monday — one still outstanding.'
      });
      db.sites[3].log.push({
        id: uid('lg'), date: '2026-08-03', monitor: 'Ashton Reyes',
        reasons: ['other'], otherText: 'Timesheet drop off',
        timeIn: '12:45', timeOut: '13:00', notes: ''
      });
    }
  }

  function emptyWeek(s) {
    return {
      timesheets: {
        status: 'pending', collectedOn: '', received: 0, expected: activeCount(s), note: '',
        /* per-participant tick boxes: { participantId: true } */
        collected: {}
      },
      assessment: null
    };
  }

  /* Keep `received` honest whenever the per-participant boxes change. */
  function syncTimesheets(s, ts) {
    ts.collected = ts.collected || {};
    var people = activeParticipants(s);
    var n = people.filter(function (p) { return ts.collected[p.id]; }).length;
    ts.received = n;
    ts.expected = people.length;
    if (n === 0) ts.status = 'pending';
    else if (n >= people.length) ts.status = 'collected';
    else ts.status = 'partial';
    return ts;
  }

  function activeCount(s) {
    return s.participants.filter(function (p) { return p.status === 'Active'; }).length;
  }

  function sampleAssessment(site, wn, date, monitorName, si) {
    var facility = {};
    FACILITY_ITEMS.forEach(function (i) { facility[i.id] = true; });

    var records = {};
    RECORDKEEPING_ITEMS.forEach(function (i) { records[i.id] = true; });
    if (!site.childcare) records.ccletter = false;

    var ops = {}, acts = {};
    OPERATIONS_Q.forEach(function (q) { ops[q.id] = 'yes'; });
    PROGRAM_ACTIVITY_Q.forEach(function (q) { acts[q.id] = 'yes'; });

    /* one real finding so the corrective-action path is visible */
    var hazard = '';
    if (site.id === 's3' && wn === 2) {
      facility.exits = false;
      hazard = 'Stock cart blocking the rear emergency exit. Cleared with the manager before leaving.';
    }
    if (site.id === 's1' && wn === 3) { acts.pa1 = 'no'; }

    var absent = [];
    if (wn === 3 && site.id === 's5') {
      var p = site.participants[4];
      if (p) absent.push({ id: p.id, name: proster(p), age: p.age, appId: p.appId, reason: 'Called out sick', initial: 'VG' });
    }

    var interviews = buildInterviews(site, wn);

    var summaries = [
      'Site is running smoothly. Supervisor was easy to locate and the participants could all describe ' +
        'their assigned duties. Timesheets were signed and up to date.',
      'Participants engaged and on task during the visit. Reviewed sign-in procedure with the supervisor ' +
        'again; hard copies are being kept in the binder as required.',
      'Good week. Supervisor reports attendance has been consistent. Week 3 evaluations completed and ' +
        'collected during this visit.',
      'No issues observed. Work activity matches what is listed on the Worksite Application. ' +
        'Participants are being offered their full scheduled hours.'
    ];

    var supA = site.supervisors[0] || { name: '', title: '', phone: '' };
    var supB = site.supervisors[1] || supA;

    return {
      id: uid('as'), week: wn, status: 'submitted',

      /* page 1 */
      supervisorRules: 'YES',
      visitDate: date,
      worksiteType: site.worksiteType,
      supervisorName: supA.name, supervisorTitle: supA.title, supervisorPhone: supA.phone,
      interviewName: supB.name, interviewTitle: supB.title, interviewPhone: supB.phone,
      expectedWork: site.implementation,
      assigned: activeCount(site),
      present: activeCount(site) - absent.length,
      otherProvidersNA: true, otherProviders: [],
      isRemote: false,
      facility: facility, hazard: hazard,
      monitorName: monitorName,

      /* page 2 */
      records: records,
      supervisorRows: site.supervisors.map(function (v) {
        return { name: v.name, title: v.title, area: v.area, room: v.room, trained: 'Y' };
      }),
      allAccounted: absent.length ? 'no' : 'yes',
      absent: absent,
      scheduleDays: 'Mon - Fri',
      scheduleHours: (site.schedules[0] && site.schedules[0].mon) || '',
      ops: ops,

      /* page 4 */
      safeEnv: 'yes', safeEnvExplain: '',
      activities: acts,
      ccNotApplicable: !site.childcare,
      ccDoc: site.childcare ? (site.cc ? 'license' : 'camp') : '',
      ccDocExp: site.cc ? site.cc.licenseExp : '',
      ccDuties: site.childcare ? 'yes' : '',
      ccAgeYounger: false, ccAgeOlder: true,
      ccResponsibilities: site.childcare ? (site.jobs[0] ? site.jobs[0].duties : '') : '',

      /* page 5 */
      summary: summaries[(wn - 1) % summaries.length] + (hazard ? ' ' + hazard : ''),
      monitorSig: 'typed:' + monitorName,
      supervisorSig: 'typed:' + supA.name, supervisorSigTitle: supA.title,
      followUpNeeded: hazard ? 'yes' : 'no', followUpDetail: hazard ? 'Verify exit stays clear at next visit.' : '',
      directorSig: '', directorDate: '',

      /* page 6 */
      interviewMode: 'In-Person',
      internshipExperience: 'In-Person',
      interviews: interviews,

      submittedAt: date
    };
  }

  function buildInterviews(site, wn) {
    var out = [];
    var pool = site.participants.filter(function (p) { return p.status === 'Active'; });
    for (var i = 0; i < INTERVIEWS_REQUIRED; i++) {
      var p = pool[(wn + i) % (pool.length || 1)];
      if (!p) { out.push(blankInterview()); continue; }
      var ans = {};
      INTERVIEW_Q.forEach(function (q) { ans[q.id] = q.id === 'q6' ? 'Paper' : (q.id === 'q12' ? 'No' : 'Yes'); });
      if (i === 0 && wn === 4) ans.q10 = 'No';
      out.push({
        participantId: p.id,
        dob: p.dob || '',
        lastName: p.last,
        workType: (site.jobs[0] && site.jobs[0].duties ? site.jobs[0].duties.slice(0, 70) : ''),
        answers: ans,
        notes: ''
      });
    }
    return out;
  }

  function blankInterview() {
    var ans = {};
    INTERVIEW_Q.forEach(function (q) { ans[q.id] = ''; });
    return { participantId: '', dob: '', lastName: '', workType: '', answers: ans, notes: '' };
  }

  /* ==========================================================================
     store
     ========================================================================== */

  var _db = null;

  function db() {
    if (_db) return _db;

    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (raw) { try { _db = JSON.parse(raw); } catch (e) { _db = null; } }

    /* Anything seeded by an older build is thrown away rather than shown. */
    if (_db && _db.seedVersion !== SEED_VERSION) _db = null;

    if (!_db) {
      dropLegacy();
      _db = seed();
      save();
    }
    return _db;
  }

  function dropLegacy() {
    try {
      LEGACY_KEYS.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* private mode */ }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(_db)); }
    catch (e) { console.warn('Could not persist demo data:', e); }
    return _db;
  }

  function reset() { _db = seed(); save(); }

  /* ---- auth ----------------------------------------------------------- */

  function login(email, password) {
    var u = db().users.filter(function (x) {
      return x.email.toLowerCase() === String(email).trim().toLowerCase() && x.password === password;
    })[0];
    if (!u) return null;
    try { sessionStorage.setItem(SESSION, u.id); } catch (e) {}
    return u;
  }

  function logout() { try { sessionStorage.removeItem(SESSION); } catch (e) {} }

  function currentUser() {
    var id = null;
    try { id = sessionStorage.getItem(SESSION); } catch (e) {}
    if (!id) return null;
    return db().users.filter(function (x) { return x.id === id; })[0] || null;
  }

  /* ---- queries -------------------------------------------------------- */

  function mySites() {
    var u = currentUser();
    if (!u) return [];
    return db().sites.filter(function (s) { return s.monitorId === u.id; });
  }

  function site(id) { return db().sites.filter(function (s) { return s.id === id; })[0] || null; }

  function participant(s, pid) {
    return s.participants.filter(function (p) { return p.id === pid; })[0] || null;
  }

  function activeParticipants(s) {
    return s.participants.filter(function (p) { return p.status === 'Active'; });
  }

  function weekData(s, n) {
    if (!s.weeks[n]) s.weeks[n] = emptyWeek(s);
    return s.weeks[n];
  }

  function primarySupervisor(s) {
    return s.supervisors.filter(function (v) { return v.siteRep; })[0] || s.supervisors[0] || null;
  }

  function fullAddress(s) {
    var bits = [s.address, s.room].filter(Boolean).join(', ');
    var tail = [s.borough, s.zip].filter(Boolean).join(' ');
    return [bits, tail].filter(Boolean).join(', ') || '—';
  }

  /* Documents each participant owes, given the site type.

     `form` names the page that fills the document in. A document with one is
     a button on the roster rather than a tick box — submitting the form is
     what ticks it. Documents without one are still a plain tick box, because
     the only record of them is the signed paper in the monitor's folder. */
  function docsFor(s) {
    var list = [
      { key: 'referral', label: 'Referral Sheet',   dueWeek: 1 },
      { key: 'week3',    label: 'Week 3 Evaluation', dueWeek: 3 },
      { key: 'week6',    label: 'Week 6 Evaluation', dueWeek: 6 }
    ];
    if (s.childcare) {
      list.push({ key: 'childcare', label: 'Childcare Questionnaire', dueWeek: 1, form: 'childcare.html' });
    }
    return list;
  }

  /* Forms bucket, for participants seeded or imported before it existed. */
  function participantForms(p) {
    if (!p.forms) p.forms = {};
    return p.forms;
  }

  /* The last completed childcare questionnaire on this site. Q1, Q2 and Q5 are
     answered the same way for every youth at a site, so the next one starts
     from the last one rather than from nothing. */
  function lastChildcareForm(s, exceptId) {
    var best = null;
    (s.participants || []).forEach(function (p) {
      var f = p.forms && p.forms.childcare;
      if (!f || !f.completedAt || p.id === exceptId) return;
      if (!best || String(f.date) > String(best.date)) best = f;
    });
    return best;
  }

  function outstandingDocs(s) {
    var cw = currentWeek(), n = 0, docs = docsFor(s);
    activeParticipants(s).forEach(function (p) {
      docs.forEach(function (d) { if (d.dueWeek <= cw && !p.docs[d.key]) n++; });
    });
    return n;
  }

  function docProgress(s) {
    var cw = currentWeek(), done = 0, total = 0, docs = docsFor(s);
    activeParticipants(s).forEach(function (p) {
      docs.forEach(function (d) { if (d.dueWeek <= cw) { total++; if (p.docs[d.key]) done++; } });
    });
    return { done: done, total: total, pct: total ? Math.round(done / total * 100) : 100 };
  }

  /* ---- mileage -------------------------------------------------------- */

  function myMileage() {
    var u = currentUser();
    if (!u) return [];
    return db().mileage.filter(function (m) { return m.monitorId === u.id; });
  }

  function myLocations() {
    var u = currentUser();
    if (!u) return [];
    var saved = db().locations.filter(function (l) { return l.monitorId === u.id; });
    var fromSites = mySites()
      .filter(function (s) { return s.address; })
      .map(function (s) { return { id: 'site_' + s.id, label: s.name, address: s.address, kind: 'site' }; });
    return saved.concat(fromSites);
  }

  function addMileage(row) {
    var u = currentUser();
    row.id = uid('ml');
    row.monitorId = u.id;
    db().mileage.push(row);
    save();
    return row;
  }

  /* Rounded on the way out: adding a column of one-decimal distances in binary
     floating point lands on 55.400000000000006, and that is what the stat tile
     would print. */
  function mileageTotal(rows) {
    var n = rows.reduce(function (t, r) { return t + (parseFloat(r.total) || 0); }, 0);
    return Math.round(n * 10) / 10;
  }

  /* ---- monitor notes / reminders -------------------------------------- */

  function myNotes() {
    var u = currentUser();
    if (!u) return [];
    return (db().notes || []).filter(function (n) { return n.monitorId === u.id; });
  }

  function addNote(text) {
    var u = currentUser();
    var n = {
      id: uid('nt'), monitorId: u.id, text: text,
      pinned: false, done: false,
      createdAt: new Date().toISOString().slice(0, 19)
    };
    db().notes.push(n);
    save();
    return n;
  }

  function updateNote(id, patch) {
    var n = (db().notes || []).filter(function (x) { return x.id === id; })[0];
    if (!n) return null;
    Object.keys(patch).forEach(function (k) { n[k] = patch[k]; });
    save();
    return n;
  }

  function removeNote(id) {
    var d = db();
    d.notes = (d.notes || []).filter(function (x) { return x.id !== id; });
    save();
  }

  /* ---- signed forms: W-9 and I-9 ----------------------------------------
     Both are kept the same way: a collection each, filtered to the account
     that collected them, with an access log and a fingerprint of what was
     signed. A signed section is never edited — the signature has to be the
     last entry — so a change means a new form, or for an I-9 whose Section 2
     is not signed yet, reopening Section 1 for the employee to re-sign.
     A browser seeded before a collection existed gets it on first use
     instead of a re-seed, which would wipe the rest of the demo.          */

  function formList(kind) {
    var d = db();
    if (!d[kind]) d[kind] = [];
    return d[kind];
  }

  function myForms(kind) {
    var u = currentUser();
    if (!u) return [];
    return formList(kind).filter(function (f) { return f.monitorId === u.id; });
  }

  function formById(kind, id) {
    return formList(kind).filter(function (f) { return f.id === id; })[0] || null;
  }

  /* Insert or replace by id. Stores a copy, so the page's working copy never
     aliases the record on file. */
  function putForm(kind, f) {
    var list = formList(kind), copy = clone(f);
    var i = list.map(function (x) { return x.id; }).indexOf(f.id);
    if (i > -1) list[i] = copy; else list.push(copy);
    save();
    return copy;
  }

  function removeForm(kind, id) {
    var d = db();
    d[kind] = formList(kind).filter(function (x) { return x.id !== id; });
    save();
  }

  function myW9s() { return myForms('w9s'); }
  function w9(id) { return formById('w9s', id); }
  function putW9(f) { return putForm('w9s', f); }
  function removeW9(id) { removeForm('w9s', id); }

  function myI9s() { return myForms('i9s'); }
  function i9(id) { return formById('i9s', id); }
  function putI9(f) { return putForm('i9s', f); }
  function removeI9(id) { removeForm('i9s', id); }

  /* "Chrome on Windows" — enough to tell one device from another in the
     access log without keeping the whole user-agent string. */
  function deviceLabel() {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    var b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera'
          : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
          : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    var o = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android'
          : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return b + (o ? ' on ' + o : '');
  }

  /* One entry per time someone opened, saved, signed, viewed or printed the
     form — the record of user access Announcement 98-27 asks for on a W-9,
     and the audit trail 8 CFR 274a.2(g) requires on an I-9: when, who, and
     what they did. */
  function logAccess(f, what, detail) {
    var u = currentUser();
    if (!f.audit) f.audit = [];
    f.audit.push({
      at: new Date().toISOString(),
      who: u ? u.name : '—', email: u ? u.email : '',
      what: what, detail: detail || '',
      device: deviceLabel()
    });
    return f;
  }

  /* What the payee signed, in a fixed order. It is hashed at the moment of
     signing and hashed again every time the form is opened, so "the
     information received is the information sent" is checked, not assumed. */
  var W9_SIGNED_FIELDS = [
    'form', 'name', 'business', 'taxClass', 'llcCode', 'otherText', 'foreignPartners',
    'exemptPayee', 'fatca', 'address', 'city', 'state', 'zip', 'accounts', 'requester',
    'tinType', 'tin', 'appliedFor', 'backupWithholding',
    'identity', 'signerName', 'signerTitle', 'signature', 'signedAt'
  ];

  function fingerprint(f, fields) {
    var o = {};
    fields.forEach(function (k) { o[k] = f[k] === undefined ? null : f[k]; });
    return sha256(JSON.stringify(o));
  }

  function w9Fingerprint(f) { return fingerprint(f, W9_SIGNED_FIELDS); }

  /* An I-9 is signed twice. Section 1's fingerprint covers what the employee
     (and any preparer) signed; Section 2's covers the whole form, Section 1's
     fingerprint included, so either signature can be checked on its own. */
  var I9_S1_FIELDS = [
    'edition', 'lastName', 'firstName', 'middleInitial', 'otherLastNames',
    'address', 'apt', 'city', 'state', 'zip', 'dob', 'ssn', 'email', 'phone',
    'citizenship', 'lprNumber', 'workUntil', 'workUntilNA', 'alienIdType', 'alienA', 'i94',
    'passportNo', 'passportCountry', 'helper', 'preparer', 's1Identity', 's1Ack', 'prepAck',
    'employeeSig', 's1SignedAt'
  ];
  var I9_S2_FIELDS = I9_S1_FIELDS.concat([
    's1Hash', 'employer', 'docPath', 'listA', 'listB', 'listC', 'additionalInfo', 'altProcedure',
    'firstDay', 'repLast', 'repFirst', 'repTitle', 's2Ack', 'employerSig', 's2SignedAt'
  ]);

  function i9Fingerprint(f, section) { return fingerprint(f, section === 2 ? I9_S2_FIELDS : I9_S1_FIELDS); }

  /* "Last, First M." as the dashboard and the record list it. */
  function i9Name(f) {
    var n = proster({ last: f.lastName, first: f.firstName });
    return f.middleInitial ? n + ' ' + f.middleInitial.replace(/\.$/, '') + '.' : n;
  }

  function addBusinessDays(iso, n) {
    var p = iso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) n--;
    }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* Section 2 is due three business days after the first day of employment
     — start on a Monday, done by Thursday. Weekends are skipped but federal
     holidays are not, so a holiday week comes out a day early: the safe
     direction to be wrong in. */
  function i9Section2Due(f) { return f.firstDay ? addBusinessDays(f.firstDay, 3) : ''; }

  /* When Supplement B reverification falls due: the earliest of the Section 1
     "authorized to work until" date and the List A or List C expiration
     dates. Only for "an alien authorized to work" — citizens, noncitizen
     nationals and permanent residents are not reverified. Counting every
     List A date (a passport's as well as its I-94's) is deliberately the
     cautious reading. */
  function i9ReverifyBy(f) {
    if (f.citizenship !== 'alien') return '';
    var dates = [];
    if (f.workUntil && !f.workUntilNA) dates.push(f.workUntil);
    (f.docPath === 'A' ? (f.listA || []) : [f.listC || {}]).forEach(function (d) {
      if (d && d.expiry) dates.push(d.expiry);
    });
    return dates.sort()[0] || '';
  }

  /* A completed I-9 is kept for three years after the first day of
     employment or one year after employment ends, whichever is later. The
     end date isn't known yet, so this is the earliest it could go. */
  function i9RetainUntil(f) {
    if (!f.firstDay) return '';
    var p = f.firstDay.split('-');
    return (+p[0] + 3) + '-' + p[1] + '-' + (p[1] === '02' && p[2] === '29' ? '28' : p[2]);
  }

  /* SHA-256, synchronous and dependency-free. crypto.subtle would do, but it
     is async and missing on some file:// and plain-http origins, which is how
     this demo is usually opened. Round constants are derived rather than
     typed: the fractional parts of the cube roots of the first 64 primes, and
     of the square roots of the first 8 for the initial hash. */
  var SHA_K = [], SHA_H = [];
  (function () {
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    for (var n = 2, found = 0; found < 64; n++) {
      var prime = true;
      for (var f = 2; f * f <= n; f++) if (n % f === 0) { prime = false; break; }
      if (!prime) continue;
      if (found < 8) SHA_H[found] = frac(Math.sqrt(n));
      SHA_K[found++] = frac(Math.cbrt(n));
    }
  })();

  function sha256(str) {
    var bytes = new TextEncoder().encode(String(str));
    var len = bytes.length;
    var total = Math.ceil((len + 9) / 64) * 64;
    var m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    dv.setUint32(total - 4, (len * 8) >>> 0);

    function ror(x, r) { return (x >>> r) | (x << (32 - r)); }
    var H = SHA_H.slice(), w = new Array(64);

    for (var off = 0; off < total; off += 64) {
      for (var t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4) | 0;
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        w[t] = (w[t - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) +
                w[t - 7]  + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[t] + w[t]) | 0;
        var t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (v) { return ('0000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
  }

  /* 123456789 -> 123-45-6789 (SSN or ITIN) or 12-3456789 (EIN). `masked`
     keeps only the last four, for anywhere the number need not be read. */
  function fmtTin(digits, type, masked) {
    var d = String(digits || '').replace(/\D/g, '');
    if (!d) return '';
    if (masked) d = d.replace(/\d(?=\d{4})/g, '•');
    return type === 'ein'
      ? d.slice(0, 2) + '-' + d.slice(2)
      : d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
  }

  function w9ClassLabel(f) {
    var c = W9_CLASSES.filter(function (x) { return x.id === f.taxClass; })[0];
    if (!c) return '';
    if (c.id === 'llc') return 'LLC' + (f.llcCode ? ' (' + f.llcCode + ')' : '');
    if (c.id === 'other') return 'Other' + (f.otherText ? ' — ' + f.otherText : '');
    return c.label;
  }

  /* ---- assessment scoring --------------------------------------------- */

  /* Everything on the packet that reads as a problem worth writing up. */
  function findings(a, s) {
    var out = [];
    if (!a) return out;

    FACILITY_ITEMS.forEach(function (i) {
      if (a.facility && a.facility[i.id] === false) out.push('Facility — ' + i.text + ' not met');
    });
    if (a.hazard) out.push('Facility — hazardous conditions noted: ' + a.hazard);

    RECORDKEEPING_ITEMS.forEach(function (i) {
      if (i.id === 'ccletter' && s && !s.childcare) return;
      if (a.records && a.records[i.id] === false) out.push('Recordkeeping — ' + i.text + ' not available');
    });

    OPERATIONS_Q.forEach(function (q) {
      if (a.ops && a.ops[q.id] === 'no') out.push('Operations Q' + q.n + ' — ' + q.text);
    });

    PROGRAM_ACTIVITY_Q.forEach(function (q) {
      if (a.activities && a.activities[q.id] === 'no') out.push('Program activities Q' + q.n + ' — ' + q.text);
    });

    if (a.safeEnv === 'no') out.push('Site not classified as a safe environment' + (a.safeEnvExplain ? ' — ' + a.safeEnvExplain : ''));
    if (a.ccDuties === 'no') out.push('Childcare — participant job duties not clearly outlined to youth');

    (a.interviews || []).forEach(function (iv, idx) {
      if (!iv || !iv.answers) return;
      INTERVIEW_Q.forEach(function (q) {
        if (INTERVIEW_FLAGS[q.id] && iv.answers[q.id] === INTERVIEW_FLAGS[q.id]) {
          out.push('Interview #' + (idx + 1) + ' Q' + q.n + ' — "' + iv.answers[q.id] + '" to: ' + q.text);
        }
      });
    });

    return out;
  }

  /* ==========================================================================
     ASSESSMENT DEFAULTS — the answers that do not change week to week
     ==========================================================================

     Most of a weekly assessment describes the site, not the visit: the same
     supervisor, the same facility boxes, the same recordkeeping binder, the
     same shift hours. A monitor can answer those once and have every later
     week start from them, then type in only what actually happened that week.

     Which side of that line a field falls on is decided here, once, rather
     than in the wizard — so "did my answer carry over?" has a readable
     answer. Anything not listed below is week-specific and never carries. */

  var ASSESSMENT_CARRY_GROUPS = [
    { label: 'Worksite Supervisor and Person Interviewed',
      keys: ['supervisorRules', 'supervisorName', 'supervisorTitle', 'supervisorPhone',
             'interviewName', 'interviewTitle', 'interviewPhone'] },
    { label: 'Expected work mode and other providers on site',
      keys: ['expectedWork', 'isRemote', 'otherProvidersNA', 'otherProviders'] },
    { label: 'Facility condition boxes',            keys: ['facility'] },
    { label: 'Recordkeeping boxes',                 keys: ['records'] },
    { label: 'Supervisor table (name / title / area / room / trained)',
      keys: ['supervisorRows'] },
    { label: 'Work schedule — days and hours',      keys: ['scheduleDays', 'scheduleHours'] },
    { label: 'Operations answers',                  keys: ['ops'] },
    { label: 'Safe environment and Program Activities answers',
      keys: ['safeEnv', 'activities'] },
    { label: 'Childcare Site Questions', childcareOnly: true,
      keys: ['ccNotApplicable', 'ccDoc', 'ccDocExp', 'ccDuties',
             'ccAgeYounger', 'ccAgeOlder', 'ccResponsibilities'] },
    { label: 'Interview mode and internship experience',
      keys: ['interviewMode', 'internshipExperience'] }
  ];

  /* Spelled out for the monitor, so saving defaults is not a leap of faith. */
  var ASSESSMENT_WEEKLY_LABELS = [
    'Date of visit',
    'Participants assigned and present, and the absence list',
    'Hazardous conditions and the safe-environment explanation',
    'Overall Report Summary and the follow-up block',
    'Both signatures',
    'The two participant interviews'
  ];

  var ASSESSMENT_CARRY = ASSESSMENT_CARRY_GROUPS.reduce(function (all, g) {
    return all.concat(g.keys);
  }, []);

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function saveAssessmentDefaults(s, form, fromWeek) {
    var out = { savedFromWeek: fromWeek, savedOn: todayISO() };
    ASSESSMENT_CARRY.forEach(function (k) {
      if (form[k] !== undefined) out[k] = clone(form[k]);
    });
    s.assessmentDefaults = out;
    save();
    return out;
  }

  function clearAssessmentDefaults(s) {
    s.assessmentDefaults = null;
    save();
  }

  /* Copies the saved answers onto `form` in place. Returns false when there is
     nothing saved, so callers can say so instead of silently doing nothing. */
  function applyAssessmentDefaults(s, form) {
    var d = s.assessmentDefaults;
    if (!d) return false;
    ASSESSMENT_CARRY.forEach(function (k) {
      if (d[k] !== undefined) form[k] = clone(d[k]);
    });
    return true;
  }

  /* ==========================================================================
     exports
     ========================================================================== */

  return {
    /* Printed on screen so "is my browser running the current file?" is a
       question you can answer by looking, not by guessing at the cache. */
    BUILD: BUILD,

    PROGRAM: PROGRAM,
    WEEKS: WEEKS,
    WORKSITE_TYPES: WORKSITE_TYPES,
    SECTORS: SECTORS,
    IMPLEMENTATION: IMPLEMENTATION,
    BOROUGHS: BOROUGHS,
    LICENSE_TYPES: LICENSE_TYPES,
    DAYS: DAYS,
    DAY_LABELS: DAY_LABELS,

    FACILITY_ITEMS: FACILITY_ITEMS,
    RECORDKEEPING_ITEMS: RECORDKEEPING_ITEMS,
    OPERATIONS_Q: OPERATIONS_Q,
    MARK_MEANING: MARK_MEANING,
    PROGRAM_ACTIVITY_Q: PROGRAM_ACTIVITY_Q,
    CHILDCARE_RATIOS: CHILDCARE_RATIOS,
    CHILDCARE_TRIP_RATIO: CHILDCARE_TRIP_RATIO,
    CHILDCARE_NOTE: CHILDCARE_NOTE,
    CHILDCARE_DOCS: CHILDCARE_DOCS,
    CHILDCARE_AGE_RANGES: CHILDCARE_AGE_RANGES,
    INTERVIEW_Q: INTERVIEW_Q,
    INTERVIEW_FLAGS: INTERVIEW_FLAGS,
    INTERVIEW_MODES: INTERVIEW_MODES,
    INTERNSHIP_MODES: INTERNSHIP_MODES,
    INTERVIEWS_REQUIRED: INTERVIEWS_REQUIRED,
    ABSENCE_REASONS: ABSENCE_REASONS,
    VISIT_REASONS: VISIT_REASONS,
    TIME_SLOTS: TIME_SLOTS,

    W9_REV: W9_REV,
    W9_REQUESTER: W9_REQUESTER,
    W9_CLASSES: W9_CLASSES,
    W9_LLC_CODES: W9_LLC_CODES,
    W9_EXEMPT_PAYEE_CODES: W9_EXEMPT_PAYEE_CODES,
    W9_FATCA_CODES: W9_FATCA_CODES,
    W9_CERT_INTRO: W9_CERT_INTRO,
    W9_CERT: W9_CERT,
    W9_CERT_INSTRUCTIONS: W9_CERT_INSTRUCTIONS,
    W9_US_PERSON: W9_US_PERSON,
    US_STATES: US_STATES,

    ORG: ORG,
    I9_EDITION: I9_EDITION,
    I9_OMB: I9_OMB,
    I9_EXPIRES: I9_EXPIRES,
    I9_EMPLOYER: I9_EMPLOYER,
    I9_EVERIFY: I9_EVERIFY,
    I9_START_HERE: I9_START_HERE,
    I9_ANTI_DISCRIMINATION: I9_ANTI_DISCRIMINATION,
    I9_S1_HEAD: I9_S1_HEAD,
    I9_S1_ATTEST: I9_S1_ATTEST,
    I9_STATUS_PROMPT: I9_STATUS_PROMPT,
    I9_STATUSES: I9_STATUSES,
    I9_PREPARER_NOTE: I9_PREPARER_NOTE,
    I9_S2_HEAD: I9_S2_HEAD,
    I9_ALT_PROCEDURE: I9_ALT_PROCEDURE,
    I9_S2_CERT: I9_S2_CERT,
    I9_SUPP_A_INSTRUCTIONS: I9_SUPP_A_INSTRUCTIONS,
    I9_PREPARER_ATTEST: I9_PREPARER_ATTEST,
    I9_MINOR: I9_MINOR,
    I9_LISTS: I9_LISTS,
    I9_PICK: I9_PICK,

    db: db, save: save, reset: reset,
    login: login, logout: logout, currentUser: currentUser,
    mySites: mySites, site: site, participant: participant,
    activeParticipants: activeParticipants, primarySupervisor: primarySupervisor,
    fullAddress: fullAddress,
    weekData: weekData, docsFor: docsFor, outstandingDocs: outstandingDocs, docProgress: docProgress,
    participantForms: participantForms, lastChildcareForm: lastChildcareForm,

    ASSESSMENT_CARRY_GROUPS: ASSESSMENT_CARRY_GROUPS,
    ASSESSMENT_WEEKLY_LABELS: ASSESSMENT_WEEKLY_LABELS,
    saveAssessmentDefaults: saveAssessmentDefaults,
    clearAssessmentDefaults: clearAssessmentDefaults,
    applyAssessmentDefaults: applyAssessmentDefaults,

    myMileage: myMileage, myLocations: myLocations, addMileage: addMileage, mileageTotal: mileageTotal,
    myNotes: myNotes, addNote: addNote, updateNote: updateNote, removeNote: removeNote,
    myW9s: myW9s, w9: w9, putW9: putW9, removeW9: removeW9,
    w9Fingerprint: w9Fingerprint, w9ClassLabel: w9ClassLabel, fmtTin: fmtTin,
    myI9s: myI9s, i9: i9, putI9: putI9, removeI9: removeI9,
    i9Fingerprint: i9Fingerprint, i9Name: i9Name, i9Section2Due: i9Section2Due,
    i9ReverifyBy: i9ReverifyBy, i9RetainUntil: i9RetainUntil, addBusinessDays: addBusinessDays,
    logAccess: logAccess, deviceLabel: deviceLabel, sha256: sha256,
    findings: findings, blankInterview: blankInterview, emptyWeek: emptyWeek,
    syncTimesheets: syncTimesheets, activeCount: activeCount,

    uid: uid, todayISO: todayISO, addDays: addDays, pad: pad, minutes: minutes,
    fmtDate: fmtDate, fmtShort: fmtShort, fmtSlash: fmtSlash, fmtTime: fmtTime,
    currentWeek: currentWeek, week: week, weekOf: weekOf,
    initials: initials, pname: pname, proster: proster, age: age, snap15: snap15
  };
})();
