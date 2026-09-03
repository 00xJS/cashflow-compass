/* =========================================================
   Cashflow Compass — app shell
   Loads last. Owns the navigation rail and which view is on
   screen, the Data menu, the slide-over form drawers, the
   command palette, the Overview tiles and first-run checklist,
   and the chips in the top bar. Everything it draws is derived
   from the state and the forecast app.js already produced; it
   stores nothing of its own beyond a "dismissed" flag for the
   checklist, and makes no network request.
   ========================================================= */
(function () {
    'use strict';

    const VIEWS = ['overview', 'plan', 'forecast', 'reality', 'planning', 'backup'];
    const VIEW_TITLES = {
        overview: 'Overview', plan: 'Plan', forecast: 'Forecast',
        reality: 'Reality', planning: 'Planning', backup: 'Backup'
    };
    const DEFAULT_VIEW = 'overview';
    const APP_NAME = 'Cashflow Compass';
    const ONBOARDING_KEY = 'cc_onboardingDismissed';

    /* ───── Small helpers ───── */

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        if (typeof escapeHtml === 'function') return escapeHtml(s);
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function money(n) {
        const value = Number.isFinite(n) ? n : 0;
        return typeof fmtMoney === 'function' ? fmtMoney(value) : value.toFixed(2);
    }
    function signed(n) {
        return (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
    }
    function sum(list) { return (list || []).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0); }
    function plural(n, one, many) { return Math.abs(n) === 1 ? one : (many || one + 's'); }
    function toDay(value) {
        if (!value) return null;
        const d = value instanceof Date ? new Date(value) : new Date(value);
        if (isNaN(d)) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    }
    function longDate(value) {
        const d = toDay(value);
        if (!d) return value ? String(value) : '';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function appState() { return (typeof state !== 'undefined' && state) ? state : null; }
    function forecastNow() { return (typeof currentForecast !== 'undefined') ? currentForecast : null; }
    function call(name) {
        const fn = window[name];
        if (typeof fn === 'function') return fn.apply(null, Array.prototype.slice.call(arguments, 1));
        return undefined;
    }
    function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform || ''); }

    /* ───── Views ─────
     * The hash names the view (#/plan). A hash that names anything else — the
     * skip link's #main, say — is left alone rather than bounced to a default.
     */

    let currentView = null;

    function viewFromHash(hash) {
        const m = /^#\/?([a-z]+)\/?$/i.exec(hash || '');
        const name = m ? m[1].toLowerCase() : '';
        return VIEWS.indexOf(name) !== -1 ? name : null;
    }

    function viewOfSection(id) {
        const node = $(id);
        const view = node && node.closest ? node.closest('.view') : null;
        return view ? view.getAttribute('data-view') : null;
    }

    // Belt and braces: the views stay laid out while hidden, but a chart is
    // still asked to measure again once its view is the one on screen.
    function resizeChartsIn(name) {
        if (typeof Chart === 'undefined' || !Chart || typeof Chart.getChart !== 'function') return;
        const view = document.querySelector('.view[data-view="' + name + '"]');
        if (!view) return;
        const measure = () => {
            view.querySelectorAll('canvas').forEach(canvas => {
                const chart = Chart.getChart(canvas);
                if (!chart) return;
                try { chart.resize(); } catch (e) { /* a chart mid-destroy has nothing to measure */ }
            });
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(measure);
        else setTimeout(measure, 0);
    }

    function showView(name, opts) {
        opts = opts || {};
        if (VIEWS.indexOf(name) === -1) name = DEFAULT_VIEW;
        const changed = name !== currentView;
        currentView = name;

        document.querySelectorAll('.view').forEach(node => {
            node.classList.toggle('active', node.getAttribute('data-view') === name);
        });
        document.querySelectorAll('.nav-item[data-view]').forEach(link => {
            if (link.getAttribute('data-view') === name) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        document.body.setAttribute('data-view', name);
        document.title = (name === DEFAULT_VIEW) ? APP_NAME : VIEW_TITLES[name] + ' · ' + APP_NAME;

        if (opts.updateHash !== false) {
            const target = '#/' + name;
            if (location.hash !== target) {
                try {
                    if (opts.replace) history.replaceState(null, '', target);
                    else history.pushState(null, '', target);
                } catch (e) {
                    location.hash = target;
                }
            }
        }
        if (!changed) return;
        resizeChartsIn(name);
        if (opts.scrollTop !== false) window.scrollTo(0, 0);
        if (opts.focus) {
            const heading = document.querySelector('.view.active .view-title');
            if (heading) heading.focus({ preventScroll: true });
        }
    }

    function goToSection(id) {
        const owner = viewOfSection(id);
        if (owner) showView(owner, { scrollTop: false });
        const node = $(id);
        if (!node) return;
        // A collapsed section is opened so the scroll lands on content, not a header.
        const body = node.querySelector(':scope > [id$="Body"], :scope > .panel-body, :scope > .charts-grid');
        const toggle = node.querySelector(':scope > h2 button[aria-expanded="false"]');
        if (body && body.classList.contains('hidden') && toggle) toggle.click();
        const reduced = typeof prefersReducedMotion === 'function' && prefersReducedMotion();
        node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }

    function wireNav() {
        document.querySelectorAll('.nav-item[data-view]').forEach(link => {
            link.addEventListener('click', e => {
                // A modifier means the user wants the browser's own behaviour (new tab).
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                showView(link.getAttribute('data-view'), { focus: true });
            });
        });
        const onLocation = () => {
            const name = viewFromHash(location.hash);
            if (name) showView(name, { updateHash: false });
        };
        window.addEventListener('hashchange', onLocation);
        window.addEventListener('popstate', onLocation);
    }

    // app.js scrolls a section into view after the actions that lead to one
    // (editing a row, the "/" shortcut). A section in another view has to be
    // brought into the flow first or the scroll lands on nothing.
    if (typeof scrollSectionIntoView === 'function') {
        const previousScroll = scrollSectionIntoView;
        scrollSectionIntoView = function (id) {
            const owner = viewOfSection(id);
            if (owner && owner !== currentView) showView(owner, { scrollTop: false });
            return previousScroll.apply(this, arguments);
        };
    }

    /* ───── Drawers ─────
     * The three entry forms live in slide-over panels. app.js still owns every
     * field, the validation and the submit; the shell only decides when a panel
     * is on screen. Editing a row opens it filled in; a successful save or a
     * cancel closes it.
     */

    const DRAWERS = {
        account:     { id: 'drawer-account',     title: 'drawerAccountTitle',     form: 'accountForm',  first: 'acctName', submit: 'acctSubmitBtn', cancel: 'cancelAccountEdit', editing: () => typeof editingAcctId !== 'undefined' && !!editingAcctId },
        category:    { id: 'drawer-category',    title: 'drawerCategoryTitle',    form: 'categoryForm', first: 'catName',  submit: 'catSubmitBtn',  cancel: 'cancelCategoryEdit', editing: () => typeof editingCatId !== 'undefined' && !!editingCatId },
        transaction: { id: 'drawer-transaction', title: 'drawerTransactionTitle', form: 'txForm',       first: 'txName',   submit: 'txSubmitBtn',   cancel: 'cancelTxEdit',       editing: () => typeof editingTxId !== 'undefined' && !!editingTxId }
    };
    let openDrawerName = null;
    let drawerTrigger = null;
    let drawerClosing = false;

    function drawerFocusables(panel) {
        return Array.from(panel.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])'))
            .filter(n => !n.disabled && !n.classList.contains('hidden') && n.offsetParent !== null);
    }

    function openDrawer(name, opts) {
        opts = opts || {};
        const spec = DRAWERS[name];
        const panel = spec && $(spec.id);
        if (!panel) return;
        if (openDrawerName && openDrawerName !== name) closeDrawer({ silent: true });
        drawerTrigger = opts.trigger || document.activeElement;
        openDrawerName = name;
        const backdrop = $('drawerBackdrop');
        if (backdrop) backdrop.hidden = false;
        panel.hidden = false;
        document.body.classList.add('drawer-open');
        // Two frames: the panel has to exist in the layout before the transform can transition.
        requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));
        if (opts.preset) {
            Object.keys(opts.preset).forEach(id => { if (typeof setVal === 'function') setVal(id, opts.preset[id]); });
            call('onKindOrFreqChange');
        }
        syncDrawerTitle(name);
        const first = $(spec.first);
        setTimeout(() => { if (first && openDrawerName === name) first.focus(); }, 60);
    }

    function syncDrawerTitle(name) {
        const spec = DRAWERS[name];
        const title = spec && $(spec.title);
        const submit = spec && $(spec.submit);
        if (title && submit && submit.textContent.trim()) title.textContent = submit.textContent.trim();
    }

    function closeDrawer(opts) {
        opts = opts || {};
        const name = openDrawerName;
        if (!name) return;
        const spec = DRAWERS[name];
        const panel = $(spec.id);
        openDrawerName = null;
        // Cancelling resets the form and clears the edit; the reset wrapper below
        // sees the drawer already closed and does nothing more.
        if (!opts.keepForm) {
            drawerClosing = true;
            try { call(spec.cancel); } finally { drawerClosing = false; }
        }
        if (panel) {
            panel.classList.remove('open');
            panel.hidden = true;
        }
        const backdrop = $('drawerBackdrop');
        if (backdrop) backdrop.hidden = true;
        document.body.classList.remove('drawer-open');
        const trigger = drawerTrigger;
        drawerTrigger = null;
        if (!opts.silent && trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
            trigger.focus({ preventScroll: true });
        }
    }

    function wrapGlobal(name, after) {
        const original = window[name];
        if (typeof original !== 'function') return;
        window[name] = function () {
            const out = original.apply(this, arguments);
            try { after.apply(this, arguments); } catch (e) { console.error('[shell] after ' + name, e); }
            return out;
        };
    }

    function wireDrawers() {
        document.querySelectorAll('[data-drawer]').forEach(btn => {
            btn.addEventListener('click', () => openDrawer(btn.getAttribute('data-drawer'), { trigger: btn }));
        });
        document.querySelectorAll('[data-drawer-close]').forEach(btn => {
            btn.addEventListener('click', () => closeDrawer());
        });
        const backdrop = $('drawerBackdrop');
        if (backdrop) backdrop.addEventListener('click', () => closeDrawer());

        // Editing opens the panel filled in; app.js has already put the values there.
        wrapGlobal('editAccount',     () => openDrawer('account'));
        wrapGlobal('editCategory',    () => openDrawer('category'));
        wrapGlobal('editTransaction', () => openDrawer('transaction'));
        // A reset follows a successful save or a cancel — either way the panel is done.
        wrapGlobal('resetAccountForm',  () => { if (!drawerClosing && openDrawerName === 'account') closeDrawer({ keepForm: true }); });
        wrapGlobal('resetCategoryForm', () => { if (!drawerClosing && openDrawerName === 'category') closeDrawer({ keepForm: true }); });
        wrapGlobal('resetTxForm',       () => { if (!drawerClosing && openDrawerName === 'transaction') closeDrawer({ keepForm: true }); });

        document.addEventListener('keydown', e => {
            if (!openDrawerName) return;
            const panel = $(DRAWERS[openDrawerName].id);
            if (!panel) return;
            if (e.key === 'Escape') {
                if (typeof modalIsOpen === 'function' && modalIsOpen()) return;
                if (e.target && e.target.classList && e.target.classList.contains('inline-edit')) return;
                e.preventDefault();
                closeDrawer();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = drawerFocusables(panel);
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    /* ───── Top bar ───── */

    function syncTopbarHeight() {
        const bar = document.querySelector('.topbar');
        if (!bar) return;
        document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
    }

    function wireMenu() {
        const menu = $('dataMenu');
        if (!menu) return;
        const summary = menu.querySelector('summary');
        document.addEventListener('click', e => {
            if (menu.open && !menu.contains(e.target)) menu.open = false;
        });
        // Choosing an item closes the menu, after the item's own handler has run.
        menu.addEventListener('click', e => {
            const item = e.target.closest('button, a');
            if (item && menu.contains(item)) setTimeout(() => { menu.open = false; }, 0);
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !menu.open) return;
            menu.open = false;
            if (summary) summary.focus();
        });
    }

    function renderScenarioChip() {
        const chip = $('scenarioChip');
        const s = appState();
        if (!chip || !s) return;
        const scenario = activeScenario(s);
        if (!scenario) { chip.textContent = ''; return; }
        chip.innerHTML =
            '<span aria-hidden="true">Scenario</span>' +
            '<span class="chip-name" title="' + esc(scenario.name || '') + '">' + esc(scenario.name || 'Unnamed') + '</span>' +
            '<button type="button" class="ghost" id="scenarioChipOff" title="Show the base plan instead">Base plan</button>';
        chip.setAttribute('aria-label', 'Every figure is shown through the scenario ' + (scenario.name || 'Unnamed'));
        const off = $('scenarioChipOff');
        if (off) off.onclick = () => call('v5ActivateScenario', null);
    }

    function activeScenario(s) {
        const activeId = s && s.settings ? s.settings.activeScenarioId : null;
        if (!activeId || !Array.isArray(s.scenarios)) return null;
        return s.scenarios.find(x => x && x.id === activeId) || null;
    }

    /* ───── Navigation badges ───── */

    function setBadge(id, text, tone) {
        const node = $(id);
        if (!node) return;
        node.textContent = text || '';
        node.className = 'nav-badge' + (tone ? ' ' + tone : '');
    }

    function daysSinceExport(s) {
        const iso = s && s.settings ? s.settings.lastExportAt : null;
        if (!iso) return Infinity;
        const ms = Date.now() - new Date(iso).getTime();
        return isFinite(ms) ? ms / 86400000 : Infinity;
    }

    function renderBadges() {
        const s = appState();
        if (!s) return;
        const txCount = Array.isArray(s.transactions) ? s.transactions.length : 0;
        setBadge('navBadgePlan', txCount ? String(txCount) : '');

        const checkins = Array.isArray(s.checkins) ? s.checkins.length : 0;
        const actuals = Array.isArray(s.actuals) ? s.actuals.length : 0;
        setBadge('navBadgeReality', (checkins || actuals) ? String(checkins + actuals) : '');

        const activeId = s.settings ? s.settings.activeScenarioId : null;
        setBadge('navBadgePlanning', activeId ? 'what-if' : '', activeId ? 'on' : '');

        const hasData = (Array.isArray(s.accounts) && s.accounts.length) || txCount;
        const stale = hasData && daysSinceExport(s) > 30;
        setBadge('navBadgeBackup', stale ? 'due' : '', stale ? 'warn' : '');
    }

    /* ───── Overview ─────
     * Seven tiles that answer the questions the whole app exists for, read
     * straight off the forecast app.js built. The savings rate comes from the
     * insight card so the two never disagree.
     */

    function tile(opts) {
        const tag = opts.href ? 'a' : 'div';
        const href = opts.href ? ' href="' + esc(opts.href) + '"' : '';
        return '<' + tag + ' class="kpi ' + (opts.tone || '') + (opts.wide ? ' wide' : '') + '"' + href + '>' +
            '<div class="label">' + esc(opts.label) + '</div>' +
            '<div class="value' + (opts.small ? ' small' : '') + '">' + esc(opts.value) + '</div>' +
            (opts.sub ? '<div class="sub">' + opts.sub + '</div>' : '') +
            (opts.extra || '') +
            '</' + tag + '>';
    }

    function chip(text, tone) {
        return '<span class="chip' + (tone ? ' ' + tone : '') + '">' +
            (tone ? '<span class="dot" aria-hidden="true"></span>' : '') + esc(text) + '</span>';
    }

    // A small inline SVG of the running balance: one line, a soft fill, a dashed
    // zero line only when the balance crosses it, and a dot on the last point.
    function sparkline(series) {
        const values = (series || []).map(n => Number.isFinite(n) ? n : 0);
        if (values.length < 2) return '';
        const W = 300, H = 44, PAD = 3;
        let min = Math.min.apply(null, values), max = Math.max.apply(null, values);
        const crossesZero = min < 0 && max > 0;
        if (min === max) { min -= 1; max += 1; }
        const x = i => PAD + (i / (values.length - 1)) * (W - PAD * 2);
        const y = v => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
        const pts = values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1));
        const line = pts.join(' ');
        const base = y(Math.max(min, Math.min(max, 0))).toFixed(1);
        const area = pts[0].split(',')[0] + ',' + base + ' ' + line + ' ' + pts[pts.length - 1].split(',')[0] + ',' + base;
        const last = pts[pts.length - 1].split(',');
        return '<svg class="kpi-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<polygon class="area" points="' + area + '"/>' +
            (crossesZero ? '<line class="zero" x1="0" x2="' + W + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>' : '') +
            '<polyline class="line" points="' + line + '"/>' +
            '<circle class="end" cx="' + last[0] + '" cy="' + last[1] + '" r="2.5"/>' +
            '</svg>';
    }

    // What lands in the next seven days, from the per-day occurrences the
    // engine already produced for the calendar.
    function nextSevenDays(fc) {
        const today = toDay(new Date());
        if (!today || !fc || !Array.isArray(fc.txData)) return null;
        const end = new Date(today); end.setDate(end.getDate() + 6);
        let inflow = 0, outflow = 0, count = 0, biggest = null;
        fc.txData.forEach(entry => {
            const name = (entry.tx && entry.tx.name) || 'Item';
            (entry.byDay || []).forEach(day => {
                const d = toDay(day.date);
                if (!d || d < today || d > end) return;
                const amount = Number.isFinite(day.signed) ? day.signed : 0;
                if (!amount) return;
                count++;
                if (amount > 0) inflow += amount; else outflow += -amount;
                if (!biggest || Math.abs(amount) > Math.abs(biggest.amount)) biggest = { name, amount, date: d };
            });
        });
        return { net: inflow - outflow, inflow, outflow, count, biggest, end };
    }

    function renderOverview() {
        const host = $('overviewHero');
        const s = appState();
        if (!host || !s) return;
        const accounts = Array.isArray(s.accounts) ? s.accounts : [];
        const transactions = Array.isArray(s.transactions) ? s.transactions : [];
        if (!accounts.length && !transactions.length) { host.innerHTML = ''; return; }
        const fc = forecastNow();
        if (!fc || !Array.isArray(fc.runningBalance) || !fc.runningBalance.length) {
            host.innerHTML = '<div class="v5-empty">The forecast could not be built, so there is nothing to summarise here yet.</div>';
            return;
        }

        const months = fc.months || (fc.monthList ? fc.monthList.length : fc.runningBalance.length);
        const last = fc.runningBalance.length - 1;
        const startCash = Number.isFinite(fc.startingBalance) ? fc.startingBalance : 0;
        const startWorth = Number.isFinite(fc.startingNetWorth) ? fc.startingNetWorth : startCash;
        const endCash = fc.runningBalance[last] || 0;
        const endWorth = Array.isArray(fc.netWorthRunning) ? (fc.netWorthRunning[last] || 0) : endCash;
        const delta = endCash - startCash;
        const income = sum(fc.monthlyIncome);
        const expense = sum(fc.monthlyExpense);
        const netPerMonth = (income - expense) / (months || 1);
        const rangeText = (typeof horizonRangeLabel === 'function') ? horizonRangeLabel(months) : '';
        const liquidCount = (typeof isLiquidAccount === 'function')
            ? accounts.filter(a => { try { return isLiquidAccount(a); } catch (e) { return true; } }).length
            : accounts.length;
        const creditCount = accounts.filter(a => a && a.type === 'credit').length;

        let cards = [];
        try { cards = (typeof computeInsights === 'function' && computeInsights(fc)) || []; }
        catch (e) { cards = []; }
        const savings = cards.find(c => c && c.label === 'Savings Rate') || null;
        const savingsTone = savings ? ({ positive: 'pos', info: '', warning: 'warn', danger: 'neg' }[savings.tone] || '') : '';
        const scenario = activeScenario(s);
        const week = nextSevenDays(fc);

        const strip = '<div class="hero-strip">' +
            chip(months + '-month horizon' + (rangeText ? ' · ' + rangeText : '')) +
            chip(transactions.length + ' ' + plural(transactions.length, 'transaction') + ' · ' + accounts.length + ' ' + plural(accounts.length, 'account')) +
            (fc.cutoffDate ? chip('anchored ' + longDate(fc.cutoffDate)) : '') +
            (fc.daysInRed > 0 ? chip(fc.daysInRed + ' ' + plural(fc.daysInRed, 'day') + ' in the red', 'down') : chip('cash stays positive', 'ok')) +
            (scenario ? chip('scenario · ' + (scenario.name || 'unnamed'), 'mag') : '') +
            '</div>';

        // The engine reports the low point as { date, balance }.
        const low = (fc.lowest && typeof fc.lowest === 'object') ? fc.lowest : { balance: fc.lowest, date: null };
        const lowText = money(low.balance) + (low.date ? ' on ' + longDate(low.date) : '');
        const shortfall = fc.daysInRed > 0
            ? tile({
                tone: 'neg', label: 'First shortfall', href: '#/forecast',
                value: fc.firstNegativeDate ? longDate(fc.firstNegativeDate) : fc.daysInRed + ' days in the red',
                small: !!fc.firstNegativeDate,
                sub: esc(fc.daysInRed + ' ' + plural(fc.daysInRed, 'day') + ' below zero · lowest ' + lowText)
            })
            : tile({
                tone: 'pos', label: 'Lowest point', href: '#/forecast',
                value: money(low.balance),
                sub: esc('Liquid cash never dips below zero across ' + months + ' months' + (low.date ? ' · ' + longDate(low.date) : ''))
            });

        const weekTile = week
            ? tile({
                tone: week.count === 0 ? '' : (week.net >= 0 ? 'pos' : 'warn'),
                label: 'Next 7 days', href: '#/forecast',
                value: week.count ? signed(week.net) : 'Quiet week',
                sub: week.count
                    ? esc(money(week.inflow) + ' in · ' + money(week.outflow) + ' out · ' + week.count + ' ' + plural(week.count, 'item')) +
                      (week.biggest ? '<br>' + esc('Largest: ' + week.biggest.name + ' ' + signed(week.biggest.amount) + ' on ' + longDate(week.biggest.date)) : '')
                    : esc('Nothing lands before ' + longDate(week.end))
            })
            : '';

        const tiles = '<div class="kpi-grid">' +
            tile({
                tone: delta >= 0 ? 'pos' : 'neg', label: 'Projected cash', href: '#/forecast', wide: true,
                value: money(endCash),
                sub: '<span class="delta ' + (delta >= 0 ? 'up' : 'down') + '">' + esc(signed(delta)) + '</span> from today' +
                    (rangeText ? esc(' · ' + rangeText) : ''),
                extra: sparkline([startCash].concat(fc.runningBalance))
            }) +
            tile({
                tone: 'acc', label: 'Liquid cash today', href: '#/forecast',
                value: money(startCash),
                sub: esc(liquidCount + ' liquid ' + plural(liquidCount, 'account')) +
                    (creditCount ? esc(' · ' + creditCount + ' credit ' + plural(creditCount, 'card') + ' not counted') : '')
            }) +
            tile({
                tone: '', label: 'Net worth today', href: '#/forecast',
                value: money(startWorth),
                sub: 'Cards owed subtracted · <span class="delta ' + (endWorth - startWorth >= 0 ? 'up' : 'down') + '">' +
                    esc(signed(endWorth - startWorth)) + '</span> over the horizon'
            }) +
            tile({
                tone: netPerMonth >= 0 ? 'pos' : 'neg', label: 'Average monthly net', href: '#/forecast',
                value: signed(netPerMonth),
                sub: esc(money(income / (months || 1)) + ' in · ' + money(expense / (months || 1)) + ' out, per month')
            }) +
            (savings
                ? tile({ tone: savingsTone, label: 'Savings rate', value: savings.value, sub: esc(savings.sub || '') })
                : tile({ tone: '', label: 'Savings rate', value: '—', sub: 'Needs an income line to measure against' })) +
            weekTile +
            shortfall +
            '</div>';

        host.innerHTML = strip + tiles;
    }

    /* ───── Insight cards that lead somewhere ───── */

    const INSIGHT_TARGETS = {
        'Savings Rate':             'section-forecast',
        'Biggest Category':         'section-charts',
        'Spend Concentration':      'section-charts',
        'Fixed vs Variable':        'section-charts',
        'Annual Subscription Cost': 'section-transactions',
        'Emergency Fund':           'section-balances',
        'Days in the Red':          'section-calendar',
        'First Shortfall':          'section-calendar',
        'Tightest Week':            'section-calendar',
        'Best Month':               'section-forecast',
        'Worst Month':              'section-forecast',
        '3-Paycheck Months':        'section-calendar',
        'Projected cash':           'section-balances'
    };

    function targetForInsight(label) {
        if (INSIGHT_TARGETS[label]) return INSIGHT_TARGETS[label];
        if (/^If you cut/i.test(label)) return 'section-transactions';
        if (/^Projected cash/i.test(label)) return 'section-balances';
        return null;
    }

    function linkInsights() {
        document.querySelectorAll('#insightsGrid .insight-card').forEach(card => {
            const labelNode = card.querySelector('.label');
            const target = labelNode ? targetForInsight(labelNode.textContent.trim()) : null;
            if (!target || !$(target)) return;
            const section = $(target);
            const heading = section.querySelector('h2');
            const where = heading ? heading.textContent.replace(/\s+/g, ' ').trim() : target;
            card.classList.add('linked');
            card.setAttribute('role', 'link');
            card.setAttribute('tabindex', '0');
            card.setAttribute('title', 'Open ' + where);
            const go = () => goToSection(target);
            card.onclick = go;
            card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
        });
    }

    /* ───── First-run checklist ───── */

    function onboardingDismissed() {
        try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch (e) { return false; }
    }

    function onboardingSteps(s) {
        const accounts = Array.isArray(s.accounts) ? s.accounts : [];
        const tx = Array.isArray(s.transactions) ? s.transactions : [];
        return [
            {
                title: 'Add an account',
                text: 'Checking, savings, a card — with what it holds today and the date that was true.',
                done: accounts.length > 0,
                action: 'Add account',
                run: () => openDrawer('account')
            },
            {
                title: 'Add your income',
                text: 'A paycheck at whatever cadence it really arrives; bi-weekly gives you the three-paycheck months.',
                done: tx.some(t => t && t.kind === 'income'),
                action: 'Add income',
                run: () => openDrawer('transaction', { preset: { txKind: 'income', txFrequency: 'bi-weekly' } })
            },
            {
                title: 'Add a recurring expense',
                text: 'Rent, a subscription, insurance — anything that repeats. One is enough to see the shape of a month.',
                done: tx.some(t => t && t.kind === 'expense' && t.frequency && t.frequency !== 'one-time'),
                action: 'Add expense',
                run: () => openDrawer('transaction', { preset: { txKind: 'expense', txFrequency: 'monthly' } })
            }
        ];
    }

    function renderOnboarding() {
        const host = $('onboarding');
        const s = appState();
        if (!host || !s) return;
        const steps = onboardingSteps(s);
        const done = steps.filter(x => x.done).length;
        if (done === steps.length || onboardingDismissed()) { host.hidden = true; host.innerHTML = ''; return; }
        let nextMarked = false;
        host.innerHTML =
            '<div class="onb-head">' +
                '<div><h3>Set up your plan</h3><p>Three things and the whole forecast comes alive — tiles, grid, charts, insights.</p></div>' +
                '<div class="onb-progress"><span>' + done + ' of ' + steps.length + '</span>' +
                '<div class="v5-bar" aria-hidden="true"><span style="width:' + Math.round((done / steps.length) * 100) + '%"></span></div></div>' +
            '</div>' +
            '<ol class="onb-steps">' +
            steps.map((step, i) => {
                const isNext = !step.done && !nextMarked;
                if (isNext) nextMarked = true;
                return '<li class="onb-step' + (step.done ? ' done' : isNext ? ' next' : '') + '">' +
                    '<span class="onb-num" aria-hidden="true">' + (step.done ? '✓' : (i + 1)) + '</span>' +
                    '<div><strong>' + esc(step.title) + (step.done ? ' <span class="visually-hidden">(done)</span>' : '') + '</strong>' +
                    '<p>' + esc(step.text) + '</p>' +
                    (step.done ? '' : '<button type="button" class="' + (isNext ? 'primary' : '') + '" data-onb-step="' + i + '">' + esc(step.action) + '</button>') +
                    '</div></li>';
            }).join('') +
            '</ol>' +
            '<div class="onb-foot">' +
                '<span>Or explore first:</span>' +
                '<button type="button" class="link" id="onbSample">Load sample data</button>' +
                '<span aria-hidden="true">·</span>' +
                '<button type="button" class="link" id="onbDismiss">Dismiss this checklist</button>' +
            '</div>';
        host.hidden = false;
        host.querySelectorAll('[data-onb-step]').forEach(btn => {
            btn.onclick = () => steps[Number(btn.getAttribute('data-onb-step'))].run();
        });
        const sample = $('onbSample');
        if (sample) sample.onclick = () => call('loadSampleData');
        const dismiss = $('onbDismiss');
        if (dismiss) dismiss.onclick = () => {
            try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch (e) { /* private mode */ }
            renderOnboarding();
        };
    }

    /* ───── Reality view action ───── */

    function wireRealityImport() {
        const btn = $('realityImportBtn');
        if (!btn) return;
        if (typeof openImportWizard !== 'function') { btn.classList.add('hidden'); return; }
        btn.classList.remove('hidden');
        btn.addEventListener('click', () => openImportWizard());
    }

    /* ───── Command palette ─────
     * One box that reaches everything: views, sections, actions, and every
     * account, category, transaction and scenario by name.
     */

    let paletteOpen = false;
    let paletteIndex = 0;
    let paletteResults = [];

    const SECTIONS = [
        ['section-accounts', 'Accounts'], ['section-categories', 'Categories'], ['section-transactions', 'Transactions'],
        ['section-forecast', 'Forecast grid'], ['section-balances', 'Balances by account'], ['section-calendar', 'Bills calendar'],
        ['section-charts', 'Charts'], ['section-insights', 'Insights'], ['section-checkin', 'Monthly check-in'],
        ['section-variance', 'Plan vs actual'], ['section-debt', 'Debt payoff'], ['section-goals', 'Savings goals'],
        ['section-scenarios', 'Scenarios'], ['section-portability', 'Backup & portability']
    ];

    function clickById(id) { const n = $(id); if (n) n.click(); }

    function paletteItems(query) {
        const s = appState() || {};
        const items = [];
        VIEWS.forEach((v, i) => items.push({ group: 'Go to', icon: '→', label: VIEW_TITLES[v], hint: String(i + 1), keys: 'view ' + v, run: () => showView(v, { focus: true }) }));
        SECTIONS.forEach(pair => {
            const owner = viewOfSection(pair[0]);
            items.push({ group: 'Go to', icon: '¶', label: pair[1], hint: owner ? VIEW_TITLES[owner] : '', keys: 'section', run: () => goToSection(pair[0]) });
        });
        items.push({ group: 'Actions', icon: '＋', label: 'Add account', keys: 'new create', run: () => openDrawer('account') });
        items.push({ group: 'Actions', icon: '＋', label: 'Add transaction', keys: 'new create income expense', run: () => openDrawer('transaction') });
        items.push({ group: 'Actions', icon: '＋', label: 'Add category', keys: 'new create', run: () => openDrawer('category') });
        items.push({ group: 'Actions', icon: '⬇', label: 'Export Excel workbook', hint: 'E', keys: 'backup xlsx download', run: () => call('exportExcel') });
        items.push({ group: 'Actions', icon: '⬇', label: 'Export JSON', hint: 'J', keys: 'backup download', run: () => call('exportJson') });
        items.push({ group: 'Actions', icon: '⬆', label: 'Import Excel workbook', keys: 'restore upload xlsx', run: () => clickById('importXlsxBtn') });
        items.push({ group: 'Actions', icon: '⬆', label: 'Import JSON file', keys: 'restore upload', run: () => clickById('importJsonBtn') });
        if (typeof openImportWizard === 'function') items.push({ group: 'Actions', icon: '⬆', label: 'Import a bank file', keys: 'csv ofx qfx qif statement actuals', run: () => openImportWizard() });
        items.push({ group: 'Actions', icon: '/', label: 'Search transactions', hint: '/', keys: 'find filter', run: () => call('focusTransactionSearch') });
        if (activeScenario(s)) items.push({ group: 'Actions', icon: '⇤', label: 'Back to the base plan', keys: 'scenario off', run: () => call('v5ActivateScenario', null) });
        items.push({ group: 'Actions', icon: '?', label: 'Keyboard shortcuts', hint: '?', keys: 'help keys', run: () => call('showShortcutHelp') });
        items.push({ group: 'Actions', icon: '📖', label: 'Getting Started guide', keys: 'help docs', run: () => { location.href = 'guide.html'; } });
        items.push({ group: 'Actions', icon: '⚙', label: 'Load sample data', keys: 'demo example', run: () => call('loadSampleData') });
        items.push({ group: 'Actions', icon: '🗑', label: 'Reset everything', keys: 'clear wipe delete all', danger: true, run: () => clickById('resetBtn') });

        if (query) {
            (Array.isArray(s.transactions) ? s.transactions : []).forEach(t => {
                if (!t) return;
                items.push({ group: 'Transactions', icon: t.kind === 'income' ? '↑' : t.kind === 'transfer' ? '⇄' : '↓', label: t.name || 'Unnamed',
                    hint: money(parseFloat(t.amount) || 0) + (t.paused ? ' · paused' : ''), keys: [t.kind, (t.tags || []).join(' '), t.notes || ''].join(' '),
                    run: () => call('editTransaction', t.id) });
            });
            (Array.isArray(s.accounts) ? s.accounts : []).forEach(a => {
                if (!a) return;
                items.push({ group: 'Accounts', icon: '▣', label: a.name || 'Unnamed', hint: a.type || '', keys: 'account', run: () => call('editAccount', a.id) });
            });
            (Array.isArray(s.categories) ? s.categories : []).forEach(c => {
                if (!c) return;
                items.push({ group: 'Categories', icon: '●', label: c.name || 'Unnamed', hint: c.kind || '', keys: 'category', run: () => call('editCategory', c.id) });
            });
            (Array.isArray(s.scenarios) ? s.scenarios : []).forEach(sc => {
                if (!sc) return;
                items.push({ group: 'Scenarios', icon: '◇', label: sc.name || 'Unnamed', hint: 'apply', keys: 'scenario what-if', run: () => call('v5ActivateScenario', sc.id) });
            });
        }
        return items;
    }

    function paletteFilter(items, query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) return items;
        return items.filter(item => {
            const hay = (item.label + ' ' + item.group + ' ' + (item.keys || '') + ' ' + (item.hint || '')).toLowerCase();
            return words.every(w => hay.indexOf(w) !== -1);
        }).slice(0, 60);
    }

    function paletteRender() {
        const list = $('paletteList');
        if (!list) return;
        if (!paletteResults.length) {
            list.innerHTML = '<li class="palette-empty">Nothing matches. Try a view, a section, an action, or the name of a transaction.</li>';
            return;
        }
        let html = '', lastGroup = null;
        paletteResults.forEach((item, i) => {
            if (item.group !== lastGroup) { html += '<li class="palette-group" role="presentation">' + esc(item.group) + '</li>'; lastGroup = item.group; }
            html += '<li class="palette-item' + (item.danger ? ' danger-item' : '') + '" role="option" id="paletteOpt' + i + '" data-index="' + i + '" aria-selected="' + (i === paletteIndex ? 'true' : 'false') + '">' +
                '<span class="pi-ico" aria-hidden="true">' + esc(item.icon || '') + '</span>' +
                '<span class="pi-label">' + esc(item.label) + '</span>' +
                (item.hint ? '<span class="pi-hint">' + esc(item.hint) + '</span>' : '') +
                '</li>';
        });
        list.innerHTML = html;
        const input = $('paletteInput');
        if (input) input.setAttribute('aria-activedescendant', 'paletteOpt' + paletteIndex);
        const active = list.querySelector('[aria-selected="true"]');
        if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest' });
        list.querySelectorAll('.palette-item').forEach(node => {
            node.onmousemove = () => { const i = Number(node.dataset.index); if (i !== paletteIndex) { paletteIndex = i; paletteRender(); } };
            node.onclick = () => paletteChoose(Number(node.dataset.index));
        });
    }

    function paletteUpdate() {
        const input = $('paletteInput');
        const query = input ? input.value.trim() : '';
        paletteResults = paletteFilter(paletteItems(query), query);
        if (paletteIndex >= paletteResults.length) paletteIndex = 0;
        paletteRender();
    }

    function paletteChoose(i) {
        const item = paletteResults[i];
        closePalette();
        if (item && typeof item.run === 'function') {
            try { item.run(); } catch (e) { console.error('[shell] palette action failed', e); }
        }
    }

    function ensurePalette() {
        let overlay = $('paletteOverlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'paletteOverlay';
        overlay.className = 'palette-overlay';
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="palette" role="dialog" aria-modal="true" aria-label="Search and commands">' +
                '<div class="palette-input"><label for="paletteInput" class="visually-hidden">Search views, sections, actions and transactions</label>' +
                '<input type="text" id="paletteInput" placeholder="Type to search views, sections, actions, transactions…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="paletteList" aria-autocomplete="list"></div>' +
                '<ul class="palette-list" id="paletteList" role="listbox"></ul>' +
                '<div class="palette-foot"><span>↑↓ move</span><span>↵ choose</span><span>esc close</span></div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closePalette(); });
        const input = $('paletteInput');
        input.addEventListener('input', () => { paletteIndex = 0; paletteUpdate(); });
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (paletteResults.length) { paletteIndex = (paletteIndex + 1) % paletteResults.length; paletteRender(); } }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (paletteResults.length) { paletteIndex = (paletteIndex - 1 + paletteResults.length) % paletteResults.length; paletteRender(); } }
            else if (e.key === 'Enter') { e.preventDefault(); paletteChoose(paletteIndex); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
            else if (e.key === 'Tab') { e.preventDefault(); }
        });
        return overlay;
    }

    let paletteReturnFocus = null;
    function openPalette() {
        const overlay = ensurePalette();
        if (paletteOpen) { const i = $('paletteInput'); if (i) i.focus(); return; }
        paletteReturnFocus = document.activeElement;
        paletteOpen = true;
        overlay.hidden = false;
        const input = $('paletteInput');
        input.value = '';
        paletteIndex = 0;
        paletteUpdate();
        input.focus();
    }
    function closePalette() {
        const overlay = $('paletteOverlay');
        if (!overlay || !paletteOpen) return;
        paletteOpen = false;
        overlay.hidden = true;
        const back = paletteReturnFocus;
        paletteReturnFocus = null;
        if (back && document.contains(back) && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }

    function wirePalette() {
        const btn = $('paletteBtn');
        if (btn) btn.addEventListener('click', () => openPalette());
        const kbd = $('paletteKbd');
        if (kbd) kbd.textContent = isMac() ? '⌘K' : 'Ctrl K';
        document.addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (paletteOpen) closePalette(); else openPalette();
            }
        });
    }

    /* ───── Keyboard ───── */

    function typing(node) {
        if (typeof isTypingTarget === 'function') return isTypingTarget(node);
        if (!node) return false;
        const tag = (node.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'select' || tag === 'textarea' || node.isContentEditable;
    }
    function dialogOpen() {
        if (typeof modalIsOpen === 'function' && modalIsOpen()) return true;
        return paletteOpen || !!openDrawerName || !!document.querySelector('.imp-overlay, .modal-overlay');
    }

    function wireKeys() {
        document.addEventListener('keydown', e => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (typing(e.target) || dialogOpen()) return;
            const index = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
            if (index !== -1) { e.preventDefault(); showView(VIEWS[index], { focus: true }); return; }
            const key = e.key.toLowerCase();
            if (key === 'n') { e.preventDefault(); openDrawer('transaction'); }
            else if (key === 'a') { e.preventDefault(); openDrawer('account'); }
        });
        if (typeof SHORTCUTS !== 'undefined' && Array.isArray(SHORTCUTS)) {
            SHORTCUTS.splice(1, 0,
                { keys: isMac() ? '⌘ K' : 'Ctrl K', description: 'Open the command palette — search views, sections, actions and transactions' },
                { keys: '1–6', description: 'Switch view: Overview, Plan, Forecast, Reality, Planning, Backup' },
                { keys: 'n', description: 'New transaction' },
                { keys: 'a', description: 'New account' });
        }
        const help = $('shortcutsBtn');
        if (help) help.addEventListener('click', () => call('showShortcutHelp'));
    }

    /* ───── Render hook ─────
     * Everything the shell draws follows a render, so it wraps renderAll the
     * way the other modules do and runs once now for the render that already
     * happened while app.js was parsing.
     */

    function afterRender() {
        try { renderOverview(); } catch (e) { console.error('Could not render the overview', e); }
        try { renderOnboarding(); } catch (e) { console.error('Could not render the checklist', e); }
        try { linkInsights(); } catch (e) { console.error('Could not link the insight cards', e); }
        try { renderBadges(); } catch (e) { console.error('Could not render the navigation badges', e); }
        try { renderScenarioChip(); } catch (e) { console.error('Could not render the scenario chip', e); }
        if (openDrawerName) syncDrawerTitle(openDrawerName);
    }

    if (typeof renderAll === 'function') {
        const previousRenderAll = renderAll;
        renderAll = function () {
            const out = previousRenderAll.apply(this, arguments);
            afterRender();
            return out;
        };
    }

    /* ───── Boot ───── */

    wireNav();
    wireMenu();
    wireDrawers();
    wirePalette();
    wireKeys();
    wireRealityImport();
    syncTopbarHeight();
    if (typeof ResizeObserver === 'function') {
        const bar = document.querySelector('.topbar');
        if (bar) new ResizeObserver(syncTopbarHeight).observe(bar);
    } else {
        window.addEventListener('resize', syncTopbarHeight);
    }

    afterRender();
    const initial = viewFromHash(location.hash);
    showView(initial || DEFAULT_VIEW, { updateHash: !!initial, replace: true });
})();
