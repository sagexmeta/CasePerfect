(function () {
  'use strict';

  var KEY = 'caseperfect.research.v2';
  var state = load();
  var dragId = null;
  var currentView = 'search';
  var ui = {
    openCreateMenuCardId: '',
    openAddMenuCardId: '',
    pendingCardId: '',
    loading: false,
    focusingCardId: '',
    error: ''
  };
  var MODELS = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini'];
  var TOOL_TYPES = ['web_search', 'web_search_preview'];

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (!s || typeof s !== 'object') throw new Error('bad state');
      return {
        captures: Array.isArray(s.captures) ? s.captures : [],
        canvas: Array.isArray(s.canvas) ? s.canvas : [],
        documents: Array.isArray(s.documents) ? s.documents.map(normalizeDocument).filter(Boolean) : [],
        results: Array.isArray(s.results) ? s.results.map(normalizeCard).filter(Boolean) : [],
        focusResults: Array.isArray(s.focusResults) ? s.focusResults.map(normalizeCard).filter(Boolean) : [],
        lastQuery: String(s.lastQuery || ''),
        focusQuery: String(s.focusQuery || ''),
        lastSummary: String(s.lastSummary || ''),
        focusSummary: String(s.focusSummary || ''),
        settings: normalizeSettings(s.settings)
      };
    } catch (e) {}
    return {
      captures: [],
      canvas: [],
      documents: [],
      results: [],
      focusResults: [],
      lastQuery: '',
      focusQuery: '',
      lastSummary: '',
      focusSummary: '',
      settings: normalizeSettings(null)
    };
  }

  function normalizeSettings(input) {
    return {
      apiKey: input && input.apiKey ? String(input.apiKey) : '',
      model: input && input.model ? String(input.model) : 'gpt-4.1-mini'
    };
  }

  function normalizeCard(card) {
    if (!card || !card.id || !card.title) return null;
    return {
      id: String(card.id),
      title: String(card.title),
      summary: String(card.summary || ''),
      reason: String(card.reason || ''),
      url: String(card.url || ''),
      source: String(card.source || ''),
      publishedAt: String(card.publishedAt || ''),
      query: String(card.query || ''),
      origin: String(card.origin || 'search'),
      focusPrompt: String(card.focusPrompt || '')
    };
  }

  function normalizeDocument(doc) {
    if (!doc || !doc.id || !doc.title) return null;
    return {
      id: String(doc.id),
      title: String(doc.title),
      items: Array.isArray(doc.items) ? doc.items.map(normalizeCard).filter(Boolean) : []
    };
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function $(id) { return document.getElementById(id); }
  function uid(prefix) { return (prefix || 'C') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'value') n.value = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k === 'checked') n.checked = !!attrs[k];
      else if (k === 'hidden') n.hidden = !!attrs[k];
      else if (k === 'disabled') n.disabled = !!attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function status(msg) { $('live-status').textContent = msg; }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : ''; }
  function byId(id) { return state.captures.filter(function (c) { return c.id === id; })[0]; }
  function documentById(id) { return state.documents.filter(function (d) { return d.id === id; })[0]; }
  function cardById(id) {
    return state.results.concat(state.focusResults).filter(function (card) { return card.id === id; })[0];
  }

  // ---------- navigation ----------
  var menuBtn = $('btn-advanced'), menu = $('adv-list');
  function toggleMenu(open) { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); }
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(menu.hidden); });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#adv-menu')) toggleMenu(false);
    if (!e.target.closest('.menu-wrap') && (ui.openCreateMenuCardId || ui.openAddMenuCardId)) {
      ui.openCreateMenuCardId = '';
      ui.openAddMenuCardId = '';
      renderCurrent();
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleMenu(false); });
  $('btn-search').addEventListener('click', function () { show('search'); });
  $('btn-draft').addEventListener('click', function () { show('draft'); });

  function show(view) {
    currentView = view;
    toggleMenu(false);
    $('workflow-view').hidden = true;
    var rv = $('research-view');
    rv.hidden = false;
    rv.textContent = '';
    (view === 'search' ? renderSearch : renderDraft)(rv);
  }
  function renderCurrent() {
    if ($('research-view').hidden) return;
    show(currentView);
  }
  function closeBtn() {
    return h('button', {
      text: '← Back to workflows',
      onclick: function () {
        $('research-view').hidden = true;
        $('workflow-view').hidden = false;
      }
    });
  }

  // ---------- Search ----------
  function renderSearch(root) {
    var query = h('textarea', {
      id: 'r-query',
      rows: '3',
      'aria-label': 'Research query',
      placeholder: 'Ask for sources, comparisons, implementation references, or background context.',
      value: state.lastQuery
    });
    var apiKey = h('input', {
      id: 'r-api-key',
      type: 'password',
      placeholder: 'OpenAI API key',
      'aria-label': 'OpenAI API key',
      value: state.settings.apiKey,
      onchange: function () { state.settings.apiKey = apiKey.value.trim(); save(); status('API key updated.'); }
    });
    var model = h('select', {
      id: 'r-model',
      'aria-label': 'Responses model',
      onchange: function () { state.settings.model = model.value; save(); status('Model updated.'); }
    });
    MODELS.forEach(function (m) {
      var option = h('option', { value: m, text: m });
      if (state.settings.model === m) option.selected = true;
      model.appendChild(option);
    });

    var form = h('form', {
      onsubmit: function (e) {
        e.preventDefault();
        runSearch(query.value.trim(), 'search', null);
      }
    }, [
      h('div', { class: 'api-grid' }, [
        h('label', {}, [h('span', { text: 'OpenAI API key' }), apiKey]),
        h('label', {}, [h('span', { text: 'Responses model' }), model])
      ]),
      h('div', { class: 'helper', text: 'The key is stored only in this browser. Search and Focus use the OpenAI Responses API with web search.' }),
      h('label', {}, [h('span', { text: 'Research query' }), query]),
      h('div', { class: 'r-row' }, [h('button', { class: 'primary', text: ui.loading ? 'Searching...' : 'Search', disabled: ui.loading })])
    ]);

    root.appendChild(h('div', { class: 'r-row' }, [closeBtn(), h('h2', { text: 'Research: Search' })]));
    root.appendChild(h('p', { text: 'Run AI-powered search, save useful result cards into documents, and Focus on promising cards for a deeper second pass.' }));
    root.appendChild(form);
    if (ui.error) root.appendChild(h('div', { class: 'warn', text: ui.error }));

    var resultsColumn = h('div', {}, [
      renderCardSection('Search results', state.results, state.lastQuery, state.lastSummary, 'search'),
      renderCardSection('Focus results', state.focusResults, state.focusQuery, state.focusSummary, 'focus')
    ]);

    var sideColumn = h('div', {}, [
      renderDocuments(),
      h('div', { id: 'r-captures-wrap' }, [h('h3', { text: 'Captured (' + state.captures.length + ')' }), h('div', { id: 'r-captures' }), manualForm()])
    ]);

    root.appendChild(h('div', { class: 'r-grid' }, [resultsColumn, sideColumn]));
    root.appendChild(documentDialog());
    drawCaptures();
  }

  function renderCardSection(title, cards, query, summary, type) {
    var wrap = h('div');
    wrap.appendChild(h('h3', { text: title }));
    if (query) wrap.appendChild(h('p', { class: 'meta-text', text: 'Query: ' + query }));
    if (summary) wrap.appendChild(h('p', { class: 'meta-text', text: summary }));
    if (!cards.length) {
      wrap.appendChild(h('div', { class: 'empty', text: type === 'search' ? 'Run a search to generate result cards.' : 'Use Focus on a result card to see a more specific follow-up search.' }));
      return wrap;
    }
    cards.forEach(function (card) { wrap.appendChild(renderResultCard(card, type)); });
    return wrap;
  }

  function renderResultCard(card, type) {
    var createOpen = ui.openCreateMenuCardId === card.id;
    var addOpen = ui.openAddMenuCardId === card.id;
    var focusBusy = ui.focusingCardId === card.id;
    var sentences = snippetSentences(card);

    var actions = h('div', { class: 'result-actions' }, [
      h('div', { class: 'menu-wrap' }, [
        h('button', {
          class: 'icon-button',
          'aria-label': 'Open create document menu',
          'aria-expanded': String(createOpen),
          onclick: function (e) {
            e.stopPropagation();
            ui.openCreateMenuCardId = createOpen ? '' : card.id;
            ui.openAddMenuCardId = '';
            renderCurrent();
          },
          text: '+'
        }),
        createOpen ? h('div', { class: 'menu-panel' }, [
          h('button', {
            text: 'Create New Document',
            onclick: function () {
              ui.pendingCardId = card.id;
              ui.openCreateMenuCardId = '';
              $('r-doc-form').reset();
              $('r-doc-dialog').showModal();
            }
          })
        ]) : null
      ]),
      h('div', { class: 'menu-wrap' }, [
        h('button', {
          'aria-label': 'Add result to saved document',
          'aria-expanded': String(addOpen),
          text: 'Add',
          onclick: function (e) {
            e.stopPropagation();
            ui.openAddMenuCardId = addOpen ? '' : card.id;
            ui.openCreateMenuCardId = '';
            renderCurrent();
          }
        }),
        addOpen ? renderAddMenu(card) : null
      ]),
      h('button', {
        class: 'secondary',
        text: focusBusy ? 'Focusing...' : 'Focus',
        disabled: focusBusy,
        onclick: function () { runSearch(focusPromptForCard(card), 'focus', card); }
      })
    ]);

    var cardNode = h('div', { class: 'r-card result-card' }, [
      h('div', { class: 'result-card-head' }, [
        h('div', {}, [
          h('h4', { text: card.title }),
          h('p', { class: 'meta-text', text: [card.source, card.publishedAt, type === 'focus' ? 'Focus result' : 'Search result'].filter(Boolean).join(' · ') || 'AI result' })
        ]),
        actions
      ]),
      h('p', { text: card.summary }),
      card.reason ? h('p', { class: 'meta-text', text: 'Why it matters: ' + card.reason }) : null,
      card.url ? h('p', { class: 'r-cite' }, [h('a', { href: safeUrl(card.url), target: '_blank', rel: 'noopener noreferrer', text: card.url })]) : null,
      h('div', { class: 'r-row' }, [
        h('button', {
          text: 'Capture all',
          onclick: function () { addCapture(composeCaptureText(card), card.title, card.url); }
        })
      ])
    ]);

    sentences.forEach(function (sentence) {
      cardNode.appendChild(h('button', {
        text: 'Capture: “' + sentence.trim().slice(0, 40) + '…”',
        title: sentence.trim(),
        onclick: function () { addCapture(sentence, card.title, card.url); }
      }));
    });
    return cardNode;
  }

  function renderAddMenu(card) {
    if (!state.documents.length) {
      return h('div', { class: 'menu-panel' }, [h('p', { class: 'menu-empty', text: 'No saved documents yet.' })]);
    }
    return h('div', { class: 'menu-panel' }, state.documents.map(function (doc) {
      return h('button', {
        text: doc.title,
        onclick: function () {
          if (addCardToDocument(card, doc.id)) status('Saved card to ' + doc.title + '.');
          renderCurrent();
        }
      });
    }));
  }

  function renderDocuments() {
    var box = h('div');
    box.appendChild(h('h3', { text: 'Saved documents (' + state.documents.length + ')' }));
    if (!state.documents.length) {
      box.appendChild(h('div', { class: 'empty', text: 'Use + on a result card to create a saved document, or Add to drop a card into an existing document.' }));
      return box;
    }

    state.documents.forEach(function (doc) {
      var wrap = h('div', { class: 'r-card' }, [
        h('div', { class: 'card-head' }, [
          h('div', {}, [h('h4', { text: doc.title }), h('p', { class: 'meta-text', text: doc.items.length + ' saved cards' })]),
          h('button', {
            class: 'danger',
            text: 'Delete',
            onclick: function () {
              state.documents = state.documents.filter(function (d) { return d.id !== doc.id; });
              save();
              renderCurrent();
              status('Document deleted.');
            }
          })
        ])
      ]);

      doc.items.forEach(function (item) {
        wrap.appendChild(h('div', { class: 'document-item' }, [
          h('div', { class: 'card-head' }, [
            h('div', {}, [h('h5', { text: item.title }), h('p', { class: 'meta-text', text: [item.source, item.publishedAt].filter(Boolean).join(' · ') })]),
            h('button', {
              class: 'danger',
              text: 'Remove',
              onclick: function () {
                doc.items = doc.items.filter(function (x) { return x.id !== item.id; });
                save();
                renderCurrent();
                status('Saved card removed.');
              }
            })
          ]),
          h('p', { text: item.summary }),
          item.reason ? h('p', { class: 'meta-text', text: 'Why it matters: ' + item.reason }) : null,
          item.url ? h('p', { class: 'r-cite' }, [h('a', { href: safeUrl(item.url), target: '_blank', rel: 'noopener noreferrer', text: item.url })]) : null
        ]));
      });
      box.appendChild(wrap);
    });
    return box;
  }

  function documentDialog() {
    var form = h('form', {
      method: 'dialog',
      id: 'r-doc-form',
      onsubmit: function (e) {
        var submitter = e.submitter;
        if (submitter && submitter.value === 'cancel') return;
        e.preventDefault();
        var title = $('r-doc-title').value.trim();
        var card = cardById(ui.pendingCardId);
        if (!title || !card) return;
        var doc = { id: uid('DOC'), title: title, items: [] };
        state.documents.unshift(doc);
        addCardToDocument(card, doc.id);
        ui.pendingCardId = '';
        save();
        $('r-doc-dialog').close();
        renderCurrent();
        status('Document created.');
      }
    }, [
      h('h3', { text: 'Create new document' }),
      h('p', { class: 'helper', text: 'The selected AI result card will be added automatically.' }),
      h('label', {}, [h('span', { text: 'Document title' }), h('input', { id: 'r-doc-title', name: 'title', maxlength: '120', required: 'required' })]),
      h('div', { class: 'r-row' }, [
        h('button', { value: 'cancel', text: 'Cancel' }),
        h('button', { class: 'primary', value: 'ok', text: 'Create document' })
      ])
    ]);
    return h('dialog', { id: 'r-doc-dialog' }, [form]);
  }

  function composeCaptureText(card) {
    return [card.summary, card.reason].filter(Boolean).join(' ');
  }

  function snippetSentences(card) {
    var text = composeCaptureText(card);
    var matches = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    return matches.map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3);
  }

  function focusPromptForCard(card) {
    return 'Find more detailed and corroborating sources about: ' + [card.title, card.summary, card.reason].filter(Boolean).join(' ');
  }

  function addCardToDocument(card, docId) {
    var doc = documentById(docId);
    if (!doc || !card) return false;
    var exists = doc.items.some(function (item) {
      return item.title === card.title && item.url === card.url;
    });
    if (exists) {
      status('That card is already in ' + doc.title + '.');
      return false;
    }
    doc.items.unshift({
      id: uid('ITEM'),
      title: card.title,
      summary: card.summary,
      reason: card.reason,
      url: card.url,
      source: card.source,
      publishedAt: card.publishedAt,
      query: card.query,
      origin: card.origin
    });
    save();
    return true;
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

  async function runSearch(query, mode, sourceCard) {
    if (!query) return;
    if (!state.settings.apiKey) {
      ui.error = 'Add an OpenAI API key before using AI-powered search.';
      renderCurrent();
      status(ui.error);
      return;
    }

    ui.loading = mode === 'search';
    ui.focusingCardId = mode === 'focus' && sourceCard ? sourceCard.id : '';
    ui.error = '';
    renderCurrent();

    try {
      var payload = buildSearchPrompt(query, mode, sourceCard);
      var response = await fetchResponses(payload);
      var parsed = extractJson(extractOutputText(response));
      var cards = normalizeResults(parsed.results || [], query, mode);

      if (mode === 'focus') {
        state.focusQuery = query;
        state.focusSummary = String(parsed.summary || '');
        state.focusResults = cards;
        status(cards.length + ' focus results');
      } else {
        state.lastQuery = query;
        state.lastSummary = String(parsed.summary || '');
        state.results = cards;
        status(cards.length + ' results');
      }
      save();
    } catch (err) {
      ui.error = err.message || 'Search failed.';
      status(ui.error);
    } finally {
      ui.loading = false;
      ui.focusingCardId = '';
      renderCurrent();
    }
  }

  function buildSearchPrompt(query, mode, sourceCard) {
    return [
      'You are a research assistant returning concise web search result cards.',
      mode === 'focus' && sourceCard ? 'Focus from this card: ' + sourceCard.title + '. ' + sourceCard.summary + '. ' + sourceCard.reason : '',
      'User query: ' + query,
      'Return strict JSON only.',
      'Schema: {"summary":"brief overview","results":[{"title":"","summary":"","reason":"","url":"","source":"","publishedAt":"","focusPrompt":""}]}',
      'Provide 4 to 6 results with absolute URLs.'
    ].filter(Boolean).join('\n');
  }

  async function fetchResponses(input) {
    var lastError = null;
    for (var i = 0; i < TOOL_TYPES.length; i++) {
      var response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + state.settings.apiKey
        },
        body: JSON.stringify({
          model: state.settings.model,
          tools: [{ type: TOOL_TYPES[i] }],
          input: input
        })
      });

      if (response.ok) return response.json();
      var text = await response.text();
      lastError = new Error(parseApiError(text, response.status));
      if (!/web_search/i.test(text) && response.status !== 400) break;
    }
    throw lastError || new Error('Search failed.');
  }

  function parseApiError(text, status) {
    try {
      var parsed = JSON.parse(text);
      if (parsed && parsed.error && parsed.error.message) return parsed.error.message;
    } catch (err) {}
    return 'OpenAI request failed with status ' + status + '.';
  }

  function extractOutputText(response) {
    if (response && typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
    if (!response || !Array.isArray(response.output)) return '';
    var parts = [];
    response.output.forEach(function (item) {
      (item.content || []).forEach(function (content) {
        if (content.type === 'output_text' && content.text) parts.push(content.text);
      });
    });
    return parts.join('\n').trim();
  }

  function extractJson(text) {
    if (!text) throw new Error('The AI response was empty.');
    var cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = cleaned.indexOf('{');
    var end = cleaned.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('The AI response did not contain JSON.');
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  function normalizeResults(results, query, origin) {
    return (Array.isArray(results) ? results : []).map(function (result) {
      return normalizeCard({
        id: uid('R'),
        title: result.title || 'Untitled result',
        summary: result.summary || '',
        reason: result.reason || '',
        url: result.url || '',
        source: result.source || '',
        publishedAt: result.publishedAt || '',
        query: query,
        origin: origin,
        focusPrompt: result.focusPrompt || ''
      });
    }).filter(Boolean);
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
    var c = { id: uid('CAP'), raw: text.trim(), title: title, url: url, verbiage: toVerbiage(text, title, url) };
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
        if (count(w, ['should', 'must', 'clearly', 'obviously', 'ensure'])) tone.push('persuasive');
        if (count(w, ['understand', 'sorry', 'concern', 'support', 'hardship'])) tone.push('empathetic');
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
