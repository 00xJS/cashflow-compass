/* =========================================================
   Cashflow Compass — application layer
   DOM rendering, storage, import/export, event wiring.
   Depends on engine.js being loaded first.
   ========================================================= */
state = loadState();
let editingTxId = null;
let editingAcctId = null;
let editingCatId = null;
const charts = {};
const sortState = {
    categories:   { column: null, direction: 'asc' },
    transactions: { column: null, direction: 'asc' }
};

function sortIndicator(table, column) {
    const s = sortState[table];
    if (s.column !== column) return '<span style="opacity:0.3;">↕</span>';
    return s.direction === 'asc' ? '▲' : '▼';
}

function toggleSort(table, column) {
    const s = sortState[table];
    if (s.column === column) {
        s.direction = s.direction === 'asc' ? 'desc' : 'asc';
    } else {
        s.column = column;
        s.direction = 'asc';
    }
    if (table === 'categories') renderCategories();
    else if (table === 'transactions') renderTransactions();
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState();
        const parsed = JSON.parse(raw);
        return migrate(parsed);
    } catch (e) {
        console.warn('Could not load state, starting fresh', e);
        return defaultState();
    }
}

let saveTimer;
function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 200);
}

/* ───── Rendering: Accounts ───── */

function renderAccounts() {
    const tbody = document.querySelector('#accountsTable tbody');
    if (state.accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty">No accounts yet. Add one above to set your starting balance.</td></tr>`;
    } else {
        tbody.innerHTML = state.accounts.map(a => `
            <tr>
                <td>${escapeHtml(a.name)}</td>
                <td><span class="tag">${a.type}</span></td>
                <td class="num">${fmtMoney(a.startingBalance)}</td>
                <td>${a.asOfDate || ''}</td>
                <td class="num row-actions">
                    <button class="icon" data-edit-acct="${a.id}">✎</button>
                    <button class="icon" data-del-acct="${a.id}">✕</button>
                </td>
            </tr>
        `).join('');
    }
    const total = state.accounts.reduce((s, a) => s + (a.type === 'credit' ? -1 : 1) * (parseFloat(a.startingBalance) || 0), 0);
    document.getElementById('accountsMeta').textContent =
        state.accounts.length === 0 ? '' : `${state.accounts.length} account(s) · Net ${fmtMoney(total)}`;

    tbody.querySelectorAll('[data-edit-acct]').forEach(b => b.onclick = () => editAccount(b.dataset.editAcct));
    tbody.querySelectorAll('[data-del-acct]').forEach(b => b.onclick = () => deleteAccount(b.dataset.delAcct));
}

function editAccount(id) {
    const a = state.accounts.find(x => x.id === id);
    if (!a) return;
    editingAcctId = id;
    document.getElementById('acctName').value = a.name;
    document.getElementById('acctType').value = a.type;
    document.getElementById('acctBalance').value = a.startingBalance;
    document.getElementById('acctAsOf').value = a.asOfDate;
    document.getElementById('acctSubmitBtn').textContent = 'Update Account';
    document.getElementById('acctCancelBtn').classList.remove('hidden');
    document.getElementById('acctEditingHint').textContent = 'Editing ' + a.name;
    document.getElementById('section-accounts').scrollIntoView({ behavior: 'smooth' });
}

function deleteAccount(id) {
    confirmModal('Delete account?', 'This will not remove related transactions.', () => {
        state.accounts = state.accounts.filter(a => a.id !== id);
        saveState();
        renderAll();
    });
}

document.getElementById('accountForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
        name: document.getElementById('acctName').value.trim(),
        type: document.getElementById('acctType').value,
        startingBalance: parseFloat(document.getElementById('acctBalance').value) || 0,
        asOfDate: document.getElementById('acctAsOf').value
    };
    if (editingAcctId) {
        const a = state.accounts.find(x => x.id === editingAcctId);
        Object.assign(a, data);
        editingAcctId = null;
    } else {
        state.accounts.push({ id: uid('acct'), ...data });
    }
    e.target.reset();
    document.getElementById('acctAsOf').value = fmtDate(new Date());
    document.getElementById('acctSubmitBtn').textContent = 'Add Account';
    document.getElementById('acctCancelBtn').classList.add('hidden');
    document.getElementById('acctEditingHint').textContent = '';
    saveState();
    renderAll();
});

document.getElementById('acctCancelBtn').onclick = () => {
    editingAcctId = null;
    document.getElementById('accountForm').reset();
    document.getElementById('acctAsOf').value = fmtDate(new Date());
    document.getElementById('acctSubmitBtn').textContent = 'Add Account';
    document.getElementById('acctCancelBtn').classList.add('hidden');
    document.getElementById('acctEditingHint').textContent = '';
};

/* ───── Rendering: Categories ───── */

function renderCategories() {
    const head = document.getElementById('categoriesHeaderRow');
    head.innerHTML = `
        <th>Color</th>
        <th class="sortable" data-sort-cat="name">Name <span class="ind">${sortIndicator('categories','name')}</span></th>
        <th class="sortable" data-sort-cat="kind">Kind <span class="ind">${sortIndicator('categories','kind')}</span></th>
        <th class="num">Actions</th>
    `;
    head.querySelectorAll('[data-sort-cat]').forEach(th => th.onclick = () => toggleSort('categories', th.dataset.sortCat));

    const sorted = applySort(state.categories, sortState.categories, {
        name: c => c.name,
        kind: c => KIND_LABELS[c.kind] || c.kind
    });

    const tbody = document.querySelector('#categoriesTable tbody');
    tbody.innerHTML = sorted.map(c => `
        <tr>
            <td><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${c.color};vertical-align:middle;"></span></td>
            <td>${escapeHtml(c.name)}</td>
            <td><span class="tag">${KIND_LABELS[c.kind] || c.kind}</span></td>
            <td class="num row-actions">
                <button class="icon" data-edit-cat="${c.id}">✎</button>
                <button class="icon" data-del-cat="${c.id}">✕</button>
            </td>
        </tr>
    `).join('');
    tbody.querySelectorAll('[data-edit-cat]').forEach(b => b.onclick = () => editCategory(b.dataset.editCat));
    tbody.querySelectorAll('[data-del-cat]').forEach(b => b.onclick = () => deleteCategory(b.dataset.delCat));
}

function editCategory(id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    editingCatId = id;
    document.getElementById('catName').value = c.name;
    document.getElementById('catKind').value = c.kind;
    document.getElementById('catColor').value = c.color;
    document.getElementById('catSubmitBtn').textContent = 'Update Category';
    document.getElementById('catCancelBtn').classList.remove('hidden');
}

function deleteCategory(id) {
    const used = state.transactions.some(t => t.categoryId === id);
    if (used) {
        alert('Cannot delete: this category is used by one or more transactions. Reassign them first.');
        return;
    }
    state.categories = state.categories.filter(c => c.id !== id);
    saveState();
    renderAll();
}

document.getElementById('categoryForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
        name: document.getElementById('catName').value.trim(),
        kind: document.getElementById('catKind').value,
        color: document.getElementById('catColor').value
    };
    if (editingCatId) {
        const c = state.categories.find(x => x.id === editingCatId);
        Object.assign(c, data);
        editingCatId = null;
    } else {
        state.categories.push({ id: uid('cat'), ...data });
    }
    e.target.reset();
    document.getElementById('catColor').value = '#ff9a44';
    document.getElementById('catSubmitBtn').textContent = 'Add Category';
    document.getElementById('catCancelBtn').classList.add('hidden');
    saveState();
    renderAll();
});

document.getElementById('catCancelBtn').onclick = () => {
    editingCatId = null;
    document.getElementById('categoryForm').reset();
    document.getElementById('catColor').value = '#ff9a44';
    document.getElementById('catSubmitBtn').textContent = 'Add Category';
    document.getElementById('catCancelBtn').classList.add('hidden');
};

function setupCollapsible(toggleId, bodyId) {
    const btn = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    if (!btn || !body) return;
    btn.onclick = () => {
        const collapsed = body.classList.toggle('hidden');
        btn.textContent = collapsed ? '▸' : '▾';
        btn.setAttribute('aria-expanded', String(!collapsed));
    };
}
setupCollapsible('catToggle',      'catBody');
setupCollapsible('txToggle',       'txBody');
setupCollapsible('forecastToggle', 'forecastBody');
setupCollapsible('chartsToggle',   'chartsGrid');

/* ───── Rendering: Transactions ───── */

function refreshSelects() {
    const catSel = document.getElementById('txCategory');
    const filtCat = document.getElementById('txFilterCategory');
    const acctSel = document.getElementById('txAccount');
    const fromAcctSel = document.getElementById('txFromAccount');

    catSel.innerHTML = state.categories.map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)} — ${KIND_LABELS[c.kind]}</option>`).join('');
    filtCat.innerHTML = '<option value="">All</option>' + state.categories.map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const acctOpts = state.accounts.map(a =>
        `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    acctSel.innerHTML = acctOpts || '<option value="">— Add an account first —</option>';
    fromAcctSel.innerHTML = acctOpts;
}

function renderTransactions() {
    const head = document.getElementById('txHeaderRow');
    head.innerHTML = `
        <th class="sortable" data-sort-tx="name">Name <span class="ind">${sortIndicator('transactions','name')}</span></th>
        <th>Kind</th>
        <th>Category</th>
        <th>Account</th>
        <th class="num sortable" data-sort-tx="amount">Amount <span class="ind">${sortIndicator('transactions','amount')}</span></th>
        <th>Frequency</th>
        <th class="sortable" data-sort-tx="start">Start <span class="ind">${sortIndicator('transactions','start')}</span></th>
        <th>End</th>
        <th class="num sortable" data-sort-tx="annualized">Annualized <span class="ind">${sortIndicator('transactions','annualized')}</span></th>
        <th>Tags</th>
        <th class="num">Actions</th>
    `;
    head.querySelectorAll('[data-sort-tx]').forEach(th => th.onclick = () => toggleSort('transactions', th.dataset.sortTx));

    const tbody = document.querySelector('#txTable tbody');
    const search = document.getElementById('txSearch').value.toLowerCase().trim();
    const fk = document.getElementById('txFilterKind').value;
    const fc = document.getElementById('txFilterCategory').value;

    const filtered = state.transactions.filter(t => {
        if (fk && t.kind !== fk) return false;
        if (fc && t.categoryId !== fc) return false;
        if (search) {
            const hay = [t.name, (t.tags || []).join(','), t.notes || ''].join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    const sorted = applySort(filtered, sortState.transactions, {
        name:       t => t.name,
        amount:     t => parseFloat(t.amount) || 0,
        start:      t => t.startDate || '',
        annualized: t => annualizedCost(t)
    });

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="empty">No transactions${state.transactions.length ? ' match the filter.' : ' yet. Add one above.'}</td></tr>`;
    } else {
        tbody.innerHTML = sorted.map(t => {
            const cat = state.categories.find(c => c.id === t.categoryId);
            const acct = state.accounts.find(a => a.id === t.accountId);
            const ann = annualizedCost(t);
            return `
                <tr${t.paused ? ' style="opacity:0.55;"' : ''}>
                    <td>${escapeHtml(t.name)}${t.paused ? ' <span class="tag paused">paused</span>' : ''}</td>
                    <td><span class="tag ${t.kind}">${t.kind}</span></td>
                    <td>${cat ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cat.color};margin-right:6px;vertical-align:middle;"></span>${escapeHtml(cat.name)}` : '—'}</td>
                    <td>${acct ? escapeHtml(acct.name) : '—'}</td>
                    <td class="num">${fmtMoney(t.amount)}</td>
                    <td>${FREQUENCY_LABELS[t.frequency] || t.frequency}${t.frequency === 'custom' ? ` (${t.customN} ${t.customUnit})` : ''}${t.escalation ? ` · +${t.escalation}%/yr` : ''}</td>
                    <td>${t.startDate || ''}</td>
                    <td>${t.endDate || ''}</td>
                    <td class="num">${fmtMoney(ann)}</td>
                    <td>${(t.tags || []).map(tg => `<span class="tag">${escapeHtml(tg)}</span>`).join('')}</td>
                    <td class="num row-actions">
                        <button class="icon" data-pause="${t.id}" title="${t.paused ? 'Resume' : 'Pause'}">${t.paused ? '▶' : '⏸'}</button>
                        <button class="icon" data-clone="${t.id}" title="Duplicate">⎘</button>
                        <button class="icon" data-edit="${t.id}">✎</button>
                        <button class="icon" data-del="${t.id}">✕</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    document.getElementById('txMeta').textContent =
        state.transactions.length === 0 ? '' : `${filtered.length} of ${state.transactions.length} shown`;

    tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editTransaction(b.dataset.edit));
    tbody.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteTransaction(b.dataset.del));
    tbody.querySelectorAll('[data-pause]').forEach(b => b.onclick = () => togglePause(b.dataset.pause));
    tbody.querySelectorAll('[data-clone]').forEach(b => b.onclick = () => cloneTransaction(b.dataset.clone));
}

function editTransaction(id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;
    editingTxId = id;
    document.getElementById('txName').value = t.name;
    document.getElementById('txKind').value = t.kind;
    document.getElementById('txAmount').value = t.amount;
    document.getElementById('txCategory').value = t.categoryId || '';
    document.getElementById('txAccount').value = t.accountId || '';
    document.getElementById('txFromAccount').value = t.fromAccountId || '';
    document.getElementById('txFrequency').value = t.frequency;
    document.getElementById('txCustomN').value = t.customN || 1;
    document.getElementById('txCustomUnit').value = t.customUnit || 'days';
    document.getElementById('txStart').value = t.startDate || '';
    document.getElementById('txEnd').value = t.endDate || '';
    document.getElementById('txEscalation').value = t.escalation || 0;
    document.getElementById('txTags').value = (t.tags || []).join(', ');
    document.getElementById('txNotes').value = t.notes || '';
    document.getElementById('txSubmitBtn').textContent = 'Update Transaction';
    document.getElementById('txCancelBtn').classList.remove('hidden');
    document.getElementById('txEditingHint').textContent = 'Editing ' + t.name;
    onKindOrFreqChange();
    document.getElementById('section-transactions').scrollIntoView({ behavior: 'smooth' });
}

function deleteTransaction(id) {
    confirmModal('Delete transaction?', 'This is permanent.', () => {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveState();
        renderAll();
    });
}

function togglePause(id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;
    t.paused = !t.paused;
    saveState();
    renderAll();
}

function cloneTransaction(id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;
    const copy = { ...t, id: uid('tx'), name: t.name + ' (copy)' };
    state.transactions.push(copy);
    saveState();
    renderAll();
}

function onKindOrFreqChange() {
    const kind = document.getElementById('txKind').value;
    const freq = document.getElementById('txFrequency').value;
    document.getElementById('txFromAccountWrap').classList.toggle('hidden', kind !== 'transfer');
    document.getElementById('txCustomWrap').classList.toggle('hidden', freq !== 'custom');
}

document.getElementById('txKind').onchange = onKindOrFreqChange;
document.getElementById('txFrequency').onchange = onKindOrFreqChange;

document.getElementById('txForm').addEventListener('submit', e => {
    e.preventDefault();
    if (state.accounts.length === 0) {
        alert('Please add at least one account first so transactions have somewhere to land.');
        return;
    }
    const data = {
        name: document.getElementById('txName').value.trim(),
        kind: document.getElementById('txKind').value,
        amount: parseFloat(document.getElementById('txAmount').value) || 0,
        categoryId: document.getElementById('txCategory').value,
        accountId: document.getElementById('txAccount').value,
        fromAccountId: document.getElementById('txFromAccount').value || null,
        frequency: document.getElementById('txFrequency').value,
        customN: parseInt(document.getElementById('txCustomN').value) || 1,
        customUnit: document.getElementById('txCustomUnit').value,
        startDate: document.getElementById('txStart').value,
        endDate: document.getElementById('txEnd').value || null,
        escalation: parseFloat(document.getElementById('txEscalation').value) || 0,
        tags: document.getElementById('txTags').value.split(',').map(s => s.trim()).filter(Boolean),
        notes: document.getElementById('txNotes').value.trim(),
        paused: false
    };
    if (editingTxId) {
        const t = state.transactions.find(x => x.id === editingTxId);
        const wasPaused = t.paused;
        Object.assign(t, data, { paused: wasPaused });
        editingTxId = null;
    } else {
        state.transactions.push({ id: uid('tx'), ...data });
    }
    e.target.reset();
    document.getElementById('txStart').value = fmtDate(new Date());
    document.getElementById('txSubmitBtn').textContent = 'Add Transaction';
    document.getElementById('txCancelBtn').classList.add('hidden');
    document.getElementById('txEditingHint').textContent = '';
    onKindOrFreqChange();
    saveState();
    renderAll();
});

document.getElementById('txCancelBtn').onclick = () => {
    editingTxId = null;
    document.getElementById('txForm').reset();
    document.getElementById('txStart').value = fmtDate(new Date());
    document.getElementById('txSubmitBtn').textContent = 'Add Transaction';
    document.getElementById('txCancelBtn').classList.add('hidden');
    document.getElementById('txEditingHint').textContent = '';
    onKindOrFreqChange();
};

['txSearch', 'txFilterKind', 'txFilterCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTransactions);
    document.getElementById(id).addEventListener('change', renderTransactions);
});

/* ───── Forecast grid ───── */

function renderForecast(forecast) {
    const { monthList, txData, monthlyIncome, monthlyExpense, monthlyNet, runningBalance } = forecast;
    const months = monthList.length;
    document.getElementById('forecastTitle').textContent =
        `${months}-Month Forecast (${horizonRangeLabel(months)})`;

    const head = document.getElementById('forecastHeaderRow');
    head.innerHTML = '<th>Item</th>' + monthList.map(m => `<th class="num">${m.label}</th>`).join('') + '<th class="num">Total</th>';

    const tbody = document.querySelector('#forecastTable tbody');

    // Group transactions by category kind
    const groups = {};
    state.transactions.forEach(t => {
        const cat = state.categories.find(c => c.id === t.categoryId);
        const kind = cat ? cat.kind : 'other';
        if (!groups[kind]) groups[kind] = [];
        const data = txData.find(d => d.tx.id === t.id);
        if (data) groups[kind].push(data);
    });

    // Within Fixed group: bucket by frequency (monthly-ish first, then annual,
    // then everything else), and sort each bucket by amount desc.
    if (groups.fixed) {
        const freqBucket = f => (
            ['weekly','bi-weekly','semi-monthly','monthly','quarterly'].includes(f) ? 0 :
            ['semi-annual','annual'].includes(f) ? 1 : 2
        );
        groups.fixed.sort((a, b) => {
            const ba = freqBucket(a.tx.frequency);
            const bb = freqBucket(b.tx.frequency);
            if (ba !== bb) return ba - bb;
            return (parseFloat(b.tx.amount) || 0) - (parseFloat(a.tx.amount) || 0);
        });
    }

    const groupOrder = ['income', 'fixed', 'variable', 'discretionary', 'savings', 'debt', 'tax', 'goal', 'other'];

    let html = '';
    groupOrder.forEach(kind => {
        if (!groups[kind] || groups[kind].length === 0) return;
        html += `<tr class="group-row"><td colspan="${months + 2}">${KIND_LABELS[kind] || kind}</td></tr>`;
        groups[kind].forEach(({ tx, byMonth }) => {
            const total = byMonth.reduce((s, n) => s + n, 0);
            html += `<tr><td title="${escapeHtml(tx.notes || '')}">${escapeHtml(tx.name)}${tx.paused ? ' <span class="tag paused">paused</span>' : ''}</td>`;
            byMonth.forEach(amt => {
                if (amt === 0) html += '<td class="num muted-text">—</td>';
                else html += `<td class="num ${amt > 0 ? 'positive' : 'negative'}">${fmtMoney(amt)}</td>`;
            });
            html += `<td class="num ${total > 0 ? 'positive' : (total < 0 ? 'negative' : '')}">${fmtMoney(total)}</td></tr>`;
        });
    });

    // Summary rows
    html += '<tr class="summary-row"><td>Total Income</td>' +
        monthlyIncome.map(n => `<td class="num positive">${fmtMoney(n)}</td>`).join('') +
        `<td class="num positive">${fmtMoney(monthlyIncome.reduce((s,n)=>s+n,0))}</td></tr>`;
    html += '<tr class="summary-row"><td>Total Expenses</td>' +
        monthlyExpense.map(n => `<td class="num negative">${fmtMoney(-n)}</td>`).join('') +
        `<td class="num negative">${fmtMoney(-monthlyExpense.reduce((s,n)=>s+n,0))}</td></tr>`;
    html += '<tr class="summary-row"><td>Net Cash Flow</td>' +
        monthlyNet.map(n => `<td class="num ${n>=0?'positive':'negative'}">${fmtMoney(n)}</td>`).join('') +
        `<td class="num">${fmtMoney(monthlyNet.reduce((s,n)=>s+n,0))}</td></tr>`;
    html += '<tr class="balance-row"><td>End-of-Month Balance</td>' +
        runningBalance.map(n => `<td class="num ${n<0?'balance-neg':''}">${fmtMoney(n)}</td>`).join('') +
        '<td></td></tr>';

    tbody.innerHTML = html;

    document.getElementById('forecastMeta').textContent =
        `Starting balance ${fmtMoney(forecast.startingBalance)} · End ${fmtMoney(runningBalance[months-1] || 0)}`;
}

/* ───── Charts ───── */

/* Deck chart theming: colors are read from the CSS variables at chart-build
 * time so charts stay in lockstep with the token block. */
function deckChartTheme() {
    const css = getComputedStyle(document.documentElement);
    const v = n => css.getPropertyValue(n).trim();
    Chart.defaults.color = v('--muted');
    Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
    Chart.defaults.font.family = v('--font-sans');
    Chart.defaults.plugins.tooltip.backgroundColor = v('--bg-raised');
    Chart.defaults.plugins.tooltip.titleColor = v('--text');
    Chart.defaults.plugins.tooltip.bodyColor = v('--muted');
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.09)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    return {
        accent: v('--accent'), accentDeep: v('--accent-deep'), magenta: v('--magenta'),
        live: v('--live'), warn: v('--warn'), down: v('--down'),
        muted: v('--muted'), faint: v('--faint'), card: v('--card'),
        accentFill: 'rgba(255,154,68,0.12)'
    };
}

function destroyCharts() {
    Object.keys(charts).forEach(k => { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
}

const CHART_KEYS = ['monthly', 'balance', 'category', 'trend', 'top', 'income'];

// Per-chart horizon resolution: explicit override → global setting.
function chartHorizonToken(key) {
    return state.settings.chartHorizons[key] || state.settings.forecastHorizon;
}
function chartHorizonMonths(key) {
    return resolveHorizon(chartHorizonToken(key));
}

// Cache forecasts per horizon length so charts sharing a horizon share work.
const _forecastCache = new Map();
function getForecast(months) {
    if (!_forecastCache.has(months)) _forecastCache.set(months, buildForecast(months));
    return _forecastCache.get(months);
}
function clearForecastCache() { _forecastCache.clear(); }

function setChartRange(key, months) {
    const el = document.getElementById('range-' + key);
    if (el) el.textContent = ' · ' + months + 'mo · ' + horizonRangeLabel(months);
}

const moneyTooltip = {
    callbacks: { label: ctx => `${ctx.dataset.label || ctx.label}: ${fmtMoney(ctx.parsed.y ?? ctx.parsed)}` }
};

const chartRenderers = {
    monthly(months, T) {
        const fc = getForecast(months);
        const labels = fc.monthList.map(m => m.label);
        charts.monthly = new Chart(document.getElementById('chartMonthly'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Income',   data: fc.monthlyIncome,                  backgroundColor: T.live + 'D9' },
                    { label: 'Expenses', data: fc.monthlyExpense.map(n => -n),    backgroundColor: T.down + 'D9' },
                    { label: 'Net',      data: fc.monthlyNet,                     type: 'line', borderColor: T.accent, backgroundColor: T.accent, tension: 0.25, yAxisID: 'y' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { ticks: { callback: v => fmtMoney(v, {compact:true}) } } },
                plugins: { tooltip: moneyTooltip } }
        });
    },
    balance(months, T) {
        const fc = getForecast(months);
        const labels = fc.monthList.map(m => m.label);
        charts.balance = new Chart(document.getElementById('chartBalance'), {
            type: 'line',
            data: { labels, datasets: [{
                label: 'Projected Balance', data: fc.runningBalance,
                fill: true, borderColor: T.accent,
                backgroundColor: T.accentFill, tension: 0.3
            }] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { ticks: { callback: v => fmtMoney(v, {compact:true}) } } },
                plugins: { tooltip: moneyTooltip } }
        });
    },
    category(months, T) {
        const fc = getForecast(months);
        const totals = state.categories
            .filter(c => c.kind !== 'income')
            .map(c => {
                const arr = fc.monthlyByCategory[c.id] || [];
                const tot = arr.reduce((s, n) => s + n, 0);
                return { name: c.name, color: c.color, total: tot };
            }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        charts.category = new Chart(document.getElementById('chartCategory'), {
            type: 'doughnut',
            data: { labels: totals.map(e => e.name),
                datasets: [{ data: totals.map(e => e.total), backgroundColor: totals.map(e => e.color), borderColor: T.card }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtMoney(ctx.parsed)}` } } } }
        });
    },
    trend(months, T) {
        const fc = getForecast(months);
        const labels = fc.monthList.map(m => m.label);
        const cats = state.categories.filter(c => c.kind !== 'income' && fc.monthlyByCategory[c.id]);
        charts.trend = new Chart(document.getElementById('chartTrend'), {
            type: 'line',
            data: { labels, datasets: cats.map(c => ({
                label: c.name, data: fc.monthlyByCategory[c.id],
                fill: true, borderColor: c.color, backgroundColor: c.color + '55',
                tension: 0.25, pointRadius: 0
            })) },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { stacked: true, ticks: { callback: v => fmtMoney(v, {compact:true}) } } },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: moneyTooltip
                } }
        });
    },
    top(months, T) {
        const fc = getForecast(months);
        // Sum each expense transaction's outflow over the horizon.
        const items = state.transactions
            .filter(t => t.kind === 'expense' && !t.paused)
            .map(t => {
                const data = fc.txData.find(d => d.tx.id === t.id);
                const total = data ? data.byMonth.reduce((s, n) => s + Math.abs(n), 0) : 0;
                return { name: t.name, amt: total };
            }).filter(x => x.amt > 0).sort((a, b) => b.amt - a.amt).slice(0, 10);
        charts.top = new Chart(document.getElementById('chartTop'), {
            type: 'bar',
            data: { labels: items.map(x => x.name),
                datasets: [{ label: 'Cost over period', data: items.map(x => x.amt), backgroundColor: T.accent }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: { x: { ticks: { callback: v => fmtMoney(v, {compact:true}) } } },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtMoney(ctx.parsed.x)}` } }
                } }
        });
    },
    income(months, T) {
        const fc = getForecast(months);
        const incomeCats = state.categories.filter(c => c.kind === 'income');
        const totals = incomeCats.map(c => {
            const arr = fc.monthlyByCategory[c.id] || [];
            return { name: c.name, color: c.color, total: arr.reduce((s, n) => s + n, 0) };
        }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        charts.income = new Chart(document.getElementById('chartIncome'), {
            type: 'doughnut',
            data: { labels: totals.map(x => x.name),
                datasets: [{ data: totals.map(x => x.total), backgroundColor: totals.map(x => x.color), borderColor: T.card }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtMoney(ctx.parsed)}` } } } }
        });
    }
};

function renderChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
    const T = deckChartTheme();
    const months = chartHorizonMonths(key);
    setChartRange(key, months);
    chartRenderers[key](months, T);
}

function renderCharts() {
    destroyCharts();
    clearForecastCache();
    const T = deckChartTheme();
    CHART_KEYS.forEach(k => {
        const months = chartHorizonMonths(k);
        setChartRange(k, months);
        chartRenderers[k](months, T);
    });
}

function refreshChartHorizonSelects() {
    document.querySelectorAll('.chart-horizon').forEach(sel => {
        const key = sel.dataset.chart;
        const ov = state.settings.chartHorizons[key] || '';
        sel.innerHTML = `<option value="">Match global (${state.settings.forecastHorizon === 'eoy' ? 'EoY' : state.settings.forecastHorizon + 'mo'})</option>` +
            HORIZON_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        sel.value = ov;
    });
}

document.addEventListener('change', e => {
    if (!e.target.classList?.contains('chart-horizon')) return;
    const key = e.target.dataset.chart;
    const value = e.target.value;
    if (value) state.settings.chartHorizons[key] = value;
    else delete state.settings.chartHorizons[key];
    saveState();
    renderChart(key);
    refreshChartHorizonSelects();
});

/* ───── Insights ───── */

function renderInsights(forecast) {
    const grid = document.getElementById('insightsGrid');
    const cards = computeInsights(forecast);
    grid.innerHTML = cards.map(c => `
        <div class="insight-card ${c.tone || 'info'}">
            <div class="label">${c.label}</div>
            <div class="value">${c.value}</div>
            ${c.sub ? `<div class="sub">${c.sub}</div>` : ''}
        </div>
    `).join('') || `<div class="empty">Add transactions to unlock insights.</div>`;
}


/* ───── Excel export / import ───── */

function exportExcel() {
    const wb = XLSX.utils.book_new();

    const accountRows = [['id','name','type','startingBalance','asOfDate']];
    state.accounts.forEach(a => accountRows.push([a.id, a.name, a.type, a.startingBalance, a.asOfDate]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(accountRows), 'Accounts');

    const catRows = [['id','name','kind','color']];
    state.categories.forEach(c => catRows.push([c.id, c.name, c.kind, c.color]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catRows), 'Categories');

    const txRows = [[
        'id','name','kind','amount','categoryId','accountId','fromAccountId',
        'frequency','customN','customUnit','startDate','endDate','escalation',
        'tags','notes','paused'
    ]];
    state.transactions.forEach(t => txRows.push([
        t.id, t.name, t.kind, t.amount, t.categoryId, t.accountId, t.fromAccountId || '',
        t.frequency, t.customN || 1, t.customUnit || 'days',
        t.startDate || '', t.endDate || '', t.escalation || 0,
        (t.tags || []).join(';'), t.notes || '', t.paused ? 'TRUE' : 'FALSE'
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), 'Transactions');

    const settingsRows = [
        ['key','value'],
        ['schemaVersion', SCHEMA_VERSION],
        ['currency', state.settings.currency],
        ['forecastHorizon', state.settings.forecastHorizon]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settingsRows), 'Settings');

    // Forecast (read-only export of current projection)
    const fc = buildForecast(resolveHorizon(state.settings.forecastHorizon));
    const fcHead = ['Item','Kind', ...fc.monthList.map(m => m.label), 'Total'];
    const fcRows = [fcHead];
    state.transactions.forEach(t => {
        const cat = state.categories.find(c => c.id === t.categoryId);
        const row = [t.name, cat ? cat.name : '', ...fc.txData.find(d => d.tx.id === t.id).byMonth];
        row.push(row.slice(2).reduce((s,n) => s + n, 0));
        fcRows.push(row);
    });
    fcRows.push([]);
    fcRows.push(['Total Income','', ...fc.monthlyIncome, fc.monthlyIncome.reduce((s,n)=>s+n,0)]);
    fcRows.push(['Total Expenses','', ...fc.monthlyExpense.map(n=>-n), -fc.monthlyExpense.reduce((s,n)=>s+n,0)]);
    fcRows.push(['Net Cash Flow','', ...fc.monthlyNet, fc.monthlyNet.reduce((s,n)=>s+n,0)]);
    fcRows.push(['End-of-Month Balance','', ...fc.runningBalance, '']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fcRows), 'Forecast');

    const date = fmtDate(new Date());
    XLSX.writeFile(wb, `budget-${date}.xlsx`);
}

function importExcelArrayBuffer(ab) {
    const wb = XLSX.read(ab, { type: 'array' });
    const newState = defaultState();

    // Settings (read first to get schemaVersion)
    const settingsSheet = wb.Sheets['Settings'];
    if (settingsSheet) {
        const rows = XLSX.utils.sheet_to_json(settingsSheet, { header: 1 });
        rows.slice(1).forEach(([k, v]) => {
            if (k === 'currency')             newState.settings.currency = String(v || 'USD');
            else if (k === 'forecastHorizon') newState.settings.forecastHorizon = String(v || '12');
            else if (k === 'forecastMonths')  newState.settings.forecastHorizon = String(parseInt(v) || 12);
            // 'theme' from older workbooks is ignored — the app is dark-only.
        });
    }

    const acctSheet = wb.Sheets['Accounts'];
    if (acctSheet) {
        const rows = XLSX.utils.sheet_to_json(acctSheet, { defval: '' });
        newState.accounts = rows.map(r => ({
            id: r.id || uid('acct'),
            name: String(r.name || '').trim(),
            type: String(r.type || 'checking'),
            startingBalance: parseFloat(r.startingBalance) || 0,
            asOfDate: normalizeDate(r.asOfDate)
        })).filter(a => a.name);
    }

    const catSheet = wb.Sheets['Categories'];
    if (catSheet) {
        const rows = XLSX.utils.sheet_to_json(catSheet, { defval: '' });
        newState.categories = rows.map(r => ({
            id: r.id || uid('cat'),
            name: String(r.name || '').trim(),
            kind: String(r.kind || 'variable'),
            color: String(r.color || '#ff9a44')
        })).filter(c => c.name);
        if (newState.categories.length === 0) newState.categories = structuredClone(DEFAULT_CATEGORIES);
    }

    const txSheet = wb.Sheets['Transactions'];
    if (txSheet) {
        const rows = XLSX.utils.sheet_to_json(txSheet, { defval: '' });
        newState.transactions = rows.map(r => ({
            id: r.id || uid('tx'),
            name: String(r.name || '').trim(),
            kind: String(r.kind || 'expense'),
            amount: parseFloat(r.amount) || 0,
            categoryId: String(r.categoryId || ''),
            accountId: String(r.accountId || ''),
            fromAccountId: r.fromAccountId ? String(r.fromAccountId) : null,
            frequency: String(r.frequency || 'monthly'),
            customN: parseInt(r.customN) || 1,
            customUnit: String(r.customUnit || 'days'),
            startDate: normalizeDate(r.startDate),
            endDate: r.endDate ? normalizeDate(r.endDate) : null,
            escalation: parseFloat(r.escalation) || 0,
            tags: typeof r.tags === 'string' ? r.tags.split(';').map(s => s.trim()).filter(Boolean) : [],
            notes: String(r.notes || ''),
            paused: String(r.paused).toUpperCase() === 'TRUE'
        })).filter(t => t.name);
    }

    state = newState;
    saveState();
    renderAll();
    flashStatus('Imported from Excel — replaced all in-browser data.');
}

function normalizeDate(v) {
    if (!v) return '';
    if (v instanceof Date) return fmtDate(v);
    if (typeof v === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!isNaN(d)) return fmtDate(d);
    return '';
}

/* ───── JSON export / import ───── */

function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `budget-${fmtDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importJsonText(text) {
    try {
        const parsed = JSON.parse(text);
        state = migrate(parsed);
        saveState();
        renderAll();
        flashStatus('Imported JSON — replaced all in-browser data.');
    } catch (e) {
        alert('Could not read JSON: ' + e.message);
    }
}

/* ───── Currency / horizon ───── */

document.getElementById('currencySelect').onchange = e => {
    state.settings.currency = e.target.value;
    saveState();
    renderAll();
};

document.getElementById('horizonSelect').onchange = e => {
    state.settings.forecastHorizon = e.target.value;
    saveState();
    renderAll();
};

/* ───── Modal helpers ───── */

function confirmModal(title, body, onConfirm) {
    const mount = document.getElementById('modalMount');
    mount.innerHTML = `
        <div class="modal-overlay">
            <div class="modal">
                <h3>${title}</h3>
                <p>${body}</p>
                <div class="form-actions">
                    <button id="mCancel" class="ghost">Cancel</button>
                    <button id="mOk" class="danger">Confirm</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('mCancel').onclick = () => mount.innerHTML = '';
    document.getElementById('mOk').onclick = () => { mount.innerHTML = ''; onConfirm(); };
}

function flashStatus(msg) {
    console.log('[Cashflow Compass]', msg);
}

/* ───── File import handling ───── */

document.getElementById('exportXlsxBtn').onclick = exportExcel;
document.getElementById('exportJsonBtn').onclick = exportJson;
document.getElementById('importXlsxBtn').onclick = () => triggerImport('.xlsx,.xls');
document.getElementById('importJsonBtn').onclick = () => triggerImport('.json');

function triggerImport(accept) {
    confirmModal('Import file?',
        'This will <strong>replace all data</strong> currently in the browser with the contents of the selected file. The Excel/JSON file is treated as the source of truth.',
        () => {
            const fi = document.getElementById('fileInput');
            fi.accept = accept;
            fi.click();
        });
}

document.getElementById('fileInput').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.name.endsWith('.json')) {
        reader.onload = ev => importJsonText(ev.target.result);
        reader.readAsText(file);
    } else {
        reader.onload = ev => importExcelArrayBuffer(ev.target.result);
        reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
};

document.getElementById('resetBtn').onclick = () => {
    confirmModal('Reset everything?',
        'All accounts, categories, and transactions will be wiped. Export first if you want a backup.',
        () => {
            state = defaultState();
            saveState();
            renderAll();
            flashStatus('Reset complete.');
        });
};

/* ───── Render orchestration ───── */

function renderIntroBanner() {
    const banner = document.getElementById('introBanner');
    if (!banner) return;
    const isEmpty = state.accounts.length === 0 && state.transactions.length === 0;
    const dismissed = sessionStorage.getItem('cc_introDismissed') === '1';
    banner.classList.toggle('hidden', !isEmpty || dismissed);
}

function loadSampleData() {
    const today = fmtDate(new Date());
    const checkingId = uid('acct');
    state.accounts = [
        { id: checkingId,    name: 'Checking', type: 'checking', startingBalance: 5000,  asOfDate: today },
        { id: uid('acct'),   name: 'Savings',  type: 'savings',  startingBalance: 12000, asOfDate: today }
    ];
    const tx = (over) => ({
        id: uid('tx'), customN: 1, customUnit: 'days', endDate: null, escalation: 0,
        tags: [], notes: '', paused: false, fromAccountId: null, accountId: checkingId,
        startDate: today, ...over
    });
    state.transactions = [
        tx({ name: 'Paycheck',          kind: 'income',  amount: 1923, categoryId: 'cat_salary',     frequency: 'bi-weekly', escalation: 3 }),
        tx({ name: 'Rent',              kind: 'expense', amount: 900,  categoryId: 'cat_housing',    frequency: 'monthly',   escalation: 5, notes: 'Lease renews yearly' }),
        tx({ name: 'Electric',          kind: 'expense', amount: 110,  categoryId: 'cat_electric',   frequency: 'monthly' }),
        tx({ name: 'Home Internet',     kind: 'expense', amount: 70,   categoryId: 'cat_internet',   frequency: 'monthly' }),
        tx({ name: 'Phone Bill',        kind: 'expense', amount: 80,   categoryId: 'cat_phone',      frequency: 'monthly' }),
        tx({ name: 'Car Insurance',     kind: 'expense', amount: 1200, categoryId: 'cat_insurance',  frequency: 'annual' }),
        tx({ name: 'Groceries',         kind: 'expense', amount: 400,  categoryId: 'cat_groceries',  frequency: 'monthly' }),
        tx({ name: 'Gas / Transport',   kind: 'expense', amount: 200,  categoryId: 'cat_gas',        frequency: 'monthly' }),
        tx({ name: 'Dining Out',        kind: 'expense', amount: 200,  categoryId: 'cat_dining',     frequency: 'monthly' }),
        tx({ name: 'Netflix',           kind: 'expense', amount: 17,   categoryId: 'cat_subs',       frequency: 'monthly',   tags: ['subscription'] }),
        tx({ name: 'Apple Music',       kind: 'expense', amount: 12,   categoryId: 'cat_subs',       frequency: 'monthly',   tags: ['subscription'] }),
        tx({ name: 'Amazon Prime',      kind: 'expense', amount: 139,  categoryId: 'cat_subs',       frequency: 'annual',    tags: ['subscription'] }),
        tx({ name: 'Vacation Fund',     kind: 'expense', amount: 125,  categoryId: 'cat_savings',    frequency: 'monthly',   notes: 'Saving for August trip' })
    ];
    saveState();
    renderAll();
}

document.getElementById('loadSampleBtn').onclick = loadSampleData;
document.getElementById('dismissIntroBtn').onclick = () => {
    sessionStorage.setItem('cc_introDismissed', '1');
    renderIntroBanner();
};

function renderAll() {
    document.getElementById('currencySelect').value = state.settings.currency;
    document.getElementById('horizonSelect').value = state.settings.forecastHorizon;
    refreshSelects();
    refreshChartHorizonSelects();
    renderIntroBanner();
    renderAccounts();
    renderCategories();
    renderTransactions();
    const months = resolveHorizon(state.settings.forecastHorizon);
    const forecast = buildForecast(months);
    renderForecast(forecast);
    renderCharts();
    renderInsights(forecast);
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ───── Boot ───── */

document.getElementById('acctAsOf').value = fmtDate(new Date());
document.getElementById('txStart').value = fmtDate(new Date());
renderAll();
onKindOrFreqChange();
