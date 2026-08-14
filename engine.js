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

const SCHEMA_VERSION = 4;
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
        return 12 - now.getMonth(); // months remaining in current calendar year (incl. current)
    }
    const n = parseInt(token);
    return isNaN(n) ? 12 : n;
}

function horizonRangeLabel(months) {
    const today = new Date();
    const end = addMonths(startOfMonth(today), months - 1);
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
    { id: 'cat_tax',        name: 'Taxes',            kind: 'tax',           color: '#c9a26d' }
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
            chartHorizons: {}
        },
        accounts: [],
        categories: structuredClone(DEFAULT_CATEGORIES),
        transactions: []
    };
}

function migrate(s) {
    const fromVersion = s.schemaVersion || 1;
    if (!s.settings) s.settings = defaultState().settings;
    if (!s.accounts) s.accounts = [];
    if (!s.categories || s.categories.length === 0) s.categories = structuredClone(DEFAULT_CATEGORIES);
    // Idempotent: add any default categories that the saved state is missing
    DEFAULT_CATEGORIES.forEach(def => {
        if (!s.categories.find(c => c.id === def.id)) s.categories.push({ ...def });
    });
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
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
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
            // 1st & 15th every month from start
            let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
            while (cursor <= toD) {
                const d1 = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
                const d15 = new Date(cursor.getFullYear(), cursor.getMonth(), 15);
                [d1, d15].forEach(d => {
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

function stepBy(start, n, unit, from, to, out) {
    let d = new Date(start);
    while (d <= to) {
        if (d >= from) out.push(new Date(d));
        d = addDays(d, n);
    }
}
function stepByMonths(start, n, from, to, out) {
    let i = 0;
    while (true) {
        const d = addMonths(start, n * i);
        if (d > to) break;
        if (d >= from) out.push(d);
        i++;
        if (i > 1000) break; // safety
    }
}

function amountAtDate(tx, occDate) {
    const esc = parseFloat(tx.escalation || 0);
    if (!esc) return parseFloat(tx.amount) || 0;
    const start = parseDate(tx.startDate);
    const yearsElapsed = Math.floor((occDate - start) / (365.25 * 86400 * 1000));
    return (parseFloat(tx.amount) || 0) * Math.pow(1 + esc/100, yearsElapsed);
}

function annualizedCost(tx) {
    const today = new Date();
    const yearStart = today;
    const yearEnd = addMonths(today, 12);
    const occs = occurrences(tx, yearStart, yearEnd);
    return occs.reduce((sum, d) => sum + amountAtDate(tx, d), 0);
}

/* ───── Forecast engine ───── */

function buildForecast(months) {
    const today = new Date();
    const horizonStart = startOfMonth(today);
    const horizonEnd = endOfMonth(addMonths(horizonStart, months - 1));

    // Months array
    const monthList = [];
    for (let i = 0; i < months; i++) {
        const m = addMonths(horizonStart, i);
        monthList.push({ date: m, key: ymKey(m), label: ymLabel(m) });
    }
    const monthIndex = Object.fromEntries(monthList.map((m, i) => [m.key, i]));

    // Per-tx monthly buckets
    const txData = state.transactions.map(tx => {
        const occs = occurrences(tx, horizonStart, horizonEnd);
        const byMonth = new Array(months).fill(0);
        const byDay = []; // {date, amount, signed}
        occs.forEach(d => {
            const k = ymKey(d);
            const idx = monthIndex[k];
            if (idx == null) return;
            const amt = amountAtDate(tx, d);
            const signed = tx.kind === 'expense' ? -amt : (tx.kind === 'income' ? amt : 0);
            byMonth[idx] += signed;
            byDay.push({ date: d, amount: amt, signed });
        });
        return { tx, byMonth, byDay, occs };
    });

    // Starting balance = sum of all account starting balances (treating credit as negative)
    const startingBalance = state.accounts.reduce((sum, a) => {
        const sign = a.type === 'credit' ? -1 : 1;
        return sum + sign * (parseFloat(a.startingBalance) || 0);
    }, 0);

    // Monthly totals
    const monthlyIncome = new Array(months).fill(0);
    const monthlyExpense = new Array(months).fill(0);
    const monthlyByCategory = {}; // catId -> array
    txData.forEach(({ tx, byMonth }) => {
        byMonth.forEach((amt, i) => {
            if (amt > 0) monthlyIncome[i] += amt;
            else if (amt < 0) monthlyExpense[i] += -amt;
        });
        if (tx.kind !== 'transfer') {
            if (!monthlyByCategory[tx.categoryId]) monthlyByCategory[tx.categoryId] = new Array(months).fill(0);
            byMonth.forEach((amt, i) => { monthlyByCategory[tx.categoryId][i] += Math.abs(amt); });
        }
    });

    // Running balance
    const monthlyNet = monthlyIncome.map((inc, i) => inc - monthlyExpense[i]);
    const runningBalance = [];
    let cur = startingBalance;
    monthlyNet.forEach((n, i) => { cur += n; runningBalance.push(cur); });

    // Daily running balance (for "days in red" + "tightest week")
    const dailyEvents = [];
    txData.forEach(({ tx, byDay }) => {
        byDay.forEach(({ date, signed }) => dailyEvents.push({ date, signed }));
    });
    dailyEvents.sort((a, b) => a.date - b.date);
    let dCur = startingBalance;
    let daysInRed = 0;
    let lowest = { date: horizonStart, balance: startingBalance };
    let prevDate = horizonStart;
    dailyEvents.forEach(ev => {
        const daysBetween = Math.floor((ev.date - prevDate) / 86400000);
        if (dCur < 0) daysInRed += Math.max(0, daysBetween);
        dCur += ev.signed;
        if (dCur < lowest.balance) lowest = { date: new Date(ev.date), balance: dCur };
        prevDate = ev.date;
    });
    if (dCur < 0) {
        const tail = Math.floor((horizonEnd - prevDate) / 86400000);
        daysInRed += Math.max(0, tail);
    }

    return {
        monthList, txData, startingBalance,
        monthlyIncome, monthlyExpense, monthlyNet, monthlyByCategory,
        runningBalance, daysInRed, lowest
    };
}

/* ───── Currency formatting ───── */

function fmtMoney(n, opts = {}) {
    const cur = state.settings.currency || 'USD';
    const value = isNaN(n) ? 0 : n;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency', currency: cur,
            maximumFractionDigits: opts.compact ? 0 : 2
        }).format(value);
    } catch {
        return value.toFixed(2);
    }
}
function fmtPct(n) {
    return (Math.round(n * 10) / 10).toFixed(1) + '%';
}

function computeInsights(forecast) {
    const cards = [];
    const { monthList, monthlyIncome, monthlyExpense, monthlyNet, monthlyByCategory, runningBalance, daysInRed, lowest, startingBalance } = forecast;
    const months = monthList.length;
    const totalIncome = monthlyIncome.reduce((s,n)=>s+n,0);
    const totalExpense = monthlyExpense.reduce((s,n)=>s+n,0);
    const totalNet = totalIncome - totalExpense;

    // Savings rate
    if (totalIncome > 0) {
        const rate = (totalNet / totalIncome) * 100;
        const tone = rate >= 20 ? 'positive' : rate >= 10 ? 'info' : rate >= 0 ? 'warning' : 'danger';
        cards.push({
            tone, label: 'Avg Savings Rate',
            value: fmtPct(rate),
            sub: `${fmtMoney(totalNet)} saved out of ${fmtMoney(totalIncome)} over ${months} months`
        });
    }

    // Biggest category
    const catTotals = state.categories
        .filter(c => c.kind !== 'income' && monthlyByCategory[c.id])
        .map(c => ({ name: c.name, total: monthlyByCategory[c.id].reduce((s,n)=>s+n,0) }))
        .filter(x => x.total > 0).sort((a,b) => b.total - a.total);
    if (catTotals.length && totalExpense > 0) {
        const top = catTotals[0];
        const pct = (top.total / totalExpense) * 100;
        cards.push({
            tone: 'fact', label: 'Biggest Category',
            value: top.name,
            sub: `${fmtPct(pct)} of spend (${fmtMoney(top.total)} over ${months} mo)`
        });
    }

    // Annualized subscriptions
    const subTx = state.transactions.filter(t => {
        const cat = state.categories.find(c => c.id === t.categoryId);
        return cat && cat.name.toLowerCase().includes('subscription');
    });
    if (subTx.length) {
        const subAnnual = subTx.reduce((s, t) => s + annualizedCost(t), 0);
        cards.push({
            tone: 'fact', label: 'Annual Subscription Cost',
            value: fmtMoney(subAnnual),
            sub: `${subTx.length} subscription(s) — ${fmtMoney(subAnnual/12)}/mo equivalent`
        });
    }

    // Months of emergency-fund coverage at current burn
    const avgMonthlyExpense = totalExpense / months;
    if (avgMonthlyExpense > 0 && startingBalance > 0) {
        const m = startingBalance / avgMonthlyExpense;
        const tone = m >= 6 ? 'positive' : m >= 3 ? 'info' : m >= 1 ? 'warning' : 'danger';
        cards.push({
            tone, label: 'Emergency Fund Coverage',
            value: m.toFixed(1) + ' months',
            sub: `at ${fmtMoney(avgMonthlyExpense)}/mo burn from ${fmtMoney(startingBalance)} starting balance`
        });
    }

    // Days in red
    if (daysInRed > 0) {
        cards.push({
            tone: 'danger', label: 'Days in the Red',
            value: daysInRed + ' days',
            sub: `Lowest balance: ${fmtMoney(lowest.balance)} on ${fmtDate(lowest.date)}`
        });
    } else {
        cards.push({
            tone: 'positive', label: 'Days in the Red',
            value: '0 days',
            sub: `Forecast stays positive — lowest point ${fmtMoney(lowest.balance)} on ${fmtDate(lowest.date)}`
        });
    }

    // 3-paycheck months
    const biwIncome = state.transactions.filter(t => t.frequency === 'bi-weekly' && t.kind === 'income' && !t.paused);
    if (biwIncome.length) {
        const counts = monthList.map((m, i) => {
            const start = m.date;
            const end = endOfMonth(start);
            let c = 0;
            biwIncome.forEach(tx => { c += occurrences(tx, start, end).length; });
            return { label: m.label, count: c };
        });
        const triple = counts.filter(c => c.count >= 3 * biwIncome.length);
        if (triple.length) {
            cards.push({
                tone: 'positive', label: '3-Paycheck Months',
                value: triple.length + ' month(s)',
                sub: triple.map(t => t.label).join(', ') + ' — windfall planning opportunity'
            });
        } else {
            cards.push({
                tone: 'info', label: '3-Paycheck Months',
                value: '0 in this horizon',
                sub: `No extra paycheck months within the current forecast window`
            });
        }
    } else {
        cards.push({
            tone: 'info', label: '3-Paycheck Months',
            value: 'N/A',
            sub: 'Add a bi-weekly income stream to track bonus paycheck months'
        });
    }

    // What-if cut top category by 20%
    if (catTotals.length) {
        const top = catTotals[0];
        const savings = top.total * 0.20;
        cards.push({
            tone: 'info', label: `If you cut ${top.name} by 20%`,
            value: fmtMoney(savings),
            sub: `Saved across the ${months}-month horizon`
        });
    }

    // Forecast end balance
    const endBal = runningBalance[months - 1] || 0;
    cards.push({
        tone: endBal >= startingBalance ? 'positive' : 'warning',
        label: `Projected balance (${monthList[months-1].label})`,
        value: fmtMoney(endBal),
        sub: `${endBal >= startingBalance ? '+' : ''}${fmtMoney(endBal - startingBalance)} from start`
    });

    return cards;
}
