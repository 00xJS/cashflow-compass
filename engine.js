/* =========================================================
   Cashflow Compass — forecast engine (pure logic, no DOM)
   Loaded before app.js. Everything here is deliberately
   free of document/window access so tests.html can exercise
   it directly. See tests.html for the suite.
   ========================================================= */
/* =========================================================
 *  Project Budgeting — single-file app
 *  Data model, persistence, frequency engine, forecast,
 *  charts, insights, Excel/JSON round-trip.
 * ========================================================= */

const SCHEMA_VERSION = 5;
const STORAGE_KEY = 'projectBudgetingState';

// Declared here rather than in app.js so engine.js is self-contained: the pure
// functions below read it, and tests.html can assign it without loading app.js.
let state = null;

// Horizon options shared by global selector + per-chart toggles.
// '' is per-chart only and means "match global".
const HORIZON_OPTIONS = [
    { value: 'eoy', label: 'End of Year' },
    { value: '12',  label: '12 months'   },
    { value: '18',  label: '18 months'   },
    { value: '24',  label: '24 months'   },
    { value: '36',  label: '36 months'   }
];

function resolveHorizon(token) {
    if (token === 'eoy') {
        const now = new Date();
        return Math.max(1, 12 - now.getMonth()); // months remaining in current calendar year (incl. current)
    }
    const n = parseInt(token, 10);
    return isNaN(n) ? 12 : clampMonths(n);
}

// Every horizon is at least one whole month — a zero or fractional horizon would
// produce an empty month grid and divide-by-zero averages downstream.
function clampMonths(n) {
    const v = Math.trunc(parseFloat(n));
    return isNaN(v) ? 12 : Math.max(1, v);
}

function horizonRangeLabel(months) {
    const today = new Date();
    const end = addMonths(startOfMonth(today), clampMonths(months) - 1);
    const endLabel = end.toLocaleString(undefined, { month: 'short', year: '2-digit' });
    return `through ${endLabel}`;
}

// Colors that were shipped in v1 — used to detect which categories are still
// using the original default and can be safely re-skinned to the v2 palette.
const V1_DEFAULT_COLORS = {
    cat_salary: '#16a34a',  cat_other_inc: '#22c55e', cat_housing: '#2563eb',
    cat_utilities: '#3b82f6', cat_internet: '#1e40af', cat_phone: '#1e3a8a',
    cat_insurance: '#1d4ed8', cat_subs: '#0ea5e9',     cat_electric: '#0e7490',
    cat_groceries: '#0891b2', cat_gas: '#06b6d4',      cat_dining: '#ea580c',
    cat_entertain: '#f97316', cat_shopping: '#fb923c', cat_savings: '#7c3aed',
    cat_retirement: '#a78bfa', cat_debt: '#dc2626',    cat_tax: '#b91c1c'
};

// Colors shipped in v2/v3 — used (like V1_DEFAULT_COLORS) to detect categories
// still on the old default palette so they can be re-skinned to the deck palette.
const V3_DEFAULT_COLORS = {
    cat_salary: '#16a34a',  cat_other_inc: '#65a30d', cat_housing: '#2563eb',
    cat_utilities: '#f59e0b', cat_internet: '#06b6d4', cat_phone: '#14b8a6',
    cat_insurance: '#6366f1', cat_subs: '#a855f7',    cat_electric: '#eab308',
    cat_groceries: '#84cc16', cat_gas: '#ec4899',     cat_dining: '#ea580c',
    cat_entertain: '#d946ef', cat_shopping: '#f43f5e', cat_savings: '#7c3aed',
    cat_retirement: '#0ea5e9', cat_debt: '#dc2626',   cat_tax: '#92400e'
};

// Observation Deck palette — bright enough to read on the navy card surfaces.
const DEFAULT_CATEGORIES = [
    { id: 'cat_salary',     name: 'Salary',           kind: 'income',        color: '#3ddc84' },
    { id: 'cat_other_inc',  name: 'Other Income',     kind: 'income',        color: '#a3e635' },
    { id: 'cat_housing',    name: 'Housing',          kind: 'fixed',         color: '#ff9a44' },
    { id: 'cat_utilities',  name: 'Utilities',        kind: 'fixed',         color: '#ffc24b' },
    { id: 'cat_internet',   name: 'Home Internet',    kind: 'fixed',         color: '#5b8def' },
    { id: 'cat_phone',      name: 'Phone Bill',       kind: 'fixed',         color: '#22d3ee' },
    { id: 'cat_insurance',  name: 'Insurance',        kind: 'fixed',         color: '#8b7cf6' },
    { id: 'cat_subs',       name: 'Subscriptions',    kind: 'fixed',         color: '#c23e8c' },
    { id: 'cat_electric',   name: 'Electric',         kind: 'variable',      color: '#f5d90a' },
    { id: 'cat_groceries',  name: 'Groceries',        kind: 'variable',      color: '#45d0c0' },
    { id: 'cat_gas',        name: 'Gas / Transport',  kind: 'variable',      color: '#f472b6' },
    { id: 'cat_dining',     name: 'Dining',           kind: 'discretionary', color: '#ff785a' },
    { id: 'cat_entertain',  name: 'Entertainment',    kind: 'discretionary', color: '#d946ef' },
    { id: 'cat_shopping',   name: 'Shopping',         kind: 'discretionary', color: '#fda4af' },
    { id: 'cat_savings',    name: 'Savings',          kind: 'savings',       color: '#60a5fa' },
    { id: 'cat_retirement', name: 'Retirement',       kind: 'savings',       color: '#38bdf8' },
    { id: 'cat_debt',       name: 'Debt Payment',     kind: 'debt',          color: '#ff5c5c' },
    { id: 'cat_tax',        name: 'Taxes',            kind: 'tax',           color: '#c9a26d' },
    // Goal categories may carry an optional numeric `target` and ISO `targetDate`;
    // goalProgress() reads them when present.
    { id: 'cat_goal',       name: 'Savings Goal',     kind: 'goal',          color: '#7dd3fc' }
];

const FREQUENCY_LABELS = {
    'one-time':     'One-time',
    'weekly':       'Weekly',
    'bi-weekly':    'Bi-weekly',
    'semi-monthly': 'Semi-monthly',
    'monthly':      'Monthly',
    'quarterly':    'Quarterly',
    'semi-annual':  'Semi-annual',
    'annual':       'Annual',
    'custom':       'Custom'
};

const KIND_LABELS = {
    income: 'Income', fixed: 'Fixed', variable: 'Variable',
    discretionary: 'Discretionary', savings: 'Savings',
    debt: 'Debt', tax: 'Tax', goal: 'Goal'
};

function applySort(rows, sort, accessors) {
    if (!sort.column || !accessors[sort.column]) return rows;
    const acc = accessors[sort.column];
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const va = acc(a), vb = acc(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * dir;
    });
}

/* ───── State / persistence ───── */

function defaultState() {
    return {
        schemaVersion: SCHEMA_VERSION,
        settings: {
            currency: 'USD',
            forecastHorizon: '12',
            chartHorizons: {},
            lastExportAt: null
        },
        accounts: [],
        categories: structuredClone(DEFAULT_CATEGORIES),
        transactions: []
    };
}

function migrate(s) {
    const fromVersion = s.schemaVersion || 1;
    // Data written by a newer build may contain fields this one would silently drop
    // on the next save, so refuse it outright rather than quietly corrupting it.
    if (fromVersion > SCHEMA_VERSION) {
        throw new Error(
            `This file was saved by a newer version of Cashflow Compass (data format v${fromVersion}). ` +
            `This copy of the app understands up to v${SCHEMA_VERSION}. Update the app, then import again.`
        );
    }
    if (!s.settings) s.settings = defaultState().settings;
    if (!s.accounts) s.accounts = [];
    if (!s.categories || s.categories.length === 0) s.categories = structuredClone(DEFAULT_CATEGORIES);
    // Backfill defaults introduced since the version this state was written at —
    // but only on an upgrade. Doing it every load would resurrect any default the
    // user has deliberately deleted.
    if (fromVersion < SCHEMA_VERSION) {
        DEFAULT_CATEGORIES.forEach(def => {
            if (!s.categories.find(c => c.id === def.id)) s.categories.push({ ...def });
        });
    }
    // v1 → v2: refresh default category colors for the broader palette, but
    // only when the saved color still matches the v1 default (preserve user customizations).
    if (fromVersion < 2) {
        DEFAULT_CATEGORIES.forEach(def => {
            const cur = s.categories.find(c => c.id === def.id);
            if (cur && (cur.color || '').toLowerCase() === (V1_DEFAULT_COLORS[def.id] || '').toLowerCase()) {
                cur.color = def.color;
            }
        });
    }
    // v2 → v3: convert numeric forecastMonths to string forecastHorizon token; add chartHorizons map.
    if (fromVersion < 3) {
        if (s.settings.forecastMonths != null && !s.settings.forecastHorizon) {
            s.settings.forecastHorizon = String(s.settings.forecastMonths);
        }
        delete s.settings.forecastMonths;
        if (!s.settings.chartHorizons) s.settings.chartHorizons = {};
    }
    // v3 → v4 (Observation Deck theme): re-skin default category colors to the
    // deck palette when they still match the old defaults (preserve customizations).
    if (fromVersion < 4) {
        DEFAULT_CATEGORIES.forEach(def => {
            const cur = s.categories.find(c => c.id === def.id);
            if (cur && (cur.color || '').toLowerCase() === (V3_DEFAULT_COLORS[def.id] || '').toLowerCase()) {
                cur.color = def.color;
            }
        });
    }
    // v4 → v5: per-account credit terms + a record of the last export.
    s.accounts.forEach(a => {
        if (a.apr == null) a.apr = 0;
        if (a.minPayment == null) a.minPayment = 0;
    });
    if (s.settings.lastExportAt === undefined) s.settings.lastExportAt = null;
    // The app is dark-only — drop any stored theme preference from older states.
    delete s.settings.theme;
    if (!s.settings.forecastHorizon) s.settings.forecastHorizon = '12';
    if (!s.settings.chartHorizons) s.settings.chartHorizons = {};
    if (!s.transactions) s.transactions = [];
    s.transactions.forEach(t => {
        if (t.tags == null) t.tags = [];
        if (t.escalation == null) t.escalation = 0;
        if (t.paused == null) t.paused = false;
    });
    s.schemaVersion = SCHEMA_VERSION;
    return s;
}

function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/* ───── Date helpers ───── */

function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}
function fmtDate(d) {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(d.getDate(), last));
    return r;
}
function startOfDay(d)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
// Whole calendar days between two dates. Subtracting timestamps is 23h or 25h
// across a DST boundary, so round rather than floor.
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
function monthsBetween(a, b) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function ymKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
function ymLabel(d) {
    return d.toLocaleString(undefined, { month: 'short', year: '2-digit' });
}

/* ───── Frequency engine ─────
 * Returns array of Date objects for all occurrences of tx in [from, to].
 * Inclusive on both ends.
 */
function occurrences(tx, from, to) {
    const out = [];
    if (tx.paused) return out;
    const start = parseDate(tx.startDate);
    if (!start) return out;
    const end = tx.endDate ? parseDate(tx.endDate) : null;
    const fromD = from < start ? start : from;
    const toD = end && end < to ? end : to;
    if (toD < fromD) return out;

    switch (tx.frequency) {
        case 'one-time':
            if (start >= fromD && start <= toD) out.push(start);
            break;
        case 'weekly':
            stepBy(start, 7, 'days', fromD, toD, out);
            break;
        case 'bi-weekly':
            stepBy(start, 14, 'days', fromD, toD, out);
            break;
        case 'semi-monthly': {
            // Two dates a fortnight apart, derived from the start date. The two
            // payroll conventions are special-cased: a 1st start keeps 1st/15th and a
            // 15th start pairs with the month end. Anything else is day ± 15,
            // clamped into short months.
            const anchor = start.getDate();
            let dayA, dayB;
            if (anchor === 1)      { dayA = 1;           dayB = 15; }
            else if (anchor === 15){ dayA = 15;          dayB = 31; }
            else if (anchor < 15)  { dayA = anchor;      dayB = anchor + 15; }
            else                   { dayA = anchor - 15; dayB = anchor; }
            let cursor = startOfMonth(fromD);
            while (cursor <= toD) {
                const last = endOfMonth(cursor).getDate();
                const a = Math.min(dayA, last), b = Math.min(dayB, last);
                const days = a === b ? [a] : [a, b];
                days.forEach(dn => {
                    const d = new Date(cursor.getFullYear(), cursor.getMonth(), dn);
                    if (d >= start && d >= fromD && d <= toD) out.push(d);
                });
                cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            }
            break;
        }
        case 'monthly':       stepByMonths(start, 1,  fromD, toD, out); break;
        case 'quarterly':     stepByMonths(start, 3,  fromD, toD, out); break;
        case 'semi-annual':   stepByMonths(start, 6,  fromD, toD, out); break;
        case 'annual':        stepByMonths(start, 12, fromD, toD, out); break;
        case 'custom': {
            const n = Math.max(1, parseInt(tx.customN || 1));
            if (tx.customUnit === 'months') stepByMonths(start, n, fromD, toD, out);
            else if (tx.customUnit === 'weeks') stepBy(start, n * 7, 'days', fromD, toD, out);
            else stepBy(start, n, 'days', fromD, toD, out);
            break;
        }
    }
    return out;
}

// Both steppers jump straight to the first occurrence inside the window: walking
// from the start date burns an unbounded number of iterations (and used to hit the
// safety cap) for anything that began years before the forecast window.
const STEP_ITERATION_CAP = 20000;

function stepBy(start, n, unit, from, to, out) {
    const step = Math.max(1, Math.round(n));
    let d = new Date(start);
    if (d < from) {
        const skip = Math.floor(daysBetween(d, from) / step);
        if (skip > 0) d = addDays(d, skip * step);
        while (d < from) d = addDays(d, step);
    }
    let guard = 0;
    while (d <= to && guard++ < STEP_ITERATION_CAP) {
        out.push(new Date(d));
        d = addDays(d, step);
    }
}
function stepByMonths(start, n, from, to, out) {
    const step = Math.max(1, Math.round(n));
    const apart = monthsBetween(start, from);
    // Back off one step: addMonths clamps the day-of-month, so the arithmetic
    // estimate can land just inside or just outside the window.
    let i = apart > 0 ? Math.max(0, Math.floor(apart / step) - 1) : 0;
    let guard = 0;
    while (guard++ < STEP_ITERATION_CAP) {
        const d = addMonths(start, step * i);
        if (d > to) break;
        if (d >= from) out.push(d);
        i++;
    }
}

// Amounts are magnitudes: direction comes from the transaction kind alone, so a
// negative amount (hand-typed or imported) can never flip an expense into income.
function amountAtDate(tx, occDate) {
    const base = Math.abs(parseFloat(tx.amount) || 0);
    const esc = parseFloat(tx.escalation || 0);
    if (!esc) return base;
    const start = parseDate(tx.startDate);
    if (!start) return base;
    // Calendar anniversaries, not elapsed milliseconds — a 365.25-day year drifts
    // far enough to move a step onto the wrong side of the anniversary.
    let years = occDate.getFullYear() - start.getFullYear();
    const beforeAnniversary = occDate.getMonth() < start.getMonth() ||
        (occDate.getMonth() === start.getMonth() && occDate.getDate() < start.getDate());
    if (beforeAnniversary) years--;
    if (years < 0) years = 0;
    return base * Math.pow(1 + esc / 100, years);
}

// The transaction's own kind is the single source of truth for direction; a
// category whose kind disagrees is reported as a mismatch, never obeyed.
function effectiveKind(tx) {
    const k = tx && tx.kind;
    return (k === 'income' || k === 'expense' || k === 'transfer') ? k : 'expense';
}

function annualizedCost(tx) {
    if (!tx || effectiveKind(tx) === 'transfer') return 0;
    const from = startOfDay(new Date());
    const to = addDays(addMonths(from, 12), -1); // one full year, inclusive of today
    return occurrences(tx, from, to).reduce((sum, d) => sum + amountAtDate(tx, d), 0);
}

/* ───── Accounts ───── */

// Liquidity decides what "will I go negative" means: only these types hold
// spendable cash. Investments are excluded, credit is debt and never cash.
const LIQUID_ACCOUNT_TYPES = ['checking', 'savings', 'cash'];
// Bucket for money whose transaction names no account (or an account that no
// longer exists) — it still moves real cash, so it stays in the aggregate.
const UNASSIGNED_ACCOUNT = '__unassigned__';
// Bucket for spend whose category no longer exists, so category totals still
// reconcile against total expenses.
const UNCATEGORISED = '__uncategorised__';

function isLiquidAccount(a) { return !!a && LIQUID_ACCOUNT_TYPES.indexOf(a.type) !== -1; }
function isCreditAccount(a) { return !!a && a.type === 'credit'; }

// A category kind only ever contradicts a transaction in these two ways; every
// other pairing (an expense into a savings or goal category, say) is legitimate.
function categoryKindConflict(txKind, catKind) {
    if (!catKind) return false;
    if (txKind === 'income') return catKind !== 'income';
    if (txKind === 'expense') return catKind === 'income';
    return false;
}

// Next occurrence at or after `from`. Widens once so that annual and one-time
// items further out still resolve.
function nextOccurrence(tx, from) {
    const anchor = startOfDay(from || new Date());
    let occs = occurrences(tx, anchor, addMonths(anchor, 14));
    if (!occs.length) occs = occurrences(tx, anchor, addMonths(anchor, 60));
    if (!occs.length) return null;
    return occs.reduce((min, d) => (d < min ? d : min), occs[0]);
}

// Walks one balance day by day over the horizon. `dayMap` is date-key → net
// movement for that whole day, so the trough is evaluated once per day rather
// than once per transaction (which made it depend on entry order).
function walkDailyBalance(startBalance, dayMap, horizonStart, horizonEnd, countRed) {
    const keys = dayMap ? Array.from(dayMap.keys()).sort() : [];
    let bal = startBalance;
    let daysInRed = 0;
    let firstNegativeDate = (countRed && bal < 0) ? new Date(horizonStart) : null;
    let lowest = { date: new Date(horizonStart), balance: bal };
    let prev = horizonStart;
    keys.forEach(k => {
        const d = parseDate(k);
        if (countRed && bal < 0) daysInRed += Math.max(0, daysBetween(prev, d));
        bal += dayMap.get(k);
        if (bal < lowest.balance) lowest = { date: d, balance: bal };
        if (countRed && bal < 0 && !firstNegativeDate) firstNegativeDate = d;
        prev = d;
    });
    if (countRed && bal < 0) daysInRed += Math.max(0, daysBetween(prev, horizonEnd) + 1);
    return { daysInRed, lowest, firstNegativeDate, end: bal };
}

/* ───── Forecast engine ───── */

function buildForecast(months) {
    months = clampMonths(months);
    const today = startOfDay(new Date());
    const horizonStart = startOfMonth(today);
    const horizonEnd = endOfMonth(addMonths(horizonStart, months - 1));

    const accounts     = (state && Array.isArray(state.accounts))     ? state.accounts     : [];
    const categories   = (state && Array.isArray(state.categories))   ? state.categories   : [];
    const transactions = (state && Array.isArray(state.transactions)) ? state.transactions : [];

    // Months array
    const monthList = [];
    for (let i = 0; i < months; i++) {
        const m = addMonths(horizonStart, i);
        monthList.push({ date: m, key: ymKey(m), label: ymLabel(m) });
    }
    const monthIndex = Object.fromEntries(monthList.map((m, i) => [m.key, i]));

    // Balances are stated as of the newest account snapshot, so anything that fell
    // due before it is already reflected in them. Scanning from the start of the
    // month would replay this month's paid bills on top of a balance that includes
    // them. The month grid still starts at the month boundary — only the scan moves.
    let cutoff = null;
    accounts.forEach(a => {
        const d = parseDate(a.asOfDate);
        if (d && (!cutoff || d > cutoff)) cutoff = d;
    });
    if (!cutoff) cutoff = today;

    const acctById = {};
    accounts.forEach(a => { acctById[a.id] = a; });
    const catById = {};
    categories.forEach(c => { catById[c.id] = c; });

    const orphans = [];
    const mismatches = [];
    const movements = []; // { date, idx, target, delta } — delta in the account's own units

    // Per-tx monthly buckets
    const txData = transactions.map(tx => {
        const kind = effectiveKind(tx);
        const cat  = catById[tx.categoryId];
        const dest = acctById[tx.accountId];
        const src  = acctById[tx.fromAccountId];
        const occs = occurrences(tx, cutoff, horizonEnd);
        const byMonth = new Array(months).fill(0);
        const byDay = []; // {date, amount, signed}

        if (tx.categoryId && !cat) orphans.push({ tx, field: 'categoryId', value: tx.categoryId });
        if (tx.accountId && !dest) orphans.push({ tx, field: 'accountId', value: tx.accountId });
        if (tx.fromAccountId && !src) orphans.push({ tx, field: 'fromAccountId', value: tx.fromAccountId });
        if (cat && categoryKindConflict(kind, cat.kind)) {
            mismatches.push({ tx, txKind: kind, categoryKind: cat.kind, categoryName: cat.name });
        }

        occs.forEach(d => {
            const amt = amountAtDate(tx, d);
            if (!isFinite(amt) || amt === 0) return;
            // idx < 0 means the occurrence sits between the snapshot and the start of
            // the grid: real money, but no column for it, so it adjusts the opening balance.
            const found = monthIndex[ymKey(d)];
            const idx = found == null ? -1 : found;
            const signed = kind === 'expense' ? -amt : (kind === 'income' ? amt : 0);
            if (idx >= 0) {
                byMonth[idx] += signed;
                byDay.push({ date: d, amount: amt, signed });
            }
            const move = (target, delta) => { if (delta) movements.push({ date: d, idx, target, delta }); };
            if (kind === 'income') {
                // Income into a card is a refund: it pays the debt down.
                if (isCreditAccount(dest)) move(dest.id, -amt);
                else move(dest ? dest.id : UNASSIGNED_ACCOUNT, amt);
            } else if (kind === 'expense') {
                // Charging a card grows the debt and leaves cash alone — the cash
                // only moves when the card is paid (a transfer).
                if (isCreditAccount(dest)) move(dest.id, amt);
                else move(dest ? dest.id : UNASSIGNED_ACCOUNT, -amt);
            } else {
                const destId = dest ? dest.id : UNASSIGNED_ACCOUNT;
                const srcId  = src  ? src.id  : UNASSIGNED_ACCOUNT;
                if (destId !== srcId) {
                    move(destId, isCreditAccount(dest) ? -amt : amt);
                    move(srcId,  isCreditAccount(src)  ?  amt : -amt);
                }
            }
        });

        return { tx, byMonth, byDay, occs, next: nextOccurrence(tx, today) };
    });

    // Per-account balances. For credit accounts every number here is the amount
    // OWED (positive = debt); net worth subtracts them.
    const byAccount = {};
    const accountsList = accounts.map(a => {
        const credit = isCreditAccount(a);
        const raw = parseFloat(a.startingBalance) || 0;
        const entry = {
            id: a.id,
            name: a.name || '(unnamed)',
            type: a.type || 'checking',
            liquid: isLiquidAccount(a),
            credit,
            apr: Math.max(0, parseFloat(a.apr) || 0),
            minPayment: Math.max(0, parseFloat(a.minPayment) || 0),
            start: credit ? Math.abs(raw) : raw,
            monthly: new Array(months).fill(0),
            running: new Array(months).fill(0),
            daysInRed: 0,
            lowest: { date: new Date(horizonStart), balance: 0 }
        };
        byAccount[a.id] = entry;
        return entry;
    });
    const unassigned = {
        id: UNASSIGNED_ACCOUNT, name: 'Unassigned', type: 'cash',
        liquid: true, credit: false, apr: 0, minPayment: 0,
        start: 0, monthly: new Array(months).fill(0), running: new Array(months).fill(0),
        daysInRed: 0, lowest: { date: new Date(horizonStart), balance: 0 }
    };
    const walkTargets = accountsList.concat([unassigned]);
    const targetById = {};
    walkTargets.forEach(t => { targetById[t.id] = t; });

    movements.forEach(m => {
        const t = targetById[m.target];
        if (!t) return;
        if (m.idx < 0) t.start += m.delta;
        else t.monthly[m.idx] += m.delta;
    });

    walkTargets.forEach(t => {
        let bal = t.start;
        const monthlyRate = t.credit ? t.apr / 100 / 12 : 0;
        for (let i = 0; i < months; i++) {
            if (monthlyRate && bal > 0) bal += bal * monthlyRate;
            bal += t.monthly[i];
            t.running[i] = bal;
        }
    });

    // Daily movement per target, then per-account and aggregate walks.
    const dayNets = {};
    const liquidDayNet = new Map();
    movements.forEach(m => {
        if (m.idx < 0) return;
        const t = targetById[m.target];
        if (!t) return;
        const key = fmtDate(m.date);
        let map = dayNets[m.target];
        if (!map) { map = new Map(); dayNets[m.target] = map; }
        map.set(key, (map.get(key) || 0) + m.delta);
        if (t.liquid) liquidDayNet.set(key, (liquidDayNet.get(key) || 0) + m.delta);
    });
    walkTargets.forEach(t => {
        const walk = walkDailyBalance(t.start, dayNets[t.id], horizonStart, horizonEnd, !t.credit);
        t.daysInRed = walk.daysInRed;
        t.lowest = walk.lowest;
    });

    const startingBalance = walkTargets.reduce((s, t) => s + (t.liquid ? t.start : 0), 0);
    const startingNetWorth = walkTargets.reduce((s, t) => s + (t.credit ? -t.start : t.start), 0);

    const runningBalance = new Array(months).fill(0);
    const netWorthRunning = new Array(months).fill(0);
    for (let i = 0; i < months; i++) {
        let liquid = 0, worth = 0;
        walkTargets.forEach(t => {
            if (t.liquid) liquid += t.running[i];
            worth += t.credit ? -t.running[i] : t.running[i];
        });
        runningBalance[i] = liquid;
        netWorthRunning[i] = worth;
    }

    const liquidWalk = walkDailyBalance(startingBalance, liquidDayNet, horizonStart, horizonEnd, true);
    const daysInRed = liquidWalk.daysInRed;
    const lowest = liquidWalk.lowest;
    const firstNegativeDate = liquidWalk.firstNegativeDate;

    // Tightest 7-day window of liquid cash flow.
    const spanDays = daysBetween(horizonStart, horizonEnd) + 1;
    let tightestWeek = null;
    if (liquidDayNet.size && spanDays > 0) {
        const daily = new Array(spanDays).fill(0);
        liquidDayNet.forEach((v, k) => {
            const off = daysBetween(horizonStart, parseDate(k));
            if (off >= 0 && off < spanDays) daily[off] += v;
        });
        const win = Math.min(7, spanDays);
        let sum = 0;
        for (let i = 0; i < win; i++) sum += daily[i];
        let best = sum, bestStart = 0;
        for (let i = win; i < spanDays; i++) {
            sum += daily[i] - daily[i - win];
            if (sum < best) { best = sum; bestStart = i - win + 1; }
        }
        tightestWeek = {
            start: addDays(horizonStart, bestStart),
            end: addDays(horizonStart, bestStart + win - 1),
            net: best
        };
    }

    // Monthly totals. These stay on an accrual footing — every income and expense
    // regardless of the account it settles through — so category and spend
    // reporting is unaffected by which card or account pays for what.
    const monthlyIncome = new Array(months).fill(0);
    const monthlyExpense = new Array(months).fill(0);
    const monthlyByCategory = {}; // catId -> array of outflows
    txData.forEach(({ tx, byMonth }) => {
        byMonth.forEach((amt, i) => {
            if (amt > 0) monthlyIncome[i] += amt;
            else if (amt < 0) monthlyExpense[i] += -amt;
        });
        if (effectiveKind(tx) === 'expense') {
            const key = catById[tx.categoryId] ? tx.categoryId : UNCATEGORISED;
            if (!monthlyByCategory[key]) monthlyByCategory[key] = new Array(months).fill(0);
            byMonth.forEach((amt, i) => { if (amt < 0) monthlyByCategory[key][i] += -amt; });
        }
    });
    const monthlyNet = monthlyIncome.map((inc, i) => inc - monthlyExpense[i]);

    return {
        monthList, txData, startingBalance, startingNetWorth,
        monthlyIncome, monthlyExpense, monthlyNet, monthlyByCategory,
        runningBalance, netWorthRunning, daysInRed, lowest,
        byAccount, accountsList, unassigned,
        firstNegativeDate, tightestWeek,
        debtSchedule: payoffSchedule(accounts, 0, 'avalanche'),
        orphans, mismatches,
        horizonStart, horizonEnd, cutoffDate: cutoff, months
    };
}

/* ───── Debt payoff ─────
 * Pure simulation: monthly interest on the outstanding balance, minimum payments
 * on every card, and everything left over (including the minimums freed up by
 * cleared cards) thrown at the front of the queue.
 *   avalanche — highest APR first (least interest paid)
 *   snowball  — smallest balance first (fastest first win)
 */

const PAYOFF_MONTH_CAP = 600;

function payoffSchedule(accounts, extraPerMonth, method) {
    // Either (accounts, extra, method) or (accounts, { extra, strategy }).
    let extraIn = extraPerMonth, methodIn = method;
    if (extraPerMonth && typeof extraPerMonth === 'object') {
        extraIn = extraPerMonth.extra != null ? extraPerMonth.extra : extraPerMonth.extraPerMonth;
        methodIn = extraPerMonth.strategy || extraPerMonth.method || method;
    }
    const list = (accounts || []).filter(a => isCreditAccount(a));
    if (!list.length) return null;
    const mode = methodIn === 'snowball' ? 'snowball' : 'avalanche';
    const extra = Math.max(0, parseFloat(extraIn) || 0);
    const debts = list.map(a => ({
        id: a.id,
        name: a.name || '(unnamed)',
        apr: Math.max(0, parseFloat(a.apr) || 0),
        balance: Math.abs(parseFloat(a.startingBalance) || 0),
        minPayment: Math.max(0, parseFloat(a.minPayment) || 0),
        owed: Math.abs(parseFloat(a.startingBalance) || 0),
        payoffDate: null,
        monthsToPayoff: null,
        totalInterest: 0
    }));

    const order = (a, b) => (mode === 'snowball'
        ? (a.owed - b.owed) || (b.apr - a.apr)
        : (b.apr - a.apr) || (a.owed - b.owed));

    // The queue as it stands on day one — the order the plan is presented in.
    const priority = debts.slice().sort(order).map(d => d.id);
    const budget = extra + debts.reduce((s, d) => s + d.minPayment, 0);
    const start = startOfMonth(new Date());
    let month = 0;
    // Without a budget nothing can ever be repaid, so stop instead of accruing
    // interest 600 times over.
    while (budget > 0 && month < PAYOFF_MONTH_CAP && debts.some(d => d.owed > 0.005)) {
        month++;
        debts.forEach(d => {
            if (d.owed <= 0) return;
            const interest = d.owed * (d.apr / 100 / 12);
            d.owed += interest;
            d.totalInterest += interest;
        });
        let pool = budget;
        const active = debts.filter(d => d.owed > 0.005).sort(order);
        active.forEach(d => {
            const pay = Math.min(d.minPayment, d.owed, pool);
            d.owed -= pay;
            pool -= pay;
        });
        for (const d of active) {
            if (pool <= 0) break;
            if (d.owed <= 0.005) continue;
            const pay = Math.min(pool, d.owed);
            d.owed -= pay;
            pool -= pay;
        }
        active.forEach(d => {
            if (d.owed <= 0.005 && !d.payoffDate) {
                d.owed = 0;
                d.monthsToPayoff = month;
                d.payoffDate = endOfMonth(addMonths(start, month - 1));
            }
        });
    }

    const rows = priority.map(id => debts.find(d => d.id === id)).map(d => ({
        id: d.id, name: d.name, apr: d.apr, balance: d.balance,
        minPayment: d.minPayment, remaining: d.owed,
        payoffDate: d.payoffDate, monthsToPayoff: d.monthsToPayoff,
        totalInterest: d.totalInterest
    }));
    const cleared = rows.every(r => r.payoffDate);
    return {
        method: mode,
        extraPerMonth: extra,
        order: priority,
        accounts: rows,
        totalInterest: rows.reduce((s, r) => s + r.totalInterest, 0),
        totalBalance: rows.reduce((s, r) => s + r.balance, 0),
        monthlyBudget: budget,
        months: month,
        debtFreeDate: cleared ? rows.reduce((m, r) => (r.payoffDate > m ? r.payoffDate : m), rows[0].payoffDate) : null
    };
}

/* ───── Goals ───── */

function goalProgress(forecast) {
    if (!forecast || !state || !Array.isArray(state.categories)) return [];
    const months = forecast.monthList.length;
    const horizonStart = forecast.horizonStart || startOfMonth(new Date());
    const byCategory = forecast.monthlyByCategory || {};
    return state.categories.filter(c => c.kind === 'goal').map(c => {
        const series = byCategory[c.id] || new Array(months).fill(0);
        const accumulated = series.reduce((s, n) => s + n, 0);
        const monthly = months > 0 ? accumulated / months : 0;
        const target = Math.max(0, parseFloat(c.target) || 0);
        const targetDate = c.targetDate ? parseDate(c.targetDate) : null;
        let eta = null;
        if (target > 0) {
            let cum = 0, hit = -1;
            for (let i = 0; i < months; i++) {
                cum += series[i];
                if (cum >= target) { hit = i; break; }
            }
            if (hit >= 0) eta = endOfMonth(forecast.monthList[hit].date);
            else if (monthly > 0) {
                const more = Math.ceil((target - accumulated) / monthly);
                eta = endOfMonth(addMonths(horizonStart, months - 1 + more));
            }
        }
        return {
            id: c.id, name: c.name, color: c.color,
            monthly, accumulated, target, targetDate, eta,
            pct: target > 0 ? Math.min(100, (accumulated / target) * 100) : null,
            onTrack: (target > 0 && targetDate) ? !!(eta && eta <= targetDate) : null
        };
    });
}

/* ───── Currency formatting ───── */

// A code Intl does not recognise makes the formatter throw, which used to degrade
// every figure in the app to a bare number. Anything outside this list falls back
// to USD instead.
const CURRENCY_CODES = new Set([
    'AED','ARS','AUD','BGN','BHD','BRL','CAD','CHF','CLP','CNY','COP','CZK','DKK',
    'EGP','EUR','GBP','HKD','HRK','HUF','IDR','ILS','INR','ISK','JPY','KES','KRW',
    'KWD','MAD','MXN','MYR','NGN','NOK','NZD','PEN','PHP','PKR','PLN','QAR','RON',
    'RSD','RUB','SAR','SEK','SGD','THB','TRY','TWD','UAH','USD','UYU','VND','ZAR'
]);
const FALLBACK_CURRENCY = 'USD';

function normalizeCurrency(code) {
    const c = String(code || '').trim().toUpperCase();
    return CURRENCY_CODES.has(c) ? c : FALLBACK_CURRENCY;
}

// Building an Intl.NumberFormat costs far more than formatting with one, and
// fmtMoney runs on every grid cell, axis tick and tooltip — so keep them.
const MONEY_FORMATTERS = new Map();

function moneyFormatter(currency, compact) {
    const key = currency + '|' + (compact ? 'compact' : 'full');
    let f = MONEY_FORMATTERS.get(key);
    if (!f) {
        // No maximumFractionDigits unless we're compacting: the currency decides
        // how many minor units it has, so JPY renders whole yen and USD two decimals.
        const options = compact
            ? { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }
            : { style: 'currency', currency };
        try {
            f = new Intl.NumberFormat(undefined, options);
        } catch {
            f = new Intl.NumberFormat(undefined, Object.assign({}, options, { currency: FALLBACK_CURRENCY }));
        }
        MONEY_FORMATTERS.set(key, f);
    }
    return f;
}

function fmtMoney(n, opts = {}) {
    const cur = normalizeCurrency(state && state.settings ? state.settings.currency : FALLBACK_CURRENCY);
    const value = Number.isFinite(n) ? n : 0;
    return moneyFormatter(cur, !!opts.compact).format(value);
}
function fmtPct(n) {
    const v = Number.isFinite(n) ? n : 0;
    return (Math.round(v * 10) / 10).toFixed(1) + '%';
}

function computeInsights(forecast) {
    const cards = [];
    const {
        monthList, monthlyIncome, monthlyExpense, monthlyNet, monthlyByCategory,
        runningBalance, daysInRed, lowest, startingBalance,
        firstNegativeDate, tightestWeek
    } = forecast;
    const months = monthList.length;
    const transactions = (state && Array.isArray(state.transactions)) ? state.transactions : [];
    const categories   = (state && Array.isArray(state.categories))   ? state.categories   : [];
    const accounts     = (state && Array.isArray(state.accounts))     ? state.accounts     : [];

    // Nothing entered yet — no card can say anything true, so let app.js show its
    // own empty state instead.
    if (!transactions.length && !accounts.length) return cards;

    const totalIncome = monthlyIncome.reduce((s,n)=>s+n,0);
    const totalExpense = monthlyExpense.reduce((s,n)=>s+n,0);
    const today = startOfDay(new Date());

    const catById = {};
    categories.forEach(c => { catById[c.id] = c; });
    // Spend whose category has been deleted still has to appear somewhere, or the
    // category totals can never reconcile with total expenses.
    const catTotals = Object.keys(monthlyByCategory).map(id => {
        const c = catById[id];
        return {
            id,
            name: c ? c.name : 'Uncategorised',
            kind: c ? c.kind : null,
            total: monthlyByCategory[id].reduce((s,n)=>s+n,0)
        };
    }).filter(x => x.total > 0).sort((a,b) => b.total - a.total);
    const totalOf = kinds => catTotals
        .filter(x => kinds.indexOf(x.kind) !== -1)
        .reduce((s,x) => s + x.total, 0);

    // Savings rate. Money moved into savings, a goal, or debt principal is not
    // spending — counting it as such penalises the very behaviour being measured.
    if (totalIncome > 0) {
        const setAside = totalOf(['savings', 'debt', 'goal']);
        const trueSpend = Math.max(0, totalExpense - setAside);
        const kept = totalIncome - trueSpend;
        const rate = (kept / totalIncome) * 100;
        const tone = rate >= 20 ? 'positive' : rate >= 10 ? 'info' : rate >= 0 ? 'warning' : 'danger';
        cards.push({
            tone, label: 'Savings Rate',
            value: fmtPct(rate),
            sub: `${fmtMoney(kept)} kept of ${fmtMoney(totalIncome)} income over ${months} months`
        });
    }

    // Biggest category
    if (catTotals.length && totalExpense > 0) {
        const top = catTotals[0];
        const pct = (top.total / totalExpense) * 100;
        cards.push({
            tone: 'fact', label: 'Biggest Category',
            value: top.name,
            sub: `${fmtPct(pct)} of spend (${fmtMoney(top.total)} over ${months} mo)`
        });
    }

    // Fixed vs flexible spend
    const fixedTotal = totalOf(['fixed']);
    const flexTotal = totalOf(['variable', 'discretionary']);
    if (fixedTotal + flexTotal > 0) {
        const pct = (fixedTotal / (fixedTotal + flexTotal)) * 100;
        const tone = pct >= 75 ? 'warning' : pct >= 55 ? 'info' : 'positive';
        cards.push({
            tone, label: 'Fixed vs Variable',
            value: fmtPct(pct) + ' fixed',
            sub: `${fmtMoney(fixedTotal)} committed vs ${fmtMoney(flexTotal)} flexible over ${months} mo`
        });
    }

    // Annualized subscriptions. Match the shipped subscriptions category, any fixed
    // category named like one (imports mint fresh ids), or a 'subscription' tag.
    const subCatIds = new Set(categories
        .filter(c => c.id === 'cat_subs' || (c.kind === 'fixed' && /subscription/i.test(c.name || '')))
        .map(c => c.id));
    const subTx = transactions.filter(t => {
        if (t.paused || effectiveKind(t) !== 'expense') return false;
        if (subCatIds.has(t.categoryId)) return true;
        return Array.isArray(t.tags) && t.tags.some(tag => {
            const s = String(tag).trim().toLowerCase();
            return s === 'subscription' || s === 'subscriptions';
        });
    });
    if (subTx.length) {
        const subAnnual = subTx.reduce((s, t) => s + annualizedCost(t), 0);
        cards.push({
            tone: 'fact', label: 'Annual Subscription Cost',
            value: fmtMoney(subAnnual),
            sub: `${subTx.length} active subscription(s) — ${fmtMoney(subAnnual/12)}/mo equivalent`
        });
    }

    // Emergency fund, in tiers: a starter buffer first, then six weeks of take-home,
    // then three and six months of expenses. Shown at zero and below too — that is
    // exactly when it matters.
    const avgExpense = totalExpense / months;
    const avgIncome = totalIncome / months;
    const tiers = [
        { name: 'starter buffer', amount: 1000 },
        { name: '6 weeks of take-home', amount: avgIncome * 12 * 6 / 52 },
        { name: '3 months of expenses', amount: avgExpense * 3 },
        { name: '6 months of expenses', amount: avgExpense * 6 }
    ].filter(t => t.amount > 0).sort((a, b) => a.amount - b.amount);
    let reached = null, nextTier = null;
    tiers.forEach(t => {
        if (startingBalance >= t.amount) reached = t;
        else if (!nextTier) nextTier = t;
    });
    const coverage = avgExpense > 0 ? startingBalance / avgExpense : null;
    const efTone = coverage == null
        ? (startingBalance > 0 ? 'info' : 'danger')
        : coverage >= 6 ? 'positive' : coverage >= 3 ? 'info' : coverage >= 1 ? 'warning' : 'danger';
    const efParts = [`${fmtMoney(startingBalance)} liquid`];
    efParts.push(reached ? `past the ${reached.name}` : 'no tier reached yet');
    if (nextTier) efParts.push(`${fmtMoney(Math.max(0, nextTier.amount - startingBalance))} to the ${nextTier.name}`);
    cards.push({
        tone: efTone, label: 'Emergency Fund',
        value: coverage == null ? fmtMoney(startingBalance) : coverage.toFixed(1) + ' months',
        sub: efParts.join(' — ')
    });

    // Days in red
    if (daysInRed > 0) {
        cards.push({
            tone: 'danger', label: 'Days in the Red',
            value: daysInRed + ' days',
            sub: `Lowest cash: ${fmtMoney(lowest.balance)} on ${fmtDate(lowest.date)}`
        });
    } else {
        cards.push({
            tone: 'positive', label: 'Days in the Red',
            value: '0 days',
            sub: `Cash stays positive — lowest point ${fmtMoney(lowest.balance)} on ${fmtDate(lowest.date)}`
        });
    }

    // First shortfall
    if (firstNegativeDate) {
        const away = daysBetween(today, firstNegativeDate);
        cards.push({
            tone: 'danger', label: 'First Shortfall',
            value: fmtDate(firstNegativeDate),
            sub: away > 0 ? `Liquid cash drops below zero in ${away} day(s)`
                : 'Liquid cash is already below zero at this point in the forecast'
        });
    } else {
        cards.push({
            tone: 'positive', label: 'First Shortfall',
            value: 'None forecast',
            sub: `Liquid cash never dips below zero across ${months} months`
        });
    }

    // Tightest 7-day window
    if (tightestWeek) {
        const negative = tightestWeek.net < 0;
        cards.push({
            tone: negative ? 'warning' : 'positive', label: 'Tightest Week',
            value: fmtMoney(tightestWeek.net),
            sub: `Net cash flow ${fmtDate(tightestWeek.start)} → ${fmtDate(tightestWeek.end)}` +
                 (negative ? ' — keep this much in reserve' : ' — no week runs a deficit')
        });
    }

    // Best and worst month by net cash flow
    if (months >= 2 && (totalIncome > 0 || totalExpense > 0)) {
        let bi = 0, wi = 0;
        monthlyNet.forEach((n, i) => {
            if (n > monthlyNet[bi]) bi = i;
            if (n < monthlyNet[wi]) wi = i;
        });
        cards.push({
            tone: monthlyNet[bi] >= 0 ? 'positive' : 'info', label: 'Best Month',
            value: monthList[bi].label,
            sub: `${fmtMoney(monthlyNet[bi])} net — ${fmtMoney(monthlyIncome[bi])} in, ${fmtMoney(monthlyExpense[bi])} out`
        });
        cards.push({
            tone: monthlyNet[wi] < 0 ? 'warning' : 'info', label: 'Worst Month',
            value: monthList[wi].label,
            sub: `${fmtMoney(monthlyNet[wi])} net — ${fmtMoney(monthlyIncome[wi])} in, ${fmtMoney(monthlyExpense[wi])} out`
        });
    }

    // 3-paycheck months — evaluated per stream, since two bi-weekly streams on
    // different anchors rarely triple in the same month.
    const biwIncome = transactions.filter(t =>
        t.frequency === 'bi-weekly' && effectiveKind(t) === 'income' && !t.paused);
    if (biwIncome.length) {
        const triple = [];
        monthList.forEach(m => {
            const end = endOfMonth(m.date);
            const streams = biwIncome.filter(tx => occurrences(tx, m.date, end).length >= 3);
            if (streams.length) triple.push({ label: m.label, streams });
        });
        if (triple.length) {
            const names = new Set();
            triple.forEach(t => t.streams.forEach(tx => names.add(tx.name)));
            cards.push({
                tone: 'positive', label: '3-Paycheck Months',
                value: triple.length + ' month(s)',
                sub: `${triple.map(t => t.label).join(', ')} — extra pay from ${Array.from(names).join(', ')}`
            });
        } else {
            cards.push({
                tone: 'info', label: '3-Paycheck Months',
                value: '0 in this horizon',
                sub: 'No extra paycheck months within the current forecast window'
            });
        }
    } else {
        cards.push({
            tone: 'info', label: '3-Paycheck Months',
            value: 'N/A',
            sub: 'Add a bi-weekly income stream to track bonus paycheck months'
        });
    }

    // What-if: trim the biggest category you can actually choose to trim, rather
    // than the biggest outright (which is the rent).
    const cutTarget = catTotals.find(c => c.kind === 'discretionary')
        || catTotals.find(c => c.kind === 'variable')
        || catTotals[0];
    if (cutTarget) {
        const saved = cutTarget.total * 0.20;
        const flavour = cutTarget.kind === 'discretionary' ? 'discretionary'
            : cutTarget.kind === 'variable' ? 'variable' : 'largest';
        cards.push({
            tone: 'info', label: `If you cut ${cutTarget.name} by 20%`,
            value: fmtMoney(saved),
            sub: `Saved across the ${months}-month horizon — your biggest ${flavour} category`
        });
    }

    // Forecast end balance
    const endBal = runningBalance[months - 1] || 0;
    cards.push({
        tone: endBal >= startingBalance ? 'positive' : 'warning',
        label: `Projected cash (${monthList[months-1].label})`,
        value: fmtMoney(endBal),
        sub: `${endBal >= startingBalance ? '+' : ''}${fmtMoney(endBal - startingBalance)} from ${fmtMoney(startingBalance)} today`
    });

    return cards;
}
