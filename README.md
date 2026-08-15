# Cashflow Compass

> Navigate your cashflow — up to 36 months out.

**[Live demo →](https://cashflow-comp.netlify.app/)**

A personal budgeting and forecasting app that runs entirely in your browser. Plan up to 36 months ahead, model income at any cadence (including bi-weekly), see where every dollar goes, and round-trip your plan through an Excel workbook so the spreadsheet itself is a portable backup.

It is a **forecasting** app first: you describe the money you expect to move, and it projects that forward. It can also check that forecast against reality — record what an account actually holds today, or open a transaction file you downloaded from your own bank yourself — and tell you where the plan and the world have drifted apart. That is the whole of its contact with the outside world: **it never links to a financial account, and it never will.**

Part of the [Observation Deck](https://observation-deck.netlify.app/) family of personal tools.

No build step, no backend, no account sign-up, no network requests — open `site/index.html` and start budgeting. Everything, including the two vendored libraries, is served from the folder, so the app works fully offline. Your data lives in your browser's LocalStorage and travels with you via the file you export.

A **[Getting Started guide](site/guide.html)** is built into the app (linked in the header) and covers every feature in depth — accounts and transfers, the credit-card model, categories, frequencies, the forecast grid, charts, insights, check-ins, importing your bank's file, plan-vs-actual, the debt planner, goals, the bills calendar, scenarios, backups and encryption, and pro tips.

![Six charts — income against expenses, projected running balance, spend and income by category, a stacked category trend and the ten largest costs — above a panel of auto-generated insight cards reading 49.6% savings rate, housing as the biggest category, 67.4% of spend in the top three, 7.6 months of emergency fund, zero days in the red and $40,291 projected cash](docs/screenshot.png)

---

## Quick start

1. Try the [live demo](https://cashflow-comp.netlify.app/), **or** open `site/index.html` in any modern browser (Chrome, Safari, Firefox, Edge), **or** deploy the `site/` folder to Netlify (drag-and-drop or `netlify deploy`). All three are the same app; your data stays in whichever browser you used.
2. **Add an account** — give it a starting balance and the date that balance was true ("as of"). The forecast counts money forward from the latest as-of date across your accounts, so anything already paid before that date isn't replayed on top of the balance you entered. Add as many accounts as you like (checking, savings, credit, investment, cash).
3. **Add transactions** — recurring or one-time, income / expense / transfer, with the frequency that matches reality (bi-weekly paycheck, monthly rent, annual insurance, etc.).
4. Scroll down — the **Forecast grid**, **Charts**, and **Insights** populate automatically.
5. Click **`⬇ Excel`** any time to back up; click **`⬆ Excel`** later to restore.

Then, once the plan is roughly right and you want to know how honest it is:

6. **Record a balance check-in** — type in what an account actually holds today and the app shows the gap between the forecast and reality.
7. **Import a transaction file** you downloaded from your own bank (CSV, OFX/QFX, QIF, camt.053) and read the plan-vs-actual comparison. No credentials, no connection — see [Importing actuals](#importing-actuals-from-a-file-you-downloaded-yourself).

---

## Features

### Accounts
- Multiple accounts with type (checking / savings / credit card / investment / cash)
- Starting balance + as-of date; the forecast anchors to the latest as-of date and counts forward from there
- **Per-account projected balances** — every transaction is assigned to an account, and the forecast tracks each account's balance month by month as well as the combined totals, so you can see checking run thin while savings climbs
- **Transfers actually move money** — pick a from-account and a to-account; the two balances move while net cash flow is unchanged, which is also why a transfer never takes a row in the forecast grid. Watch it in Balances by Account instead
- Credit cards are liabilities: subtracted from net worth, excluded from liquid cash, and they **accrue interest** at the APR you set instead of sitting frozen. **APR %** and **Minimum Payment** are fields on the account form; both are read only for credit accounts and ignored on every other type
- **A minimum payment on file gets paid.** If nothing in your plan transfers money to that card, the forecast pays the minimum each month out of your largest liquid account rather than letting the balance compound forever while the payoff planner insists it clears. A payment you modelled yourself always wins — the assumed one is never added on top of it — and the Balances by Account panel marks any card whose payment was assumed rather than entered
- Net worth and **liquid cash** are tracked separately — the red-balance warnings watch liquid cash, so a brokerage balance can't mask an overdrawn checking account
- **Balance check-ins** measure an account's projection against what it really holds — see [Balance check-ins](#balance-check-ins)

### The credit-card model, by worked example

This is the part that trips everyone up, so here it is in numbers. Cards behave the way real cards do: **an expense charged to a card raises the card's balance; a payment is a transfer from cash to the card.**

Start with Checking at **$3,000** and a Visa with **$1,200 owed**, 22% APR, $35 minimum. Net worth is $3,000 − $1,200 = **$1,800**.

| What happens | How you record it | Checking | Visa owed | Net worth |
|---|---|---:|---:|---:|
| Starting point | — | $3,000 | $1,200 | $1,800 |
| $400 of groceries charged to the Visa | **Expense**, account = Visa | $3,000 | $1,600 | $1,400 |
| A month's interest at 22% APR on $1,600 | automatic, from the card's APR | $3,000 | $1,629 | $1,371 |
| You pay the card $500 from checking | **Transfer**, from Checking → Visa | $2,500 | $1,129 | $1,371 |

Two things to read off that table:

- **The groceries cost you $400 the moment you swiped**, even though no cash moved. Net worth dropped; liquid cash didn't.
- **The payment cost you nothing.** Net worth is identical before and after — you moved $500 from one pocket to a debt you already owed. Cash fell, the card fell, they cancel.

That is why a card payment is a transfer and not an expense. If you record the groceries *and* log the $500 payment as an expense, you have charged yourself for the same groceries twice and your forecast is wrong by $500 a month.

**Pick one lane per card:**
- *Detailed* — record purchases against the card and pay it down with transfers. The card balance and interest are modelled properly, and if you never model a payment the minimum on file is applied for you. Best if you carry a balance.
- *Simple* — don't record card purchases at all; model just the monthly payment as an expense in a Debt category. Fast, but nothing tracks what the card actually owes. **Leave that card's Minimum Payment blank in this lane** — an expense in a Debt category isn't attached to the card, so a minimum left on file would be paid a second time on top of the one you modelled. Fine if you clear the card every month.

### Categories
- 19 sensible defaults, grouped by **kind**: Income · Fixed · Variable · Discretionary · Savings · Debt · Tax · Goal
- Includes Home Internet, Electric, Phone Bill out of the box, and a **Savings Goal** category for the Goal kind
- Add / edit / delete your own; pick any color. Deleting a category that's in use asks where to move its transactions and reassigns them as part of the delete
- **Move a category's transactions without deleting it** — the ⇄ button on any category that's in use re-files everything under it somewhere else and leaves the category itself standing
- **Goal** categories are made in the Savings Goals panel rather than from this form, which is also where a goal's target amount and optional target date live. Once created they behave like any other category here — see [Goals and sinking funds](#goals-and-sinking-funds)
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
- **Transfers take no row here.** Money moved between your own accounts is neither income nor spending, so every month's figure on such a row is zero by construction and the row is dropped rather than padded out with zeroes. The money still moves — see it in Balances by Account, and in goal progress when the transfer is filed under a Goal category
- Per-month columns plus a Total column on the right
- Summary rows at the bottom: Total Income, Total Expenses, Net Cash Flow, **End-of-Month Cash** (spendable), and **Net Worth** — net worth can climb while cash falls, which is why both are shown
- Negative cash flagged in red so crunches jump out

### Visualizations (six charts)
| Chart | What it shows |
|---|---|
| **Monthly Income vs Expenses** | Side-by-side bars per month with a Net cash-flow line overlay |
| **Running Balance** | Projected balance month-by-month — one area-filled line on its own, with a dashed [confidence corridor](#confidence-bands) around it once a category has three full months of imported actuals |
| **Spend by Category** | Doughnut breakdown of where expenses go |
| **Category Trend (stacked)** | How each category's spend evolves over time |
| **Top 10 Costs** | The 10 individual expense lines that cost the most over the chosen horizon (window totals, not annualized — the ranking shifts when you change the horizon) |
| **Income Sources** | Doughnut breakdown of where income comes from |

Every chart has its own horizon dropdown — you can keep most charts on the global setting and override one or two ("show Running Balance for 36 months but everything else for End of Year"). Hover any chart for tooltips formatted as proper currency (`$1,234.56`).

### Insights panel (auto-generated)

**Cards appear only where your data supports them**, and an empty budget produces **no cards at all**. Most are conditional — no income stream means no savings rate, no subscriptions means no subscription card — while a few always report once you have data, stating the all-clear ("0 days", "None forecast") when there's nothing to flag.

- **Savings Rate** — what % of income you actually keep; spending you file under a Savings, Goal or Debt category counts as kept, not spent
- **Biggest Category** — single largest expense category as a % of total spend
- **Spend Concentration** — the share of all spending carried by your top three categories, once there are at least four to compare. One big category says little; whether three of them carry most of the outflow says whether the plan turns on a few large levers or is spread thin
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

### Balance check-ins

A forecast built on a balance you typed in three weeks ago is a forecast with a hole in it. A **check-in** patches it: pick an account, type what it actually holds today, done.

The app then shows you the **drift** — what the forecast said that account would hold on that date, what it really holds, and the difference in both money and percent, per account and in total. Drift isn't a scolding; it's a measurement. Persistent drift in one direction usually means a real transaction is missing from the plan, or an amount is stale.

- Only the **latest** check-in per account feeds the drift; older ones are kept as history. Averaging them would blunt the signal
- The combined total is read in **net-worth terms**, so a card balance counts against the pile rather than cancelling out a current account
- **Forecast vs reality over time** — from the second reading on an account, the history is plotted as what the forecast said against what you had, so you can see whether the drift is widening or closing
- A check-in measures the gap; it doesn't rewrite your accounts on its own. **Re-anchor** does, in one click: the account's starting balance becomes the figure you recorded and its as-of date becomes the day you recorded it, after a confirmation that spells out both numbers. Everything from there forward is then projected from something you have actually seen

### Importing actuals from a file you downloaded yourself

Banks let you download your own transactions. The app reads that file.

- **Formats:** CSV, OFX, QFX, QIF, and camt.053 (ISO 20022 XML)
- **Four steps, nothing written until the last one** — which account, does this look like your statement, point the columns at the right fields, check what is about to be added
- **Mapping wizard for CSV** — you point at the date column, the payee column, and either one signed amount column or a separate money-out / money-in pair, with a sign flip for banks that export outgoings as positives. The mapping is **remembered per account** and pre-applied next time
- **Ambiguous dates are asked about, not guessed** — a column full of `03/04/2026` values could be 3 April or 4 March, and quietly picking one would silently corrupt a year of history. The app says which reading the file's own values support and makes you choose; unambiguous files don't interrupt
- **Duplicate detection, in three piles** — *new*, *already imported* (skipped), and *possible duplicates* (same amount within three days, presented as tickboxes for you to decide). Rows carrying an `FITID` (OFX/QFX/QIF) are keyed on it; rows without one get a stable content hash of date, amount and payee
- **Categories suggested, never invented** — a new row is filed by matching payees you've categorised before; anything unrecognised is left uncategorised rather than guessed at. A currency mismatch is reported, and amounts are imported exactly as written with no conversion
- **Matching** — imported rows are matched against planned transactions within a date window, so "the rent I planned for the 1st" and "the rent that cleared on the 3rd" are understood to be the same event
- **The last step is the one that matters** — the review is where you set each row's category (one at a time, or all of them at once) and untick anything you'd rather not record. The app has no per-row editor for recorded rows afterwards; to fix or drop one later, edit the `Actuals` sheet of an Excel export and import it back

**This is not a bank connection, and it is not a step toward one.**

- No credentials are asked for, stored, or transmitted. There is no login form and no password field
- No Plaid, no SimpleFIN, no GoCardless, no open banking, no OAuth to any institution, no aggregator of any kind
- Nothing is uploaded. The file is read in the browser from your disk, by you, with a file picker. The app makes no network requests at all
- OFX and QFX files can contain a `<SONRQ>` block with the username and password your bank's software used. **Those fields are discarded at the parse boundary** — they are never stored in your state, never written to an export, and never displayed

The distinction is simple: *you* downloaded a file, and you opened it. Nothing reached out to anyone.

### Plan vs actual

Once you have actuals, the app compares them with the plan over the same period:

- **By category** — planned versus actual, the delta in money and percent, and how many months of evidence the comparison rests on
- **By month** — planned versus actual net, so you can see whether a bad month was a blip or a pattern
- **Recalibration prompts** — where a category's real spending has been consistently different from the plan, a card offers to update the planned amount to what you actually spend, tagged *early days* / *fair evidence* / *strong evidence* according to how many months back it. Accepting shows every planned line it would rewrite, from what to what, before it does anything — and it's undoable

The framing here is deliberate. Being over on groceries three months running isn't a moral failure, it's a signal that the number in your plan is wrong. A budget you keep missing isn't a budget, it's a wish — so the prompt is to **tune the plan**, never to tell you off. Every suggestion is a suggestion: you accept it, ignore it, or edit the amount yourself, and nothing changes until you say so.

### Confidence bands

The Running Balance chart can draw a corridor around the projected line — a plausible range rather than a single confident number.

**It will refuse to draw one until it has evidence.** A category needs at least **three complete months** of imported actuals before it contributes anything, and the month in progress never counts, because a month still running holds only part of its spending. Until something qualifies you get the single projected line and a note saying what would make a range appear — no band, not even a narrow one. This is on purpose: the plan is deterministic arithmetic, so any spread invented from it would be a decoration that *looks* like statistics. Fake error bars are worse than none — they make a guess look measured.

Once a category does qualify, its own recorded monthly totals (25th / 50th / 75th percentile) stand in for its planned figure, and the two dashed edges are where the balance lands if every qualifying category spends at its quarter and three-quarter marks. Categories with thin history stay on the plan, so the corridor opens only where reality has actually been measured.

### Debt payoff planner

Give each credit-card account its balance, APR and minimum payment on the account form, add an **extra monthly payment** in the panel if you have one, and the planner runs both standard strategies side by side:

- **Avalanche** — highest APR first. Mathematically the cheapest
- **Snowball** — smallest balance first. Clears individual cards sooner, which some people find easier to stick to

Both simulate the same thing: monthly interest on each balance, minimums on everything, and every spare dollar — including the minimums freed up by cards that have cleared — thrown at the front of the queue. You get each card's payoff date, the total interest, and the debt-free date for each strategy, plus **the difference between them stated in money and months**, so the trade-off is a number and not a slogan.

That's arithmetic, not advice. The app has no opinion about which you should choose, and it isn't a financial adviser; it just shows you what each order costs.

### Goals and sinking funds

Name a goal in the **Savings Goals** panel and give it a target amount and (optionally) a target date — that creates a Goal-kind category, and a **Savings Goal** one ships by default. Fund it with ordinary transactions filed under that category — a $250 monthly transfer from checking into savings, say. An expense-kind line filed under the goal counts too, if that suits how you think about it; a transaction is one or the other, so nothing is ever counted twice.

The app then tracks the goal: how much your plan puts toward it over the horizon, the monthly run-rate, the percentage of target reached, and an **ETA** — the month the target is met, projected past the end of the horizon if it takes that long. With a target date set, the goal is marked on track or behind, and the panel states what reaching the target by that date needs per month and how far the current rate falls short. Sinking funds (the annual insurance premium you save toward monthly) work exactly the same way.

**A transfer funds the goal without ever appearing in the forecast grid.** Moving $250 from checking to savings is not spending, so the row's monthly figures are zero and the grid drops it — see [Forecast grid](#forecast-grid). The goal's progress, run-rate and ETA all count that money anyway, the goals panel says how much of the total arrived as transfers, and Balances by Account shows savings climbing while checking doesn't. It stays out of the spend doughnut, the Biggest Category card and the savings rate, none of which a transfer belongs in.

### Bills calendar

A month-by-month heatmap of every day in the forecast, coloured by that day's net: paydays green, heavy bill days red, quiet days barely tinted. Step through the months and click a day to see exactly what lands on it.

Monthly totals hide the shape of a month completely. A month can finish comfortably positive and still contain a week where the rent has gone out and the paycheck hasn't come in — the calendar is where you see that, and where you see which day of the month to move a bill to.

### Scenarios

A scenario is a named set of changes layered on top of your base plan: **add** a transaction (income or expense), **remove** one, or **modify** one (amount, start date, end date, paused, escalation).

- "New job" — raise the salary line, add a commuting cost
- "Baby" — add childcare, pause the travel fund
- "Move" — remove the current rent, add a bigger one starting in June

Switch between a scenario and the base plan and the entire app — grid, charts, insights — recalculates. A **side-by-side comparison** lists the base plan and each scenario as rows of one table — end balance, lowest point and the date it happens, days in the red, savings rate — rather than leaving you to remember what the numbers were a moment ago. Every row is the whole forecast rebuilt with that scenario applied; the first eight scenarios are compared. Your base plan is never touched; a scenario is a lens, not an edit.

### Excel export / import
Eight sheets:

| Sheet | Purpose |
|---|---|
| `Accounts` | id, name, type, startingBalance, asOfDate, apr, minPayment |
| `Categories` | id, name, kind, color — a Goal category's target and target date are not among the columns |
| `Transactions` | id, name, kind, amount, categoryId, accountId, fromAccountId, frequency, customN, customUnit, startDate, endDate, escalation, tags (semicolon-separated), notes, paused |
| `Actuals` | The rows you imported from your bank's file: id, date, amount (signed), payee, accountId, categoryId, importedId, matchedTxId, source |
| `Checkins` | id, date, accountId, balance — the balances you recorded by hand |
| `Scenarios` | One row per change: scenarioId, scenarioName, op, txId, a column for each field a scenario is allowed to patch (amount, startDate, endDate, paused, escalation), and `tx` — an added transaction, carried whole as JSON. A scenario with no changes still gets a row, or its name wouldn't survive the trip |
| `Settings` | schemaVersion, currency, forecastHorizon, activeScenarioId, plus one `chartHorizon.<chart>` row per per-chart override — so a re-import restores the view you left, not just the numbers |
| `Forecast` | Rendered projection, export-only (written on export, ignored on import): a row for every transaction — item name, the category it is filed under, a column per month, and a total — then the Total Income, Total Expenses, Net Cash Flow, End-of-Month Cash and Net Worth summary rows. Unlike the on-screen grid this keeps transfer rows, at their true all-zero monthly figures |

**Re-import semantics: replace all.** The workbook is the source of truth. Importing a file wipes whatever is in your browser and reloads from the spreadsheet. A confirmation dialog warns you first and the result offers **Undo**. Nothing in a file is trusted: every field is type-checked and every reference validated, and anything skipped or repaired is reported back as import notes. Edit amounts in Excel, re-import, and the new numbers ripple through the forecast and charts.

A file written by a *newer* version of the app is refused outright rather than imported with the unknown fields silently dropped — the error tells you which format version the file is and which one this copy understands.

> **Two things do not survive a round trip.** A Goal category's target amount and target date are dropped on import — by either format — so a goal comes back tracking contributions with no target to measure them against. So is the remembered CSV column mapping for an account, which has to be pointed at the right columns again on the next bank file. The plan and the recorded history themselves are written and read back in full.

### JSON export / import
Lighter if you only want to move state between browsers, and the file is your state itself rather than a rendering of it — plan, actuals, check-ins and scenarios alike. Same replace-all semantics. Use the **`{ JSON }`** and **`⇪ JSON`** buttons in the header.

### Encrypted export (optional)

The **Backup & Portability** panel can write a **passphrase-protected JSON export**: the passphrase is stretched into a key with PBKDF2-SHA256 (310,000 rounds) and the file is encrypted with AES-GCM, using the browser's own WebCrypto engine. To open one, use the ordinary `⇪ JSON` import and supply the passphrase. No server, no account, no key stored anywhere.

> ⚠️ **If you forget the passphrase, the file is gone.** There is no reset link, no recovery key, no support address, and no back door — not because nobody has built one, but because a back door would defeat the point. Nobody, including the author of this app, can open that file for you. Keep a plain export as well until you are sure the passphrase is safe.

Two limits: it applies to **JSON only** (an encrypted `.xlsx` would no longer open in Excel), and a connected live file is always written in plain text. Browsers withhold WebCrypto from `file://` pages, so encrypted export needs `http://localhost` or https. Plain export remains the default everywhere.

### Live workbook mode (Chromium, secure origin)

Normally you export a file and later import it. **Live workbook mode** — the *Live file* block of the Backup & Portability panel — removes the round trip: connect the app to a `.json` or `.xlsx` file on your computer and every save writes that file as well as the browser. The spreadsheet stops being a snapshot you remember to take and becomes the data itself.

Put that file in a cloud-synced folder — iCloud Drive, Dropbox, OneDrive, Google Drive, Syncthing — and you have multi-device sync with no server, no account and no third party: your existing sync client moves the file, and each device opens the same one.

- **Connect a file** creates one; **Use an existing file** adopts one and asks first whether to load it into the app or overwrite it from the browser. **Write now** / **Load from file** force a save or reload; **Reconnect** re-grants permission in a new session; **Disconnect** stops writing and leaves the file as last written
- It uses the **File System Access API**, so it needs a **Chromium-based browser** (Chrome, Edge, Brave, Opera, Arc) on a **secure origin**. Firefox and Safari don't implement it, and no browser gives a `file://` page write access — serve the folder over `http://localhost` or https. When it's unavailable the panel says which of those reasons applies
- Writes are debounced and capped at one a second, so editing doesn't thrash the file or your sync client. LocalStorage keeps working alongside it
- **The connected file holds what an export holds** — a `.json` is the state file itself, a `.xlsx` is the same eight-sheet workbook the ⬇ Excel button writes, and **Load from file** reads either through the ordinary importer. So the round trip has the same one gap a manual export does: see the note under [Excel export / import](#excel-export--import)
- **Last write wins.** File sync is not merge: if two devices edit at once, one side's edits are lost or you get a conflicted copy. Let one device finish syncing before picking up the next, and hit **Load from file** before editing if another device has been in it
- Everywhere else — and any time you'd rather not — the **export / import buttons remain the fully-supported path**. Nothing is gated behind live mode

### Persistence and privacy
- All data is stored in your browser's **LocalStorage** with debounced auto-save (plus the connected file, if you're using live workbook mode)
- **The app makes no network requests.** No fetch, no analytics, no telemetry, no CDN, no external fonts or images — Chart.js and SheetJS are vendored in `site/vendor/` and loaded from disk. Nothing to leak, nothing to block, and it runs fully offline from `file://`
- Reading a file *you* chose from your disk — an import, or a connected live workbook — is not a network request. Nothing leaves the machine
- **It will never link to a bank.** No Plaid, no SimpleFIN, no open banking, no OAuth, no credentials — a permanent, deliberate design choice, not a missing feature. Opening a statement file you downloaded yourself is a different thing entirely, and that is [built](#importing-actuals-from-a-file-you-downloaded-yourself)
- **Completely free, forever.** No tiers, no subscription, no paid features, no licence to buy. There is nothing to sell you because there is no service behind it
- **Reset** button (trash icon), behind a confirmation, clears everything the browser holds — accounts, transactions, imported actuals, check-ins and scenarios — and returns settings to their defaults, while **restoring the 19 default categories**, including any you renamed or deleted. A clean slate, not an empty one. It is undoable and writes a backup first, but export as well if the data matters

### Quality-of-life
- **Observation Deck dark theme** — the shared "mission control" design language used across the deck
- **Currency selector** (USD / EUR / GBP / CAD / AUD / JPY) — changes formatting only; amounts are relabelled, never converted
- **Export-age indicator** — the header shows *Exported today* / *Exported 12d ago* / *Never exported*, and once it's been over a month — or was never exported at all — a warning appears with both export buttons in it
- **Single-level undo** — deleting an account, category or transaction offers an Undo button in the status message, restoring any reassignments too. So do the destructive big ones: an import, a reset, and loading the sample data
- **Collapsible sections** — every section collapses from its own header: categories, transactions, forecast, balances by account, bills calendar, visualizations, check-in, plan vs actual, debt payoff, goals, scenarios and backup
- **Empty-state welcome banner** with a "Load sample data" button to explore the app instantly
- Mobile-responsive layout
- All forms validate inline; required fields are clearly marked

---

## Tech stack

Vanilla HTML / CSS / JS, no framework. Everything the site needs lives in `site/`; everything else in the repository is for people, not browsers.

```
site/           ← the whole app. This is what gets deployed
  index.html    Markup, CSS (Observation Deck design tokens), and the <script src> tags — no inline logic
  engine.js     Pure forecast logic with no DOM access: the schema, date and frequency maths,
                buildForecast, computeInsights, variance, drift, volatility, payoff and goal maths, formatting
  app.js        The DOM layer: storage, rendering, charts, Excel/JSON import/export, event wiring
  importers.js  Parsers for the files you downloaded from your bank — CSV (with the mapping wizard),
                OFX/QFX, QIF, camt.053
  features.js   The reality-check and planning panels: check-ins, per-account balances, plan-vs-actual,
                debt payoff, goals, the pay-vs-bills calendar, scenarios
  portability.js Live workbook mode (File System Access API) and passphrase encryption (WebCrypto)
  guide.html    The built-in Getting Started guide (deliberately script-free)
  tests.html    Browser suite exercising engine.js and importers.js — open it, no build step, no runner to install
  sw.js         Offline shell (service worker), manifest.webmanifest, icon.svg
  vendor/       Chart.js and SheetJS, vendored
netlify.toml    Publish config and security headers
docs/           The screenshot at the top of this README
README.md, LICENSE
```

`site/` is a privacy boundary as much as a folder. Netlify publishes only that directory, so nothing
else in the repository can ride along on a deploy — not the `.claude/` tooling directory, not local
notes, not `.git/`. A drag-and-drop deploy of a project root uploads whatever is sitting in it,
because a manual folder drop never consults `.gitignore`; keeping the shipping files separate removes
that risk at the source instead of maintaining a blocklist.

- Every script is a **classic script sharing global scope** — no ES modules, no imports, no bundler, so `file://` keeps working. They load in the order above; the later files extend the earlier ones by wrapping their render functions
- [Chart.js](https://www.chartjs.org/) 4.4.4 and [SheetJS](https://sheetjs.com/) 0.20.3 are **vendored in `site/vendor/`** and loaded locally; notices in [`site/vendor/LICENSES.md`](site/vendor/LICENSES.md)
- Netlify for static hosting (`netlify.toml` included, publishing `site/` with a CSP that forbids outbound connections)
- No build step, no package manager, no `package.json`, no Node required

---

## Running the tests

`tests.html` is the whole test setup. There is nothing to install and no runner to configure — it is a plain page that loads `engine.js` and `importers.js` and asserts against them.

```bash
cd site && python3 -m http.server 8000
# then open http://localhost:8000/tests.html
```

You can also just double-click `site/tests.html` to open it from disk. The engine and importer suites run either way; the **constraint-guard** suite is skipped on `file://`, because it works by reading the app's own source files as text and a page opened from disk isn't allowed to read its siblings. A banner at the top of the page tells you which mode you're in, and the summary reports passes, failures and skips.

The constraint guard is the section worth knowing about: it scans the source for `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `RTCPeerConnection`, `importScripts` and any external URL, and fails the suite if it finds one. It also fails on a bank-aggregator hostname in any source file, and on an inline `<script>` or inline event handler in `index.html`, which the deployed CSP would refuse. It exists so the "nothing leaves the machine" promise is enforced by a test rather than by anyone's memory of having made it.

---

## Schema versions

The app migrates older data forward automatically. You don't need to do anything — your existing state is upgraded on next load. Defaults introduced in a later version are backfilled on upgrade only, so a category you deliberately deleted doesn't come back every time you open the app.

- **v1** — initial release
- **v2** — broader category color palette (each kind no longer all-blue); v1 default colors are auto-refreshed, custom colors preserved
- **v3** — `forecastMonths` (number) replaced by `forecastHorizon` (string token, supports `eoy`); `chartHorizons` map added for per-chart overrides
- **v4** — Observation Deck theme: dark-only design tokens; the `theme` setting is removed (any stored preference is dropped on load), and default category colors are re-skinned to the deck palette (custom colors preserved)
- **v5** — per-account projected balances: the forecast tracks each account separately instead of only a single combined balance. `account.apr` and `account.minPayment` added so credit cards accrue interest instead of sitting as a static balance; `settings.lastExportAt` records when you last exported, driving the export-age indicator; Goal categories gain optional `target` and `targetDate`, and a default **Savings Goal** category ships. Existing accounts default to no APR, so v4 forecasts are unchanged until you fill the fields in
- **v6** — reality arrives: `state.actuals` (rows read from a file you imported, signed amounts), `state.checkins` (observed account balances), `state.scenarios` (named sets of add/remove/modify ops), `settings.activeScenarioId`, and `settings.importMappings` (the remembered CSV column layout per account). They all start empty, so a v5 file loads with every new panel simply saying it has nothing yet

---

## Roadmap

Ideas, not commitments — and none of them will ever involve connecting to an account.

- **Amortized loan accounts** — mortgages and car loans with a proper principal/interest split. Today only revolving credit (cards) carries an APR
- **User-written payee rules** — importing already suggests a category by matching payees you've filed before; this would let you state the rule up front ("anything from SAFEWAY is Groceries") instead of teaching it by example
- **Split an imported transaction** across several categories
- **Print / iCal view of the pay-vs-bills calendar** so it can leave the browser
- **Hand-entered variability** — a way to say "groceries swing ±15%" and get confidence bands without importing history first

**Shipped, no longer roadmap:** the pay-vs-bills calendar heatmap, the debt payoff planner, goals and sinking funds, importing a statement file you downloaded yourself, and actuals-vs-plan comparison.

**Never on the roadmap:** linking to a bank, any paid tier, and any backend. See [Persistence and privacy](#persistence-and-privacy).

---

## Contributing

No build step and no dependencies to install — edit a file and refresh the browser.

| Editing | File |
|---|---|
| Markup, CSS, design tokens | `site/index.html` |
| Forecast maths, schema, migrations, insights, variance, payoff, goals | `site/engine.js` |
| Rendering, storage, charts, Excel/JSON import/export, events | `site/app.js` |
| Bank-file parsers (CSV / OFX / QFX / QIF / camt.053) | `site/importers.js` |
| Check-ins, per-account balances, plan-vs-actual, debt payoff, goals, calendar, scenarios | `site/features.js` |
| Live workbook mode and encrypted export | `site/portability.js` |
| The Getting Started guide | `site/guide.html` |
| Engine and importer tests | `site/tests.html` |

House rules worth knowing before you open a PR:

- **Nothing may leave the machine.** No `fetch`, `XMLHttpRequest`, WebSocket, `sendBeacon`, `EventSource`, `RTCPeerConnection`, external fonts, images, or scripts. The constraint-guard suite in `tests.html` enforces this by reading the source. New dependencies get vendored into `site/vendor/` with a notice in `site/vendor/LICENSES.md`, or they don't land
- **No build step, no `package.json`, no ES modules** — every script is a classic script sharing global scope so opening `site/index.html` from disk keeps working. New files load after `app.js` and hook in by wrapping the existing render functions
- **`engine.js` stays DOM-free**, which is what lets `tests.html` exercise it directly. Anything pure belongs there; anything that touches the document belongs in one of the UI files
- **Escape everything.** Any user-controlled string on its way to `innerHTML` goes through `escapeHtml` first — and imported bank files are user-controlled strings from outside the app
- **Never link to a real financial account**, and never add a paid tier. Both are permanent — see [Persistence and privacy](#persistence-and-privacy)

Pull requests welcome.

---

## License

[MIT](LICENSE) — do what you like with it, no warranty.

---

[Live demo](https://cashflow-comp.netlify.app/) · [Observation Deck](https://observation-deck.netlify.app/) · [GitHub](https://github.com/00xJS/cashflow-compass)
