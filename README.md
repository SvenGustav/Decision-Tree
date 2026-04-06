# RiskTree

An interactive **Expected Monetary Value (EMV) decision tree builder** for quantitative risk analysis. Model decisions under uncertainty, calculate expected values, identify optimal strategies, and get AI-powered assistance for probability calibration and bias detection — all in the browser.

---

## Features

### Decision Tree Editor
- **Three node types**: Decision (blue square), Chance (green circle), Terminal (orange hexagon)
- Drag-and-drop canvas powered by React Flow — draw edges by dragging between node handles
- Double-click the canvas to add a Decision node at the cursor position
- Delete key removes selected nodes or edges
- Minimap, zoom, and pan controls

### EMV Engine
- **Automatic recalculation** after every edit — no manual refresh needed
- Bottom-up computation: terminals use their payoff, chance nodes compute a weighted sum, decision nodes pick the maximum branch
- **Optimal path highlighting** — the best branch at every Decision node is marked in real time

### Probability Management
- Chance node branches **must sum to exactly 100%** — the Properties panel enforces this with a live progress bar and warnings
- One-click normalization to fix imbalanced probabilities
- Bayesian posterior revision engine included

### Sensitivity Analysis
- **Risk Profile** — enumerates every root-to-terminal path and charts the probability distribution of outcomes
- **Tornado Chart** — ±20% parameter sweep to rank which probabilities and payoffs have the most impact on root EMV
- Interactive charts via Recharts

### AI Assistant (LM Studio)
- Connect to a local **LM Studio** server (OpenAI-compatible API)
- Streaming responses with a live typing indicator
- **Structured output mode** — forces the model to respond with a validated JSON schema so it can directly modify your tree
- Two action types:
  - `build_tree` — AI builds an entirely new tree from scratch and places it on the canvas
  - `update_tree` — AI patches specific node/edge values (probabilities, payoffs, labels) by ID
- Quick prompts:
  - *Review my probabilities* — flag unrealistic estimates and suggest calibrations
  - *Check for biases* — identify optimism bias, overconfidence, anchoring, and similar issues
  - *Explain the EMV* — walk through the full calculation and optimal decision
  - *Suggest improvements* — identify missing branches or scenarios
- Settings panel: configure base URL, model name, and toggle structured output on/off
- Built-in copy button for the LM Studio system prompt

### Save & Load
- Export the current tree as a timestamped JSON file (`risktree-YYYY-MM-DD.json`)
- Import any previously saved tree file
- Tree is also **auto-saved to localStorage** (debounced, 1 s) so you never lose work

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Graph canvas | @xyflow/react 12 |
| State | Zustand 5 |
| Charts | Recharts 3 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other commands

```bash
npm run build    # Type-check + production build
npm run preview  # Preview the production build
npm run lint     # ESLint
```

### AI assistant setup

1. Install and open [LM Studio](https://lmstudio.ai/)
2. Download a model and start the local server (default: `http://localhost:1234`)
3. In the app, click the **AI** button in the toolbar
4. Open **Settings**, enter your base URL and model name, then save
5. Optionally enable **Structured Output** and load `risktree-structured-output.json` into your LM Studio model's structured output configuration

---

## How It Works

The tree is stored as React Flow `nodes` and `edges` in a Zustand store. After every mutation the EMV engine does a depth-first traversal from leaves to root, computes expected values, and marks the optimal path. The result is written back into node data and React re-renders only the affected nodes.

The AI patch pipeline works by parsing the model's JSON response (either via structured output or regex extraction from free text), converting the nested `tree` object into React Flow nodes and edges with auto-computed layout, or applying `changes` as targeted mutations to existing nodes and edges.
