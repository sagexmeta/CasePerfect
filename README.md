# CasePerfect

A static, dependency-free web app for mapping research workflows, ranking pain points, running AI-powered search, and shaping accessible software product concepts.

Open `index.html` in a browser. The app still uses a simple three-file architecture:

- `index.html`
- `styles.css`
- `app.js`

## What it does

- Capture recurring research and note-synthesis workflows
- Score pain points by frequency, severity, time cost, accessibility friction, and confidence
- Surface the greatest pain points automatically
- Run live AI-powered search with the OpenAI Responses API and web search
- Save AI result cards into reusable documents
- Run Focus on any result card to launch a deeper follow-up search
- Draft and compare software product concepts for the top-ranked problems
- Save data in browser `localStorage`
- Export and import workflow data as JSON

## OpenAI setup

1. Open the app in a browser.
2. Paste your OpenAI API key into the **OpenAI API key** field inside the AI research workspace.
3. Pick a Responses model and run a search.

The API key is stored only in your browser `localStorage`. It is not exported with workflow data and should never be committed to the repository.

## Suggested workflow

1. Create a workflow and describe the trigger, goal, current tools, and output.
2. Add pain points for the steps that feel repetitive, slow, fragmented, or hard to review accessibly.
3. Run AI search, review the result cards, and save useful cards into documents.
4. Use **Focus** on promising cards to gather a more targeted second pass of results.
5. Review the highest pain score and the generated opportunity brief.
6. Add product concepts and compare value, convenience, accessibility benefit, effort, and confidence.

## Advanced Features (research tool)

- **Search**: run AI-powered search with the OpenAI Responses API, save cards into documents, use **Focus** for deeper follow-up search, capture useful passages, or paste text from any other source.
- **Draft**: drag/drop (or ↑/↓) captured items on a canvas, run **Spell/Grammar Check**, and open **Analyze → Advanced Analysis** (sentiment/emotion, tone, themes, summarization, entities, stylometry, argument mapping, readability, cross-document comparison, gap analysis).

Note: the advanced analysis and writing checks are client-side heuristics. The live search experience depends on your OpenAI API key and network access.
