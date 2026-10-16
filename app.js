(function () {
  'use strict';
  var KEY = 'caseperfect.cases.v1';

  var HIGH_RISK_COUNTRIES = ['iran', 'north korea', 'myanmar', 'syria', 'afghanistan', 'yemen', 'russia', 'belarus', 'cuba'];

  var STAGES = [
    { id: 'intake', title: 'Intake & scoping', tasks: [
      ['Case reference and trigger recorded', true],
      ['Customer data and relationship purpose captured', true],
      ['Expected activity / source of funds summary documented', true]] },
    { id: 'cdd', title: 'Customer due diligence (ID&V)', tasks: [
      ['Identity document collected and verified', true],
      ['Address verified', true],
      ['Date of birth / registration number verified', true],
      ['Ultimate beneficial owners identified (≥25%) – entities only', false, 'entity'],
      ['Directors and authorised signatories verified – entities only', false, 'entity'],
      ['Ownership / control structure chart obtained – entities only', false, 'entity']] },
    { id: 'screening', title: 'Screening', tasks: [
      ['Sanctions screening completed and hits dispositioned', true],
      ['PEP screening completed and hits dispositioned', true],
      ['Adverse media search completed', true],
      ['Screening of related parties (UBOs, directors) completed', false]],
      flags: [['sanctionsHit', 'Confirmed sanctions match'], ['pep', 'Customer is a PEP / PEP-related'], ['adverseMedia', 'Relevant adverse media found']] },
    { id: 'risk', title: 'Risk assessment', custom: 'risk', tasks: [
      ['Customer, geographic, product and channel risk scored', true],
      ['Risk rating and rationale documented', true]] },
    { id: 'edd', title: 'Enhanced due diligence', conditional: 'high', tasks: [
      ['Source of wealth established and corroborated', true],
      ['Source of funds verified with evidence', true],
      ['Senior management sign-off on relationship obtained', true],
      ['Enhanced ongoing monitoring defined', true]] },
    { id: 'decision', title: 'Decision & approval', custom: 'decision', tasks: [
      ['Case file reviewed by second line / QC', true],
      ['Decision rationale documented', true]] },
    { id: 'closure', title: 'Closure & ongoing monitoring', tasks: [
      ['Customer risk rating and next review date set in system', true],
      ['Suspicious activity assessment done (SAR/STR filed if required)', true],
      ['Records archived per retention policy', true]] }
  ];

  var RISK_FACTORS = [
    ['customer', 'Customer risk'], ['geography', 'Geographic risk'],
    ['product', 'Product / service risk'], ['channel', 'Delivery channel risk']
  ];

  var cases = load();
  var selectedId = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(cases)); }
  function uid() { return 'C-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 36).toString(36).toUpperCase(); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function now() { return new Date().toISOString(); }
  function fmt(t) { return new Date(t).toLocaleString(); }

  function log(c, msg) { c.log.unshift({ t: now(), msg: msg }); }

  function newCase(d) {
    var c = {
      id: uid(), name: d.name, type: d.type, country: d.country, trigger: d.trigger,
      analyst: d.analyst, created: now(), status: 'open', outcome: '',
      checks: {}, notes: {}, flags: {}, scores: { customer: 1, geography: 1, product: 1, channel: 1 },
      riskOverride: '', decision: '', stageDone: {}, log: []
    };
    if (HIGH_RISK_COUNTRIES.indexOf(String(d.country).trim().toLowerCase()) >= 0) c.scores.geography = 3;
    log(c, 'Case created (' + d.trigger + ')');
    return c;
  }

  // ---- derived state ----
  function riskScore(c) {
    var s = 0; RISK_FACTORS.forEach(function (f) { s += +c.scores[f[0]]; });
    return s;
  }
  function riskRating(c) {
    if (c.riskOverride) return c.riskOverride;
    if (c.flags.sanctionsHit || c.flags.pep) return 'high';
    var s = riskScore(c);
    if (s >= 9) return 'high';
    if (s >= 6) return 'medium';
    return 'low';
  }
  function stageApplies(c, st) {
    if (st.conditional === 'high') return riskRating(c) === 'high';
    return true;
  }
  function stageTasks(c, st) {
    return st.tasks.map(function (t, i) { return { i: i, label: t[0], req: t[1], only: t[2] }; })
      .filter(function (t) { return !t.only || t.only === c.type; });
  }
  function missing(c, st) {
    var m = stageTasks(c, st).filter(function (t) { return t.req && !c.checks[st.id + ':' + t.i]; })
      .map(function (t) { return t.label; });
    if (st.id === 'decision' && !c.decision) m.push('Select a decision');
    if (st.id === 'decision' && c.decision && !(c.notes.decision || '').trim()) m.push('Decision notes');
    return m;
  }
  function activeStages(c) { return STAGES.filter(function (s) { return stageApplies(c, s); }); }
  function currentStage(c) {
    var a = activeStages(c);
    for (var i = 0; i < a.length; i++) if (!c.stageDone[a[i].id]) return a[i];
    return null;
  }
  function progress(c) {
    var a = activeStages(c), d = a.filter(function (s) { return c.stageDone[s.id]; }).length;
    return Math.round(100 * d / a.length);
  }

  // ---- rendering ----
  function renderList() {
    var h = cases.length ? '' : '<p class="empty">No cases yet.</p>';
    cases.forEach(function (c) {
      h += '<button class="case-item' + (c.id === selectedId ? ' active' : '') + '" data-id="' + esc(c.id) + '">' +
        '<strong>' + esc(c.name) + '</strong> <span class="badge ' + esc(c.status) + '">' + esc(c.status) + '</span>' +
        '<small>' + esc(c.id) + ' · ' + progress(c) + '% · risk ' + riskRating(c) + '</small></button>';
    });
    el('case-list').innerHTML = h;
  }

  function renderStage(c, st, cur) {
    var h = '<div class="stage"><h3>' + esc(st.title) + '</h3>';
    stageTasks(c, st).forEach(function (t) {
      var k = st.id + ':' + t.i;
      h += '<div class="task"><input type="checkbox" id="' + k + '" data-check="' + k + '"' + (c.checks[k] ? ' checked' : '') + '>' +
        '<label for="' + k + '">' + esc(t.label) + (t.req ? ' <em>*</em>' : '') + '</label></div>';
    });
    (st.flags || []).forEach(function (f) {
      h += '<div class="task"><input type="checkbox" id="f-' + f[0] + '" data-flag="' + f[0] + '"' + (c.flags[f[0]] ? ' checked' : '') + '>' +
        '<label for="f-' + f[0] + '">' + esc(f[1]) + '</label></div>';
    });
    if (st.custom === 'risk') {
      h += '<div class="score">';
      RISK_FACTORS.forEach(function (f) {
        h += '<label>' + f[1] + '<select data-score="' + f[0] + '">' + [[1, 'Low'], [2, 'Medium'], [3, 'High']].map(function (o) {
          return '<option value="' + o[0] + '"' + (+c.scores[f[0]] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></label>';
      });
      h += '</div><p>Calculated score <strong>' + riskScore(c) + '/12</strong> → rating <span class="badge ' + riskRating(c) + '">' + riskRating(c) + '</span>' +
        (c.flags.sanctionsHit || c.flags.pep ? ' (sanctions/PEP forces high)' : '') + '</p>' +
        '<label>Manual override (requires notes)<select data-override><option value="">None</option>' +
        ['low', 'medium', 'high'].map(function (r) { return '<option' + (c.riskOverride === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></label>';
      if (riskRating(c) === 'high') h += '<div class="warn">High risk: Enhanced due diligence stage is required.</div>';
    }
    if (st.custom === 'decision') {
      if (c.flags.sanctionsHit) h += '<div class="warn">Confirmed sanctions match: onboarding should be rejected and escalated per policy.</div>';
      h += '<label>Decision<select data-decision><option value="">Select…</option>' +
        [['approved', 'Approve / retain relationship'], ['rejected', 'Reject onboarding'], ['exited', 'Exit relationship']].map(function (o) {
          return '<option value="' + o[0] + '"' + (c.decision === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></label>';
    }
    h += '<label>Notes' + (st.id === 'decision' ? ' / rationale' : '') + '<textarea rows="3" data-note="' + st.id + '">' + esc(c.notes[st.id] || '') + '</textarea></label>';
    if (c.stageDone[st.id]) {
      h += '<div class="row"><span class="badge approved">Completed</span><button data-reopen="' + st.id + '">Reopen</button></div>';
    } else if (cur && cur.id === st.id) {
      var m = missing(c, st);
      h += (m.length ? '<div class="warn">Outstanding: ' + m.map(esc).join('; ') + '</div>' : '') +
        '<div class="row"><button class="primary" data-complete="' + st.id + '"' + (m.length ? ' disabled' : '') + '>Complete stage</button></div>';
    }
    return h + '</div>';
  }

  function renderCase() {
    var c = cases.filter(function (x) { return x.id === selectedId; })[0];
    var v = el('case-view');
    if (!c) { v.innerHTML = '<p class="empty">Select a case or create a new one.</p>'; return; }
    var cur = currentStage(c), act = activeStages(c);
    var h = '<div class="head"><div><h2>' + esc(c.name) + ' <span class="badge ' + esc(c.status) + '">' + esc(c.status) + '</span> ' +
      '<span class="badge ' + riskRating(c) + '">' + riskRating(c) + ' risk</span></h2>' +
      '<div class="meta">' + esc(c.id) + ' · ' + esc(c.type) + ' · ' + esc(c.country) + ' · ' + esc(c.trigger) + ' · analyst: ' + esc(c.analyst || '—') + ' · opened ' + fmt(c.created) + '</div></div>' +
      '<div><button data-export-case>Export</button> <button class="danger" data-delete>Delete</button></div></div>' +
      '<div class="progress"><div style="width:' + progress(c) + '%"></div></div><div class="stepper">';
    STAGES.forEach(function (s) {
      var cls = !stageApplies(c, s) ? 'skipped' : c.stageDone[s.id] ? 'done' : (cur && cur.id === s.id) ? 'current' : 'locked';
      h += '<div class="step ' + cls + '">' + esc(s.title) + (cls === 'skipped' ? ' (n/a)' : '') + '</div>';
    });
    h += '</div>';
    if (!cur) h += '<div class="warn">All stages complete. Outcome: <strong>' + esc(c.decision) + '</strong>.</div>';
    // show completed stages and the current one; hide future stages
    act.forEach(function (s) {
      if (c.stageDone[s.id] || (cur && cur.id === s.id)) h += renderStage(c, s, cur);
    });
    h += '<h3>Audit log</h3><div class="log">' + c.log.map(function (l) { return '<div>' + fmt(l.t) + ' – ' + esc(l.msg) + '</div>'; }).join('') + '</div>';
    v.innerHTML = h;
  }

  function render() { renderList(); renderCase(); }

  function selected() { return cases.filter(function (x) { return x.id === selectedId; })[0]; }
  function stageById(id) { return STAGES.filter(function (s) { return s.id === id; })[0]; }

  function download(name, data) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  // ---- events ----
  el('case-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]');
    if (b) { selectedId = b.getAttribute('data-id'); render(); }
  });

  var view = el('case-view');
  view.addEventListener('change', function (e) {
    var c = selected(), t = e.target; if (!c) return;
    if (t.dataset.check) {
      c.checks[t.dataset.check] = t.checked;
      log(c, (t.checked ? 'Checked: ' : 'Unchecked: ') + t.nextElementSibling.textContent.replace(/\s*\*$/, ''));
    } else if (t.dataset.flag) {
      c.flags[t.dataset.flag] = t.checked;
      log(c, 'Flag ' + t.dataset.flag + ' set to ' + t.checked);
    } else if (t.dataset.score) {
      c.scores[t.dataset.score] = +t.value; log(c, 'Risk factor ' + t.dataset.score + ' set to ' + t.value);
    } else if (t.hasAttribute('data-override')) {
      c.riskOverride = t.value; log(c, 'Risk override: ' + (t.value || 'none'));
    } else if (t.hasAttribute('data-decision')) {
      c.decision = t.value; log(c, 'Decision selected: ' + (t.value || 'none'));
    } else if (t.dataset.note) {
      c.notes[t.dataset.note] = t.value;
    } else return;
    save(); render();
  });

  view.addEventListener('click', function (e) {
    var c = selected(), t = e.target; if (!c) return;
    if (t.dataset.complete) {
      var st = stageById(t.dataset.complete);
      if (missing(c, st).length) return;
      if (st.id === 'risk' && c.riskOverride && !(c.notes.risk || '').trim()) { alert('Add notes justifying the risk override.'); return; }
      c.stageDone[st.id] = true; log(c, 'Stage completed: ' + st.title);
      if (!currentStage(c)) { c.status = c.decision; c.outcome = c.decision; log(c, 'Case closed: ' + c.decision); }
      save(); render();
    } else if (t.dataset.reopen) {
      // reopening a stage also reopens every later stage
      var idx = STAGES.map(function (s) { return s.id; }).indexOf(t.dataset.reopen);
      STAGES.slice(idx).forEach(function (s) { delete c.stageDone[s.id]; });
      c.status = 'open'; log(c, 'Stage reopened: ' + stageById(t.dataset.reopen).title);
      save(); render();
    } else if (t.hasAttribute('data-delete')) {
      if (confirm('Delete this case permanently?')) {
        cases = cases.filter(function (x) { return x !== c; }); selectedId = null; save(); render();
      }
    } else if (t.hasAttribute('data-export-case')) {
      download(c.id + '.json', [c]);
    }
  });

  var dlg = el('new-dialog');
  el('btn-new').addEventListener('click', function () { el('new-form').reset(); dlg.showModal(); });
  el('new-form').addEventListener('submit', function (e) {
    var submitter = e.submitter;
    if (submitter && submitter.value === 'cancel') return;
    var f = new FormData(el('new-form'));
    var c = newCase({ name: f.get('name').trim(), type: f.get('type'), country: f.get('country').trim(), trigger: f.get('trigger'), analyst: f.get('analyst').trim() });
    cases.unshift(c); selectedId = c.id; save(); render();
  });
  el('btn-export').addEventListener('click', function () { download('caseperfect-cases.json', cases); });
  el('btn-import').addEventListener('click', function () { el('file-import').click(); });
  el('file-import').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!Array.isArray(data)) throw new Error('not an array');
        data.forEach(function (d) {
          if (!d || !d.id || !d.name || !d.scores || !d.log) return;
          cases = cases.filter(function (x) { return x.id !== d.id; });
          cases.push(d);
        });
        save(); render();
      } catch (err) { alert('Invalid file: ' + err.message); }
    };
    r.readAsText(file); e.target.value = '';
  });

  render();
})();
