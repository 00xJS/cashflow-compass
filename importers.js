/* ═══════════════════════════════════════════════════════════════════════════
   Cashflow Compass — bank statement importers (FEAT-03)

   Turns a statement file the user downloaded from their own bank into
   state.actuals. The only input is a File the user picked themselves; nothing
   in here opens a connection to anything, and no institution is ever contacted.

   Loads after app.js. Reads the shared `state` binding directly and hooks its
   header button in by wrapping renderAll.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

/* ───── Small local helpers ───── */

const esc = (typeof escapeHtml === 'function') ? escapeHtml : function (s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

function appState() {
    try { return (typeof state !== 'undefined' && state) ? state : null; }
    catch (e) { return null; }
}

function newId(prefix) {
    if (typeof uid === 'function') return uid(prefix);
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function money(n) {
    if (typeof fmtMoney === 'function') { try { return fmtMoney(n); } catch (e) { /* fall through */ } }
    return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function flash(msg, tone) {
    if (typeof flashStatus === 'function') { flashStatus(msg, tone ? { tone: tone } : {}); return; }
    console.log('[Cashflow Compass]', msg);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function pad4(n) { return String(n).padStart(4, '0'); }
function plural(n, one, many) { return n === 1 ? one : many; }

// Cheap, dependency-free entity decoding. Statement files use a handful of
// these and nothing else; anything unrecognised is left exactly as written.
function decodeEntities(s) {
    return String(s == null ? '' : s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (whole, body) {
        const lower = body.toLowerCase();
        if (lower === 'amp') return '&';
        if (lower === 'lt') return '<';
        if (lower === 'gt') return '>';
        if (lower === 'quot') return '"';
        if (lower === 'apos') return '\'';
        if (lower === 'nbsp') return ' ';
        if (lower.charAt(0) === '#') {
            const code = lower.charAt(1) === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
            if (Number.isFinite(code) && code > 0 && code < 0x110000) {
                try { return String.fromCodePoint(code); } catch (e) { return whole; }
            }
        }
        return whole;
    });
}

/* ───── Dates ───── ------------------------------------------------------- */
/*
 * Never guess month/day order from a single value. inspectDate() reports what a
 * value can prove about itself; analyseDateColumn() then reads the whole column
 * and only commits to an order when some value in it rules the other one out.
 * When the column proves nothing, the wizard asks — it does not pick.
 */

const MONTH_NAMES = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

// Two-digit years in statement files are always recent; the POSIX pivot is
// generous enough to cover archived exports without reaching into the future.
function expandYear(value, digits) {
    if (digits >= 3) return value;
    return value <= 68 ? 2000 + value : 1900 + value;
}

function inspectDate(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    let m;

    // ISO 8601, with or without a time part.
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
    if (m) return exactOrNull(+m[1], +m[2], +m[3]);

    // OFX DTPOSTED: YYYYMMDD with an optional time and [offset:ZONE] tail.
    m = /^(\d{4})(\d{2})(\d{2})(?:\d{0,6}(?:\.\d+)?)?(?:\[[^\]]*\])?$/.exec(s);
    if (m) {
        const hit = exactOrNull(+m[1], +m[2], +m[3]);
        if (hit) return hit;
    }

    // Year-first with separators.
    m = /^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})(?:[T\s].*)?$/.exec(s);
    if (m) return exactOrNull(+m[1], +m[2], +m[3]);

    // 03 Apr 2026 · 3-APR-26 · 3 April 2026
    m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]*([A-Za-z]{3,9})\.?[\s\-/.,]*(\d{2,4})$/.exec(s);
    if (m) {
        const mo = MONTH_NAMES[m[2].slice(0, 3).toLowerCase()];
        if (mo) return exactOrNull(expandYear(+m[3], m[3].length), mo, +m[1]);
    }

    // Apr 3, 2026 · April 3 2026 · APR-03-26
    m = /^([A-Za-z]{3,9})\.?[\s\-/.]*(\d{1,2})(?:st|nd|rd|th)?[\s\-/.,]*(\d{2,4})$/.exec(s);
    if (m) {
        const mo = MONTH_NAMES[m[1].slice(0, 3).toLowerCase()];
        if (mo) return exactOrNull(expandYear(+m[3], m[3].length), mo, +m[2]);
    }

    // Two leading numbers whose roles cannot be told apart from this value
    // alone. QIF writes 1/ 3'26, so whitespace is squeezed out first.
    const tight = s.replace(/\s+/g, '');
    m = /^(\d{1,2})[/.\-'](\d{1,2})[/.\-'](\d{2,4})$/.exec(tight);
    if (m) {
        const a = +m[1], b = +m[2];
        if (a < 1 || b < 1 || a > 31 || b > 31) return null;
        if (a > 12 && b > 12) return null;
        return { kind: 'ambiguous', a: a, b: b, y: expandYear(+m[3], m[3].length), raw: s };
    }
    return null;
}

function exactOrNull(y, mo, d) {
    if (!(y >= 1900 && y <= 2200) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { kind: 'exact', y: y, mo: mo, d: d };
}

function isRealDate(y, mo, d) {
    const probe = new Date(Date.UTC(y, mo - 1, d));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

// order: 'exact' | 'dmy' | 'mdy' | '' (unresolved — ambiguous values are refused)
function resolveDate(raw, order) {
    const info = inspectDate(raw);
    if (!info) return null;
    let y, mo, d;
    if (info.kind === 'exact') {
        y = info.y; mo = info.mo; d = info.d;
    } else if (order === 'dmy') {
        y = info.y; d = info.a; mo = info.b;
    } else if (order === 'mdy') {
        y = info.y; mo = info.a; d = info.b;
    } else {
        return null;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    if (!isRealDate(y, mo, d)) return null;
    return pad4(y) + '-' + pad2(mo) + '-' + pad2(d);
}

function analyseDateColumn(values) {
    let exact = 0, ambiguous = 0, unreadable = 0;
    let dmyProof = 0, mdyProof = 0;
    let sample = '';
    let sampleExact = '';
    (values || []).forEach(function (v) {
        const info = inspectDate(v);
        if (!info) { if (String(v == null ? '' : v).trim()) unreadable++; return; }
        if (info.kind === 'exact') {
            exact++;
            if (!sampleExact) sampleExact = String(v).trim();
            return;
        }
        ambiguous++;
        if (!sample) sample = info.raw;
        if (info.a > 12) dmyProof++;
        else if (info.b > 12) mdyProof++;
    });

    let order = '';
    let reason = '';
    let conflict = false;
    if (ambiguous === 0 && exact > 0) {
        order = 'exact';
        reason = 'Every date in this column carries its year first or spells the month out, so nothing has to be guessed.';
    } else if (dmyProof && mdyProof) {
        conflict = true;
        reason = 'Some values only work day first and others only work month first, so the column is inconsistent.';
    } else if (dmyProof) {
        order = 'dmy';
        reason = dmyProof + ' ' + plural(dmyProof, 'value has', 'values have') + ' a first number above 12, which only works day first.';
    } else if (mdyProof) {
        order = 'mdy';
        reason = mdyProof + ' ' + plural(mdyProof, 'value has', 'values have') + ' a second number above 12, which only works month first.';
    } else if (ambiguous > 0) {
        reason = 'Every number in this column is 12 or below, so the file cannot tell you which way round it is.';
    } else {
        reason = 'No readable date was found in this column.';
    }

    const shown = sample || '03/04/2026';
    const bits = inspectDate(shown);
    const examples = { dmy: '', mdy: '' };
    if (bits && bits.kind === 'ambiguous') {
        examples.dmy = describeDate(bits.y, bits.b, bits.a);
        examples.mdy = describeDate(bits.y, bits.a, bits.b);
    }

    return {
        order: order,
        needsChoice: order === '' && (ambiguous > 0 || conflict),
        conflict: conflict,
        reason: reason,
        sample: shown,
        sampleExact: sampleExact,
        examples: examples,
        counts: { exact: exact, ambiguous: ambiguous, unreadable: unreadable }
    };
}

const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function describeDate(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || !isRealDate(y, mo, d)) return 'not a real date';
    return d + ' ' + MONTH_FULL[mo - 1] + ' ' + y;
}

function isoToDays(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}

/* ───── Amounts ───── ----------------------------------------------------- */
/*
 * The decimal separator is settled once per column rather than per value, so a
 * lone "1.234" can never be read as 1.234 in a file whose other rows prove the
 * dot is a thousands mark.
 */

function analyseAmountColumn(values) {
    let bothSeen = 0, dotLast = 0, commaLast = 0;
    let commaDecimal = 0, dotDecimal = 0;
    (values || []).forEach(function (v) {
        const s = String(v == null ? '' : v).replace(/[^0-9.,]/g, '');
        if (!s) return;
        const ld = s.lastIndexOf('.');
        const lc = s.lastIndexOf(',');
        if (ld !== -1 && lc !== -1) {
            bothSeen++;
            if (ld > lc) dotLast++; else commaLast++;
            return;
        }
        if (lc !== -1) {
            const tail = s.length - lc - 1;
            if ((s.split(',').length - 1) === 1 && (tail === 1 || tail === 2)) commaDecimal++;
        } else if (ld !== -1) {
            const tail = s.length - ld - 1;
            if ((s.split('.').length - 1) === 1 && (tail === 1 || tail === 2)) dotDecimal++;
        }
    });
    if (bothSeen) return dotLast >= commaLast ? '.' : ',';
    if (commaDecimal && !dotDecimal) return ',';
    if (dotDecimal && !commaDecimal) return '.';
    if (commaDecimal > dotDecimal) return ',';
    return '.';
}

// A separator can only be a thousands mark if it actually groups in threes.
// Without this, "12.34.56" would be swallowed as 123456 instead of refused.
function validGroups(part, sep) {
    const groups = part.split(sep);
    if (groups.length < 2) return true;
    if (groups[0].length < 1 || groups[0].length > 3) return false;
    for (let i = 1; i < groups.length; i++) {
        if (groups[i].length !== 3) return false;
    }
    return true;
}

// decimal: '.' or ',' when the column has been analysed; omit to fall back to a
// per-value heuristic (OFX, QIF and camt all mandate a dot).
function parseAmount(raw, decimal) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;

    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/\bCR\.?$/i.test(s)) s = s.replace(/\bCR\.?$/i, '');
    else if (/\bDR\.?$/i.test(s)) { neg = true; s = s.replace(/\bDR\.?$/i, ''); }
    if (/-\s*$/.test(s)) neg = true;

    s = s.replace(/[^0-9.,\-]/g, '');
    if (s.indexOf('-') !== -1) neg = true;
    s = s.replace(/-/g, '');
    if (!/\d/.test(s)) return null;

    let dec = (decimal === '.' || decimal === ',') ? decimal : '';
    if (!dec) {
        const ld = s.lastIndexOf('.');
        const lc = s.lastIndexOf(',');
        if (ld !== -1 && lc !== -1) dec = ld > lc ? '.' : ',';
        else if (lc !== -1) {
            const tail = s.length - lc - 1;
            dec = ((s.split(',').length - 1) > 1 || tail === 3) ? '.' : ',';
        } else if (ld !== -1) {
            const tail = s.length - ld - 1;
            dec = ((s.split('.').length - 1) > 1 || tail === 3) ? ',' : '.';
        } else {
            dec = '.';
        }
    }

    const group = dec === ',' ? '.' : ',';
    const at = s.lastIndexOf(dec);
    let intPart = at === -1 ? s : s.slice(0, at);
    const frac = at === -1 ? '' : s.slice(at + 1);
    if (!/^\d*$/.test(frac)) return null;
    if (intPart.indexOf(dec) !== -1) return null;
    if (intPart.indexOf(group) !== -1 && !validGroups(intPart, group)) return null;
    intPart = intPart.split(group).join('');
    if (!/^\d*$/.test(intPart)) return null;
    if (!intPart && !frac) return null;

    const n = Number((intPart || '0') + (frac ? '.' + frac : ''));
    if (!Number.isFinite(n)) return null;
    return neg ? -n : n;
}

function toCents(n) { return Math.round((Number.isFinite(n) ? n : 0) * 100); }
function roundMoney(n) { return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100; }

/* ───── A stable, non-cryptographic row hash ───── ------------------------ */
/*
 * Two independent 32-bit mixes concatenated. Fast, allocation-free and stable
 * across sessions, which is all a de-duplication key needs to be. Nothing here
 * is a security primitive and nothing depends on it being one.
 */

function fnv1a(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function djb2(str) {
    let h = 5381 | 0;
    for (let i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
    return h >>> 0;
}

function stableHash(str) {
    const s = String(str == null ? '' : str);
    return fnv1a(s).toString(16).padStart(8, '0') + djb2(s).toString(16).padStart(8, '0');
}

function normalisePayee(raw) {
    let s = String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    if (!s) return '';
    const tokens = s.split(' ');
    // Trailing reference numbers change every statement and would defeat both
    // de-duplication and payee matching, so they come off the end.
    while (tokens.length > 1) {
        const last = tokens[tokens.length - 1];
        const digits = (last.match(/\d/g) || []).length;
        if (/^\d+$/.test(last) || (last.length >= 5 && digits >= 4)) { tokens.pop(); continue; }
        break;
    }
    return tokens.join(' ');
}

function fallbackImportedId(accountId, date, amount, payee) {
    return 'h:' + stableHash([
        String(accountId || ''), String(date || ''), String(toCents(amount)), normalisePayee(payee)
    ].join(''));
}

/* ───── CSV ───── --------------------------------------------------------- */

const DELIMITERS = [',', ';', '\t', '|'];
const DELIMITER_LABELS = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };

function tokeniseCSV(text, delim) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let i = 0;
    const n = text.length;
    while (i < n) {
        const ch = text.charAt(i);
        if (quoted) {
            if (ch === '"') {
                if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
                quoted = false; i++; continue;
            }
            field += ch; i++; continue;
        }
        if (ch === '"' && field === '') { quoted = true; i++; continue; }
        if (ch === delim) { row.push(field); field = ''; i++; continue; }
        if (ch === '\r') {
            i++;
            if (text.charAt(i) === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
            continue;
        }
        if (ch === '\n') {
            i++;
            row.push(field); rows.push(row); row = []; field = '';
            continue;
        }
        field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

function rowHasContent(row) {
    return row.some(function (c) { return String(c == null ? '' : c).trim() !== ''; });
}

function detectDelimiter(text) {
    const sample = text.slice(0, 65536);
    let best = ',';
    let bestScore = -1;
    DELIMITERS.forEach(function (d) {
        const rows = tokeniseCSV(sample, d).filter(rowHasContent).slice(0, 25);
        if (!rows.length) return;
        const counts = {};
        rows.forEach(function (r) { counts[r.length] = (counts[r.length] || 0) + 1; });
        let mode = 0, modeN = 0;
        Object.keys(counts).forEach(function (k) {
            if (counts[k] > modeN || (counts[k] === modeN && +k > mode)) { modeN = counts[k]; mode = +k; }
        });
        if (mode < 2) return;
        const consistency = modeN / rows.length;
        const score = mode * consistency * consistency;
        if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
}

function looksLikeData(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s) return false;
    if (inspectDate(s)) return true;
    return /\d/.test(s) && parseAmount(s) !== null;
}

function guessHasHeader(rows) {
    if (!rows.length) return false;
    const first = rows[0];
    const firstData = first.filter(looksLikeData).length;
    if (rows.length === 1) return firstData === 0;
    const second = rows[1];
    const secondData = second.filter(looksLikeData).length;
    if (firstData === 0 && secondData > 0) return true;
    if (firstData > 0) return false;
    return secondData >= firstData;
}

/*
 * RFC 4180 with the tolerances real exports need: a BOM, CRLF or LF endings,
 * quoted fields containing the delimiter or a newline, "" escapes, and a
 * delimiter chosen by looking at the file rather than by hoping it is a comma.
 * Returns cells plus headers so the mapping wizard has something to offer.
 */
function parseCSV(text, forcedDelimiter) {
    const clean = String(text == null ? '' : text).replace(/^﻿/, '');
    const delimiter = forcedDelimiter || detectDelimiter(clean);
    const all = tokeniseCSV(clean, delimiter).filter(rowHasContent);
    if (!all.length) {
        return { format: 'csv', headers: [], rows: [], delimiter: delimiter, hasHeader: false, errors: [
            { row: 0, reason: 'the file contained no rows', value: '' }
        ] };
    }
    const hasHeader = guessHasHeader(all);
    let headers;
    let rows;
    if (hasHeader) {
        headers = all[0].map(function (h, i) {
            const t = String(h == null ? '' : h).trim();
            return t || ('Column ' + (i + 1));
        });
        rows = all.slice(1);
    } else {
        const width = all.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
        headers = [];
        for (let i = 0; i < width; i++) headers.push('Column ' + (i + 1));
        rows = all;
    }
    // Duplicate header names would make a name-keyed mapping ambiguous.
    const seen = {};
    headers = headers.map(function (h) {
        if (seen[h] == null) { seen[h] = 1; return h; }
        seen[h]++;
        return h + ' (' + seen[h] + ')';
    });
    rows = rows.map(function (r) {
        const out = new Array(headers.length);
        for (let i = 0; i < headers.length; i++) out[i] = r[i] == null ? '' : String(r[i]).trim();
        return out;
    });
    return { format: 'csv', headers: headers, rows: rows, delimiter: delimiter, hasHeader: hasHeader, errors: [] };
}

function columnValues(parsed, header) {
    const idx = parsed.headers.indexOf(header);
    if (idx < 0) return [];
    return parsed.rows.map(function (r) { return r[idx]; });
}

/* ───── OFX / QFX ───── --------------------------------------------------- */
/*
 * ══ SECURITY BOUNDARY ══
 * An OFX or QFX file downloaded from a bank normally still carries the sign-on
 * block that the request was built from: <USERID>, <USERPASS>, <USERKEY>,
 * <CLIENTUID>, <ACCESSKEY>, and the institution's routing details in <FI>,
 * <ORG>, <FID> and <URL>. None of that is ever read here.
 *
 * Two independent guards stop it, and either one alone would be sufficient:
 *
 *   1. Excision — the sign-on aggregates and every known credential or endpoint
 *      leaf are cut out of the text below, before a single tag is examined. The
 *      raw header preamble ahead of <OFX> goes with them.
 *   2. Allowlist — the scanner only ever copies a value when it is inside a
 *      <STMTTRN> aggregate AND its tag appears in OFX_TXN_FIELDS. Every other
 *      tag, at every other depth, is stepped over without its value being
 *      touched. Address lines inside a <PAYEE> aggregate fall to this rule.
 *
 * Nothing outside that allowlist is stored, rendered, logged or written back to
 * a file. There is no code path in this module that can put a credential into
 * state, into the DOM or into the console.
 */

const OFX_SIGNON_AGGREGATES =
    /<(SIGNONMSGSRQV1|SIGNONMSGSRSV1|SONRQ|SONRS|FI|MFACHALLENGE|MFACHALLENGERQ|MFACHALLENGERS|MFACHALLENGEA)>[\s\S]*?<\/\1>/gi;

const OFX_SECRET_LEAVES =
    /<(USERID|USERPASS|NEWUSERPASS|USERKEY|USERCRED1|USERCRED2|CLIENTUID|ACCESSKEY|AUTHTOKEN|SESSCOOKIE|PINCHTKN|ORG|FID|URL|APPID|APPVER)>[^\r\n<]*/gi;

const OFX_TXN_FIELDS = {
    DTPOSTED: 'rawDate',
    TRNAMT: 'rawAmount',
    FITID: 'fitid',
    NAME: 'payee',
    MEMO: 'memo',
    TRNTYPE: 'trntype',
    CHECKNUM: 'checknum'
};

function parseOFX(text) {
    let body = String(text == null ? '' : text).replace(/^﻿/, '');
    const ofxAt = body.search(/<OFX[\s>]/i);
    if (ofxAt > 0) body = body.slice(ofxAt);
    body = body.replace(OFX_SIGNON_AGGREGATES, ' ').replace(OFX_SECRET_LEAVES, ' ');

    const raw = [];
    const errors = [];
    const tagRe = /<(\/?)([A-Za-z0-9._]+)>([^<]*)/g;
    let m;
    let cur = null;

    while ((m = tagRe.exec(body)) !== null) {
        const closing = m[1] === '/';
        const tag = m[2].toUpperCase();
        if (tag === 'STMTTRN') {
            if (closing) { if (cur) raw.push(cur); cur = null; }
            else cur = {};
            continue;
        }
        if (!cur) continue;                          // outside a transaction: nothing is read
        const field = OFX_TXN_FIELDS[tag];
        if (!field) continue;                        // allowlist: credentials can never land here
        const value = decodeEntities(m[3]).trim();
        if (!value) continue;
        if (cur[field] == null) cur[field] = value;
    }
    if (cur) raw.push(cur);

    const analysis = analyseDateColumn(raw.map(function (r) { return r.rawDate; }));
    const rows = [];
    raw.forEach(function (r, i) {
        const date = resolveDate(r.rawDate, analysis.order || 'exact');
        const amount = parseAmount(r.rawAmount);
        if (!date) {
            errors.push({ row: i + 1, reason: 'the posted date could not be read', value: r.rawDate || '(missing)' });
            return;
        }
        if (amount === null) {
            errors.push({ row: i + 1, reason: 'the amount could not be read', value: r.rawAmount || '(missing)' });
            return;
        }
        rows.push({
            date: date,
            rawDate: r.rawDate,
            amount: roundMoney(amount),
            payee: r.payee || r.memo || r.trntype || '',
            memo: r.memo && r.memo !== r.payee ? r.memo : (r.checknum ? 'Cheque ' + r.checknum : ''),
            importedId: r.fitid || null,
            source: 'ofx'
        });
    });
    if (!rows.length && !errors.length) {
        errors.push({ row: 0, reason: 'no <STMTTRN> transaction records were found in this file', value: '' });
    }
    return { format: 'ofx', rows: rows, errors: errors, dateAnalysis: analysis, headers: [], currencies: [] };
}

/* ───── QIF ───── --------------------------------------------------------- */

const QIF_TXN_TYPES = /^(bank|cash|ccard|credit\s*card|oth\s*a|oth\s*l|other\s*asset|other\s*liability)$/i;

function parseQIF(text) {
    const clean = String(text == null ? '' : text).replace(/^﻿/, '');
    const lines = clean.split(/\r\n|\r|\n/);
    const raw = [];
    const errors = [];

    function scan(forceCapture) {
        raw.length = 0;
        let capturing = forceCapture;
        let cur = null;
        lines.forEach(function (line, idx) {
            const s = line.trim();
            if (!s) return;
            if (s.charAt(0) === '!') {
                const t = s.slice(1).trim();
                const mt = /^type\s*:\s*(.*)$/i.exec(t);
                capturing = forceCapture || !!(mt && QIF_TXN_TYPES.test(mt[1].trim()));
                cur = null;
                return;
            }
            if (!capturing) return;
            if (s === '^') { if (cur) raw.push(cur); cur = null; return; }
            if (!cur) cur = { line: idx + 1 };
            const code = s.charAt(0);
            const value = s.slice(1).trim();
            // S / E / $ carry the split lines; the T total already covers them,
            // and everything else in the record is Quicken bookkeeping.
            if (code === 'D') { if (cur.rawDate == null) cur.rawDate = value; }
            else if (code === 'T') cur.rawAmount = value;
            else if (code === 'U') { if (cur.rawAmount == null) cur.rawAmount = value; }
            else if (code === 'P') { if (cur.payee == null) cur.payee = value; }
            else if (code === 'M') { if (cur.memo == null) cur.memo = value; }
            else if (code === 'N') { if (cur.ref == null) cur.ref = value; }
            else if (code === 'L') { if (cur.category == null) cur.category = value; }
        });
        if (cur) raw.push(cur);
    }

    scan(false);
    // Some exporters omit the !Type header entirely; a second pass without the
    // gate is better than reporting an empty file.
    if (!raw.length && /(^|\n)\s*\^/.test(clean)) scan(true);

    const analysis = analyseDateColumn(raw.map(function (r) { return r.rawDate; }));
    const rows = [];
    raw.forEach(function (r) {
        const date = resolveDate(r.rawDate, analysis.order);
        const amount = parseAmount(r.rawAmount);
        if (!date) {
            errors.push({
                row: r.line,
                reason: analysis.needsChoice
                    ? 'the date order for this file has not been chosen yet'
                    : 'the date could not be read',
                value: r.rawDate || '(missing)'
            });
            return;
        }
        if (amount === null) {
            errors.push({ row: r.line, reason: 'the amount could not be read', value: r.rawAmount || '(missing)' });
            return;
        }
        rows.push({
            date: date,
            rawDate: r.rawDate,
            amount: roundMoney(amount),
            payee: r.payee || r.memo || '',
            memo: r.memo && r.memo !== r.payee ? r.memo : (r.ref ? 'Ref ' + r.ref : ''),
            importedId: null,
            qifCategory: r.category || '',
            source: 'qif'
        });
    });
    if (!rows.length && !errors.length) {
        errors.push({ row: 0, reason: 'no transaction records were found in this file', value: '' });
    }
    return { format: 'qif', rows: rows, errors: errors, dateAnalysis: analysis, headers: [], currencies: [] };
}

/* ───── ISO 20022 camt.053 ───── ------------------------------------------ */
/*
 * DOMParser is a built-in text-to-tree parser. It resolves no external
 * entities and issues no request of any kind; the DOCTYPE is stripped first so
 * there is nothing for an entity declaration to expand into. The tree it
 * returns is never attached to the page.
 */

function localNameOf(node) {
    return node.localName || String(node.nodeName || '').replace(/^.*:/, '');
}

function childrenNamed(node, name) {
    const out = [];
    if (!node) return out;
    for (let c = node.firstElementChild; c; c = c.nextElementSibling) {
        if (localNameOf(c) === name) out.push(c);
    }
    return out;
}

function childNamed(node, name) {
    return childrenNamed(node, name)[0] || null;
}

function descendantNamed(node, name) {
    if (!node) return null;
    const all = node.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if (localNameOf(all[i]) === name) return all[i];
    }
    return null;
}

function textOf(node) {
    return node ? String(node.textContent == null ? '' : node.textContent).trim() : '';
}

function parseCAMT(text) {
    const errors = [];
    const rows = [];
    const currencies = [];
    const clean = String(text == null ? '' : text).replace(/^﻿/, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');

    let doc;
    try {
        doc = new DOMParser().parseFromString(clean, 'application/xml');
    } catch (e) {
        return { format: 'camt', rows: [], errors: [{ row: 0, reason: 'the XML could not be parsed: ' + e.message, value: '' }],
            dateAnalysis: analyseDateColumn([]), headers: [], currencies: [] };
    }
    const bad = doc.getElementsByTagName('parsererror')[0];
    if (bad) {
        return { format: 'camt', rows: [], errors: [{ row: 0, reason: 'this file is not well-formed XML', value: textOf(bad).slice(0, 160) }],
            dateAnalysis: analyseDateColumn([]), headers: [], currencies: [] };
    }

    const all = doc.getElementsByTagName('*');
    const entries = [];
    for (let i = 0; i < all.length; i++) {
        if (localNameOf(all[i]) === 'Ntry') entries.push(all[i]);
    }

    const raw = entries.map(function (ntry, i) {
        const amtEl = childNamed(ntry, 'Amt');
        const ccy = amtEl && amtEl.getAttribute ? (amtEl.getAttribute('Ccy') || '') : '';
        if (ccy && currencies.indexOf(ccy) === -1) currencies.push(ccy);

        const bookg = childNamed(ntry, 'BookgDt') || childNamed(ntry, 'ValDt');
        const dtEl = bookg ? (childNamed(bookg, 'Dt') || childNamed(bookg, 'DtTm')) : null;

        const ind = textOf(childNamed(ntry, 'CdtDbtInd')).toUpperCase();
        const reversed = /^(true|1)$/i.test(textOf(childNamed(ntry, 'RvslInd')));

        const dtls = descendantNamed(ntry, 'TxDtls');
        const rmt = descendantNamed(dtls || ntry, 'Ustrd');
        const parties = descendantNamed(dtls || ntry, 'RltdPties');
        const counterparty = parties
            ? (ind === 'DBIT' ? descendantNamed(childNamed(parties, 'Cdtr') || parties, 'Nm')
                              : descendantNamed(childNamed(parties, 'Dbtr') || parties, 'Nm'))
            : null;
        const addtl = descendantNamed(ntry, 'AddtlNtryInf');
        const refs = descendantNamed(dtls || ntry, 'Refs');
        const ref = textOf(childNamed(ntry, 'AcctSvcrRef'))
            || (refs ? (textOf(childNamed(refs, 'AcctSvcrRef')) || textOf(childNamed(refs, 'EndToEndId'))) : '')
            || textOf(childNamed(ntry, 'NtryRef'));

        return {
            index: i + 1,
            rawDate: textOf(dtEl),
            rawAmount: textOf(amtEl),
            ind: ind,
            reversed: reversed,
            payee: textOf(counterparty) || textOf(rmt) || textOf(addtl),
            memo: textOf(rmt) && textOf(counterparty) ? textOf(rmt) : textOf(addtl),
            ref: ref && ref.toLowerCase() !== 'notprovided' ? ref : ''
        };
    });

    const analysis = analyseDateColumn(raw.map(function (r) { return r.rawDate; }));
    raw.forEach(function (r) {
        const date = resolveDate(r.rawDate, analysis.order || 'exact');
        let amount = parseAmount(r.rawAmount, '.');
        if (!date) {
            errors.push({ row: r.index, reason: 'the booking date could not be read', value: r.rawDate || '(missing)' });
            return;
        }
        if (amount === null) {
            errors.push({ row: r.index, reason: 'the amount could not be read', value: r.rawAmount || '(missing)' });
            return;
        }
        amount = Math.abs(amount);
        if (r.ind === 'DBIT') amount = -amount;
        else if (r.ind !== 'CRDT') {
            errors.push({ row: r.index, reason: 'the entry does not say whether it is a debit or a credit', value: r.ind || '(missing CdtDbtInd)' });
            return;
        }
        if (r.reversed) amount = -amount;
        rows.push({
            date: date,
            rawDate: r.rawDate,
            amount: roundMoney(amount),
            payee: r.payee || '',
            memo: r.memo && r.memo !== r.payee ? r.memo : '',
            importedId: r.ref || null,
            source: 'camt'
        });
    });
    if (!rows.length && !errors.length) {
        errors.push({ row: 0, reason: 'no <Ntry> statement entries were found in this file', value: '' });
    }
    return { format: 'camt', rows: rows, errors: errors, dateAnalysis: analysis, headers: [], currencies: currencies };
}

/* ───── Format detection ───── -------------------------------------------- */

// Consistent rows of two or more fields are delimited text whatever the file
// happens to be called, so this runs ahead of any extension guess.
function looksDelimited(text) {
    const sample = text.slice(0, 65536);
    const rows = tokeniseCSV(sample, detectDelimiter(sample)).filter(rowHasContent).slice(0, 25);
    if (rows.length < 2) return false;
    const counts = {};
    rows.forEach(function (r) { counts[r.length] = (counts[r.length] || 0) + 1; });
    let mode = 0, modeN = 0;
    Object.keys(counts).forEach(function (k) {
        if (counts[k] > modeN || (counts[k] === modeN && +k > mode)) { modeN = counts[k]; mode = +k; }
    });
    return mode >= 2 && (modeN / rows.length) >= 0.8;
}

function detectFormat(text, filename) {
    const s = String(text == null ? '' : text).replace(/^﻿/, '');
    const head = s.slice(0, 4096);
    const scan = s.slice(0, 262144);
    const name = String(filename || '').toLowerCase();

    if (/^\s*OFXHEADER/i.test(head) || /<OFX[\s>]/i.test(head) || /<STMTTRN>/i.test(scan)) return 'ofx';
    if (/<(?:[A-Za-z0-9_.\-]+:)?Document[\s>]/i.test(head) &&
        /camt\.05|BkToCstmrStmt|BkToCstmrAcctRpt|<(?:[A-Za-z0-9_.\-]+:)?Ntry>/i.test(scan)) return 'camt';
    if (/(^|[\r\n])\s*!\s*(Type|Account|Option|Clear)/i.test(head)) return 'qif';
    if (/^\s*<\?xml/i.test(head) || /^\s*</.test(head)) {
        if (/<OFX/i.test(scan)) return 'ofx';
        return 'camt';
    }
    if (looksDelimited(s)) return 'csv';
    if (name.slice(-4) === '.qif') return 'qif';
    if (name.slice(-4) === '.ofx' || name.slice(-4) === '.qfx') return 'ofx';
    if (name.slice(-4) === '.xml') return 'camt';
    return 'csv';
}

const FORMAT_LABELS = {
    csv: 'Delimited text (CSV)',
    ofx: 'OFX / QFX statement',
    qif: 'QIF statement',
    camt: 'ISO 20022 camt.053 statement'
};

function sourceFor(format, filename) {
    const name = String(filename || '').toLowerCase();
    if (format === 'ofx' && name.slice(-4) === '.qfx') return 'qfx';
    return format;
}

function parseByFormat(format, text, filename) {
    if (format === 'ofx') return parseOFX(text);
    if (format === 'qif') return parseQIF(text);
    if (format === 'camt') return parseCAMT(text);
    return parseCSV(text);
}

/* ───── Auto-categorisation ───── ----------------------------------------- */

function buildCategoryIndex() {
    const st = appState();
    const exact = Object.create(null);
    const loose = [];
    if (!st) return { exact: exact, loose: loose };

    // Actuals the user has already filed are the strongest signal, so they go
    // in last and win over the planned names.
    (st.transactions || []).forEach(function (t) {
        if (!t || !t.categoryId) return;
        const key = normalisePayee(t.name);
        if (!key) return;
        if (exact[key] == null) exact[key] = { categoryId: t.categoryId, why: 'a planned transaction with the same name' };
        if (key.length >= 4) loose.push({ key: key, categoryId: t.categoryId, why: 'a planned transaction' });
    });
    (st.actuals || []).forEach(function (a) {
        if (!a || !a.categoryId) return;
        const key = normalisePayee(a.payee);
        if (!key) return;
        exact[key] = { categoryId: a.categoryId, why: 'an imported transaction you already filed' };
        if (key.length >= 4) loose.push({ key: key, categoryId: a.categoryId, why: 'an imported transaction you already filed' });
    });
    return { exact: exact, loose: loose };
}

// Best effort only: an unrecognised payee is left uncategorised rather than
// filed somewhere plausible-looking and wrong.
function suggestCategory(payee, index) {
    const key = normalisePayee(payee);
    if (!key) return null;
    if (index.exact[key]) return index.exact[key];
    for (let i = index.loose.length - 1; i >= 0; i--) {
        const cand = index.loose[i];
        if (key.indexOf(cand.key) !== -1 || cand.key.indexOf(key) !== -1) return cand;
    }
    return null;
}

/* ───── De-duplication ───── ---------------------------------------------- */

function classifyRows(records, accountId) {
    const st = appState();
    const existing = (st && Array.isArray(st.actuals)) ? st.actuals : [];
    const mine = existing.filter(function (a) { return a && a.accountId === accountId; });

    const knownIds = new Set();
    mine.forEach(function (a) { if (a.importedId) knownIds.add(String(a.importedId)); });

    const byCents = new Map();
    mine.forEach(function (a) {
        const c = toCents(a.amount);
        if (!byCents.has(c)) byCents.set(c, []);
        byCents.get(c).push(a);
    });

    const fresh = [];
    const skipped = [];
    const possible = [];
    const batchIds = new Set();

    records.forEach(function (rec) {
        // Two genuinely separate but identical purchases on one day hash to the
        // same key, so repeats within a file get an occurrence suffix. The same
        // file re-imported produces the same suffixes, so it still de-duplicates.
        let id = rec.importedId;
        if (!id) {
            const base = fallbackImportedId(accountId, rec.date, rec.amount, rec.payee);
            let n = 1;
            id = base;
            while (batchIds.has(id)) { n++; id = base + '#' + n; }
        }
        batchIds.add(id);
        const row = Object.assign({}, rec, { importedId: id });

        if (knownIds.has(String(id))) { skipped.push(row); return; }

        const cents = toCents(row.amount);
        const day = isoToDays(row.date);
        const nearby = byCents.get(cents) || [];
        let match = null;
        if (day != null) {
            for (let i = 0; i < nearby.length; i++) {
                const other = nearby[i];
                const otherDay = isoToDays(other.date);
                if (otherDay == null) continue;
                const delta = Math.abs(otherDay - day);
                if (delta <= 3) { match = { record: other, dayDelta: otherDay - day }; break; }
            }
        }
        if (match) possible.push({ row: row, match: match.record, dayDelta: match.dayDelta });
        else fresh.push(row);
    });

    return { fresh: fresh, skipped: skipped, possible: possible };
}

/* ───── Injected styles ───── --------------------------------------------- */

const STYLE_ID = 'importersStyles';

const STYLES = [
    '.imp-overlay{position:fixed;inset:0;background:rgba(4,6,16,.72);display:flex;align-items:center;justify-content:center;z-index:120;padding:20px;}',
    '.imp-modal{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-card);box-shadow:var(--shadow);width:100%;max-width:920px;max-height:calc(100vh - 40px);display:flex;flex-direction:column;}',
    '.imp-modal:focus{outline:none;}',
    '.imp-modal :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px;}',
    '.imp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 22px 0;}',
    '.imp-kicker{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;}',
    '.imp-head h3{margin:4px 0 0;font-size:1.05rem;color:var(--text);}',
    '.imp-head .imp-file{margin:4px 0 0;font-size:12.5px;color:var(--muted);overflow-wrap:anywhere;}',
    '.imp-steps{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:14px 0 0;padding:0 22px;}',
    '.imp-steps li{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--border);border-radius:var(--radius-pill);background:var(--bg-raised);font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);}',
    '.imp-steps li.done{color:var(--live);border-color:rgba(61,220,132,.45);}',
    '.imp-steps li.active{color:var(--btn-ink);background:var(--accent);border-color:var(--accent);font-weight:700;}',
    '.imp-body{padding:16px 22px 4px;overflow-y:auto;flex:1 1 auto;}',
    '.imp-foot{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:14px 22px 18px;border-top:1px solid var(--border);margin-top:12px;}',
    '.imp-foot .imp-spacer{flex:1;}',
    '.imp-note{font-size:12.5px;color:var(--muted);margin:0 0 12px;}',
    '.imp-note code{font-family:var(--font-mono);font-size:11.5px;color:var(--tag-text);}',
    '.imp-flag{border:1px solid var(--border);border-left:3px solid var(--warn);background:var(--bg-raised);border-radius:var(--radius-control);padding:10px 12px;font-size:12.5px;color:var(--muted);margin:0 0 12px;}',
    '.imp-flag strong{color:var(--warn);}',
    '.imp-flag.bad{border-left-color:var(--down);}',
    '.imp-flag.bad strong{color:var(--down);}',
    '.imp-flag.ok{border-left-color:var(--live);}',
    '.imp-flag.ok strong{color:var(--live);}',
    '.imp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:14px;}',
    '.imp-grid .full{grid-column:1 / -1;}',
    '.imp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;}',
    '.imp-stat{background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-control);padding:10px 12px;}',
    '.imp-stat .k{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;}',
    '.imp-stat .v{font-family:var(--font-mono);font-size:20px;font-variant-numeric:tabular-nums;color:var(--text);margin-top:2px;}',
    '.imp-stat.good .v{color:var(--live);}',
    '.imp-stat.warn .v{color:var(--warn);}',
    '.imp-stat.bad .v{color:var(--down);}',
    '.imp-tw{overflow:auto;max-height:250px;border:1px solid var(--border);border-radius:var(--radius-control);background:var(--card);margin-bottom:14px;}',
    '.imp-tw.tall{max-height:320px;}',
    '.imp-tw table{width:100%;border-collapse:collapse;font-size:12.5px;}',
    '.imp-tw th{position:sticky;top:0;z-index:1;background:var(--card-chrome);font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:600;text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);white-space:nowrap;}',
    '.imp-tw td{padding:6px 9px;border-bottom:1px solid var(--border);white-space:nowrap;color:var(--text);}',
    '.imp-tw td.wide{white-space:normal;min-width:180px;overflow-wrap:anywhere;}',
    '.imp-tw td.num{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums;}',
    '.imp-tw td.pos{color:var(--live);}',
    '.imp-tw td.neg{color:var(--down);}',
    '.imp-tw td.dim{color:var(--muted);}',
    '.imp-tw td.bad{color:var(--down);}',
    '.imp-tw tbody tr:hover{background:var(--bg-raised);}',
    '.imp-tw select{padding:3px 7px;font-size:12px;height:28px;min-width:130px;}',
    '.imp-tw input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;}',
    '.imp-bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}',
    '.imp-bulk select{width:auto;min-width:160px;height:32px;padding:4px 8px;font-size:12.5px;}',
    '.imp-bulk button{height:32px;padding:5px 11px;font-size:12.5px;}',
    'label.imp-choice{display:flex;align-items:flex-start;gap:9px;font-family:var(--font-sans);font-size:13.5px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--text);margin:0 0 9px;cursor:pointer;}',
    'label.imp-choice input{width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:var(--accent);cursor:pointer;}',
    'label.imp-choice .sub{display:block;font-family:var(--font-sans);font-size:12px;font-weight:400;color:var(--muted);letter-spacing:0;text-transform:none;margin-top:1px;}',
    '.imp-example{font-family:var(--font-mono);font-size:12px;line-height:1.7;color:var(--muted);background:var(--card-chrome);border:1px solid var(--border);border-radius:var(--radius-control);padding:9px 11px;margin:0 0 12px;overflow-wrap:anywhere;}',
    '.imp-example b{color:var(--accent);font-weight:700;}',
    '.imp-sub{font-size:12px;color:var(--muted);margin:-6px 0 12px;}',
    '.imp-empty{padding:22px;text-align:center;color:var(--muted);font-size:13px;}',
    '.imp-cap{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;margin:16px 0 8px;}',
    '.imp-cap:first-child{margin-top:0;}',
    '@media (max-width:700px){.imp-overlay{padding:0;}.imp-modal{max-height:100vh;border-radius:0;}.imp-head,.imp-steps,.imp-body,.imp-foot{padding-left:14px;padding-right:14px;}}'
].join('\n');

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const node = document.createElement('style');
    node.id = STYLE_ID;
    node.textContent = STYLES;
    document.head.appendChild(node);
}

/* ───── Wizard state ───── ------------------------------------------------ */

const ACCEPT = '.csv,.ofx,.qfx,.qif,.xml';
const MAX_BYTES = 25 * 1024 * 1024;
const PREVIEW_ROWS = 10;
const MAX_EDITABLE_ROWS = 200;

let wiz = null;
let overlayEl = null;
let modalEl = null;
let lastFocused = null;

function blankMapping() {
    return { date: null, payee: null, amount: null, amountIn: null, amountOut: null, flipSign: false, dateFormat: 'auto' };
}

function accounts() {
    const st = appState();
    return (st && Array.isArray(st.accounts)) ? st.accounts : [];
}

function accountName(id) {
    const found = accounts().filter(function (a) { return a.id === id; })[0];
    return found ? found.name : 'that account';
}

function categoryName(id) {
    const st = appState();
    const cats = (st && st.categories) || [];
    const found = cats.filter(function (c) { return c.id === id; })[0];
    return found ? found.name : '';
}

/* ───── File reading ───── ------------------------------------------------ */
/*
 * FileReader only ever sees the File object the user handed over through the
 * picker. Statement exports from older banking systems are frequently
 * windows-1252 rather than UTF-8, so a replacement character in the decoded
 * text triggers one retry in that encoding.
 */

function readFileText(file) {
    return new Promise(function (resolve, reject) {
        function attempt(encoding) {
            const reader = new FileReader();
            reader.onerror = function () { reject(new Error('the file could not be read')); };
            reader.onload = function (ev) {
                const text = String(ev.target.result == null ? '' : ev.target.result);
                if (!encoding && text.indexOf('�') !== -1) { attempt('windows-1252'); return; }
                resolve(text);
            };
            if (encoding) reader.readAsText(file, encoding);
            else reader.readAsText(file);
        }
        attempt('');
    });
}

function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.style.display = 'none';
    input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        if (input.parentNode) input.parentNode.removeChild(input);
        if (file) openImportWizard(file);
    });
    document.body.appendChild(input);
    input.click();
}

function openImportWizard(file) {
    if (!appState()) { flash('The app has not finished loading yet.', 'warning'); return; }
    if (!file) { pickFile(); return; }
    if (file.size > MAX_BYTES) {
        flash('That file is ' + Math.round(file.size / 1048576) + ' MB. Statement files are normally well under 25 MB — check you picked the right one.', 'warning');
        return;
    }
    readFileText(file).then(function (text) {
        startWizard(file, text);
    }).catch(function (err) {
        flash('The file could not be read: ' + err.message, 'danger');
    });
}

function startWizard(file, text) {
    const format = detectFormat(text, file.name);
    const parsed = parseByFormat(format, text, file.name);
    const accts = accounts();

    wiz = {
        file: file,
        format: format,
        source: sourceFor(format, file.name),
        parsed: parsed,
        step: 1,
        accountId: accts.length === 1 ? accts[0].id : '',
        mapping: blankMapping(),
        decimal: '.',
        dateAnalysis: parsed.dateAnalysis || null,
        rememberedApplied: false,
        usedRemembered: false,
        result: null,
        rowChoices: [],
        dupChoices: [],
        catIndex: buildCategoryIndex()
    };
    // Only the text just read is held, and only for as long as the wizard is
    // open; nothing is kept once it closes.
    mountModal();
    render();
}

/* ───── Modal shell ───── ------------------------------------------------- */

function mountModal() {
    injectStyles();
    closeShell();
    lastFocused = document.activeElement;

    overlayEl = document.createElement('div');
    overlayEl.className = 'imp-overlay';
    overlayEl.addEventListener('mousedown', function (e) { if (e.target === overlayEl) closeWizard(); });

    modalEl = document.createElement('div');
    modalEl.className = 'imp-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'impTitle');
    modalEl.tabIndex = -1;
    modalEl.addEventListener('keydown', onModalKeydown);
    // Delegated once for the life of the dialog. Re-binding these on every
    // render would stack duplicate handlers and fire each click repeatedly.
    wireModal();

    overlayEl.appendChild(modalEl);
    document.body.appendChild(overlayEl);
}

function closeShell() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    modalEl = null;
}

function closeWizard() {
    closeShell();
    wiz = null;
    if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus(); } catch (e) { /* the trigger may be gone */ }
    }
    lastFocused = null;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusables() {
    if (!modalEl) return [];
    return Array.prototype.filter.call(modalEl.querySelectorAll(FOCUSABLE), function (n) {
        return n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement;
    });
}

function onModalKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeWizard(); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) { e.preventDefault(); modalEl.focus(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === modalEl || !modalEl.contains(active))) {
        e.preventDefault(); last.focus();
    } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
    }
}

/* ───── Rendering ───── --------------------------------------------------- */

const STEP_TITLES = [
    '', 'Which account is this?', 'Does this look like your statement?',
    'Point the columns at the right fields', 'Check what is about to be added'
];

function render() {
    if (!wiz || !modalEl) return;
    const steps = ['Account', 'Preview', 'Columns', 'Summary'];
    let html = '';

    html += '<div class="imp-head"><div>' +
        '<div class="imp-kicker">Import bank file</div>' +
        '<h3 id="impTitle">' + esc(STEP_TITLES[wiz.step]) + '</h3>' +
        '<p class="imp-file">' + esc(wiz.file.name) + ' &middot; ' + esc(FORMAT_LABELS[wiz.format] || wiz.format) +
        (wiz.format === 'csv' && wiz.parsed.delimiter ? ' &middot; ' + esc(DELIMITER_LABELS[wiz.parsed.delimiter] || 'custom') + '-separated' : '') +
        '</p></div>' +
        '<button type="button" class="ghost icon" data-act="close" aria-label="Close the importer">&#10005;</button></div>';

    html += '<ol class="imp-steps">';
    steps.forEach(function (label, i) {
        const n = i + 1;
        const cls = n === wiz.step ? 'active' : (n < wiz.step ? 'done' : '');
        html += '<li class="' + cls + '"' + (n === wiz.step ? ' aria-current="step"' : '') + '>' +
            (n < wiz.step ? '&#10003;' : n) + ' ' + esc(label) + '</li>';
    });
    html += '</ol>';

    html += '<div class="imp-body">' + renderStep() + '</div>';
    html += '<div class="imp-foot">' + renderFooter() + '</div>';

    modalEl.innerHTML = html;

    const focusTarget = modalEl.querySelector('[data-autofocus]') || modalEl.querySelector('[data-act="next"]') || modalEl;
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
}

function renderStep() {
    if (wiz.step === 1) return renderStepAccount();
    if (wiz.step === 2) return renderStepPreview();
    if (wiz.step === 3) return renderStepColumns();
    return renderStepSummary();
}

function renderFooter() {
    let html = '';
    if (wiz.step > 1) html += '<button type="button" class="ghost" data-act="back">&larr; Back</button>';
    html += '<span class="imp-spacer"></span>';
    html += '<button type="button" class="ghost" data-act="close">Cancel</button>';
    if (wiz.step < 4) {
        const blocked = nextBlockedReason();
        html += '<button type="button" class="primary" data-act="next"' + (blocked ? ' disabled title="' + esc(blocked) + '"' : '') + '>Continue &rarr;</button>';
        if (blocked) html += '<span class="imp-note" style="margin:0;flex-basis:100%;">' + esc(blocked) + '</span>';
    } else {
        const n = wiz.result ? countChosen() : 0;
        html += '<button type="button" class="primary" data-act="commit"' + (n ? '' : ' disabled') + '>' +
            (n ? 'Add ' + n + ' ' + plural(n, 'transaction', 'transactions') : 'Nothing to add') + '</button>';
    }
    return html;
}

function nextBlockedReason() {
    if (wiz.step === 1) {
        if (!accounts().length) return 'Add an account first — imported transactions have to belong to one.';
        if (!wiz.accountId) return 'Choose the account this statement came from.';
        return '';
    }
    if (wiz.step === 2) {
        if (!hasAnyRows()) return 'There is nothing in this file that can be imported.';
        return '';
    }
    if (wiz.step === 3) {
        if (wiz.format === 'csv') {
            if (!wiz.mapping.date) return 'Choose which column holds the date.';
            if (!wiz.mapping.amount && !wiz.mapping.amountIn && !wiz.mapping.amountOut) return 'Choose which column holds the amount.';
        }
        const a = currentDateAnalysis();
        if (a && a.needsChoice && wiz.mapping.dateFormat === 'auto') return 'Choose how to read the dates before going on.';
        const built = buildRecords();
        if (!built.records.length) return 'Nothing could be read with these settings — check the columns above.';
        return '';
    }
    return '';
}

function hasAnyRows() {
    if (wiz.format === 'csv') return wiz.parsed.rows.length > 0;
    return wiz.parsed.rows.length > 0;
}

/* ── Step 1: account ── */

function renderStepAccount() {
    const accts = accounts();
    let html = '';
    if (!accts.length) {
        return '<div class="imp-flag bad"><strong>No accounts yet.</strong> Imported transactions have to be attributed to an account. ' +
            'Close this, add the account this statement belongs to, then import again.</div>';
    }
    html += '<p class="imp-note">These transactions will be recorded against the account you pick. ' +
        'Nothing is written until you confirm the last step.</p>';
    accts.forEach(function (a) {
        const checked = a.id === wiz.accountId ? ' checked' : '';
        const remembered = rememberedMapping(a.id);
        html += '<label class="imp-choice"><input type="radio" name="impAccount" value="' + esc(a.id) + '" data-act="account"' + checked + '>' +
            '<span><strong>' + esc(a.name) + '</strong>' +
            '<span class="sub">' + esc(String(a.type || 'account')) +
            (remembered ? ' &middot; a saved column layout from a previous import is ready to reuse' : '') +
            '</span></span></label>';
    });

    const counts = summariseParse();
    html += '<div class="imp-flag ok"><strong>' + esc(FORMAT_LABELS[wiz.format] || wiz.format) + ' detected.</strong> ' +
        esc(counts) + '</div>';
    if (wiz.format === 'ofx') {
        html += '<p class="imp-note">Only the transaction records are read from an OFX file. Any sign-on details the ' +
            'file still carries are discarded before parsing starts and never reach your data.</p>';
    }
    return html;
}

function summariseParse() {
    if (wiz.format === 'csv') {
        const n = wiz.parsed.rows.length;
        return n + ' data ' + plural(n, 'row', 'rows') + ' across ' + wiz.parsed.headers.length + ' columns' +
            (wiz.parsed.hasHeader ? ', with the first row read as headings.' : ', with no heading row found.');
    }
    const n = wiz.parsed.rows.length;
    const bad = wiz.parsed.errors.length;
    return n + ' ' + plural(n, 'transaction', 'transactions') + ' read' +
        (bad ? ', ' + bad + ' ' + plural(bad, 'record', 'records') + ' could not be read.' : '.');
}

/* ── Step 2: preview ── */

function renderStepPreview() {
    let html = '<p class="imp-note">The first ' + PREVIEW_ROWS + ' rows exactly as they appear in the file. ' +
        'If this is not the statement you meant to pick, go back and choose another file.</p>';

    if (wiz.format === 'csv') {
        const p = wiz.parsed;
        if (!p.rows.length) return html + '<div class="imp-empty">No rows were found in this file.</div>';
        html += '<div class="imp-tw"><table><thead><tr><th>#</th>';
        p.headers.forEach(function (h) { html += '<th>' + esc(h) + '</th>'; });
        html += '</tr></thead><tbody>';
        p.rows.slice(0, PREVIEW_ROWS).forEach(function (row, i) {
            html += '<tr><td class="dim">' + (i + 1) + '</td>';
            row.forEach(function (cell) { html += '<td>' + esc(cell) + '</td>'; });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        if (p.rows.length > PREVIEW_ROWS) {
            html += '<p class="imp-sub">' + (p.rows.length - PREVIEW_ROWS) + ' more ' +
                plural(p.rows.length - PREVIEW_ROWS, 'row', 'rows') + ' below these.</p>';
        }
        return html;
    }

    const rows = wiz.parsed.rows;
    if (!rows.length) {
        return html + '<div class="imp-empty">No transaction records were found in this file.</div>' + renderParseErrors();
    }
    html += '<div class="imp-tw"><table><thead><tr><th>Date</th><th>Payee</th><th class="num">Amount</th><th>Memo</th><th>Reference</th></tr></thead><tbody>';
    rows.slice(0, PREVIEW_ROWS).forEach(function (r) {
        html += '<tr><td>' + esc(r.date || r.rawDate || '') + '</td>' +
            '<td class="wide">' + esc(r.payee || '(no description)') + '</td>' +
            '<td class="num ' + (r.amount < 0 ? 'neg' : 'pos') + '">' + esc(money(r.amount)) + '</td>' +
            '<td class="wide dim">' + esc(r.memo || '') + '</td>' +
            '<td class="dim">' + esc(r.importedId ? 'from the file' : 'computed') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    if (rows.length > PREVIEW_ROWS) {
        html += '<p class="imp-sub">' + (rows.length - PREVIEW_ROWS) + ' more ' +
            plural(rows.length - PREVIEW_ROWS, 'record', 'records') + ' below these.</p>';
    }
    return html + renderParseErrors();
}

function renderParseErrors() {
    const errs = wiz.parsed.errors || [];
    if (!errs.length) return '';
    let html = '<div class="imp-flag"><strong>' + errs.length + ' ' + plural(errs.length, 'record', 'records') +
        ' could not be read</strong> and will be left out. They are listed on the last step.</div>';
    return html;
}

/* ── Step 3: columns ── */

function currentDateAnalysis() {
    if (wiz.format === 'csv') return wiz.dateAnalysis;
    return wiz.parsed.dateAnalysis;
}

function renderStepColumns() {
    let html = '';

    if (wiz.format === 'csv') {
        if (wiz.usedRemembered) {
            html += '<div class="imp-flag ok"><strong>A saved layout for ' + esc(accountName(wiz.accountId)) + ' fits this file.</strong> ' +
                'It has been applied — change anything below if this month\'s export is different.</div>';
        }
        html += '<div class="imp-grid">';
        html += selectField('impDate', 'Date column', wiz.mapping.date, wiz.parsed.headers, 'date');
        html += selectField('impPayee', 'Payee / description column', wiz.mapping.payee, wiz.parsed.headers, 'payee');
        html += '</div>';

        const split = !!(wiz.mapping.amountIn || wiz.mapping.amountOut) && !wiz.mapping.amount;
        html += '<div class="imp-cap">How the amount is written</div>';
        html += '<label class="imp-choice"><input type="radio" name="impAmtMode" value="single" data-act="amtmode"' + (split ? '' : ' checked') + '>' +
            '<span><strong>One column, already signed</strong><span class="sub">Money out is negative, money in is positive.</span></span></label>';
        html += '<label class="imp-choice"><input type="radio" name="impAmtMode" value="split" data-act="amtmode"' + (split ? ' checked' : '') + '>' +
            '<span><strong>Separate money-out and money-in columns</strong><span class="sub">Common in UK and European exports.</span></span></label>';

        html += '<div class="imp-grid">';
        if (split) {
            html += selectField('impOut', 'Money out (debit) column', wiz.mapping.amountOut, wiz.parsed.headers, 'amountOut');
            html += selectField('impIn', 'Money in (credit) column', wiz.mapping.amountIn, wiz.parsed.headers, 'amountIn');
        } else {
            html += selectField('impAmount', 'Amount column', wiz.mapping.amount, wiz.parsed.headers, 'amount');
        }
        html += '</div>';

        html += '<label class="imp-choice"><input type="checkbox" data-act="flip"' + (wiz.mapping.flipSign ? ' checked' : '') + '>' +
            '<span><strong>Flip the sign</strong><span class="sub">Turn on if money out is coming through as positive.</span></span></label>';
    } else {
        html += '<div class="imp-flag ok"><strong>' + esc(FORMAT_LABELS[wiz.format]) + ' names its own fields.</strong> ' +
            'Date, payee and amount were taken straight from the file, so there is nothing to line up here.</div>';
        html += '<label class="imp-choice"><input type="checkbox" data-act="flip"' + (wiz.mapping.flipSign ? ' checked' : '') + '>' +
            '<span><strong>Flip the sign</strong><span class="sub">Only needed if this bank writes money out as positive.</span></span></label>';
    }

    html += renderDateChooser();
    html += renderLivePreview();
    return html;
}

function selectField(id, label, value, headers, key) {
    let html = '<div><label for="' + id + '">' + esc(label) + '</label>' +
        '<select id="' + id + '" data-act="map" data-key="' + esc(key) + '">' +
        '<option value=""' + (value ? '' : ' selected') + '>&mdash; not set &mdash;</option>';
    headers.forEach(function (h) {
        html += '<option value="' + esc(h) + '"' + (h === value ? ' selected' : '') + '>' + esc(h) + '</option>';
    });
    html += '</select></div>';
    return html;
}

function renderDateChooser() {
    const a = currentDateAnalysis();
    if (!a) return '';
    let html = '<div class="imp-cap">Date order</div>';

    if (!a.needsChoice && wiz.mapping.dateFormat === 'auto') {
        html += '<div class="imp-flag ok"><strong>Resolved from the file.</strong> ' + esc(a.reason) + '</div>';
    }
    if (a.needsChoice) {
        const worked = a.examples.dmy && a.examples.mdy
            ? '<div class="imp-example">' + esc(a.sample) + ' read <b>day first</b> is ' + esc(a.examples.dmy) + '<br>' +
              esc(a.sample) + ' read <b>month first</b> is ' + esc(a.examples.mdy) + '</div>'
            : '';
        html += '<div class="imp-flag' + (a.conflict ? ' bad' : '') + '"><strong>' +
            (a.conflict ? 'This column is inconsistent.' : 'This file cannot say which way round its dates are.') +
            '</strong> ' + esc(a.reason) + ' Pick the reading that matches your bank &mdash; getting this wrong silently moves ' +
            'transactions to the wrong month.</div>' + worked;
    }

    const opts = [
        ['auto', a.needsChoice ? 'Not chosen yet' : 'Read from the file (' + (a.order === 'mdy' ? 'month first' : a.order === 'dmy' ? 'day first' : 'unambiguous') + ')'],
        ['dmy', 'Day first — 03/04/2026 is 3 April 2026'],
        ['mdy', 'Month first — 03/04/2026 is 4 March 2026']
    ];
    html += '<div class="imp-grid"><div><label for="impDateFmt">How to read the dates</label><select id="impDateFmt" data-act="datefmt">';
    opts.forEach(function (o) {
        html += '<option value="' + esc(o[0]) + '"' + (wiz.mapping.dateFormat === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    });
    html += '</select></div></div>';
    return html;
}

function renderLivePreview() {
    const built = buildRecords();
    const rows = built.records;
    const bad = built.errors;
    let html = '<div class="imp-cap">Reading it back</div>';

    if (!rows.length) {
        html += '<div class="imp-flag bad"><strong>Nothing can be read with these settings.</strong> ' +
            (bad.length ? esc(bad[0].reason) + ' — for example ' + esc(String(bad[0].value || '(empty)')) + '.' : '') + '</div>';
        return html;
    }

    const positives = rows.filter(function (r) { return r.amount > 0; }).length;
    html += '<div class="imp-tw"><table><thead><tr><th>Date</th><th>Payee</th><th class="num">Amount</th></tr></thead><tbody>';
    rows.slice(0, 8).forEach(function (r) {
        html += '<tr><td>' + esc(r.date) + '</td><td class="wide">' + esc(r.payee || '(no description)') + '</td>' +
            '<td class="num ' + (r.amount < 0 ? 'neg' : 'pos') + '">' + esc(money(r.amount)) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="imp-sub">' + rows.length + ' ' + plural(rows.length, 'row', 'rows') + ' read' +
        (bad.length ? ', ' + bad.length + ' could not be' : '') + '.</p>';

    if (rows.length >= 3 && positives === rows.length) {
        html += '<div class="imp-flag"><strong>Every amount came out positive.</strong> A statement normally has money going ' +
            'both ways — check whether the sign needs flipping, or whether this file uses separate money-out and money-in columns.</div>';
    }
    if (built.currencies && built.currencies.length) {
        const st = appState();
        const mine = (st && st.settings && st.settings.currency) || '';
        const foreign = built.currencies.filter(function (c) { return mine && c && c !== mine; });
        if (foreign.length) {
            html += '<div class="imp-flag"><strong>Different currency.</strong> This file is in ' + esc(foreign.join(', ')) +
                ' but your budget is in ' + esc(mine) + '. The numbers are imported exactly as written, without conversion.</div>';
        }
    }
    return html;
}

/* ── Step 4: summary ── */

function renderStepSummary() {
    const res = wiz.result;
    if (!res) return '<div class="imp-empty">Nothing to summarise.</div>';

    let html = '<div class="imp-stats">';
    html += stat('New', res.fresh.length, res.fresh.length ? 'good' : '');
    html += stat('Already imported', res.skipped.length, '');
    html += stat('Need a decision', res.possible.length, res.possible.length ? 'warn' : '');
    html += stat('Unreadable', res.failed.length, res.failed.length ? 'bad' : '');
    html += '</div>';

    html += '<p class="imp-note">Going into <strong>' + esc(accountName(wiz.accountId)) + '</strong>. ' +
        'Nothing has been written yet — that happens when you press the button below, and a backup is taken first.</p>';

    if (res.skipped.length) {
        html += '<div class="imp-flag ok"><strong>' + res.skipped.length + ' ' + plural(res.skipped.length, 'row', 'rows') +
            ' already in your records</strong> and will be left alone.</div>';
    }

    if (res.possible.length) {
        html += '<div class="imp-cap">Possible duplicates &mdash; ' + res.possible.length + ' to decide</div>';
        html += '<p class="imp-sub">Same amount, within three days of something already recorded. Tick anything that is genuinely a ' +
            'separate transaction; anything left unticked is skipped.</p>';
        html += '<div class="imp-bulk"><button type="button" class="ghost" data-act="dupall">Tick all</button>' +
            '<button type="button" class="ghost" data-act="dupnone">Untick all</button></div>';
        html += '<div class="imp-tw"><table><thead><tr><th>Import<br>anyway</th><th>Date</th><th>Payee</th>' +
            '<th class="num">Amount</th><th>Already recorded</th></tr></thead><tbody>';
        res.possible.forEach(function (p, i) {
            const r = p.row;
            const when = p.dayDelta === 0 ? 'same day' :
                (Math.abs(p.dayDelta) + ' ' + plural(Math.abs(p.dayDelta), 'day', 'days') + (p.dayDelta > 0 ? ' later' : ' earlier'));
            html += '<tr><td><input type="checkbox" data-act="dup" data-i="' + i + '"' + (wiz.dupChoices[i] ? ' checked' : '') +
                ' aria-label="Import this possible duplicate anyway"></td>' +
                '<td>' + esc(r.date) + '</td><td class="wide">' + esc(r.payee || '(no description)') + '</td>' +
                '<td class="num ' + (r.amount < 0 ? 'neg' : 'pos') + '">' + esc(money(r.amount)) + '</td>' +
                '<td class="wide dim">' + esc(p.match.payee || '(no description)') + ' on ' + esc(p.match.date) + ' (' + esc(when) + ')</td></tr>';
        });
        html += '</tbody></table></div>';
    }

    if (res.fresh.length) {
        html += '<div class="imp-cap">New transactions &mdash; ' + res.fresh.length + '</div>';
        html += '<div class="imp-bulk">' +
            '<button type="button" class="ghost" data-act="selall">Select all</button>' +
            '<button type="button" class="ghost" data-act="selnone">Select none</button>' +
            '<label class="visually-hidden" for="impBulkCat">Category to apply</label>' +
            '<select id="impBulkCat">' + categoryOptions('') + '</select>' +
            '<button type="button" data-act="bulkcat">Apply to selected</button></div>';
        const shown = res.fresh.slice(0, MAX_EDITABLE_ROWS);
        html += '<div class="imp-tw tall"><table><thead><tr><th>Add</th><th>Date</th><th>Payee</th>' +
            '<th class="num">Amount</th><th>Category</th></tr></thead><tbody>';
        shown.forEach(function (r, i) {
            const choice = wiz.rowChoices[i] || {};
            html += '<tr><td><input type="checkbox" data-act="row" data-i="' + i + '"' + (choice.keep ? ' checked' : '') +
                ' aria-label="Add this transaction"></td>' +
                '<td>' + esc(r.date) + '</td><td class="wide">' + esc(r.payee || '(no description)') + '</td>' +
                '<td class="num ' + (r.amount < 0 ? 'neg' : 'pos') + '">' + esc(money(r.amount)) + '</td>' +
                '<td><select data-act="cat" data-i="' + i + '" aria-label="Category for this transaction">' +
                categoryOptions(choice.categoryId || '') + '</select></td></tr>';
        });
        html += '</tbody></table></div>';
        if (res.fresh.length > MAX_EDITABLE_ROWS) {
            html += '<p class="imp-sub">Showing the first ' + MAX_EDITABLE_ROWS + '. The remaining ' +
                (res.fresh.length - MAX_EDITABLE_ROWS) + ' are imported with the categories worked out for them, and can be edited afterwards.</p>';
        }
        const guessed = wiz.rowChoices.filter(function (c) { return c && c.suggested; }).length;
        if (guessed) {
            html += '<p class="imp-sub">' + guessed + ' ' + plural(guessed, 'payee was', 'payees were') +
                ' recognised from what you have already categorised. The rest are left uncategorised rather than guessed at.</p>';
        }
    } else {
        html += '<div class="imp-flag ok"><strong>Nothing new in this file.</strong> Everything in it is either already recorded ' +
            'or waiting on a decision above.</div>';
    }

    if (res.failed.length) {
        html += '<div class="imp-cap">Could not be read &mdash; ' + res.failed.length + '</div>';
        html += '<div class="imp-tw"><table><thead><tr><th>Row</th><th>Why</th><th>Value</th></tr></thead><tbody>';
        res.failed.slice(0, 100).forEach(function (f) {
            html += '<tr><td class="dim">' + esc(String(f.row || '?')) + '</td>' +
                '<td class="wide">' + esc(f.reason) + '</td>' +
                '<td class="wide bad">' + esc(String(f.value == null || f.value === '' ? '(empty)' : f.value).slice(0, 120)) + '</td></tr>';
        });
        html += '</tbody></table></div>';
        if (res.failed.length > 100) html += '<p class="imp-sub">Showing the first 100 of ' + res.failed.length + '.</p>';
    }

    return html;
}

function stat(label, value, tone) {
    return '<div class="imp-stat' + (tone ? ' ' + tone : '') + '"><div class="k">' + esc(label) + '</div>' +
        '<div class="v">' + esc(String(value)) + '</div></div>';
}

function categoryOptions(selected) {
    const st = appState();
    const cats = (st && st.categories) || [];
    let html = '<option value=""' + (selected ? '' : ' selected') + '>Uncategorised</option>';
    cats.forEach(function (c) {
        html += '<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    return html;
}

/* ───── Record building ───── --------------------------------------------- */

function buildRecords() {
    if (wiz.format === 'csv') return buildCsvRecords();
    return buildNativeRecords();
}

function buildNativeRecords() {
    const analysis = wiz.parsed.dateAnalysis;
    const order = wiz.mapping.dateFormat === 'auto' ? (analysis ? analysis.order : 'exact') : wiz.mapping.dateFormat;
    const errors = (wiz.parsed.errors || []).slice();
    const records = [];
    wiz.parsed.rows.forEach(function (r, i) {
        // The parser already resolved this when the file was unambiguous; it is
        // re-resolved here so a chosen order takes effect without re-parsing.
        const finalDate = resolveDate(r.rawDate != null ? r.rawDate : r.date, order) || null;
        if (!finalDate) {
            errors.push({ row: i + 1, reason: 'the date could not be read with the chosen order', value: r.rawDate || r.date || '(missing)' });
            return;
        }
        let amount = r.amount;
        if (wiz.mapping.flipSign) amount = -amount;
        records.push({
            date: finalDate,
            amount: roundMoney(amount),
            payee: r.payee || '',
            memo: r.memo || '',
            importedId: r.importedId || null,
            source: wiz.source
        });
    });
    return { records: records, errors: errors, currencies: wiz.parsed.currencies || [] };
}

function buildCsvRecords() {
    const p = wiz.parsed;
    const map = wiz.mapping;
    const di = p.headers.indexOf(map.date);
    const pi = p.headers.indexOf(map.payee);
    const ai = p.headers.indexOf(map.amount);
    const oi = p.headers.indexOf(map.amountOut);
    const ii = p.headers.indexOf(map.amountIn);
    const split = (oi >= 0 || ii >= 0) && ai < 0;

    const analysis = wiz.dateAnalysis;
    const order = map.dateFormat === 'auto' ? (analysis ? analysis.order : '') : map.dateFormat;
    const decimal = wiz.decimal;

    const records = [];
    const errors = [];
    if (di < 0) return { records: records, errors: [{ row: 0, reason: 'no date column has been chosen', value: '' }], currencies: [] };

    p.rows.forEach(function (cells, idx) {
        const rowNo = idx + (p.hasHeader ? 2 : 1);
        const rawDate = cells[di];
        const date = resolveDate(rawDate, order);
        if (!date) {
            errors.push({
                row: rowNo,
                reason: order ? 'the date could not be read' : 'the date order has not been chosen yet',
                value: rawDate
            });
            return;
        }
        let amount;
        if (split) {
            const out = oi >= 0 ? parseAmount(cells[oi], decimal) : null;
            const inn = ii >= 0 ? parseAmount(cells[ii], decimal) : null;
            if (out === null && inn === null) {
                errors.push({ row: rowNo, reason: 'neither the money-out nor the money-in column held a number', value: (oi >= 0 ? cells[oi] : '') + ' / ' + (ii >= 0 ? cells[ii] : '') });
                return;
            }
            amount = Math.abs(inn || 0) - Math.abs(out || 0);
        } else {
            amount = ai >= 0 ? parseAmount(cells[ai], decimal) : null;
            if (amount === null) {
                errors.push({ row: rowNo, reason: 'the amount could not be read', value: ai >= 0 ? cells[ai] : '(no amount column chosen)' });
                return;
            }
        }
        if (map.flipSign) amount = -amount;
        const payee = pi >= 0 ? String(cells[pi] || '').trim() : '';
        records.push({
            date: date,
            amount: roundMoney(amount),
            payee: payee,
            memo: '',
            importedId: null,
            source: wiz.source
        });
    });
    return { records: records, errors: errors, currencies: [] };
}

/* ───── Mapping memory ───── ---------------------------------------------- */

function importMappings() {
    const st = appState();
    if (!st) return null;
    if (!st.settings) st.settings = {};
    if (!st.settings.importMappings || typeof st.settings.importMappings !== 'object') st.settings.importMappings = {};
    return st.settings.importMappings;
}

function rememberedMapping(accountId) {
    const maps = importMappings();
    if (!maps || !accountId) return null;
    const saved = maps[accountId];
    return (saved && typeof saved === 'object') ? saved : null;
}

function mappingFits(saved, headers) {
    if (!saved || !headers || !headers.length) return false;
    function present(name) { return name == null || name === '' || headers.indexOf(name) !== -1; }
    if (!present(saved.date) || !present(saved.payee) || !present(saved.amount) ||
        !present(saved.amountIn) || !present(saved.amountOut)) return false;
    return !!(saved.date && (saved.amount || saved.amountIn || saved.amountOut));
}

function persistMapping() {
    if (wiz.format !== 'csv') return;
    const maps = importMappings();
    if (!maps || !wiz.accountId) return;
    maps[wiz.accountId] = {
        date: wiz.mapping.date || null,
        payee: wiz.mapping.payee || null,
        amount: wiz.mapping.amount || null,
        amountIn: wiz.mapping.amountIn || null,
        amountOut: wiz.mapping.amountOut || null,
        flipSign: !!wiz.mapping.flipSign,
        dateFormat: wiz.mapping.dateFormat || 'auto'
    };
}

/* ───── Column guessing ───── --------------------------------------------- */

const HEADER_HINTS = {
    amountOut: [/debit/i, /withdraw/i, /money\s*out/i, /paid\s*out/i, /^out$/i, /^soll$/i, /d[ée]bit/i, /charge/i],
    amountIn: [/credit/i, /deposit/i, /money\s*in/i, /paid\s*in/i, /^in$/i, /^haben$/i, /cr[ée]dit/i],
    amount: [/^amount$/i, /^value$/i, /^betrag$/i, /^montant$/i, /^importe$/i, /^sum$/i, /amount/i, /value/i, /betrag/i],
    date: [/^(?:transaction|posting|booking|value)?\s*date$/i, /date/i, /datum/i, /fecha/i, /^data$/i, /posted/i, /bookg/i],
    payee: [/payee/i, /description/i, /narrative/i, /details/i, /merchant/i, /counterpart/i, /beneficiar/i,
        /verwendungszweck/i, /concepto/i, /^name$/i, /^memo$/i, /^reference$/i, /^text$/i]
};

function matchHeader(headers, patterns, taken) {
    for (let p = 0; p < patterns.length; p++) {
        for (let i = 0; i < headers.length; i++) {
            if (taken.indexOf(headers[i]) !== -1) continue;
            if (patterns[p].test(headers[i])) return headers[i];
        }
    }
    return null;
}

function columnScores(parsed) {
    const sample = parsed.rows.slice(0, 60);
    return parsed.headers.map(function (h, i) {
        let dates = 0, amounts = 0, text = 0, filled = 0;
        const distinct = new Set();
        sample.forEach(function (r) {
            const v = String(r[i] == null ? '' : r[i]).trim();
            if (!v) return;
            filled++;
            distinct.add(v);
            if (inspectDate(v)) dates++;
            else if (parseAmount(v) !== null && /\d/.test(v)) amounts++;
            else text++;
        });
        const n = Math.max(1, filled);
        return { header: h, dateRatio: dates / n, amountRatio: amounts / n, textRatio: text / n, distinct: distinct.size, filled: filled };
    });
}

function guessMapping(parsed) {
    const map = blankMapping();
    const headers = parsed.headers;
    const taken = [];
    const scores = columnScores(parsed);
    function scoreFor(h) { return scores.filter(function (s) { return s.header === h; })[0]; }

    const out = matchHeader(headers, HEADER_HINTS.amountOut, taken);
    const inn = matchHeader(headers, HEADER_HINTS.amountIn, out ? taken.concat([out]) : taken);
    if (out && inn) {
        map.amountOut = out; map.amountIn = inn;
        taken.push(out, inn);
    } else {
        let amt = matchHeader(headers, HEADER_HINTS.amount, taken);
        if (!amt) {
            const best = scores.slice().sort(function (a, b) { return b.amountRatio - a.amountRatio; })[0];
            if (best && best.amountRatio > 0.6) amt = best.header;
        }
        if (amt) { map.amount = amt; taken.push(amt); }
    }

    let date = matchHeader(headers, HEADER_HINTS.date, taken);
    if (!date) {
        const best = scores.slice().sort(function (a, b) { return b.dateRatio - a.dateRatio; })[0];
        if (best && best.dateRatio > 0.6) date = best.header;
    }
    if (date) { map.date = date; taken.push(date); }

    let payee = matchHeader(headers, HEADER_HINTS.payee, taken);
    if (!payee) {
        const best = scores.filter(function (s) { return taken.indexOf(s.header) === -1; })
            .sort(function (a, b) { return (b.textRatio * 100 + b.distinct) - (a.textRatio * 100 + a.distinct); })[0];
        if (best && best.textRatio > 0.4) payee = best.header;
    }
    if (payee) map.payee = payee;

    if (map.date) {
        const s = scoreFor(map.date);
        if (s && s.dateRatio < 0.3) map.date = null;
    }
    return map;
}

function refreshCsvAnalysis() {
    if (wiz.format !== 'csv') return;
    const map = wiz.mapping;
    wiz.dateAnalysis = analyseDateColumn(map.date ? columnValues(wiz.parsed, map.date) : []);
    const amountCols = [map.amount, map.amountIn, map.amountOut].filter(Boolean);
    let values = [];
    amountCols.forEach(function (h) { values = values.concat(columnValues(wiz.parsed, h)); });
    wiz.decimal = analyseAmountColumn(values);
}

function prepareColumnsStep() {
    if (wiz.format !== 'csv') return;
    if (wiz.rememberedApplied) { refreshCsvAnalysis(); return; }
    const saved = rememberedMapping(wiz.accountId);
    if (saved && mappingFits(saved, wiz.parsed.headers)) {
        wiz.usedRemembered = true;
        wiz.mapping = {
            date: saved.date || null,
            payee: saved.payee || null,
            amount: saved.amount || null,
            amountIn: saved.amountIn || null,
            amountOut: saved.amountOut || null,
            flipSign: !!saved.flipSign,
            dateFormat: saved.dateFormat || 'auto'
        };
    } else {
        wiz.usedRemembered = false;
        wiz.mapping = guessMapping(wiz.parsed);
    }
    wiz.rememberedApplied = true;
    refreshCsvAnalysis();
    // A remembered order that the new file contradicts must not stand.
    if (wiz.mapping.dateFormat !== 'auto' && wiz.dateAnalysis && wiz.dateAnalysis.order &&
        wiz.dateAnalysis.order !== 'exact' && wiz.dateAnalysis.order !== wiz.mapping.dateFormat) {
        wiz.mapping.dateFormat = 'auto';
    }
}

/* ───── Summary preparation ───── ----------------------------------------- */

function prepareSummary() {
    const built = buildRecords();
    const index = buildCategoryIndex();
    const classified = classifyRows(built.records, wiz.accountId);

    wiz.result = {
        fresh: classified.fresh,
        skipped: classified.skipped,
        possible: classified.possible,
        failed: built.errors
    };
    wiz.rowChoices = classified.fresh.map(function (r) {
        const hit = suggestCategory(r.payee, index);
        return { keep: true, categoryId: hit ? hit.categoryId : '', suggested: !!hit };
    });
    wiz.dupChoices = classified.possible.map(function () { return false; });
}

function countChosen() {
    let n = 0;
    wiz.rowChoices.forEach(function (c) { if (c && c.keep) n++; });
    wiz.dupChoices.forEach(function (c) { if (c) n++; });
    return n;
}

/* ───── Commit ───── ------------------------------------------------------ */

function commitImport() {
    const st = appState();
    if (!st || !wiz || !wiz.result) return;
    if (!Array.isArray(st.actuals)) st.actuals = [];

    const chosen = [];
    wiz.result.fresh.forEach(function (r, i) {
        const c = wiz.rowChoices[i];
        if (c && c.keep) chosen.push({ row: r, categoryId: c.categoryId || null });
    });
    wiz.result.possible.forEach(function (p, i) {
        if (wiz.dupChoices[i]) chosen.push({ row: p.row, categoryId: null });
    });
    if (!chosen.length) return;

    if (typeof writeBackup === 'function') writeBackup('the bank file import');

    const accountId = wiz.accountId;
    chosen.forEach(function (item) {
        const r = item.row;
        st.actuals.push({
            id: newId('act'),
            date: r.date,
            amount: r.amount,
            payee: r.payee || '(no description)',
            accountId: accountId,
            categoryId: item.categoryId || null,
            importedId: r.importedId,
            matchedTxId: null,
            source: r.source
        });
    });

    persistMapping();

    const added = chosen.length;
    const skipped = wiz.result.skipped.length;
    closeWizard();

    if (typeof saveState === 'function') saveState();
    if (typeof flushSave === 'function') flushSave();
    if (typeof renderAll === 'function') renderAll();

    flash(added + ' ' + plural(added, 'transaction', 'transactions') + ' recorded against ' + accountName(accountId) +
        (skipped ? ' — ' + skipped + ' already there ' + plural(skipped, 'was', 'were') + ' left alone.' : '.'), 'info');
}

/* ───── Event wiring ───── ------------------------------------------------ */

function wireModal() {
    if (!modalEl) return;

    modalEl.addEventListener('click', function (e) {
        const target = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!target) return;
        const act = target.getAttribute('data-act');
        if (act === 'close') { e.preventDefault(); closeWizard(); return; }
        if (act === 'back') { e.preventDefault(); goBack(); return; }
        if (act === 'next') { e.preventDefault(); goNext(); return; }
        if (act === 'commit') { e.preventDefault(); commitImport(); return; }
        if (act === 'selall' || act === 'selnone') {
            e.preventDefault();
            const keep = act === 'selall';
            wiz.rowChoices.forEach(function (c) { c.keep = keep; });
            render();
            return;
        }
        if (act === 'dupall' || act === 'dupnone') {
            e.preventDefault();
            const keep = act === 'dupall';
            wiz.dupChoices = wiz.dupChoices.map(function () { return keep; });
            render();
            return;
        }
        if (act === 'bulkcat') {
            e.preventDefault();
            const select = modalEl.querySelector('#impBulkCat');
            const value = select ? select.value : '';
            let touched = 0;
            wiz.rowChoices.forEach(function (c) { if (c.keep) { c.categoryId = value; c.suggested = false; touched++; } });
            render();
            flash(touched ? touched + ' ' + plural(touched, 'row', 'rows') + ' set to ' + (value ? categoryName(value) : 'uncategorised') + '.' : 'Nothing is selected.',
                touched ? 'info' : 'warning');
            return;
        }
    });

    modalEl.addEventListener('change', function (e) {
        const node = e.target;
        const act = node.getAttribute ? node.getAttribute('data-act') : null;
        if (!act) return;
        if (act === 'account') { wiz.accountId = node.value; wiz.rememberedApplied = false; render(); return; }
        if (act === 'map') {
            const key = node.getAttribute('data-key');
            wiz.mapping[key] = node.value || null;
            if (key === 'amount' && node.value) { wiz.mapping.amountIn = null; wiz.mapping.amountOut = null; }
            if ((key === 'amountIn' || key === 'amountOut') && node.value) wiz.mapping.amount = null;
            refreshCsvAnalysis();
            if (wiz.mapping.dateFormat !== 'auto' && wiz.dateAnalysis && !wiz.dateAnalysis.needsChoice &&
                wiz.dateAnalysis.order === 'exact') {
                wiz.mapping.dateFormat = 'auto';
            }
            render();
            return;
        }
        if (act === 'amtmode') {
            if (node.value === 'single') { wiz.mapping.amountIn = null; wiz.mapping.amountOut = null; }
            else {
                wiz.mapping.amount = null;
                if (!wiz.mapping.amountIn && !wiz.mapping.amountOut) {
                    const guess = guessMapping(wiz.parsed);
                    wiz.mapping.amountOut = guess.amountOut;
                    wiz.mapping.amountIn = guess.amountIn;
                }
            }
            refreshCsvAnalysis();
            render();
            return;
        }
        if (act === 'flip') { wiz.mapping.flipSign = !!node.checked; render(); return; }
        if (act === 'datefmt') { wiz.mapping.dateFormat = node.value; render(); return; }
        if (act === 'row') {
            const i = +node.getAttribute('data-i');
            if (wiz.rowChoices[i]) wiz.rowChoices[i].keep = !!node.checked;
            updateCommitButton();
            return;
        }
        if (act === 'cat') {
            const i = +node.getAttribute('data-i');
            if (wiz.rowChoices[i]) { wiz.rowChoices[i].categoryId = node.value; wiz.rowChoices[i].suggested = false; }
            return;
        }
        if (act === 'dup') {
            const i = +node.getAttribute('data-i');
            wiz.dupChoices[i] = !!node.checked;
            updateCommitButton();
            return;
        }
    });
}

// Redrawing the whole step on every checkbox would steal focus mid-list.
function updateCommitButton() {
    const btn = modalEl && modalEl.querySelector('[data-act="commit"]');
    if (!btn) return;
    const n = countChosen();
    btn.disabled = !n;
    btn.textContent = n ? 'Add ' + n + ' ' + plural(n, 'transaction', 'transactions') : 'Nothing to add';
}

function goNext() {
    if (nextBlockedReason()) return;
    if (wiz.step === 1) { wiz.step = 2; render(); return; }
    if (wiz.step === 2) { wiz.step = 3; prepareColumnsStep(); render(); return; }
    if (wiz.step === 3) { prepareSummary(); wiz.step = 4; render(); return; }
}

function goBack() {
    if (wiz.step <= 1) return;
    wiz.step--;
    if (wiz.step === 3) prepareColumnsStep();
    render();
}

/* ───── Header button ───── ----------------------------------------------- */

function mountButton() {
    if (document.getElementById('importBankBtn')) return;
    const mount = document.getElementById('panelImportMount') ||
        document.querySelector('.header-controls');
    if (!mount) return;
    const btn = document.createElement('button');
    btn.id = 'importBankBtn';
    btn.type = 'button';
    btn.textContent = '↑ Bank file';
    btn.title = 'Import a statement file you downloaded from your bank (CSV, OFX/QFX, QIF or camt.053)';
    btn.addEventListener('click', function () { openImportWizard(); });
    const anchor = mount.querySelector('#statusRegion');
    if (anchor && anchor.parentNode === mount) mount.insertBefore(btn, anchor);
    else mount.appendChild(btn);
}

/* ───── Boot ───── -------------------------------------------------------- */

if (typeof renderAll === 'function') {
    const previousRenderAll = renderAll;
    renderAll = function () {
        const out = previousRenderAll.apply(this, arguments);
        mountButton();
        return out;
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountButton);
} else {
    mountButton();
}

/* ───── Exports ───── ----------------------------------------------------- */

window.openImportWizard = openImportWizard;
window.Importers = {
    parseCSV: parseCSV,
    parseOFX: parseOFX,
    parseQIF: parseQIF,
    parseCAMT: parseCAMT,
    detectFormat: detectFormat,
    parseAmount: parseAmount,
    analyseAmountColumn: analyseAmountColumn,
    inspectDate: inspectDate,
    resolveDate: resolveDate,
    analyseDateColumn: analyseDateColumn,
    normalisePayee: normalisePayee,
    stableHash: stableHash,
    fallbackImportedId: fallbackImportedId,
    classifyRows: classifyRows,
    suggestCategory: suggestCategory,
    buildCategoryIndex: buildCategoryIndex,
    open: openImportWizard
};

})();
