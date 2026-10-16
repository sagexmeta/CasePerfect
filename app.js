(function () {
  'use strict';

  var KEY = 'caseperfect.workflow-mapper.v1';
  var WORKFLOW_FIELDS = ['name', 'goal', 'trigger', 'frequency', 'tools', 'output', 'constraints', 'notes'];
  var PAIN_FIELDS = ['step', 'title', 'description', 'category', 'tags', 'frequency', 'severity', 'timeCost', 'accessibility', 'confidence'];
  var PAIN_NUMERIC_FIELDS = ['frequency', 'severity', 'timeCost', 'accessibility', 'confidence'];
  var CONCEPT_FIELDS = ['painPointId', 'name', 'approach', 'summary', 'accessibilityFeatures', 'convenienceFeatures', 'value', 'effort', 'accessibilityBenefit', 'convenienceBenefit', 'confidence'];
  var CONCEPT_NUMERIC_FIELDS = ['value', 'effort', 'accessibilityBenefit', 'convenienceBenefit', 'confidence'];
  var WORKFLOW_FREQUENCIES = ['Daily', 'Several times a week', 'Weekly', 'Monthly', 'Ad hoc'];
  var CATEGORIES = [
    ['capture', 'Information capture'],
    ['fragmentation', 'Note fragmentation'],
    ['synthesis', 'Manual synthesis'],
    ['retrieval', 'Finding the right source'],
    ['context-switching', 'Context switching'],
    ['handoff', 'Packaging and handoff'],
    ['follow-through', 'Turning findings into next actions']
  ];
  var APPROACHES = [
    ['assistant', 'Guided assistant'],
    ['automation', 'Automation'],
    ['workspace', 'Unified workspace'],
    ['search', 'Search and retrieval'],
    ['review', 'Review cockpit'],
    ['writer', 'Structured writing assistant']
  ];

  var workflows = load();
  var selectedId = workflows[0] ? workflows[0].id : null;

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeWorkflow).filter(Boolean);
    } catch (err) {
      return [];
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(workflows));
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1679616).toString(36).toUpperCase().padStart(4, '0');
  }

  function now() {
    return new Date().toISOString();
  }

  function fmt(value) {
    return new Date(value).toLocaleString();
  }

  function el(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function announce(message) {
    el('live-status').textContent = message;
  }

  function touch(workflow) {
    workflow.updated = now();
  }

  function log(workflow, message) {
    workflow.log.unshift({ t: now(), msg: message });
  }

  function normalizeWorkflow(input) {
    if (!input || !input.id || !input.name) return null;

    var workflow = {
      id: input.id,
      name: String(input.name),
      goal: String(input.goal || ''),
      trigger: String(input.trigger || ''),
      frequency: String(input.frequency || 'Ad hoc'),
      tools: String(input.tools || ''),
      output: String(input.output || ''),
      constraints: String(input.constraints || ''),
      notes: String(input.notes || ''),
      created: input.created || now(),
      updated: input.updated || input.created || now(),
      painPoints: Array.isArray(input.painPoints) ? input.painPoints.map(normalizePainPoint).filter(Boolean) : [],
      concepts: Array.isArray(input.concepts) ? input.concepts.map(normalizeConcept).filter(Boolean) : [],
      log: Array.isArray(input.log) ? input.log.filter(function (entry) { return entry && entry.t && entry.msg; }) : []
    };

    if (!workflow.log.length) log(workflow, 'Workflow imported');
    return workflow;
  }

  function normalizePainPoint(input) {
    if (!input || !input.id || !input.title) return null;
    return {
      id: input.id,
      step: String(input.step || ''),
      title: String(input.title),
      description: String(input.description || ''),
      category: String(input.category || 'capture'),
      tags: String(input.tags || ''),
      frequency: clampScale(input.frequency),
      severity: clampScale(input.severity),
      timeCost: clampScale(input.timeCost),
      accessibility: clampScale(input.accessibility),
      confidence: clampScale(input.confidence),
      status: input.status === 'resolved' ? 'resolved' : 'active',
      created: input.created || now()
    };
  }

  function normalizeConcept(input) {
    if (!input || !input.id || !input.name) return null;
    return {
      id: input.id,
      painPointId: String(input.painPointId || ''),
      name: String(input.name),
      approach: String(input.approach || 'assistant'),
      summary: String(input.summary || ''),
      accessibilityFeatures: String(input.accessibilityFeatures || ''),
      convenienceFeatures: String(input.convenienceFeatures || ''),
      value: clampScale(input.value),
      effort: clampScale(input.effort),
      accessibilityBenefit: clampScale(input.accessibilityBenefit),
      convenienceBenefit: clampScale(input.convenienceBenefit),
      confidence: clampScale(input.confidence),
      created: input.created || now()
    };
  }

  function clampScale(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return 3;
    return Math.max(1, Math.min(5, n));
  }

  function selected() {
    for (var i = 0; i < workflows.length; i++) {
      if (workflows[i].id === selectedId) return workflows[i];
    }
    return null;
  }

  function workflowById(id) {
    for (var i = 0; i < workflows.length; i++) {
      if (workflows[i].id === id) return workflows[i];
    }
    return null;
  }

  function painById(workflow, painId) {
    if (!workflow) return null;
    for (var i = 0; i < workflow.painPoints.length; i++) {
      if (workflow.painPoints[i].id === painId) return workflow.painPoints[i];
    }
    return null;
  }

  function conceptById(workflow, conceptId) {
    if (!workflow) return null;
    for (var i = 0; i < workflow.concepts.length; i++) {
      if (workflow.concepts[i].id === conceptId) return workflow.concepts[i];
    }
    return null;
  }

  function labelForCategory(id) {
    return labelFromPairs(CATEGORIES, id);
  }

  function labelForApproach(id) {
    return labelFromPairs(APPROACHES, id);
  }

  function labelFromPairs(pairs, key) {
    for (var i = 0; i < pairs.length; i++) {
      if (pairs[i][0] === key) return pairs[i][1];
    }
    return key;
  }

  function painScore(painPoint) {
    return painPoint.frequency * 3 +
      painPoint.severity * 4 +
      painPoint.timeCost * 3 +
      painPoint.accessibility * 2 +
      painPoint.confidence;
  }

  function painLevel(score) {
    if (score >= 52) return 'critical';
    if (score >= 40) return 'high';
    if (score >= 28) return 'medium';
    return 'low';
  }

  function conceptScore(concept) {
    return concept.value * 4 +
      concept.convenienceBenefit * 3 +
      concept.accessibilityBenefit * 3 +
      concept.confidence * 2 -
      concept.effort * 2;
  }

  function conceptLevel(score) {
    if (score >= 42) return 'high';
    if (score >= 28) return 'medium';
    return 'low';
  }

  function sortedPainPoints(workflow) {
    return workflow.painPoints.slice().sort(function (a, b) {
      return painScore(b) - painScore(a);
    });
  }

  function sortedConcepts(workflow) {
    return workflow.concepts.slice().sort(function (a, b) {
      return conceptScore(b) - conceptScore(a);
    });
  }

  function topPainPoints(workflow, limit) {
    return sortedPainPoints(workflow).slice(0, limit);
  }

  function topConcept(workflow) {
    var ranked = sortedConcepts(workflow);
    return ranked[0] || null;
  }

  function dashboardStats() {
    var painPoints = [];
    var concepts = [];
    for (var i = 0; i < workflows.length; i++) {
      painPoints = painPoints.concat(workflows[i].painPoints.map(function (pain) {
        return { workflowId: workflows[i].id, workflowName: workflows[i].name, pain: pain };
      }));
      concepts = concepts.concat(workflows[i].concepts.map(function (concept) {
        return { workflowId: workflows[i].id, workflowName: workflows[i].name, concept: concept };
      }));
    }

    painPoints.sort(function (a, b) { return painScore(b.pain) - painScore(a.pain); });
    concepts.sort(function (a, b) { return conceptScore(b.concept) - conceptScore(a.concept); });

    return {
      workflowCount: workflows.length,
      painCount: painPoints.length,
      conceptCount: concepts.length,
      topPain: painPoints[0] || null,
      topConcept: concepts[0] || null
    };
  }

  function opportunityBrief(workflow) {
    var topThree = topPainPoints(workflow, 3);
    if (!topThree.length) {
      return {
        title: 'No ranked friction yet',
        summary: 'Capture at least one pain point to reveal the highest-value product opportunity.',
        recommendation: 'Start by logging the steps that feel slow, repetitive, or hard to review accessibly.',
        features: ['Fast capture', 'Scoring', 'Linked product ideas']
      };
    }

    var primary = topThree[0];
    var categories = {};
    for (var i = 0; i < topThree.length; i++) {
      categories[topThree[i].category] = (categories[topThree[i].category] || 0) + 1;
    }

    var dominant = Object.keys(categories).sort(function (a, b) {
      return categories[b] - categories[a];
    })[0];

    var recommendation = {
      capture: 'Design a low-friction capture layer that stores research notes in a consistent structure as they happen.',
      fragmentation: 'Prioritize a unified workspace that brings sources, notes, and summaries into one keyboard-friendly surface.',
      synthesis: 'Focus on assisted synthesis: structure findings, cluster themes, and generate a draft output from evidence.',
      retrieval: 'Build stronger retrieval and traceability so every claim can be found quickly without reopening many sources.',
      'context-switching': 'Reduce tab and tool hopping by combining source review, note-taking, and output drafting in one flow.',
      handoff: 'Create a packaging tool that turns raw findings into accessible briefs, summaries, and next-step checklists.',
      'follow-through': 'Add a decision and next-action layer so findings are translated into concrete follow-up without manual copying.'
    }[dominant];

    return {
      title: 'Highest-value opportunity: ' + primary.title,
      summary: 'The biggest friction appears around ' + (primary.step || 'an unnamed step') + ', where the score reaches ' + painScore(primary) + ' and the dominant pattern is ' + labelForCategory(dominant).toLowerCase() + '.',
      recommendation: recommendation,
      features: recommendedFeatures(dominant)
    };
  }

  function recommendedFeatures(category) {
    var map = {
      capture: ['One-screen intake', 'Prompted evidence fields', 'Keyboard-first note entry'],
      fragmentation: ['Unified source list', 'Reusable tags', 'Cross-note linking'],
      synthesis: ['Auto-grouped themes', 'Evidence-backed summaries', 'Draft output templates'],
      retrieval: ['Fast filters', 'Source trace links', 'Saved views'],
      'context-switching': ['Split review and writing panes', 'Pinned context', 'Task handoff shortcuts'],
      handoff: ['Brief generator', 'Stakeholder-ready summaries', 'Exportable action lists'],
      'follow-through': ['Decision tracker', 'Auto-created next steps', 'Review reminders']
    };
    return map[category] || ['Structured capture', 'Fast review', 'Clear outputs'];
  }

  function metricLabel(value) {
    return ['Very low', 'Low', 'Moderate', 'High', 'Very high'][value - 1];
  }

  function selectOptions(options, selectedValue) {
    return options.map(function (option) {
      var value = Array.isArray(option) ? option[0] : option;
      var label = Array.isArray(option) ? option[1] : option;
      return '<option value="' + esc(value) + '"' + (String(value) === String(selectedValue) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function scaleOptions(selectedValue) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<option value="' + i + '"' + (i === selectedValue ? ' selected' : '') + '>' + i + ' - ' + metricLabel(i) + '</option>';
    }
    return html;
  }

  function renderDashboard() {
    var stats = dashboardStats();
    var html = '<div class="section-head"><h2>Discovery dashboard</h2><p>Keep the highest-friction work visible.</p></div>';
    html += '<div class="summary-grid">' +
      summaryCard(stats.workflowCount, 'Workflows') +
      summaryCard(stats.painCount, 'Pain points') +
      summaryCard(stats.topPain ? painScore(stats.topPain.pain) : '0', 'Top pain score') +
      summaryCard(stats.conceptCount, 'Product concepts') +
      '</div>';

    html += '<div class="mini-list">';
    if (stats.topPain) {
      html += '<div class="mini-card"><h3>Greatest pain point</h3>' +
        '<h4>' + esc(stats.topPain.pain.title) + '</h4>' +
        '<p>' + esc(stats.topPain.workflowName) + ' · ' + esc(stats.topPain.pain.step || 'No step named') + '</p>' +
        '<div class="row"><span class="badge ' + painLevel(painScore(stats.topPain.pain)) + '">' + painScore(stats.topPain.pain) + '</span>' +
        '<button class="secondary" data-select="' + esc(stats.topPain.workflowId) + '">Open workflow</button></div></div>';
    } else {
      html += '<div class="mini-card"><h3>Greatest pain point</h3><p>No pain points ranked yet.</p></div>';
    }

    if (stats.topConcept) {
      html += '<div class="mini-card"><h3>Strongest concept</h3>' +
        '<h4>' + esc(stats.topConcept.concept.name) + '</h4>' +
        '<p>' + esc(stats.topConcept.workflowName) + ' · ' + esc(labelForApproach(stats.topConcept.concept.approach)) + '</p>' +
        '<div class="row"><span class="badge ' + conceptLevel(conceptScore(stats.topConcept.concept)) + '">' + conceptScore(stats.topConcept.concept) + '</span>' +
        '<button class="secondary" data-select="' + esc(stats.topConcept.workflowId) + '">Review concept</button></div></div>';
    } else {
      html += '<div class="mini-card"><h3>Strongest concept</h3><p>Add a concept to compare solution value against effort.</p></div>';
    }
    html += '</div>';

    el('dashboard-summary').innerHTML = html;
  }

  function summaryCard(value, label) {
    return '<div class="metric-card"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  }

  function renderList() {
    var container = el('workflow-list');
    if (!workflows.length) {
      container.innerHTML = '<p class="empty">No workflows yet. Create one or load the example.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < workflows.length; i++) {
      var workflow = workflows[i];
      var topPain = topPainPoints(workflow, 1)[0];
      var topScore = topPain ? painScore(topPain) : 0;
      html += '<button class="workflow-item' + (workflow.id === selectedId ? ' active' : '') + '" data-select="' + esc(workflow.id) + '">' +
        '<strong>' + esc(workflow.name) + '</strong>' +
        '<small>' + esc(workflow.goal || 'No goal yet') + '</small>' +
        '<div class="row"><span class="badge">' + esc(workflow.frequency) + '</span>' +
        '<span class="badge ' + (topPain ? painLevel(topScore) : 'low') + '">Top pain ' + esc(topScore) + '</span></div>' +
        '<small>' + workflow.painPoints.length + ' pain points · ' + workflow.concepts.length + ' concepts</small>' +
        '</button>';
    }
    container.innerHTML = html;
  }

  function renderWorkflow() {
    var workflow = selected();
    var view = el('workflow-view');

    if (!workflow) {
      view.innerHTML = '<div class="empty-state"><h2>Start with a real workflow</h2><p>Create a workflow for research and note synthesis, then score the friction points that slow you down.</p><p>The app highlights the highest-impact pain points and helps you turn them into accessible product ideas.</p></div>';
      return;
    }

    var topPain = topPainPoints(workflow, 1)[0];
    var brief = opportunityBrief(workflow);
    var concept = topConcept(workflow);
    var html = '<div class="content-stack">';

    html += '<section class="head"><div><h2>' + esc(workflow.name) + '</h2>' +
      '<p>Goal: ' + esc(workflow.goal || 'Add a goal') + ' · Trigger: ' + esc(workflow.trigger || 'Add a trigger') + ' · Updated ' + esc(fmt(workflow.updated)) + '</p></div>' +
      '<div class="row"><button class="secondary" data-export-workflow>Export workflow</button><button class="danger" data-delete-workflow>Delete workflow</button></div></section>';

    html += '<section class="overview-grid">';
    html += '<div class="section-card"><div class="section-head"><h3>Workflow details</h3><p>Describe the current research and synthesis flow before deciding what to build.</p></div>' +
      '<div class="detail-grid">' +
      fieldInput('Workflow name', 'name', workflow.name, 'text', 'Name the recurring workflow') +
      fieldInput('Primary goal', 'goal', workflow.goal, 'text', 'What outcome should this workflow create?') +
      fieldInput('Trigger', 'trigger', workflow.trigger, 'text', 'What starts the work?') +
      workflowFrequencyInput(workflow.frequency) +
      fieldInput('Current tools', 'tools', workflow.tools, 'text', 'Where the work happens today') +
      fieldInput('Success output', 'output', workflow.output, 'text', 'What the workflow should produce') +
      '</div>' +
      fieldTextarea('Accessibility needs or constraints', 'constraints', workflow.constraints, 'Keyboard-first use, low-friction review, readable outputs') +
      fieldTextarea('Context and notes', 'notes', workflow.notes, 'Capture background, edge cases, or assumptions') +
      '</div>';

    html += '<div class="stack">';
    html += '<div class="section-card"><div class="section-head"><h3>Current signal</h3><p>Use these numbers to decide where product investment should go first.</p></div>' +
      '<div class="score-grid">' +
      summaryCard(workflow.painPoints.length, 'Pain points') +
      summaryCard(workflow.concepts.length, 'Concepts') +
      summaryCard(topPain ? painScore(topPain) : '0', 'Highest pain score') +
      summaryCard(concept ? conceptScore(concept) : '0', 'Best concept score') +
      summaryCard(countResolved(workflow), 'Resolved pains') +
      '</div></div>';

    html += '<div class="section-card"><div class="section-head"><h3>Opportunity brief</h3><p>Auto-generated from the strongest signals in this workflow.</p></div>' +
      '<div class="note"><strong>' + esc(brief.title) + '</strong><p>' + esc(brief.summary) + '</p><p>' + esc(brief.recommendation) + '</p>' +
      '<div class="chipset">' + brief.features.map(function (feature) { return '<span class="badge">' + esc(feature) + '</span>'; }).join('') + '</div></div></div>';
    html += '</div></section>';

    html += '<section class="two-up">';
    html += '<div class="section-card"><div class="section-head"><h3>Pain points</h3><p>Score each friction point by repetition, impact, time cost, accessibility friction, and confidence.</p></div>' +
      renderPainList(workflow) + renderPainForm() + '</div>';

    html += '<div class="section-card"><div class="section-head"><h3>Product concepts</h3><p>Turn the highest-ranked problems into concrete software ideas and compare them.</p></div>' +
      renderConceptList(workflow) + renderConceptForm(workflow) + '</div>';
    html += '</section>';

    html += '<section class="section-card"><div class="section-head"><h3>Activity log</h3><p>Review how the workflow model evolved.</p></div>' +
      renderLog(workflow) + '</section>';

    html += '</div>';
    view.innerHTML = html;
  }

  function workflowFrequencyInput(value) {
    return '<label>Frequency<span>How often does this workflow recur?</span>' +
      '<select data-field="frequency">' + selectOptions(WORKFLOW_FREQUENCIES, value) + '</select></label>';
  }

  function fieldInput(label, field, value, type, helper) {
    return '<label>' + esc(label) + '<span>' + esc(helper) + '</span>' +
      '<input type="' + esc(type) + '" data-field="' + esc(field) + '" value="' + esc(value || '') + '">' +
      '</label>';
  }

  function fieldTextarea(label, field, value, helper) {
    return '<label>' + esc(label) + '<span>' + esc(helper) + '</span>' +
      '<textarea rows="4" data-field="' + esc(field) + '">' + esc(value || '') + '</textarea>' +
      '</label>';
  }

  function countResolved(workflow) {
    var total = 0;
    for (var i = 0; i < workflow.painPoints.length; i++) {
      if (workflow.painPoints[i].status === 'resolved') total++;
    }
    return total;
  }

  function renderPainList(workflow) {
    if (!workflow.painPoints.length) {
      return '<p class="empty">No pain points yet. Start with the parts of the workflow that feel repetitive, slow, fragmented, or hard to review accessibly.</p>';
    }

    return sortedPainPoints(workflow).map(function (pain) {
      var score = painScore(pain);
      return '<article class="pain-card">' +
        '<div class="card-head"><div><h4>' + esc(pain.title) + '</h4><p>' + esc(pain.step || 'No step named') + ' · ' + esc(labelForCategory(pain.category)) + '</p></div>' +
        '<div class="row"><span class="badge ' + painLevel(score) + '">' + score + '</span><span class="badge ' + esc(pain.status) + '">' + esc(pain.status) + '</span>' +
        '<button data-toggle-pain="' + esc(pain.id) + '">' + (pain.status === 'resolved' ? 'Reopen' : 'Mark resolved') + '</button>' +
        '<button class="danger" data-delete-pain="' + esc(pain.id) + '">Delete</button></div></div>' +
        '<div class="detail-grid">' +
        painFieldInput('Step or moment', pain.id, 'step', pain.step, 'text') +
        painFieldInput('Short title', pain.id, 'title', pain.title, 'text') +
        painCategoryInput(pain.id, pain.category) +
        painFieldInput('Tags', pain.id, 'tags', pain.tags, 'text') +
        '</div>' +
        painFieldTextarea('What is happening?', pain.id, 'description', pain.description) +
        '<div class="detail-grid">' +
        painMetricInput('Frequency', pain.id, 'frequency', pain.frequency) +
        painMetricInput('Severity', pain.id, 'severity', pain.severity) +
        painMetricInput('Time cost', pain.id, 'timeCost', pain.timeCost) +
        painMetricInput('Accessibility friction', pain.id, 'accessibility', pain.accessibility) +
        painMetricInput('Confidence', pain.id, 'confidence', pain.confidence) +
        '</div></article>';
    }).join('');
  }

  function painFieldInput(label, painId, field, value, type) {
    return '<label>' + esc(label) + '<input type="' + esc(type) + '" data-pain-id="' + esc(painId) + '" data-pain-field="' + esc(field) + '" value="' + esc(value || '') + '"></label>';
  }

  function painFieldTextarea(label, painId, field, value) {
    return '<label>' + esc(label) + '<textarea rows="4" data-pain-id="' + esc(painId) + '" data-pain-field="' + esc(field) + '">' + esc(value || '') + '</textarea></label>';
  }

  function painCategoryInput(painId, value) {
    return '<label>Pattern category<select data-pain-id="' + esc(painId) + '" data-pain-field="category">' + selectOptions(CATEGORIES, value) + '</select></label>';
  }

  function painMetricInput(label, painId, field, value) {
    return '<label>' + esc(label) + '<select data-pain-id="' + esc(painId) + '" data-pain-field="' + esc(field) + '">' + scaleOptions(value) + '</select></label>';
  }

  function renderPainForm() {
    return '<form data-form="pain">' +
      '<h4>Add pain point</h4>' +
      '<div class="detail-grid">' +
      '<label>Step or moment<input name="step" maxlength="120" required></label>' +
      '<label>Short title<input name="title" maxlength="120" required></label>' +
      '<label>Pattern category<select name="category">' + selectOptions(CATEGORIES, 'capture') + '</select></label>' +
      '<label>Tags<input name="tags" maxlength="120" placeholder="search, notes, review"></label>' +
      '</div>' +
      '<label>Description<textarea name="description" rows="4" required></textarea></label>' +
      '<div class="detail-grid">' +
      painMetricCreateInput('frequency', 'Frequency') +
      painMetricCreateInput('severity', 'Severity') +
      painMetricCreateInput('timeCost', 'Time cost') +
      painMetricCreateInput('accessibility', 'Accessibility friction') +
      painMetricCreateInput('confidence', 'Confidence') +
      '</div>' +
      '<div class="row end"><button class="primary">Add pain point</button></div>' +
      '</form>';
  }

  function painMetricCreateInput(name, label) {
    return '<label>' + esc(label) + '<select name="' + esc(name) + '">' + scaleOptions(3) + '</select></label>';
  }

  function renderConceptList(workflow) {
    if (!workflow.concepts.length) {
      return '<p class="empty">No concepts yet. Add one or more ideas and compare value, convenience, accessibility benefit, and effort.</p>';
    }

    return sortedConcepts(workflow).map(function (concept) {
      var score = conceptScore(concept);
      var linkedPain = painById(workflow, concept.painPointId);
      return '<article class="concept-card">' +
        '<div class="card-head"><div><h4>' + esc(concept.name) + '</h4><p>' + esc(labelForApproach(concept.approach)) + ' · ' + esc(linkedPain ? linkedPain.title : 'Unlinked concept') + '</p></div>' +
        '<div class="row"><span class="badge ' + conceptLevel(score) + '">' + score + '</span>' +
        '<button class="danger" data-delete-concept="' + esc(concept.id) + '">Delete</button></div></div>' +
        '<div class="detail-grid">' +
        conceptPainInput(workflow, concept.id, concept.painPointId) +
        conceptApproachInput(concept.id, concept.approach) +
        conceptFieldInput('Concept name', concept.id, 'name', concept.name, 'text') +
        '<div></div>' +
        '</div>' +
        conceptFieldTextarea('What should the product do?', concept.id, 'summary', concept.summary) +
        conceptFieldTextarea('Accessibility features', concept.id, 'accessibilityFeatures', concept.accessibilityFeatures) +
        conceptFieldTextarea('Convenience features', concept.id, 'convenienceFeatures', concept.convenienceFeatures) +
        '<div class="detail-grid">' +
        conceptMetricInput('Value', concept.id, 'value', concept.value) +
        conceptMetricInput('Effort', concept.id, 'effort', concept.effort) +
        conceptMetricInput('Accessibility benefit', concept.id, 'accessibilityBenefit', concept.accessibilityBenefit) +
        conceptMetricInput('Convenience benefit', concept.id, 'convenienceBenefit', concept.convenienceBenefit) +
        conceptMetricInput('Confidence', concept.id, 'confidence', concept.confidence) +
        '</div></article>';
    }).join('');
  }

  function conceptFieldInput(label, conceptId, field, value, type) {
    return '<label>' + esc(label) + '<input type="' + esc(type) + '" data-concept-id="' + esc(conceptId) + '" data-concept-field="' + esc(field) + '" value="' + esc(value || '') + '"></label>';
  }

  function conceptFieldTextarea(label, conceptId, field, value) {
    return '<label>' + esc(label) + '<textarea rows="4" data-concept-id="' + esc(conceptId) + '" data-concept-field="' + esc(field) + '">' + esc(value || '') + '</textarea></label>';
  }

  function conceptMetricInput(label, conceptId, field, value) {
    return '<label>' + esc(label) + '<select data-concept-id="' + esc(conceptId) + '" data-concept-field="' + esc(field) + '">' + scaleOptions(value) + '</select></label>';
  }

  function conceptPainInput(workflow, conceptId, value) {
    var options = '<option value="">Not linked yet</option>';
    options += workflow.painPoints.map(function (pain) {
      return '<option value="' + esc(pain.id) + '"' + (pain.id === value ? ' selected' : '') + '>' + esc(pain.title) + '</option>';
    }).join('');
    return '<label>Linked pain point<select data-concept-id="' + esc(conceptId) + '" data-concept-field="painPointId">' + options + '</select></label>';
  }

  function conceptApproachInput(conceptId, value) {
    return '<label>Product shape<select data-concept-id="' + esc(conceptId) + '" data-concept-field="approach">' + selectOptions(APPROACHES, value) + '</select></label>';
  }

  function renderConceptForm(workflow) {
    return '<form data-form="concept">' +
      '<h4>Add product concept</h4>' +
      '<div class="detail-grid">' +
      '<label>Linked pain point<select name="painPointId"><option value="">Not linked yet</option>' +
      workflow.painPoints.map(function (pain) { return '<option value="' + esc(pain.id) + '">' + esc(pain.title) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>Product shape<select name="approach">' + selectOptions(APPROACHES, 'assistant') + '</select></label>' +
      '<label>Concept name<input name="name" maxlength="120" required></label><div></div>' +
      '</div>' +
      '<label>Summary<textarea name="summary" rows="4" required></textarea></label>' +
      '<label>Accessibility features<textarea name="accessibilityFeatures" rows="3" placeholder="Keyboard shortcuts, clear focus order, readable summaries, reduced motion"></textarea></label>' +
      '<label>Convenience features<textarea name="convenienceFeatures" rows="3" placeholder="Fast capture, source pinning, reusable templates, one-click export"></textarea></label>' +
      '<div class="detail-grid">' +
      conceptMetricCreateInput('value', 'Value') +
      conceptMetricCreateInput('effort', 'Effort') +
      conceptMetricCreateInput('accessibilityBenefit', 'Accessibility benefit') +
      conceptMetricCreateInput('convenienceBenefit', 'Convenience benefit') +
      conceptMetricCreateInput('confidence', 'Confidence') +
      '</div>' +
      '<div class="row end"><button class="primary">Add concept</button></div>' +
      '</form>';
  }

  function conceptMetricCreateInput(name, label) {
    return '<label>' + esc(label) + '<select name="' + esc(name) + '">' + scaleOptions(3) + '</select></label>';
  }

  function renderLog(workflow) {
    if (!workflow.log.length) return '<p class="empty">No activity yet.</p>';
    return '<div class="log">' + workflow.log.map(function (entry) {
      return '<div class="log-entry"><time datetime="' + esc(entry.t) + '">' + esc(fmt(entry.t)) + '</time><div>' + esc(entry.msg) + '</div></div>';
    }).join('') + '</div>';
  }

  function render() {
    renderDashboard();
    renderList();
    renderWorkflow();
  }

  function newWorkflow(data) {
    var workflow = {
      id: uid('WF'),
      name: data.name,
      goal: data.goal,
      trigger: data.trigger,
      frequency: data.frequency,
      tools: data.tools,
      output: data.output,
      constraints: data.constraints,
      notes: '',
      created: now(),
      updated: now(),
      painPoints: [],
      concepts: [],
      log: []
    };
    log(workflow, 'Workflow created');
    return workflow;
  }

  function createPainPoint(data) {
    return {
      id: uid('PAIN'),
      step: data.step,
      title: data.title,
      description: data.description,
      category: data.category,
      tags: data.tags,
      frequency: clampScale(data.frequency),
      severity: clampScale(data.severity),
      timeCost: clampScale(data.timeCost),
      accessibility: clampScale(data.accessibility),
      confidence: clampScale(data.confidence),
      status: 'active',
      created: now()
    };
  }

  function createConcept(data) {
    return {
      id: uid('IDEA'),
      painPointId: data.painPointId,
      name: data.name,
      approach: data.approach,
      summary: data.summary,
      accessibilityFeatures: data.accessibilityFeatures,
      convenienceFeatures: data.convenienceFeatures,
      value: clampScale(data.value),
      effort: clampScale(data.effort),
      accessibilityBenefit: clampScale(data.accessibilityBenefit),
      convenienceBenefit: clampScale(data.convenienceBenefit),
      confidence: clampScale(data.confidence),
      created: now()
    };
  }

  function addExampleWorkflow() {
    var example = newWorkflow({
      name: 'Research to decision brief',
      goal: 'Turn scattered reading into a concise recommendation memo',
      trigger: 'A new topic, problem, or decision needs fast context',
      frequency: 'Several times a week',
      tools: 'Browser tabs, docs, notes app, task list',
      output: 'Decision brief with evidence and next steps',
      constraints: 'Needs a clear keyboard flow, lower context switching, and readable summaries'
    });

    example.notes = 'Use this sample to calibrate your own scoring before entering a real workflow.';
    example.painPoints.push(createPainPoint({
      step: 'Collecting source material',
      title: 'Relevant sources spread across too many tabs',
      description: 'I lose time hopping between tabs, docs, and bookmarks before I can even start writing.',
      category: 'context-switching',
      tags: 'tabs, research',
      frequency: 5,
      severity: 4,
      timeCost: 4,
      accessibility: 3,
      confidence: 5
    }));
    example.painPoints.push(createPainPoint({
      step: 'Turning notes into themes',
      title: 'Manual synthesis into themes is slow',
      description: 'Important findings stay buried in raw notes and I rewrite the same synthesis by hand.',
      category: 'synthesis',
      tags: 'themes, summary',
      frequency: 4,
      severity: 5,
      timeCost: 5,
      accessibility: 3,
      confidence: 4
    }));
    example.painPoints.push(createPainPoint({
      step: 'Preparing the final share-out',
      title: 'Final brief takes too much reformatting',
      description: 'I have to clean up raw notes, align structure, and rewrite for clarity before sharing.',
      category: 'handoff',
      tags: 'brief, output',
      frequency: 4,
      severity: 4,
      timeCost: 4,
      accessibility: 4,
      confidence: 4
    }));
    example.concepts.push(createConcept({
      painPointId: example.painPoints[1].id,
      name: 'Evidence-backed synthesis workspace',
      approach: 'workspace',
      summary: 'A single surface that clusters research notes into themes and drafts a summary with traceable evidence.',
      accessibilityFeatures: 'Keyboard-only capture, structured headings, visible focus, source trace links.',
      convenienceFeatures: 'Pinned sources, reusable brief template, one-click summary export.',
      value: 5,
      effort: 3,
      accessibilityBenefit: 4,
      convenienceBenefit: 5,
      confidence: 4
    }));
    example.concepts.push(createConcept({
      painPointId: example.painPoints[0].id,
      name: 'Focused research intake board',
      approach: 'assistant',
      summary: 'Capture each source with prompts for relevance, evidence, and follow-up so the review step starts organized.',
      accessibilityFeatures: 'Large hit targets, semantic landmarks, low-distraction reading mode.',
      convenienceFeatures: 'Quick-add entries, source tagging, saved filters.',
      value: 4,
      effort: 2,
      accessibilityBenefit: 4,
      convenienceBenefit: 4,
      confidence: 4
    }));
    log(example, 'Example workflow loaded');
    workflows.unshift(example);
    selectedId = example.id;
    save();
    render();
    announce('Example workflow loaded.');
  }

  function saveAndRender(message) {
    save();
    render();
    if (message) announce(message);
  }

  function exportData(name, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleSelect(id) {
    if (!workflowById(id)) return;
    selectedId = id;
    render();
  }

  el('dashboard-summary').addEventListener('click', function (event) {
    var target = event.target.closest('[data-select]');
    if (target) handleSelect(target.getAttribute('data-select'));
  });

  el('workflow-list').addEventListener('click', function (event) {
    var target = event.target.closest('[data-select]');
    if (target) handleSelect(target.getAttribute('data-select'));
  });

  var view = el('workflow-view');
  view.addEventListener('change', function (event) {
    var workflow = selected();
    var target = event.target;
    if (!workflow) return;

    if (target.dataset.field && WORKFLOW_FIELDS.indexOf(target.dataset.field) >= 0) {
      workflow[target.dataset.field] = target.value;
      touch(workflow);
      log(workflow, 'Updated ' + target.dataset.field.replace(/[A-Z]/g, function (match) { return ' ' + match.toLowerCase(); }));
      saveAndRender('Workflow updated.');
      return;
    }

    if (target.dataset.painId && target.dataset.painField && PAIN_FIELDS.indexOf(target.dataset.painField) >= 0) {
      var painPoint = painById(workflow, target.dataset.painId);
      if (!painPoint) return;
      painPoint[target.dataset.painField] = PAIN_NUMERIC_FIELDS.indexOf(target.dataset.painField) >= 0 ? clampScale(target.value) : target.value;
      touch(workflow);
      log(workflow, 'Updated pain point: ' + painPoint.title);
      saveAndRender('Pain point updated.');
      return;
    }

    if (target.dataset.conceptId && target.dataset.conceptField && CONCEPT_FIELDS.indexOf(target.dataset.conceptField) >= 0) {
      var concept = conceptById(workflow, target.dataset.conceptId);
      if (!concept) return;
      concept[target.dataset.conceptField] = CONCEPT_NUMERIC_FIELDS.indexOf(target.dataset.conceptField) >= 0 ? clampScale(target.value) : target.value;
      touch(workflow);
      log(workflow, 'Updated concept: ' + concept.name);
      saveAndRender('Concept updated.');
    }
  });

  view.addEventListener('submit', function (event) {
    var workflow = selected();
    var form = event.target;
    if (!workflow) return;
    event.preventDefault();

    if (form.dataset.form === 'pain') {
      var painData = new FormData(form);
      var painPoint = createPainPoint({
        step: String(painData.get('step')).trim(),
        title: String(painData.get('title')).trim(),
        description: String(painData.get('description')).trim(),
        category: String(painData.get('category')),
        tags: String(painData.get('tags')).trim(),
        frequency: painData.get('frequency'),
        severity: painData.get('severity'),
        timeCost: painData.get('timeCost'),
        accessibility: painData.get('accessibility'),
        confidence: painData.get('confidence')
      });
      workflow.painPoints.unshift(painPoint);
      touch(workflow);
      log(workflow, 'Added pain point: ' + painPoint.title);
      form.reset();
      saveAndRender('Pain point added.');
      return;
    }

    if (form.dataset.form === 'concept') {
      var conceptData = new FormData(form);
      var concept = createConcept({
        painPointId: String(conceptData.get('painPointId')),
        name: String(conceptData.get('name')).trim(),
        approach: String(conceptData.get('approach')),
        summary: String(conceptData.get('summary')).trim(),
        accessibilityFeatures: String(conceptData.get('accessibilityFeatures')).trim(),
        convenienceFeatures: String(conceptData.get('convenienceFeatures')).trim(),
        value: conceptData.get('value'),
        effort: conceptData.get('effort'),
        accessibilityBenefit: conceptData.get('accessibilityBenefit'),
        convenienceBenefit: conceptData.get('convenienceBenefit'),
        confidence: conceptData.get('confidence')
      });
      workflow.concepts.unshift(concept);
      touch(workflow);
      log(workflow, 'Added concept: ' + concept.name);
      form.reset();
      saveAndRender('Concept added.');
    }
  });

  view.addEventListener('click', function (event) {
    var workflow = selected();
    var target = event.target;
    if (!workflow) return;

    if (target.hasAttribute('data-delete-workflow')) {
      if (!confirm('Delete this workflow permanently?')) return;
      workflows = workflows.filter(function (item) { return item.id !== workflow.id; });
      selectedId = workflows[0] ? workflows[0].id : null;
      saveAndRender('Workflow deleted.');
      return;
    }

    if (target.hasAttribute('data-export-workflow')) {
      exportData(workflow.id + '.json', { version: 1, exportedAt: now(), workflows: [workflow] });
      announce('Workflow exported.');
      return;
    }

    if (target.hasAttribute('data-toggle-pain')) {
      var painPoint = painById(workflow, target.getAttribute('data-toggle-pain'));
      if (!painPoint) return;
      painPoint.status = painPoint.status === 'resolved' ? 'active' : 'resolved';
      touch(workflow);
      log(workflow, (painPoint.status === 'resolved' ? 'Resolved pain point: ' : 'Reopened pain point: ') + painPoint.title);
      saveAndRender('Pain point status updated.');
      return;
    }

    if (target.hasAttribute('data-delete-pain')) {
      var painId = target.getAttribute('data-delete-pain');
      var pain = painById(workflow, painId);
      if (!pain) return;
      workflow.painPoints = workflow.painPoints.filter(function (item) { return item.id !== painId; });
      workflow.concepts = workflow.concepts.filter(function (concept) { return concept.painPointId !== painId; });
      touch(workflow);
      log(workflow, 'Deleted pain point: ' + pain.title);
      saveAndRender('Pain point deleted.');
      return;
    }

    if (target.hasAttribute('data-delete-concept')) {
      var conceptId = target.getAttribute('data-delete-concept');
      var concept = conceptById(workflow, conceptId);
      if (!concept) return;
      workflow.concepts = workflow.concepts.filter(function (item) { return item.id !== conceptId; });
      touch(workflow);
      log(workflow, 'Deleted concept: ' + concept.name);
      saveAndRender('Concept deleted.');
    }
  });

  var dialog = el('new-dialog');
  el('btn-new').addEventListener('click', function () {
    el('new-form').reset();
    dialog.showModal();
  });

  el('new-form').addEventListener('submit', function (event) {
    var submitter = event.submitter;
    if (submitter && submitter.value === 'cancel') return;
    var data = new FormData(event.target);
    var workflow = newWorkflow({
      name: String(data.get('name')).trim(),
      goal: String(data.get('goal')).trim(),
      trigger: String(data.get('trigger')).trim(),
      frequency: String(data.get('frequency')),
      tools: String(data.get('tools')).trim(),
      output: String(data.get('output')).trim(),
      constraints: String(data.get('constraints')).trim()
    });
    workflows.unshift(workflow);
    selectedId = workflow.id;
    saveAndRender('Workflow created.');
  });

  el('btn-example').addEventListener('click', function () {
    addExampleWorkflow();
  });

  el('btn-export').addEventListener('click', function () {
    exportData('caseperfect-workflows.json', { version: 1, exportedAt: now(), workflows: workflows });
    announce('All workflows exported.');
  });

  el('btn-import').addEventListener('click', function () {
    el('file-import').click();
  });

  el('file-import').addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var incoming = Array.isArray(parsed) ? parsed : parsed.workflows;
        if (!Array.isArray(incoming)) throw new Error('Expected an array or { workflows: [] } payload.');

        for (var i = 0; i < incoming.length; i++) {
          var workflow = normalizeWorkflow(incoming[i]);
          if (!workflow) continue;
          workflows = workflows.filter(function (item) { return item.id !== workflow.id; });
          workflows.unshift(workflow);
        }

        selectedId = workflows[0] ? workflows[0].id : null;
        saveAndRender('Import complete.');
      } catch (err) {
        alert('Invalid file: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });

  render();
})();
