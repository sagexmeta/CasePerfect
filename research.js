(function () {
  'use strict';
  var KEY = 'caseperfect.research.v1';
  var state = load();
  var results = [];
  var dragId = null;

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.captures) && Array.isArray(s.canvas)) return s;
    } catch (e) {}
    return { captures: [], canvas: [] };
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function $(id) { return document.getElementById(id); }
  function uid() { return 'C-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function status(msg) { $('live-status').textContent = msg; }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : ''; }
  function byId(id) { return state.captures.filter(function (c) { return c.id === id; })[0]; }

  // ---------- navigation ----------
  var menuBtn = $('btn-advanced'), menu = $('adv-list');
  function toggleMenu(open) { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); }
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(menu.hidden); });
  document.addEventListener('click', function () { toggleMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleMenu(false); });
  $('btn-search').addEventListener('click', function () { show('search'); });
  $('btn-draft').addEventListener('click', function () { show('draft'); });

  function show(view) {
    toggleMenu(false);
    $('workflow-view').hidden = true;
    var rv = $('research-view');
    rv.hidden = false;
    rv.textContent = '';
    (view === 'search' ? renderSearch : renderDraft)(rv);
  }
  function closeBtn() {
    return h('button', { text: '← Back to workflows', onclick: function () { $('research-view').hidden = true; $('workflow-view').hidden = false; } });
  }

  // ---------- Search ----------
  function renderSearch(root) {
    var q = h('input', { id: 'r-query', placeholder: 'Person name, e.g. Ada Lovelace', 'aria-label': 'Person to research' });
    var form = h('form', { onsubmit: function (e) { e.preventDefault(); runSearch(q.value.trim()); } }, [
      h('div', { class: 'r-row' }, [q, h('button', { class: 'primary', text: 'Search' })])
    ]);
    root.appendChild(h('div', { class: 'r-row' }, [closeBtn(), h('h2', { text: 'Research: Search' })]));
    root.appendChild(h('p', { text: 'Searches public sources (Wikipedia, Wikidata-linked pages) for information about an individual. Capture passages to save them with their citation, or paste text from any other source.' }));
    root.appendChild(form);
    var grid = h('div', { class: 'r-grid' }, [
      h('div', {}, [h('h3', { text: 'Results' }), h('div', { id: 'r-results' })]),
      h('div', {}, [h('h3', { text: 'Captured (' + state.captures.length + ')' }), h('div', { id: 'r-captures' }), manualForm()])
    ]);
    root.appendChild(grid);
    drawResults(); drawCaptures();
  }

  function manualForm() {
    var t = h('textarea', { rows: '3', 'aria-label': 'Pasted text' });
    var title = h('input', { 'aria-label': 'Source title', placeholder: 'Source title' });
    var url = h('input', { 'aria-label': 'Source URL', placeholder: 'https://…' });
    return h('form', { class: 'r-card', onsubmit: function (e) {
      e.preventDefault();
      if (!t.value.trim() || !title.value.trim()) return;
      addCapture(t.value, title.value.trim(), url.value.trim());
      t.value = ''; title.value = ''; url.value = '';
    } }, [h('strong', { text: 'Capture from another source' }), t, title, url, h('button', { text: 'Capture' })]);
  }

  function runSearch(name) {
    var box = $('r-results');
    if (!name) return;
    box.textContent = 'Searching…';
    var api = 'https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=8&prop=extracts%7Cinfo&exintro=1&explaintext=1&exsentences=5&inprop=url&format=json&origin=*&gsrsearch=' + encodeURIComponent(name);
    fetch(api).then(function (r) { return r.json(); }).then(function (d) {
      var pages = d.query ? Object.keys(d.query.pages).map(function (k) { return d.query.pages[k]; }) : [];
      pages.sort(function (a, b) { return a.index - b.index; });
      results = pages.map(function (p) { return { title: p.title, text: p.extract || '', url: p.fullurl }; }).filter(function (r) { return r.text; });
      drawResults(results.length ? '' : 'No results found.');
      status(results.length + ' results');
    }).catch(function () { drawResults('Search failed. Check your connection, or capture text manually.'); });
  }

  function drawResults(msg) {
    var box = $('r-results'); if (!box) return;
    box.textContent = msg || '';
    results.forEach(function (r) {
      var sentences = r.text.match(/[^.!?]+[.!?]+(\s|$)/g) || [r.text];
      var card = h('div', { class: 'r-card' }, [h('strong', { text: r.title }), h('p', { text: r.text }),
        h('div', { class: 'r-cite' }, [h('a', { href: safeUrl(r.url), target: '_blank', rel: 'noopener noreferrer', text: r.url })])]);
      card.appendChild(h('button', { text: 'Capture all', onclick: function () { addCapture(r.text, r.title, r.url); } }));
      sentences.forEach(function (s) {
        card.appendChild(h('button', { text: 'Capture: “' + s.trim().slice(0, 40) + '…”', title: s.trim(), onclick: function () { addCapture(s, r.title, r.url); } }));
      });
      box.appendChild(card);
    });
  }

  function drawCaptures() {
    var box = $('r-captures'); if (!box) return;
    box.textContent = '';
    state.captures.forEach(function (c) {
      box.appendChild(h('div', { class: 'r-card' }, [h('p', { text: c.verbiage }),
        h('button', { text: 'Remove', onclick: function () {
          state.captures = state.captures.filter(function (x) { return x.id !== c.id; });
          state.canvas = state.canvas.filter(function (x) { return x !== c.id; });
          save(); drawCaptures();
        } })]));
    });
  }

  function accessed() { return new Date().toISOString().slice(0, 10); }
  function toVerbiage(text, title, url) {
    var t = text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    if (!/[.!?]$/.test(t)) t += '.';
    return t + ' (Source: ' + title + (safeUrl(url) ? ', ' + url : '') + ', accessed ' + accessed() + '.)';
  }
  function addCapture(text, title, url) {
    var c = { id: uid(), raw: text.trim(), title: title, url: url, verbiage: toVerbiage(text, title, url) };
    state.captures.push(c); save(); status('Captured from ' + title);
    var hd = document.querySelector('#r-captures'); if (hd) drawCaptures();
  }

  // ---------- Draft ----------
  function renderDraft(root) {
    root.appendChild(h('div', { class: 'r-row' }, [closeBtn(), h('h2', { text: 'Research: Draft' })]));
    var spell = h('button', { text: 'Spell/Grammar Check', onclick: runChecks });
    var analyze = h('button', { text: 'Analyze', onclick: function () { openAnalysis(); } });
    root.appendChild(h('div', { class: 'r-row' }, [spell, analyze]));
    root.appendChild(h('div', { id: 'r-issues' }));
    var avail = h('div', { id: 'r-avail' });
    var canvas = h('div', { id: 'r-canvas', class: 'r-canvas', 'aria-label': 'Draft canvas' });
    canvas.addEventListener('dragover', function (e) { e.preventDefault(); });
    canvas.addEventListener('drop', function (e) { e.preventDefault(); if (dragId) dropAt(dragId, null); });
    root.appendChild(h('div', { class: 'r-grid' }, [
      h('div', {}, [h('h3', { text: 'Captured information' }), avail]),
      h('div', {}, [h('h3', { text: 'Canvas (drag to reorder)' }), canvas])
    ]));
    root.appendChild(h('dialog', { id: 'r-dialog' }));
    drawDraft();
  }

  function dropAt(id, beforeId) {
    state.canvas = state.canvas.filter(function (x) { return x !== id; });
    var i = beforeId ? state.canvas.indexOf(beforeId) : -1;
    if (i < 0) state.canvas.push(id); else state.canvas.splice(i, 0, id);
    save(); drawDraft();
  }

  function drawDraft() {
    var avail = $('r-avail'), canvas = $('r-canvas');
    avail.textContent = ''; canvas.textContent = '';
    var any = false;
    state.captures.forEach(function (c) {
      if (state.canvas.indexOf(c.id) >= 0) return;
      any = true;
      var card = h('div', { class: 'r-card', draggable: 'true' }, [h('p', { text: c.verbiage }),
        h('button', { text: 'Add to canvas', onclick: function () { dropAt(c.id, null); } })]);
      card.addEventListener('dragstart', function () { dragId = c.id; });
      avail.appendChild(card);
    });
    if (!any) avail.textContent = state.captures.length ? 'All items are on the canvas.' : 'Nothing captured yet. Use Advanced Features → Search.';
    state.canvas.forEach(function (id, i) {
      var c = byId(id); if (!c) return;
      var ta = h('textarea', { rows: '4', 'aria-label': 'Paragraph ' + (i + 1) });
      ta.value = c.verbiage;
      ta.addEventListener('input', function () { c.verbiage = ta.value; save(); });
      var card = h('div', { class: 'r-card', draggable: 'true' }, [ta, h('div', { class: 'r-row' }, [
        h('button', { text: '↑', 'aria-label': 'Move up', onclick: function () { if (i > 0) { swap(i, i - 1); } } }),
        h('button', { text: '↓', 'aria-label': 'Move down', onclick: function () { if (i < state.canvas.length - 1) { swap(i, i + 1); } } }),
        h('button', { text: 'Remove from canvas', onclick: function () { state.canvas.splice(i, 1); save(); drawDraft(); } })])]);
      card.addEventListener('dragstart', function () { dragId = id; });
      card.addEventListener('dragover', function (e) { e.preventDefault(); card.classList.add('dragover'); });
      card.addEventListener('dragleave', function () { card.classList.remove('dragover'); });
      card.addEventListener('drop', function (e) { e.preventDefault(); e.stopPropagation(); if (dragId && dragId !== id) dropAt(dragId, id); });
      canvas.appendChild(card);
    });
  }
  function swap(a, b) { var t = state.canvas[a]; state.canvas[a] = state.canvas[b]; state.canvas[b] = t; save(); drawDraft(); }
  function draftText() {
    return state.canvas.map(function (id) { var c = byId(id); return c ? c.verbiage : ''; }).filter(Boolean).join('\n\n');
  }

  // ---------- Spell / grammar ----------
  var MISSPELL = { teh: 'the', recieve: 'receive', occured: 'occurred', occurence: 'occurrence', seperate: 'separate', definately: 'definitely', accomodate: 'accommodate', untill: 'until', wich: 'which', thier: 'their', becuase: 'because', beleive: 'believe', goverment: 'government', enviroment: 'environment', refered: 'referred', succesful: 'successful', adress: 'address', begining: 'beginning', calender: 'calendar', collegue: 'colleague', comming: 'coming', existance: 'existence', foriegn: 'foreign', freind: 'friend', happend: 'happened', independant: 'independent', neccessary: 'necessary', noticable: 'noticeable', occassion: 'occasion', priviledge: 'privilege', publically: 'publicly', recomend: 'recommend', relevent: 'relevant', tommorow: 'tomorrow', truely: 'truly', wierd: 'weird', alot: 'a lot', acheive: 'achieve', arguement: 'argument', concious: 'conscious', embarass: 'embarrass', guarentee: 'guarantee', judgement: 'judgment', knowlege: 'knowledge', mispell: 'misspell', persistant: 'persistent', responsability: 'responsibility', sucess: 'success', writting: 'writing' };
  function check(text) {
    var issues = [], m, re;
    re = /[A-Za-z']+/g;
    while ((m = re.exec(text))) {
      var fix = MISSPELL[m[0].toLowerCase()];
      if (fix) issues.push({ kind: 'Spelling', msg: '“' + m[0] + '” → “' + fix + '”', from: m[0], to: fix, pos: m.index });
    }
    re = /\b(\w+)\s+\1\b/gi;
    while ((m = re.exec(text))) if (!/^\d+$/.test(m[1])) issues.push({ kind: 'Grammar', msg: 'Repeated word “' + m[1] + '”', from: m[0], to: m[1], pos: m.index });
    re = /\b(a)\s+([aeiou]\w*)/gi;
    while ((m = re.exec(text))) if (!/^(uni|use|eu|one|ubi)/i.test(m[2])) issues.push({ kind: 'Grammar', msg: '“a ' + m[2] + '” → “an ' + m[2] + '”', from: m[0], to: (m[1] === 'A' ? 'An ' : 'an ') + m[2], pos: m.index });
    re = /\b(an)\s+([bcdfgjklmnpqrstvwxyz]\w*)/gi;
    while ((m = re.exec(text))) if (!/^(hour|honest|honor|heir)/i.test(m[2]) && !/^[A-Z]{2,}$/.test(m[2])) issues.push({ kind: 'Grammar', msg: '“an ' + m[2] + '” → “a ' + m[2] + '”', from: m[0], to: (m[1] === 'An' ? 'A ' : 'a ') + m[2], pos: m.index });
    re = /[ \t]{2,}/g;
    while ((m = re.exec(text))) issues.push({ kind: 'Grammar', msg: 'Multiple spaces', from: m[0], to: ' ', pos: m.index });
    re = /\s+([,.;:!?])/g;
    while ((m = re.exec(text))) issues.push({ kind: 'Grammar', msg: 'Space before punctuation', from: m[0], to: m[1], pos: m.index });
    re = /(^|[.!?]\s+)([a-z])/g;
    while ((m = re.exec(text))) issues.push({ kind: 'Grammar', msg: 'Sentence should start with a capital letter', from: m[0], to: m[1] + m[2].toUpperCase(), pos: m.index });
    re = /\b(they|we|you)\s+(was|is)\b/gi;
    while ((m = re.exec(text))) issues.push({ kind: 'Grammar', msg: 'Subject-verb agreement: “' + m[0] + '”', from: m[0], to: m[1] + (/^is$/i.test(m[2]) ? ' are' : ' were'), pos: m.index });
    re = /\b(he|she|it)\s+(are|were|have)\b/gi;
    while ((m = re.exec(text))) issues.push({ kind: 'Grammar', msg: 'Subject-verb agreement: “' + m[0] + '”', from: m[0], to: m[1] + ({ are: ' is', were: ' was', have: ' has' })[m[2].toLowerCase()], pos: m.index });
    return issues;
  }
  function runChecks() {
    var box = $('r-issues'); box.textContent = '';
    var total = 0;
    state.canvas.forEach(function (id, i) {
      var c = byId(id); if (!c) return;
      check(c.verbiage).forEach(function (is) {
        total++;
        box.appendChild(h('div', { class: 'r-issue' }, [
          h('span', { text: 'Paragraph ' + (i + 1) + ' · ' + is.kind + ': ' + is.msg + ' ' }),
          h('button', { text: 'Fix', onclick: function () { c.verbiage = c.verbiage.replace(is.from, is.to); save(); drawDraft(); runChecks(); } })]));
      });
    });
    if (!state.canvas.length) box.textContent = 'Add items to the canvas first.';
    else if (!total) box.textContent = 'No spelling or grammar issues found.';
    status(total + ' issues found');
  }

  // ---------- Advanced Analysis ----------
  var POS = 'good great excellent positive happy joy love wonderful success successful benefit improve best strong pleased proud'.split(' ');
  var NEG = 'bad poor terrible negative sad hate fail failure failed problem worse worst weak angry loss crime fraud violation harm damage'.split(' ');
  var EMO = {
    joy: 'happy joy delighted glad pleased celebrate proud', anger: 'angry furious outrage hate resent rage',
    frustration: 'frustrated annoying unfortunately again still delay delayed', urgency: 'urgent immediately asap deadline critical now promptly',
    confusion: 'confused unclear unsure uncertain ambiguous perhaps', fear: 'afraid fear worried threat risk danger', sadness: 'sad loss grief mourn regret'
  };
  var STOP = new Set('the a an and or of to in on for with is was are were be been by at as that this it from his her their its but not have has had which who will would can could may than then also into over after before'.split(' '));
  function words(t) { return (t.toLowerCase().match(/[a-z']+/g) || []); }
  function sentences(t) { return (t.match(/[^.!?]+[.!?]*/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }
  function count(ws, list) { var s = new Set(list); return ws.filter(function (w) { return s.has(w); }).length; }
  function syll(w) { var m = w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g); return Math.max(1, m ? m.length : 1); }
  function entities(t) {
    var out = {};
    (t.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []).forEach(function (e) { out[e] = (out[e] || 0) + 1; });
    return out;
  }
  function bars(obj) {
    var max = Math.max.apply(null, Object.keys(obj).map(function (k) { return obj[k]; }).concat([1]));
    var frag = h('div');
    Object.keys(obj).forEach(function (k) {
      frag.appendChild(h('div', {}, [h('span', { text: k + ': ' + obj[k] }), h('div', { class: 'r-bar' }, [h('span', { style: 'width:' + Math.round(obj[k] / max * 100) + '%' })])]));
    });
    return frag;
  }
  function pre(s) { return h('div', { class: 'r-result', text: s }); }

  var ANALYSES = [
    ['Sentiment and Emotion Analysis', [
      ['Polarity Detection', function (t) { var w = words(t), p = count(w, POS), n = count(w, NEG); return pre('Positive cues: ' + p + '\nNegative cues: ' + n + '\nPolarity: ' + (p > n ? 'Positive' : n > p ? 'Negative' : 'Neutral')); }],
      ['Fine-Grained Emotion Mining', function (t) { var w = words(t), o = {}; Object.keys(EMO).forEach(function (k) { o[k] = count(w, EMO[k].split(' ')); }); return bars(o); }],
      ['Tone and Intent Classification', function (t) {
        var w = words(t), s = sentences(t), tone = [];
        if (!/\b(i|you|we|my|our)\b/i.test(t) && !/!/.test(t)) tone.push('objective');
        if (count(w, ['therefore', 'furthermore', 'pursuant', 'accordingly', 'moreover', 'regarding']) || !/\b\w+'\w+\b/.test(t)) tone.push('formal');
        if (count(w, ['should', 'must', 'clearly', 'obviously', 'ensure']) ) tone.push('persuasive');
        if (count(w, ['understand', 'sorry', 'concern', 'support', 'hardship']) ) tone.push('empathetic');
        var intent = /\?/.test(t) ? 'inquire' : count(w, ['request', 'please', 'require', 'must', 'should']) ? 'request action' : count(w, NEG) > count(w, POS) ? 'complain' : count(w, POS) ? 'praise' : 'inform';
        return pre('Tone: ' + (tone.join(', ') || 'neutral') + '\nLikely intent: ' + intent + '\nSentences analysed: ' + s.length);
      }]]],
    ['Thematic and Content Analysis', [
      ['Thematic Coding & Extraction', function (t) { var f = {}; words(t).forEach(function (w) { if (w.length > 4 && !STOP.has(w)) f[w] = (f[w] || 0) + 1; }); var top = Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, 8), o = {}; top.forEach(function (k) { o[k] = f[k]; }); return bars(o); }],
      ['Automated Summarization', function (t) {
        var s = sentences(t), f = {}; words(t).forEach(function (w) { if (!STOP.has(w)) f[w] = (f[w] || 0) + 1; });
        var scored = s.map(function (x, i) { var ws = words(x); return { x: x, i: i, v: ws.reduce(function (a, w) { return a + (f[w] || 0); }, 0) / (ws.length || 1) }; });
        var pick = scored.sort(function (a, b) { return b.v - a.v; }).slice(0, Math.min(3, s.length)).sort(function (a, b) { return a.i - b.i; });
        return pre(pick.map(function (p) { return '• ' + p.x; }).join('\n'));
      }],
      ['Keyword and Entity Extraction', function (t) {
        var e = entities(t), f = {}; words(t).forEach(function (w) { if (w.length > 5 && !STOP.has(w)) f[w] = (f[w] || 0) + 1; });
        var kw = Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, 10);
        var dates = t.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [];
        return pre('Named entities: ' + (Object.keys(e).join('; ') || 'none') + '\nKeywords: ' + kw.join(', ') + '\nYears: ' + (dates.join(', ') || 'none'));
      }]]],
    ['Discourse and Stylistic Analysis', [
      ['Stylometry and Authorship Attribution', function (t) {
        var w = words(t), s = sentences(t), u = new Set(w);
        return pre('Words: ' + w.length + '\nVocabulary richness (type/token): ' + (w.length ? (u.size / w.length).toFixed(2) : 0) + '\nAvg sentence length: ' + (s.length ? (w.length / s.length).toFixed(1) : 0) + ' words\nAvg word length: ' + (w.length ? (w.join('').length / w.length).toFixed(1) : 0) + '\nCommas per sentence: ' + (s.length ? ((t.match(/,/g) || []).length / s.length).toFixed(2) : 0) + '\nSemicolons: ' + (t.match(/;/g) || []).length);
      }],
      ['Rhetorical and Argument Mapping', function (t) {
        var ws = words(t), claims = sentences(t).filter(function (s) { return /\b(therefore|thus|hence|should|must|clearly)\b/i.test(s); });
        var ev = sentences(t).filter(function (s) { return /\b(source|according|study|report|\d{4})\b/i.test(s); });
        var fal = [];
        if (/\b(everyone|nobody|always|never)\b/i.test(t)) fal.push('possible overgeneralization');
        if (/\b(obviously|clearly|undeniably)\b/i.test(t)) fal.push('assertion without support');
        if (/\b(either|only two)\b/i.test(t)) fal.push('possible false dilemma');
        return pre('Claims/conclusions: ' + claims.length + '\nEvidence statements: ' + ev.length + '\nPotential weaknesses: ' + (fal.join(', ') || 'none detected') + '\nStrength estimate: ' + (ev.length >= claims.length ? 'Supported' : 'Needs more evidence') + '\nWord count: ' + ws.length);
      }],
      ['Complexity and Readability Assessment', function (t) {
        var w = t.match(/[A-Za-z']+/g) || [], s = sentences(t);
        if (!w.length || !s.length) return pre('Not enough text.');
        var sy = w.reduce(function (a, x) { return a + syll(x); }, 0);
        var fre = 206.835 - 1.015 * (w.length / s.length) - 84.6 * (sy / w.length);
        var fk = 0.39 * (w.length / s.length) + 11.8 * (sy / w.length) - 15.59;
        return pre('Flesch reading ease: ' + fre.toFixed(1) + '\nFlesch-Kincaid grade level: ' + fk.toFixed(1) + '\nLong sentences (>30 words): ' + s.filter(function (x) { return words(x).length > 30; }).length);
      }]]],
    ['Comparative and Relationship Analysis', [
      ['Cross-Document Comparison', function (t) {
        var paras = t.split(/\n{2,}/).filter(Boolean);
        if (paras.length < 2) return pre('Need at least two paragraphs on the canvas.');
        var out = [];
        for (var i = 0; i < paras.length; i++) for (var j = i + 1; j < paras.length; j++) {
          var a = new Set(words(paras[i]).filter(function (w) { return !STOP.has(w); })), b = words(paras[j]).filter(function (w) { return !STOP.has(w); });
          var inter = b.filter(function (w) { return a.has(w); }), uni = new Set(Array.from(a).concat(b));
          var ya = paras[i].match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [], yb = paras[j].match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) || [];
          var note = ya.length && yb.length && !ya.some(function (y) { return yb.indexOf(y) >= 0; }) ? ' (different dates: ' + ya.join(',') + ' vs ' + yb.join(',') + ' — verify for contradictions)' : '';
          out.push('Paragraph ' + (i + 1) + ' vs ' + (j + 1) + ': similarity ' + (uni.size ? (new Set(inter).size / uni.size * 100).toFixed(0) : 0) + '%' + note);
        }
        return pre(out.join('\n'));
      }],
      ['Alignment & Gap Analysis', null]]]
  ];

  function openAnalysis() {
    var d = $('r-dialog'); d.textContent = '';
    var out = h('div', { id: 'r-out', 'aria-live': 'polite' });
    d.appendChild(h('h2', { text: 'Advanced Analysis' }));
    ANALYSES.forEach(function (cat) {
      d.appendChild(h('h3', { text: cat[0] }));
      var row = h('div', { class: 'r-row' });
      cat[1].forEach(function (a) {
        if (!a[1]) { row.appendChild(h('button', { text: a[0], onclick: function () { gapUI(out); } })); return; }
        row.appendChild(h('button', { text: a[0], onclick: function () {
          var t = draftText(); out.textContent = '';
          if (!t.trim()) { out.textContent = 'The canvas is empty.'; return; }
          out.appendChild(h('h4', { text: a[0] })); out.appendChild(a[1](t));
        } }));
      });
      d.appendChild(row);
    });
    d.appendChild(out);
    d.appendChild(h('div', { class: 'r-row' }, [h('button', { text: 'Close', onclick: function () { d.close(); } })]));
    d.showModal();
  }
  function gapUI(out) {
    out.textContent = '';
    var ta = h('textarea', { rows: '4', 'aria-label': 'Requirements, one per line', placeholder: 'One requirement per line, e.g. education history' });
    out.appendChild(h('h4', { text: 'Alignment & Gap Analysis' }));
    var res = h('div');
    out.appendChild(ta);
    out.appendChild(h('button', { text: 'Check', onclick: function () {
      var t = words(draftText()), set = new Set(t);
      res.textContent = '';
      ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (r) {
        var kw = words(r).filter(function (w) { return !STOP.has(w); }), hit = kw.filter(function (w) { return set.has(w); });
        var ratio = kw.length ? hit.length / kw.length : 0;
        res.appendChild(h('div', { class: ratio >= 0.6 ? '' : 'r-issue', text: (ratio >= 0.6 ? '✔ Addressed: ' : ratio > 0 ? '◐ Partially addressed: ' : '✖ Missing: ') + r }));
      });
    } }));
    out.appendChild(res);
  }
})();
