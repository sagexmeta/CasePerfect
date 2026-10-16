# CasePerfect

A static, dependency-free web app for mapping research workflows, ranking pain points, and shaping accessible software product concepts.

Open `index.html` in a browser. The app still uses a simple three-file architecture:

- `index.html`
- `styles.css`
- `app.js`

## What it does

- Capture recurring research and note-synthesis workflows
- Score pain points by frequency, severity, time cost, accessibility friction, and confidence
- Surface the greatest pain points automatically
- Draft and compare software product concepts for the top-ranked problems
- Save data in browser `localStorage`
- Export and import workflow data as JSON

## Suggested workflow

1. Create a workflow and describe the trigger, goal, current tools, and output.
2. Add pain points for the steps that feel repetitive, slow, fragmented, or hard to review accessibly.
3. Review the highest pain score and the generated opportunity brief.
4. Add product concepts and compare value, convenience, accessibility benefit, effort, and confidence.

## Advanced Features (research tool)
- **Search**: look up an individual via public sources (Wikipedia API), capture passages with automatic citations, or paste text from any source. Captures are converted to paragraph-style verbiage.
- **Draft**: drag/drop (or ↑/↓) captured items on a canvas, run **Spell/Grammar Check**, and open **Analyze → Advanced Analysis** (sentiment/emotion, tone, themes, summarization, entities, stylometry, argument mapping, readability, cross-document comparison, gap analysis).

Note: analyses and checks are client-side heuristics; web search is limited to CORS-enabled public sources.
