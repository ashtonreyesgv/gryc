/* ==========================================================================
   GRYC SYEP Site Monitor Portal — shared UI helpers
   ========================================================================== */

(function (G) {
  'use strict';

  /* ---- tiny DOM helpers ---------------------------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /* ---- session guard --------------------------------------------------- */

  function requireAuth() {
    var u = G.currentUser();
    if (!u) { location.replace('index.html'); return null; }
    return u;
  }

  /* ---- chrome ---------------------------------------------------------- */

  function renderHeader(active) {
    var u = G.currentUser() || { name: '—', role: '' };
    var nav = [
      ['dashboard.html', 'My Sites', 'sites'],
      ['schedule.html', 'This Week', 'week'],
      ['mileage.html', 'Mileage', 'mileage']
    ];

    var html =
      '<header class="appbar"><div class="wrap">' +
        '<a class="brand" href="dashboard.html">' +
          '<img src="assets/images/gryc_logo.png" alt="Greater Ridgewood Youth Council">' +
          '<span class="brand-txt"><b>GRYC SYEP Portal</b><span>Site Monitor</span></span>' +
        '</a>' +
        '<nav class="nav">' +
          nav.map(function (n) {
            return '<a href="' + n[0] + '" class="' + (active === n[2] ? 'on' : '') + '">' + n[1] + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="who">' +
          '<span class="badge info nowrap">Week ' + G.currentWeek() + ' of 6</span>' +
          '<div class="avatar" title="' + esc(u.name) + '">' + esc(G.initials(u.name)) + '</div>' +
          '<button class="btn sm ghost" id="signout">Sign out</button>' +
        '</div>' +
      '</div></header>';

    document.body.insertAdjacentHTML('afterbegin', html);
    $('#signout').addEventListener('click', function () {
      G.logout();
      location.href = 'index.html';
    });
  }

  /* ---- form controls that mirror the paper packet ---------------------- */

  /* A <select> of quarter-hour times — the monitoring log is always
     written in :00 / :15 / :30 / :45, so free-typing a time is a trap. */
  function timeSelect(attrs, value, opts) {
    opts = opts || {};
    var v = G.snap15(value);
    var out = '<select ' + attrs + ' class="timesel">';
    if (opts.blank !== false) {
      out += '<option value=""' + (v ? '' : ' selected') + '>' + esc(opts.blankLabel || '—:—') + '</option>';
    }
    G.TIME_SLOTS.forEach(function (t) {
      out += '<option value="' + t + '"' + (t === v ? ' selected' : '') + '>' + esc(G.fmtTime(t)) + '</option>';
    });
    return out + '</select>';
  }

  /* Yes / No (/ N/A) segmented control, matching the checkbox columns. */
  function triState(name, id, value, allowNA, labels) {
    var opts = labels || [['yes', 'Yes'], ['no', 'No']];
    if (allowNA) opts = opts.concat([['na', 'N/A']]);
    return '<div class="seg">' + opts.map(function (o) {
      return '<label><input type="radio" name="' + esc(name) + '" value="' + esc(o[0]) + '" data-tri="' + esc(id) + '"' +
        (value === o[0] ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
    }).join('') + '</div>';
  }

  /* Two-option pick where the values are the labels (interview questions). */
  function pickTwo(name, id, value, options) {
    return '<div class="seg">' + options.map(function (o) {
      return '<label><input type="radio" name="' + esc(name) + '" value="' + esc(o) + '" data-pick="' + esc(id) + '"' +
        (value === o ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
    }).join('') + '</div>';
  }

  /* Printed ☒ / ☐ so the read-only view reads like the actual form. */
  function box(on) { return '<span class="fbox' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span>'; }

  function boxLabel(on, text, em) {
    return '<span class="fbox-row">' + box(on) + '<span>' + esc(text) +
      (em ? ' <em>' + esc(em) + '</em>' : '') + '</span></span>';
  }

  /* ---- participant entry grid -------------------------------------------
     One box per column of the YEPS "Worksite Assignments" roster. Shared by
     the roster import on a site page and by Register a worksite, so the two
     cannot drift apart. Retyping a roster as "a, b, c" was an easy way to
     slide a phone number into the age field — but pasting a delimited row
     into the Application ID box still fans it out across the boxes, so the
     paste-a-blob habit keeps working.                                      */

  var P_FIELDS = ['appId', 'last', 'first', 'program', 'borough', 'phone', 'age'];

  function pcell(tr, f) { return tr.querySelector('[data-f="' + f + '"]'); }

  function prow(boro) {
    return '<tr>' +
      '<td><input type="text" data-f="appId" placeholder="Application ID"></td>' +
      '<td><input type="text" data-f="last" placeholder="Last name"></td>' +
      '<td><input type="text" data-f="first" placeholder="First name"></td>' +
      '<td><input type="text" data-f="program" value="Lottery"></td>' +
      '<td><select data-f="borough">' + G.BOROUGHS.map(function (b) {
        return '<option' + (b === boro ? ' selected' : '') + '>' + esc(b) + '</option>';
      }).join('') + '</select></td>' +
      '<td><input type="tel" data-f="phone" placeholder="Phone number"></td>' +
      '<td><input type="number" data-f="age" min="14" max="30" placeholder="Age"></td>' +
      '<td class="right"><button type="button" class="btn sm ghost" data-rm title="Clear this row">✕</button></td>' +
    '</tr>';
  }

  function pgridHTML(id, opts) {
    opts = opts || {};
    return '<div class="tbl-wrap"><table class="tbl entry" id="' + esc(id) + '"><thead><tr>' +
        '<th>Application ID</th><th>Last Name</th><th>First Name</th><th>Program</th>' +
        '<th>Borough</th><th>Phone</th><th>Age</th><th></th>' +
      '</tr></thead><tbody>' + prow(opts.borough) + '</tbody></table></div>' +
      '<div class="row mt-2">' +
        '<button type="button" class="btn sm" data-pgadd="' + esc(id) + '">+ Add another row</button>' +
        '<span class="hint" style="margin:0">Pasting a tab- or comma-separated row into the ' +
          'Application ID box fills the whole row — paste several lines and it makes the rows for you.</span>' +
      '</div>';
  }

  /* opts.borough is a function so the grid can follow a borough picker that
     lives in the surrounding form and may still change. */
  function pgridWire(root, id, opts) {
    opts = opts || {};
    var body = $('#' + id + ' tbody', root);
    function boro() { return (opts.borough && opts.borough()) || G.BOROUGHS[0]; }

    $('[data-pgadd="' + id + '"]', root).addEventListener('click', function () {
      body.insertAdjacentHTML('beforeend', prow(boro()));
      body.lastElementChild.querySelector('input').focus();
    });

    /* ✕ removes the row, except on the last one — that just empties it, so
       the table is never left with nothing to type into. */
    body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rm]');
      if (!btn) return;
      var tr = btn.closest('tr');
      if (body.children.length > 1) { tr.remove(); return; }
      P_FIELDS.forEach(function (f) {
        pcell(tr, f).value = f === 'program' ? 'Lottery' : f === 'borough' ? boro() : '';
      });
      pcell(tr, 'last').classList.remove('miss');
      delete pcell(tr, 'borough').dataset.set;
    });

    /* A borough the monitor picked stays picked; untouched ones follow the
       site's borough if that changes underneath them. */
    body.addEventListener('change', function (e) {
      if (e.target.dataset && e.target.dataset.f === 'borough') e.target.dataset.set = '1';
    });

    body.addEventListener('paste', function (e) {
      var input = e.target;
      if (!input.dataset || input.dataset.f !== 'appId') return;
      var text = ((e.clipboardData || window.clipboardData).getData('text') || '');
      if (!/[\t,\n]/.test(text)) return;
      e.preventDefault();

      var tr = input.closest('tr');
      text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean)
        .forEach(function (line, i) {
          if (i) {
            tr.insertAdjacentHTML('afterend', prow(boro()));
            tr = tr.nextElementSibling;
          }
          var parts = line.split(/\t|,/);
          P_FIELDS.forEach(function (f, ix) {
            var v = (parts[ix] || '').trim();
            if (!v) return;
            if (f === 'borough') {
              var m = G.BOROUGHS.filter(function (b) { return b.toLowerCase() === v.toLowerCase(); })[0];
              if (m) { pcell(tr, f).value = m; pcell(tr, f).dataset.set = '1'; }
            } else {
              pcell(tr, f).value = v;
            }
          });
        });
    });

    return {
      syncBorough: function () {
        $$('[data-f="borough"]', body).forEach(function (s) {
          if (!s.dataset.set) s.value = boro();
        });
      }
    };
  }

  /* -> { made: [participant], incomplete: n }. Rows nobody touched are
     ignored; a row with data but no last name is flagged and counted. */
  function pgridRead(root, id) {
    var made = [], incomplete = 0;

    $$('#' + id + ' tbody tr', root).forEach(function (tr) {
      var v = {};
      P_FIELDS.forEach(function (f) { v[f] = pcell(tr, f).value.trim(); });
      pcell(tr, 'last').classList.remove('miss');

      /* Program and Borough are pre-filled, so they do not count as touched. */
      var touched = ['appId', 'last', 'first', 'phone', 'age'].some(function (f) { return v[f]; });
      if (!touched) return;
      if (!v.last) { pcell(tr, 'last').classList.add('miss'); incomplete++; return; }

      made.push({
        id: G.uid('p'),
        appId: v.appId, last: v.last, first: v.first,
        program: v.program || 'Lottery', borough: v.borough || G.BOROUGHS[0],
        phone: v.phone, age: v.age ? +v.age : null, dob: '',
        specialProject: 'None', accepted: 'No',
        cohort: G.PROGRAM.cohort, serviceOption: G.PROGRAM.serviceOption,
        status: 'Active',
        docs: { referral: false, week3: false, week6: false, childcare: false },
        forms: {}
      });
    });

    return { made: made, incomplete: incomplete };
  }

  /* ---- toasts ---------------------------------------------------------- */

  function toast(msg, kind) {
    var host = $('#toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  }

  /* ---- modal ------------------------------------------------------------
     modal({ title, body, okText, wide, onOk })  ->  onOk(rootEl) returns
     false to keep the dialog open (e.g. validation failed).               */

  function modal(opts) {
    var bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-h"><h2>' + esc(opts.title) + '</h2></div>' +
        '<div class="modal-b">' + opts.body + '</div>' +
        '<div class="modal-f">' +
          '<button class="btn" data-x>Cancel</button>' +
          (opts.okText === null ? '' : '<button class="btn primary" data-ok>' + esc(opts.okText || 'Save') + '</button>') +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);

    function close() { bg.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    $('[data-x]', bg).addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    var ok = $('[data-ok]', bg);
    if (ok) {
      ok.addEventListener('click', function () {
        if (opts.onOk && opts.onOk(bg) === false) return;
        close();
      });
    }
    var first = bg.querySelector('input, select, textarea');
    if (first) first.focus();

    bg.close = close;
    return bg;
  }

  function confirmBox(title, message, okText, onOk) {
    modal({
      title: title,
      body: '<p class="mb-0">' + esc(message) + '</p>',
      okText: okText || 'Confirm',
      onOk: function () { onOk(); }
    });
  }

  /* ---- signature pad ----------------------------------------------------
     Draws on a canvas; also accepts a typed name as a fallback so the demo
     works on a laptop without a touchscreen. Value is either
     "typed:Some Name" or a data: URL.                                     */

  function signaturePad(host, opts) {
    opts = opts || {};
    host.innerHTML =
      '<div class="sigbox"><canvas></canvas><div class="ph">Sign here — draw with your mouse or finger</div></div>' +
      '<div class="sigline">' +
        '<span class="tiny muted">' + esc(opts.label || 'Signature') + '</span>' +
        '<span><button type="button" class="btn sm ghost" data-type>Type instead</button>' +
        '<button type="button" class="btn sm ghost" data-clear>Clear</button></span>' +
      '</div>';

    var box = $('.sigbox', host);
    var cv = $('canvas', box);
    var ctx = cv.getContext('2d');
    var drawing = false, dirty = false, typed = null;

    function size() {
      var r = cv.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var data = dirty ? cv.toDataURL() : null;
      cv.width = Math.max(1, r.width * dpr);
      cv.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#14161c';
      if (data) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, 0, 0, r.width, r.height); };
        img.src = data;
      }
    }
    setTimeout(size, 0);
    window.addEventListener('resize', size);

    function pos(e) {
      var r = cv.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function start(e) { e.preventDefault(); drawing = true; typed = null; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.lineTo(p.x, p.y); ctx.stroke();
      dirty = true; box.classList.add('signed');
    }
    function end() { drawing = false; }

    cv.addEventListener('mousedown', start);
    cv.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', end);

    function clear() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      dirty = false; typed = null;
      box.classList.remove('signed');
      $('.ph', box).textContent = 'Sign here — draw with your mouse or finger';
    }
    $('[data-clear]', host).addEventListener('click', clear);

    $('[data-type]', host).addEventListener('click', function () {
      modal({
        title: 'Type your name as signature',
        body: '<div class="field"><label>Full legal name</label>' +
              '<input type="text" id="typedname" placeholder="Your full legal name" value="' + esc(opts.defaultName || '') + '"></div>' +
              '<p class="hint mb-0">Typing your name counts as an electronic signature on this form.</p>',
        okText: 'Apply',
        onOk: function (root) {
          var v = $('#typedname', root).value.trim();
          if (!v) return false;
          clear();
          typed = v;
          dirty = true;
          box.classList.add('signed');
          var r = cv.getBoundingClientRect();
          ctx.font = 'italic 30px Georgia, serif';
          ctx.fillStyle = '#14161c';
          ctx.textBaseline = 'middle';
          ctx.fillText(v, 16, r.height / 2);
        }
      });
    });

    return {
      value: function () {
        if (typed) return 'typed:' + typed;
        return dirty ? cv.toDataURL('image/png') : '';
      },
      isSigned: function () { return dirty; },
      set: function (v) {
        if (!v) return;
        if (v.indexOf('typed:') === 0) {
          typed = v.slice(6); dirty = true; box.classList.add('signed');
          setTimeout(function () {
            var r = cv.getBoundingClientRect();
            ctx.font = 'italic 30px Georgia, serif';
            ctx.fillStyle = '#14161c';
            ctx.textBaseline = 'middle';
            ctx.fillText(typed, 16, r.height / 2);
          }, 30);
        } else {
          var img = new Image();
          img.onload = function () {
            var r = cv.getBoundingClientRect();
            ctx.drawImage(img, 0, 0, r.width, r.height);
          };
          img.src = v;
          dirty = true; box.classList.add('signed');
        }
      },
      clear: clear
    };
  }

  /* Render a stored signature value read-only. */
  function sigView(v) {
    if (!v) return '<span class="muted">Not signed</span>';
    if (v.indexOf('typed:') === 0) {
      return '<span style="font:italic 22px Georgia,serif">' + esc(v.slice(6)) + '</span>';
    }
    return '<img src="' + esc(v) + '" alt="signature" style="max-height:60px">';
  }

  G.$ = $; G.$$ = $$; G.esc = esc; G.param = param;
  G.requireAuth = requireAuth; G.renderHeader = renderHeader;
  G.toast = toast; G.modal = modal; G.confirmBox = confirmBox;
  G.signaturePad = signaturePad; G.sigView = sigView;
  G.timeSelect = timeSelect; G.triState = triState; G.pickTwo = pickTwo;
  G.pgridHTML = pgridHTML; G.pgridWire = pgridWire; G.pgridRead = pgridRead;
  G.box = box; G.boxLabel = boxLabel;
})(window.GRYC);
