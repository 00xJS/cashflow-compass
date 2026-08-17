/* =========================================================
   Cashflow Compass — v5 panels
   Loads after app.js and renders into the empty containers
   the markup provides. Every panel degrades to a sentence
   rather than an exception when its data or its engine
   function is unavailable.
   ========================================================= */

/* ───── Panel infrastructure ───── */

const V5_STYLE_ID = 'v5PanelStyles';

const V5_CSS = `
.v5-panel .v5-body > *:last-child { margin-bottom: 0; }
.v5-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow);
    padding: 18px 20px;
    margin-bottom: 18px;
}
.v5-h {
    margin: 0 0 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
}
.v5-meta {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-raised);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
}
.v5-meta:empty { display: none; }
.v5-metaline { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.v5-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--faint);
    font-weight: 600;
    margin-bottom: 4px;
}
.v5-note { font-size: 12.5px; color: var(--muted); margin: 0 0 12px; }
.v5-note.tight { margin-bottom: 6px; }
.v5-empty {
    padding: 16px 18px;
    border: 1px dashed var(--border);
    border-radius: var(--radius-control);
    background: var(--bg-raised);
    color: var(--muted);
    font-size: 13.5px;
    margin-bottom: 12px;
}
.v5-empty strong { color: var(--text); font-weight: 650; }
.v5-hero {
    display: flex;
    flex-wrap: wrap;
    gap: 22px;
    align-items: flex-end;
    padding: 14px 16px;
    margin-bottom: 14px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-left: 3px solid var(--info);
    border-radius: var(--radius-control);
}
.v5-hero.pos  { border-left-color: var(--live); }
.v5-hero.warn { border-left-color: var(--warn); }
.v5-hero.neg  { border-left-color: var(--down); }
.v5-hero.mag  { border-left-color: var(--magenta); }
.v5-figure {
    font-size: 2rem;
    line-height: 1.1;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    color: var(--text);
}
.v5-stat { min-width: 118px; }
.v5-stat .v5-val {
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text);
}
.v5-sub { font-size: 12.5px; color: var(--muted); }
.v5-pos { color: var(--live); }
.v5-neg { color: var(--down); }
.v5-warnc { color: var(--warn); }
.v5-infoc { color: var(--info); }
.v5-magc { color: var(--magenta); }
.v5-accentc { color: var(--accent); }
.v5-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg-raised);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    white-space: nowrap;
}
.v5-chip.pos  { color: var(--live);    border-color: var(--live); }
.v5-chip.neg  { color: var(--down);    border-color: var(--down); }
.v5-chip.warn { color: var(--warn);    border-color: var(--warn); }
.v5-chip.info { color: var(--info);    border-color: var(--info); }
.v5-chip.on   { color: var(--accent);  border-color: var(--accent); }
.v5-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-end;
    margin-bottom: 12px;
}
.v5-field { flex: 1 1 150px; min-width: 128px; }
.v5-field.grow { flex: 2 1 220px; }
.v5-field.narrow { flex: 0 1 120px; }
.v5-field .v5-label { margin-bottom: 4px; }
.v5-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.v5-split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin-bottom: 12px;
}
.v5-tile {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    padding: 12px 14px;
}
.v5-tile.lead { border-color: var(--accent); }
.v5-tile h4 {
    margin: 0 0 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}
.v5-kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 3px 0; }
.v5-kv .k { color: var(--muted); }
.v5-kv .v { font-variant-numeric: tabular-nums; font-weight: 600; }
.v5-bar {
    position: relative;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--card-chrome);
    border: 1px solid var(--border);
    overflow: hidden;
}
.v5-bar > span { display: block; height: 100%; background: var(--accent); }
.v5-chart {
    display: block;
    width: 100%;
    min-height: 220px;
    max-height: 280px;
    margin-bottom: 10px;
}
.v5-div {
    position: relative;
    height: 14px;
    border-left: 1px solid transparent;
}
.v5-div::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border);
}
.v5-div > span { position: absolute; top: 3px; height: 8px; border-radius: 2px; }
.v5-div > span.over  { background: var(--accent); }
.v5-div > span.under { background: var(--info); }
.v5-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--faint);
    margin-bottom: 10px;
}
.v5-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
.v5-cal-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}
.v5-cal-title { font-weight: 650; font-size: 14px; }
.v5-cal {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
}
.v5-dow {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--faint);
    text-align: center;
    padding-bottom: 2px;
}
.v5-day {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 56px;
    padding: 5px 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-raised);
    color: var(--text);
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    align-items: stretch;
}
button.v5-day { cursor: pointer; }
button.v5-day:hover { border-color: var(--border-hover); }
.v5-day.blank { background: transparent; border-color: transparent; min-height: 0; }
.v5-day .dnum { font-family: var(--font-mono); font-size: 10px; color: var(--faint); }
.v5-day .dnet { font-size: 11.5px; font-weight: 650; font-variant-numeric: tabular-nums; }
.v5-day .dcount { font-size: 10.5px; color: var(--muted); }
.v5-day.tight { outline: 2px dashed var(--accent); outline-offset: -3px; }
.v5-day[aria-pressed="true"] { border-color: var(--accent); }
.v5-daydetail {
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--bg-raised);
    font-size: 13px;
}
.v5-daydetail:empty { display: none; }
.v5-daydetail ul { margin: 6px 0 0; padding-left: 18px; }
.v5-daydetail li { margin-bottom: 2px; }
.v5-oplist { list-style: none; margin: 0 0 12px; padding: 0; }
.v5-oplist li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--bg-raised);
    margin-bottom: 6px;
    font-size: 13px;
}
.v5-sep {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 16px 0 14px;
}
.v5-goal { border-bottom: 1px solid var(--border); padding: 12px 0; }
.v5-goal:first-of-type { padding-top: 0; }
.v5-goal:last-of-type { border-bottom: 0; padding-bottom: 0; }
.v5-goal-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.v5-goal-name { font-weight: 650; font-size: 14px; }
@media (max-width: 700px) {
    .v5-card { padding: 14px 14px; }
    .v5-figure { font-size: 1.6rem; }
    .v5-chart { min-height: 180px; max-height: 220px; }
    .v5-day { min-height: 48px; padding: 4px; }
    .v5-day .dnet { font-size: 10.5px; }
    .v5-day .dcount { display: none; }
}
@media (hover: none) and (pointer: coarse) {
    button.v5-day { min-height: 52px; }
}
`;

function injectPanelStyles() {
    if (document.getElementById(V5_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = V5_STYLE_ID;
    style.textContent = V5_CSS;
    (document.head || document.documentElement).appendChild(style);
}

/* Local UI state — deliberately not persisted: it describes where the user is
   looking, not what they own. */
const v5ui = {
    calMonth: 0,
    calDay: null,
    debtExtra: 0,
    editScenarioId: null,
    renamingId: null,
    checkinChartId: null
};

function v5esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function v5Money(n) {
    const value = Number.isFinite(n) ? n : 0;
    return typeof fmtMoney === 'function' ? fmtMoney(value) : value.toFixed(2);
}
function v5Pct(n) {
    const value = Number.isFinite(n) ? n : 0;
    return typeof fmtPct === 'function' ? fmtPct(value) : (Math.round(value * 10) / 10).toFixed(1) + '%';
}
function v5Date(value) {
    const d = v5ToDate(value);
    if (!d) return '';
    return typeof fmtDate === 'function' ? fmtDate(d) : d.toISOString().slice(0, 10);
}
function v5Long(value) {
    const d = v5ToDate(value);
    if (!d) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function v5ToDate(value) {
    if (typeof toDate === 'function') return toDate(value);
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return d && !isNaN(d) ? d : null;
}
function v5Num(value, fallback) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : (fallback || 0);
}
function v5Round(n) { return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100; }
function v5Sum(list) { return (list || []).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0); }
function v5Clone(value) {
    try { return structuredClone(value); }
    catch (e) { return JSON.parse(JSON.stringify(value)); }
}
function v5Signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + v5Money(Math.abs(n)); }
function v5Plural(n, one, many) { return Math.abs(n) === 1 ? one : (many || one + 's'); }

// Collections introduced in v5 — read through here so a state written by an
// older build (or one whose migration has not run yet) still renders.
function v5Coll(name) {
    if (!state) return [];
    if (!Array.isArray(state[name])) state[name] = [];
    return state[name];
}
function v5Settings() {
    if (!state) return {};
    if (!state.settings) state.settings = {};
    return state.settings;
}
function v5Toast(msg, tone) {
    if (typeof flashStatus === 'function') flashStatus(msg, tone ? { tone } : {});
}
function v5Snapshot(label) {
    if (typeof snapshotForUndo === 'function') snapshotForUndo(label);
}
function v5Commit(msg) {
    if (typeof saveState === 'function') saveState();
    if (typeof renderAll === 'function') renderAll();
    if (!msg) return;
    if (typeof flashWithUndo === 'function') flashWithUndo(msg);
    else v5Toast(msg);
}
function v5Tint(color, alpha) {
    if (typeof hexToRgba === 'function') return hexToRgba(color, alpha);
    return color;
}
function v5Var(name, fallback) {
    if (typeof cssVar === 'function') return cssVar(name, fallback);
    return fallback;
}
function v5Short(value) {
    const d = v5ToDate(value);
    if (!d) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Before a write the user cannot eyeball afterwards. Undo is the better safety
// net because it is one click; a backup file is the fallback when this build has
// no undo stack at all.
function v5SafetyNet(label) {
    if (typeof snapshotForUndo === 'function') { snapshotForUndo(label); return; }
    if (typeof writeBackup === 'function') writeBackup(label);
}

function v5HasChart() {
    if (typeof hasCharting === 'function') return hasCharting();
    return typeof Chart !== 'undefined' && !!Chart;
}

// The markup owns the card chrome when it wraps a panel in one; when it hands
// over a bare container the panel supplies its own. Either way the content goes
// into a body element the panel creates, so nothing the markup wrote is lost.
function v5Shell(id, title, meta) {
    const host = document.getElementById(id);
    if (!host || !state) return null;
    host.classList.add('v5-panel');
    const card = host.classList.contains('card') ? host : host.closest('section.card');
    if (!card) host.classList.add('v5-card');
    const ownHeading = card ? card.querySelector(':scope > h2') : null;
    // A heading the markup wrote may already carry a chip for this kind of note;
    // one that app.js fills (it would have an id) is left alone.
    let chipTaken = false;
    if (ownHeading) {
        const chip = ownHeading.querySelector('.section-meta');
        if (chip && !chip.id) { chip.textContent = meta || ''; chipTaken = true; }
    }
    let body = host.querySelector(':scope > .v5-body');
    if (!body) {
        body = document.createElement('div');
        body.className = 'v5-body';
        host.appendChild(body);
    }
    let heading;
    if (!ownHeading) {
        heading = `<h2 class="v5-h">${v5esc(title)}<span class="v5-meta">${v5esc(meta || '')}</span></h2>`;
    } else if (meta && !chipTaken) {
        heading = `<div class="v5-metaline"><span class="v5-meta">${v5esc(meta)}</span></div>`;
    } else {
        heading = '';
    }
    return { host, body, heading };
}

// innerHTML replaces the controls wholesale, so anything half-typed has to be
// carried across the rebuild — including the caret.
function v5Capture(node) {
    const values = {};
    node.querySelectorAll('[data-keep]').forEach(input => {
        values[input.getAttribute('data-keep')] = input.type === 'checkbox' ? input.checked : input.value;
    });
    const active = document.activeElement;
    const snap = { values, focusKey: null, selStart: null, selEnd: null };
    if (active && node.contains(active) && active.getAttribute && active.getAttribute('data-keep')) {
        snap.focusKey = active.getAttribute('data-keep');
        try { snap.selStart = active.selectionStart; snap.selEnd = active.selectionEnd; }
        catch (e) { /* number and date inputs have no selection */ }
    }
    return snap;
}
function v5Restore(node, snap) {
    if (!snap) return;
    node.querySelectorAll('[data-keep]').forEach(input => {
        const key = input.getAttribute('data-keep');
        if (!Object.prototype.hasOwnProperty.call(snap.values, key)) return;
        if (input.type === 'checkbox') input.checked = !!snap.values[key];
        else input.value = snap.values[key];
    });
    if (!snap.focusKey) return;
    const target = v5Field(node, snap.focusKey);
    if (!target) return;
    target.focus();
    if (snap.selStart == null) return;
    try { target.setSelectionRange(snap.selStart, snap.selEnd); } catch (e) { /* unsupported type */ }
}
function v5Paint(shell, html) {
    const snap = v5Capture(shell.body);
    shell.body.innerHTML = shell.heading + html;
    v5Restore(shell.body, snap);
}
// Keys carry record ids, and an imported file can put anything in one — so the
// field is found by comparing attributes rather than by building a selector.
function v5Field(node, key) {
    if (!node) return null;
    const found = Array.from(node.querySelectorAll('[data-keep]'))
        .find(input => input.getAttribute('data-keep') === key);
    return found || null;
}
function v5Val(body, key) {
    const node = v5Field(body, key);
    return node ? node.value : '';
}
function v5SetVal(body, key, value) {
    const node = v5Field(body, key);
    if (node) node.value = value;
}
function v5Wire(shell, handlers) {
    const body = shell.body;
    body.onclick = handlers.click || null;
    body.onsubmit = handlers.submit || null;
    body.oninput = handlers.input || null;
    body.onchange = handlers.change || null;
}
function v5Act(e) {
    const node = e.target.closest ? e.target.closest('[data-v5act]') : null;
    return node ? { act: node.getAttribute('data-v5act'), id: node.getAttribute('data-id') || '', node } : null;
}

function v5Months() {
    const token = v5Settings().forecastHorizon || '12';
    return typeof resolveHorizon === 'function' ? resolveHorizon(token) : 12;
}

// The panels draw from the same forecast the rest of the deck just drew from;
// only a page that has not rendered one yet pays to build its own.
function v5Forecast() {
    if (typeof currentForecast !== 'undefined' && currentForecast) return currentForecast;
    if (typeof buildForecast !== 'function') return null;
    try { return buildForecast(v5Months()); }
    catch (e) { console.error('[Cashflow Compass] the panels could not build a forecast', e); return null; }
}

function v5AccountName(id) {
    if (!id || !state || !Array.isArray(state.accounts)) return '';
    const found = state.accounts.find(a => a.id === id);
    return found ? (found.name || '(unnamed)') : '';
}
const V5_UNAVAILABLE = 'This panel needs a forecast, and one could not be built from the data currently loaded.';

function v5EngineMissing(name) {
    return `<div class="v5-empty">This panel is drawn by <code>${v5esc(name)}</code>, which is not present in this build of the engine. Nothing else on the page is affected.</div>`;
}

/* ───── FEAT-02 · Balance check-ins ───── */

// The history plot lives on a canvas the repaint below throws away, so the
// chart it belongs to has to go with it or Chart.js keeps redrawing into a node
// that is no longer in the document.
let v5CheckinChart = null;

function v5DropCheckinChart() {
    if (!v5CheckinChart) return;
    try { v5CheckinChart.destroy(); }
    catch (e) { /* the canvas is already gone; nothing left to release */ }
    v5CheckinChart = null;
}

function renderCheckinPanel(forecast) {
    const checkins = v5Coll('checkins');
    const shell = v5Shell('panelCheckin', 'Balance check-ins',
        checkins.length ? `${checkins.length} logged` : '');
    if (!shell) return;

    const accounts = Array.isArray(state.accounts) ? state.accounts : [];
    const drift = v5Drift(forecast, checkins);
    const history = v5CheckinHistory(forecast, checkins);
    v5DropCheckinChart();
    const html = [
        v5DriftHero(drift, checkins),
        history.html,
        v5CheckinForm(accounts),
        v5CheckinList(checkins, accounts)
    ].join('');
    v5Paint(shell, html);
    v5Wire(shell, {
        submit: e => {
            if (!e.target.matches('[data-v5form="checkin"]')) return;
            e.preventDefault();
            v5AddCheckin(shell.body);
        },
        click: e => {
            const hit = v5Act(e);
            if (!hit) return;
            if (hit.act === 'checkin-del') v5DeleteCheckin(hit.id);
            else if (hit.act === 'checkin-anchor') v5ReAnchor(hit.id);
        },
        change: e => {
            if (!e.target.matches('[data-v5act="checkin-chart"]')) return;
            v5ui.checkinChartId = e.target.value;
            renderCheckinPanel(v5Forecast());
        }
    });
    if (history.series) v5DrawCheckinChart(history.series);
}

function v5Drift(forecast, checkins) {
    if (typeof checkinDrift !== 'function') return { missing: true };
    if (!forecast || !checkins.length) return null;
    try {
        const result = checkinDrift(forecast, checkins);
        return result || null;
    } catch (e) {
        console.error('[Cashflow Compass] checkinDrift could not be read', e);
        return null;
    }
}

// The gap is the number this panel exists for, so it is the one set large.
function v5DriftHero(drift, checkins) {
    if (drift && drift.missing) {
        return v5EngineMissing('checkinDrift()') +
            '<p class="v5-note">Check-ins are still recorded below, and the comparison appears as soon as the engine provides it.</p>';
    }
    if (!drift) {
        if (!checkins.length) {
            return '<div class="v5-empty"><strong>What is your checking balance right now?</strong> ' +
                'Log it below and the deck starts telling you how far the forecast has drifted from your real balance — ' +
                'the one number that says whether the plan still describes your life.</div>';
        }
        return '<div class="v5-empty">There is a check-in on file, but no forecast to compare it against yet. ' +
            'Add an account with a starting balance and the gap appears here.</div>';
    }

    const expected = v5Num(drift.expected, 0);
    const actual = v5Num(drift.actual, 0);
    const gap = Number.isFinite(drift.drift) ? drift.drift : actual - expected;
    const pct = Number.isFinite(drift.driftPct) ? drift.driftPct
        : (Math.abs(expected) > 0.005 ? (gap / Math.abs(expected)) * 100 : null);
    const size = v5DriftBand(gap, pct);
    const when = v5Long(drift.latest);

    const sentence = Math.abs(gap) < 0.005
        ? 'The forecast landed exactly on your real balance.'
        : (gap > 0
            ? 'You are better off than the forecast expected.'
            : 'You are worse off than the forecast expected.');

    const byAccount = Array.isArray(drift.byAccount) ? drift.byAccount : [];
    const perAccount = byAccount.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Account</th><th>Checked on</th><th class="num">Forecast said</th><th class="num">You had</th><th class="num">Gap</th><th class="num">Actions</th></tr></thead>
            <tbody>${byAccount.map(row => {
                const rowGap = Number.isFinite(row.drift) ? row.drift : v5Num(row.actual, 0) - v5Num(row.expected, 0);
                const name = row.name || v5AccountName(row.accountId) || 'Account';
                return `<tr>
                    <td>${v5esc(name)}${row.credit ? ' <span class="tag">credit</span>' : ''}</td>
                    <td>${v5esc(v5Long(row.date))}</td>
                    <td class="num">${v5esc(v5Money(v5Num(row.expected, 0)))}</td>
                    <td class="num">${v5esc(v5Money(v5Num(row.actual, 0)))}</td>
                    <td class="num ${rowGap < 0 ? 'v5-neg' : rowGap > 0 ? 'v5-pos' : ''}">${v5esc(v5Signed(rowGap))}</td>
                    <td class="num row-actions">${v5AnchorButton(row, checkins, name)}</td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>` : '';
    const creditNote = byAccount.some(row => row.credit)
        ? '<p class="v5-note">The headline gap is read in net-worth terms, so a card balance counts against the pile rather than adding to it.</p>'
        : '';

    return `<div class="v5-hero ${size.tone}">
            <div>
                <div class="v5-label">Drift${when ? ' as of ' + v5esc(when) : ''}</div>
                <div class="v5-figure ${size.text}">${v5esc(v5Signed(gap))}</div>
                <div class="v5-sub">${v5esc(sentence)}${pct != null && Number.isFinite(pct) ? ' · ' + v5esc(v5Pct(pct)) + ' of the projection' : ''}</div>
            </div>
            <div class="v5-stat">
                <div class="v5-label">Forecast said</div>
                <div class="v5-val">${v5esc(v5Money(expected))}</div>
            </div>
            <div class="v5-stat">
                <div class="v5-label">You actually had</div>
                <div class="v5-val">${v5esc(v5Money(actual))}</div>
            </div>
            <div class="v5-stat">
                <div class="v5-label">Accounts compared</div>
                <div class="v5-val">${byAccount.length}</div>
            </div>
        </div>
        <p class="v5-note">${v5esc(size.advice)}</p>
        ${perAccount}${creditNote}`;
}

// Bands are on the percentage where there is one to take, because a $200 gap
// means something very different on $500 than on $50,000.
function v5DriftBand(gap, pct) {
    const abs = Math.abs(gap);
    const absPct = Number.isFinite(pct) ? Math.abs(pct) : null;
    const close = absPct != null ? absPct < 2 : abs < 50;
    const near = absPct != null ? absPct < 10 : abs < 250;
    if (close) {
        return { tone: 'pos', text: 'v5-pos', advice: 'The plan is tracking reality closely — nothing here needs attention.' };
    }
    if (near) {
        return { tone: 'warn', text: 'v5-warnc', advice: 'A gap this size is normal drift. Re-anchor an account when you want the forecast to start again from today’s truth.' };
    }
    return { tone: 'neg', text: 'v5-neg', advice: 'The forecast and your real balance have parted company. Re-anchor the account to the balance you actually have, then look for anything real that the plan does not know about.' };
}

// The re-anchor is offered against a check-in that is still on file, so the
// figures in the confirm can be read off the record rather than off the table.
function v5AnchorButton(row, checkins, name) {
    const accountId = row && row.accountId;
    if (!accountId) return '<span class="muted-text">—</span>';
    const onFile = (Array.isArray(state.accounts) ? state.accounts : []).some(a => a.id === accountId);
    if (!onFile) return '<span class="muted-text">not on file</span>';
    const id = row.checkinId && checkins.some(c => c.id === row.checkinId)
        ? row.checkinId
        : v5LatestCheckinId(accountId, checkins);
    if (!id) return '<span class="muted-text">—</span>';
    return `<button type="button" data-v5act="checkin-anchor" data-id="${v5esc(id)}"
        aria-label="Re-anchor ${v5esc(name)} to the balance recorded on ${v5esc(v5Long(row.date) || 'this check-in')}"
        title="Start the forecast again from this recorded balance">Re-anchor</button>`;
}

function v5LatestCheckinId(accountId, checkins) {
    const list = (checkins || v5Coll('checkins')).filter(c => c && c.accountId === accountId && c.id);
    if (!list.length) return '';
    const newest = list.reduce((best, c) =>
        String(c.date || '') > String(best.date || '') ? c : best, list[0]);
    return newest.id || '';
}

// Every projection on the deck is built on the starting balance, so this is the
// most consequential write in the file — hence the confirm that spells out both
// numbers before either moves.
function v5ReAnchor(checkinId) {
    const checkin = v5Coll('checkins').find(c => c.id === checkinId);
    if (!checkin) return;
    const account = (Array.isArray(state.accounts) ? state.accounts : []).find(a => a.id === checkin.accountId);
    if (!account) {
        v5Toast('That check-in belongs to an account that is no longer on file.', 'warning');
        return;
    }
    // A card's starting balance is held as the amount owed, so the sign the
    // check-in was typed with must not survive into the account.
    const credit = account.type === 'credit';
    const balance = v5Num(checkin.balance, 0);
    const nextBalance = v5Round(credit ? Math.abs(balance) : balance);
    const nextDate = checkin.date || v5Date(new Date());
    const fromBalance = v5Num(account.startingBalance, 0);
    const fromDate = account.asOfDate || '';

    if (Math.abs(nextBalance - fromBalance) < 0.005 && fromDate === nextDate) {
        v5Toast('The forecast already starts from this check-in.', 'info');
        return;
    }

    const name = account.name || 'This account';
    const body = `${name} currently starts the forecast at ${v5Money(fromBalance)}` +
        (fromDate ? ` as of ${v5Long(fromDate)}` : ' with no as-of date') +
        `. Re-anchoring rewrites that to ${v5Money(nextBalance)}${credit ? ' owed' : ''} as of ${v5Long(nextDate)}. ` +
        'Every projection on the deck is built on that number, so the whole forecast moves with it. This can be undone.';
    const apply = () => {
        v5SafetyNet('re-anchoring ' + name);
        account.startingBalance = nextBalance;
        account.asOfDate = nextDate;
        v5Commit(`Re-anchored ${name} to ${v5Money(nextBalance)}.`);
    };
    if (typeof confirmModal === 'function') {
        confirmModal('Re-anchor this account?', body, apply, { confirmLabel: 'Re-anchor' });
    } else {
        apply();
    }
}

/* ───── Check-in history ───── */

function v5AccountEntry(forecast, accountId) {
    if (!forecast || !accountId) return null;
    const list = Array.isArray(forecast.accountsList) ? forecast.accountsList : [];
    const found = list.find(a => a && a.id === accountId);
    if (found) return found;
    return (forecast.unassigned && forecast.unassigned.id === accountId) ? forecast.unassigned : null;
}

// The engine walks an account from its own snapshot to a date; the same walk is
// written out here so the history still draws in a build that does not export it.
function v5ProjectAt(entry, when) {
    if (!entry) return 0;
    if (typeof projectedAccountBalance === 'function') {
        try {
            const value = projectedAccountBalance(entry, when);
            if (Number.isFinite(value)) return value;
        } catch (e) { /* fall through to the local walk */ }
    }
    let balance = Number.isFinite(entry.startRaw) ? entry.startRaw : v5Num(entry.start, 0);
    const key = v5Date(when);
    (entry.dayNet || []).forEach(step => { if (step && step.key <= key) balance += v5Num(step.delta, 0); });
    return balance;
}

function v5CheckinReadings(checkins, accountId) {
    return checkins
        .filter(c => c && c.accountId === accountId && v5ToDate(c.date) && Number.isFinite(parseFloat(c.balance)))
        .map(c => ({ date: v5ToDate(c.date), actual: parseFloat(c.balance) }))
        .sort((a, b) => a.date - b.date);
}

// A projection only runs forward. A reading taken before the balance the
// forecast starts from cannot be projected to, so comparing the two would invent
// a gap out of the order the numbers were entered in.
function v5CheckinBaseline(forecast, accountId) {
    // Each account is anchored by its own snapshot, so the baseline is that
    // account's own scan date. Reaching for the newest date on file would
    // overshoot every account whose snapshot is older than the newest one, and
    // invent a gap for the account that has drifted longest.
    const entry = forecast && forecast.byAccount ? forecast.byAccount[accountId] : null;
    const own = entry ? v5ToDate(entry.cutoffDate) : null;
    if (own) return own;

    const account = (Array.isArray(state.accounts) ? state.accounts : []).find(a => a.id === accountId);
    const stated = account ? v5ToDate(account.asOfDate) : null;
    const scanned = v5ToDate(forecast.cutoffDate);
    if (stated && scanned) return stated > scanned ? stated : scanned;
    return stated || scanned || null;
}

// One reading is a snapshot of the gap; two are the first thing that can answer
// whether the plan is getting closer to your life or further from it.
function v5CheckinHistory(forecast, checkins) {
    const nothing = { html: '', series: null };
    if (!forecast || !checkins.length) return nothing;

    const ids = [];
    checkins.forEach(c => {
        if (!c || !c.accountId || ids.indexOf(c.accountId) > -1) return;
        if (v5AccountEntry(forecast, c.accountId)) ids.push(c.accountId);
    });
    if (!ids.length) return nothing;

    const groups = {};
    ids.forEach(id => {
        const readings = v5CheckinReadings(checkins, id);
        const baseline = v5CheckinBaseline(forecast, id);
        const comparable = baseline ? readings.filter(r => r.date >= baseline) : readings;
        groups[id] = { comparable, dropped: readings.length - comparable.length };
    });

    const rank = (a, b) => groups[b].comparable.length - groups[a].comparable.length;
    const heading = '<hr class="v5-sep"><div class="v5-label">Forecast vs reality over time</div>';
    const eligible = ids.filter(id => groups[id].comparable.length >= 2);
    if (!eligible.length) {
        const best = ids.slice().sort(rank)[0];
        return { html: heading + v5HistoryWaiting(best, groups[best]), series: null };
    }

    let chosen = v5ui.checkinChartId;
    if (!chosen || eligible.indexOf(chosen) < 0) {
        chosen = eligible.slice().sort(rank)[0];
        v5ui.checkinChartId = chosen;
    }

    const entry = v5AccountEntry(forecast, chosen);
    const series = groups[chosen].comparable
        .map(point => ({ date: point.date, actual: point.actual, expected: v5ProjectAt(entry, point.date) }));
    const name = v5AccountName(chosen) || (entry && entry.name) || 'this account';
    const chooser = eligible.length > 1
        ? `<div class="v5-row">
                <div class="v5-field grow">
                    <label class="v5-label" for="v5CheckinChartAcct">Account plotted</label>
                    <select id="v5CheckinChartAcct" data-keep="checkinChartAcct" data-v5act="checkin-chart">
                        ${eligible.map(id => `<option value="${v5esc(id)}"${id === chosen ? ' selected' : ''}>${v5esc(v5AccountName(id) || 'Account')} — ${groups[id].comparable.length} readings</option>`).join('')}
                    </select>
                </div>
            </div>`
        : '';

    const label = `Line chart of what the forecast projected for ${name} against the balance you recorded, ` +
        `at each of ${series.length} check-ins from ${v5Long(series[0].date)} to ${v5Long(series[series.length - 1].date)}.`;
    const canvas = v5HasChart()
        ? `<canvas class="v5-chart" id="v5CheckinChart" role="img" aria-label="${v5esc(label)}"></canvas>`
        : '<div class="v5-empty">This plot needs <code>vendor/chart.umd.min.js</code>, which did not load. The readings themselves are listed below.</div>';

    return {
        html: heading + chooser + canvas +
            `<p class="v5-note">${v5esc(v5TrendSentence(series, name))}</p>` +
            v5DroppedNote(groups[chosen].dropped) +
            '<p class="v5-note">Each forecast point walks this account forward from the balance the forecast starts at, so re-anchoring moves the projected line and the comparison begins again from that day.</p>',
        series: v5HasChart() ? series : null
    };
}

function v5HistoryWaiting(accountId, group) {
    const name = v5esc(v5AccountName(accountId) || 'this account');
    if (!group.comparable.length) {
        return `<div class="v5-empty">Every reading on <strong>${name}</strong> was taken before the balance the forecast now starts from, ` +
            'so there is nothing left to compare them against. Log a new one and the plot of forecast against reality begins from there.</div>';
    }
    return `<div class="v5-empty">There is one reading on <strong>${name}</strong> since the forecast’s starting balance was stated, ` +
        'and it says how far off the forecast is today. A second says which way that is moving: log another in a week or two and this becomes ' +
        'a plot of what the forecast projected against what you actually had, oldest to newest.</div>';
}

function v5DroppedNote(dropped) {
    if (!dropped) return '';
    const one = dropped === 1;
    return `<p class="v5-note">${v5esc(`${dropped} earlier ${v5Plural(dropped, 'reading')} ${one ? 'is' : 'are'} not plotted: ` +
        `${one ? 'it was' : 'they were'} taken before the balance the forecast starts from, so there is nothing to project ${one ? 'it' : 'them'} against.`)}</p>`;
}

function v5TrendSentence(series, name) {
    const first = Math.abs(series[0].actual - series[0].expected);
    const last = Math.abs(series[series.length - 1].actual - series[series.length - 1].expected);
    const readings = `${series.length} readings on ${name}`;
    if (last < first - 0.005) {
        return `The gap has narrowed from ${v5Money(first)} to ${v5Money(last)} across ${readings} — the plan is describing this account more closely than it did.`;
    }
    if (last > first + 0.005) {
        return `The gap has widened from ${v5Money(first)} to ${v5Money(last)} across ${readings} — something real is happening that the plan does not know about.`;
    }
    return `The gap has held at about ${v5Money(last)} across ${readings}.`;
}

function v5DrawCheckinChart(series) {
    const canvas = document.getElementById('v5CheckinChart');
    if (!canvas || !v5HasChart()) return;
    if (typeof deckChartTheme === 'function') {
        try { deckChartTheme(); }
        catch (e) { /* the deck's chart defaults are a nicety, not a requirement */ }
    }
    const projected = v5Var('--accent', '#ff9a44');
    const recorded = v5Var('--live', '#3ddc84');
    try {
        v5CheckinChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: series.map(p => v5Short(p.date)),
                datasets: [
                    {
                        label: 'Forecast said',
                        data: series.map(p => v5Round(p.expected)),
                        borderColor: projected,
                        backgroundColor: v5Tint(projected, 0.12),
                        borderDash: [5, 4],
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.25
                    },
                    {
                        label: 'You had',
                        data: series.map(p => v5Round(p.actual)),
                        borderColor: recorded,
                        backgroundColor: v5Tint(recorded, 0.12),
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.25
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${v5Money(ctx.parsed.y)}` } }
                },
                scales: {
                    y: { ticks: { callback: value => v5Money(value) } }
                }
            }
        });
    } catch (e) {
        console.error('[Cashflow Compass] the check-in history could not be drawn', e);
    }
}

function v5CheckinForm(accounts) {
    const today = v5Date(new Date());
    if (!accounts.length) {
        return '<div class="v5-empty">Add an account first — a check-in records the balance of a particular account on a particular day.</div>';
    }
    const options = accounts.map(a =>
        `<option value="${v5esc(a.id)}">${v5esc(a.name || '(unnamed)')}</option>`).join('');
    return `<form data-v5form="checkin" novalidate>
            <div class="v5-row">
                <div class="v5-field grow">
                    <label class="v5-label" for="v5CheckinAcct">Account</label>
                    <select id="v5CheckinAcct" data-keep="checkinAcct">${options}</select>
                </div>
                <div class="v5-field">
                    <label class="v5-label" for="v5CheckinBalance">Balance right now</label>
                    <input type="number" id="v5CheckinBalance" data-keep="checkinBalance" step="0.01" inputmode="decimal" placeholder="0.00">
                </div>
                <div class="v5-field">
                    <label class="v5-label" for="v5CheckinDate">As of</label>
                    <input type="date" id="v5CheckinDate" data-keep="checkinDate" value="${v5esc(today)}">
                </div>
                <div class="v5-actions">
                    <button type="submit" class="primary">Log check-in</button>
                </div>
            </div>
        </form>`;
}

function v5CheckinList(checkins, accounts) {
    if (!checkins.length) return '';
    const rows = checkins.slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 8)
        .map(c => {
            const name = v5AccountName(c.accountId);
            const when = v5Long(c.date) || c.date || '';
            const anchor = name
                ? `<button type="button" data-v5act="checkin-anchor" data-id="${v5esc(c.id)}"
                    aria-label="Re-anchor ${v5esc(name)} to the balance recorded on ${v5esc(when || 'this date')}"
                    title="Start the forecast again from this recorded balance">Re-anchor</button>`
                : '';
            return `<tr>
            <td>${v5esc(when)}</td>
            <td>${v5esc(name || 'Account no longer on file')}</td>
            <td class="num">${v5esc(v5Money(v5Num(c.balance, 0)))}</td>
            <td class="num row-actions">
                ${anchor}
                <button type="button" class="icon" data-v5act="checkin-del" data-id="${v5esc(c.id)}"
                    aria-label="Delete the check-in from ${v5esc(when || 'this date')}" title="Delete">✕</button>
            </td>
        </tr>`;
        }).join('');
    const more = checkins.length > 8 ? `<p class="v5-note">Showing the 8 most recent of ${checkins.length}.</p>` : '';
    return `<hr class="v5-sep"><div class="v5-label">Recent check-ins</div>
        <div class="table-wrap"><table>
            <thead><tr><th>Date</th><th>Account</th><th class="num">Balance</th><th class="num">Actions</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>${more}
        <p class="v5-note">Re-anchoring rewrites the account’s starting balance and as-of date to the reading you pick, so the forecast begins again from what you actually had.</p>`;
}

function v5AddCheckin(body) {
    const accountId = v5Val(body, 'checkinAcct');
    const raw = v5Val(body, 'checkinBalance');
    const date = v5Val(body, 'checkinDate') || v5Date(new Date());
    if (!accountId) { v5Toast('Choose which account this balance belongs to.', 'warning'); return; }
    if (raw === '' || !Number.isFinite(parseFloat(raw))) {
        v5Toast('Enter the balance as a number.', 'warning');
        return;
    }
    v5Snapshot('logging a check-in');
    v5Coll('checkins').push({
        id: typeof uid === 'function' ? uid('chk') : 'chk_' + Date.now(),
        date,
        accountId,
        balance: v5Round(parseFloat(raw))
    });
    v5SetVal(body, 'checkinBalance', '');
    v5Commit('Logged the check-in.');
}

function v5DeleteCheckin(id) {
    const list = v5Coll('checkins');
    if (!list.some(c => c.id === id)) return;
    v5Snapshot('deleting a check-in');
    state.checkins = list.filter(c => c.id !== id);
    v5Commit('Deleted the check-in.');
}

/* ───── FEAT-01-UI · Per-account balances ───── */

// The engine states on each credit entry whether it applied the minimum payment
// itself. A build that states nothing is read as applying nothing, so the panel
// stays silent rather than claiming a payment that is not being made.
function v5AutoMinApplied(entry) {
    return !!(entry && entry.credit && entry.autoMinPayment);
}

function renderAccountsPanel(forecast) {
    const tracked = forecast && Array.isArray(forecast.accountsList) ? forecast.accountsList.length : 0;
    const shell = v5Shell('panelAccounts', 'Per-account balances',
        tracked ? `${tracked} ${v5Plural(tracked, 'account')} · ${forecast.monthList.length} mo` : '');
    if (!shell) return;
    if (!forecast) { v5Paint(shell, `<div class="v5-empty">${v5esc(V5_UNAVAILABLE)}</div>`); return; }

    const list = Array.isArray(forecast.accountsList) ? forecast.accountsList.slice() : [];
    const spare = forecast.unassigned;
    if (spare && (Math.abs(v5Num(spare.start, 0)) > 0.005 || v5Sum(spare.monthly) !== 0)) list.push(spare);

    if (!list.length) {
        v5Paint(shell, '<div class="v5-empty"><strong>No accounts yet.</strong> Add one and this becomes a line per account — ' +
            'where each balance stands today, where it lands at the end of the horizon, and which of them dips below zero on the way.</div>');
        return;
    }

    const last = forecast.monthList.length - 1;
    // Each account counts forward from its own snapshot, so a single date only
    // describes the table while every account agrees. When they diverge, the
    // row has to carry its own date or every figure but the newest is misdated.
    const anchors = list.map(a => v5Long(a.cutoffDate)).filter(Boolean);
    const sharedAnchor = anchors.length && anchors.every(d => d === anchors[0]) ? anchors[0] : null;

    const rows = list.map(a => {
        const end = v5Num(a.running ? a.running[last] : a.start, v5Num(a.start, 0));
        const start = v5Num(a.start, 0);
        const lowest = a.lowest || {};
        const lowestBalance = v5Num(lowest.balance, 0);
        const dips = !a.credit && (lowestBalance < 0 || end < 0);
        const move = end - start;
        const flag = a.credit
            ? (move < -0.005
                ? '<span class="v5-chip pos">paying down</span>'
                : move > 0.005 ? '<span class="v5-chip warn">growing</span>' : '')
            : (dips ? '<span class="v5-chip neg">goes negative</span>' : '');
        const autoMin = v5AutoMinApplied(a);
        const autoChip = autoMin ? '<span class="v5-chip info">minimum applied</span>' : '';
        const paysOut = v5Num(a.autoMinPaymentOut, 0);
        const bits = [];
        if (a.credit && v5Num(a.apr, 0) > 0) bits.push(v5Pct(v5Num(a.apr, 0)) + ' APR');
        if (a.credit && v5Num(a.minPayment, 0) > 0.005) bits.push('min ' + v5Money(v5Num(a.minPayment, 0)) + '/mo');
        if (!a.credit && paysOut > 0.005) bits.push('pays ' + v5Money(paysOut) + ' of card minimums');
        const trailing = bits.length ? `<span class="muted-text">${v5esc(bits.join(' · '))}</span>` : '';
        return `<tr>
            <td>${v5esc(a.name || '(unnamed)')} ${flag} ${autoChip}</td>
            <td><span class="tag">${v5esc(a.type || 'checking')}</span> ${trailing}</td>
            <td class="num">${v5esc(v5Money(start))}${a.credit ? ' <span class="muted-text">owed</span>' : ''}${
                sharedAnchor || !v5Long(a.cutoffDate)
                    ? ''
                    : `<span class="muted-text">${v5esc('as of ' + v5Long(a.cutoffDate) + (a.cutoffStated ? '' : ' (assumed)'))}</span>`
            }</td>
            <td class="num ${!a.credit && end < 0 ? 'v5-neg' : ''}">${v5esc(v5Money(end))}</td>
            <td class="num ${a.credit ? '' : (lowestBalance < 0 ? 'v5-neg' : '')}">${a.credit ? '<span class="muted-text">n/a</span>' : v5esc(v5Money(lowestBalance))}
                ${a.credit ? '' : `<span class="muted-text">${v5esc(v5Long(lowest.date))}</span>`}</td>
            <td class="num ${v5Num(a.daysInRed, 0) > 0 ? 'v5-neg' : ''}">${a.credit ? '<span class="muted-text">n/a</span>' : v5esc(String(v5Num(a.daysInRed, 0)))}</td>
        </tr>`;
    }).join('');

    const negatives = list.filter(a => !a.credit && (v5Num(a.lowest && a.lowest.balance, 0) < 0 || v5Num(a.running ? a.running[last] : 0, 0) < 0));
    const note = negatives.length
        ? `<p class="v5-note v5-neg">${v5esc(negatives.length + ' ' + v5Plural(negatives.length, 'account') + ' ' + (negatives.length === 1 ? 'dips' : 'dip') + ' below zero inside the horizon: ' + negatives.map(a => a.name).join(', ') + '.')}</p>`
        : '<p class="v5-note">No account dips below zero inside the horizon.</p>';

    // A payment nobody entered has to be accounted for, or the balance falls for
    // reasons the user cannot find anywhere in their own plan.
    const auto = list.filter(a => v5AutoMinApplied(a));
    const autoNote = auto.length
        ? `<p class="v5-note">${v5esc(auto.map(a => {
                const from = v5AccountName(a.autoMinPaymentFrom);
                const total = v5Num(a.autoMinPaymentTotal, 0);
                return `${a.name || '(unnamed)'} has a minimum payment of ${v5Money(v5Num(a.minPayment, 0))} on file and nothing in the plan paying it, ` +
                    `so the forecast applies it every month — ${v5Money(total)} across the horizon` +
                    (from ? `, drawn from ${from}` : '') + '.';
            }).join(' ') + ' Enter a transfer that pays the card and the plan takes over instead.')}</p>`
        : '';

    // Each account counts forward from its own snapshot, so a single date only
    // describes the table while every account agrees. When they diverge, saying
    // "the newest date on file" would misdate every row that is not the newest.
    const asOf = sharedAnchor || v5Long(forecast.cutoffDate);
    const asOfSentence = sharedAnchor || anchors.length < 2
        ? '"Now" is each balance as stated at the as-of date on file' + (asOf ? ' (' + asOf + ')' : '') + '.'
        : '"Now" is each balance as stated at that account’s own as-of date, shown beside it, since your accounts were last reconciled on different days.';
    v5Paint(shell, `${note}
        <div class="table-wrap"><table>
            <thead><tr>
                <th>Account</th><th>Type</th>
                <th class="num">Now</th><th class="num">End of horizon</th>
                <th class="num">Lowest point</th><th class="num">Days in red</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>${autoNote}
        <p class="v5-note">${v5esc(asOfSentence + ' Credit rows show the amount owed, so a falling number is the debt shrinking.')}</p>`);
}

/* ───── FEAT-04 · Plan vs actual ───── */

function renderVariancePanel(forecast) {
    const actuals = v5Coll('actuals');
    const shell = v5Shell('panelVariance', 'Plan vs actual', actuals.length ? `${actuals.length} actuals` : '');
    if (!shell) return;

    if (typeof computeVariance !== 'function') { v5Paint(shell, v5EngineMissing('computeVariance()')); return; }
    if (!forecast) { v5Paint(shell, `<div class="v5-empty">${v5esc(V5_UNAVAILABLE)}</div>`); return; }
    if (!actuals.length) {
        v5Paint(shell, '<div class="v5-empty"><strong>Nothing to compare yet.</strong> ' +
            'Import a statement you downloaded from your own bank — CSV, OFX/QFX or QIF — and this panel fills in: ' +
            'what each category was planned at, what it actually came to, and how many months of evidence sit behind that. ' +
            'Where the two disagree consistently, it offers to move the plan to match.</div>' +
            '<p class="v5-note">Importing a file you downloaded yourself is the only way actuals ever enter this app. Nothing connects to a bank.</p>');
        return;
    }

    let variance = null;
    try { variance = computeVariance(forecast, actuals); }
    catch (e) { console.error('[Cashflow Compass] computeVariance failed', e); }
    if (!variance) {
        v5Paint(shell, '<div class="v5-empty">The comparison could not be built from the actuals on file.</div>');
        return;
    }

    const totals = variance.totals || {};
    const byCategory = Array.isArray(variance.byCategory) ? variance.byCategory : [];
    const suggestions = Array.isArray(variance.suggestions) ? variance.suggestions : [];
    const maxAbs = byCategory.reduce((m, r) => Math.max(m, Math.abs(v5Num(r.delta, 0))), 0);

    const rows = byCategory.map(row => {
        const delta = v5Num(row.delta, 0);
        const width = maxAbs > 0 ? Math.min(50, (Math.abs(delta) / maxAbs) * 50) : 0;
        const bar = Math.abs(delta) < 0.005 ? '' : (delta > 0
            ? `<span class="over" style="left:50%;width:${width.toFixed(2)}%"></span>`
            : `<span class="under" style="right:50%;width:${width.toFixed(2)}%"></span>`);
        const months = v5Num(row.months, 0);
        const where = Math.abs(delta) < 0.005 ? 'exactly on plan'
            : (delta > 0 ? v5Money(Math.abs(delta)) + ' over plan' : v5Money(Math.abs(delta)) + ' under plan');
        return `<tr>
            <td>${v5esc(row.name || 'Uncategorised')}</td>
            <td class="num">${v5esc(v5Money(v5Num(row.planned, 0)))}</td>
            <td class="num">${v5esc(v5Money(v5Num(row.actual, 0)))}</td>
            <td class="num">${v5esc(v5Signed(delta))}</td>
            <td style="min-width:140px;"><div class="v5-div" role="img"
                aria-label="${v5esc(where)}">${bar}</div></td>
            <td class="num"><span class="muted-text">${v5esc(months ? months + ' ' + v5Plural(months, 'month') : '—')}</span></td>
        </tr>`;
    }).join('');

    const byMonth = Array.isArray(variance.byMonth) ? variance.byMonth : [];
    const monthRows = byMonth.length ? `<hr class="v5-sep"><div class="v5-label">Month by month</div>
        <div class="table-wrap"><table>
            <thead><tr><th>Month</th><th class="num">Planned</th><th class="num">Actual</th><th class="num">Difference</th></tr></thead>
            <tbody>${byMonth.map(m => `<tr>
                <td>${v5esc(m.label || m.key || '')}</td>
                <td class="num">${v5esc(v5Money(v5Num(m.planned, 0)))}</td>
                <td class="num">${v5esc(v5Money(v5Num(m.actual, 0)))}</td>
                <td class="num">${v5esc(v5Signed(v5Num(m.delta, 0)))}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : '';

    const header = `<div class="v5-hero mag">
            <div>
                <div class="v5-label">Planned across the compared months</div>
                <div class="v5-figure">${v5esc(v5Money(v5Num(totals.planned, 0)))}</div>
            </div>
            <div class="v5-stat">
                <div class="v5-label">Actually happened</div>
                <div class="v5-val">${v5esc(v5Money(v5Num(totals.actual, 0)))}</div>
            </div>
            <div class="v5-stat">
                <div class="v5-label">Difference</div>
                <div class="v5-val">${v5esc(v5Signed(v5Num(totals.delta, 0)))}</div>
            </div>
        </div>
        <div class="v5-legend">
            <span><i style="background:var(--info);"></i>left of centre — came in under plan</span>
            <span><i style="background:var(--accent);"></i>right of centre — ran over plan</span>
        </div>`;

    const table = byCategory.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Category</th><th class="num">Planned</th><th class="num">Actual</th><th class="num">Difference</th><th>Against plan</th><th class="num">Evidence</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`
        : '<div class="v5-empty">Plan vs actual compares whole months only — a month still running would read as an underspend that has not happened yet. ' +
          'As soon as a full month of actuals has closed, its categories appear here.</div>';

    v5Paint(shell, header + table + v5Recalibration(suggestions) + monthRows);
    v5Wire(shell, {
        click: e => {
            const hit = v5Act(e);
            if (!hit || hit.act !== 'recal') return;
            v5Recalibrate(hit.id, suggestions);
        }
    });
}

// Recalibration, not judgement: the plan is a guess that the evidence is now
// in a position to improve.
function v5Recalibration(suggestions) {
    if (!suggestions.length) {
        return '<hr class="v5-sep"><p class="v5-note">Nothing in the actuals disagrees with the plan often enough to be worth changing yet.</p>';
    }
    const cards = suggestions.map(s => {
        const planned = Math.abs(v5Num(s.plannedMonthly, 0));
        const actual = Math.abs(v5Num(s.actualMonthly, 0));
        const months = v5Num(s.months, 0);
        const confidence = v5Confidence(s.confidence);
        const targets = v5PlanTargets(s.categoryId);
        const sentence = `${s.name || 'This category'} has run ${v5Money(actual)}/mo against a ${v5Money(planned)} plan` +
            (months ? ` across ${months} ${v5Plural(months, 'month')}` : '') + '.';
        const can = targets.length > 0 && (planned > 0.005 || (targets.length === 1 && actual > 0));
        const action = can
            ? `<button type="button" class="primary" data-v5act="recal" data-id="${v5esc(s.categoryId || '')}">Update the plan</button>`
            : '<span class="muted-text">No planned item in this category to move.</span>';
        return `<div class="v5-tile">
            <h4>${v5esc(s.name || 'Category')}${confidence ? `<span class="v5-chip">${v5esc(confidence)}</span>` : ''}</h4>
            <p class="v5-note tight">${v5esc(sentence)}</p>
            <p class="v5-note tight">${v5esc(can
                ? 'Moving the plan to ' + v5Money(actual) + '/mo makes the forecast describe what actually happens.'
                : 'Add a transaction in this category and the plan can be moved to match.')}</p>
            <div class="v5-actions">${action}</div>
        </div>`;
    }).join('');
    return `<hr class="v5-sep"><div class="v5-label">Recalibration</div>
        <p class="v5-note">A plan that disagrees with the evidence is a plan worth updating — the numbers below come from what really happened.</p>
        <div class="v5-split">${cards}</div>`;
}

// The engine states confidence as a word; a build that states it as a fraction
// is read the same way rather than printed raw.
function v5Confidence(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'string') {
        const key = value.toLowerCase();
        if (key === 'high') return 'strong evidence';
        if (key === 'medium') return 'fair evidence';
        if (key === 'low') return 'early days';
        return value;
    }
    if (!Number.isFinite(value)) return '';
    if (value >= 0.75) return 'strong evidence';
    if (value >= 0.4) return 'fair evidence';
    return 'early days';
}

function v5PlanTargets(categoryId) {
    if (!categoryId || !state || !Array.isArray(state.transactions)) return [];
    return state.transactions.filter(t => t.categoryId === categoryId && !t.paused);
}

function v5Recalibrate(categoryId, suggestions) {
    const suggestion = suggestions.find(s => s.categoryId === categoryId);
    if (!suggestion) return;
    const targets = v5PlanTargets(categoryId);
    if (!targets.length) return;
    const planned = Math.abs(v5Num(suggestion.plannedMonthly, 0));
    const actual = Math.abs(v5Num(suggestion.actualMonthly, 0));
    const ratio = planned > 0.005 ? actual / planned : null;

    const changes = targets.map(t => {
        const amount = Math.abs(v5Num(t.amount, 0));
        const next = ratio != null ? v5Round(amount * ratio) : v5Round(actual);
        return { tx: t, from: amount, to: next };
    }).filter(c => Number.isFinite(c.to) && Math.abs(c.to - c.from) > 0.005);

    if (!changes.length) {
        v5Toast('The plan already matches what the actuals show.', 'info');
        return;
    }
    const lines = changes.map(c => `${c.tx.name || 'Item'}: ${v5Money(c.from)} → ${v5Money(c.to)}`).join('\n');
    const body = `${suggestion.name || 'This category'} has been running at ${v5Money(actual)}/mo against ${v5Money(planned)}/mo planned. ` +
        `This rewrites the amount on ${changes.length} planned ${v5Plural(changes.length, 'item')}:\n\n${lines}\n\nThis can be undone.`;
    const apply = () => {
        v5Snapshot('recalibrating ' + (suggestion.name || 'the plan'));
        changes.forEach(c => { c.tx.amount = c.to; });
        v5Commit('Plan updated to match the actuals.');
    };
    if (typeof confirmModal === 'function') {
        confirmModal('Update the plan?', body, apply, { confirmLabel: 'Update the plan' });
    } else {
        apply();
    }
}

/* ───── FEAT-06 · Debt payoff ───── */

function renderDebtPanel() {
    const shell = v5Shell('panelDebt', 'Debt payoff');
    if (!shell) return;
    if (typeof payoffSchedule !== 'function') { v5Paint(shell, v5EngineMissing('payoffSchedule()')); return; }

    const accounts = Array.isArray(state.accounts) ? state.accounts : [];
    const extra = Math.max(0, v5Num(v5ui.debtExtra, 0));
    let avalanche = null, snowball = null;
    try {
        avalanche = payoffSchedule(accounts, extra, 'avalanche');
        snowball = payoffSchedule(accounts, extra, 'snowball');
    } catch (e) {
        console.error('[Cashflow Compass] payoffSchedule failed', e);
    }

    if (!avalanche || !snowball) {
        v5Paint(shell, '<div class="v5-empty"><strong>No credit accounts on file.</strong> ' +
            'Add an account of type Credit Card with its balance, APR and minimum payment, and this becomes a payoff plan: ' +
            'two orderings of the same debts, the date each clears, and the interest each ordering costs.</div>');
        return;
    }

    const input = `<div class="v5-row">
            <div class="v5-field narrow">
                <label class="v5-label" for="v5DebtExtra">Extra per month</label>
                <input type="number" id="v5DebtExtra" data-keep="debtExtra" step="10" min="0" inputmode="decimal" value="${v5esc(String(extra))}">
            </div>
            <div class="v5-field">
                <div class="v5-label">Total going at the debt</div>
                <div class="v5-val">${v5esc(v5Money(v5Num(avalanche.monthlyBudget, 0)))}<span class="muted-text"> / month</span></div>
            </div>
            <div class="v5-field">
                <div class="v5-label">Owed today</div>
                <div class="v5-val">${v5esc(v5Money(v5Num(avalanche.totalBalance, 0)))}</div>
            </div>
        </div>`;

    // Neither ordering has a "cheaper" to claim while the debt never clears —
    // the interest figure is then only 50 years of accrual, not a cost anyone pays.
    const bothClear = !!(avalanche.debtFreeDate && snowball.debtFreeDate);
    const cheaper = v5Num(avalanche.totalInterest, 0) <= v5Num(snowball.totalInterest, 0) ? 'avalanche' : 'snowball';
    const tiles = `<div class="v5-split">
            ${v5PayoffTile('Avalanche', 'Highest APR first', avalanche, bothClear && cheaper === 'avalanche')}
            ${v5PayoffTile('Snowball', 'Smallest balance first', snowball, bothClear && cheaper === 'snowball')}
        </div>
        <p class="v5-note">${v5esc(v5PayoffCompare(avalanche, snowball))}</p>`;

    const order = Array.isArray(avalanche.accounts) ? avalanche.accounts : [];
    const snowballBy = {};
    (snowball.accounts || []).forEach(a => { snowballBy[a.id] = a; });
    const rows = order.map((a, i) => {
        const twin = snowballBy[a.id] || {};
        return `<tr>
            <td><span class="muted-text">${i + 1}.</span> ${v5esc(a.name || '(unnamed)')}</td>
            <td class="num">${v5esc(v5Pct(v5Num(a.apr, 0)))}</td>
            <td class="num">${v5esc(v5Money(v5Num(a.balance, 0)))}</td>
            <td class="num">${v5esc(v5Money(v5Num(a.minPayment, 0)))}</td>
            <td>${a.payoffDate ? v5esc(v5Long(a.payoffDate)) : '<span class="muted-text">not within 50 years</span>'}</td>
            <td>${twin.payoffDate ? v5esc(v5Long(twin.payoffDate)) : '<span class="muted-text">—</span>'}</td>
            <td class="num">${a.payoffDate ? v5esc(v5Money(v5Num(a.totalInterest, 0))) : '<span class="muted-text">—</span>'}</td>
        </tr>`;
    }).join('');

    const table = `<hr class="v5-sep"><div class="v5-label">Payoff order — avalanche</div>
        <div class="table-wrap"><table>
            <thead><tr>
                <th>Account</th><th class="num">APR</th><th class="num">Owed</th><th class="num">Minimum</th>
                <th>Clear (avalanche)</th><th>Clear (snowball)</th><th class="num">Interest</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <p class="v5-note">Every figure here is arithmetic on the balances, rates and payments you entered: interest each month on what is still owed, minimums on everything, and the remainder thrown at the front of the queue. It is not advice about what you should do.</p>`;

    v5Paint(shell, input + tiles + table);
    v5Wire(shell, {
        input: e => {
            if (!e.target.matches('[data-keep="debtExtra"]')) return;
            v5ui.debtExtra = Math.max(0, v5Num(e.target.value, 0));
            renderDebtPanel();
        }
    });
}

function v5PayoffTile(title, subtitle, schedule, lead) {
    const free = schedule.debtFreeDate ? v5Long(schedule.debtFreeDate) : null;
    const months = v5Num(schedule.months, 0);
    // A balance that never clears has no total interest to quote: what the
    // simulation holds is 50 years of accrual, which is a ceiling, not a cost.
    const interest = free
        ? v5esc(v5Money(v5Num(schedule.totalInterest, 0)))
        : '<span class="muted-text">no total while the balance stands</span>';
    return `<div class="v5-tile${lead ? ' lead' : ''}">
        <h4>${v5esc(title)}${lead ? '<span class="v5-chip on">less interest</span>' : ''}</h4>
        <p class="v5-note tight">${v5esc(subtitle)}</p>
        <div class="v5-kv"><span class="k">Debt-free</span><span class="v">${free ? v5esc(free) : '<span class="muted-text">not within 50 years</span>'}</span></div>
        <div class="v5-kv"><span class="k">Takes</span><span class="v">${free ? v5esc(months + ' ' + v5Plural(months, 'month')) : '—'}</span></div>
        <div class="v5-kv"><span class="k">Total interest</span><span class="v">${interest}</span></div>
    </div>`;
}

function v5PayoffCompare(avalanche, snowball) {
    if (v5Num(avalanche.monthlyBudget, 0) <= 0) {
        return 'Nothing is being paid towards these balances, so neither ordering ever clears them. Give the cards a minimum payment, or add an extra amount above, to see a payoff date.';
    }
    if (!avalanche.debtFreeDate || !snowball.debtFreeDate) {
        return 'At this monthly payment the balances do not clear within 50 years — the interest is keeping pace with the payment. Raising the extra amount above is what changes that.';
    }
    const interestGap = v5Round(v5Num(snowball.totalInterest, 0) - v5Num(avalanche.totalInterest, 0));
    const monthGap = v5Num(snowball.months, 0) - v5Num(avalanche.months, 0);
    const cheaper = interestGap >= 0 ? 'Avalanche' : 'Snowball';
    const saved = Math.abs(interestGap);
    const soonerBy = Math.abs(monthGap);
    if (saved < 0.5 && soonerBy === 0) {
        return 'Both orderings clear the debt on the same date for the same interest — with these balances and rates the choice makes no arithmetic difference.';
    }
    const timing = soonerBy === 0
        ? 'and both finish in the same month'
        : `and finishes ${soonerBy} ${v5Plural(soonerBy, 'month')} ${(interestGap >= 0) === (monthGap >= 0) ? 'sooner' : 'later'}`;
    return `${cheaper} saves ${v5Money(saved)} in interest ${timing}. Snowball clears the smallest balance first, which some people find easier to keep going with.`;
}

/* ───── FEAT-08 · Goals and sinking funds ───── */

function renderGoalsPanel(forecast) {
    const goals = (Array.isArray(state.categories) ? state.categories : []).filter(c => c.kind === 'goal');
    const shell = v5Shell('panelGoals', 'Goals & sinking funds', goals.length ? `${goals.length} ${v5Plural(goals.length, 'goal')}` : '');
    if (!shell) return;

    let progress = [];
    if (typeof goalProgress === 'function' && forecast) {
        try { progress = goalProgress(forecast) || []; }
        catch (e) { console.error('[Cashflow Compass] goalProgress failed', e); }
    }
    const byId = {};
    progress.forEach(p => { byId[p.id] = p; });

    const addForm = `<hr class="v5-sep"><form data-v5form="goal-add" novalidate>
            <div class="v5-row">
                <div class="v5-field grow">
                    <label class="v5-label" for="v5GoalName">Add a goal</label>
                    <input type="text" id="v5GoalName" data-keep="goalName" placeholder="e.g., New roof, Japan trip, Emergency fund">
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5GoalTarget">Target</label>
                    <input type="number" id="v5GoalTarget" data-keep="goalTarget" step="0.01" min="0" inputmode="decimal" placeholder="0.00">
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5GoalBy">By</label>
                    <input type="date" id="v5GoalBy" data-keep="goalBy">
                </div>
                <div class="v5-actions"><button type="submit" class="primary">Create goal</button></div>
            </div>
        </form>
        <p class="v5-note">A goal is a category. Money reaches it the way money reaches any category — through a transaction filed under it, usually a monthly contribution.</p>`;

    if (!goals.length) {
        v5Paint(shell, '<div class="v5-empty"><strong>No goals yet.</strong> ' +
            'A goal turns a vague intention into arithmetic: how much a month is going in, how much has accumulated, ' +
            'and the date the target is reached at that rate.</div>' + addForm);
        v5WireGoals(shell);
        return;
    }

    const horizonMonths = forecast && Array.isArray(forecast.monthList) ? forecast.monthList.length : 0;

    const cards = goals.map(cat => {
        const p = byId[cat.id] || {};
        const target = Math.max(0, v5Num(cat.target, 0));
        // Money can reach a goal as a transfer rather than as spending filed
        // against it, so the engine's contribution map is read where it exists
        // and stands in for the progress figure where the progress is absent.
        const contributed = v5Contribution(forecast, cat.id);
        const stated = Object.prototype.hasOwnProperty.call(p, 'accumulated');
        const accumulated = stated ? v5Num(p.accumulated, 0) : v5Num(contributed, 0);
        const monthly = stated ? v5Num(p.monthly, 0)
            : (horizonMonths > 0 ? accumulated / horizonMonths : 0);
        const transferLine = (contributed == null || contributed <= 0.005) ? ''
            : (contributed <= accumulated + 0.005
                ? `Transfers into this category account for ${v5Money(contributed)} of that.`
                : `Transfers into this category contribute ${v5Money(contributed)} across the horizon.`);
        const requirement = v5GoalRequirement(p, cat, monthly);
        const pct = target > 0 ? Math.max(0, Math.min(100, (accumulated / target) * 100)) : null;
        const eta = p.eta ? v5Long(p.eta) : null;
        const targetDate = cat.targetDate ? v5Long(cat.targetDate) : null;
        const onTrack = p.onTrack;
        const chip = onTrack === true ? '<span class="v5-chip pos">on track</span>'
            : onTrack === false ? '<span class="v5-chip warn">behind the date</span>'
            : (target > 0 ? '<span class="v5-chip info">no date set</span>' : '<span class="v5-chip">no target set</span>');
        const bar = pct != null
            ? `<div class="v5-bar" role="img" aria-label="${v5esc(v5Pct(pct) + ' of ' + v5Money(target) + ' saved')}"><span style="width:${pct.toFixed(2)}%;background:${v5esc(v5SafeColor(cat.color))};"></span></div>`
            : '<div class="v5-bar" aria-hidden="true"><span style="width:0%"></span></div>';
        const line = target > 0
            ? `${v5Money(accumulated)} of ${v5Money(target)}${pct != null ? ' · ' + v5Pct(pct) : ''}`
            : `${v5Money(accumulated)} accumulated over the horizon`;
        const rate = monthly > 0.005
            ? `${v5Money(monthly)}/mo going in`
            : 'Nothing is being contributed inside the horizon';
        const etaLine = eta
            ? `Reaches the target ${eta}${targetDate ? ' · wanted by ' + targetDate : ''}`
            : (target > 0 ? 'No contribution rate yet, so there is no date to reach it by.' : '');

        return `<div class="v5-goal">
            <div class="v5-goal-head">
                <span class="v5-goal-name">${v5esc(cat.name || 'Goal')}</span>
                ${chip}
            </div>
            ${bar}
            <p class="v5-note tight" style="margin-top:6px;">${v5esc(line)} · ${v5esc(rate)}</p>
            ${transferLine ? `<p class="v5-note tight">${v5esc(transferLine)}</p>` : ''}
            ${requirement ? `<p class="v5-note tight">${v5esc(requirement)}</p>` : ''}
            ${etaLine ? `<p class="v5-note tight">${v5esc(etaLine)}</p>` : ''}
            <div class="v5-row" style="margin-bottom:0;">
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5Target_${v5esc(cat.id)}">Target amount</label>
                    <input type="number" id="v5Target_${v5esc(cat.id)}" data-keep="target_${v5esc(cat.id)}" step="0.01" min="0"
                        inputmode="decimal" value="${target > 0 ? v5esc(String(target)) : ''}">
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5By_${v5esc(cat.id)}">Target date</label>
                    <input type="date" id="v5By_${v5esc(cat.id)}" data-keep="by_${v5esc(cat.id)}" value="${v5esc(cat.targetDate || '')}">
                </div>
                <div class="v5-actions">
                    <button type="button" data-v5act="goal-save" data-id="${v5esc(cat.id)}">Save target</button>
                </div>
            </div>
        </div>`;
    }).join('');

    const missing = (typeof goalProgress !== 'function')
        ? v5EngineMissing('goalProgress()')
        : (!forecast ? `<div class="v5-empty">${v5esc(V5_UNAVAILABLE)}</div>` : '');

    v5Paint(shell, missing + cards + addForm);
    v5WireGoals(shell);
}

function v5SafeColor(color) {
    if (typeof safeColor === 'function') return safeColor(color);
    return /^#[0-9a-f]{3,8}$/i.test(String(color || '').trim()) ? String(color).trim() : '#7dd3fc';
}

// Money can reach a goal as a transfer, which is not spending and so is kept out
// of the spend map. The engine reports it separately, per month; a build that
// reports nothing returns null here so the caller can tell "nothing contributed"
// apart from "not reported".
function v5Contribution(forecast, categoryId) {
    if (!forecast || !categoryId) return null;
    const map = forecast.monthlyContributionsByCategory || forecast.contributions;
    if (!map) return null;
    let value;
    if (typeof map.get === 'function') value = map.get(categoryId);
    else if (Object.prototype.hasOwnProperty.call(map, categoryId)) value = map[categoryId];
    if (value == null) return null;
    if (Array.isArray(value)) return v5Sum(value.map(n => v5Num(n, 0)));
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

// The figure a goal is really judged by: what has to go in each month between
// now and the date for the target to arrive on time.
function v5GoalRequirement(p, cat, monthly) {
    const target = Math.max(0, v5Num(cat.target, 0));
    const targetDate = v5ToDate(cat.targetDate);
    if (target <= 0 || !targetDate) return '';

    const stated = Object.prototype.hasOwnProperty.call(p, 'required');
    const required = stated ? p.required : v5RequiredPerMonth(target, targetDate);
    if (required == null || !Number.isFinite(required)) return v5GoalDateGone(target, targetDate);

    const shortfall = (Object.prototype.hasOwnProperty.call(p, 'shortfall') && Number.isFinite(p.shortfall))
        ? Math.max(0, p.shortfall)
        : Math.max(0, required - monthly);
    const left = Number.isFinite(p.monthsLeft) ? p.monthsLeft : v5MonthsLeft(targetDate);
    const head = `Reaching ${v5Money(target)} by ${v5Long(targetDate)} needs ${v5Money(required)} a month` +
        (left > 0 ? ` across the ${left} ${v5Plural(left, 'month')} before it` : ' from here') + '.';
    if (shortfall <= 0.005) {
        return `${head} The ${v5Money(monthly)} a month going in covers it.`;
    }
    return monthly > 0.005
        ? `${head} That is ${v5Money(shortfall)} a month more than the ${v5Money(monthly)} going in now.`
        : `${head} Nothing is going in at the moment, so the whole of it is outstanding.`;
}

// There is no rate to quote once the months have run out, and a date inside the
// current month has run out too — this month is already part spent.
function v5GoalDateGone(target, targetDate) {
    const when = v5Long(targetDate);
    return v5MonthsLeft(targetDate) < 0
        ? `The target date, ${when}, has already passed — move it forward to see what reaching ${v5Money(target)} would take from here.`
        : `The target date, ${when}, leaves no whole month to save in — move it forward to see what reaching ${v5Money(target)} would take.`;
}

// Whole months from this one to the target's, counted the way the engine counts
// them: the current month is already part spent and does not qualify.
function v5MonthsLeft(targetDate) {
    const now = new Date();
    return (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth());
}

function v5RequiredPerMonth(target, targetDate) {
    const months = v5MonthsLeft(targetDate);
    return months > 0 ? target / months : null;
}

function v5WireGoals(shell) {
    v5Wire(shell, {
        submit: e => {
            if (!e.target.matches('[data-v5form="goal-add"]')) return;
            e.preventDefault();
            v5AddGoal(shell.body);
        },
        click: e => {
            const hit = v5Act(e);
            if (!hit || hit.act !== 'goal-save') return;
            v5SaveGoalTarget(shell.body, hit.id);
        }
    });
}

function v5AddGoal(body) {
    const name = String(v5Val(body, 'goalName') || '').trim();
    if (!name) { v5Toast('Give the goal a name.', 'warning'); return; }
    const target = v5Num(v5Val(body, 'goalTarget'), 0);
    const targetDate = v5Val(body, 'goalBy') || null;
    v5Snapshot('adding the goal ' + name);
    if (!Array.isArray(state.categories)) state.categories = [];
    state.categories.push({
        id: typeof uid === 'function' ? uid('cat') : 'cat_' + Date.now(),
        name,
        kind: 'goal',
        color: '#7dd3fc',
        target: target > 0 ? v5Round(target) : 0,
        targetDate
    });
    v5SetVal(body, 'goalName', '');
    v5SetVal(body, 'goalTarget', '');
    v5SetVal(body, 'goalBy', '');
    v5Commit('Added the goal.');
}

function v5SaveGoalTarget(body, categoryId) {
    const cat = (Array.isArray(state.categories) ? state.categories : []).find(c => c.id === categoryId);
    if (!cat) return;
    const target = v5Num(v5Val(body, 'target_' + categoryId), 0);
    const targetDate = v5Val(body, 'by_' + categoryId) || null;
    v5Snapshot('setting the target on ' + (cat.name || 'a goal'));
    cat.target = target > 0 ? v5Round(target) : 0;
    cat.targetDate = targetDate;
    v5Commit('Saved the target.');
}

/* ───── FEAT-10 · Pay-vs-bills calendar ───── */

const V5_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function renderCalendarPanel(forecast) {
    const shell = v5Shell('panelCalendar', 'Pay vs bills');
    if (!shell) return;
    if (!forecast || !Array.isArray(forecast.monthList) || !forecast.monthList.length) {
        v5Paint(shell, `<div class="v5-empty">${v5esc(V5_UNAVAILABLE)}</div>`);
        return;
    }

    const monthCount = forecast.monthList.length;
    v5ui.calMonth = Math.max(0, Math.min(monthCount - 1, v5Num(v5ui.calMonth, 0)));
    const month = forecast.monthList[v5ui.calMonth];
    const monthStart = v5ToDate(month.date) || new Date();

    const days = v5Calendar(forecast, monthStart);
    const byKey = {};
    days.forEach(d => {
        const key = v5Date(d.date);
        if (key) byKey[key] = d;
    });

    const grid = v5CalendarGrid(monthStart, byKey, forecast.tightestWeek);
    if (!grid.any) {
        v5Paint(shell, v5CalendarHead(month, monthCount) +
            '<div class="v5-empty">Nothing falls due in this month. Step to another month, or add transactions and they appear here on the day they land.</div>');
        v5WireCalendar(shell, monthCount);
        return;
    }

    const tight = forecast.tightestWeek;
    const tightNote = tight && v5ToDate(tight.start)
        ? `<p class="v5-note">The dashed outline marks the tightest seven days in the whole horizon: ${v5esc(v5Long(tight.start))} to ${v5esc(v5Long(tight.end))}, ${v5esc(v5Signed(v5Num(tight.net, 0)))} across the week.</p>`
        : '';

    v5Paint(shell, v5CalendarHead(month, monthCount) + grid.html + `
        <div class="v5-daydetail" id="v5DayDetail" role="status" aria-live="polite">${v5CalendarDetail(byKey)}</div>
        <div class="v5-legend">
            <span><i style="background:${v5esc(v5Tint(v5Var('--live', '#3ddc84'), 0.75))};"></i>money in</span>
            <span><i style="background:${v5esc(v5Tint(v5Var('--down', '#ff6b6b'), 0.75))};"></i>money out</span>
            <span>every day also carries its own figure, so the tint is never the only signal</span>
        </div>` + tightNote);
    v5WireCalendar(shell, monthCount);
}

function v5CalendarHead(month, monthCount) {
    const atStart = v5ui.calMonth <= 0;
    const atEnd = v5ui.calMonth >= monthCount - 1;
    return `<div class="v5-cal-head">
            <span class="v5-cal-title">${v5esc(month.label || '')}</span>
            <div class="v5-actions">
                <button type="button" data-v5act="cal-prev" ${atStart ? 'disabled' : ''} aria-label="Previous month">←</button>
                <span class="muted-text">${v5ui.calMonth + 1} of ${monthCount}</span>
                <button type="button" data-v5act="cal-next" ${atEnd ? 'disabled' : ''} aria-label="Next month">→</button>
            </div>
        </div>`;
}

function v5WireCalendar(shell, monthCount) {
    v5Wire(shell, {
        click: e => {
            const hit = v5Act(e);
            if (!hit) return;
            if (hit.act === 'cal-prev') { v5ui.calMonth = Math.max(0, v5ui.calMonth - 1); v5ui.calDay = null; renderCalendarPanel(v5Forecast()); }
            else if (hit.act === 'cal-next') { v5ui.calMonth = Math.min(monthCount - 1, v5ui.calMonth + 1); v5ui.calDay = null; renderCalendarPanel(v5Forecast()); }
            else if (hit.act === 'cal-day') { v5ui.calDay = v5ui.calDay === hit.id ? null : hit.id; renderCalendarPanel(v5Forecast()); }
        }
    });
}

// The engine draws the calendar when it can; this is the same shape derived from
// the forecast the panel already holds, so the grid survives without it.
function v5Calendar(forecast, monthStart) {
    if (typeof billsCalendar === 'function') {
        try {
            const out = billsCalendar(forecast, monthStart, 1);
            if (Array.isArray(out)) return out;
        } catch (e) {
            console.error('[Cashflow Compass] billsCalendar failed', e);
        }
    }
    return v5LocalCalendar(forecast, monthStart);
}

function v5LocalCalendar(forecast, monthStart) {
    const first = monthStart;
    const last = typeof endOfMonth === 'function' ? endOfMonth(monthStart)
        : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const map = new Map();
    (forecast.txData || []).forEach(entry => {
        const name = (entry.tx && entry.tx.name) || 'Item';
        (entry.byDay || []).forEach(day => {
            const date = v5ToDate(day.date);
            if (!date || date < first || date > last) return;
            const signed = v5Num(day.signed, 0);
            if (!signed) return;
            const key = v5Date(date);
            let bucket = map.get(key);
            if (!bucket) { bucket = { date, net: 0, items: [] }; map.set(key, bucket); }
            bucket.net += signed;
            bucket.items.push({ name, amount: signed });
        });
    });
    return Array.from(map.values()).sort((a, b) => a.date - b.date);
}

function v5CalendarGrid(monthStart, byKey, tightestWeek) {
    const year = monthStart.getFullYear();
    const monthIndex = monthStart.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    // Monday-first: JS counts Sunday as 0.
    const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

    let peak = 0;
    let any = false;
    for (let d = 1; d <= daysInMonth; d++) {
        const entry = byKey[v5Date(new Date(year, monthIndex, d))];
        if (!entry) continue;
        any = true;
        peak = Math.max(peak, Math.abs(v5Num(entry.net, 0)));
    }

    const tightStart = tightestWeek ? v5ToDate(tightestWeek.start) : null;
    const tightEnd = tightestWeek ? v5ToDate(tightestWeek.end) : null;
    const inTight = date => !!(tightStart && tightEnd && date >= tightStart && date <= tightEnd);

    const cells = [];
    V5_DOW.forEach(d => cells.push(`<div class="v5-dow">${v5esc(d)}</div>`));
    for (let i = 0; i < lead; i++) cells.push('<div class="v5-day blank"></div>');

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, monthIndex, d);
        const key = v5Date(date);
        const entry = byKey[key];
        const tightClass = inTight(date) ? ' tight' : '';
        if (!entry) {
            cells.push(`<div class="v5-day${tightClass}"><span class="dnum">${d}</span></div>`);
            continue;
        }
        const net = v5Num(entry.net, 0);
        const share = peak > 0 ? Math.min(1, Math.abs(net) / peak) : 0;
        const alpha = 0.10 + share * 0.42;
        const base = net >= 0 ? v5Var('--live', '#3ddc84') : v5Var('--down', '#ff6b6b');
        const items = Array.isArray(entry.items) ? entry.items : [];
        const label = `${v5Long(date)}: ${v5Signed(net)} across ${items.length} ${v5Plural(items.length, 'item')}` +
            (items.length ? ' — ' + items.slice(0, 6).map(it => `${it.name || 'Item'} ${v5Signed(v5Num(it.amount, 0))}`).join(', ') : '');
        const pressed = v5ui.calDay === key ? 'true' : 'false';
        cells.push(`<button type="button" class="v5-day${tightClass}" data-v5act="cal-day" data-id="${v5esc(key)}"
            aria-pressed="${pressed}" title="${v5esc(label)}" aria-label="${v5esc(label)}"
            style="background:${v5esc(v5Tint(base, alpha))};">
            <span class="dnum">${d}</span>
            <span class="dnet ${net >= 0 ? 'v5-pos' : 'v5-neg'}">${v5esc(v5Signed(net))}</span>
            <span class="dcount">${items.length} ${v5esc(v5Plural(items.length, 'item'))}</span>
        </button>`);
    }
    return { html: `<div class="v5-cal">${cells.join('')}</div>`, any };
}

function v5CalendarDetail(byKey) {
    if (!v5ui.calDay) return 'Choose a day to list what falls due on it.';
    const entry = byKey[v5ui.calDay];
    if (!entry) return 'Nothing falls due on that day.';
    const items = Array.isArray(entry.items) ? entry.items : [];
    const list = items.map(it =>
        `<li>${v5esc(it.name || 'Item')} <span class="${v5Num(it.amount, 0) >= 0 ? 'v5-pos' : 'v5-neg'}">${v5esc(v5Signed(v5Num(it.amount, 0)))}</span></li>`).join('');
    return `<strong>${v5esc(v5Long(entry.date))}</strong> · ${v5esc(v5Signed(v5Num(entry.net, 0)))} on the day
        <ul>${list}</ul>`;
}

/* ───── FEAT-07 · Scenarios ───── */

function renderScenariosPanel(forecast) {
    const scenarios = v5Coll('scenarios');
    const activeId = v5Settings().activeScenarioId || null;
    const shell = v5Shell('panelScenarios', 'Scenarios',
        activeId ? 'viewing a scenario' : 'viewing the base plan');
    if (!shell) return;

    if (v5ui.editScenarioId && !scenarios.some(s => s.id === v5ui.editScenarioId)) v5ui.editScenarioId = null;
    if (!v5ui.editScenarioId) v5ui.editScenarioId = activeId || (scenarios[0] ? scenarios[0].id : null);

    const create = `<form data-v5form="scenario-add" novalidate>
            <div class="v5-row">
                <div class="v5-field grow">
                    <label class="v5-label" for="v5ScenarioName">New scenario</label>
                    <input type="text" id="v5ScenarioName" data-keep="scenarioName" placeholder="e.g., If I take the new job, If rent goes up">
                </div>
                <div class="v5-actions"><button type="submit" class="primary">Create scenario</button></div>
            </div>
        </form>`;

    if (!scenarios.length) {
        v5Paint(shell, '<div class="v5-empty"><strong>One plan, several futures.</strong> ' +
            'A scenario is a named set of changes laid over the base plan — a raise, a rent rise, a subscription gone — ' +
            'without touching what you have already entered. Activate one and the whole deck redraws through it.</div>' + create);
        v5WireScenarios(shell, forecast);
        return;
    }

    const list = scenarios.map(s => {
        const ops = Array.isArray(s.ops) ? s.ops.length : 0;
        const isActive = s.id === activeId;
        const renaming = v5ui.renamingId === s.id;
        const label = renaming
            ? `<input type="text" data-keep="rename_${v5esc(s.id)}" value="${v5esc(s.name || '')}" aria-label="Scenario name">`
            : `<span>${v5esc(s.name || 'Untitled scenario')} <span class="muted-text">${ops} ${v5esc(v5Plural(ops, 'change'))}</span></span>`;
        const actions = renaming
            ? `<button type="button" class="primary" data-v5act="sc-rename-save" data-id="${v5esc(s.id)}">Save</button>
               <button type="button" class="ghost" data-v5act="sc-rename-cancel" data-id="${v5esc(s.id)}">Cancel</button>`
            : `${isActive
                    ? '<span class="v5-chip on">active</span>'
                    : `<button type="button" data-v5act="sc-activate" data-id="${v5esc(s.id)}">Activate</button>`}
               <button type="button" data-v5act="sc-edit" data-id="${v5esc(s.id)}">${v5ui.editScenarioId === s.id ? 'Editing' : 'Edit'}</button>
               <button type="button" data-v5act="sc-rename" data-id="${v5esc(s.id)}">Rename</button>
               <button type="button" class="ghost icon" data-v5act="sc-delete" data-id="${v5esc(s.id)}"
                    aria-label="Delete the scenario ${v5esc(s.name || '')}" title="Delete">✕</button>`;
        return `<li>${label}<span class="v5-actions">${actions}</span></li>`;
    }).join('');

    const baseRow = `<li><span>${activeId ? '' : '<span class="v5-chip on">active</span> '}Base plan <span class="muted-text">everything you have entered</span></span>
        <span class="v5-actions">${activeId ? '<button type="button" data-v5act="sc-activate" data-id="">Back to base</button>' : ''}</span></li>`;

    v5Paint(shell,
        `<ul class="v5-oplist">${baseRow}${list}</ul>` +
        create +
        v5ScenarioEditor() +
        v5ScenarioComparison(forecast, scenarios, activeId));
    v5WireScenarios(shell, forecast);
}

function v5ScenarioEditor() {
    const scenario = v5Coll('scenarios').find(s => s.id === v5ui.editScenarioId);
    if (!scenario) return '';
    const transactions = Array.isArray(state.transactions) ? state.transactions : [];
    const ops = Array.isArray(scenario.ops) ? scenario.ops : [];

    const txOptions = transactions.length
        ? transactions.map(t => `<option value="${v5esc(t.id)}">${v5esc((t.name || 'Item') + ' — ' + v5Money(v5Num(t.amount, 0)))}</option>`).join('')
        : '<option value="">No transactions in the base plan yet</option>';

    const opList = ops.length
        ? `<ul class="v5-oplist">${ops.map((op, i) => `<li>
                <span>${v5esc(v5DescribeOp(op))}</span>
                <button type="button" class="ghost icon" data-v5act="op-del" data-id="${i}"
                    aria-label="Remove this change" title="Remove">✕</button>
            </li>`).join('')}</ul>`
        : '<p class="v5-note">No changes in this scenario yet, so it currently matches the base plan exactly.</p>';

    const frequencies = (typeof FREQUENCY_LABELS === 'object' && FREQUENCY_LABELS)
        ? Object.keys(FREQUENCY_LABELS).map(k => `<option value="${v5esc(k)}">${v5esc(FREQUENCY_LABELS[k])}</option>`).join('')
        : '<option value="monthly">Monthly</option>';

    const accountOptions = '<option value="">Unassigned</option>' +
        (Array.isArray(state.accounts) ? state.accounts : [])
            .map(a => `<option value="${v5esc(a.id)}">${v5esc(a.name || '(unnamed)')}</option>`).join('');

    return `<hr class="v5-sep">
        <div class="v5-label">Editing “${v5esc(scenario.name || 'Untitled scenario')}”</div>
        ${opList}
        <form data-v5form="op-change" novalidate>
            <div class="v5-row">
                <div class="v5-field grow">
                    <label class="v5-label" for="v5OpTx">Change an existing item</label>
                    <select id="v5OpTx" data-keep="opTx">${txOptions}</select>
                </div>
                <div class="v5-field">
                    <label class="v5-label" for="v5OpKind">What happens to it</label>
                    <select id="v5OpKind" data-keep="opKind">
                        <option value="amount">Set a different amount</option>
                        <option value="pause">Pause it</option>
                        <option value="remove">Remove it</option>
                    </select>
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5OpAmount">New amount</label>
                    <input type="number" id="v5OpAmount" data-keep="opAmount" step="0.01" min="0" inputmode="decimal" placeholder="0.00">
                </div>
                <div class="v5-actions"><button type="submit">Add change</button></div>
            </div>
        </form>
        <form data-v5form="op-add" novalidate>
            <div class="v5-row">
                <div class="v5-field grow">
                    <label class="v5-label" for="v5NewName">Add something new</label>
                    <input type="text" id="v5NewName" data-keep="newName" placeholder="e.g., New job, Gym membership">
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5NewKind">Kind</label>
                    <select id="v5NewKind" data-keep="newKind">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5NewAmount">Amount</label>
                    <input type="number" id="v5NewAmount" data-keep="newAmount" step="0.01" min="0" inputmode="decimal" placeholder="0.00">
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5NewFreq">Frequency</label>
                    <select id="v5NewFreq" data-keep="newFreq">${frequencies}</select>
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5NewStart">Starts</label>
                    <input type="date" id="v5NewStart" data-keep="newStart" value="${v5esc(v5Date(new Date()))}">
                </div>
                <div class="v5-field narrow">
                    <label class="v5-label" for="v5NewAcct">Account</label>
                    <select id="v5NewAcct" data-keep="newAcct">${accountOptions}</select>
                </div>
                <div class="v5-actions"><button type="submit">Add item</button></div>
            </div>
        </form>`;
}

function v5DescribeOp(op) {
    if (!op || !op.op) return 'An unreadable change';
    const name = v5TxName(op.txId) || 'an item no longer in the plan';
    if (op.op === 'remove') return `Remove ${name}`;
    if (op.op === 'add') {
        const tx = op.tx || {};
        const kind = tx.kind === 'income' ? 'income' : 'expense';
        const freq = (typeof FREQUENCY_LABELS === 'object' && FREQUENCY_LABELS[tx.frequency]) || tx.frequency || 'monthly';
        return `Add ${tx.name || 'a new item'} — ${kind} ${v5Money(v5Num(tx.amount, 0))}, ${String(freq).toLowerCase()}, from ${v5Long(tx.startDate) || 'today'}`;
    }
    if (op.op === 'modify') {
        const patch = op.patch || {};
        const parts = [];
        if (patch.amount !== undefined) parts.push(`amount ${v5Money(v5Num(patch.amount, 0))}`);
        if (patch.paused !== undefined) parts.push(patch.paused ? 'paused' : 'unpaused');
        if (patch.startDate !== undefined) parts.push(`starts ${v5Long(patch.startDate)}`);
        if (patch.endDate !== undefined) parts.push(`ends ${patch.endDate ? v5Long(patch.endDate) : 'never'}`);
        if (patch.escalation !== undefined) parts.push(`escalation ${v5Pct(v5Num(patch.escalation, 0))}`);
        return `${name}: ${parts.length ? parts.join(', ') : 'no change recorded'}`;
    }
    return 'An unreadable change';
}

function v5TxName(txId) {
    if (!txId || !state || !Array.isArray(state.transactions)) return '';
    const found = state.transactions.find(t => t.id === txId);
    return found ? `“${found.name || 'Item'}”` : '';
}

function v5ScenarioComparison(forecast, scenarios, activeId) {
    if (typeof buildForecast !== 'function') return '';
    const months = forecast ? forecast.monthList.length : v5Months();
    const shown = scenarios.slice(0, 8);
    const rows = [{ id: null, name: 'Base plan' }].concat(shown.map(s => ({ id: s.id, name: s.name || 'Untitled scenario' })));

    const measured = rows.map(row => {
        const fc = v5ForecastFor(row.id, months);
        return { row, metrics: v5Metrics(fc) };
    });
    if (!measured.some(m => m.metrics)) return '';

    const body = measured.map(({ row, metrics }) => {
        const isActive = (row.id || null) === (activeId || null);
        if (!metrics) {
            return `<tr><td>${v5esc(row.name)}</td><td colspan="4"><span class="muted-text">could not be projected</span></td></tr>`;
        }
        return `<tr>
            <td>${v5esc(row.name)} ${isActive ? '<span class="v5-chip on">active</span>' : ''}</td>
            <td class="num ${metrics.end < 0 ? 'v5-neg' : ''}">${v5esc(v5Money(metrics.end))}</td>
            <td class="num ${metrics.lowest < 0 ? 'v5-neg' : ''}">${v5esc(v5Money(metrics.lowest))}<span class="muted-text"> ${v5esc(v5Long(metrics.lowestDate))}</span></td>
            <td class="num ${metrics.daysInRed > 0 ? 'v5-neg' : ''}">${v5esc(String(metrics.daysInRed))}</td>
            <td class="num">${metrics.savingsRate == null ? '<span class="muted-text">—</span>' : v5esc(v5Pct(metrics.savingsRate))}</td>
        </tr>`;
    }).join('');

    const note = scenarios.length > shown.length
        ? `<p class="v5-note">Comparing the first ${shown.length} scenarios of ${scenarios.length}.</p>` : '';

    return `<hr class="v5-sep"><div class="v5-label">Base plan vs each scenario</div>
        <div class="table-wrap"><table>
            <thead><tr><th>Plan</th><th class="num">End balance</th><th class="num">Lowest point</th><th class="num">Days in red</th><th class="num">Savings rate</th></tr></thead>
            <tbody>${body}</tbody>
        </table></div>${note}
        <p class="v5-note">Each row is the whole forecast rebuilt with that scenario’s changes applied over the base plan. Nothing you have entered is altered by looking.</p>`;
}

// Scenario forecasts are built by swapping the state the engine reads, then
// putting the real one back — the base plan is never modified in place.
function v5ForecastFor(scenarioId, months) {
    if (typeof buildForecast !== 'function' || !state) return null;
    const base = state;
    try {
        if (scenarioId) state = v5ApplyScenario(base, scenarioId);
        return buildForecast(months);
    } catch (e) {
        console.error('[Cashflow Compass] a scenario forecast could not be built', e);
        return null;
    } finally {
        state = base;
    }
}

function v5ApplyScenario(baseState, scenarioId) {
    if (typeof applyScenario === 'function') {
        try {
            const applied = applyScenario(baseState, scenarioId);
            if (applied) return applied;
        } catch (e) {
            console.error('[Cashflow Compass] applyScenario failed; falling back to the local reading of the ops', e);
        }
    }
    return v5LocalApplyScenario(baseState, scenarioId);
}

const V5_PATCH_FIELDS = ['amount', 'startDate', 'endDate', 'paused', 'escalation'];

function v5LocalApplyScenario(baseState, scenarioId) {
    const clone = v5Clone(baseState);
    if (!Array.isArray(clone.transactions)) clone.transactions = [];
    const scenario = (Array.isArray(clone.scenarios) ? clone.scenarios : []).find(s => s.id === scenarioId);
    if (!scenario || !Array.isArray(scenario.ops)) return clone;
    scenario.ops.forEach(op => {
        if (!op || !op.op) return;
        if (op.op === 'add' && op.tx) {
            clone.transactions.push(v5Clone(op.tx));
        } else if (op.op === 'remove') {
            clone.transactions = clone.transactions.filter(t => t.id !== op.txId);
        } else if (op.op === 'modify' && op.patch) {
            const target = clone.transactions.find(t => t.id === op.txId);
            if (!target) return;
            V5_PATCH_FIELDS.forEach(field => {
                if (op.patch[field] !== undefined) target[field] = op.patch[field];
            });
        }
    });
    return clone;
}

function v5Metrics(fc) {
    if (!fc || !Array.isArray(fc.monthList) || !fc.monthList.length) return null;
    const last = fc.monthList.length - 1;
    const income = v5Sum(fc.monthlyIncome);
    const expense = v5Sum(fc.monthlyExpense);
    return {
        end: v5Num(fc.runningBalance ? fc.runningBalance[last] : fc.startingBalance, 0),
        lowest: v5Num(fc.lowest ? fc.lowest.balance : 0, 0),
        lowestDate: fc.lowest ? fc.lowest.date : null,
        daysInRed: v5Num(fc.daysInRed, 0),
        savingsRate: income > 0.005 ? ((income - expense) / income) * 100 : null
    };
}

function v5WireScenarios(shell, forecast) {
    v5Wire(shell, {
        submit: e => {
            const form = e.target;
            if (form.matches('[data-v5form="scenario-add"]')) { e.preventDefault(); v5AddScenario(shell.body); }
            else if (form.matches('[data-v5form="op-change"]')) { e.preventDefault(); v5AddChangeOp(shell.body); }
            else if (form.matches('[data-v5form="op-add"]')) { e.preventDefault(); v5AddNewItemOp(shell.body); }
        },
        click: e => {
            const hit = v5Act(e);
            if (!hit) return;
            switch (hit.act) {
                case 'sc-activate': v5ActivateScenario(hit.id || null); break;
                case 'sc-edit': v5ui.editScenarioId = hit.id; renderScenariosPanel(forecast); break;
                case 'sc-rename': v5ui.renamingId = hit.id; renderScenariosPanel(forecast); break;
                case 'sc-rename-cancel': v5ui.renamingId = null; renderScenariosPanel(forecast); break;
                case 'sc-rename-save': v5RenameScenario(shell.body, hit.id); break;
                case 'sc-delete': v5DeleteScenario(hit.id); break;
                case 'op-del': v5DeleteOp(parseInt(hit.id, 10)); break;
                default: break;
            }
        }
    });
}

function v5AddScenario(body) {
    const name = String(v5Val(body, 'scenarioName') || '').trim();
    if (!name) { v5Toast('Give the scenario a name.', 'warning'); return; }
    v5Snapshot('adding the scenario ' + name);
    const scenario = {
        id: typeof uid === 'function' ? uid('scn') : 'scn_' + Date.now(),
        name,
        ops: []
    };
    v5Coll('scenarios').push(scenario);
    v5ui.editScenarioId = scenario.id;
    v5SetVal(body, 'scenarioName', '');
    v5Commit('Added the scenario.');
}

function v5RenameScenario(body, id) {
    const scenario = v5Coll('scenarios').find(s => s.id === id);
    if (!scenario) return;
    const name = String(v5Val(body, 'rename_' + id) || '').trim();
    if (!name) { v5Toast('A scenario needs a name.', 'warning'); return; }
    v5Snapshot('renaming ' + (scenario.name || 'a scenario'));
    scenario.name = name;
    v5ui.renamingId = null;
    v5Commit('Renamed the scenario.');
}

function v5DeleteScenario(id) {
    const scenario = v5Coll('scenarios').find(s => s.id === id);
    if (!scenario) return;
    const remove = () => {
        v5Snapshot('deleting ' + (scenario.name || 'a scenario'));
        state.scenarios = v5Coll('scenarios').filter(s => s.id !== id);
        if (v5Settings().activeScenarioId === id) v5Settings().activeScenarioId = null;
        if (v5ui.editScenarioId === id) v5ui.editScenarioId = null;
        v5Commit('Deleted the scenario.');
    };
    if (typeof confirmModal === 'function') {
        confirmModal('Delete this scenario?',
            `${scenario.name || 'This scenario'} and its changes are removed. The base plan is untouched, and this can be undone.`,
            remove, { confirmLabel: 'Delete' });
    } else {
        remove();
    }
}

function v5ActivateScenario(id) {
    v5Settings().activeScenarioId = id || null;
    if (id) v5ui.editScenarioId = id;
    if (typeof saveState === 'function') saveState();
    if (typeof renderAll === 'function') renderAll();
    v5Toast(id
        ? 'Now showing the deck through this scenario.'
        : 'Back to the base plan.');
}

function v5EditingScenario() {
    return v5Coll('scenarios').find(s => s.id === v5ui.editScenarioId) || null;
}

function v5AddChangeOp(body) {
    const scenario = v5EditingScenario();
    if (!scenario) return;
    const txId = v5Val(body, 'opTx');
    if (!txId) { v5Toast('There is no transaction in the base plan to change yet.', 'warning'); return; }
    const kind = v5Val(body, 'opKind') || 'amount';
    if (!Array.isArray(scenario.ops)) scenario.ops = [];
    let op = null;
    if (kind === 'remove') {
        op = { op: 'remove', txId };
    } else if (kind === 'pause') {
        op = { op: 'modify', txId, patch: { paused: true } };
    } else {
        const raw = v5Val(body, 'opAmount');
        if (raw === '' || !Number.isFinite(parseFloat(raw))) {
            v5Toast('Enter the new amount as a number.', 'warning');
            return;
        }
        op = { op: 'modify', txId, patch: { amount: v5Round(Math.abs(parseFloat(raw))) } };
    }
    v5Snapshot('adding a change to ' + (scenario.name || 'a scenario'));
    scenario.ops.push(op);
    v5SetVal(body, 'opAmount', '');
    v5Commit('Added the change.');
}

function v5AddNewItemOp(body) {
    const scenario = v5EditingScenario();
    if (!scenario) return;
    const name = String(v5Val(body, 'newName') || '').trim();
    if (!name) { v5Toast('Give the new item a name.', 'warning'); return; }
    const raw = v5Val(body, 'newAmount');
    if (raw === '' || !Number.isFinite(parseFloat(raw))) {
        v5Toast('Enter the amount as a number.', 'warning');
        return;
    }
    const kind = v5Val(body, 'newKind') === 'income' ? 'income' : 'expense';
    const frequency = v5Val(body, 'newFreq') || 'monthly';
    const startDate = v5Val(body, 'newStart') || v5Date(new Date());
    const accountId = v5Val(body, 'newAcct') || null;
    if (!Array.isArray(scenario.ops)) scenario.ops = [];
    v5Snapshot('adding an item to ' + (scenario.name || 'a scenario'));
    scenario.ops.push({
        op: 'add',
        tx: {
            id: typeof uid === 'function' ? uid('tx') : 'tx_' + Date.now(),
            name,
            kind,
            amount: v5Round(Math.abs(parseFloat(raw))),
            categoryId: null,
            accountId,
            fromAccountId: null,
            frequency,
            startDate,
            endDate: null,
            customN: 1,
            customUnit: 'days',
            escalation: 0,
            tags: [],
            notes: '',
            paused: false
        }
    });
    v5SetVal(body, 'newName', '');
    v5SetVal(body, 'newAmount', '');
    v5Commit('Added the item to the scenario.');
}

function v5DeleteOp(index) {
    const scenario = v5EditingScenario();
    if (!scenario || !Array.isArray(scenario.ops)) return;
    if (!Number.isInteger(index) || index < 0 || index >= scenario.ops.length) return;
    v5Snapshot('removing a change from ' + (scenario.name || 'a scenario'));
    scenario.ops.splice(index, 1);
    v5Commit('Removed the change.');
}

/* ───── Render orchestration ───── */

const V5_PANELS = [
    { id: 'panelCheckin',   title: 'Balance check-ins',      render: renderCheckinPanel },
    { id: 'panelAccounts',  title: 'Per-account balances',   render: renderAccountsPanel },
    { id: 'panelVariance',  title: 'Plan vs actual',         render: renderVariancePanel },
    { id: 'panelDebt',      title: 'Debt payoff',            render: renderDebtPanel },
    { id: 'panelGoals',     title: 'Goals & sinking funds',  render: renderGoalsPanel },
    { id: 'panelCalendar',  title: 'Pay vs bills',           render: renderCalendarPanel },
    { id: 'panelScenarios', title: 'Scenarios',              render: renderScenariosPanel }
];

function renderFeaturePanels() {
    if (typeof state === 'undefined' || !state) return;
    injectPanelStyles();
    const forecast = v5Forecast();
    V5_PANELS.forEach(panel => {
        if (!document.getElementById(panel.id)) return;
        try {
            panel.render(forecast);
        } catch (e) {
            console.error('[Cashflow Compass] the ' + panel.id + ' panel could not be drawn', e);
            try {
                const shell = v5Shell(panel.id, panel.title, '');
                if (shell) {
                    shell.body.innerHTML = shell.heading +
                        '<div class="v5-empty">This panel could not be drawn from the data currently loaded. Nothing else on the page is affected.</div>';
                }
            } catch (inner) { /* the panel is beyond reach; the rest of the deck is not */ }
        }
    });
}

/* An active scenario is meant to redraw the whole deck, not just this file's
 * panels. Where the base render already reads settings.activeScenarioId it is
 * left to do so; where it does not, the state the engine reads is swapped for
 * the scenario's for the duration of the render and put straight back. The
 * check is behavioural rather than assumed: if applying the scenario changes
 * nothing about the forecast, taking either path gives the same picture. */
let _v5BaseAppliesScenario = null;

function v5BaseAppliesScenario(months) {
    if (_v5BaseAppliesScenario === true) return true;
    if (typeof buildForecast !== 'function') return true;
    const settings = v5Settings();
    const id = settings.activeScenarioId;
    const scenario = v5Coll('scenarios').find(s => s.id === id);
    if (!scenario || !Array.isArray(scenario.ops) || !scenario.ops.length) return true;

    const before = settings.activeScenarioId;
    let withScenario, without;
    try {
        settings.activeScenarioId = id;
        withScenario = v5Fingerprint(buildForecast(months));
        settings.activeScenarioId = null;
        without = v5Fingerprint(buildForecast(months));
    } catch (e) {
        return false;
    } finally {
        settings.activeScenarioId = before;
    }
    if (withScenario !== without) _v5BaseAppliesScenario = true;
    return withScenario !== without;
}

function v5Fingerprint(fc) {
    if (!fc) return 'none';
    try {
        return (fc.runningBalance || []).map(n => Math.round(v5Num(n, 0) * 100)).join(',') + '|' +
               (fc.monthlyNet || []).map(n => Math.round(v5Num(n, 0) * 100)).join(',');
    } catch (e) {
        return 'unreadable';
    }
}

const _prevRenderAll = renderAll;
let _v5Swapping = false;

renderAll = function () {
    const activeId = (state && state.settings) ? state.settings.activeScenarioId : null;
    const months = state ? v5Months() : 12;
    if (activeId && !_v5Swapping && !v5BaseAppliesScenario(months)) {
        const base = state;
        _v5Swapping = true;
        try {
            state = v5ApplyScenario(base, activeId);
            if (typeof clearForecastCache === 'function') clearForecastCache();
            _prevRenderAll.apply(this, arguments);
        } finally {
            state = base;
            if (typeof clearForecastCache === 'function') clearForecastCache();
            _v5Swapping = false;
        }
    } else {
        _prevRenderAll.apply(this, arguments);
    }
    renderFeaturePanels();
};

// app.js renders during its own parse, so the panels have to catch up once —
// and a scenario left active in a previous session has to be re-applied.
function v5Boot() {
    if (typeof state === 'undefined' || !state) return;
    const activeId = state.settings ? state.settings.activeScenarioId : null;
    if (activeId && !v5BaseAppliesScenario(v5Months())) renderAll();
    else renderFeaturePanels();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', v5Boot);
else v5Boot();
