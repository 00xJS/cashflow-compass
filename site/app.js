/* =========================================================
   Cashflow Compass — application layer
   DOM rendering, storage, import/export, event wiring.
   Depends on engine.js being loaded first.
   ========================================================= */
let editingTxId = null;
let editingAcctId = null;
let editingCatId = null;
let currentForecast = null;
const charts = {};
const sortState = {
    categories:   { column: null, direction: 'asc' },
    transactions: { column: null, direction: 'asc' }
};

/* ───── DOM helpers ─────
 * Every lookup tolerates a missing element, so a markup change can only cost
 * the feature that owns the element rather than the whole script.
 */
function el(id) { return document.getElementById(id); }
function pick(...ids) { for (const id of ids) { const node = el(id); if (node) return node; } return null; }
function setText(id, text) { const node = el(id); if (node) node.textContent = text; }
function getVal(id, fallback = '') { const node = el(id); return node ? node.value : fallback; }
function setVal(id, value) { const node = el(id); if (node) node.value = value; }
function setHidden(id, hidden) { const node = el(id); if (node) node.classList.toggle('hidden', hidden); }
function on(id, event, handler) { const node = el(id); if (node) node.addEventListener(event, handler); }

// Assigning a value a <select> does not offer leaves the previous selection
// standing, which turns a read into a silent edit. Ask first.
function selectHasOption(id, value) {
    const node = el(id);
    if (!node || !node.options) return false;
    return Array.prototype.some.call(node.options, o => o.value === value);
}

// An explicit behavior beats the stylesheet's scroll-behavior under CSSOM-View,
// so asking for 'smooth' here would animate for someone who asked for no motion.
function prefersReducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function scrollSectionIntoView(id) {
    const section = el(id);
    if (section) section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}
function accentColor() { return safeColorLiteral(cssVar('--accent', '#ff9a44'), '#ff9a44'); }
function safeColorLiteral(value, fallback) { return HEX_COLOR.test(String(value).trim()) ? String(value).trim() : fallback; }

// Colours arrive from saved data and end up inside style attributes and chart
// datasets, so anything that is not a plain hex literal is replaced.
function safeColor(color, fallback) {
    const s = String(color == null ? '' : color).trim();
    return HEX_COLOR.test(s) ? s : (fallback || accentColor());
}

// Chart fills need alpha; string-concatenating '55' onto a hex breaks for
// 3-digit and 8-digit values, so build a real rgba() instead.
function hexToRgba(color, alpha) {
    let hex = safeColor(color).slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(ch => ch + ch).join('');
    if (hex.length === 8) hex = hex.slice(0, 6);
    const n = hex.length === 6 ? parseInt(hex, 16) : NaN;
    if (isNaN(n)) return `rgba(255,154,68,${alpha})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/* ───── Status region: toasts, save state, export age ───── */

const TONE_VARS = { info: '--info', positive: '--live', warning: '--warn', danger: '--down' };
let statusRegionFallback = false;

function ensureStatusUI() {
    let region = el('statusRegion');
    if (!region) {
        // The markup normally owns this region and styles it; standing in for it
        // is only for the case where it is missing entirely.
        region = document.createElement('div');
        region.id = 'statusRegion';
        region.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:200;' +
            'display:flex;flex-direction:column;gap:8px;width:max-content;max-width:min(560px,92vw);';
        statusRegionFallback = true;
        document.body.appendChild(region);
    }
    region.setAttribute('aria-live', 'polite');
    if (!region.hasAttribute('role')) region.setAttribute('role', 'status');
    return region;
}

// Fatal, sticky problems go to the page's own error banner as well as a toast.
function setGlobalError(message, detail) {
    const banner = el('globalError');
    if (!banner) return;
    banner.textContent = '';
    if (!message) return;
    const strong = document.createElement('strong');
    strong.textContent = message;
    banner.appendChild(strong);
    if (detail) banner.appendChild(document.createTextNode(' ' + detail));
}

function flashStatus(msg, opts = {}) {
    console.log('[Cashflow Compass]', msg);
    const region = ensureStatusUI();
    const tone = TONE_VARS[opts.tone] ? opts.tone : 'info';
    const toast = document.createElement('div');
    toast.className = 'toast ' + tone;
    if (statusRegionFallback) {
        toast.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13.5px;border-radius:8px;' +
            'background:' + cssVar('--bg-raised', '#10142e') + ';color:' + cssVar('--text', '#e8eaf6') +
            ';border:1px solid ' + cssVar('--border', 'rgba(255,255,255,0.12)') +
            ';border-left:3px solid ' + cssVar(TONE_VARS[tone], '#5b8def') +
            ';box-shadow:' + cssVar('--shadow', '0 14px 40px rgba(0,0,0,0.45)') + ';';
    }
    const text = document.createElement('span');
    text.className = 'toast-msg';
    text.textContent = msg;
    toast.appendChild(text);
    (opts.actions || []).forEach(action => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ghost';
        btn.textContent = action.label;
        btn.onclick = () => { toast.remove(); action.onClick(); };
        toast.appendChild(btn);
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ghost icon';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss message');
    close.onclick = () => toast.remove();
    toast.appendChild(close);
    region.appendChild(toast);
    if (!opts.sticky) setTimeout(() => toast.remove(), opts.duration || 6000);
    return toast;
}

function showNotice(tone, msg, actions) {
    return flashStatus(msg, { tone, actions: actions || [], sticky: true });
}

function flashWithUndo(msg) {
    flashStatus(msg, { actions: [{ label: 'Undo', onClick: undoLast }], duration: 9000 });
}

function ensureStatusBar() {
    let bar = el('appStatusBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'appStatusBar';
        bar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        (document.querySelector('.header-controls') || document.querySelector('header.app-head') || document.body).appendChild(bar);
    }
    return bar;
}

function statusNode(ids, tag, className) {
    const found = pick(...ids);
    if (found) return found;
    const node = document.createElement(tag);
    node.id = ids[0];
    if (className) node.className = className;
    ensureStatusBar().appendChild(node);
    return node;
}

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', failed: 'Save failed', blocked: 'Not saving' };

function setSaveIndicator(status) {
    const node = statusNode(['saveState', 'saveIndicator'], 'span', 'muted-text');
    node.textContent = SAVE_LABELS[status] || '';
    node.title = status === 'blocked'
        ? 'The stored data could not be read, so nothing is being written over it.'
        : (status === 'failed' ? 'The browser refused the write — export a backup now.' : 'Stored in ' + storageMode);
    node.classList.toggle('danger-text', status === 'failed' || status === 'blocked');
}

function exportAgeText() {
    const iso = state && state.settings ? state.settings.lastExportAt : null;
    const ms = iso ? Date.now() - new Date(iso).getTime() : NaN;
    if (!isFinite(ms)) return 'Never exported';
    const days = Math.floor(ms / 86400000);
    return days <= 0 ? 'Exported today' : `Exported ${days}d ago`;
}

function updateStatusBar() {
    // Touched first so the fallback bar always reads save state → export age → restore.
    statusNode(['saveState', 'saveIndicator'], 'span', 'muted-text');
    statusNode(['exportAge', 'lastExportAge'], 'span', 'muted-text').textContent = exportAgeText();
    const restore = statusNode(['restoreBackupBtn'], 'button', 'ghost');
    if (!restore.dataset.ccWired) {
        restore.dataset.ccWired = '1';
        restore.type = 'button';
        if (!restore.textContent.trim()) restore.textContent = 'Restore last backup';
        restore.onclick = restoreBackup;
    }
    restore.classList.toggle('hidden', !readBackup());
}

let exportReminderShown = false;
function maybeRemindExport() {
    if (exportReminderShown || !state) return;
    if (state.accounts.length === 0 && state.transactions.length === 0) return;
    const iso = state.settings.lastExportAt;
    const days = iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity;
    if (!(days > 30)) return;
    exportReminderShown = true;
    showNotice('warning', isFinite(days)
        ? `Your last export was ${Math.floor(days)} days ago — a cleared browser would take this budget with it.`
        : 'This budget has never been exported — a cleared browser would take it with it.',
        [
            { label: 'Export Excel', onClick: exportExcel },
            { label: 'Export JSON', onClick: exportJson }
        ]);
}

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

// Sortable headers are real controls: keyboard reachable, and they announce the
// current sort through aria-sort. The cell keeps its implicit columnheader role,
// because aria-sort is only honoured there and because a header that stops being
// announced as a header costs more than it buys — so the control is a button
// inside the cell rather than a role stamped over it. The button is stripped back
// to the cell's own typography; the page's stylesheet never sees this markup.
const SORT_BUTTON_STYLE = 'background:none;border:0;margin:0;padding:0;font:inherit;color:inherit;' +
    'letter-spacing:inherit;text-transform:inherit;cursor:inherit;';

function sortableTh(table, column, label, extraClass) {
    const s = sortState[table];
    const ariaSort = s.column === column ? (s.direction === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th class="sortable${extraClass ? ' ' + extraClass : ''}" data-sort="${escapeHtml(column)}" aria-sort="${ariaSort}">` +
        `<button type="button" tabindex="0" style="${SORT_BUTTON_STYLE}" title="Sort by ${escapeHtml(label)}">${escapeHtml(label)}` +
        ` <span class="ind" aria-hidden="true">${sortIndicator(table, column)}</span></button></th>`;
}

function wireSortHeaders(row, table) {
    if (!row) return;
    row.querySelectorAll('[data-sort]').forEach(th => {
        const column = th.dataset.sort;
        const btn = th.querySelector('button');
        // A real button already answers Enter and Space by firing click, so a key
        // handler beside this one would sort twice for a single press.
        if (btn) btn.onclick = () => toggleSort(table, column);
    });
}

/* ───── Storage ─────
 * IndexedDB is the durable store; localStorage is kept as a synchronous mirror
 * so the first paint needs no async work and so the app still saves where
 * IndexedDB is unavailable (several browsers disable it on file:// origins).
 */

const BACKUP_KEY  = STORAGE_KEY + '.backup';
const CORRUPT_KEY = STORAGE_KEY + '.corrupt';
const SAVED_AT_KEY = STORAGE_KEY + '.savedAt';
const IDB_NAME = 'cashflow-compass';
const IDB_STORE = 'state';
const IDB_RECORD = 'current';

let idb = null;
let storageMode = 'localStorage';
let saveBlocked = false;      // set when stored data could not be read — never write over it
let damagedRaw = null;
let undoSnapshot = null;
let crossTabWarned = false;

function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { console.warn('Could not write ' + key, e); return false; }
}

function loadState() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        console.warn('Storage unavailable', e);
        showNotice('warning', 'Browser storage is unavailable here, so nothing will be kept when this tab closes. Export a file before you leave.');
        return defaultState();
    }
    if (!raw) return defaultState();
    return adoptRaw(raw, 'browser storage');
}

// Parse + migrate a stored string. Damaged or too-new data is preserved rather
// than replaced: the first mutating action must not overwrite the only copy.
function adoptRaw(raw, sourceLabel) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        lsSet(CORRUPT_KEY, raw);
        showNotice('danger', `The data in ${sourceLabel} was damaged and could not be read. The original text was kept under "${CORRUPT_KEY}" — starting from an empty budget.`);
        return defaultState();
    }
    try {
        return migrate(parsed);
    } catch (e) {
        saveBlocked = true;
        damagedRaw = raw;
        setGlobalError('The saved data could not be opened.', e.message + ' Nothing will be written over it until you choose what to do.');
        showNotice('danger', 'Could not open the saved data: ' + e.message + ' Nothing will be saved over it until you choose.', [
            { label: 'Download a copy', onClick: () => downloadText(raw, `cashflow-compass-recovered-${fmtDate(new Date())}.json`) },
            { label: 'Discard and start fresh', onClick: discardDamagedState }
        ]);
        setSaveIndicator('blocked');
        return defaultState();
    }
}

function discardDamagedState() {
    if (damagedRaw != null) lsSet(CORRUPT_KEY, damagedRaw);
    damagedRaw = null;
    saveBlocked = false;
    setGlobalError('');
    saveState();
    renderAll();
    flashStatus(`Started fresh. The unreadable copy is still under "${CORRUPT_KEY}".`);
}

let saveTimer = null;
let savePending = false;
let saveFailureNotice = null;

function saveState() {
    if (saveBlocked) {
        setSaveIndicator('blocked');
        return;
    }
    savePending = true;
    setSaveIndicator('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 200);
}

// Runs inside its own guard: a quota error here used to escape the timer where
// nothing could catch it.
function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!savePending || saveBlocked) return;
    savePending = false;
    let json;
    try {
        json = JSON.stringify(state);
    } catch (e) {
        setSaveIndicator('failed');
        showNotice('danger', 'Could not prepare the data for saving: ' + e.message);
        return;
    }
    const savedAt = new Date().toISOString();
    const mirrored = lsSet(STORAGE_KEY, json) && lsSet(SAVED_AT_KEY, savedAt);
    idbPut({ savedAt, json }).then(durable => {
        if (mirrored || durable) {
            setSaveIndicator('saved');
            if (saveFailureNotice) { saveFailureNotice.remove(); saveFailureNotice = null; }
            return;
        }
        setSaveIndicator('failed');
        // One standing notice, not one per keystroke.
        if (saveFailureNotice && saveFailureNotice.isConnected) return;
        saveFailureNotice = showNotice('danger', 'The browser refused to save — storage may be full or blocked. Export a file now so this work is not lost.', [
            { label: 'Export JSON', onClick: exportJson }
        ]);
    });
}

function openIdb() {
    return new Promise(resolve => {
        let req;
        try {
            if (typeof indexedDB === 'undefined') { resolve(null); return; }
            req = indexedDB.open(IDB_NAME, 1);
        } catch (e) { resolve(null); return; }
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
    });
}

function idbGet() {
    return new Promise(resolve => {
        if (!idb) { resolve(null); return; }
        try {
            const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_RECORD);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });
}

function idbPut(record) {
    return new Promise(resolve => {
        if (!idb) { resolve(false); return; }
        try {
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(record, IDB_RECORD);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
            tx.onabort = () => resolve(false);
        } catch (e) { resolve(false); }
    });
}

async function initDurableStorage() {
    if (navigator.storage && navigator.storage.persist) {
        try { await navigator.storage.persist(); } catch (e) { /* best effort only */ }
    }
    idb = await openIdb();
    if (!idb) return;
    storageMode = 'IndexedDB';
    const record = await idbGet();
    const localAt = lsGet(SAVED_AT_KEY);
    if (record && record.json && (!localAt || (record.savedAt || '') > localAt)) {
        const adopted = adoptRaw(record.json, 'this browser\'s durable storage');
        if (!saveBlocked) {
            state = adopted;
            renderAll();
            flashStatus('Loaded the most recent copy from durable storage.');
        }
        return;
    }
    if (!saveBlocked) {
        // First run under IndexedDB: carry the localStorage copy across.
        try { await idbPut({ savedAt: localAt || new Date().toISOString(), json: JSON.stringify(state) }); }
        catch (e) { console.warn('Could not seed IndexedDB', e); }
    }
    setSaveIndicator(saveBlocked ? 'blocked' : 'saved');
}

/* ───── Backups and single-level undo ───── */

function writeBackup(label) {
    try {
        lsSet(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), label, state }));
    } catch (e) {
        console.warn('Could not write a backup', e);
    }
}

function readBackup() {
    const raw = lsGet(BACKUP_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && parsed.state ? parsed : null;
    } catch (e) { return null; }
}

function restoreBackup() {
    const backup = readBackup();
    if (!backup) {
        flashStatus('There is no backup to restore.', { tone: 'warning' });
        return;
    }
    const when = backup.savedAt ? new Date(backup.savedAt).toLocaleString() : 'an earlier point';
    confirmModal('Restore the last backup?',
        `This replaces everything currently in the browser with the copy taken before ${backup.label || 'the last replace-all'} (${when}).`,
        () => {
            let restored;
            try {
                restored = migrate(coerceState(backup.state, []));
            } catch (e) {
                showNotice('danger', 'Could not restore that backup: ' + e.message);
                return;
            }
            snapshotForUndo('restoring the backup');
            state = restored;
            saveState();
            renderAll();
            flashWithUndo('Restored the backup.');
        },
        { confirmLabel: 'Restore' });
}

function snapshotForUndo(label) {
    try {
        undoSnapshot = { label, json: JSON.stringify(state) };
    } catch (e) {
        undoSnapshot = null;
    }
}

function undoLast() {
    if (!undoSnapshot) {
        flashStatus('There is nothing left to undo.', { tone: 'warning' });
        return;
    }
    const snap = undoSnapshot;
    undoSnapshot = null;
    try {
        state = migrate(JSON.parse(snap.json));
    } catch (e) {
        showNotice('danger', 'Could not undo: ' + e.message);
        return;
    }
    saveState();
    renderAll();
    flashStatus('Undid ' + snap.label + '.');
}

/* ───── Rendering: Accounts ───── */

function accountColumnCount() {
    return document.querySelectorAll('#accountsTable thead th').length || 5;
}

/* ───── Row quick-action menu ─────
 * One ⋯ button per row opens a popover listing that row's actions. The popover
 * is a single element on the body, positioned at the button, so the scrolling
 * table wrapper cannot clip it. Items are plain closures — nothing is cloned.
 */
let rowMenuAnchor = null;

function rowMenuButton(id, label) {
    return `<button type="button" class="icon row-menu-btn" data-row-menu="${escapeHtml(id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${escapeHtml(label)}" title="Actions">⋯</button>`;
}

function rowMenuPopover() {
    let pop = el('rowMenuPop');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'rowMenuPop';
    pop.className = 'row-menu-pop hidden';
    pop.setAttribute('role', 'menu');
    document.body.appendChild(pop);
    document.addEventListener('click', e => {
        if (rowMenuAnchor && !pop.contains(e.target) && e.target !== rowMenuAnchor) closeRowMenu();
    });
    document.addEventListener('keydown', e => {
        if (!rowMenuAnchor) return;
        const items = Array.from(pop.querySelectorAll('button'));
        const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRowMenu(true); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
        else if (e.key === 'Tab') closeRowMenu();
    });
    window.addEventListener('resize', () => closeRowMenu());
    document.addEventListener('scroll', () => closeRowMenu(), true);
    return pop;
}

function closeRowMenu(refocus) {
    const pop = el('rowMenuPop');
    if (!pop || !rowMenuAnchor) return;
    pop.classList.add('hidden');
    pop.innerHTML = '';
    const anchor = rowMenuAnchor;
    rowMenuAnchor = null;
    anchor.setAttribute('aria-expanded', 'false');
    if (refocus && document.contains(anchor)) anchor.focus();
}

function openRowMenu(anchor, items) {
    const pop = rowMenuPopover();
    if (rowMenuAnchor === anchor) { closeRowMenu(true); return; }
    closeRowMenu();
    pop.innerHTML = '';
    (items || []).forEach(item => {
        if (!item) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.className = 'row-menu-item' + (item.danger ? ' danger-item' : '');
        const ico = document.createElement('span');
        ico.className = 'row-menu-ico';
        ico.setAttribute('aria-hidden', 'true');
        ico.textContent = item.icon || '';
        btn.appendChild(ico);
        btn.appendChild(document.createTextNode(item.label));
        btn.onclick = () => { closeRowMenu(); item.onClick(); };
        pop.appendChild(btn);
    });
    rowMenuAnchor = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    pop.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(r.right - w, window.innerWidth - w - 8);
    if (left < 8) left = 8;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    const first = pop.querySelector('button');
    if (first) first.focus();
}

function wireRowMenus(tbody, itemsFor) {
    tbody.querySelectorAll('[data-row-menu]').forEach(b => {
        b.onclick = e => { e.stopPropagation(); openRowMenu(b, itemsFor(b.dataset.rowMenu)); };
    });
}

function renderAccounts() {
    const tbody = document.querySelector('#accountsTable tbody');
    if (!tbody) return;
    closeRowMenu();
    if (state.accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${accountColumnCount()}" class="empty">No accounts yet. Use ＋ Add account to set your starting balance.</td></tr>`;
    } else {
        tbody.innerHTML = state.accounts.map(a => {
            const apr = parseFloat(a.apr) || 0;
            const minPayment = parseFloat(a.minPayment) || 0;
            const isCredit = a.type === 'credit';
            const typeNote = isCredit && apr ? ` <span class="muted-text">${fmtPct(apr)} APR</span>` : '';
            const balanceNote = isCredit && minPayment
                ? ` <span class="muted-text">min ${escapeHtml(fmtMoney(minPayment))}</span>` : '';
            return `
            <tr>
                <td>${escapeHtml(a.name)}</td>
                <td><span class="tag">${escapeHtml(a.type)}</span>${typeNote}</td>
                <td class="num">${escapeHtml(fmtMoney(a.startingBalance))}${isCredit ? ' <span class="muted-text">owed</span>' : ''}${balanceNote}</td>
                <td>${escapeHtml(a.asOfDate || '')}</td>
                <td class="num row-actions">${rowMenuButton(a.id, a.name)}</td>
            </tr>
        `;
        }).join('');
    }
    const total = state.accounts.reduce((s, a) => s + (a.type === 'credit' ? -1 : 1) * (parseFloat(a.startingBalance) || 0), 0);
    setText('accountsMeta', state.accounts.length === 0 ? '' : `${state.accounts.length} account(s) · Net ${fmtMoney(total)}`);

    wireRowMenus(tbody, id => [
        { icon: '✎', label: 'Edit', onClick: () => editAccount(id) },
        { icon: '✕', label: 'Delete', danger: true, onClick: () => deleteAccount(id) }
    ]);
}

function acctAprInput()        { return pick('acctApr', 'acctAPR'); }
function acctMinPaymentInput() { return pick('acctMinPayment', 'acctMinPay'); }

function editAccount(id) {
    const a = state.accounts.find(x => x.id === id);
    if (!a) return;
    editingAcctId = id;
    setVal('acctName', a.name);
    setVal('acctType', a.type);
    setVal('acctBalance', a.startingBalance);
    setVal('acctAsOf', a.asOfDate);
    const apr = acctAprInput();
    if (apr) apr.value = a.apr || 0;
    const minPayment = acctMinPaymentInput();
    if (minPayment) minPayment.value = a.minPayment || 0;
    setText('acctSubmitBtn', 'Update Account');
    setHidden('acctCancelBtn', false);
    setText('acctEditingHint', 'Editing ' + a.name);
    scrollSectionIntoView('section-accounts');
}

function deleteAccount(id) {
    const acct = state.accounts.find(a => a.id === id);
    if (!acct) return;
    const affected = state.transactions.filter(t => t.accountId === id || t.fromAccountId === id);
    const others = state.accounts.filter(a => a.id !== id);
    const choices = others.map(a => ({ value: a.id, label: a.name }))
        .concat([{ value: '', label: 'Leave them without an account' }]);
    const body = affected.length
        ? `${acct.name} is used by ${affected.length} transaction(s). Choose where those should point instead.`
        : `${acct.name} is not used by any transaction.`;
    confirmModal('Delete account?', body, reassignTo => {
        snapshotForUndo('deleting ' + acct.name);
        affected.forEach(t => {
            if (t.accountId === id) t.accountId = reassignTo || '';
            if (t.fromAccountId === id) t.fromAccountId = reassignTo || null;
        });
        state.accounts = state.accounts.filter(a => a.id !== id);
        if (editingAcctId === id) cancelAccountEdit();
        saveState();
        renderAll();
        flashWithUndo(`Deleted ${acct.name}.`);
    }, affected.length
        ? { choices, choiceLabel: 'Move those transactions to', confirmLabel: 'Delete and reassign' }
        : { confirmLabel: 'Delete' });
}

on('accountForm', 'submit', e => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    const name = getVal('acctName').trim();
    const errors = [];
    if (!name) errors.push({ input: el('acctName'), message: 'Give the account a name — spaces alone will not do.' });
    if (errors.length) { showFormErrors(errors); return; }
    const data = {
        name,
        type: getVal('acctType', 'checking'),
        startingBalance: parseFloat(getVal('acctBalance')) || 0,
        asOfDate: getVal('acctAsOf'),
        apr: Math.max(0, parseFloat(acctAprInput() ? acctAprInput().value : 0) || 0),
        minPayment: Math.max(0, parseFloat(acctMinPaymentInput() ? acctMinPaymentInput().value : 0) || 0)
    };
    if (editingAcctId) {
        const a = state.accounts.find(x => x.id === editingAcctId);
        if (a) Object.assign(a, data);
        editingAcctId = null;
    } else {
        state.accounts.push({ id: uid('acct'), ...data });
    }
    form.reset();
    resetAccountForm();
    saveState();
    renderAll();
});

function resetAccountForm() {
    setVal('acctAsOf', fmtDate(new Date()));
    const apr = acctAprInput();
    if (apr) apr.value = 0;
    const minPayment = acctMinPaymentInput();
    if (minPayment) minPayment.value = 0;
    setText('acctSubmitBtn', 'Add Account');
    setHidden('acctCancelBtn', true);
    setText('acctEditingHint', '');
}

function cancelAccountEdit() {
    editingAcctId = null;
    const form = el('accountForm');
    if (form) { form.reset(); clearFieldErrors(form); }
    resetAccountForm();
}

on('acctCancelBtn', 'click', cancelAccountEdit);

/* ───── Rendering: Categories ───── */

function renderCategories() {
    const head = el('categoriesHeaderRow');
    if (head) {
        head.innerHTML =
            '<th>Color</th>' +
            sortableTh('categories', 'name', 'Name') +
            sortableTh('categories', 'kind', 'Kind') +
            '<th class="num">Actions</th>';
        wireSortHeaders(head, 'categories');
    }

    const sorted = applySort(state.categories, sortState.categories, {
        name: c => c.name,
        kind: c => KIND_LABELS[c.kind] || c.kind
    });

    const tbody = document.querySelector('#categoriesTable tbody');
    if (!tbody) return;
    closeRowMenu();
    const usage = {};
    state.transactions.forEach(t => { usage[t.categoryId] = (usage[t.categoryId] || 0) + 1; });
    const canMove = state.categories.length > 1;
    tbody.innerHTML = sorted.map(c => `
        <tr>
            <td><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${safeColor(c.color)};vertical-align:middle;"></span></td>
            <td>${escapeHtml(c.name)}${usage[c.id] ? ` <span class="muted-text">${usage[c.id]} in use</span>` : ''}</td>
            <td><span class="tag">${escapeHtml(KIND_LABELS[c.kind] || c.kind)}</span></td>
            <td class="num row-actions">${rowMenuButton(c.id, c.name)}</td>
        </tr>
    `).join('');
    wireRowMenus(tbody, id => {
        const items = [{ icon: '✎', label: 'Edit', onClick: () => editCategory(id) }];
        if (usage[id] && canMove) {
            items.push({ icon: '⇄', label: `Move its ${usage[id]} transaction(s) elsewhere`, onClick: () => reassignCategory(id) });
        }
        items.push({ icon: '✕', label: 'Delete', danger: true, onClick: () => deleteCategory(id) });
        return items;
    });
}

// Moving a category's transactions used to be reachable only by deleting the
// category, which forced a destination on someone who only wanted to re-file.
function reassignCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    const moving = state.transactions.filter(t => t.categoryId === id);
    if (!moving.length) {
        flashStatus(`${cat.name} has no transactions to move.`, { tone: 'warning' });
        return;
    }
    const choices = state.categories.filter(c => c.id !== id)
        .map(c => ({ value: c.id, label: `${c.name} — ${KIND_LABELS[c.kind] || c.kind}` }));
    if (!choices.length) {
        showNotice('warning', `${cat.name} is the only category, so there is nowhere to move its transactions.`);
        return;
    }
    confirmModal('Move these transactions?',
        `${moving.length} transaction(s) filed under ${cat.name} will be re-filed. ${cat.name} itself is kept.`,
        destination => {
            const to = state.categories.find(c => c.id === destination);
            if (!to) return;
            snapshotForUndo(`moving ${moving.length} transaction(s) out of ${cat.name}`);
            moving.forEach(t => { t.categoryId = to.id; });
            saveState();
            renderAll();
            flashWithUndo(`Moved ${moving.length} transaction(s) from ${cat.name} to ${to.name}.`);
        },
        { choices, choiceLabel: 'Move them to', confirmLabel: 'Move', confirmClass: 'primary' });
}

function editCategory(id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    editingCatId = id;
    setVal('catName', c.name);
    // A stored kind the form cannot show is left alone rather than replaced by
    // whatever the control happens to be displaying.
    if (selectHasOption('catKind', c.kind)) {
        setVal('catKind', c.kind);
    } else {
        showNotice('warning', `${c.name} is filed as ${KIND_LABELS[c.kind] || c.kind}, a kind this form does not offer. Its kind is left as it is when you save.`);
    }
    setVal('catColor', safeColor(c.color));
    setText('catSubmitBtn', 'Update Category');
    setHidden('catCancelBtn', false);
}

function deleteCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    const used = state.transactions.filter(t => t.categoryId === id);
    const others = state.categories.filter(c => c.id !== id);
    if (used.length && others.length === 0) {
        showNotice('warning', `${cat.name} is the only category left and ${used.length} transaction(s) use it. Add another category first.`);
        return;
    }
    const choices = others.map(c => ({ value: c.id, label: `${c.name} — ${KIND_LABELS[c.kind] || c.kind}` }));
    const body = used.length
        ? `${cat.name} is used by ${used.length} transaction(s). Choose where to move them.`
        : `${cat.name} is not used by any transaction.`;
    confirmModal('Delete category?', body, reassignTo => {
        snapshotForUndo('deleting ' + cat.name);
        if (used.length) used.forEach(t => { t.categoryId = reassignTo; });
        state.categories = state.categories.filter(c => c.id !== id);
        if (editingCatId === id) cancelCategoryEdit();
        saveState();
        renderAll();
        flashWithUndo(`Deleted ${cat.name}.`);
    }, used.length
        ? { choices, choiceLabel: 'Move those transactions to', confirmLabel: 'Delete and reassign' }
        : { confirmLabel: 'Delete' });
}

on('categoryForm', 'submit', e => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    const name = getVal('catName').trim();
    if (!name) {
        showFormErrors([{ input: el('catName'), message: 'Give the category a name — spaces alone will not do.' }]);
        return;
    }
    const editing = editingCatId ? state.categories.find(x => x.id === editingCatId) : null;
    // If the select cannot represent this category's kind then whatever it shows
    // was never a choice about this category, so the stored kind stands.
    const keepKind = editing && !selectHasOption('catKind', editing.kind);
    const data = {
        name,
        kind: keepKind ? editing.kind : getVal('catKind', 'variable'),
        color: safeColor(getVal('catColor'), '#ff9a44')
    };
    if (editingCatId) {
        if (editing) Object.assign(editing, data);
        editingCatId = null;
    } else {
        state.categories.push({ id: uid('cat'), ...data });
    }
    form.reset();
    resetCategoryForm();
    saveState();
    renderAll();
});

function resetCategoryForm() {
    setVal('catColor', '#ff9a44');
    setText('catSubmitBtn', 'Add Category');
    setHidden('catCancelBtn', true);
}

function cancelCategoryEdit() {
    editingCatId = null;
    const form = el('categoryForm');
    if (form) { form.reset(); clearFieldErrors(form); }
    resetCategoryForm();
}

on('catCancelBtn', 'click', cancelCategoryEdit);

/* ───── Collapsible sections ───── */

// Every section header that advertises aria-expanded has to actually collapse,
// or the promise is a lie to anything reading the page programmatically.
const COLLAPSIBLE_TOGGLES = [
    'catToggle', 'txToggle', 'forecastToggle', 'chartsToggle', 'balancesToggle',
    'calendarToggle', 'checkinToggle', 'varianceToggle', 'debtToggle', 'goalsToggle',
    'scenariosToggle', 'portabilityToggle'
];

// The glyph gets its own element because the button's accessible name is a
// sibling of it: writing the arrow into the button's text content would delete
// that name and leave a control announced as nothing but an arrow.
function toggleGlyph(btn) {
    let glyph = btn.querySelector('.toggle-glyph');
    if (!glyph) {
        glyph = document.createElement('span');
        glyph.className = 'toggle-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        // A loose arrow character sitting directly in the button would be read
        // out as part of the name and would double up with the one below.
        Array.prototype.slice.call(btn.childNodes)
            .filter(node => node.nodeType === 3)
            .forEach(node => btn.removeChild(node));
        btn.appendChild(glyph);
    }
    return glyph;
}

function setupCollapsible(toggleId, bodyId) {
    const btn = el(toggleId);
    if (!btn) return;
    const body = el(bodyId || btn.getAttribute('aria-controls'));
    if (!body) return;
    const glyph = toggleGlyph(btn);
    const paint = collapsed => {
        glyph.textContent = collapsed ? '▸' : '▾';
        btn.setAttribute('aria-expanded', String(!collapsed));
    };
    paint(body.classList.contains('hidden'));
    btn.onclick = () => paint(body.classList.toggle('hidden'));
}

COLLAPSIBLE_TOGGLES.forEach(id => setupCollapsible(id));

/* ───── Rendering: Transactions ───── */

function refreshSelects() {
    const catSel = el('txCategory');
    const filtCat = el('txFilterCategory');
    const acctSel = el('txAccount');
    const fromAcctSel = el('txFromAccount');

    const catOpts = state.categories.map(c =>
        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} — ${escapeHtml(KIND_LABELS[c.kind] || c.kind)}</option>`).join('');
    if (catSel) {
        const keep = catSel.value;
        catSel.innerHTML = catOpts;
        if (keep) catSel.value = keep;
    }
    if (filtCat) {
        const keep = filtCat.value;
        filtCat.innerHTML = '<option value="">All</option>' + state.categories.map(c =>
            `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
        if (keep && state.categories.some(c => c.id === keep)) filtCat.value = keep;
    }

    const acctOpts = state.accounts.map(a =>
        `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    if (acctSel) {
        const keep = acctSel.value;
        acctSel.innerHTML = acctOpts || '<option value="">— Add an account first —</option>';
        if (keep) acctSel.value = keep;
    }
    if (fromAcctSel) {
        const keep = fromAcctSel.value;
        fromAcctSel.innerHTML = acctOpts;
        if (keep) fromAcctSel.value = keep;
    }
}

/* ───── Form validation ───── */

// The markup carries a <span class="field-error" id="<field>Error" role="alert">
// beside each input; these are emptied rather than removed.
function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(node => { node.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
}

function fieldErrorSlot(input) {
    const existing = el(input.id + 'Error');
    if (existing) return existing;
    const note = document.createElement('span');
    note.className = 'field-error danger-text';
    note.style.cssText = 'display:block;margin-top:4px;font-size:12px;';
    note.setAttribute('role', 'alert');
    note.id = input.id + 'Error';
    (input.parentElement || input).appendChild(note);
    return note;
}

function showFormErrors(errors) {
    errors.forEach(({ input, message }, i) => {
        if (!input) return;
        input.setAttribute('aria-invalid', 'true');
        fieldErrorSlot(input).textContent = message;
        if (i === 0) input.focus();
    });
}

/* ───── Bulk selection ─────
 * Selection is UI state, not data: it lives here, survives a re-render, and is
 * pruned to rows that still exist.
 */
const txSelection = new Set();

function selectedTransactions() {
    return state.transactions.filter(t => txSelection.has(t.id));
}

function updateTxBulkBar() {
    const ids = new Set(state.transactions.map(t => t.id));
    Array.from(txSelection).forEach(id => { if (!ids.has(id)) txSelection.delete(id); });
    const n = txSelection.size;
    setHidden('txBulkBar', n === 0);
    setText('txBulkCount', `${n} selected`);
    const all = el('txSelectAll');
    if (all) {
        const boxes = Array.from(document.querySelectorAll('#txTable tbody [data-select]'));
        const checked = boxes.filter(b => b.checked).length;
        all.checked = boxes.length > 0 && checked === boxes.length;
        all.indeterminate = checked > 0 && checked < boxes.length;
    }
    document.querySelectorAll('#txTable tbody tr[data-tx-row]').forEach(tr => {
        tr.classList.toggle('selected', txSelection.has(tr.dataset.txRow));
    });
}

function bulkSetPaused(paused) {
    const list = selectedTransactions();
    if (!list.length) return;
    snapshotForUndo(`${paused ? 'pausing' : 'resuming'} ${list.length} transaction(s)`);
    list.forEach(t => { t.paused = paused; });
    saveState();
    renderAll();
    flashWithUndo(`${paused ? 'Paused' : 'Resumed'} ${list.length} transaction(s).`);
}

function bulkDelete() {
    const list = selectedTransactions();
    if (!list.length) return;
    confirmModal(`Delete ${list.length} transaction(s)?`,
        'They will be removed from the forecast. Undo is offered afterwards.', () => {
        snapshotForUndo(`deleting ${list.length} transaction(s)`);
        const ids = new Set(list.map(t => t.id));
        state.transactions = state.transactions.filter(t => !ids.has(t.id));
        if (editingTxId && ids.has(editingTxId)) cancelTxEdit();
        txSelection.clear();
        saveState();
        renderAll();
        flashWithUndo(`Deleted ${list.length} transaction(s).`);
    }, { confirmLabel: 'Delete' });
}

on('txBulkPause',  'click', () => bulkSetPaused(true));
on('txBulkResume', 'click', () => bulkSetPaused(false));
on('txBulkDelete', 'click', bulkDelete);
on('txBulkClear',  'click', () => { txSelection.clear(); renderTransactions(); });

/* ───── Inline editing ─────
 * Name and amount can be changed in the table itself. Commit on Enter or blur,
 * abandon on Escape; every commit is one undo step.
 */
function startInlineEdit(cell) {
    const id = cell.dataset.tx;
    const field = cell.dataset.inline;
    const t = state.transactions.find(x => x.id === id);
    if (!t || cell.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = field === 'amount' ? 'number' : 'text';
    if (field === 'amount') { input.min = '0.01'; input.step = '0.01'; }
    input.value = field === 'amount' ? t.amount : t.name;
    input.className = 'inline-edit';
    input.setAttribute('aria-label', (field === 'amount' ? 'Amount for ' : 'Name for ') + t.name);
    cell.classList.add('editing');
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const finish = commit => {
        if (done) return;
        done = true;
        if (commit) {
            const raw = input.value.trim();
            if (field === 'amount') {
                const n = parseFloat(raw);
                if (!(n > 0)) { flashStatus('Enter an amount above zero.', { tone: 'warning' }); renderTransactions(); return; }
                const rounded = Math.round(n * 100) / 100;
                if (rounded !== parseFloat(t.amount)) {
                    snapshotForUndo('changing the amount of ' + t.name);
                    t.amount = rounded;
                    saveState();
                    renderAll();
                    flashWithUndo(`${t.name} is now ${fmtMoney(t.amount)}.`);
                    return;
                }
            } else {
                if (!raw) { flashStatus('A transaction needs a name.', { tone: 'warning' }); renderTransactions(); return; }
                if (raw !== t.name) {
                    const old = t.name;
                    snapshotForUndo('renaming ' + old);
                    t.name = raw;
                    saveState();
                    renderAll();
                    flashWithUndo(`Renamed ${old} to ${raw}.`);
                    return;
                }
            }
        }
        renderTransactions();
    };
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
}

function wireInlineEdits(tbody) {
    tbody.querySelectorAll('td[data-inline]').forEach(cell => {
        cell.ondblclick = () => startInlineEdit(cell);
        cell.onkeydown = e => {
            if (e.target !== cell) return;
            if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startInlineEdit(cell); }
        };
    });
}

function renderTransactions() {
    closeRowMenu();
    const head = el('txHeaderRow');
    if (head) {
        head.innerHTML =
            '<th class="sel"><input type="checkbox" id="txSelectAll" aria-label="Select every transaction shown"></th>' +
            sortableTh('transactions', 'name', 'Name') +
            '<th>Kind</th>' +
            '<th>Category</th>' +
            '<th>Account</th>' +
            sortableTh('transactions', 'amount', 'Amount', 'num') +
            '<th>Frequency</th>' +
            sortableTh('transactions', 'start', 'Start') +
            '<th>End</th>' +
            '<th>Next</th>' +
            sortableTh('transactions', 'annualized', 'Annualized', 'num') +
            '<th>Tags</th>' +
            '<th class="num">Actions</th>';
        wireSortHeaders(head, 'transactions');
    }

    const tbody = document.querySelector('#txTable tbody');
    if (!tbody) return;
    const search = getVal('txSearch').toLowerCase().trim();
    const fk = getVal('txFilterKind');
    const fc = getVal('txFilterCategory');

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

    const nextById = new Map();
    if (currentForecast && Array.isArray(currentForecast.txData)) {
        currentForecast.txData.forEach(d => { if (d && d.tx) nextById.set(d.tx.id, d.next); });
    }

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" class="empty">No transactions${state.transactions.length ? ' match the filter.' : ' yet. Use ＋ Add transaction to start the plan.'}</td></tr>`;
    } else {
        tbody.innerHTML = sorted.map(t => {
            const cat = state.categories.find(c => c.id === t.categoryId);
            const acct = state.accounts.find(a => a.id === t.accountId);
            const ann = annualizedCost(t);
            const next = toDate(nextById.get(t.id));
            const kindClass = ['income', 'expense', 'transfer'].includes(t.kind) ? t.kind : '';
            return `
                <tr data-tx-row="${escapeHtml(t.id)}"${t.paused ? ' class="paused-row"' : ''}>
                    <td class="sel"><input type="checkbox" data-select="${escapeHtml(t.id)}" aria-label="Select ${escapeHtml(t.name)}"${txSelection.has(t.id) ? ' checked' : ''}></td>
                    <td class="editable" data-inline="name" data-tx="${escapeHtml(t.id)}" tabindex="0" title="Double-click or press Enter to rename">${escapeHtml(t.name)}${t.paused ? ' <span class="tag paused">paused</span>' : ''}</td>
                    <td><span class="tag ${kindClass}">${escapeHtml(t.kind)}</span></td>
                    <td>${cat ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor(cat.color)};margin-right:6px;vertical-align:middle;"></span>${escapeHtml(cat.name)}` : '—'}</td>
                    <td>${acct ? escapeHtml(acct.name) : '—'}</td>
                    <td class="num editable" data-inline="amount" data-tx="${escapeHtml(t.id)}" tabindex="0" title="Double-click or press Enter to change the amount">${escapeHtml(fmtMoney(t.amount))}</td>
                    <td>${escapeHtml(FREQUENCY_LABELS[t.frequency] || t.frequency)}${t.frequency === 'custom' ? ` (${escapeHtml(t.customN)} ${escapeHtml(t.customUnit)})` : ''}${t.escalation ? ` · +${escapeHtml(t.escalation)}%/yr` : ''}</td>
                    <td>${escapeHtml(t.startDate || '')}</td>
                    <td>${escapeHtml(t.endDate || '')}</td>
                    <td>${next ? escapeHtml(fmtDate(next)) : '<span class="muted-text">—</span>'}</td>
                    <td class="num">${escapeHtml(fmtMoney(ann))}</td>
                    <td>${(t.tags || []).map(tg => `<span class="tag">${escapeHtml(tg)}</span>`).join('')}</td>
                    <td class="num row-actions">${rowMenuButton(t.id, t.name)}</td>
                </tr>
            `;
        }).join('');
    }
    setText('txMeta', state.transactions.length === 0 ? '' : `${filtered.length} of ${state.transactions.length} shown`);

    wireRowMenus(tbody, id => {
        const t = state.transactions.find(x => x.id === id);
        if (!t) return [];
        return [
            { icon: '✎', label: 'Edit', onClick: () => editTransaction(id) },
            { icon: t.paused ? '▶' : '⏸', label: t.paused ? 'Resume' : 'Pause', onClick: () => togglePause(id) },
            { icon: '⎘', label: 'Duplicate', onClick: () => cloneTransaction(id) },
            { icon: '✕', label: 'Delete', danger: true, onClick: () => deleteTransaction(id) }
        ];
    });
    wireInlineEdits(tbody);
    tbody.querySelectorAll('[data-select]').forEach(box => {
        box.onchange = () => {
            if (box.checked) txSelection.add(box.dataset.select); else txSelection.delete(box.dataset.select);
            updateTxBulkBar();
        };
    });
    const all = el('txSelectAll');
    if (all) {
        all.onchange = () => {
            sorted.forEach(t => { if (all.checked) txSelection.add(t.id); else txSelection.delete(t.id); });
            renderTransactions();
        };
    }
    updateTxBulkBar();
}

function editTransaction(id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;
    editingTxId = id;
    setVal('txName', t.name);
    setVal('txKind', t.kind);
    setVal('txAmount', t.amount);
    setVal('txCategory', t.categoryId || '');
    setVal('txAccount', t.accountId || '');
    setVal('txFromAccount', t.fromAccountId || '');
    setVal('txFrequency', t.frequency);
    setVal('txCustomN', t.customN || 1);
    setVal('txCustomUnit', t.customUnit || 'days');
    setVal('txStart', t.startDate || '');
    setVal('txEnd', t.endDate || '');
    setVal('txEscalation', t.escalation || 0);
    setVal('txTags', (t.tags || []).join(', '));
    setVal('txNotes', t.notes || '');
    setText('txSubmitBtn', 'Update Transaction');
    setHidden('txCancelBtn', false);
    setText('txEditingHint', 'Editing ' + t.name);
    onKindOrFreqChange();
    scrollSectionIntoView('section-transactions');
}

function deleteTransaction(id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t) return;
    confirmModal('Delete transaction?', `${t.name} will be removed from the forecast.`, () => {
        snapshotForUndo('deleting ' + t.name);
        state.transactions = state.transactions.filter(x => x.id !== id);
        if (editingTxId === id) cancelTxEdit();
        saveState();
        renderAll();
        flashWithUndo(`Deleted ${t.name}.`);
    }, { confirmLabel: 'Delete' });
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
    const kind = getVal('txKind', 'expense');
    const freq = getVal('txFrequency', 'monthly');
    const hasAccounts = !state || state.accounts.length > 0;
    setHidden('txFromAccountWrap', kind !== 'transfer');
    setHidden('txCustomWrap', freq !== 'custom');
    // The custom-N field lives inside a container hidden with display:none, so a
    // failing min="1" there would block submit with a message nothing can show.
    const customN = el('txCustomN');
    if (customN) {
        const off = freq !== 'custom';
        customN.disabled = off || !hasAccounts;
        if (off) customN.value = '';
        else if (!customN.value) customN.value = 1;
    }
    const fromAccount = el('txFromAccount');
    if (fromAccount) fromAccount.disabled = kind !== 'transfer' || !hasAccounts;
}

// With no account there is nowhere for a transaction to land, so say so up
// front instead of letting the form look live and fail on submit.
function updateTxFormAvailability() {
    const form = el('txForm');
    if (!form) return;
    const hasAccounts = state.accounts.length > 0;
    form.querySelectorAll('input, select, textarea, button').forEach(node => { node.disabled = !hasAccounts; });
    let notice = el('txFormNotice');
    if (!notice) {
        notice = document.createElement('p');
        notice.id = 'txFormNotice';
        notice.className = 'muted-text';
        notice.style.cssText = 'margin:0 0 10px;';
        form.parentElement.insertBefore(notice, form);
    }
    notice.textContent = hasAccounts ? '' : 'Add an account above first — a transaction needs somewhere to land.';
    notice.classList.toggle('hidden', hasAccounts);
    onKindOrFreqChange();
}

on('txKind', 'change', onKindOrFreqChange);
on('txFrequency', 'change', onKindOrFreqChange);

// Keeps the date picker itself from offering an end before the start.
function syncEndDateBound() {
    const end = el('txEnd');
    if (end) end.min = getVal('txStart');
}
on('txStart', 'change', syncEndDateBound);
on('txStart', 'input', syncEndDateBound);

on('txForm', 'submit', e => {
    e.preventDefault();
    const form = e.target;
    clearFieldErrors(form);
    if (state.accounts.length === 0) {
        showNotice('warning', 'Add at least one account first so transactions have somewhere to land.');
        return;
    }
    const name = getVal('txName').trim();
    const amount = parseFloat(getVal('txAmount'));
    const startDate = getVal('txStart');
    const endDate = getVal('txEnd') || null;
    const errors = [];
    if (!name) errors.push({ input: el('txName'), message: 'Give the transaction a name — spaces alone will not do.' });
    // The markup asks for min="0.01", but the rule belongs here too: a figure
    // that reaches this handler by any other route has to meet it as well.
    if (!isFinite(amount) || amount <= 0) {
        errors.push({ input: el('txAmount'), message: 'Give the transaction an amount above zero — whether it adds or subtracts is decided by the kind, so enter it as a positive figure.' });
    }
    if (!startDate) errors.push({ input: el('txStart'), message: 'A start date is needed to place this on the calendar.' });
    if (startDate && endDate && endDate < startDate) {
        errors.push({ input: el('txEnd'), message: 'The end date is before the start date — nothing would ever occur.' });
    }
    if (errors.length) { showFormErrors(errors); return; }

    const escalation = clampEscalation(parseFloat(getVal('txEscalation')) || 0);
    const data = {
        name,
        kind: getVal('txKind', 'expense'),
        amount,
        categoryId: getVal('txCategory'),
        accountId: getVal('txAccount'),
        fromAccountId: getVal('txFromAccount') || null,
        frequency: getVal('txFrequency', 'monthly'),
        customN: Math.max(1, parseInt(getVal('txCustomN')) || 1),
        customUnit: getVal('txCustomUnit', 'days'),
        startDate,
        endDate,
        escalation,
        tags: getVal('txTags').split(',').map(s => s.trim()).filter(Boolean),
        notes: getVal('txNotes').trim(),
        paused: false
    };
    if (editingTxId) {
        const t = state.transactions.find(x => x.id === editingTxId);
        if (t) Object.assign(t, data, { paused: t.paused });
        editingTxId = null;
    } else {
        state.transactions.push({ id: uid('tx'), ...data });
    }
    form.reset();
    resetTxForm();
    saveState();
    renderAll();
});

function resetTxForm() {
    setVal('txStart', fmtDate(new Date()));
    setText('txSubmitBtn', 'Add Transaction');
    setHidden('txCancelBtn', true);
    setText('txEditingHint', '');
    onKindOrFreqChange();
}

function cancelTxEdit() {
    editingTxId = null;
    const form = el('txForm');
    if (form) { form.reset(); clearFieldErrors(form); }
    resetTxForm();
}

on('txCancelBtn', 'click', cancelTxEdit);

['txSearch', 'txFilterKind', 'txFilterCategory'].forEach(id => {
    on(id, 'input', renderTransactions);
    on(id, 'change', renderTransactions);
});

/* ───── Forecast grid ───── */

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value) ? null : value;
    const d = typeof value === 'string' ? parseDate(value.slice(0, 10)) : new Date(value);
    return d && !isNaN(d) ? d : null;
}

// forecast.orphans / forecast.mismatches carry whatever the engine found; accept
// a list or a map of lists and describe each entry without trusting its shape.
const ISSUE_FIELD_LABELS = { categoryId: 'category', accountId: 'account', fromAccountId: 'source account' };

function describeIssue(item) {
    if (item == null) return '';
    if (typeof item !== 'object') return String(item);
    const who = (item.tx && item.tx.name) || item.name || item.txName || item.label || item.id || 'An item';
    if (item.field) {
        const what = ISSUE_FIELD_LABELS[item.field] || item.field;
        return `${who}: the ${what} it points at no longer exists${item.value ? ` (${item.value})` : ''}`;
    }
    if (item.categoryKind) {
        const catKind = KIND_LABELS[item.categoryKind] || item.categoryKind;
        return `${who}: filed as ${item.txKind} under ${item.categoryName || 'a category'}, which is ${catKind}`;
    }
    const why = item.reason || item.message || item.detail || item.type || item.kind || '';
    return [who, why].filter(Boolean).join(' — ');
}

function issueList(value) {
    if (!value) return [];
    let items;
    if (Array.isArray(value)) items = value;
    else if (typeof value === 'object') items = Object.keys(value).reduce((acc, k) => acc.concat(Array.isArray(value[k]) ? value[k] : [value[k]]), []);
    else items = [value];
    return items.map(describeIssue).filter(Boolean);
}

function ensureWarningStrip() {
    let strip = pick('dataWarnings', 'forecastWarnings');
    if (!strip) {
        const host = el('forecastBody') || el('section-forecast');
        if (!host) return null;
        strip = document.createElement('div');
        strip.id = 'forecastWarnings';
        strip.style.cssText = 'margin:0 0 12px;padding:10px 14px;border-radius:8px;font-size:13px;' +
            'background:' + cssVar('--bg-raised', '#10142e') + ';border:1px solid ' + cssVar('--border', 'rgba(255,255,255,0.09)') +
            ';border-left:3px solid ' + cssVar('--warn', '#ffc24b') + ';';
        host.insertBefore(strip, host.firstChild);
    }
    return strip;
}

// Notes from the last import outlive their toast: a rejected currency code or a
// zero-amount row is a standing data-quality problem, not a passing message.
let lastImportIssues = [];

function setImportIssues(issues) {
    lastImportIssues = Array.isArray(issues) ? issues.slice() : [];
}

// A row saved with no amount is not an error — it may be a placeholder, or it
// may predate the checks — but it is invisible in the forecast either way, so
// it is named here rather than left to be discovered.
function savedTransactions() {
    return (state && Array.isArray(state.transactions)) ? state.transactions : [];
}

function rowLabel(t) {
    return String((t && t.name) || '').trim() || 'An unnamed item';
}

function zeroAmountNotes() {
    return savedTransactions()
        .filter(t => t && toNum(t.amount, 0) === 0)
        .map(t => `${rowLabel(t)} is set to zero, so it sits in the plan without moving the forecast.`);
}

// A negative can no longer be imported, but one saved before that was true is
// still read as its magnitude by the forecast, so the two disagree on screen.
function signedAmountNotes() {
    return savedTransactions()
        .filter(t => t && toNum(t.amount, 0) < 0)
        .map(t => `${rowLabel(t)} is stored as ${toNum(t.amount, 0)}, while the forecast uses ${Math.abs(toNum(t.amount, 0))} and takes its direction from the kind. Re-enter it as a positive figure to make the two agree.`);
}

// The strip is emptied when there is nothing to say — the stylesheet hides it
// with :empty, so leaving stale nodes behind would leave an empty box on screen.
function renderForecastWarnings(forecast) {
    const strip = ensureWarningStrip();
    if (!strip) return;
    strip.textContent = '';
    const groups = [
        { heading: 'Pointing at something that no longer exists', items: issueList(forecast.orphans) },
        { heading: 'Filed against a category that contradicts them', items: issueList(forecast.mismatches) },
        { heading: 'Carrying no amount', items: zeroAmountNotes() },
        { heading: 'Stored with a negative amount', items: signedAmountNotes() },
        { heading: 'Noted while reading the imported file', items: lastImportIssues.slice(), dismissible: true }
    ].filter(g => g.items.length);
    if (!groups.length) return;
    groups.forEach(group => {
        const heading = document.createElement('strong');
        heading.textContent = `${group.items.length} item(s) — ${group.heading}`;
        const list = document.createElement('ul');
        group.items.slice(0, 8).forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
        if (group.items.length > 8) {
            const li = document.createElement('li');
            li.textContent = `…and ${group.items.length - 8} more`;
            list.appendChild(li);
        }
        strip.append(heading, list);
        // Import notes describe a moment rather than the current data, so they
        // need a way out; the forecast's own findings come back on every render.
        if (group.dismissible) {
            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.className = 'ghost';
            dismiss.textContent = 'Dismiss these import notes';
            dismiss.onclick = () => { setImportIssues([]); renderForecastWarnings(forecast); };
            strip.appendChild(dismiss);
        }
    });
}

function renderForecast(forecast) {
    const { monthList, txData, monthlyIncome, monthlyExpense, monthlyNet, runningBalance } = forecast;
    const months = monthList.length;
    setText('forecastTitle', `${months}-Month Forecast (${horizonRangeLabel(months)})`);
    renderForecastWarnings(forecast);

    const head = el('forecastHeaderRow');
    if (head) {
        head.innerHTML = '<th>Item</th>' + monthList.map(m => `<th class="num">${escapeHtml(m.label)}</th>`).join('') + '<th class="num">Total</th>';
    }

    const tbody = document.querySelector('#forecastTable tbody');
    if (!tbody) return;

    // Group transactions by category kind
    const groups = {};
    const dataById = new Map(txData.map(d => [d.tx.id, d]));
    state.transactions.forEach(t => {
        const data = dataById.get(t.id);
        if (!data) return;
        // A transfer that nets to zero every month is noise in a cashflow grid.
        if (t.kind === 'transfer' && data.byMonth.every(n => n === 0)) return;
        const cat = state.categories.find(c => c.id === t.categoryId);
        const kind = cat ? cat.kind : 'other';
        if (!groups[kind]) groups[kind] = [];
        groups[kind].push(data);
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

    const groupOrder = ['income', 'fixed', 'variable', 'discretionary', 'savings', 'debt', 'tax', 'goal'];

    const groupRows = (label, rows) => {
        let out = `<tr class="group-row"><td colspan="${months + 2}">${escapeHtml(label)}</td></tr>`;
        rows.forEach(({ tx, byMonth }) => {
            const total = byMonth.reduce((s, n) => s + n, 0);
            out += `<tr><td title="${escapeHtml(tx.notes || '')}">${escapeHtml(tx.name)}${tx.paused ? ' <span class="tag paused">paused</span>' : ''}</td>`;
            byMonth.forEach(amt => {
                if (amt === 0) out += '<td class="num muted-text">—</td>';
                else out += `<td class="num ${amt > 0 ? 'positive' : 'negative'}">${escapeHtml(fmtMoney(amt))}</td>`;
            });
            out += `<td class="num ${total > 0 ? 'positive' : (total < 0 ? 'negative' : '')}">${escapeHtml(fmtMoney(total))}</td></tr>`;
        });
        return out;
    };

    let html = '';
    groupOrder.forEach(kind => {
        if (!groups[kind] || groups[kind].length === 0) return;
        html += groupRows(KIND_LABELS[kind] || kind, groups[kind]);
    });

    // Any category kind the grid does not know about still has to appear, or it
    // would vanish from the rows while counting in the totals below.
    const leftovers = Object.keys(groups)
        .filter(kind => !groupOrder.includes(kind))
        .sort()
        .reduce((rows, kind) => rows.concat(groups[kind]), []);
    if (leftovers.length) html += groupRows('Other', leftovers);

    // Summary rows
    html += '<tr class="summary-row"><td>Total Income</td>' +
        monthlyIncome.map(n => `<td class="num positive">${escapeHtml(fmtMoney(n))}</td>`).join('') +
        `<td class="num positive">${escapeHtml(fmtMoney(monthlyIncome.reduce((s,n)=>s+n,0)))}</td></tr>`;
    html += '<tr class="summary-row"><td>Total Expenses</td>' +
        monthlyExpense.map(n => `<td class="num negative">${escapeHtml(fmtMoney(-n))}</td>`).join('') +
        `<td class="num negative">${escapeHtml(fmtMoney(-monthlyExpense.reduce((s,n)=>s+n,0)))}</td></tr>`;
    html += '<tr class="summary-row"><td>Net Cash Flow</td>' +
        monthlyNet.map(n => `<td class="num ${n>=0?'positive':'negative'}">${escapeHtml(fmtMoney(n))}</td>`).join('') +
        `<td class="num">${escapeHtml(fmtMoney(monthlyNet.reduce((s,n)=>s+n,0)))}</td></tr>`;
    // runningBalance is liquid cash — the number that answers "will I go negative".
    html += '<tr class="balance-row"><td>End-of-Month Cash</td>' +
        runningBalance.map(n => `<td class="num ${n<0?'balance-neg':''}">${escapeHtml(fmtMoney(n))}</td>`).join('') +
        '<td></td></tr>';
    if (Array.isArray(forecast.netWorthRunning) && forecast.netWorthRunning.length === months) {
        html += '<tr class="balance-row"><td>Net Worth</td>' +
            forecast.netWorthRunning.map(n => `<td class="num ${n<0?'balance-neg':''}">${escapeHtml(fmtMoney(n))}</td>`).join('') +
            '<td></td></tr>';
    }

    tbody.innerHTML = html;

    const parts = [`Cash ${fmtMoney(forecast.startingBalance)} → ${fmtMoney(runningBalance[months - 1] || 0)}`];
    if (Array.isArray(forecast.netWorthRunning) && forecast.netWorthRunning.length) {
        const startNet = forecast.startingNetWorth != null ? forecast.startingNetWorth : forecast.startingBalance;
        parts.push(`Net worth ${fmtMoney(startNet)} → ${fmtMoney(forecast.netWorthRunning[months - 1] || 0)}`);
    }
    const firstNegative = toDate(forecast.firstNegativeDate);
    if (firstNegative) parts.push(`Cash goes negative ${fmtDate(firstNegative)}`);
    const tightest = forecast.tightestWeek;
    if (tightest && toDate(tightest.start)) {
        parts.push(`Tightest week from ${fmtDate(toDate(tightest.start))} (${fmtMoney(tightest.net)})`);
    }
    setText('forecastMeta', parts.join(' · '));
}

// Only renders where the markup offers a mount point for it.
function renderDebtSchedule(forecast) {
    const mount = pick('debtSchedule', 'debtScheduleBody');
    if (!mount) return;
    const schedule = forecast.debtSchedule;
    const accounts = schedule && Array.isArray(schedule.accounts) ? schedule.accounts : [];
    if (!accounts.length) {
        mount.innerHTML = '<div class="empty">No credit accounts, so there is nothing to pay off.</div>';
        return;
    }
    const rows = accounts.map(a => {
        const payoff = toDate(a.payoffDate);
        return `<tr>
                <td>${escapeHtml(a.name)}</td>
                <td class="num">${escapeHtml(fmtPct(parseFloat(a.apr) || 0))}</td>
                <td class="num">${escapeHtml(fmtMoney(a.balance))}</td>
                <td>${payoff ? escapeHtml(fmtDate(payoff)) : '<span class="muted-text">not within horizon</span>'}</td>
                <td class="num">${escapeHtml(fmtMoney(a.totalInterest))}</td>
            </tr>`;
    }).join('');
    mount.innerHTML = `<div class="table-wrap"><table>
            <thead><tr><th>Account</th><th class="num">APR</th><th class="num">Owed</th><th>Paid off</th><th class="num">Interest</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td colspan="4">Total interest</td><td class="num">${escapeHtml(fmtMoney(schedule.totalInterest || 0))}</td></tr></tfoot>
        </table></div>`;
}

/* ───── Charts ───── */

const CHART_KEYS = ['monthly', 'balance', 'networth', 'category', 'trend', 'top', 'income'];
const CHART_CANVAS = {
    monthly:  'chartMonthly',
    balance:  'chartBalance',
    networth: 'chartNetWorth',
    category: 'chartCategory',
    trend:    'chartTrend',
    top:      'chartTop',
    income:   'chartIncome'
};

// The charting library is optional. Nothing outside this section may depend on
// it, and nothing here may touch Chart before this returns true.
function hasCharting() { return typeof Chart !== 'undefined' && !!Chart; }

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
        accentFill: hexToRgba(v('--accent') || '#ff9a44', 0.12)
    };
}

function destroyCharts() {
    Object.keys(charts).forEach(k => { if (charts[k]) { charts[k].destroy(); delete charts[k]; } });
}

function chartCanvas(key) { return el(CHART_CANVAS[key]); }

function chartCard(key) {
    const canvas = chartCanvas(key);
    return document.querySelector(`[data-chart-card="${key}"]`) ||
        (canvas ? (canvas.closest('.chart-card') || canvas.parentElement) : null);
}

// Shared empty state: a chart with nothing to draw says so instead of leaving
// an empty box behind.
function showChartEmpty(key, message) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
    const canvas = chartCanvas(key);
    if (canvas) canvas.classList.add('hidden');
    const card = chartCard(key);
    if (!card) return;
    let note = card.querySelector('.chart-empty');
    if (!note) {
        note = document.createElement('div');
        note.className = 'chart-empty empty';
        note.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:160px;';
        card.appendChild(note);
    }
    note.textContent = message;
}

function clearChartEmpty(key) {
    const canvas = chartCanvas(key);
    if (canvas) canvas.classList.remove('hidden');
    const card = chartCard(key);
    const note = card && card.querySelector('.chart-empty');
    if (note) note.remove();
}

// Per-chart horizon resolution: explicit override → global setting.
function chartHorizonToken(key) {
    const overrides = (state.settings && state.settings.chartHorizons) || {};
    return overrides[key] || state.settings.forecastHorizon;
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
    setText('range-' + key, ' · ' + months + 'mo · ' + horizonRangeLabel(months));
}

// A scaled tick keeps one decimal ($1.2k), which is neither of the two shapes
// engine.js caches, so the axis keeps its own — still built once per currency
// rather than once per tick.
const AXIS_FORMATTERS = new Map();

function axisScaledFormatter(currency) {
    let f = AXIS_FORMATTERS.get(currency);
    if (!f) {
        const options = { style: 'currency', minimumFractionDigits: 0, maximumFractionDigits: 1 };
        // Guarded the way engine.js guards its own: a tick callback that throws
        // takes the whole chart down with it.
        try {
            f = new Intl.NumberFormat(undefined, Object.assign({ currency }, options));
        } catch (e) {
            f = new Intl.NumberFormat(undefined, Object.assign({ currency: 'USD' }, options));
        }
        AXIS_FORMATTERS.set(currency, f);
    }
    return f;
}

// Axis ticks need genuinely short labels — $1.2k, not $1,234.
function axisMoney(n) {
    const value = isNaN(n) ? 0 : Number(n);
    const abs = Math.abs(value);
    const unit = abs >= 1e9 ? { suffix: 'B', div: 1e9 }
        : abs >= 1e6 ? { suffix: 'M', div: 1e6 }
        : abs >= 1e3 ? { suffix: 'k', div: 1e3 }
        : { suffix: '', div: 1 };
    // A stored code Intl does not know throws on construction, and the caught
    // error used to cost every axis in the app its currency symbol.
    const currency = normalizeCurrency(state && state.settings ? state.settings.currency : null);
    if (unit.div === 1) return moneyFormatter(currency, true).format(value);
    return axisScaledFormatter(currency).format(value / unit.div) + unit.suffix;
}

const moneyTicks = { callback: v => axisMoney(v) };

// monthlyByCategory can carry a bucket for spend whose category no longer
// exists; it belongs on the charts like any other slice.
function categorySeries(fc) {
    const byCategory = fc.monthlyByCategory || {};
    return Object.keys(byCategory).map(id => {
        const cat = state.categories.find(c => c.id === id);
        return {
            id,
            name: cat ? cat.name : 'Uncategorised',
            color: cat ? safeColor(cat.color) : cssVar('--faint', '#6c7299'),
            series: byCategory[id] || []
        };
    });
}

const moneyTooltip = {
    callbacks: { label: ctx => `${ctx.dataset.label || ctx.label}: ${fmtMoney(ctx.parsed.y ?? ctx.parsed)}` }
};

/* A legend down the side of a doughnut takes a fixed slice of the width, which
 * on a phone leaves the plot itself with almost nothing. Below this width the
 * legend goes underneath instead. */
const WIDE_LEGEND_MIN_PX = 700;

function viewportWidth() {
    return window.innerWidth || document.documentElement.clientWidth || 0;
}
function doughnutLegendPosition() {
    return viewportWidth() < WIDE_LEGEND_MIN_PX ? 'bottom' : 'right';
}

// Chart.js reflows a canvas on its own; only a crossing of the width threshold
// needs the chart rebuilt, and only the two charts that read it.
let lastLegendPosition = doughnutLegendPosition();
let legendResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(legendResizeTimer);
    legendResizeTimer = setTimeout(() => {
        const next = doughnutLegendPosition();
        if (next === lastLegendPosition) return;
        lastLegendPosition = next;
        ['category', 'income'].forEach(key => { if (charts[key]) renderChart(key); });
    }, 200);
});

/* The p25/p75 corridor is drawn only where engine.js can build one from recorded
 * history. A band invented from the plan alone would look exactly as confident
 * as one earned from a year of statements, so there is no fallback here. */
function balanceBands(forecast) {
    if (typeof confidenceBands !== 'function' || typeof categoryVolatility !== 'function') return null;
    try {
        return confidenceBands(forecast, categoryVolatility(Array.isArray(state.actuals) ? state.actuals : []));
    } catch (e) {
        console.warn('The confidence band could not be computed', e);
        return null;
    }
}

const BAND_NOTE_PRESENT = 'The shaded corridor is where the balance lands if each category spends at the ' +
    'quarter and three-quarter marks of its own recorded history.';
const BAND_NOTE_ABSENT = 'A likely range appears here once a category has three full months of imported actuals behind it.';

function setBalanceBandNote(text) {
    const card = chartCard('balance');
    if (!card) return;
    let note = card.querySelector('.chart-note');
    if (!text) {
        if (note) note.remove();
        return;
    }
    if (!note) {
        note = document.createElement('p');
        note.className = 'chart-note muted-text';
        note.style.cssText = 'margin:8px 0 0;font-size:12px;';
        card.appendChild(note);
    }
    note.textContent = text;
}

const chartRenderers = {
    monthly(months, T) {
        const fc = getForecast(months);
        const labels = fc.monthList.map(m => m.label);
        if (!fc.monthlyIncome.some(n => n !== 0) && !fc.monthlyExpense.some(n => n !== 0)) {
            showChartEmpty('monthly', 'No income or expenses fall inside this horizon yet.');
            return;
        }
        clearChartEmpty('monthly');
        charts.monthly = new Chart(chartCanvas('monthly'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Income',   data: fc.monthlyIncome,                  backgroundColor: hexToRgba(T.live, 0.85) },
                    { label: 'Expenses', data: fc.monthlyExpense.map(n => -n),    backgroundColor: hexToRgba(T.down, 0.85) },
                    { label: 'Net',      data: fc.monthlyNet,                     type: 'line', borderColor: T.accent, backgroundColor: T.accent, tension: 0.25, yAxisID: 'y' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { ticks: moneyTicks } },
                plugins: { tooltip: moneyTooltip } }
        });
    },
    balance(months, T) {
        const fc = getForecast(months);
        const labels = fc.monthList.map(m => m.label);
        if (!fc.runningBalance.length || (fc.startingBalance === 0 && !fc.runningBalance.some(n => n !== 0))) {
            showChartEmpty('balance', 'Add an account balance or a transaction to project cash.');
            setBalanceBandNote('');
            return;
        }
        clearChartEmpty('balance');
        const bands = balanceBands(fc);
        // Chart.js draws the last dataset first, so the plan stays at index 0 to
        // keep it on top of any corridor behind it.
        const datasets = [{
            label: 'Projected Cash', data: fc.runningBalance,
            // Filling to the axis under a corridor would bury it.
            fill: !bands, borderColor: T.accent,
            backgroundColor: T.accentFill, tension: 0.3
        }];
        if (bands) {
            // Both figures are outflows, so p25 is the HIGHER balance: spending at
            // the quarter mark leaves more behind. p75 fills back to it.
            const edge = hexToRgba(T.accent, 0.35);
            datasets.push({
                label: 'If spending runs low', data: bands.p25,
                borderColor: edge, borderWidth: 1, borderDash: [4, 4],
                pointRadius: 0, fill: false, tension: 0.3
            });
            datasets.push({
                label: 'If spending runs high', data: bands.p75,
                borderColor: edge, borderWidth: 1, borderDash: [4, 4],
                pointRadius: 0, fill: '-1', backgroundColor: hexToRgba(T.accent, 0.1), tension: 0.3
            });
        }
        setBalanceBandNote(bands ? BAND_NOTE_PRESENT : BAND_NOTE_ABSENT);
        charts.balance = new Chart(chartCanvas('balance'), {
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { ticks: moneyTicks } },
                plugins: { tooltip: moneyTooltip } }
        });
    },
    networth(months, T) {
        const fc = getForecast(months);
        const series = Array.isArray(fc.netWorthRunning) ? fc.netWorthRunning : [];
        if (!series.length) {
            showChartEmpty('networth', 'Add an account to project net worth.');
            return;
        }
        clearChartEmpty('networth');
        charts.networth = new Chart(chartCanvas('networth'), {
            type: 'line',
            data: { labels: fc.monthList.map(m => m.label), datasets: [{
                label: 'Net Worth', data: series,
                fill: true, borderColor: T.magenta,
                backgroundColor: hexToRgba(T.magenta, 0.12), tension: 0.3
            }] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { ticks: moneyTicks } },
                plugins: { tooltip: moneyTooltip } }
        });
    },
    category(months, T) {
        const fc = getForecast(months);
        const totals = categorySeries(fc)
            .map(c => ({ name: c.name, color: c.color, total: c.series.reduce((s, n) => s + n, 0) }))
            .filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        if (!totals.length) {
            showChartEmpty('category', 'No spending falls inside this horizon yet.');
            return;
        }
        clearChartEmpty('category');
        charts.category = new Chart(chartCanvas('category'), {
            type: 'doughnut',
            data: { labels: totals.map(e => e.name),
                datasets: [{ data: totals.map(e => e.total), backgroundColor: totals.map(e => e.color), borderColor: T.card }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: doughnutLegendPosition(), labels: { boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtMoney(ctx.parsed)}` } } } }
        });
    },
    trend(months, T) {
        const fc = getForecast(months);
        const labels = fc.monthList.map(m => m.label);
        // A category that is flat zero across the horizon adds a legend entry
        // and nothing else, so it is dropped.
        const cats = categorySeries(fc).filter(c => c.series.some(n => n !== 0));
        if (!cats.length) {
            showChartEmpty('trend', 'No category has any spend inside this horizon yet.');
            return;
        }
        clearChartEmpty('trend');
        charts.trend = new Chart(chartCanvas('trend'), {
            type: 'line',
            data: { labels, datasets: cats.map(c => ({
                label: c.name, data: c.series,
                fill: true, borderColor: c.color, backgroundColor: hexToRgba(c.color, 0.33),
                tension: 0.25, pointRadius: 0
            })) },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { stacked: true, ticks: moneyTicks } },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    tooltip: moneyTooltip
                } }
        });
    },
    top(months, T) {
        const fc = getForecast(months);
        // Sum each expense transaction's outflow over the horizon.
        const byId = new Map(fc.txData.map(d => [d.tx.id, d]));
        const items = state.transactions
            .filter(t => t.kind === 'expense' && !t.paused)
            .map(t => {
                const data = byId.get(t.id);
                const total = data ? data.byMonth.reduce((s, n) => s + Math.abs(n), 0) : 0;
                return { name: t.name, amt: total };
            }).filter(x => x.amt > 0).sort((a, b) => b.amt - a.amt).slice(0, 10);
        if (!items.length) {
            showChartEmpty('top', 'No expense falls inside this horizon yet.');
            return;
        }
        clearChartEmpty('top');
        charts.top = new Chart(chartCanvas('top'), {
            type: 'bar',
            data: { labels: items.map(x => x.name),
                datasets: [{ label: 'Cost over period', data: items.map(x => x.amt), backgroundColor: T.accent }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: { x: { ticks: moneyTicks } },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtMoney(ctx.parsed.x)}` } }
                } }
        });
    },
    income(months, T) {
        const fc = getForecast(months);
        // monthlyByCategory only carries outflows, so inflows are summed straight
        // from each transaction's own months.
        const byCategory = new Map();
        fc.txData.forEach(({ tx, byMonth }) => {
            const inflow = byMonth.reduce((s, n) => s + (n > 0 ? n : 0), 0);
            if (inflow <= 0) return;
            byCategory.set(tx.categoryId || '', (byCategory.get(tx.categoryId || '') || 0) + inflow);
        });
        const totals = Array.from(byCategory.entries()).map(([id, total]) => {
            const cat = state.categories.find(c => c.id === id);
            return { name: cat ? cat.name : 'Uncategorised', color: cat ? safeColor(cat.color) : cssVar('--faint', '#6c7299'), total };
        }).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        if (!totals.length) {
            showChartEmpty('income', 'No income falls inside this horizon yet.');
            return;
        }
        clearChartEmpty('income');
        charts.income = new Chart(chartCanvas('income'), {
            type: 'doughnut',
            data: { labels: totals.map(x => x.name),
                datasets: [{ data: totals.map(x => x.total), backgroundColor: totals.map(x => x.color), borderColor: T.card }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: doughnutLegendPosition(), labels: { boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtMoney(ctx.parsed)}` } } } }
        });
    }
};

const NO_CHART_LIB = 'Charts need vendor/chart.umd.min.js, which did not load.';

function renderChart(key) {
    if (charts[key]) { charts[key].destroy(); delete charts[key]; }
    if (!chartRenderers[key] || !chartCanvas(key)) return;
    const months = chartHorizonMonths(key);
    setChartRange(key, months);
    if (!hasCharting()) { showChartEmpty(key, NO_CHART_LIB); return; }
    try {
        chartRenderers[key](months, deckChartTheme());
    } catch (e) {
        console.error('Chart "' + key + '" could not be drawn', e);
        showChartEmpty(key, 'This chart could not be drawn.');
    }
}

// Takes the forecast the rest of the render already built so the horizon that
// matches the global setting is not projected a second time.
function renderCharts(seed) {
    destroyCharts();
    clearForecastCache();
    if (seed && Array.isArray(seed.monthList)) _forecastCache.set(seed.monthList.length, seed);
    if (!hasCharting()) {
        CHART_KEYS.forEach(k => { if (chartCanvas(k)) showChartEmpty(k, NO_CHART_LIB); });
        return;
    }
    const T = deckChartTheme();
    CHART_KEYS.forEach(k => {
        if (!chartCanvas(k)) return;
        const months = chartHorizonMonths(k);
        setChartRange(k, months);
        try {
            chartRenderers[k](months, T);
        } catch (e) {
            console.error('Chart "' + k + '" could not be drawn', e);
            showChartEmpty(k, 'This chart could not be drawn.');
        }
    });
}

function refreshChartHorizonSelects() {
    document.querySelectorAll('.chart-horizon').forEach(sel => {
        const key = sel.dataset.chart;
        const overrides = (state.settings && state.settings.chartHorizons) || {};
        const ov = overrides[key] || '';
        sel.innerHTML = `<option value="">Match global (${state.settings.forecastHorizon === 'eoy' ? 'EoY' : escapeHtml(state.settings.forecastHorizon) + 'mo'})</option>` +
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

const INSIGHT_TONES = ['positive', 'warning', 'danger', 'info', 'fact'];

function renderInsights(forecast) {
    const grid = el('insightsGrid');
    if (!grid) return;
    let cards = [];
    try {
        cards = computeInsights(forecast) || [];
    } catch (e) {
        console.error('Could not compute insights', e);
        grid.innerHTML = '<div class="empty">Insights could not be computed for this forecast.</div>';
        return;
    }
    // Card text carries category names straight from saved data — never raw HTML.
    grid.innerHTML = cards.map(c => `
        <div class="insight-card ${INSIGHT_TONES.includes(c.tone) ? c.tone : 'info'}">
            <div class="label">${escapeHtml(c.label)}</div>
            <div class="value">${escapeHtml(c.value)}</div>
            ${c.sub ? `<div class="sub">${escapeHtml(c.sub)}</div>` : ''}
        </div>
    `).join('') || `<div class="empty">Add transactions to unlock insights.</div>`;
}


/* ───── Excel export / import ───── */

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: '$', AUD: '$', JPY: '¥' };

function moneyNumberFormat() {
    const cur = normalizeCurrency(state.settings.currency);
    const sym = CURRENCY_SYMBOLS[cur] || '';
    const body = cur === 'JPY' ? '#,##0' : '#,##0.00';
    return sym ? `"${sym}"${body};-"${sym}"${body}` : `${body};-${body}`;
}

function applyColumnFormat(ws, column, format, type) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: column })];
        if (cell && cell.t === type) cell.z = format;
    }
}

// Builds a sheet that behaves like a spreadsheet rather than a CSV dump: sized
// columns, real number/date cells, filterable header. The bundled SheetJS build
// does not serialise '!freeze', so the header freeze is a no-op there.
function buildSheet(rows, opts = {}) {
    const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    if (opts.cols) ws['!cols'] = opts.cols;
    (opts.money || []).forEach(c => applyColumnFormat(ws, c, moneyNumberFormat(), 'n'));
    (opts.dates || []).forEach(c => applyColumnFormat(ws, c, 'yyyy-mm-dd', 'd'));
    ws['!freeze'] = 'A2';
    if (opts.autofilter && ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        if (range.e.r > 0) ws['!autofilter'] = { ref: ws['!ref'] };
    }
    return ws;
}

// A real date cell, or '' — never an Invalid Date, which would poison the sheet.
function dateCell(value) {
    const d = toDate(value);
    return d || '';
}

/* A scenario is a name over an ordered list of edits, so the sheet takes a row
 * per edit. A scenario with no edits still gets one, or its name would not
 * survive the trip. Each field a scenario is allowed to patch has its own
 * column; an added transaction is a whole object, so it travels as JSON. */
const SCENARIO_PATCH_COLUMNS = ['amount', 'startDate', 'endDate', 'paused', 'escalation'];
const SCENARIO_SHEET_HEAD = ['scenarioId', 'scenarioName', 'op', 'txId'].concat(SCENARIO_PATCH_COLUMNS, ['tx']);

function scenarioSheetRows() {
    const rows = [SCENARIO_SHEET_HEAD];
    (Array.isArray(state.scenarios) ? state.scenarios : []).forEach(sc => {
        if (!sc) return;
        const id = toText(sc.id);
        const name = toText(sc.name);
        const ops = Array.isArray(sc.ops) ? sc.ops : [];
        if (!ops.length) {
            rows.push([id, name, '', '', '', '', '', '', '', '']);
            return;
        }
        ops.forEach(op => {
            if (!op) return;
            const patch = (op.op === 'modify' && op.patch && typeof op.patch === 'object') ? op.patch : {};
            rows.push([
                id, name, toText(op.op), toText(op.txId || ''),
                patch.amount === undefined ? '' : (parseFloat(patch.amount) || 0),
                patch.startDate === undefined ? '' : dateCell(patch.startDate),
                (patch.endDate === undefined || patch.endDate === null) ? '' : dateCell(patch.endDate),
                patch.paused === undefined ? '' : (patch.paused ? 'TRUE' : 'FALSE'),
                patch.escalation === undefined ? '' : (parseFloat(patch.escalation) || 0),
                (op.op === 'add' && op.tx) ? JSON.stringify(op.tx) : ''
            ]);
        });
    });
    return rows;
}

function exportExcel() {
    if (typeof XLSX === 'undefined') {
        showNotice('danger', 'The spreadsheet library did not load, so Excel export is unavailable. Use JSON export instead.');
        return;
    }
    const wb = XLSX.utils.book_new();

    const accountRows = [['id','name','type','startingBalance','asOfDate','apr','minPayment']];
    state.accounts.forEach(a => accountRows.push([
        a.id, a.name, a.type, parseFloat(a.startingBalance) || 0, dateCell(a.asOfDate),
        parseFloat(a.apr) || 0, parseFloat(a.minPayment) || 0
    ]));
    XLSX.utils.book_append_sheet(wb, buildSheet(accountRows, {
        cols: [{ wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 13 }],
        money: [3, 6], dates: [4], autofilter: true
    }), 'Accounts');

    const catRows = [['id','name','kind','color']];
    state.categories.forEach(c => catRows.push([c.id, c.name, c.kind, c.color]));
    XLSX.utils.book_append_sheet(wb, buildSheet(catRows, {
        cols: [{ wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 10 }], autofilter: true
    }), 'Categories');

    const txRows = [[
        'id','name','kind','amount','categoryId','accountId','fromAccountId',
        'frequency','customN','customUnit','startDate','endDate','escalation',
        'tags','notes','paused'
    ]];
    state.transactions.forEach(t => txRows.push([
        t.id, t.name, t.kind, parseFloat(t.amount) || 0, t.categoryId, t.accountId, t.fromAccountId || '',
        t.frequency, t.customN || 1, t.customUnit || 'days',
        dateCell(t.startDate), dateCell(t.endDate), parseFloat(t.escalation) || 0,
        (t.tags || []).join(';'), t.notes || '', t.paused ? 'TRUE' : 'FALSE'
    ]));
    XLSX.utils.book_append_sheet(wb, buildSheet(txRows, {
        cols: [{ wch: 18 }, { wch: 26 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 14 }, { wch: 9 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 20 }, { wch: 30 }, { wch: 8 }],
        money: [3], dates: [10, 11], autofilter: true
    }), 'Transactions');

    // Recorded history belongs in the workbook as much as the plan does — the
    // live-file feature writes through this same builder, so anything missing
    // here is thrown away every time the file is read back.
    const actualRows = [['id','date','amount','payee','accountId','categoryId','importedId','matchedTxId','source']];
    (Array.isArray(state.actuals) ? state.actuals : []).forEach(a => actualRows.push([
        a.id, dateCell(a.date), parseFloat(a.amount) || 0, a.payee || '',
        a.accountId || '', a.categoryId || '', a.importedId || '', a.matchedTxId || '', a.source || 'manual'
    ]));
    XLSX.utils.book_append_sheet(wb, buildSheet(actualRows, {
        cols: [{ wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 10 }],
        money: [2], dates: [1], autofilter: true
    }), 'Actuals');

    const checkinRows = [['id','date','accountId','balance']];
    (Array.isArray(state.checkins) ? state.checkins : []).forEach(c => checkinRows.push([
        c.id, dateCell(c.date), c.accountId || '', parseFloat(c.balance) || 0
    ]));
    XLSX.utils.book_append_sheet(wb, buildSheet(checkinRows, {
        cols: [{ wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 14 }],
        money: [3], dates: [1], autofilter: true
    }), 'Checkins');

    XLSX.utils.book_append_sheet(wb, buildSheet(scenarioSheetRows(), {
        cols: [{ wch: 20 }, { wch: 26 }, { wch: 10 }, { wch: 18 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 11 }, { wch: 40 }],
        money: [4], dates: [5, 6], autofilter: true
    }), 'Scenarios');

    const settingsRows = [
        ['key','value'],
        ['schemaVersion', SCHEMA_VERSION],
        ['currency', state.settings.currency],
        ['forecastHorizon', state.settings.forecastHorizon],
        ['activeScenarioId', state.settings.activeScenarioId || '']
    ];
    // Per-chart horizons round-trip as one row each so they survive the workbook.
    const overrides = state.settings.chartHorizons || {};
    Object.keys(overrides).forEach(key => {
        if (overrides[key]) settingsRows.push(['chartHorizon.' + key, String(overrides[key])]);
    });
    XLSX.utils.book_append_sheet(wb, buildSheet(settingsRows, { cols: [{ wch: 26 }, { wch: 22 }] }), 'Settings');

    // Forecast (read-only export of current projection)
    const fc = buildForecast(resolveHorizon(state.settings.forecastHorizon));
    const byId = new Map(fc.txData.map(d => [d.tx.id, d]));
    const fcHead = ['Item','Category', ...fc.monthList.map(m => m.label), 'Total'];
    const fcRows = [fcHead];
    state.transactions.forEach(t => {
        const data = byId.get(t.id);
        if (!data) return;
        const cat = state.categories.find(c => c.id === t.categoryId);
        const row = [t.name, cat ? cat.name : '', ...data.byMonth];
        row.push(row.slice(2).reduce((s,n) => s + n, 0));
        fcRows.push(row);
    });
    fcRows.push([]);
    fcRows.push(['Total Income','', ...fc.monthlyIncome, fc.monthlyIncome.reduce((s,n)=>s+n,0)]);
    fcRows.push(['Total Expenses','', ...fc.monthlyExpense.map(n=>-n), -fc.monthlyExpense.reduce((s,n)=>s+n,0)]);
    fcRows.push(['Net Cash Flow','', ...fc.monthlyNet, fc.monthlyNet.reduce((s,n)=>s+n,0)]);
    fcRows.push(['End-of-Month Cash','', ...fc.runningBalance, '']);
    if (Array.isArray(fc.netWorthRunning) && fc.netWorthRunning.length === fc.monthList.length) {
        fcRows.push(['Net Worth','', ...fc.netWorthRunning, '']);
    }
    const moneyCols = fc.monthList.map((m, i) => i + 2).concat([fc.monthList.length + 2]);
    XLSX.utils.book_append_sheet(wb, buildSheet(fcRows, {
        cols: [{ wch: 30 }, { wch: 16 }].concat(fc.monthList.map(() => ({ wch: 13 }))).concat([{ wch: 14 }]),
        money: moneyCols
    }), 'Forecast');

    XLSX.writeFile(wb, `budget-${fmtDate(new Date())}.xlsx`);
    markExported('Excel workbook');
}

/* ───── Import coercion ─────
 * Nothing from a file is trusted: every field is forced to its expected type,
 * every reference is checked, and anything dropped is counted and reported.
 */

// A real, visible category for imported rows whose own category is missing.
// (engine.js keeps a separate UNCATEGORISED bucket id for its own totals.)
const UNCATEGORISED_CATEGORY = { id: 'cat_uncategorised', name: 'Uncategorised', kind: 'variable', color: '#9ba1c5' };
const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'investment', 'cash'];
const TX_KINDS = ['income', 'expense', 'transfer'];
const CUSTOM_UNITS = ['days', 'weeks', 'months'];

function toNum(value, fallback) {
    // Hand-edited files carry currency symbols and thousands separators; only a
    // comma that groups three digits is dropped, so "9,50" stays ambiguous
    // rather than being silently read as nine hundred and fifty.
    const raw = typeof value === 'string'
        ? value.replace(/[^0-9eE+\-.,]/g, '').replace(/,(?=\d{3}(\D|$))/g, '')
        : value;
    const n = parseFloat(raw);
    return isFinite(n) ? n : fallback;
}

function toBool(value) {
    if (typeof value === 'boolean') return value;
    const s = String(value == null ? '' : value).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
}

function toText(value) {
    return String(value == null ? '' : value);
}

// An escalation of 4000%/yr is a typo, not a plan.
function clampEscalation(value) {
    const n = toNum(value, 0);
    return Math.max(-100, Math.min(100, n));
}

function coerceTags(value) {
    if (Array.isArray(value)) return value.map(toText).map(s => s.trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    return [];
}

function coerceAccount(r, label, issues) {
    return {
        id: r.id ? toText(r.id) : uid('acct'),
        name: toText(r.name).trim(),
        type: ACCOUNT_TYPES.includes(toText(r.type)) ? toText(r.type) : 'checking',
        startingBalance: toNum(r.startingBalance, 0),
        asOfDate: normalizeDate(r.asOfDate, label + ' as-of date', issues),
        apr: Math.max(0, toNum(r.apr, 0)),
        minPayment: Math.max(0, toNum(r.minPayment, 0))
    };
}

function coerceCategory(r) {
    const kind = toText(r.kind);
    return {
        id: r.id ? toText(r.id) : uid('cat'),
        name: toText(r.name).trim(),
        kind: (KIND_LABELS[kind] ? kind : 'variable'),
        color: safeColor(r.color, '#ff9a44')
    };
}

function coerceTransaction(r, label, issues) {
    const frequency = toText(r.frequency);
    const startDate = normalizeDate(r.startDate, label + ' start date', issues);
    let endDate = r.endDate ? (normalizeDate(r.endDate, label + ' end date', issues) || null) : null;
    if (startDate && endDate && endDate < startDate) {
        issues.push(`${label}: the end date ${endDate} is before the start date ${startDate} — the end date was dropped.`);
        endDate = null;
    }
    const signedAmount = toNum(r.amount, 0);
    // The forecast reads the magnitude and takes the direction from the row's
    // kind, so a signed figure would be shown and exported as one thing while
    // being counted as another — for as long as the row survived. Store the
    // magnitude, which is what the forecast was going to use regardless.
    const amount = Math.abs(signedAmount);
    if (signedAmount < 0) {
        const who = toText(r.name).trim();
        issues.push(`${label}${who ? ` (${who})` : ''}: the amount was ${signedAmount}, and a negative would read as one figure while counting as another — it is stored as ${amount}, with income or expense still decided by the row's kind.`);
    }
    // Kept rather than dropped — the row may be a placeholder someone means to
    // fill in — but a silent zero is a forecast line that can never move.
    if (amount === 0) {
        issues.push(`${label}: the amount is zero, so this row will sit in the forecast without ever moving it.`);
    }
    return {
        id: r.id ? toText(r.id) : uid('tx'),
        name: toText(r.name).trim(),
        kind: TX_KINDS.includes(toText(r.kind)) ? toText(r.kind) : 'expense',
        amount,
        categoryId: r.categoryId ? toText(r.categoryId) : '',
        accountId: r.accountId ? toText(r.accountId) : '',
        fromAccountId: r.fromAccountId ? toText(r.fromAccountId) : null,
        frequency: FREQUENCY_LABELS[frequency] ? frequency : 'monthly',
        customN: Math.max(1, parseInt(r.customN) || 1),
        customUnit: CUSTOM_UNITS.includes(toText(r.customUnit)) ? toText(r.customUnit) : 'days',
        startDate,
        endDate,
        escalation: clampEscalation(r.escalation),
        tags: coerceTags(r.tags),
        notes: toText(r.notes),
        paused: toBool(r.paused)
    };
}

/* Recorded history and what-ifs are coerced too, but they are not the plan: an
 * unreadable row here is dropped rather than repaired, because inventing a
 * balance or an observed amount would be inventing evidence. */
function coerceActual(r) {
    const date = normalizeDate(r.date, null, null);
    const amount = toNum(r.amount, NaN);
    if (!date || !isFinite(amount)) return null;
    return {
        id: r.id ? toText(r.id) : uid('act'),
        date,
        amount,
        payee: toText(r.payee).trim() || '(no description)',
        accountId: r.accountId ? toText(r.accountId) : null,
        categoryId: r.categoryId ? toText(r.categoryId) : null,
        importedId: r.importedId ? toText(r.importedId) : null,
        matchedTxId: r.matchedTxId ? toText(r.matchedTxId) : null,
        source: toText(r.source).trim() || 'manual'
    };
}

function coerceCheckin(r) {
    const date = normalizeDate(r.date, null, null);
    const balance = toNum(r.balance, NaN);
    if (!date || !isFinite(balance)) return null;
    return {
        id: r.id ? toText(r.id) : uid('chk'),
        date,
        accountId: r.accountId ? toText(r.accountId) : null,
        balance
    };
}

// A scenario may only ever add, remove, or patch a short list of fields — the
// same list engine.js enforces when it applies one. Anything else in the file is
// dropped here so a malformed import cannot reach into the plan sideways.
function coerceScenarioOp(op, label, issues) {
    if (!op || typeof op !== 'object') return null;
    const kind = toText(op.op).trim().toLowerCase();
    if (kind === 'add') {
        if (!op.tx || typeof op.tx !== 'object') return null;
        const tx = coerceTransaction(op.tx, label + ' added item', issues);
        return tx.name ? { op: 'add', tx } : null;
    }
    if (kind === 'remove') {
        const txId = toText(op.txId).trim();
        return txId ? { op: 'remove', txId } : null;
    }
    if (kind !== 'modify') return null;
    const txId = toText(op.txId).trim();
    const source = (op.patch && typeof op.patch === 'object') ? op.patch : {};
    const patch = {};
    SCENARIO_PATCH_COLUMNS.forEach(field => {
        if (source[field] === undefined || source[field] === '') return;
        // Magnitude here for the same reason as on a transaction: a what-if that
        // patched in a signed amount would be read one way and counted another.
        if (field === 'amount') patch.amount = Math.abs(toNum(source.amount, 0));
        else if (field === 'escalation') patch.escalation = clampEscalation(source.escalation);
        else if (field === 'paused') patch.paused = toBool(source.paused);
        else if (source[field] === null) patch[field] = null;
        else patch[field] = normalizeDate(source[field], label + ' ' + field, issues) || null;
    });
    return (txId && Object.keys(patch).length) ? { op: 'modify', txId, patch } : null;
}

function coerceScenario(r, index, issues) {
    const name = toText(r.name).trim() || `Scenario ${index + 1}`;
    const label = `Scenario "${name}"`;
    const declared = Array.isArray(r.ops) ? r.ops : [];
    const ops = declared.map(op => coerceScenarioOp(op, label, issues)).filter(Boolean);
    // A change the app cannot understand is dropped, but a scenario that quietly
    // came back smaller than it left is worse than one that says so.
    if (ops.length < declared.length) {
        issues.push(`${label}: ${declared.length - ops.length} change(s) could not be read and were left out.`);
    }
    return { id: r.id ? toText(r.id) : uid('scn'), name, ops };
}

function ensureUncategorised(target) {
    let cat = target.categories.find(c => c.id === UNCATEGORISED_CATEGORY.id);
    if (!cat) {
        cat = { ...UNCATEGORISED_CATEGORY };
        target.categories.push(cat);
    }
    return cat;
}

// A transaction that points at a category or account which is not in the file
// is kept and re-pointed: dropping it would quietly shrink the forecast.
function linkOrphans(target, issues) {
    const catIds = new Set(target.categories.map(c => c.id));
    const acctIds = new Set(target.accounts.map(a => a.id));
    const fallbackAccount = target.accounts[0] ? target.accounts[0].id : '';
    let lostCategories = 0;
    let lostAccounts = 0;
    target.transactions.forEach(t => {
        // A transfer legitimately carries no category; anything else must land somewhere.
        if (t.categoryId ? !catIds.has(t.categoryId) : t.kind !== 'transfer') {
            const cat = ensureUncategorised(target);
            catIds.add(cat.id);
            t.categoryId = cat.id;
            lostCategories++;
        }
        if (t.accountId && !acctIds.has(t.accountId)) {
            t.accountId = fallbackAccount;
            lostAccounts++;
        } else if (!t.accountId) {
            t.accountId = fallbackAccount;
        }
        if (t.fromAccountId && !acctIds.has(t.fromAccountId)) {
            t.fromAccountId = null;
            lostAccounts++;
        }
    });
    if (lostCategories) issues.push(`${lostCategories} transaction(s) had no known category and were moved to "Uncategorised".`);
    if (lostAccounts) {
        issues.push(`${lostAccounts} transaction reference(s) pointed at a missing account and were reassigned to ${fallbackAccount ? '"' + target.accounts[0].name + '"' : 'no account'}.`);
    }
}

function coerceState(raw, issues) {
    const out = defaultState();
    const source = (raw && typeof raw === 'object') ? raw : {};
    const settings = (source.settings && typeof source.settings === 'object') ? source.settings : {};
    out.schemaVersion = isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 1;
    // A code Intl does not know would make every formatter throw, so it is
    // refused here rather than stored and swallowed at each call site.
    const declaredCurrency = toText(settings.currency || '').trim().toUpperCase().slice(0, 8);
    out.settings.currency = normalizeCurrency(declaredCurrency);
    if (declaredCurrency && declaredCurrency !== out.settings.currency) {
        issues.push(`"${declaredCurrency}" is not a currency code this app can format, so amounts are shown in ${out.settings.currency}.`);
    }
    out.settings.forecastHorizon = toText(settings.forecastHorizon || '12').trim() || '12';
    out.settings.chartHorizons = {};
    if (settings.chartHorizons && typeof settings.chartHorizons === 'object') {
        CHART_KEYS.forEach(key => {
            const v = settings.chartHorizons[key];
            if (v) out.settings.chartHorizons[key] = toText(v);
        });
    }
    out.settings.lastExportAt = typeof settings.lastExportAt === 'string' ? settings.lastExportAt : null;
    // migrate() drops this again if it points at a scenario the file did not carry.
    out.settings.activeScenarioId = settings.activeScenarioId ? toText(settings.activeScenarioId) : null;

    const rows = (value) => (Array.isArray(value) ? value : []).filter(r => r && typeof r === 'object');
    const dropped = { accounts: 0, categories: 0, transactions: 0 };

    out.accounts = rows(source.accounts).map((r, i) => coerceAccount(r, `Account row ${i + 1}`, issues))
        .filter(a => { if (a.name) return true; dropped.accounts++; return false; });
    out.categories = rows(source.categories).map(coerceCategory)
        .filter(c => { if (c.name) return true; dropped.categories++; return false; });
    if (out.categories.length === 0) out.categories = structuredClone(DEFAULT_CATEGORIES);
    out.transactions = rows(source.transactions).map((r, i) => coerceTransaction(r, `Transaction row ${i + 1}`, issues))
        .filter(t => { if (t.name) return true; dropped.transactions++; return false; });

    // Recorded history and what-ifs travel with the plan. Dropping them here is
    // what used to make an import quietly destroy everything the v5 panels hold.
    out.actuals   = rows(source.actuals).map(coerceActual).filter(Boolean);
    out.checkins  = rows(source.checkins).map(coerceCheckin).filter(Boolean);
    out.scenarios = rows(source.scenarios).map((r, i) => coerceScenario(r, i, issues));

    Object.keys(dropped).forEach(key => {
        if (dropped[key]) issues.push(`${dropped[key]} ${key} row(s) had no name and were skipped.`);
    });
    linkOrphans(out, issues);
    return out;
}

function importExcelArrayBuffer(ab) {
    if (typeof XLSX === 'undefined') {
        showNotice('danger', 'The spreadsheet library did not load, so Excel import is unavailable.');
        return;
    }
    let wb;
    try {
        wb = XLSX.read(ab, { type: 'array', cellDates: true });
    } catch (e) {
        showNotice('danger', 'Could not read that workbook: ' + e.message);
        return;
    }

    const issues = [];
    const raw = {
        settings: {}, accounts: [], categories: [], transactions: [],
        actuals: [], checkins: [], scenarios: []
    };

    const settingsSheet = wb.Sheets['Settings'];
    if (settingsSheet) {
        const rows = XLSX.utils.sheet_to_json(settingsSheet, { header: 1 });
        const chartHorizons = {};
        rows.slice(1).forEach(([k, v]) => {
            const key = toText(k);
            // Kept so a workbook written by a newer version is refused rather than mangled.
            if (key === 'schemaVersion')        raw.schemaVersion = parseInt(v) || 1;
            // Passed through as written so coerceState can name the code it refused.
            else if (key === 'currency')        raw.settings.currency = toText(v);
            else if (key === 'forecastHorizon') raw.settings.forecastHorizon = toText(v || '12');
            else if (key === 'forecastMonths')  raw.settings.forecastHorizon = String(parseInt(v) || 12);
            else if (key === 'activeScenarioId') raw.settings.activeScenarioId = toText(v);
            else if (key === 'chartHorizons') {
                try { Object.assign(chartHorizons, JSON.parse(toText(v))); } catch (e) { /* ignore an unreadable cell */ }
            } else if (key.indexOf('chartHorizon.') === 0) {
                chartHorizons[key.slice('chartHorizon.'.length)] = toText(v);
            }
            // 'theme' from older workbooks is ignored — the app is dark-only.
        });
        raw.settings.chartHorizons = chartHorizons;
    }

    const sheetRows = name => {
        const sheet = wb.Sheets[name];
        return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : null;
    };
    const acctRows = sheetRows('Accounts');
    if (acctRows) raw.accounts = acctRows;
    const catRows = sheetRows('Categories');
    if (catRows) raw.categories = catRows;
    const txRows = sheetRows('Transactions');
    if (txRows) raw.transactions = txRows;
    const actualRows = sheetRows('Actuals');
    if (actualRows) raw.actuals = actualRows;
    const checkinRows = sheetRows('Checkins');
    if (checkinRows) raw.checkins = checkinRows;
    const scRows = sheetRows('Scenarios');
    if (scRows) raw.scenarios = scenariosFromSheet(scRows, issues);

    let next;
    try {
        next = migrate(coerceState(raw, issues));
    } catch (e) {
        showNotice('danger', 'Could not import that workbook: ' + e.message);
        return;
    }

    snapshotForUndo('the Excel import');
    writeBackup('the Excel import');
    state = next;
    setImportIssues(issues);
    saveState();
    renderAll();
    flashWithUndo('Imported from Excel — replaced all in-browser data.');
    if (issues.length) showNotice('warning', 'Import notes: ' + issues.join(' '));
}

// The sheet holds one row per edit, so the rows are folded back into one entry
// per scenario. Shape only — coerceState is still what validates each op.
function scenariosFromSheet(rows, issues) {
    const byKey = new Map();
    const order = [];
    rows.forEach((r, i) => {
        const id = toText(r.scenarioId).trim();
        const name = toText(r.scenarioName).trim();
        if (!id && !name) return;
        const key = id || 'row:' + i;
        let scenario = byKey.get(key);
        if (!scenario) {
            scenario = { id, name, ops: [] };
            byKey.set(key, scenario);
            order.push(scenario);
        }
        if (!scenario.name && name) scenario.name = name;
        const kind = toText(r.op).trim().toLowerCase();
        if (!kind) return;
        if (kind === 'add') {
            let tx = null;
            try { tx = JSON.parse(toText(r.tx)); } catch (e) { tx = null; }
            if (!tx || typeof tx !== 'object') {
                issues.push(`Scenario "${scenario.name || scenario.id}": an added item could not be read and was left out.`);
                return;
            }
            scenario.ops.push({ op: 'add', tx });
            return;
        }
        if (kind === 'remove') {
            scenario.ops.push({ op: 'remove', txId: toText(r.txId) });
            return;
        }
        const patch = {};
        SCENARIO_PATCH_COLUMNS.forEach(field => {
            if (r[field] === undefined || r[field] === '') return;
            patch[field] = r[field];
        });
        scenario.ops.push({ op: kind, txId: toText(r.txId), patch });
    });
    return order;
}

/* Dates from a spreadsheet are only trusted when their order is unambiguous:
 * 03/04/2026 means two different days either side of the Atlantic, so it is
 * reported rather than guessed at. */
function normalizeDate(v, label, issues) {
    const note = msg => { if (issues) issues.push((label ? label + ': ' : '') + msg); };
    if (v == null || v === '') return '';
    if (v instanceof Date) return isNaN(v) ? '' : fmtDate(v);
    if (typeof v === 'number') {
        if (typeof XLSX !== 'undefined' && XLSX.SSF) {
            const d = XLSX.SSF.parse_date_code(v);
            if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
        }
        note(`could not read the date serial "${v}".`);
        return '';
    }
    const s = String(v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const ymd = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
    if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
    const slashed = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (slashed) {
        const a = parseInt(slashed[1]);
        const b = parseInt(slashed[2]);
        const year = slashed[3];
        if (a > 12 && b <= 12) return `${year}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
        if (b > 12 && a <= 12) return `${year}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
        note(`"${s}" could be either day/month or month/day. Write it as YYYY-MM-DD.`);
        return '';
    }
    if (/[a-z]/i.test(s)) {
        const d = new Date(s);
        if (!isNaN(d)) return fmtDate(d);
    }
    note(`"${s}" is not a date this app can read. Write it as YYYY-MM-DD.`);
    return '';
}

/* ───── JSON export / import ───── */

function downloadText(text, filename, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking in the same tick can cancel the download before it starts.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function markExported(what) {
    state.settings.lastExportAt = new Date().toISOString();
    saveState();
    updateStatusBar();
    flashStatus(`Exported the ${what}.`, { tone: 'positive' });
}

function exportJson() {
    downloadText(JSON.stringify(state, null, 2), `budget-${fmtDate(new Date())}.json`);
    markExported('JSON file');
}

function importJsonText(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        showNotice('danger', 'Could not read that JSON file: ' + e.message);
        return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        showNotice('danger', 'That JSON file does not look like a Cashflow Compass export.');
        return;
    }
    const issues = [];
    let next;
    try {
        next = migrate(coerceState(parsed, issues));
    } catch (e) {
        // Leaves the current data exactly as it was.
        showNotice('danger', 'Could not import that file: ' + e.message);
        return;
    }
    snapshotForUndo('the JSON import');
    writeBackup('the JSON import');
    state = next;
    setImportIssues(issues);
    saveState();
    renderAll();
    flashWithUndo('Imported JSON — replaced all in-browser data.');
    if (issues.length) showNotice('warning', 'Import notes: ' + issues.join(' '));
}

/* ───── Currency / horizon ───── */

// The picker lists a handful of common codes, but a file may legitimately carry
// any code the formatter accepts — showing a blank selection for one of those
// would read as "no currency set" when every figure on screen has one.
function syncCurrencySelect() {
    const sel = el('currencySelect');
    if (!sel) return;
    const code = normalizeCurrency(state.settings.currency);
    if (!Array.prototype.some.call(sel.options, o => o.value === code)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        sel.appendChild(option);
    }
    sel.value = code;
}

on('currencySelect', 'change', e => {
    state.settings.currency = e.target.value;
    saveState();
    renderAll();
});

on('horizonSelect', 'change', e => {
    state.settings.forecastHorizon = e.target.value;
    saveState();
    renderAll();
});

/* ───── Modal helpers ───── */

// aria-modal tells assistive technology the rest of the page is inert; without a
// real trap, a Tab key disagrees with it and walks out into the page behind.
const MODAL_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let modalReturnFocus = null;
let modalScrollLock = null;
let modalKeyHandler = null;

function modalFocusables(modal) {
    return Array.prototype.filter.call(modal.querySelectorAll(MODAL_FOCUSABLE),
        node => node.offsetWidth > 0 || node.offsetHeight > 0 || node === document.activeElement);
}

function trapModalFocus(modal) {
    modalKeyHandler = e => {
        if (e.key !== 'Tab' || !modal.isConnected) return;
        const list = modalFocusables(modal);
        if (!list.length) { e.preventDefault(); modal.focus(); return; }
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === modal || !modal.contains(active))) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (active === last || !modal.contains(active))) {
            e.preventDefault(); first.focus();
        }
    };
    document.addEventListener('keydown', modalKeyHandler, true);
}

// Title and body are always plain text; only the app's own controls are markup.
function confirmModal(title, body, onConfirm, opts = {}) {
    let mount = el('modalMount');
    if (!mount) {
        mount = document.createElement('div');
        mount.id = 'modalMount';
        document.body.appendChild(mount);
    }
    closeModal();
    modalReturnFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modalTitle');

    const heading = document.createElement('h3');
    heading.id = 'modalTitle';
    heading.textContent = title;
    const para = document.createElement('p');
    para.textContent = body;
    modal.append(heading, para);

    let select = null;
    if (opts.choices && opts.choices.length) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-bottom:16px;';
        const label = document.createElement('label');
        label.setAttribute('for', 'modalChoice');
        label.textContent = opts.choiceLabel || 'Reassign to';
        select = document.createElement('select');
        select.id = 'modalChoice';
        opts.choices.forEach(choice => {
            const option = document.createElement('option');
            option.value = choice.value;
            option.textContent = choice.label;
            select.appendChild(option);
        });
        wrap.append(label, select);
        modal.appendChild(wrap);
    }

    // A reference list rather than a question: keys on the left, what they do on
    // the right, all of it plain text.
    if (opts.items && opts.items.length) {
        const list = document.createElement('dl');
        list.style.cssText = 'margin:0 0 16px;display:grid;grid-template-columns:auto 1fr;gap:8px 14px;align-items:baseline;';
        opts.items.forEach(item => {
            const term = document.createElement('dt');
            term.style.cssText = 'margin:0;';
            const key = document.createElement('kbd');
            key.textContent = item.keys;
            key.style.cssText = 'display:inline-block;min-width:22px;padding:2px 8px;text-align:center;border-radius:6px;' +
                'font-family:' + cssVar('--font-mono', 'monospace') + ';font-size:12px;' +
                'background:' + cssVar('--bg-chrome', '#0c0f26') +
                ';border:1px solid ' + cssVar('--border', 'rgba(255,255,255,0.12)') + ';';
            term.appendChild(key);
            const detail = document.createElement('dd');
            detail.style.cssText = 'margin:0;';
            detail.textContent = item.description;
            list.append(term, detail);
        });
        modal.appendChild(list);
    }

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.id = 'mCancel';
    cancel.className = 'ghost';
    cancel.textContent = 'Cancel';
    cancel.onclick = closeModal;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.id = 'mOk';
    ok.className = opts.confirmClass || 'danger';
    ok.textContent = opts.confirmLabel || 'Confirm';
    ok.onclick = () => {
        const choice = select ? select.value : undefined;
        closeModal();
        if (typeof onConfirm === 'function') onConfirm(choice);
    };
    // A dialog that only tells you something has nothing to cancel out of.
    if (opts.dismissOnly) actions.append(ok);
    else actions.append(cancel, ok);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    overlay.onclick = e => { if (e.target === overlay) closeModal(); };
    mount.appendChild(overlay);

    // The page behind must not scroll under the dialog; the previous value is
    // kept rather than assumed, since something else may already own it.
    modalScrollLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    trapModalFocus(modal);
    ok.focus();
}

function closeModal() {
    const mount = el('modalMount');
    if (!mount || !mount.firstChild) return false;
    mount.innerHTML = '';
    if (modalKeyHandler) {
        document.removeEventListener('keydown', modalKeyHandler, true);
        modalKeyHandler = null;
    }
    if (modalScrollLock !== null) {
        document.body.style.overflow = modalScrollLock;
        modalScrollLock = null;
    }
    const returnTo = modalReturnFocus;
    modalReturnFocus = null;
    // A re-render may have replaced whatever opened the dialog, in which case
    // there is nothing to go back to and the browser's own default is better.
    if (returnTo && returnTo.isConnected && typeof returnTo.focus === 'function') {
        try { returnTo.focus(); } catch (e) { /* the trigger may be gone */ }
    }
    return true;
}

/* ───── File import handling ───── */

on('exportXlsxBtn', 'click', exportExcel);
on('exportJsonBtn', 'click', exportJson);
on('importXlsxBtn', 'click', () => triggerImport('.xlsx,.xls'));
on('importJsonBtn', 'click', () => triggerImport('.json'));

function triggerImport(accept) {
    confirmModal('Import file?',
        'This replaces all data currently in the browser with the contents of the selected file — the file is treated as the source of truth. A backup of the current data is kept, and the import can be undone.',
        () => {
            const fi = el('fileInput');
            if (!fi) {
                showNotice('danger', 'The file picker is missing from the page, so importing is unavailable.');
                return;
            }
            fi.accept = accept;
            fi.click();
        },
        { confirmLabel: 'Choose file' });
}

on('fileInput', 'change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showNotice('danger', 'The file could not be read.');
    if (file.name.toLowerCase().endsWith('.json')) {
        reader.onload = ev => importJsonText(ev.target.result);
        reader.readAsText(file);
    } else {
        reader.onload = ev => importExcelArrayBuffer(ev.target.result);
        reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
});

on('resetBtn', 'click', () => {
    confirmModal('Reset everything?',
        'All accounts, categories, and transactions will be wiped. A backup of the current data is kept, and this can be undone.',
        () => {
            snapshotForUndo('the reset');
            writeBackup('the reset');
            state = defaultState();
            saveState();
            renderAll();
            flashWithUndo('Reset complete.');
        },
        { confirmLabel: 'Reset' });
});

/* ───── Render orchestration ───── */

function renderIntroBanner() {
    const banner = el('introBanner');
    if (!banner) return;
    const isEmpty = state.accounts.length === 0 && state.transactions.length === 0;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('cc_introDismissed') === '1'; } catch (e) { /* private mode */ }
    banner.classList.toggle('hidden', !isEmpty || dismissed);
}

function loadSampleData() {
    snapshotForUndo('loading the sample data');
    if (state.accounts.length || state.transactions.length) writeBackup('the sample data');
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
    flashWithUndo('Loaded the sample budget.');
}

// The sample-data control appears both in the dismissible banner and in the
// header, so it stays reachable once the banner is gone — wire every copy.
document.querySelectorAll('.load-sample, #loadSampleBtn, #introLoadSampleBtn, [data-load-sample]')
    .forEach(btn => btn.addEventListener('click', loadSampleData));

on('dismissIntroBtn', 'click', () => {
    try { sessionStorage.setItem('cc_introDismissed', '1'); } catch (e) { /* private mode */ }
    renderIntroBanner();
});

/* ───── Keyboard ───── */

// Single keys, so every one of them is off while the caret is in a field —
// otherwise "e" could not be typed into a transaction name.
function isTypingTarget(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.isContentEditable) return true;
    return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT';
}

function modalIsOpen() {
    const mount = el('modalMount');
    return !!(mount && mount.firstChild);
}

const SHORTCUTS = [
    { keys: '/', description: 'Jump to the transaction search box' },
    { keys: 'e', description: 'Export an Excel workbook' },
    { keys: 'j', description: 'Export a JSON file' },
    { keys: '?', description: 'Show this list' },
    { keys: 'Esc', description: 'Close a dialog, or cancel the edit in progress' }
];

function showShortcutHelp() {
    confirmModal('Keyboard shortcuts',
        'These work anywhere on the page except while you are typing in a field.',
        null,
        { items: SHORTCUTS, dismissOnly: true, confirmLabel: 'Close', confirmClass: 'primary' });
}

// The search box lives inside a section that can be collapsed, and focusing a
// hidden input does nothing at all.
function focusTransactionSearch() {
    const body = el('txBody');
    const toggle = el('txToggle');
    if (body && body.classList.contains('hidden') && toggle) toggle.click();
    const search = el('txSearch');
    if (!search) return;
    scrollSectionIntoView('section-transactions');
    search.focus();
    search.select();
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (closeModal()) return;
        if (editingTxId) { cancelTxEdit(); return; }
        if (editingAcctId) { cancelAccountEdit(); return; }
        if (editingCatId) { cancelCategoryEdit(); }
        return;
    }
    // A modifier means the key belongs to the browser or the OS, not to us.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTypingTarget(e.target) || modalIsOpen()) return;
    const key = e.key.toLowerCase();
    if (e.key === '/') { e.preventDefault(); focusTransactionSearch(); }
    else if (e.key === '?') { e.preventDefault(); showShortcutHelp(); }
    else if (key === 'e') { e.preventDefault(); exportExcel(); }
    else if (key === 'j') { e.preventDefault(); exportJson(); }
});

function renderAll() {
    syncCurrencySelect();
    setVal('horizonSelect', state.settings.forecastHorizon);
    refreshSelects();
    refreshChartHorizonSelects();
    renderIntroBanner();
    renderAccounts();
    renderCategories();

    const months = resolveHorizon(state.settings.forecastHorizon);
    let forecast = null;
    try {
        forecast = buildForecast(months);
        if (!saveBlocked) setGlobalError('');
    } catch (e) {
        console.error('Could not build the forecast', e);
        setGlobalError('The forecast could not be built.', e.message);
        showNotice('danger', 'The forecast could not be built: ' + e.message);
    }
    currentForecast = forecast;
    renderTransactions();
    if (forecast) {
        renderForecast(forecast);
        // Insights before charts: they need no charting library, and must not
        // be taken down by one that failed to load.
        renderInsights(forecast);
        renderDebtSchedule(forecast);
        renderCharts(forecast);
    }
    updateTxFormAvailability();
    updateStatusBar();
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ───── Boot ───── */

ensureStatusUI();
state = loadState();

setVal('acctAsOf', fmtDate(new Date()));
setVal('txStart', fmtDate(new Date()));
renderAll();
onKindOrFreqChange();
setSaveIndicator(saveBlocked ? 'blocked' : 'saved');
maybeRemindExport();

// A debounced save must not be lost when the tab goes away.
window.addEventListener('pagehide', flushSave);
window.addEventListener('beforeunload', flushSave);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
});

// A second tab writing the same key means this tab's copy is now stale.
window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY || e.newValue == null || crossTabWarned) return;
    crossTabWarned = true;
    showNotice('warning', 'Another tab saved a different copy of this budget. Reload to pick it up, or keep working here — saving from this tab will overwrite that copy.', [
        { label: 'Reload', onClick: () => location.reload() }
    ]);
});

initDurableStorage();

// Offline shell. A service worker needs a secure context, so this does nothing
// when the app is opened straight off the disk over file:// — that path still
// works, it just has no offline cache to fall back on. Registration is
// deliberately deferred to load so it never competes with the first render.
if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // An unregistered worker costs the user nothing but the offline
            // cache, so a failure here is not worth interrupting them over.
        });
    });
}
