# Cashflow Compass

> Navigate your cashflow — up to 36 months out.

**[Live demo →](https://cashflow-comp.netlify.app/)**

A personal budgeting and forecasting app that runs entirely in your browser. Plan up to 36 months ahead, model income at any cadence (including bi-weekly), see where every dollar goes, and round-trip your full state through an Excel workbook so the spreadsheet itself is a portable backup.

Part of the [Observation Deck](https://observation-deck.netlify.app/) family of personal tools.

No build step, no backend, no account sign-up, no network requests — open `index.html` and start budgeting. Everything, including the two vendored libraries, is served from the folder, so the app works fully offline. Your data lives in your browser's LocalStorage and travels with you via the workbook you export.

A **[Getting Started guide](guide.html)** is built into the app (linked in the header) and covers every feature in depth — accounts and transfers, categories, transaction frequencies, search and sorting, the forecast grid, charts, insight cards, the Excel round-trip, settings, and pro tips.

<!-- Screenshot placeholder — no image file is committed yet. -->
> **📸 Screenshot wanted.** Save a capture of the forecast grid with the charts below it to `docs/screenshot.png`, then replace this block with:
> `![Cashflow Compass — forecast grid and charts](docs/screenshot.png)`

---

## Quick start

1. Try the [live demo](https://cashflow-comp.netlify.app/), **or** open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge), **or** deploy the folder to Netlify (drag-and-drop or `netlify deploy`). All three are the same app; your data stays in whichever browser you used.
2. **Add an account** — give it a starting balance and the date that balance was true ("as of"). The forecast counts money forward from the latest as-of date across your accounts, so anything already paid before that date isn't replayed on top of the balance you entered. Add as many accounts as you like (checking, savings, credit, investment, cash).
3. **Add transactions** — recurring or one-time, income / expense / transfer, with the frequency that matches reality (bi-weekly paycheck, monthly rent, annual insurance, etc.).
4. Scroll down — the **Forecast grid**, **Charts**, and **Insights** populate automatically.
5. Click **`⬇ Excel`** any time to back up; click **`⬆ Excel`** later to restore.

---

## Features

### Accounts
- Multiple accounts with type (checking / savings / credit card / investment / cash)
- Starting balance + as-of date; the forecast anchors to the latest as-of date and counts forward from there
- **Per-account balances** — every transaction is assigned to an account, and the forecast tracks each account separately as well as in total
- **Transfers actually move money** — pick a from-account and a to-account; net cash flow is unchanged, but the two balances move
- Credit cards are liabilities: subtracted from net worth, excluded from liquid cash, and they **accrue interest** at the APR you set instead of sitting frozen. Record the card's minimum payment alongside it
- Card payments are modelled as a transfer from a cash account to the credit account; an expense charged to the card raises the card balance rather than reducing cash
- **Payoff projection** — from each card's APR and minimum payment, when it clears and what the interest costs, paying the highest APR down first (avalanche)
- Net worth and **liquid cash** are tracked separately — the red-balance warnings watch liquid cash, so a brokerage balance can't mask an overdrawn checking account

### Categories
- 18 sensible defaults, grouped by **kind**: Income · Fixed · Variable · Discretionary · Savings · Debt · Tax · Goal
- Includes Home Internet, Electric, Phone Bill out of the box
- Add / edit / delete your own; pick any color. Deleting a category that's in use asks where to move its transactions and reassigns them as part of the delete
- The **Goal** kind has no default category — create your own for a deposit, a wedding, a trip
- Click **Name** or **Kind** column headers to sort A→Z (click again for Z→A)

### Transactions
- Nine frequency options:
  - One-time, Weekly, **Bi-weekly** (26/yr, automatically produces the 3-paycheck months), Semi-monthly (24/yr; the pair of days is derived from your start date — 1st → 1st & 15th, 15th → 15th & month end, anything else → that day ± 15, clamped in short months), Monthly, Quarterly, Semi-annual, Annual, Custom (every *N* days / weeks / months)
- Optional end date — model a sublease, contract end, or seasonal expense
- **Pause / resume** without deleting (gym cancelled for 3 months, then back on)
- **Annual escalation %** — model rent renewals, raises, COL adjustments
- **Tags** for cross-cutting analysis ("kid", "work-reimbursable")
- **Notes** on any transaction
- **Duplicate** with one click for quick variants
- **Search** across name, tags, and notes, plus filters by kind and category (they stack)
- Sortable columns: Name, Amount, Start, Annualized — click to toggle A→Z / Z→A
- **Next** column showing each transaction's next occurrence date

### Forecast horizons
- Five horizon presets: **End of Year**, **12**, **18**, **24**, **36** months
- Forecast grid title shows both month count and date range, e.g. *"9-Month Forecast (through Dec 26)"*
- Each chart has its own independent horizon dropdown — override one chart without affecting the others

### Forecast grid
- Rows grouped by category kind (Income → Fixed → Variable → Discretionary → Savings → Debt → Tax → Goal), with an Other group catching rows whose category has gone missing; empty groups are skipped
- **Fixed** group auto-organizes itself into three frequency buckets — weekly / bi-weekly / semi-monthly / monthly / quarterly first, then semi-annual and annual, then one-time and custom — and sorts each bucket by the raw amount on the transaction (not the annual total, not escalation-adjusted), largest first. So a $900 monthly rent leads the group, and a $1,200 annual insurance premium sorts below a $12 monthly subscription because they're in different buckets — periodic bills stay together instead of being scattered by size.
- Per-month columns plus a Total column on the right
- Summary rows at the bottom: Total Income, Total Expenses, Net Cash Flow, **End-of-Month Cash** (spendable), and **Net Worth** — net worth can climb while cash falls, which is why both are shown
- Negative cash flagged in red so crunches jump out

### Visualizations (six charts)
| Chart | What it shows |
|---|---|
| **Monthly Income vs Expenses** | Side-by-side bars per month with a Net cash-flow line overlay |
| **Running Balance** | Projected balance month-by-month, area-filled |
| **Spend by Category** | Doughnut breakdown of where expenses go |
| **Category Trend (stacked)** | How each category's spend evolves over time |
| **Top 10 Costs** | The 10 individual expense lines that cost the most over the chosen horizon (window totals, not annualized — the ranking shifts when you change the horizon) |
| **Income Sources** | Doughnut breakdown of where income comes from |

Every chart has its own horizon dropdown — you can keep most charts on the global setting and override one or two ("show Running Balance for 36 months but everything else for End of Year"). Hover any chart for tooltips formatted as proper currency (`$1,234.56`).

### Insights panel (auto-generated)

**Cards appear only where your data supports them**, and an empty budget produces **no cards at all**. Most are conditional — no income stream means no savings rate, no subscriptions means no subscription card — while a few always report once you have data, stating the all-clear ("0 days", "None forecast") when there's nothing to flag.

- **Savings Rate** — what % of income you actually keep; money moved to savings, a goal, or debt principal counts as kept, not spent
- **Biggest Category** — single largest expense category as a % of total spend
- **Fixed vs Variable** — share of everyday spending that's committed (Fixed) versus flexible (Variable + Discretionary)
- **Annual Subscription Cost** — annualized subscription burn, matched by the Subscriptions category, any Fixed category named after subscriptions, or a `subscription` tag
- **Emergency Fund** — liquid cash against four tiers ($1,000 starter buffer → 6 weeks of take-home → 3 months of expenses → 6 months), showing the tier you're past and the gap to the next
- **Days in the Red** — count of forecast days your *liquid cash* dips below zero, plus the lowest point
- **First Shortfall** — the exact date liquid cash first drops below zero, and how many days away it is
- **Tightest Week** — the worst seven-day net cash-flow window, i.e. how much to keep in reserve
- **Best Month / Worst Month** — strongest and weakest months by net cash flow (horizons of 2+ months)
- **3-Paycheck Months** — flagged per bi-weekly income stream (windfall planning)
- **If you cut [category] by 20%** — targets your biggest *discretionary* category (then variable, then largest), since "spend less on rent" isn't advice
- **Projected cash** — liquid cash at the end of the horizon and the change from today

### Excel export / import
Five sheets:

| Sheet | Purpose |
|---|---|
| `Accounts` | id, name, type, startingBalance, asOfDate, apr, minPayment |
| `Categories` | id, name, kind, color |
| `Transactions` | id, name, kind, amount, categoryId, accountId, fromAccountId, frequency, customN, customUnit, startDate, endDate, escalation, tags (semicolon-separated), notes, paused |
| `Settings` | schemaVersion, currency, forecastHorizon, plus one `chartHorizon.<chart>` row per per-chart override — so a re-import restores the view you left, not just the numbers |
| `Forecast` | Rendered projection, export-only (written on export, ignored on import): one row per transaction — name, its **category**, a column per month, and a total — followed by the income, expense, net cash flow and closing balance summary rows |

**Re-import semantics: replace all.** The workbook is the source of truth. Importing a file wipes whatever is in your browser and reloads from the spreadsheet. A confirmation dialog warns you first and the result offers **Undo**. Nothing in a file is trusted: every field is type-checked and every reference validated, and anything skipped or repaired is reported back as import notes. Edit amounts in Excel, re-import, and the new numbers ripple through the forecast and charts.

### JSON export / import
Lighter alternative if you want to share state without opening Excel. Same replace-all semantics. Use the **`{ JSON }`** and **`⇪ JSON`** buttons in the header.

### Persistence and privacy
- All data is stored in your browser's **LocalStorage** with debounced auto-save
- **The app makes no network requests.** No fetch, no analytics, no telemetry, no CDN, no external fonts or images — Chart.js and SheetJS are vendored in `vendor/` and loaded from disk. Nothing to leak, nothing to block, and it runs fully offline from `file://`
- **It will never link to a bank.** No Plaid, no open banking, no OAuth, no credentials — a deliberate design choice, not a missing feature. Reading a statement file *you* downloaded yourself is a different thing and is on the roadmap
- **Reset** button (trash icon), behind a confirmation, clears every account and transaction and returns settings to their defaults — and **restores the 18 default categories**, including any you renamed or deleted. A clean slate, not an empty one; export first if you want a backup

### Quality-of-life
- **Observation Deck dark theme** — the shared "mission control" design language used across the deck
- **Currency selector** (USD / EUR / GBP / CAD / AUD / JPY) — changes formatting only; amounts are relabelled, never converted
- **Export-age indicator** — the header shows *Exported today* / *Exported 12d ago* / *Never exported*, and nags with both export buttons once it's been over a month
- **Single-level undo** — deleting an account, category, or transaction offers an Undo button in the status message, restoring any reassignments too
- **Collapsible sections** — Categories, Transactions, Forecast, and Visualizations can each be collapsed to keep the page tidy
- **Empty-state welcome banner** with a "Load sample data" button to explore the app instantly
- Mobile-responsive layout
- All forms validate inline; required fields are clearly marked

---

## Tech stack

Vanilla HTML / CSS / JS, no framework. Five files do the work:

| File | Contains |
|---|---|
| `index.html` | Markup, CSS (Observation Deck design tokens), and the `<script src>` tags — no inline logic |
| `engine.js` | Pure forecast logic with no DOM access: the schema, date and frequency maths, `buildForecast`, `computeInsights`, formatting |
| `app.js` | The DOM layer: storage, rendering, charts, import/export, event wiring |
| `guide.html` | The built-in Getting Started guide (deliberately script-free) |
| `tests.html` | Browser test suite exercising `engine.js` — open it, no build step, no runner to install |

- Both scripts are **classic scripts sharing global scope** — no ES modules, no imports, so `file://` keeps working
- [Chart.js](https://www.chartjs.org/) 4.4.4 and [SheetJS](https://sheetjs.com/) 0.20.3 are **vendored in `vendor/`** and loaded locally; notices in [`vendor/LICENSES.md`](vendor/LICENSES.md)
- Netlify for static hosting (`netlify.toml` included)
- No build step, no package manager, no `package.json`, no Node required

---

## Schema versions

The app migrates older data forward automatically. You don't need to do anything — your existing state is upgraded on next load.

- **v1** — initial release
- **v2** — broader category color palette (each kind no longer all-blue); v1 default colors are auto-refreshed, custom colors preserved
- **v3** — `forecastMonths` (number) replaced by `forecastHorizon` (string token, supports `eoy`); `chartHorizons` map added for per-chart overrides
- **v4** — Observation Deck theme: dark-only design tokens; the `theme` setting is removed (any stored preference is dropped on load), and default category colors are re-skinned to the deck palette (custom colors preserved)
- **v5** — `account.apr` and `account.minPayment` added so credit cards accrue interest instead of sitting as a static balance; `settings.lastExportAt` records when you last exported, driving the export-age indicator. Existing accounts default to no APR, so v4 forecasts are unchanged until you fill the fields in

---

## Roadmap (deferred)

- Pay-vs-bills calendar heatmap (which weeks are tightest at a glance — the Tightest Week insight covers the headline, not the calendar)
- Import a statement file you downloaded from your bank yourself (CSV / OFX). No credentials, no aggregator, no live connection — that stays off the table permanently
- Actuals vs. plan: record what really happened and compare it against the forecast

Landed rather than deferred: credit-card interest and payoff maths (schema v5), and goal / sinking-fund categories via the **Goal** kind.

---

## Contributing

No build step and no dependencies to install — edit a file and refresh the browser.

| Editing | File |
|---|---|
| Markup, CSS, design tokens | `index.html` |
| Forecast maths, schema, migrations, insights | `engine.js` |
| Rendering, storage, charts, import/export, events | `app.js` |
| The Getting Started guide | `guide.html` |
| Engine tests | `tests.html` |

House rules worth knowing before you open a PR:

- **Nothing may leave the machine.** No `fetch`, `XMLHttpRequest`, WebSocket, `sendBeacon`, external fonts, images, or scripts. New dependencies get vendored into `vendor/` with a notice in `vendor/LICENSES.md`, or they don't land
- **No build step, no `package.json`, no ES modules** — `engine.js` and `app.js` are classic scripts sharing global scope so opening `index.html` from disk keeps working
- **`engine.js` stays DOM-free**, which is what lets `tests.html` exercise it directly
- **Never link to a real financial account** — see [Persistence and privacy](#persistence-and-privacy)

```bash
# Local preview (any static server works)
python3 -m http.server 8000
# then open http://localhost:8000/  — and http://localhost:8000/tests.html for the suite
```

Pull requests welcome.

---

## License

[MIT](LICENSE) — do what you like with it, no warranty.

---

[Live demo](https://cashflow-comp.netlify.app/) · [Observation Deck](https://observation-deck.netlify.app/) · [GitHub](https://github.com/00xJS/cashflow-compass)
