/* BTC Walk: the phone's site diary for BTC.
   The day is the chat: open it and type. Notes, photos, flow-ons ("what changed ; what next") and actions (@person)
   all go in the day's one chat. Ship sends the day (and any day not shipped yet) to BTC as one .btcwalk file through
   the phone's share sheet (Outlook); BTC files it into your site diary.
   Everything stays on this phone until it's shipped. The job comes from the project file BTC's Build makes
   (⋮ › Load project). No server, nothing sent anywhere else. */
'use strict';
(function () {
  var VERSION = '1.1';
  var FORMAT = 'btcwalk', PFORMAT = 'btcproject';

  // ---------- the demo job (generic) ----------
  var DEMO = {
    format: PFORMAT, v: 1, made: null, demo: true,
    project: { id: 'demo-dragon', code: 'DRAGON', name: 'Dragon WWTP (demo)' },
    people: [{ name: 'Sam Rivers', handle: 'SR', team: true }, { name: 'Alex Kerr', handle: 'AK', team: true }, { name: 'Nikau Hale', handle: 'NH', team: true }, { name: 'Jo Tamati', handle: 'JT', team: true }, { name: 'Pat Lee', handle: 'PL', team: false }],
    areas: [
      { name: 'Inlet works', itps: [{ code: 'ITP-01', title: 'Inlet screens' }, { code: 'ITP-02', title: 'Inlet pumps' }] },
      { name: 'SBR 1', itps: [{ code: 'ITP-05', title: 'SBR 1 diffusers' }, { code: 'ITP-06', title: 'SBR 1 decanter' }] },
      { name: 'Blowers', itps: [{ code: 'ITP-08', title: 'Blowers' }] },
      { name: 'Chemical dosing', itps: [{ code: 'ITP-09', title: 'Dosing skid' }] }],
    flowons: [{ no: 'FO-001', area: 'SBR 1', itp: 'ITP-06', desc: 'Decanter bracket moved 40 mm east to clear the handrail', action: 'mech shop drawing and limit switch to suit' }]
  };

  // ---------- storage: IndexedDB (photos are big) ----------
  var db = null;
  function idb() {
    if (db) return Promise.resolve(db);
    return new Promise(function (res, rej) {
      var r = indexedDB.open('btc-walk', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('kv'); var s = d.createObjectStore('entries', { keyPath: 'id' }); s.createIndex('proj', 'proj'); };
      r.onsuccess = function () { db = r.result; res(db); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(store, mode, fn) {
    return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = function () { res(out instanceof IDBRequest ? out.result : undefined); }; t.onerror = function () { rej(t.error); }; }); });
  }
  var kvGet = function (k) { return tx('kv', 'readonly', function (s) { return s.get(k); }); };
  var kvSet = function (k, v) { return tx('kv', 'readwrite', function (s) { s.put(v, k); }); };
  var putEntry = function (e) { return tx('entries', 'readwrite', function (s) { s.put(e); }); };
  var delEntry = function (id) { return tx('entries', 'readwrite', function (s) { s.delete(id); }); };
  var allEntries = function (proj) { return tx('entries', 'readonly', function (s) { return s.index('proj').getAll(proj); }); };

  // ---------- state ----------
  var S = { proj: null, me: null, entries: [], view: 'days', day: null, find: '', findAll: '', filter: 'all', edit: null, photo: null, as: null, loc: null };
  var $ = function (id) { return document.getElementById(id); };
  var main = $('main');
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function dayDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(s, n) { var d = dayDate(s); d.setDate(d.getDate() + n); return ymd(d); }
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dayLabel(s) { var d = dayDate(s); return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()]; }
  function hm(iso) { var d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var toastT = null;
  function toast(msg, bad) { var t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, bad ? 5000 : 2600); }
  function uid() { return (S.me ? S.me.handle : 'X') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

  // ---------- reading a line ----------
  // Checked in order: "at <place>" moves you · a flow-on (what changed, then -- ; → or ->, or starts flow-on / bridge)
  // · an action (@person, P1–P3, a due date, or a doing word first) · else a note. @ is who or where.
  var VERBS = /^(fix|replace|check|move|install|remove|update|confirm|chase|order|book|label|test|need to)\b/i;
  var SEP = /\s*(--|;|→|->)\s*/;
  var DAYS = { mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, saturday: 6, sunday: 0 };
  function places() {
    var p = S.proj, out = [];
    (p.areas || []).forEach(function (a) { out.push({ kind: 'area', name: a.name, area: a.name, itp: '' }); (a.itps || []).forEach(function (i) { out.push({ kind: 'itp', name: i.code, area: a.name, itp: i.code, sub: i.title }); }); });
    (p.tags || []).forEach(function (t) { out.push({ kind: 'tag', name: t, tag: t }); });
    return out;
  }
  var key = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };
  function person(h) { var k = key(h); return (S.proj.people || []).filter(function (p) { return key(p.handle) === k || key(p.name) === k || key(String(p.name).split(' ')[0]) === k; })[0] || null; }
  function placeAt(text, i) {   // longest place name after the @ at i (spaces allowed): { place, len } or null
    var rest = text.slice(i + 1).toLowerCase(), best = null;
    places().forEach(function (p) { var n = p.name.toLowerCase(); if (rest.indexOf(n) === 0 && !/[a-z0-9]/i.test(rest.charAt(n.length) || '') && (!best || n.length > best.name.length)) best = p; });
    if (best) return { place: best, len: best.name.length };
    var m = /^(\S+)/.exec(text.slice(i + 1)), k = m ? key(m[1].replace(/[,.;:]+$/, '')) : '';
    var hit = k ? places().filter(function (p) { return key(p.name) === k; })[0] : null;
    return hit ? { place: hit, len: m[1].replace(/[,.;:]+$/, '').length } : null;
  }
  function parseDue(text, base) {
    var t = ' ' + text + ' ', m, due = '';
    var cut = function (re, val) { if (due) return; var mm = re.exec(t); if (mm) { due = val(mm); t = t.slice(0, mm.index) + ' ' + t.slice(mm.index + mm[0].length); } };
    var nextDow = function (dow, skipWeek) { var d = dayDate(base), diff = (dow - d.getDay() + 7) % 7; if (diff === 0) diff = 7; if (skipWeek) diff += 7; d.setDate(d.getDate() + diff); return ymd(d); };
    cut(/\s(?:by\s+|on\s+|due\s+)?(?:today)\s/i, function () { return base; });
    cut(/\s(?:by\s+|on\s+|due\s+)?(?:tomorrow|tmrw)\s/i, function () { return addDays(base, 1); });
    cut(/\s(?:by\s+)?(?:eow|end of (?:the )?week)\s/i, function () { return nextDow(5, false) === addDays(base, 7) && dayDate(base).getDay() === 5 ? base : nextDow(5, false); });
    cut(/\s(?:by\s+)?next week\s/i, function () { return nextDow(1, false); });
    cut(/\s(?:by\s+)?in (\d{1,2}) days?\s/i, function (mm) { return addDays(base, +mm[1]); });
    cut(/\s(?:by\s+|on\s+|due\s+)?next (mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|saturday|sunday)\s/i, function (mm) { var dow = DAYS[mm[1].toLowerCase()]; var d = nextDow(dow, false); return addDays(d, dayDate(d) - dayDate(base) < 7 * 864e5 ? 7 : 0); });
    cut(/\s(?:by\s+|on\s+|due\s+)?(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|saturday|sunday)\s/i, function (mm) { return nextDow(DAYS[mm[1].toLowerCase()], false); });
    cut(/\s(?:by\s+|on\s+|due\s+)?(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?\s/, function (mm) {
      var y = mm[3] ? (+mm[3] < 100 ? 2000 + +mm[3] : +mm[3]) : dayDate(base).getFullYear(), d = new Date(y, +mm[2] - 1, +mm[1], 12);
      if (!mm[3] && ymd(d) < base) d.setFullYear(y + 1); return ymd(d); });
    return { due: due, text: t.replace(/\s{2,}/g, ' ').trim() };
  }
  function parse(raw, day) {
    var text = String(raw || '').trim(), out = { type: 'note', text: '', action: '', who: '', area: '', itp: '', tag: '', priority: '', due: '', move: null, notFound: [] };
    if (!text) return out;
    var mv = /^at\s+(.+)$/i.exec(text);
    if (mv) { var p0 = placeAt('@' + mv[1].trim(), 0); if (p0 && p0.len >= mv[1].trim().length - 1) { out.move = p0.place; return out; } }
    // @ who or where
    var i = 0, people = [], place = null;
    while ((i = text.indexOf('@', i)) >= 0) {
      if (i > 0 && /\S/.test(text.charAt(i - 1))) { i++; continue; }
      var pl = placeAt(text, i);
      if (pl && !place) { place = pl.place; text = (text.slice(0, i) + text.slice(i + 1 + pl.len)).replace(/\s{2,}/g, ' '); continue; }
      var m = /^@(\S+)/.exec(text.slice(i)), who = m ? person(m[1].replace(/[,.;:]+$/, '')) : null;
      if (who) { people.push(who); text = (text.slice(0, i) + text.slice(i + m[0].length)).replace(/\s{2,}/g, ' '); continue; }
      if (m) out.notFound.push(m[1]);
      i++;
    }
    var pm = /(^|\s)P([123])(?=\s|$)/i.exec(text);
    if (pm) { out.priority = 'P' + pm[2]; text = (text.slice(0, pm.index) + text.slice(pm.index + pm[0].length)).replace(/\s{2,}/g, ' '); }
    var d = parseDue(text, day || today()); text = d.text; out.due = d.due;
    text = text.trim();
    var sep = SEP.exec(text), lead = /^(flow-?on|bridge)\b[:\s]*/i.exec(text);
    if (sep) { out.type = 'flowon'; out.text = text.slice(0, sep.index).trim(); out.action = text.slice(sep.index + sep[0].length).trim(); }
    else if (lead) { out.type = 'flowon'; out.text = text.slice(lead[0].length).trim(); }
    else { out.text = text; if (people.length || out.priority || out.due || VERBS.test(text)) out.type = 'action'; }
    if (out.type === 'flowon' && lead && sep) out.text = out.text.replace(/^(flow-?on|bridge)\b[:\s]*/i, '');
    out.who = people.length ? people[0].handle : '';
    if (place) { out.area = place.area || ''; out.itp = place.itp || ''; out.tag = place.tag || ''; out.there = true; }
    return out;
  }
  var TYPE = { note: 'Note', flowon: 'Flow-on', action: 'Action' };
  var CYCLE = ['note', 'flowon', 'action'];

  // ---------- days ----------
  function daysOf() {
    var m = {};
    S.entries.forEach(function (e) { (m[e.day] = m[e.day] || []).push(e); });
    return Object.keys(m).sort().reverse().map(function (d) { var es = m[d].sort(function (a, b) { return a.time < b.time ? -1 : 1; }); return { day: d, entries: es, unshipped: es.some(function (e) { return !e.shipped; }) }; });
  }
  function counts(es) { var c = { note: 0, flowon: 0, action: 0, photo: 0 }; es.forEach(function (e) { c[e.type] = (c[e.type] || 0) + 1; if (e.photo) c.photo++; }); return c; }
  function dotsRow(c) { return '<span class="dots-row"><span><span class="dot-n">●</span> ' + c.note + '</span><span><span class="dot-f">●</span> ' + c.flowon + '</span><span><span class="dot-a">●</span> ' + c.action + '</span>' + (c.photo ? '<span class="muted">▣ ' + c.photo + '</span>' : '') + '</span>'; }
  var FLAG = '<span class="flag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1F1A10" stroke-width="2.6" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>NOT SHIPPED</span>';

  function renderDays() {
    var ds = daysOf(), t = today(), waiting = ds.filter(function (d) { return d.unshipped; }), old = ds.filter(function (d) { return d.unshipped && d.day < t; });
    var age = S.proj.made && !S.proj.demo ? Math.floor((Date.now() - new Date(S.proj.made)) / 864e5) : 0;
    var html = '';
    if (S.proj.demo) html += '<div class="bar-info">Demo job (made-up names). Load your job’s project file in ⋮ › Load project. Nothing leaves this phone until you ship.</div>';
    else if (age >= 7) html += '<div class="bar-warn">Project file is ' + age + ' days old<button type="button" data-act="load">Reload</button></div>';
    if (old.length) html += '<div class="bar-warn">' + (old.length === 1 ? dayLabel(old[0].day) + ' isn’t' : old.length + ' days aren’t') + ' shipped yet<button type="button" data-act="ship">Ship now</button></div>';
    var cutoff = addDays(t, -6), recent = ds.filter(function (d) { return d.day >= cutoff; }), earlier = ds.filter(function (d) { return d.day < cutoff; });
    var card = function (d) {
      var c = counts(d.entries), isT = d.day === t;
      return '<button type="button" class="day' + (isT ? ' today' : '') + (d.unshipped && !isT ? ' unshipped' : '') + '" data-day="' + d.day + '"><span class="day-h"><span class="day-d">' + (isT ? 'Today · ' : '') + esc(dayLabel(d.day)) + '</span>' +
        (isT ? (d.unshipped ? '<span class="tag live">LIVE</span>' : '<span class="tag sent">✓ Sent</span>') : d.unshipped ? FLAG : '<span class="tag sent">✓ Sent</span>') + '</span>' + dotsRow(c) + '</button>';
    };
    if (recent.length) html += '<div class="kick">THIS WEEK</div>' + recent.map(card).join('');
    if (earlier.length) html += S.showEarlier ? '<div class="kick">EARLIER</div>' + earlier.map(card).join('') : '<button type="button" class="day" data-act="earlier"><span class="muted small">Earlier · ' + earlier.length + ' day' + (earlier.length > 1 ? 's' : '') + (earlier.some(function (d) { return d.unshipped; }) ? '' : ', all sent') + ' ▸</span></button>';
    if (!ds.length) html += '<div class="empty"><b>Nothing logged yet.</b><br>Start the day and type: a note, a photo, a flow-on (<b>what changed ; what next</b>) or an action (<b>@person</b>). A day you don’t log anything has no card.</div>';
    var hasT = ds.some(function (d) { return d.day === t; });
    main.innerHTML = '<div class="scroll"><div class="pad">' + html + '</div></div><div class="foot"><button type="button" class="btn primary" data-act="today">' + (hasT ? 'Open today' : '＋ Start day') + '</button>' +
      '<button type="button" class="btn ship' + (waiting.length ? '' : ' done') + '" data-act="ship">Ship' + (waiting.length ? '<span class="count">' + waiting.length + '</span>' : '') + '</button></div>';
  }

  // ---------- a day's chat ----------
  function entryHtml(e, hl) {
    var mark = function (s) { s = esc(s); if (!hl) return s; var q = hl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return s.replace(new RegExp('(' + esc(q) + ')', 'ig'), '<mark>$1</mark>'); };
    var where = e.itp ? (e.area ? e.area + ' · ' : '') + e.itp : e.area || e.tag || '';
    var who = e.who ? '@' + e.who + ' · ' : '';
    var head = e.type === 'action' ? 'ACTION · ' + (e.who ? '@' + esc(e.who) : 'you') + (e.priority ? ' · ' + esc(e.priority) : '') : TYPE[e.type].toUpperCase();
    var meta = [where ? '<span class="' + (e.there ? 'there' : '') + '">' + mark(where) + '</span>' : '', e.type !== 'action' && who ? esc(who.replace(' · ', '')) : '', e.due ? 'due ' + esc(dayLabel(e.due)) : '', e.edited ? 'edited' : '', (e.notFound || []).length ? '<span class="nf">@' + esc(e.notFound.join(' @')) + ' not found</span>' : ''].filter(Boolean).join(' · ');
    return '<button type="button" class="e ' + e.type + (S.edit === e.id ? ' sel' : '') + '" data-e="' + esc(e.id) + '"><span class="e-h"><span class="e-k">' + head + '</span><span>' + hm(e.time) + (e.shipped ? ' ✓' : '') + '</span></span>' +
      (e.text ? '<span class="e-t">' + mark(e.text) + '</span>' : '') + (e.type === 'flowon' ? (e.action ? '<span class="e-a">→ ' + mark(e.action) + '</span>' : '<span class="e-none">⚠ No action yet · tap to add</span>') : '') +
      (meta ? '<span class="e-m">' + meta + '</span>' : '') + (e.photo ? '<img src="' + e.photo + '" alt="Photo">' : '') + '</button>';
  }
  function renderDay() {
    var d = S.day, es = S.entries.filter(function (e) { return e.day === d; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var q = S.find.trim().toLowerCase(), shown = q ? es.filter(function (e) { return matches(e, q); }) : es;
    var un = es.some(function (e) { return !e.shipped; });
    var loc = S.loc ? (S.loc.itp ? (S.loc.area ? S.loc.area + ' · ' : '') + S.loc.itp : S.loc.name) : '';
    main.innerHTML = '<div class="dhead"><button type="button" class="icon" data-act="back" aria-label="Back to days"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<span class="t"><b>' + (d === today() ? 'Today · ' : '') + esc(dayLabel(d)) + '</b><span>' + esc(S.proj.project.code || '') + ' · ' + es.length + ' line' + (es.length === 1 ? '' : 's') + ' · ' + (es.length ? (un ? 'not shipped' : 'sent') : 'nothing yet') + '</span></span>' +
      '<button type="button" class="icon' + (S.findOpen ? ' on' : '') + '" data-act="findday" aria-label="Search this day"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></button></div>' +
      (S.findOpen ? '<div class="findbar"><input type="search" id="find-day" placeholder="Search this day" value="' + esc(S.find) + '" aria-label="Search this day"><span>' + (q ? shown.length + ' of ' + es.length : '') + '</span></div>' : '') +
      '<div class="chat" id="chat">' + (q && shown.length < es.length ? '<span class="note-c">' + (es.length - shown.length) + ' lines hidden · tap one to see it in the chat</span>' : '') +
      (shown.length ? shown.map(function (e) { return entryHtml(e, q); }).join('') : '<div class="empty">' + (q ? 'Nothing matches.' : 'Type below: a note, a photo, a flow-on (<b>what changed ; what next</b>) or an action (<b>@person</b>, <b>P1</b>, <b>fri</b>). <b>at SBR 1</b> says where you are.') + '</div>') + '</div>' +
      (loc ? '<div class="loc"><span class="l">AT</span><b>' + esc(loc) + '</b><button type="button" data-act="unloc" aria-label="Clear where you are">×</button></div>' : '') +
      (S.edit ? '<div class="editing"><span>EDITING</span><button type="button" class="del" data-act="delete">Delete</button><button type="button" data-act="cancel">Cancel</button></div>' : '') +
      '<div class="comp"><div class="reads" id="reads"></div><div class="sug" id="sug"></div>' + (S.photo ? '<span class="thumb"><img src="' + S.photo + '" alt="Photo to send">Photo goes with the next line<button type="button" data-act="nophoto" aria-label="Remove the photo">×</button></span>' : '') +
      '<div class="comp-row"><button type="button" class="cam" data-act="photo" aria-label="Add a photo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/></svg></button>' +
      '<textarea id="box" rows="1" placeholder="Note, flow-on (;) or @action…" aria-label="Write a line" enterkeyhint="send"></textarea><button type="button" class="send" id="send" data-act="send">' + (S.edit ? 'Save' : 'Send') + '</button></div></div>';
    var box = $('box');
    if (S.edit) { var ed = S.entries.filter(function (e) { return e.id === S.edit; })[0]; if (ed) box.value = ed.raw || ''; }
    else if (S.draft) box.value = S.draft;
    box.oninput = function () { S.draft = S.edit ? S.draft : box.value; S.as = null; grow(); reads(); };
    box.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); } };
    grow(); reads();
    var fd = $('find-day'); if (fd) { fd.oninput = function () { S.find = fd.value; var pos = fd.selectionStart; renderDay(); var f2 = $('find-day'); f2.focus(); f2.setSelectionRange(pos, pos); }; }
    var chat = $('chat'); if (!q) chat.scrollTop = chat.scrollHeight;
    // keyboard up or down: the chat gets shorter or taller; if you were at the newest line, stay there (1.1)
    S.stick = !q; chat.onscroll = function () { S.stick = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40; };
    if (window.ResizeObserver) new ResizeObserver(function () { if (S.stick) chat.scrollTop = chat.scrollHeight; }).observe(chat);
    sync();
  }
  function grow() { var b = $('box'); if (!b) return; b.style.height = 'auto'; b.style.height = Math.min(140, b.scrollHeight + 2) + 'px'; }
  function reads() {
    var b = $('box'), r = $('reads'), sg = $('sug'); if (!b || !r) return;
    var v = b.value, p = parse(v, S.day);
    // @ suggestions: people, areas, ITPs
    var at = /(?:^|\s)@([^@]*)$/.exec(v.slice(0, b.selectionStart || v.length));
    if (at && at[1].length <= 24 && !/\s{2}/.test(at[1])) {
      var k = key(at[1]);
      var list = (S.proj.people || []).map(function (x) { return { put: x.handle, label: x.name, sub: '@' + x.handle }; }).concat(places().map(function (x) { return { put: x.name, label: x.name, sub: x.kind === 'itp' ? x.area : x.kind }; }))
        .filter(function (x) { return !k || key(x.put).indexOf(k) === 0 || key(x.label).indexOf(k) === 0; }).slice(0, 12);
      sg.innerHTML = list.map(function (x) { return '<button type="button" data-put="' + esc(x.put) + '">' + esc(x.label) + '<small>' + esc(x.sub) + '</small></button>'; }).join('');
    } else sg.innerHTML = '';
    if (!v.trim() && !S.photo) { r.innerHTML = ''; return; }
    if (p.move) { r.innerHTML = 'Moves you to <span class="chip">' + esc(p.move.name) + '</span>'; return; }
    var type = S.as || p.type;
    var where = p.itp ? (p.area ? p.area + ' · ' : '') + p.itp : p.area || p.tag || '';
    r.innerHTML = 'Log as <button type="button" class="as ' + type + '" data-act="as">' + TYPE[type].toUpperCase() + ' ▾</button>' +
      (where ? '<span class="chip warn">@ ' + esc(where) + '</span>' : '') + (type === 'action' ? '<span class="chip">' + (p.who ? '@' + esc(p.who) : 'you') + '</span>' : p.who ? '<span class="chip">@' + esc(p.who) + '</span>' : '') +
      (p.priority ? '<span class="chip">' + p.priority + '</span>' : '') + (p.due ? '<span class="chip">due ' + esc(dayLabel(p.due)) + '</span>' : '') +
      (type === 'flowon' ? (p.action ? '<span class="chip">→ ' + esc(p.action) + '</span>' : '<span class="chip warn">no action yet: add ; and what next</span>') : '') +
      (p.notFound.length ? '<span class="chip nf">@' + esc(p.notFound.join(' @')) + ' not found</span>' : '');
  }
  function matches(e, q) {
    if (q === 'flow-ons' || q === 'flowons' || q === 'flow-on') return e.type === 'flowon';
    if (q === 'actions' || q === 'action') return e.type === 'action';
    if (q === 'notes' || q === 'note') return e.type === 'note';
    if (/^@/.test(q)) return key(e.who) === key(q.slice(1)) || key(e.area) === key(q.slice(1)) || key(e.itp) === key(q.slice(1));
    return [e.text, e.action, e.area, e.itp, e.tag, e.who, e.raw].join(' ').toLowerCase().indexOf(q) >= 0;
  }
  async function send() {
    var b = $('box'); if (!b) return;
    var raw = b.value.trim(); if (!raw && !S.photo) return;
    var p = parse(raw, S.day);
    if (p.move) { S.loc = p.move; await kvSet('loc', S.loc); S.draft = ''; b.value = ''; toast('At ' + p.move.name); renderDay(); return; }
    var type = S.as || p.type, now = new Date().toISOString();
    var where = p.there ? {} : S.loc ? { area: S.loc.area || '', itp: S.loc.itp || '', tag: S.loc.tag || '' } : {};
    if (S.edit) {
      var e = S.entries.filter(function (x) { return x.id === S.edit; })[0];
      if (e) { Object.assign(e, { raw: raw, type: type, text: p.text || (e.photo ? 'Photo' : ''), action: p.action, who: p.who, priority: p.priority, due: p.due, notFound: p.notFound, edited: true, shipped: false, there: !!p.there }, p.there ? { area: p.area, itp: p.itp, tag: p.tag } : {}); if (S.photo) e.photo = S.photo; await putEntry(e); }
      S.edit = null; S.photo = null; S.as = null; renderDay(); toast('Saved'); return;
    }
    var en = { id: uid(), proj: S.proj.project.id, day: S.day, time: now, raw: raw, type: type, text: p.text || (S.photo ? 'Photo' : ''), action: p.action, who: p.who, area: p.there ? p.area : where.area || '', itp: p.there ? p.itp : where.itp || '', tag: p.there ? p.tag : where.tag || '',
      location: S.loc ? S.loc.name : '', priority: p.priority, due: p.due, photo: S.photo || '', edited: false, shipped: false, notFound: p.notFound, there: !!p.there };
    S.entries.push(en); await putEntry(en);
    S.draft = ''; S.photo = null; S.as = null; renderDay();
  }

  // ---------- photos: shrunk on the phone (~200 KB) ----------
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.72, out = c.toDataURL('image/jpeg', q);
        while (out.length > 280000 && q > 0.4) { q -= 0.08; out = c.toDataURL('image/jpeg', q); }
        res(out);
      };
      img.onerror = function () { rej(new Error('Not a picture')); };
      img.src = url;
    });
  }

  // ---------- search every day ----------
  function renderFindAll() {
    var q = S.findAll.trim().toLowerCase(), f = S.filter;
    var es = S.entries.filter(function (e) { return (f === 'all' || e.type === f) && (!q || matches(e, q)); }).sort(function (a, b) { return a.time < b.time ? 1 : -1; });
    var byDay = {}; es.forEach(function (e) { (byDay[e.day] = byDay[e.day] || []).push(e); });
    var days = Object.keys(byDay).sort().reverse(), un = {}; daysOf().forEach(function (d) { un[d.day] = d.unshipped; });
    main.innerHTML = '<div class="findbar" style="background:var(--panel);border-color:var(--line)"><button type="button" class="icon" data-act="back" aria-label="Back to days"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><input type="search" id="find-all" placeholder="Search every day" value="' + esc(S.findAll) + '" aria-label="Search every day"></div>' +
      '<div class="filters">' + [['all', 'All'], ['note', 'Notes'], ['flowon', 'Flow-ons'], ['action', 'Actions']].map(function (x) { return '<button type="button" data-filter="' + x[0] + '"' + (f === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="scroll"><div class="pad" style="gap:0">' + (q || f !== 'all' ? '<div class="kick" style="padding-bottom:6px">' + es.length + ' line' + (es.length === 1 ? '' : 's') + ' on ' + days.length + ' day' + (days.length === 1 ? '' : 's') + '</div>' : '') +
      days.map(function (d) {
        return '<div class="res-day">' + (d === today() ? 'Today · ' : '') + esc(dayLabel(d)) + (un[d] && d !== today() ? ' <span class="tag" style="color:var(--flow)">NOT SHIPPED</span>' : '') + '</div>' + byDay[d].map(function (e) {
          var dot = e.type === 'flowon' ? 'dot-f' : e.type === 'action' ? 'dot-a' : 'dot-n', hlq = q && q.charAt(0) !== '@' ? q : '';
          var mk = function (s) { s = esc(s); if (!hlq) return s; return s.replace(new RegExp('(' + esc(hlq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + ')', 'ig'), '<mark>$1</mark>'); };
          var where = e.itp ? (e.area ? e.area + ' · ' : '') + e.itp : e.area || e.tag || '';
          return '<button type="button" class="res" data-jump="' + esc(e.id) + '"><span class="tm">' + hm(e.time) + '</span><span style="display:flex;flex-direction:column;gap:3px"><span style="font-size:15px"><span class="' + dot + '">●</span> ' + mk(e.text) + (e.action ? ' <b>→ ' + mk(e.action) + '</b>' : '') + (e.who ? ' @' + esc(e.who) : '') + '</span>' + (where || e.photo ? '<span class="e-m">' + esc(where) + (e.photo ? (where ? ' · ' : '') + '▣ photo' : '') + '</span>' : '') + '</span></button>';
        }).join('');
      }).join('') + (!days.length ? '<div class="empty">' + (q ? 'Nothing matches “' + esc(S.findAll) + '”.' : 'Type to search every day. <b>flow-ons</b>, <b>actions</b> or <b>@NH</b> work too.') + '</div>' : '') + '</div></div>';
    sync();
    var fa = $('find-all'); fa.oninput = function () { S.findAll = fa.value; var pos = fa.selectionStart; renderFindAll(); var f2 = $('find-all'); f2.focus(); f2.setSelectionRange(pos, pos); };
    if (!S.findAll) fa.focus();
  }

  // ---------- ship ----------
  function shipSheet() {
    var ds = daysOf().filter(function (d) { return d.unshipped; });
    if (!ds.length) { toast('Everything is shipped.'); return; }
    S.shipPick = S.shipPick || {}; ds.forEach(function (d) { if (S.shipPick[d.day] === undefined) S.shipPick[d.day] = true; });
    var draw = function () {
      var pick = ds.filter(function (d) { return S.shipPick[d.day]; }), es = []; pick.forEach(function (d) { es = es.concat(d.entries); });
      var c = counts(es), noAct = es.filter(function (e) { return e.type === 'flowon' && !e.action; });
      var mb = (JSON.stringify(es).length / 1048576);
      sheet('<div class="grip"></div><div style="display:flex;flex-direction:column;gap:4px"><h2>Ship to BTC</h2><p>Goes by email to the job’s BTC inbox and files itself into your diary.</p></div>' +
        '<div class="list">' + ds.map(function (d) { var cc = counts(d.entries); return '<label><input type="checkbox" data-pick="' + d.day + '"' + (S.shipPick[d.day] ? ' checked' : '') + '><span class="lt"><b>' + (d.day === today() ? 'Today · ' : '') + esc(dayLabel(d.day)) + (d.day < today() ? ' <span class="tag" style="color:var(--flow)">NOT SHIPPED</span>' : '') + '</b><span>' + d.entries.length + ' entr' + (d.entries.length === 1 ? 'y' : 'ies') + (cc.photo ? ' · ' + cc.photo + ' photo' + (cc.photo > 1 ? 's' : '') : '') + '</span></span></label>'; }).join('') + '</div>' +
        '<div class="tiles"><div class="tile n"><b>' + c.note + '</b><span>notes</span></div><div class="tile f"><b>' + c.flowon + '</b><span>flow-ons</span></div><div class="tile a"><b>' + c.action + '</b><span>actions</span></div></div>' +
        (noAct.length ? '<button type="button" class="bar-warn" data-fix="' + esc(noAct[0].id) + '" style="text-align:left">' + (noAct.length === 1 ? '1 flow-on has' : noAct.length + ' flow-ons have') + ' no action yet: <b>' + esc(noAct[0].text) + '</b><span style="margin-left:auto;color:var(--flow);font-weight:700;padding-right:8px">Fix ›</span></button>' : '') +
        '<button type="button" class="btn primary" data-act="doship"' + (pick.length ? '' : ' disabled') + ' style="min-height:56px;font-size:17px">Ship to Outlook</button>' +
        '<span class="fname">' + esc(fileName(pick)) + ' · ' + (mb < 0.1 ? '<0.1' : mb.toFixed(1)) + ' MB</span>');
      $('sheet').querySelectorAll('[data-pick]').forEach(function (cb) { cb.onchange = function () { S.shipPick[cb.dataset.pick] = cb.checked; draw(); }; });
    };
    draw();
  }
  function fileName(pick) {
    var days = pick.map(function (d) { return d.day; }).sort(), code = (S.proj.project.code || 'BTC').replace(/[^A-Za-z0-9]+/g, '');
    return code + '_' + (S.me ? S.me.handle : 'X') + '_' + (days[days.length - 1] || today()) + (days.length > 1 ? '_' + days.length + 'days' : '') + '.btcwalk';
  }
  async function doShip() {
    var pick = daysOf().filter(function (d) { return d.unshipped && S.shipPick && S.shipPick[d.day]; });
    if (!pick.length) return;
    var es = []; pick.forEach(function (d) { es = es.concat(d.entries); });
    var body = { format: FORMAT, v: 1, project: { id: S.proj.project.id, code: S.proj.project.code, name: S.proj.project.name }, shippedBy: { name: S.me ? S.me.name : '', handle: S.me ? S.me.handle : '' }, shippedAt: new Date().toISOString(), app: 'BTC Walk ' + VERSION,
      walks: [], entries: es.map(function (e) { return { id: e.id, day: e.day, time: e.time, type: e.type, raw: e.raw, text: e.text, action: e.action, who: e.who, area: e.area, itp: e.itp, tag: e.tag, location: e.location, priority: e.priority, due: e.due, photo: e.photo, edited: e.edited }; }), closures: [] };
    var name = fileName(pick), file = new File([JSON.stringify(body)], name, { type: 'application/json' });
    var shared = false;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name, text: (S.proj.project.name || '') + ' · site diary from BTC Walk' }); shared = true; }
      else { var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); shared = true; }
    } catch (e) { if (e && e.name === 'AbortError') { toast('Not shipped.'); return; } toast('Could not share: ' + e.message, true); return; }
    if (!shared) return;
    var at = new Date().toISOString();
    for (var i = 0; i < es.length; i++) { es[i].shipped = true; es[i].shippedAt = at; await putEntry(es[i]); }
    S.shipPick = null; closeSheet(); S.view = 'days'; render();
    toast('Shipped ' + pick.length + ' day' + (pick.length > 1 ? 's' : '') + '. It stays on this phone too.');
  }

  // ---------- project, you, settings ----------
  async function loadProjectFile(file) {
    var p;
    try { p = JSON.parse(await file.text()); } catch (e) { toast('That isn’t a BTC project file.', true); return; }
    if (!p || p.format !== PFORMAT || !p.project || !p.project.id) { toast('That isn’t a BTC project file (make it in Build: ⋮ › Phone project file…).', true); return; }
    p.loadedAt = new Date().toISOString();
    await kvSet('project', p); S.proj = p;
    S.entries = await allEntries(p.project.id);
    var me = await kvGet('me:' + p.project.id); S.me = me || null; S.loc = null; await kvSet('loc', null);
    closeSheet(); S.view = 'days'; render();
    toast('Loaded ' + p.project.name + (p.made ? ' (from ' + dayLabel(p.made.slice(0, 10)) + ')' : '') + '.');
    if (!S.me) pickMe();
  }
  function pickMe() {
    var ps = (S.proj.people || []).filter(function (p) { return p.team !== false; });
    sheet('<div class="grip"></div><h2>Who are you?</h2><p>Your days go into your site diary in BTC. Pick yourself once on this phone.</p><div class="list">' +
      ps.map(function (p) { return '<button type="button" data-me="' + esc(p.handle) + '"><span class="lt"><b>' + esc(p.name) + '</b><span class="mono">@' + esc(p.handle) + '</span></span>' + (S.me && S.me.handle === p.handle ? '<span class="tag live">YOU</span>' : '') + '</button>'; }).join('') + '</div>');
  }
  function settings() {
    var p = S.proj, made = p.made ? dayLabel(p.made.slice(0, 10)) : '', n = S.entries.length;
    sheet('<div class="grip"></div><h2>' + esc(p.project.name) + '</h2>' +
      '<div class="list"><button type="button" data-act="load"><span class="lt"><b>Load project…</b><span>' + (p.demo ? 'The demo is loaded. Pick the file Build makes: ⋮ › Phone project file…' : 'Project file from ' + esc(made || '?') + '. Pick a newer one when the job changes.') + '</span></span></button>' +
      '<button type="button" data-act="me"><span class="lt"><b>You: ' + esc(S.me ? S.me.name : 'not picked') + '</b><span>Whose diary your days go into</span></span></button>' +
      (p.demo ? '' : '<button type="button" data-act="demo"><span class="lt"><b>Try the demo</b><span>A made-up job to practise on. Your job’s lines stay on the phone.</span></span></button>') + '</div>' +
      '<div class="sec">ON THIS PHONE</div><p>' + n + ' line' + (n === 1 ? '' : 's') + ' for this job. Nothing leaves the phone until you ship. Keep BTC Walk on your Home Screen (Safari › Share › Add to Home Screen) so the phone keeps them.</p>' +
      '<div class="sec">HOW TO WRITE</div><p><b>plinth moved 25 mm ; shop drawing 25 mm shorter</b> is a flow-on (or use --). <b>@NH</b> makes it NH’s action; <b>P1</b>, <b>fri</b>, <b>28-11</b> set priority and due. <b>@SBR 1</b> or <b>@ITP-06</b> tags where it is; <b>at SBR 1</b> on its own moves you there. Tap <b>LOG AS</b> to change the type.</p>' +
      '<p class="mono" style="font-size:11px">BTC Walk ' + VERSION + '</p>');
  }
  function sheet(html) { var s = $('sheet'); s.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>'; s.hidden = false; sync(); }
  function closeSheet() { var s = $('sheet'); s.hidden = true; s.innerHTML = ''; sync(); }
  async function useDemo() {
    var p = JSON.parse(JSON.stringify(DEMO)); p.made = new Date().toISOString(); p.loadedAt = p.made;
    await kvSet('project', p); S.proj = p; S.entries = await allEntries(p.project.id);
    S.me = (await kvGet('me:' + p.project.id)) || { name: 'Sam Rivers', handle: 'SR' }; await kvSet('me:' + p.project.id, S.me);
    if (!S.entries.length) await seedDemo();
    closeSheet(); S.view = 'days'; render();
  }
  async function seedDemo() {   // two days so the list and search have something in them
    var y = addDays(today(), -1), t = today();
    var at = function (d, h, m) { var x = dayDate(d); x.setHours(h, m, 0, 0); return x.toISOString(); };
    var mk = function (d, h, m, raw, extra) { var p = parse(raw, d); return Object.assign({ id: 'demo-' + d + '-' + h + m, proj: 'demo-dragon', day: d, time: at(d, h, m), raw: raw, type: p.type, text: p.text, action: p.action, who: p.who, area: p.area, itp: p.itp, tag: '', location: '', priority: p.priority, due: p.due, photo: '', edited: false, shipped: false, notFound: p.notFound, there: !!p.there }, extra || {}); };
    var es = [
      mk(y, 7, 40, 'Toolbox: wet commissioning of the inlet works starts Thursday'),
      mk(y, 9, 15, 'Decanter weir checked end to end: 8 mm out @ITP-06'),
      mk(y, 9, 31, 'Decanter bracket moved 40 mm east ; mech shop drawing and limit switch to suit @ITP-06'),
      mk(y, 9, 48, 'Re-shim the decanter weir @NH P1 tomorrow @SBR 1'),
      mk(t, 8, 34, 'Screen 1 running, no debris carry-over @Inlet works'),
      mk(t, 8, 51, 'Screen channel 10 mm wider -- check the screen frame fits @Inlet works'),
      mk(t, 9, 2, 'Label the inlet pump isolators @AK fri @Inlet works')];
    es.slice(0, 4).forEach(function (e) { e.shipped = false; });
    for (var i = 0; i < es.length; i++) { S.entries.push(es[i]); await putEntry(es[i]); }
  }

  // ---------- drawing ----------
  function render() {
    $('proj').textContent = (S.proj.project.code || S.proj.project.name || '') + ' ▾';
    $('find').classList.toggle('on', S.view === 'findall');
    if (S.view === 'day') renderDay(); else if (S.view === 'findall') renderFindAll(); else renderDays();
    sync();
  }

  // ---------- Back (1.1) ----------
  // The phone's Back steps through the app: it closes a sheet, an edit or the day's search first, then takes you from a day
  // (or search) to the days. On the days, Back once says "Press back again to leave"; a second Back leaves. Each open layer
  // is one history entry above a guard entry; sync() keeps the count in step with what's open after every draw.
  var H = { n: 0, guard: false, skip: 0, leaving: null };
  function layers() { return (S.view !== 'days' ? 1 : 0) + ($('sheet').hidden ? 0 : 1) + (S.view === 'day' && S.edit ? 1 : 0) + (S.view === 'day' && S.findOpen ? 1 : 0); }
  function sync() {
    if (!H.ready) return;
    if (!H.guard) { history.pushState({ walk: 'guard' }, ''); H.guard = true; }
    var want = layers();
    while (H.n < want) { history.pushState({ walk: 'layer' }, ''); H.n++; }
    if (H.n > want) { H.skip++; history.go(want - H.n); H.n = want; }
  }
  function closeTop() {
    if (!$('sheet').hidden) { var s = $('sheet'); s.hidden = true; s.innerHTML = ''; return; }
    if (S.view === 'day' && S.edit) { S.edit = null; S.as = null; renderDay(); return; }
    if (S.view === 'day' && S.findOpen) { S.findOpen = false; S.find = ''; renderDay(); return; }
    if (S.view !== 'days') { S.view = 'days'; S.edit = null; S.findOpen = false; S.find = ''; render(); }
  }
  window.addEventListener('popstate', function () {
    if (H.skip) { H.skip--; return; }
    if (H.n > 0) { H.n--; closeTop(); sync(); return; }
    // the guard went: one more Back leaves the app
    H.guard = false; toast('Press back again to leave');
    clearTimeout(H.leaving); H.leaving = setTimeout(function () { if (!H.guard) { history.pushState({ walk: 'guard' }, ''); H.guard = true; } }, 2600);
  });
  function openDay(d) { S.view = 'day'; S.day = d; S.find = ''; S.findOpen = false; S.edit = null; S.as = null; render(); }

  document.addEventListener('click', async function (ev) {
    var t = ev.target.closest('button, [data-day], [data-e], [data-jump], [data-put], [data-me], [data-filter], [data-fix]');
    if (!t) { if (ev.target.id === 'sheet') closeSheet(); return; }
    if (t.id === 'more' || t.id === 'proj') { settings(); return; }
    if (t.id === 'find') { S.view = S.view === 'findall' ? 'days' : 'findall'; render(); return; }
    if (t.dataset.day) { openDay(t.dataset.day); return; }
    if (t.dataset.put) { var b = $('box'), v = b.value, pos = b.selectionStart || v.length, i = v.lastIndexOf('@', pos - 1); b.value = v.slice(0, i + 1) + t.dataset.put + ' ' + v.slice(pos); b.focus(); var np = i + 2 + t.dataset.put.length; b.setSelectionRange(np, np); S.draft = b.value; reads(); return; }
    if (t.dataset.e) {
      var e = S.entries.filter(function (x) { return x.id === t.dataset.e; })[0]; if (!e) return;
      if (S.find) { S.find = ''; S.findOpen = false; renderDay(); var el = document.querySelector('[data-e="' + e.id + '"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('sel'); setTimeout(function () { el.classList.remove('sel'); }, 1400); } return; }
      S.edit = e.id; S.photo = null; S.as = e.type; renderDay(); var bx = $('box'); bx.focus(); return;
    }
    if (t.dataset.jump) { var j = S.entries.filter(function (x) { return x.id === t.dataset.jump; })[0]; if (!j) return; openDay(j.day); var el2 = document.querySelector('[data-e="' + j.id + '"]'); if (el2) { el2.scrollIntoView({ block: 'center' }); el2.classList.add('sel'); setTimeout(function () { el2.classList.remove('sel'); }, 1400); } return; }
    if (t.dataset.me) { var pp = (S.proj.people || []).filter(function (x) { return x.handle === t.dataset.me; })[0]; S.me = { name: pp.name, handle: pp.handle }; await kvSet('me:' + S.proj.project.id, S.me); closeSheet(); toast('You’re ' + pp.name + '.'); render(); return; }
    if (t.dataset.filter) { S.filter = t.dataset.filter; renderFindAll(); return; }
    if (t.dataset.fix) { closeSheet(); var fx = S.entries.filter(function (x) { return x.id === t.dataset.fix; })[0]; openDay(fx.day); S.edit = fx.id; S.as = 'flowon'; renderDay(); var bb = $('box'); bb.value = (fx.raw || fx.text) + ' ; '; bb.focus(); reads(); return; }
    var act = t.dataset.act;
    if (!act) return;
    if (act === 'today') openDay(today());
    else if (act === 'back') { S.view = 'days'; S.edit = null; render(); }
    else if (act === 'earlier') { S.showEarlier = true; renderDays(); }
    else if (act === 'ship') shipSheet();
    else if (act === 'doship') doShip();
    else if (act === 'send') send();
    else if (act === 'photo') $('photo-in').click();
    else if (act === 'nophoto') { S.photo = null; renderDay(); }
    else if (act === 'findday') { S.findOpen = !S.findOpen; if (!S.findOpen) S.find = ''; renderDay(); var fd = $('find-day'); if (fd) fd.focus(); }
    else if (act === 'as') { var cur = $('box') ? (S.as || parse($('box').value, S.day).type) : 'note'; S.as = CYCLE[(CYCLE.indexOf(cur) + 1) % 3]; reads(); }
    else if (act === 'unloc') { S.loc = null; await kvSet('loc', null); renderDay(); }
    else if (act === 'cancel') { S.edit = null; S.as = null; renderDay(); }
    else if (act === 'delete') { var dl = S.edit; if (!confirm('Delete this line?')) return; S.entries = S.entries.filter(function (x) { return x.id !== dl; }); await delEntry(dl); S.edit = null; renderDay(); toast('Deleted'); }
    else if (act === 'load') $('proj-in').click();
    else if (act === 'me') pickMe();
    else if (act === 'demo') useDemo();
  });
  $('sheet').addEventListener('click', function (ev) { if (ev.target.id === 'sheet') closeSheet(); });
  $('photo-in').addEventListener('change', async function () {
    var f = this.files && this.files[0]; this.value = ''; if (!f) return;
    try { S.photo = await shrink(f); renderDay(); var b = $('box'); if (b) b.focus(); } catch (e) { toast('Could not use that photo.', true); }
  });
  $('proj-in').addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) loadProjectFile(f); });

  // ---------- start ----------
  (async function start() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* best effort */ }
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is a bonus */ });
    var p = await kvGet('project');
    if (!p) { H.ready = true; history.replaceState({ walk: 'root' }, ''); await useDemo(); return; }
    S.proj = p; S.entries = await allEntries(p.project.id);
    S.me = (await kvGet('me:' + p.project.id)) || null; S.loc = (await kvGet('loc')) || null;
    H.ready = true; history.replaceState({ walk: 'root' }, ''); render();
    if (!S.me && !p.demo) pickMe();
  })();
  // The keyboard (1.1): the app shrinks to the space above it instead of being pushed up. Android does it from the viewport
  // tag (interactive-widget=resizes-content); iPhone overlays the keyboard, so the app follows the visible area itself.
  if (window.visualViewport) {
    var fit = function () { var v = window.visualViewport; document.body.style.height = v.height + 'px'; document.body.style.transform = v.offsetTop ? 'translateY(' + v.offsetTop + 'px)' : ''; };
    window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); fit();
  }
  window.BTCWalk = { parse: parse, state: S, version: VERSION, loadProjectFile: loadProjectFile };
})();
