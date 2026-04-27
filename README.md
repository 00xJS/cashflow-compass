# Cashflow Compass

> Navigate your cashflow — up to 36 months out.

A single-page personal budgeting and forecasting app. Plan up to 36 months ahead, model income at any cadence (including bi-weekly), see where every dollar goes, and round-trip your full state through an Excel workbook so the spreadsheet itself is a portable backup.

Part of the [Observation Deck](https://observation-deck.netlify.app/) family of personal-finance tools.

No build step, no backend, no account sign-up — open `index.html` and start budgeting. Your data lives in your browser's LocalStorage and travels with you via the workbook you export.

---

## Quick start

1. Open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge), **or** deploy the folder to Netlify (drag-and-drop or `netlify deploy`).
2. **Add an account** — give it a starting balance and the date that balance was true ("as of"). Add as many as you like (checking, savings, credit, investment, cash).
3. **Add transactions** — recurring or one-time, income / expense / transfer, with the frequency that matches reality (bi-weekly paycheck, monthly rent, annual insurance, etc.).
4. Scroll down — the **Forecast grid**, **Charts**, and **Insights** populate automatically.
5. Click **`⬇ Excel`** any time to back up; click **`⬆ Excel`** later to restore.

---

## Features

### Accounts
- Multiple accounts with type (checking / savings / credit card / investment / cash)
- Starting balance + as-of date — net worth snapshot is what the forecast builds from
- Credit card balances are treated as liabilities (subtracted from net)

### Categories
- 18 sensible defaults, grouped by **kind**: Income · Fixed · Variable · Discretionary · Savings · Debt · Tax
- Includes Home Internet, Electric, Phone Bill out of the box
- Add / edit / delete your own; pick any color
- Click **Name** or **Kind** column headers to sort A→Z (click again for Z→A)

### Transactions
- Nine frequency options:
  - One-time, Weekly, **Bi-weekly** (26/yr, automatically produces the 3-paycheck months), Semi-monthly (1st & 15th), Monthly, Quarterly, Semi-annual, Annual, Custom (every *N* days / weeks / months)
- Optional end date — model a sublease, contract end, or seasonal expense
- **Pause / resume** without deleting (gym cancelled for 3 months, then back on)
- **Annual escalation %** — model rent renewals, raises, COL adjustments
- **Tags** for cross-cutting analysis ("kid", "work-reimbursable")
- **Notes** on any transaction
- **Duplicate** with one click for quick variants
- **Search + filters** by kind and category
- Sortable columns: Name, Amount, Start, Annualized

### Forecast horizons
- Five horizon presets: **End of Year**, **12**, **18**, **24**, **36** months
- Forecast grid title shows both month count and date range, e.g. *"9-Month Forecast (through Dec 26)"*
- Each chart has its own independent horizon dropdown — override one chart without affecting the others

### Forecast grid
- Rows grouped by category kind (Income → Fixed → Variable → Discretionary → Savings → Debt → Tax)
- **Fixed** group is auto-organized: monthly subscriptions first (highest dollar first), then annual subscriptions (highest first), then everything else
- Per-month columns plus a Total column on the right
- Summary rows at the bottom: Total Income, Total Expenses, Net Cash Flow, End-of-Month Balance
- Negative balances flagged in red so cash crunches jump out

### Visualizations (six charts)
| Chart | What it shows |
|---|---|
| **Monthly Income vs Expenses** | Side-by-side bars per month with a Net cash-flow line overlay |
| **Running Balance** | Projected balance month-by-month, area-filled |
| **Spend by Category** | Doughnut breakdown of where expenses go |
| **Category Trend (stacked)** | How each category's spend evolves over time |
| **Top 10 Costs** | Largest individual line items over the chosen horizon |
| **Income Sources** | Doughnut breakdown of where income comes from |

Every chart has its own horizon dropdown — you can keep most charts on the global setting and override one or two ("show Running Balance for 36 months but everything else for End of Year"). Hover any chart for tooltips formatted as proper currency (`$1,234.56`).

### Insights panel (auto-generated)
1. **Average Savings Rate** — what % of income you keep across the horizon
2. **Biggest Category** — single largest expense category as a % of total spend
3. **Annual Subscription Cost** — annualized burn for everything in the Subscriptions category
4. **Emergency Fund Coverage** — months of runway from your starting balance at current spend rate
5. **Days in the Red** — count of forecast days the balance dips below zero, plus lowest point
6. **3-Paycheck Months** — flagged for bi-weekly income streams (windfall planning)
7. **What if you cut [biggest category] by 20%** — projected horizon savings
8. **Projected end balance** — where you land at the end of the horizon

### Excel export / import
Five sheets:

| Sheet | Purpose |
|---|---|
| `Accounts` | id, name, type, startingBalance, asOfDate |
| `Categories` | id, name, kind, color |
| `Transactions` | id, name, kind, amount, categoryId, accountId, fromAccountId, frequency, customN, customUnit, startDate, endDate, escalation, tags (semicolon-separated), notes, paused |
| `Settings` | schemaVersion, currency, forecastHorizon, theme |
| `Forecast` | rendered projection (read-only — export only) |

**Re-import semantics: replace all.** The workbook is the source of truth. Importing a file wipes whatever is in your browser and reloads from the spreadsheet. A confirmation dialog warns you before any overwrite. Edit amounts in Excel, re-import, and the new numbers ripple through the forecast and charts.

### JSON export / import
Lighter alternative if you want to share state without opening Excel. Same replace-all semantics. Use the **`{ JSON }`** and **`⇪ JSON`** buttons in the header.

### Persistence and privacy
- All data is stored in your browser's **LocalStorage** with debounced auto-save
- Nothing leaves your machine — no analytics, no servers, no third parties
- **Reset** button (trash icon) wipes everything after a confirmation; export first if you want a backup

### Quality-of-life
- **Dark mode** toggle
- **Currency selector** (USD / EUR / GBP / CAD / AUD / JPY)
- **Collapsible sections** — Categories, Transactions, Forecast, and Visualizations can each be collapsed to keep the page tidy
- **Empty-state welcome banner** with a "Load sample data" button to explore the app instantly
- Mobile-responsive layout
- All forms validate inline; required fields are clearly marked

---

## Tech stack

- A single `index.html` — vanilla HTML / CSS / JS, no framework
- [Chart.js](https://www.chartjs.org/) for visualizations (loaded from CDN)
- [SheetJS](https://sheetjs.com/) for Excel read/write (loaded from CDN)
- Netlify for static hosting (`netlify.toml` included)
- No build step, no package manager, no Node required

---

## Schema versions

The app migrates older data forward automatically. You don't need to do anything — your existing state is upgraded on next load.

- **v1** — initial release
- **v2** — broader category color palette (each kind no longer all-blue); v1 default colors are auto-refreshed, custom colors preserved
- **v3** — `forecastMonths` (number) replaced by `forecastHorizon` (string token, supports `eoy`); `chartHorizons` map added for per-chart overrides

---

## Roadmap (deferred)

- Debt avalanche / snowball payoff calculator for credit and loan accounts
- Goal & sinking-fund tracking with ETA based on current savings rate
- Pay-vs-bills calendar heatmap (which weeks are tightest)

---

## Contributing

Single-file project. Edit `index.html` and refresh the browser. Sample run:

```bash
# Local preview (any static server works)
python3 -m http.server 8000
# then open http://localhost:8000/
```

Pull requests welcome.

---

[Observation Deck](https://observation-deck.netlify.app/) | [GitHub](https://github.com/00xJS/cashflow-compass)
