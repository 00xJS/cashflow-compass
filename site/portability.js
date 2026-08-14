/* =========================================================
   Cashflow Compass — portability
   Live file mode over the File System Access API, and optional
   passphrase-encrypted exports over WebCrypto.
   Loads after app.js and reaches it only through globals.
   ========================================================= */

(function () {
    'use strict';

    // Loading the file twice must not stack two wrappers on renderAll.
    if (window.ccPortabilityReady) return;
    window.ccPortabilityReady = true;

    /* ───── Capabilities ─────
     * Both features are Chromium-and-secure-context only. Neither is ever the
     * only way to get data out: the export and import buttons stay the
     * supported path everywhere, and nothing below changes them.
     */

    const PORT_SECURE = window.isSecureContext === true;
    const PORT_FILE_ORIGIN = location.protocol === 'file:';
    const PORT_HAS_FS = ('showSaveFilePicker' in window) &&
        typeof window.showSaveFilePicker === 'function' &&
        typeof window.showOpenFilePicker === 'function';
    const PORT_HAS_CRYPTO = !!(window.crypto && window.crypto.subtle &&
        typeof window.crypto.subtle.deriveKey === 'function' &&
        typeof window.crypto.getRandomValues === 'function');

    const PORT_FS_UNAVAILABLE = PORT_FILE_ORIGIN
        ? 'This page was opened straight from a folder, and no browser hands a file:// page write access to a file — serve the folder over http://localhost, or keep using the export and import buttons, which work everywhere.'
        : (!PORT_SECURE
            ? 'This page is not on a secure origin, and a browser only offers a page write access to a file over https or localhost — the export and import buttons are unaffected and work everywhere.'
            : 'This browser cannot give a page write access to a file on your computer — that exists only in Chromium browsers (Chrome, Edge, Brave, Opera, Arc), so the export and import buttons remain the way to move data here.');

    const PORT_CRYPTO_UNAVAILABLE = PORT_FILE_ORIGIN
        ? 'The browser withholds its encryption engine from pages opened straight from a folder, so this is unavailable here — serve the folder over http://localhost to use it.'
        : (!PORT_SECURE
            ? 'The browser withholds its encryption engine from pages that are not on a secure origin, so this is unavailable here — https or localhost enables it.'
            : 'This browser does not expose the encryption engine this needs, so encrypted export is unavailable here.');

    /* ───── Constants ───── */

    const PORT_STYLE_ID = 'portabilityStyles';
    const PORT_MOUNT_ID = 'panelPortability';

    const PORT_DB_NAME  = 'cashflow-compass-portability';
    const PORT_DB_STORE = 'handles';
    const PORT_DB_KEY   = 'liveFile';

    const PORT_WRITE_DEBOUNCE = 400;    // settle after a burst of edits
    const PORT_WRITE_MIN_GAP  = 1000;   // never more than one write a second
    // A plain debounce can be starved forever by someone who keeps typing, so a
    // queued write is never held back longer than this.
    const PORT_WRITE_MAX_WAIT = 5000;

    const PORT_ENC_FORMAT = 'compass-encrypted';
    const PORT_ENC_VERSION = 1;
    const PORT_KDF = 'PBKDF2-SHA256';
    // The floor for this project is 250,000 rounds; this is the current OWASP
    // figure for PBKDF2-SHA256 and is written into every file it produces.
    const PORT_ITERATIONS = 310000;
    // A hostile file could otherwise ask for a billion rounds and hang the tab.
    const PORT_MAX_ITERATIONS = 5000000;
    const PORT_SALT_BYTES = 16;
    const PORT_IV_BYTES = 12;
    const PORT_MIN_PASS = 10;

    /* ───── Small helpers ───── */

    function portEl(id) { return document.getElementById(id); }
    function portSetText(id, text) { const n = portEl(id); if (n) n.textContent = text; }
    function portShow(id, visible) { const n = portEl(id); if (n) n.classList.toggle('hidden', !visible); }
    function portOn(id, event, handler) { const n = portEl(id); if (n) n.addEventListener(event, handler); }

    function portFlash(msg, tone) {
        if (typeof flashStatus === 'function') flashStatus(msg, { tone: tone || 'info' });
        else console.log('[Cashflow Compass]', msg);
    }
    function portNotice(tone, msg, actions) {
        if (typeof showNotice === 'function') return showNotice(tone, msg, actions || []);
        console.warn('[Cashflow Compass]', msg);
        return null;
    }

    // Errors this file raises deliberately carry text meant for a person.
    function portFriendly(message) {
        const err = new Error(message);
        err.portFriendly = true;
        return err;
    }
    function portErrorText(e) {
        if (!e) return 'Unknown problem.';
        if (e.portFriendly) return e.message;
        if (e.name === 'NotAllowedError') return 'The browser withdrew permission for that file.';
        if (e.name === 'NotFoundError') return 'That file is no longer where it was — it may have been moved, renamed or deleted.';
        if (e.name === 'NoModificationAllowedError') return 'Another program is holding that file open for writing.';
        if (e.name === 'QuotaExceededError') return 'There is no room left on the disk for that file.';
        return e.message || String(e);
    }
    function portIsAbort(e) { return !!e && (e.name === 'AbortError' || e.name === 'NotAllowedError' && e.message && /user/i.test(e.message)); }
    function portIsPermissionError(e) { return !!e && (e.name === 'NotAllowedError' || e.name === 'SecurityError'); }

    function portClock(date) {
        try {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            return date.toTimeString().slice(0, 8);
        }
    }

    function portToday() {
        return (typeof fmtDate === 'function') ? fmtDate(new Date()) : new Date().toISOString().slice(0, 10);
    }

    function portDownload(text, filename) {
        if (typeof downloadText === 'function') { downloadText(text, filename); return; }
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function portStateJson(pretty) {
        if (typeof state === 'undefined' || !state) throw portFriendly('There is no data loaded to write.');
        return JSON.stringify(state, null, pretty ? 2 : 0);
    }

    /* ───── Styles ─────
     * One keyed element, built from the deck's own custom properties so the
     * panel inherits every future change to them.
     */

    function portInjectStyles() {
        if (portEl(PORT_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = PORT_STYLE_ID;
        style.textContent = [
            '.port-grid { display: grid; gap: 14px; }',
            '.port-block { border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--bg-raised); padding: 14px 16px; }',
            '.port-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 9px; }',
            '.port-title { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text); }',
            '.port-status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--card-chrome); font-family: var(--font-mono); font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }',
            '.port-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--faint); }',
            '.port-status.is-live { color: var(--live); border-color: rgba(61, 220, 132, 0.45); }',
            '.port-status.is-live::before { background: var(--live); }',
            '.port-status.is-warn { color: var(--warn); border-color: rgba(255, 194, 75, 0.45); }',
            '.port-status.is-warn::before { background: var(--warn); }',
            '.port-status.is-down { color: var(--down); border-color: rgba(255, 107, 107, 0.45); }',
            '.port-status.is-down::before { background: var(--down); }',
            '.port-copy { margin: 0 0 10px; max-width: 74ch; font-size: 12.5px; line-height: 1.5; color: var(--muted); }',
            '.port-copy:last-child { margin-bottom: 0; }',
            '.port-copy strong { color: var(--text); font-weight: 600; }',
            '.port-file { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--card); }',
            '.port-filename { font-family: var(--font-mono); font-size: 12.5px; color: var(--text); word-break: break-all; }',
            '.port-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--faint); white-space: nowrap; }',
            '.port-note { margin: 0 0 10px; padding: 10px 12px; border: 1px solid var(--border); border-left: 3px solid var(--info); border-radius: var(--radius-control); background: var(--card); font-size: 12.5px; line-height: 1.5; color: var(--muted); max-width: 74ch; }',
            '.port-note strong { color: var(--text); }',
            '.port-note.warn { border-left-color: var(--warn); }',
            '.port-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }',
            '.port-actions:last-child { margin-bottom: 0; }',
            '.port-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 8px; }',
            '.port-check { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 10px; }',
            '.port-check input { flex: none; width: 15px; height: 15px; margin-top: 2px; accent-color: var(--accent); }',
            /* The page's label rule is a mono micro-label; a sentence beside a checkbox is not. */
            '.port-check label { margin: 0; font-family: var(--font-sans); font-size: 12.5px; font-weight: 400; line-height: 1.45; letter-spacing: 0; text-transform: none; color: var(--muted); }',
            '.port-modal-fields { display: grid; gap: 12px; margin-bottom: 10px; }',
            '@media (max-width: 700px) { .port-actions button { flex: 1 1 auto; } }'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ───── Handle store ─────
     * A FileSystemFileHandle is structured-cloneable, so IndexedDB can keep it
     * across reloads. Its own database, so it can never collide with the one
     * app.js uses for the budget itself.
     */

    let portDb = null;
    let portDbTried = false;

    function portOpenDb() {
        return new Promise(resolve => {
            if (portDb) { resolve(portDb); return; }
            if (portDbTried && !portDb) { resolve(null); return; }
            portDbTried = true;
            let req;
            try {
                if (typeof indexedDB === 'undefined') { resolve(null); return; }
                req = indexedDB.open(PORT_DB_NAME, 1);
            } catch (e) { resolve(null); return; }
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(PORT_DB_STORE)) db.createObjectStore(PORT_DB_STORE);
            };
            req.onsuccess = () => { portDb = req.result; resolve(portDb); };
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        });
    }

    async function portDbGet() {
        const db = await portOpenDb();
        if (!db) return null;
        return new Promise(resolve => {
            try {
                const req = db.transaction(PORT_DB_STORE, 'readonly').objectStore(PORT_DB_STORE).get(PORT_DB_KEY);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            } catch (e) { resolve(null); }
        });
    }

    async function portDbPut(record) {
        const db = await portOpenDb();
        if (!db) return false;
        return new Promise(resolve => {
            try {
                const tx = db.transaction(PORT_DB_STORE, 'readwrite');
                tx.objectStore(PORT_DB_STORE).put(record, PORT_DB_KEY);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
                tx.onabort = () => resolve(false);
            } catch (e) { resolve(false); }
        });
    }

    async function portDbClear() {
        const db = await portOpenDb();
        if (!db) return;
        try {
            const tx = db.transaction(PORT_DB_STORE, 'readwrite');
            tx.objectStore(PORT_DB_STORE).delete(PORT_DB_KEY);
        } catch (e) { /* nothing kept means nothing to clear */ }
    }

    /* ───── Live file ───── */

    // { handle, name, kind: 'json'|'xlsx', status, lastWrittenAt, error }
    let portLive = null;
    let portWriteTimer = null;
    let portWriteQueued = false;
    let portWriteQueuedSince = 0;
    let portWriteInFlight = false;
    let portLastWriteStart = 0;
    let portLastSignature = null;   // the state as written, so an unchanged save writes nothing
    let portWriteErrorShown = false;

    function portConnected() { return !!portLive && portLive.status === 'connected'; }

    function portKindFor(name) {
        return /\.xlsx$/i.test(String(name || '')) ? 'xlsx' : 'json';
    }

    function portRequestPermission(handle) {
        // Called straight out of a click: no await runs before it, so the
        // browser still sees the user's gesture.
        try {
            if (typeof handle.requestPermission !== 'function') return Promise.resolve('granted');
            return handle.requestPermission({ mode: 'readwrite' }).catch(() => 'denied');
        } catch (e) { return Promise.resolve('denied'); }
    }

    function portQueryPermission(handle) {
        try {
            if (typeof handle.queryPermission !== 'function') return Promise.resolve('prompt');
            return handle.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt');
        } catch (e) { return Promise.resolve('prompt'); }
    }

    // exportExcel owns the workbook's shape. Borrowing it keeps the live file
    // byte-for-byte the document the export button produces, instead of a
    // second copy of that layout drifting away from it.
    function portWorkbookBytes() {
        if (typeof XLSX === 'undefined' || !XLSX || typeof XLSX.write !== 'function' || typeof XLSX.writeFile !== 'function') {
            throw portFriendly('The spreadsheet library is not loaded, so the workbook cannot be written. Connect a .json file instead.');
        }
        if (typeof exportExcel !== 'function') throw portFriendly('The workbook builder is missing from this build.');
        const realWriteFile = XLSX.writeFile;
        const realMarkExported = typeof markExported === 'function' ? markExported : null;
        let captured = null;
        try {
            XLSX.writeFile = function (wb) { captured = wb; };
            // A live write is not an export: it must not touch the export age
            // or announce itself once a second.
            if (realMarkExported) markExported = function () {};
            exportExcel();
        } finally {
            XLSX.writeFile = realWriteFile;
            if (realMarkExported) markExported = realMarkExported;
        }
        if (!captured) throw portFriendly('The workbook could not be built from the current data.');
        return XLSX.write(captured, { bookType: 'xlsx', type: 'array' });
    }

    async function portWriteToHandle(handle, kind) {
        const writable = await handle.createWritable();
        try {
            if (kind === 'xlsx') await writable.write(new Blob([portWorkbookBytes()]));
            else await writable.write(portStateJson(true));
            await writable.close();
        } catch (e) {
            try { await writable.abort(); } catch (e2) { /* the failed write is the news */ }
            throw e;
        }
    }

    function portScheduleWrite() {
        try {
            if (!portConnected()) return;
            if (!portWriteQueued) portWriteQueuedSince = Date.now();
            portWriteQueued = true;
            if (portWriteInFlight) return;      // the running write picks it up on its way out
            clearTimeout(portWriteTimer);
            const now = Date.now();
            // The gap is the hard limit; the debounce only ever delays inside it,
            // and the cap stops a long burst of edits from delaying it forever.
            const gap = Math.max(0, PORT_WRITE_MIN_GAP - (now - portLastWriteStart));
            const capLeft = Math.max(0, portWriteQueuedSince + PORT_WRITE_MAX_WAIT - now);
            portWriteTimer = setTimeout(portRunWriteSafe, Math.max(gap, Math.min(PORT_WRITE_DEBOUNCE, capLeft)));
        } catch (e) { console.warn('Live file write could not be scheduled', e); }
    }

    // Nothing that runs off a timer may reject into the void.
    function portRunWriteSafe() {
        portRunWrite().catch(e => console.warn('Live file write failed', e));
    }

    // The page is going away or being hidden: the rate limit has nothing left to
    // protect, so spend the last moment writing.
    function portFlushWrite() {
        if (!portWriteQueued || portWriteInFlight || !portConnected()) return;
        clearTimeout(portWriteTimer);
        portWriteTimer = null;
        portRunWriteSafe();
    }

    async function portRunWrite() {
        portWriteTimer = null;
        if (portWriteInFlight || !portWriteQueued || !portConnected()) return;
        portWriteQueued = false;
        portWriteQueuedSince = 0;
        let signature;
        try {
            signature = portStateJson(false);
        } catch (e) {
            portLive.error = portErrorText(e);
            portRefresh();
            return;
        }
        // Nothing changed since the last successful write, so the cloud folder
        // has nothing to sync and the file's timestamp stays honest.
        if (signature === portLastSignature) return;

        portWriteInFlight = true;
        portLastWriteStart = Date.now();
        try {
            const perm = await portQueryPermission(portLive.handle);
            if (perm !== 'granted') throw portFriendly('The browser is waiting for you to allow writing to that file again.');
            await portWriteToHandle(portLive.handle, portLive.kind);
            portLastSignature = signature;
            portLive.lastWrittenAt = new Date();
            portLive.error = '';
            portWriteErrorShown = false;
        } catch (e) {
            portLive.error = portErrorText(e);
            if (portIsPermissionError(e) || e.portFriendly) portLive.status = 'needs-permission';
            if (!portWriteErrorShown) {
                portWriteErrorShown = true;
                portNotice('warning', 'Could not write the connected file: ' + portLive.error +
                    ' Your data is still saved in this browser.');
            }
        } finally {
            portWriteInFlight = false;
            portRefresh();
            if (portWriteQueued) portScheduleWrite();
        }
    }

    async function portAdopt(handle, kind) {
        portLive = {
            handle: handle,
            name: handle.name || 'file',
            kind: kind || portKindFor(handle.name),
            status: 'connected',
            lastWrittenAt: null,
            error: ''
        };
        portLastSignature = null;
        portWriteErrorShown = false;
        const kept = await portDbPut({
            handle: handle,
            name: portLive.name,
            kind: portLive.kind,
            connectedAt: new Date().toISOString()
        });
        if (!kept) {
            portNotice('warning', 'This browser would not keep a reference to that file, so the connection lasts until you reload.');
        }
        portRefresh();
    }

    async function portConnectNew() {
        if (!PORT_HAS_FS) return;
        let handle;
        try {
            handle = await window.showSaveFilePicker({
                suggestedName: 'cashflow-compass.json',
                types: [
                    { description: 'Cashflow Compass data (JSON)', accept: { 'application/json': ['.json'] } },
                    { description: 'Excel workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }
                ]
            });
        } catch (e) {
            if (portIsAbort(e)) return;
            portNotice('danger', 'Could not connect that file: ' + portErrorText(e));
            return;
        }
        await portAdopt(handle);
        portWriteQueued = true;
        portFlushWrite();
        portFlash('Connected ' + portLive.name + ' — every save now writes it too.', 'positive');
    }

    async function portConnectExisting() {
        if (!PORT_HAS_FS) return;
        let handles;
        try {
            handles = await window.showOpenFilePicker({
                multiple: false,
                types: [
                    { description: 'Cashflow Compass data', accept: { 'application/json': ['.json'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }
                ]
            });
        } catch (e) {
            if (portIsAbort(e)) return;
            portNotice('danger', 'Could not open that file: ' + portErrorText(e));
            return;
        }
        const handle = handles && handles[0];
        if (!handle) return;

        const perm = await portRequestPermission(handle);
        if (perm !== 'granted') {
            portNotice('warning', 'Without permission to write that file, it cannot be the live copy — the export buttons still work.');
            return;
        }

        const kind = portKindFor(handle.name);
        if (kind === 'json') {
            // An encrypted export must never become the live file: every save
            // would write plain text over it and quietly strip its protection.
            let text = '';
            try { text = await (await handle.getFile()).text(); } catch (e) { text = ''; }
            if (portParseEnvelope(text)) {
                portNotice('warning', 'That file is an encrypted export. Live mode writes plain text, so connecting it would strip the encryption — open it with Import JSON instead.');
                return;
            }
        }
        portAskDirection(handle, kind);
    }

    // The file already holds something and so does the browser. Which one wins
    // is the user's call, and it has to be made before the next save.
    function portAskDirection(handle, kind) {
        const apply = choice => {
            portAdopt(handle, kind).then(() => {
                if (choice === 'write') {
                    portWriteQueued = true;
                    portFlushWrite();
                    portFlash('Connected ' + handle.name + ' — every save now writes it too.', 'positive');
                } else {
                    portLoadFromFile();
                }
            });
        };
        if (typeof confirmModal !== 'function') {
            // Loading can be undone and leaves a backup; overwriting the file
            // cannot. Without the dialog, take the reversible one.
            apply('load');
            return;
        }
        confirmModal('Connect ' + handle.name + '?',
            'That file already has something in it, and so does this browser. Choose which copy wins right now — from then on, every change here is written to the file.',
            choice => apply(choice),
            {
                choices: [
                    { value: 'load', label: 'Load the file into the app (replaces what is in the browser)' },
                    { value: 'write', label: 'Overwrite the file with what is in the browser' }
                ],
                choiceLabel: 'Which copy wins',
                confirmLabel: 'Connect'
            });
    }

    async function portLoadFromFile() {
        if (!portLive || !portLive.handle) return;
        let file;
        try {
            file = await portLive.handle.getFile();
        } catch (e) {
            portLive.error = portErrorText(e);
            if (portIsPermissionError(e)) portLive.status = 'needs-permission';
            portRefresh();
            portNotice('danger', 'Could not read the connected file: ' + portLive.error);
            return;
        }
        try {
            if (portLive.kind === 'xlsx') {
                if (typeof importExcelArrayBuffer !== 'function') throw portFriendly('The workbook reader is missing from this build.');
                importExcelArrayBuffer(await file.arrayBuffer());
            } else {
                const text = await file.text();
                if (portParseEnvelope(text)) {
                    portNotice('warning', 'The connected file now holds an encrypted export. Use Import JSON to open it — loading it here would write plain text back over it.');
                    return;
                }
                if (typeof portBaseImportJson !== 'function') throw portFriendly('The JSON reader is missing from this build.');
                portBaseImportJson(text);
            }
            portLive.error = '';
            portRefresh();
        } catch (e) {
            portNotice('danger', 'Could not read the connected file: ' + portErrorText(e));
        }
    }

    function portDisconnect() {
        const name = portLive ? portLive.name : 'the file';
        clearTimeout(portWriteTimer);
        portWriteTimer = null;
        portWriteQueued = false;
        portLive = null;
        portLastSignature = null;
        portDbClear();
        portRefresh();
        portFlash('Disconnected ' + name + '. It stays exactly as it was last written.');
    }

    // On reload the handle comes back, but the permission does not. Asking for
    // it needs a click, so boot only ever looks — it never prompts.
    async function portRestoreConnection() {
        if (!PORT_HAS_FS) return;
        const record = await portDbGet();
        if (!record || !record.handle) return;
        portLive = {
            handle: record.handle,
            name: record.name || record.handle.name || 'file',
            kind: record.kind || portKindFor(record.name),
            status: 'needs-permission',
            lastWrittenAt: null,
            error: ''
        };
        const perm = await portQueryPermission(record.handle);
        if (perm === 'granted') portLive.status = 'connected';
        portRefresh();
    }

    async function portReconnect() {
        if (!portLive || !portLive.handle) return;
        const perm = await portRequestPermission(portLive.handle);
        if (perm !== 'granted') {
            portNotice('warning', 'The browser did not grant access to ' + portLive.name + ', so it is not being written.');
            return;
        }
        portLive.status = 'connected';
        portLive.error = '';
        portWriteErrorShown = false;
        portRefresh();
        portNotice('info', 'Reconnected to ' + portLive.name + '. If another device changed it since, load from the file before you edit anything here — the newest save wins, and nothing merges the two.', [
            { label: 'Load from file', onClick: portLoadFromFile }
        ]);
    }

    /* ───── Encryption ─────
     * Only ever applied to a file being written out. The copy in this browser
     * stays readable: encrypting the live store would turn one forgotten
     * passphrase into a locked budget.
     */

    function portBytesToBase64(bytes) {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function portBase64ToBytes(text, label) {
        if (typeof text !== 'string' || !text) throw portFriendly('This file is missing its ' + label + ', so it cannot be opened.');
        let binary;
        try { binary = atob(text); } catch (e) { throw portFriendly('This file\'s ' + label + ' is damaged, so it cannot be opened.'); }
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    }

    async function portDeriveKey(passphrase, salt, iterations) {
        const material = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']);
    }

    async function portEncrypt(plaintext, passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(PORT_SALT_BYTES));
        const iv = crypto.getRandomValues(new Uint8Array(PORT_IV_BYTES));
        const key = await portDeriveKey(passphrase, salt, PORT_ITERATIONS);
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(plaintext));
        return {
            format: PORT_ENC_FORMAT,
            v: PORT_ENC_VERSION,
            kdf: PORT_KDF,
            iterations: PORT_ITERATIONS,
            salt: portBytesToBase64(salt),
            iv: portBytesToBase64(iv),
            ciphertext: portBytesToBase64(new Uint8Array(cipher))
        };
    }

    async function portDecrypt(envelope, passphrase) {
        if (Number(envelope.v) !== PORT_ENC_VERSION) {
            throw portFriendly('This encrypted file was written in a format this version does not know (v' +
                String(envelope.v) + '). Update the app and try again.');
        }
        if (String(envelope.kdf) !== PORT_KDF) {
            throw portFriendly('This encrypted file uses a key recipe this version does not know (' +
                String(envelope.kdf) + ').');
        }
        const iterations = Math.floor(Number(envelope.iterations));
        if (!isFinite(iterations) || iterations < 1000 || iterations > PORT_MAX_ITERATIONS) {
            throw portFriendly('This file asks for an unreasonable amount of work to open it, so it was not attempted.');
        }
        const salt = portBase64ToBytes(envelope.salt, 'salt');
        const iv = portBase64ToBytes(envelope.iv, 'starting value');
        const cipher = portBase64ToBytes(envelope.ciphertext, 'contents');
        if (salt.length < 8 || iv.length !== PORT_IV_BYTES || cipher.length === 0) {
            throw portFriendly('This file\'s encryption header is damaged, so it cannot be opened.');
        }
        const key = await portDeriveKey(passphrase, salt, iterations);
        // Every failure past here — wrong passphrase, edited file — arrives as
        // the same opaque rejection, which is exactly what it should be.
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
        return new TextDecoder().decode(plain);
    }

    function portParseEnvelope(text) {
        if (typeof text !== 'string' || text.indexOf(PORT_ENC_FORMAT) === -1) return null;
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { return null; }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        if (parsed.format !== PORT_ENC_FORMAT) return null;
        return parsed;
    }

    function portPassphraseProblem(pass) {
        if (typeof pass !== 'string' || pass.length === 0) return 'Type a passphrase.';
        if (pass.length < PORT_MIN_PASS) {
            return 'Use at least ' + PORT_MIN_PASS + ' characters — this is the only thing between the file and anyone who ends up with it.';
        }
        return '';
    }

    // Public: encrypt the current data and hand back a file. Called with no
    // passphrase, it asks for one.
    async function exportEncryptedJson(passphrase) {
        if (!PORT_HAS_CRYPTO) {
            portNotice('warning', PORT_CRYPTO_UNAVAILABLE);
            return false;
        }
        let pass = typeof passphrase === 'string' ? passphrase : '';
        if (!pass) {
            pass = await portPassphrasePrompt({
                title: 'Encrypt this export',
                body: 'Choose a passphrase. It is used to scramble the file as it is written, and nothing else changes — the copy in this browser stays as it is.',
                warningLead: 'A forgotten passphrase cannot be recovered.',
                warning: 'There is no reset, no recovery code and no back door, by design. Lose it and that file is gone for good.',
                confirmLabel: 'Encrypt and download',
                twoFields: true,
                ack: 'I understand that if I forget this passphrase, nobody — including this app — can open the file again.'
            });
            if (pass == null) return false;
        }
        const problem = portPassphraseProblem(pass);
        if (problem) { portNotice('warning', problem); return false; }

        let envelope;
        try {
            envelope = await portEncrypt(portStateJson(false), pass);
        } catch (e) {
            portNotice('danger', 'The file could not be encrypted: ' + portErrorText(e));
            return false;
        }
        portDownload(JSON.stringify(envelope, null, 2), 'budget-' + portToday() + '-encrypted.json');
        if (typeof markExported === 'function') markExported('encrypted JSON file');
        else portFlash('Exported the encrypted JSON file.', 'positive');
        return true;
    }

    // Public: hand any imported text here first. Returns true when the text was
    // an encrypted envelope and this file has taken the import over — the caller
    // should stop. Returns false for ordinary JSON, which the caller then
    // handles exactly as before.
    function tryDecryptImport(text) {
        const envelope = portParseEnvelope(text);
        if (!envelope) return false;
        if (!PORT_HAS_CRYPTO) {
            portNotice('warning', 'That file is an encrypted export, but ' +
                PORT_CRYPTO_UNAVAILABLE.charAt(0).toLowerCase() + PORT_CRYPTO_UNAVAILABLE.slice(1));
            return true;
        }
        (async () => {
            const pass = await portPassphrasePrompt({
                title: 'This file is encrypted',
                body: 'Type the passphrase it was written with. Nothing is replaced until it opens.',
                confirmLabel: 'Decrypt and import',
                twoFields: false
            });
            if (pass == null) { portFlash('Import cancelled — nothing was changed.'); return; }
            let plaintext;
            try {
                plaintext = await portDecrypt(envelope, pass);
            } catch (e) {
                portNotice('danger', e && e.portFriendly ? e.message
                    : 'That passphrase did not decrypt this file. Nothing was changed — check the passphrase and try again.');
                return;
            }
            if (typeof portBaseImportJson === 'function') portBaseImportJson(plaintext);
            else portNotice('danger', 'The file decrypted, but the importer is missing from this build.');
        })();
        return true;
    }

    /* ───── Passphrase dialog ─────
     * Its own mount, so app.js's modal and this one can never clear each other.
     */

    function portPassphrasePrompt(opts) {
        return new Promise(resolve => {
            portInjectStyles();
            let mount = portEl('portModalMount');
            if (!mount) {
                mount = document.createElement('div');
                mount.id = 'portModalMount';
                document.body.appendChild(mount);
            }
            mount.textContent = '';
            const returnFocus = document.activeElement;

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'portModalTitle');

            const heading = document.createElement('h3');
            heading.id = 'portModalTitle';
            heading.textContent = opts.title;
            const body = document.createElement('p');
            body.textContent = opts.body;
            modal.append(heading, body);

            if (opts.warning) {
                const warn = document.createElement('div');
                warn.className = 'port-note warn';
                const lead = document.createElement('strong');
                lead.textContent = opts.warningLead || '';
                warn.append(lead, document.createTextNode(' ' + opts.warning));
                modal.appendChild(warn);
            }

            const fields = document.createElement('div');
            fields.className = 'port-modal-fields';
            const first = portPasswordField('portModalPass1', 'Passphrase', fields);
            const second = opts.twoFields ? portPasswordField('portModalPass2', 'Passphrase again', fields) : null;
            modal.appendChild(fields);

            const error = document.createElement('span');
            error.className = 'field-error';
            modal.appendChild(error);

            const showRow = document.createElement('div');
            showRow.className = 'port-check';
            const showBox = document.createElement('input');
            showBox.type = 'checkbox';
            showBox.id = 'portModalShow';
            const showLabel = document.createElement('label');
            showLabel.setAttribute('for', 'portModalShow');
            showLabel.textContent = 'Show what I am typing';
            showBox.addEventListener('change', () => {
                const type = showBox.checked ? 'text' : 'password';
                first.type = type;
                if (second) second.type = type;
            });
            showRow.append(showBox, showLabel);
            modal.appendChild(showRow);

            let ackBox = null;
            if (opts.ack) {
                const ackRow = document.createElement('div');
                ackRow.className = 'port-check';
                ackBox = document.createElement('input');
                ackBox.type = 'checkbox';
                ackBox.id = 'portModalAck';
                const ackLabel = document.createElement('label');
                ackLabel.setAttribute('for', 'portModalAck');
                ackLabel.textContent = opts.ack;
                ackRow.append(ackBox, ackLabel);
                modal.appendChild(ackRow);
            }

            const actions = document.createElement('div');
            actions.className = 'form-actions';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'ghost';
            cancel.textContent = 'Cancel';
            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'primary';
            ok.textContent = opts.confirmLabel || 'Continue';
            actions.append(cancel, ok);
            modal.appendChild(actions);

            overlay.appendChild(modal);
            mount.appendChild(overlay);

            let settled = false;
            function close(value) {
                if (settled) return;
                settled = true;
                mount.textContent = '';
                document.removeEventListener('keydown', onKeyDown, true);
                if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
                resolve(value);
            }
            function submit() {
                const value = first.value;
                if (opts.twoFields) {
                    const problem = portPassphraseProblem(value);
                    if (problem) { error.textContent = problem; first.focus(); return; }
                    if (second && second.value !== value) {
                        error.textContent = 'The two passphrases are not the same.';
                        second.focus();
                        return;
                    }
                    if (ackBox && !ackBox.checked) {
                        error.textContent = 'Tick the box to confirm you understand a forgotten passphrase cannot be recovered.';
                        ackBox.focus();
                        return;
                    }
                } else if (!value) {
                    error.textContent = 'Type the passphrase this file was written with.';
                    first.focus();
                    return;
                }
                close(value);
            }
            // Escape and Tab are handled here so neither reaches the page behind.
            function onKeyDown(e) {
                if (!modal.isConnected) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(null);
                    return;
                }
                if (e.key === 'Tab') {
                    const focusable = modal.querySelectorAll('input, button');
                    if (!focusable.length) return;
                    const firstEl = focusable[0];
                    const lastEl = focusable[focusable.length - 1];
                    if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
                    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
                }
            }
            modal.addEventListener('keydown', e => {
                if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
                    e.preventDefault();
                    submit();
                }
            });
            document.addEventListener('keydown', onKeyDown, true);
            overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
            cancel.addEventListener('click', () => close(null));
            ok.addEventListener('click', submit);
            first.focus();
        });
    }

    function portPasswordField(id, labelText, parent) {
        const wrap = document.createElement('div');
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'password';
        input.id = id;
        input.autocomplete = 'new-password';
        input.spellcheck = false;
        wrap.append(label, input);
        parent.appendChild(wrap);
        return input;
    }

    /* ───── Panel ───── */

    const PORT_PANEL_HTML =
        '<div class="port-grid">' +
            '<div class="port-block">' +
                '<div class="port-head">' +
                    '<span class="port-title">Live file</span>' +
                    '<span class="port-status" id="portLiveStatus">Not connected</span>' +
                '</div>' +
                '<p class="port-copy">Connect a file on this computer and every save writes it as well as the browser. ' +
                    'The spreadsheet stops being a snapshot you remember to export and becomes the data itself.</p>' +
                '<div class="port-note hidden" id="portLiveUnsupported"></div>' +
                '<div class="port-file hidden" id="portFileRow">' +
                    '<span class="port-filename" id="portFileName"></span>' +
                    '<span class="port-meta" id="portFileMeta"></span>' +
                '</div>' +
                '<div class="port-note warn hidden" id="portLiveError"></div>' +
                '<div class="port-actions" id="portLiveActions">' +
                    '<button type="button" class="primary hidden" id="portConnectNewBtn">Connect a file</button>' +
                    '<button type="button" class="ghost hidden" id="portConnectExistingBtn">Use an existing file</button>' +
                    '<button type="button" class="primary hidden" id="portReconnectBtn">Reconnect</button>' +
                    '<button type="button" class="ghost hidden" id="portWriteNowBtn">Write now</button>' +
                    '<button type="button" class="ghost hidden" id="portLoadNowBtn">Load from file</button>' +
                    '<button type="button" class="ghost hidden" id="portDisconnectBtn">Disconnect</button>' +
                '</div>' +
                '<p class="port-copy" id="portSyncCopy"><strong>Put that file in a folder your cloud drive already syncs</strong> — iCloud Drive, Dropbox, OneDrive, Google Drive, Syncthing — ' +
                    'and every device you open the app on reads and writes the same file. That is multi-device sync with no account, no server and nothing of yours on anyone else\'s computer. ' +
                    'It is last-write-wins, so let one device finish syncing before you pick up the next, and load from the file before editing if another device has been at it.</p>' +
            '</div>' +
            '<div class="port-block">' +
                '<div class="port-head">' +
                    '<span class="port-title">Encrypted export</span>' +
                    '<span class="port-status" id="portCryptoStatus">Optional</span>' +
                '</div>' +
                '<p class="port-copy">Scramble an exported file with a passphrase before it is written — for a shared computer, a USB stick, or a backup somewhere you do not fully trust. ' +
                    'Nothing about the copy in this browser changes, and the ordinary exports keep working exactly as they do now.</p>' +
                '<div class="port-note warn" id="portCryptoWarning"><strong>A forgotten passphrase cannot be recovered.</strong> ' +
                    'No reset, no recovery code, no back door — that is the entire point of it. If the passphrase is lost, that file can never be opened again, ' +
                    'so keep a plain export as well until you are sure you have the passphrase safe.</div>' +
                '<div class="port-note hidden" id="portCryptoUnsupported"></div>' +
                '<div id="portCryptoForm">' +
                    '<div class="port-fields">' +
                        '<div><label for="portPass1">Passphrase</label><input type="password" id="portPass1" autocomplete="new-password" spellcheck="false"></div>' +
                        '<div><label for="portPass2">Passphrase again</label><input type="password" id="portPass2" autocomplete="new-password" spellcheck="false"></div>' +
                    '</div>' +
                    '<span class="field-error" id="portPassError"></span>' +
                    '<div class="port-check">' +
                        '<input type="checkbox" id="portShowPass">' +
                        '<label for="portShowPass">Show what I am typing</label>' +
                    '</div>' +
                    '<div class="port-check">' +
                        '<input type="checkbox" id="portPassAck">' +
                        '<label for="portPassAck">I understand that if I forget this passphrase, nobody — including this app — can open the file again.</label>' +
                    '</div>' +
                    '<div class="port-actions">' +
                        '<button type="button" class="primary" id="portEncryptBtn">Export encrypted JSON</button>' +
                    '</div>' +
                '</div>' +
                '<p class="port-copy">To open one again, use <strong>Import JSON</strong> and choose the encrypted file — you will be asked for the passphrase then. ' +
                    'Encryption applies to files you export here; a connected live file is always written in plain text.</p>' +
            '</div>' +
        '</div>';

    let portPanelBuilt = false;

    function portBuildPanel(mount) {
        portInjectStyles();
        mount.innerHTML = PORT_PANEL_HTML;

        portOn('portConnectNewBtn', 'click', portConnectNew);
        portOn('portConnectExistingBtn', 'click', portConnectExisting);
        portOn('portReconnectBtn', 'click', portReconnect);
        portOn('portDisconnectBtn', 'click', portDisconnect);
        portOn('portLoadNowBtn', 'click', portLoadFromFile);
        portOn('portWriteNowBtn', 'click', () => {
            if (!portConnected()) return;
            portLastSignature = null;   // an explicit write is never skipped
            portWriteQueued = true;
            portFlushWrite();
        });

        portOn('portShowPass', 'change', e => {
            const type = e.target.checked ? 'text' : 'password';
            const p1 = portEl('portPass1');
            const p2 = portEl('portPass2');
            if (p1) p1.type = type;
            if (p2) p2.type = type;
        });
        portOn('portEncryptBtn', 'click', portRunPanelExport);

        const unsupported = portEl('portLiveUnsupported');
        if (unsupported && !PORT_HAS_FS) unsupported.textContent = PORT_FS_UNAVAILABLE;
        const cryptoNote = portEl('portCryptoUnsupported');
        if (cryptoNote && !PORT_HAS_CRYPTO) cryptoNote.textContent = PORT_CRYPTO_UNAVAILABLE;

        portPanelBuilt = true;
    }

    async function portRunPanelExport() {
        const p1 = portEl('portPass1');
        const p2 = portEl('portPass2');
        const ack = portEl('portPassAck');
        const error = portEl('portPassError');
        const setError = msg => { if (error) error.textContent = msg; };
        if (!p1 || !p2) return;

        const pass = p1.value;
        const problem = portPassphraseProblem(pass);
        if (problem) { setError(problem); p1.focus(); return; }
        if (p2.value !== pass) { setError('The two passphrases are not the same.'); p2.focus(); return; }
        if (ack && !ack.checked) {
            setError('Tick the box to confirm you understand a forgotten passphrase cannot be recovered.');
            ack.focus();
            return;
        }
        setError('');
        const done = await exportEncryptedJson(pass);
        if (!done) return;
        p1.value = '';
        p2.value = '';
        if (ack) ack.checked = false;
        const show = portEl('portShowPass');
        if (show) { show.checked = false; p1.type = 'password'; p2.type = 'password'; }
    }

    const PORT_STATUS = {
        connected:         { text: 'Live',          tone: 'is-live' },
        'needs-permission': { text: 'Paused',       tone: 'is-warn' },
        idle:              { text: 'Not connected', tone: '' },
        unavailable:       { text: 'Unavailable',   tone: '' }
    };

    function portRefresh() {
        if (!portPanelBuilt || !portEl(PORT_MOUNT_ID)) return;

        const key = !PORT_HAS_FS ? 'unavailable' : (portLive ? portLive.status : 'idle');
        const shown = PORT_STATUS[key] || PORT_STATUS.idle;
        const pill = portEl('portLiveStatus');
        if (pill) {
            pill.textContent = portLive && portLive.error && key === 'connected' ? 'Write failed' : shown.text;
            pill.className = 'port-status ' +
                (portLive && portLive.error && key === 'connected' ? 'is-down' : shown.tone);
        }

        portShow('portLiveUnsupported', !PORT_HAS_FS);
        portShow('portFileRow', !!portLive);
        if (portLive) {
            // The name comes from the file the user picked, so it never reaches markup.
            portSetText('portFileName', portLive.name);
            portSetText('portFileMeta', portLive.status !== 'connected'
                ? 'Waiting for permission'
                : (portLive.lastWrittenAt ? 'Written ' + portClock(portLive.lastWrittenAt) : 'Not written yet'));
        }

        const errorBox = portEl('portLiveError');
        if (errorBox) {
            errorBox.textContent = portLive && portLive.error ? portLive.error : '';
            errorBox.classList.toggle('hidden', !(portLive && portLive.error));
        }

        const connected = portConnected();
        portShow('portConnectNewBtn', PORT_HAS_FS && !portLive);
        portShow('portConnectExistingBtn', PORT_HAS_FS && !portLive);
        portShow('portReconnectBtn', !!portLive && portLive.status !== 'connected');
        portShow('portWriteNowBtn', connected);
        portShow('portLoadNowBtn', connected);
        portShow('portDisconnectBtn', !!portLive);
        portShow('portSyncCopy', PORT_HAS_FS);

        const cryptoPill = portEl('portCryptoStatus');
        if (cryptoPill) {
            cryptoPill.textContent = PORT_HAS_CRYPTO ? 'Optional' : 'Unavailable';
            cryptoPill.className = 'port-status';
        }
        portShow('portCryptoUnsupported', !PORT_HAS_CRYPTO);
        portShow('portCryptoForm', PORT_HAS_CRYPTO);
        portShow('portCryptoWarning', PORT_HAS_CRYPTO);
    }

    // Built once and then only updated, so a render never wipes a half-typed
    // passphrase out from under the person typing it.
    function renderPortability() {
        const mount = portEl(PORT_MOUNT_ID);
        if (!mount) return;
        if (!portPanelBuilt || !mount.firstChild) portBuildPanel(mount);
        portRefresh();
    }

    /* ───── Hooks ───── */

    let portBaseImportJson = null;

    if (typeof renderAll === 'function') {
        const prevRenderAll = renderAll;
        renderAll = function () {
            prevRenderAll.apply(this, arguments);
            try { renderPortability(); } catch (e) { console.warn('Portability panel could not render', e); }
        };
    }

    if (typeof saveState === 'function') {
        const prevSaveState = saveState;
        saveState = function () {
            prevSaveState.apply(this, arguments);
            portScheduleWrite();
        };
    }

    if (typeof flushSave === 'function') {
        const prevFlushSave = flushSave;
        flushSave = function () {
            prevFlushSave.apply(this, arguments);
            portScheduleWrite();
        };
    }

    // An encrypted file arriving through the existing Import JSON button is
    // caught here, so app.js needs no knowledge of any of this.
    if (typeof importJsonText === 'function') {
        portBaseImportJson = importJsonText;
        importJsonText = function (text) {
            if (tryDecryptImport(text)) return;
            return portBaseImportJson.apply(this, arguments);
        };
    }

    window.addEventListener('pagehide', portFlushWrite);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') portFlushWrite();
    });

    /* ───── Public surface ───── */

    window.renderPortability = renderPortability;
    window.exportEncryptedJson = exportEncryptedJson;
    window.tryDecryptImport = tryDecryptImport;

    /* ───── Boot ───── */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { renderPortability(); });
    } else {
        renderPortability();
    }
    portRestoreConnection();
})();
