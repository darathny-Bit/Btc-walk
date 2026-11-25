/* BTC Walk: the phone's site diary for BTC.
   The day is the chat: open it and type. Notes, photos, clashes ("what changed ; what next") and actions (@person)
   all go in the day's one chat. Ship sends the day (and any day not shipped yet) to BTC as one .btcwalk file through
   the phone's share sheet (Outlook); BTC files it into your site diary.
   Everything stays on this phone until it's shipped. The job comes from the project file BTC's Build makes
   (⋮ › Load project). No server, nothing sent anywhere else. */
'use strict';
(function () {
  var VERSION = '2.16.4';
  // iPhone (2.16.1): iOS 27 lays a frozen glass blur over the top of home-screen web apps, so on an iPhone or iPad the top
  // bar is taller, its buttons shifted down below the haze. Undo with the 'ios' class.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) document.documentElement.classList.add('ios');
  var FORMAT = 'btcwalk', PFORMAT = 'btcproject';

  // ---------- the demo job (generic) ----------
  var DEMO = {
    format: PFORMAT, v: 1, made: null, demo: true,
    project: { id: 'demo-dragon', code: 'DRAGON', name: 'Dragon WWTP (demo)' },
    people: [{ name: 'Sam Rivers', handle: 'SR', team: true, role: 'Commissioning Manager' }, { name: 'Alex Kerr', handle: 'AK', team: true, role: 'Lead Commissioning Engineer' }, { name: 'Nikau Hale', handle: 'NH', team: true, role: 'Commissioning Engineer' }, { name: 'Jo Tamati', handle: 'JT', team: true, role: 'Automation Engineer' }, { name: 'Pat Lee', handle: 'PL', team: false }],
    parties: [{ name: 'Beca', contact: 'Pat Lee', role: 'Engineer' }, { name: 'DDC', contact: '', role: 'Client' }],
    areas: [
      { name: 'Inlet works', itps: [{ code: 'ITP-01', title: 'Inlet screens', lines: [{ no: '2.1', text: 'Screen frame set out' }, { no: '2.2', text: 'Screen installed and levelled' }, { no: '3.1', text: 'Wash press wired' }] },
        { code: 'ITP-02', title: 'Inlet pumps', lines: [{ no: '2.1', text: 'Pump plinths grouted' }, { no: '2.2', text: 'Pumps set and aligned' }, { no: '3.1', text: 'Discharge pipework pressure test' }] }] },
      { name: 'SBR 1', itps: [{ code: 'ITP-05', title: 'SBR 1 diffusers', lines: [{ no: '2.1', text: 'Grid levelled' }, { no: '2.2', text: 'Clean water leak test' }] },
        { code: 'ITP-06', title: 'SBR 1 decanter', lines: [{ no: '3.1', text: 'Decanter bracket installed' }, { no: '3.2', text: 'Hold-down bolts torqued' }, { no: '3.3', text: 'Limit switches set' }] }] },
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
  var S = { proj: null, me: null, entries: [], view: 'days', day: null, find: '', findAll: '', filter: 'all', edit: null, photos: [], as: null, loc: null, wx: {} };
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
  // A quiet pill at the bottom; with Undo when the last thing can be taken back (2.0: mistakes cost nothing).
  var toastUndo = null;
  function toast(msg, bad, undo) {
    var t = $('toast'); toastUndo = undo || null;
    t.innerHTML = '<span class="tt">' + esc(msg) + '</span>' + (undo ? '<button type="button" class="tu" data-act="undo">' + esc(undo.label || 'Undo') + '</button>' : '');
    t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; void t.offsetWidth; t.classList.add('pop'); clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; toastUndo = null; }, bad ? 5000 : undo ? (undo.ms || 4000) : 2400);
  }
  function uid() { return (S.me ? S.me.handle : 'X') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

  // ---------- reading a line ----------
  // Checked in order: "at <place>" moves you · a clash (what changed, then -- ; → or ->, or starts clash / bridge)
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
  // Parties (2.4): outside companies for the job (Beca, the client). The project file's parties, plus ones first @'d on
  // this phone (kept per job, shipped until BTC knows them). An @ that isn't a person or a place is a party.
  function partiesAll() { var have = {}, out = []; (S.proj.parties || []).concat(S.newParties || []).forEach(function (p) { var k = key(p.name); if (k && !have[k]) { have[k] = 1; out.push(p); } }); return out; }
  function partyBy(h) { var k = key(h); return k ? partiesAll().filter(function (p) { return key(p.name) === k; })[0] || null : null; }
  var RAISED = /\b(asked|asks|asking|wants|wanted|requested|requests|request|raised|raises|comment|comments|commented|query|queried|queries|says|said|noted|flagged|instructed|required|requires)\b/i;
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
  // A word and a full stop at the start says what it is (1.6): note. action. clash. ITP. (the word is dropped; flow. still works). ITP is
  // evidence for an ITP line: @ITP-06 3.2 files it on that line in Build; plain @ITP (or no ITP) leaves it to sort on the
  // PC. @clash is the same as clash. (and the old @flow-on).
  // 2.1: delay. (lost time, "2h"), instruction. (EI/SI, who gave it with @), crew. (who's on site, "HEB 6, sparkies 4"),
  // visitor. and weather. (or a weather word on its own line: rainy, fine, windy…).
  var LEAD = /^(note|action|clash|flow(?:-?on)?|itp|delay|instruction|instr|ei|si|crew|labour|visitor|visit|weather|wx)\.(?=\s|$)\s*/i;
  var LEADMAP = { delay: 'delay', instruction: 'instruction', instr: 'instruction', ei: 'instruction', si: 'instruction', crew: 'crew', labour: 'crew', visitor: 'visitor', visit: 'visitor', weather: 'weather', wx: 'weather' };
  // 2.3: a line only about the weather is weather, however it's said ("pissing down since lunch", "8 deg and blowing a gale").
  // Every word has to be a weather word, a small word, a time or a number with a unit; at least one has to say something.
  var WXCORE = /^(cleared|clearing|fine|sunny|sun|clear|dry|cloudy|cloud|clouds|overcast|grey|gray|showers?|showery|drizzle|drizzly|drizzling|spitting|mizzle|rain|rainy|raining|rained|wet|pouring|poured|pissing|bucketing|hosing|teeming|storm|stormy|thunder|thunderstorm|lightning|hail|hailing|sleet|snow|snowing|windy|gusty|gusts?|gale|breezy|breeze|wind|calm|still|cold|freezing|chilly|cool|warm|hot|scorcher|boiling|muggy|humid|frost|frosty|fog|foggy|mist|misty|southerly|northerly|easterly|westerly|nor'?west(er|erly)?|sou'?west(er|erly)?|nor'?east(er|erly)?|sou'?east(er|erly)?)$/;
  var WXFILL = /^(it|it's|its|is|was|been|has|very|really|bit|abit|a|quite|pretty|real|super|and|&|but|with|since|from|till|until|this|morning|arvo|afternoon|evening|night|lunch|lunchtime|smoko|now|still|all|day|today|getting|got|started|starting|stopped|stopping|eased|easing|light|heavy|down|up|the|of|out|then|later|at|on|off|again|bloody|mm|skies|sky|nice|good|bad|rubbish|horrible|shocking|blowing|blowy|patchy|odd|few|some|on-off|on\/off|hours?|hrs?|h|deg|degs|degrees|c|°|°c|km\/h|kmh|kph|knots?|kts?|to|ish|-|–|odd)$/;
  function isWxLine(t) {
    var w = String(t || '').toLowerCase().replace(/[.,!;:()]+/g, ' ').replace(/(\d)(deg|degs|degrees|°c?|c|km\/h|kmh|kph|kts?|knots?|h|hrs?|mm)\b/g, '$1 $2').split(/\s+/).filter(Boolean), core = 0;
    if (!w.length || w.length > 14) return false;
    for (var k = 0; k < w.length; k++) {
      var x = w[k].replace(/^[-–]+|[-–]+$/g, '') || w[k];
      if (WXCORE.test(x)) { core++; continue; }
      if (/^-?\d{1,3}(\.\d)?$/.test(x) && /^(deg|degs|degrees|°|°c|c)$/.test(w[k + 1] || '')) { core++; continue; }
      if (/^-?\d{1,3}(\.\d)?$/.test(x) || /^\d{1,2}[:.]\d{2}$/.test(x) || /^\d{1,2}(am|pm)$/.test(x)) continue;
      if (WXFILL.test(x)) continue;
      return false;
    }
    return core > 0;
  }
  // What a weather line says, part by part; anything not said stays the forecast. Temperatures are always °C (8 deg, 8°, 8 degrees).
  function wxParse(t) {
    t = String(t || '').toLowerCase(); var o = {};
    if (/heavy rain|pouring|poured|pissing|bucketing|hosing|teeming|storm|thunder|hail/.test(t)) o.sky = 'heavy';
    else if (/\b(rain|rainy|raining|rained|wet|sleet|snow|snowing)\b/.test(t) && !/\b(stopped|eased|cleared|dried)\b/.test(t)) o.sky = 'rain';
    else if (/shower|drizzl|spitting|mizzle/.test(t)) o.sky = 'showers';
    else if (/\b(cleared|clearing)\b/.test(t)) o.sky = 'fine';
    else if (/overcast|cloud|fog|mist|grey|gray|\b(stopped|eased)\b/.test(t)) o.sky = 'cloudy';
    else if (/\b(fine|sunny|sun|clear|dry|scorcher)\b/.test(t)) o.sky = 'fine';
    var m = /(-?\d{1,2}(?:\.\d)?)\s*(°|deg|degs|degrees|c\b)/.exec(t); if (m) o.temp = Math.round(+m[1]);
    else if (/\b(cold|freezing|chilly)\b|frost/.test(t)) o.feel = 'cold'; else if (/\b(hot|scorcher|boiling|muggy|humid)\b/.test(t)) o.feel = 'hot';
    var w = /(\d{1,3})\s*(km\/?h|kph)/.exec(t), kn = /(\d{1,3})\s*(knots?|kts?)\b/.exec(t); if (w) o.wind = +w[1]; else if (kn) o.wind = Math.round(+kn[1] * 1.852);
    if (/windy|gust|gale|blowing|blowy|breez|southerly|northerly|easterly|westerly|nor'?west|sou'?west|nor'?east|sou'?east/.test(t)) o.windy = true; if (/\bcalm\b/.test(t)) o.windy = false;
    return o;
  }
  function lostHours(t) { var h = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i.exec(t), mm = /(\d+)\s*(m|min|mins|minutes)\b/i.exec(t); return (h ? +h[1] : 0) + (mm ? +mm[1] / 60 : 0); }
  function crewOf(t) { var out = [], re = /([A-Za-z][A-Za-z &'-]*?)\s+(\d+)(?=\s*(,|;|$|\s+[A-Za-z]))/g, m; while ((m = re.exec(t))) out.push({ who: m[1].trim(), n: +m[2] }); return out; }
  function lineOf(code, no) { var it = itpByCode(code); return it && (it.lines || []).filter(function (l) { return l.no === no; })[0] || null; }
  function itpByCode(code) { var k = key(code), hit = null; (S.proj.areas || []).forEach(function (a) { (a.itps || []).forEach(function (i) { if (!hit && key(i.code) === k) hit = i; }); }); return hit; }
  function parse(raw, day) {
    var text = String(raw || '').trim(), out = { type: 'note', text: '', action: '', who: '', area: '', itp: '', tag: '', line: '', priority: '', due: '', move: null, notFound: [], forced: '' };
    if (!text) return out;
    var ld = LEAD.exec(text);
    if (ld) { var w = ld[1].toLowerCase(); out.forced = LEADMAP[w] || (w === 'itp' ? 'itp' : /^(flow|clash)/.test(w) ? 'flowon' : w); text = text.slice(ld[0].length); }
    else if (isWxLine(text)) out.forced = 'weather';
    if (out.forced === 'weather' || out.forced === 'crew') { out.type = out.forced; out.text = text; if (out.forced === 'weather') out.wx = wxParse(text); else out.crew = crewOf(text); return out; }
    text = text.replace(/(^|\s)@(clash|flow-?on)\b/i, function () { if (!out.forced) out.forced = 'flowon'; return ' '; }).trim();
    text = text.replace(/(^|\s)@itp(?=\s|$)/i, function () { if (!out.forced) out.forced = 'itp'; return ' '; }).trim();
    var mv = /^at\s+(.+)$/i.exec(text);
    if (mv) { var p0 = placeAt('@' + mv[1].trim(), 0); if (p0 && p0.len >= mv[1].trim().length - 1) { out.move = p0.place; return out; } }
    // @ who or where
    var i = 0, people = [], place = null, party = null, dirWord = '';
    while ((i = text.indexOf('@', i)) >= 0) {
      if (i > 0 && /\S/.test(text.charAt(i - 1))) { i++; continue; }
      var pl = placeAt(text, i);
      if (pl && !place) {
        place = pl.place; var cut = 1 + pl.len;
        if (place.kind === 'itp') { var ln = /^\s+(\d+(?:\.\d+)*)(?=[\s,;]|$)/.exec(text.slice(i + cut)); if (ln) { out.line = ln[1]; cut += ln[0].length; if (!out.forced) out.forced = 'itp'; } }
        text = (text.slice(0, i) + text.slice(i + cut)).replace(/\s{2,}/g, ' '); continue;
      }
      var m = /^@(\S+)/.exec(text.slice(i)), mh = m ? m[1].replace(/[,.;:]+$/, '') : '';
      var aw = m ? /^(?:all|everyone)(?:-(.+))?$/i.exec(mh) : null, at = aw && aw[1] ? teamByWord(aw[1]) : null;
      var who = m ? (aw && (!aw[1] || at) ? (at ? { handle: 'all-' + at.id, name: 'Everyone in ' + at.name } : { handle: 'all', name: 'Everyone' }) : person(mh)) : null;   // @all: everyone (1.7); @all-m&e: that team (2.15)
      if (who) { people.push(who); text = (text.slice(0, i) + text.slice(i + m[0].length)).replace(/\s{2,}/g, ' '); continue; }
      if (m && mh && !party && /^[a-z][a-z&'.-]*$/i.test(mh)) {   // a party: known, or new (it's remembered on send)
        var kp = partyBy(mh); party = kp ? { name: kp.name, role: kp.role || '' } : { name: mh.charAt(0).toUpperCase() + mh.slice(1), isNew: true };
        var pre = /(^|\s)(from|per|chase)\s+$/i.exec(text.slice(0, i)), st = pre ? pre.index + pre[1].length : i;
        if (pre) dirWord = pre[2].toLowerCase() === 'chase' ? 'chase' : 'ours';
        text = (text.slice(0, st) + text.slice(i + m[0].length)).replace(/\s{2,}/g, ' '); i = st; continue;
      }
      if (m) out.notFound.push(m[1]);
      i++;
    }
    var pm = /(^|\s)P([123])(?=\s|$)/i.exec(text);
    if (pm) { out.priority = 'P' + pm[2]; text = (text.slice(0, pm.index) + text.slice(pm.index + pm[0].length)).replace(/\s{2,}/g, ' '); }
    var d = parseDue(text, day || today()); text = d.text; out.due = d.due;
    text = text.trim();
    var sep = out.forced && out.forced !== 'flowon' ? null : SEP.exec(text), lead = out.forced ? null : /^(clash|flow-?on|bridge)\b[:\s]*/i.exec(text);
    if (out.forced && out.forced !== 'flowon') { out.type = out.forced; out.text = text; }
    else if (sep) { out.type = 'flowon'; out.text = text.slice(0, sep.index).trim(); out.action = text.slice(sep.index + sep[0].length).trim(); }
    else if (lead) { out.type = 'flowon'; out.text = text.slice(lead[0].length).trim(); }
    else { out.text = text; if (out.forced) out.type = out.forced; else if (people.length || party || out.priority || out.due || VERBS.test(text)) out.type = 'action'; }
    if (out.forced === 'flowon') out.type = 'flowon';
    if (out.type === 'flowon' && lead && sep) out.text = out.text.replace(/^(clash|flow-?on|bridge)\b[:\s]*/i, '');
    out.who = people.map(function (p) { return p.handle; }).filter(function (h, k, a) { return a.indexOf(h) === k; }).join(' ');   // one or more (1.7): @AK @SR is 'AK SR'
    if (place) { out.area = place.area || ''; out.itp = place.itp || ''; out.tag = place.tag || ''; out.there = true; }
    // which way a party item runs: ↗ chase (they owe us) or ↙ ours (they raised it). "chase @Beca" / "from @Beca" say it;
    // else a raising word (asked, comments…) or a team member beside it = ours, otherwise a chase.
    if (party) {
      out.party = party.name; out.partyNew = !!party.isNew; out.partyRole = party.role || '';
      if (dirWord === 'chase') out.text = out.text.replace(/^(for|about|re)\s+/i, '');
      out.dir = dirWord || (/^(chase|follow up|waiting|await|get)\b/i.test(out.text) ? 'chase' : RAISED.test(out.text) || people.length ? 'ours' : 'chase');
    }
    if (out.type === 'delay') out.lost = Math.round(lostHours(String(raw)) * 100) / 100;
    return out;
  }
  // turns a line's party round: "from @Beca" ⇄ "chase @Beca" (the words say it, so an edit keeps it)
  function flipText(v) {
    var p = parse(v, S.day); if (!p.party) return v;
    var re = new RegExp('(^|\\s)(?:(?:from|per|chase)\\s+)?@(' + p.party.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[\\s,.;:]|$)', 'i');
    return v.replace(re, '$1' + (p.dir === 'ours' ? 'chase' : 'from') + ' @$2');
  }
  var TYPE = { note: 'Note', flowon: 'Clash', action: 'Action', itp: 'ITP', delay: 'Delay', instruction: 'Instruction', crew: 'Crew', visitor: 'Visitor', weather: 'Weather' };
  var CYCLE = ['note', 'flowon', 'action', 'itp'];

  // ---------- days ----------
  function daysOf() {
    var m = {};
    S.entries.forEach(function (e) { (m[e.day] = m[e.day] || []).push(e); });
    var gone = {}; (S.gone || []).forEach(function (g) { gone[g.day] = (gone[g.day] || 0) + 1; m[g.day] = m[g.day] || []; });
    var ticks = (S.packDone || []).filter(function (d) { return !d.sent; }).length; if (ticks) m[today()] = m[today()] || [];   // ticks go with today's ship (2.8)
    return Object.keys(m).sort().reverse().map(function (d) {
      var es = m[d].sort(function (a, b) { return a.time < b.time ? -1 : 1; });
      // changed since it was shipped (1.7): an edited line, or one deleted after shipping; ship again to bring BTC up to date
      var changed = !!gone[d] || es.some(function (e) { return !e.shipped && e.shippedAt; });
      var lines = changed || es.some(function (e) { return !e.shipped; }) || (ticks && d === today()), wxo = !!(S.wxOwed && S.wxOwed[d]);
      return { day: d, entries: es, unshipped: lines || wxo, wxOnly: wxo && !lines, changed: changed, gone: gone[d] || 0 };
    });
  }
  function counts(es) { var c = { note: 0, flowon: 0, action: 0, itp: 0, photo: 0 }; es.forEach(function (e) { if (e.type === 'weather') return; c[e.type] = (c[e.type] || 0) + 1; c.photo += pics(e).length; }); return c; }
  function dotsRow(c) { return '<span class="dots-row"><span><span class="dot-n">●</span>' + c.note + '</span><span><span class="dot-f">●</span>' + c.flowon + '</span><span><span class="dot-a">●</span>' + c.action + '</span>' + (c.itp ? '<span><span class="dot-i">●</span>' + c.itp + '</span>' : '') + (c.photo ? '<span class="muted">▣ ' + c.photo + '</span>' : '') + '</span>'; }
  var RESHIP = '<span class="flag">✎ Changed · reship</span>';
  var FLAG = '<span class="flag"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="2.6" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>Not shipped</span>';
  var TICK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  function monday(d) { var x = dayDate(d), k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return ymd(x); }
  function weekNo(d) { var x = dayDate(d); x.setDate(x.getDate() + 3 - (x.getDay() + 6) % 7); var w1 = new Date(x.getFullYear(), 0, 4, 12); return 1 + Math.round(((x - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
  function weekOf(d) { var m = monday(d); return { from: m, to: addDays(m, 6), es: S.entries.filter(function (e) { return e.day >= m && e.day <= addDays(m, 6); }) }; }
  function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function firstName() { return S.me && S.me.name ? String(S.me.name).split(' ')[0] : ''; }
  function itpLinesDone(es) { var m = {}; es.forEach(function (e) { if (e.type === 'itp' && e.itp && e.line) m[e.itp + ' ' + e.line] = 1; }); return Object.keys(m).length; }

  function renderDays() {
    var ds = daysOf(), t = today(), waiting = ds.filter(function (d) { return d.unshipped; }), old = ds.filter(function (d) { return d.unshipped && d.day < t; });
    var age = S.proj.made && !S.proj.demo ? Math.floor((Date.now() - new Date(S.proj.made)) / 864e5) : 0;
    var wk = weekOf(t), wc = counts(wk.es), fn = firstName();
    var html = '<div class="hello"><div class="k">Week ' + weekNo(t) + ' · ' + dayDate(wk.from).getDate() + '–' + dayDate(wk.to).getDate() + ' ' + MO[dayDate(wk.to).getMonth()] + '</div><h1>' + greet() + (fn ? ',<br><span>' + esc(fn) + '.</span>' : '.') + '</h1><div id="wxnow"></div></div>' +
      '<div class="stats"><button type="button" class="stat" data-act="recap"><b>' + wk.es.length + '</b><span>lines this week</span></button><button type="button" class="stat" data-act="recap"><b>' + wc.photo + '</b><span>photos</span></button><button type="button" class="stat i" data-act="evidence"><b>' + itpLinesDone(wk.es) + '</b><span>ITP lines</span></button></div>';
    if (S.proj.demo) html += '<div class="bar-info">Demo job (made-up names). Load your job’s project file in ⋮ › Load project. Nothing leaves this phone until you ship.</div>';
    else if (age >= 7) html += '<div class="bar-warn">Project file is ' + age + ' days old<button type="button" data-act="load">Reload</button></div>';
    var chg = ds.filter(function (d) { return d.changed; }), today0 = ds.filter(function (d) { return d.day === t && d.unshipped; })[0];
    if (chg.length) html += '<div class="bar-warn">' + (chg.length === 1 ? (chg[0].day === t ? 'Today' : dayLabel(chg[0].day)) + ' changed' : chg.length + ' days changed') + ' since you shipped<button type="button" data-act="ship">Ship again</button></div>';
    else if (old.length) html += '<div class="bar-warn">' + (old.length === 1 ? dayLabel(old[0].day) + ' isn’t' : old.length + ' days aren’t') + ' shipped yet<button type="button" data-act="ship">Ship now</button></div>';
    else if (ds.length && !waiting.length) html += '<div class="allclear"><i>' + TICK.replace('currentColor', '#7BE0A6') + '</i><div><b>All clear</b><span>Everything is shipped. Nothing waiting.</span></div></div>';
    html += packHtml();
    if (ds.length) html += '<div class="tools"><button type="button" class="tool i" data-act="evidence"><b>Evidence</b><span>Photos by ITP line</span></button><button type="button" class="tool" data-act="recap"><b>This week</b><span>Your week on the record</span></button></div>';
    var cutoff = addDays(t, -6), recent = ds.filter(function (d) { return d.day >= cutoff; }), earlier = ds.filter(function (d) { return d.day < cutoff; });
    var card = function (d) {
      var c = counts(d.entries), isT = d.day === t, dd = dayDate(d.day);
      var where = {}; d.entries.forEach(function (e) { var w = e.location || e.area; if (w) where[w] = 1; }); where = Object.keys(where).slice(0, 2).join(' · ');
      return '<button type="button" class="day' + (isT ? ' today' : '') + (d.unshipped && !isT ? ' unshipped' : '') + '" data-day="' + d.day + '"><span class="day-n"><small>' + WD[dd.getDay()].toUpperCase() + '</small><b>' + dd.getDate() + '</b></span>' +
        '<span class="day-b"><span class="day-h"><span class="day-d">' + (isT ? 'Today' : esc(dayLabel(d.day))) + (where ? ' · ' + esc(where) : '') + '</span>' +
        (d.changed ? RESHIP : isT ? (d.unshipped ? '<span class="tag live">Live</span>' : '<span class="tag sent">' + TICK + ' Sent</span>') : d.unshipped ? FLAG : '<span class="tag sent">' + TICK + ' Sent</span>') + '</span>' + dotsRow(c) + '</span></button>';
    };
    if (recent.length) html += '<div class="kick">This week</div>' + recent.map(card).join('');
    if (earlier.length) html += S.showEarlier ? '<div class="kick">Earlier</div>' + earlier.map(card).join('') : '<button type="button" class="day" data-act="earlier"><span class="muted small">Earlier · ' + earlier.length + ' day' + (earlier.length > 1 ? 's' : '') + (earlier.some(function (d) { return d.unshipped; }) ? '' : ', all sent') + ' ▸</span></button>';
    if (!ds.length) html += '<div class="empty"><b>Nothing logged yet.</b><br>Start the day and type: a note, a photo, a clash (<b>what changed ; what next</b>) or an action (<b>@person</b>). A day you don’t log anything has no card.</div>';
    var hasT = ds.some(function (d) { return d.day === t; });
    var sc0 = main.querySelector('.scroll'), keepY = sc0 && sc0.querySelector('.hello') ? sc0.scrollTop : 0;   // a redraw keeps your place (2.12)
    main.innerHTML = '<div class="scroll"><div class="pad">' + html + '</div></div><div class="foot"><button type="button" class="btn primary" data-act="today">' + (hasT ? 'Open today' : '＋ Start day') + '</button>' +
      (hasT && !(S.closed || {})[t] ? '<button type="button" class="btn ship" data-act="closeday">Close Day</button></div>'
        : '<button type="button" class="btn ship' + (waiting.length ? '' : ' done') + '" data-act="ship">' + (hasT && (S.closed || {})[t] ? (waiting.length ? 'Send changes' : 'Closed') : 'Ship') + (waiting.length ? '<span class="count">' + waiting.length + '</span>' : '') + '</button></div>');
    if (keepY) { var sc1 = main.querySelector('.scroll'); if (sc1) sc1.scrollTop = keepY; }
    wxNow().then(function (h) { var sl = $('wxnow'); if (sl && S.view === 'days') sl.innerHTML = h; });
    watchSeen();
  }

  // ---------- a day's chat ----------
  // Several photos on a line (1.9): e.photos; older lines have one e.photo.
  function pics(e) { return e && e.photos && e.photos.length ? e.photos : e && e.photo ? [e.photo] : []; }
  var MAXPICS = 10;
  // a line's photos (2.5): tap one to see it full screen (swipe for the rest); tapping the words still edits the line
  function picsHtml(ps, id) { return ps.length ? '<span class="e-ph n' + Math.min(ps.length, 3) + '">' + ps.map(function (p, i) { return '<img src="' + p + '" alt="Photo ' + (i + 1) + '"' + (id ? ' data-lph="' + esc(id) + '|' + i + '"' : '') + '>'; }).join('') + '</span>' : ''; }
  function fmtH(h) { return h >= 1 ? (Math.round(h * 10) / 10) + ' h' : Math.round(h * 60) + ' min'; }
  function whoTxt(w) { return String(w || '').split(/\s+/).filter(Boolean).map(function (h) { return '@' + h; }).join(' '); }
  function itpHead(e) { return 'ITP · ' + (e.itp && e.line ? esc(e.itp) + ' ' + esc(e.line) : 'TO SORT ON THE PC'); }
  function entryHtml(e, hl) {
    var mark = function (s) { s = esc(s); if (!hl) return s; var q = hl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return s.replace(new RegExp('(' + esc(q) + ')', 'ig'), '<mark>$1</mark>'); };
    var where = e.itp ? (e.area ? e.area + ' · ' : '') + e.itp : e.area || e.tag || '';
    var who = e.who ? whoTxt(e.who) + ' · ' : '';
    var head = e.type === 'action' ? 'ACTION · ' + (e.who ? esc(whoTxt(e.who)) : 'you') + (e.priority ? ' · ' + esc(e.priority) : '') : e.type === 'itp' ? itpHead(e) : e.type === 'delay' ? 'DELAY' + (e.lost ? ' · ' + fmtH(e.lost).toUpperCase() + ' LOST' : '') : e.type === 'instruction' ? 'INSTRUCTION' + (e.who ? ' · FROM ' + esc(whoTxt(e.who)) : '') : (TYPE[e.type] || 'Note').toUpperCase();
    var meta = [where ? '<span class="' + (e.there ? 'there' : '') + '">' + mark(where) + '</span>' : '', e.party ? '<span class="pty ' + esc(e.dir) + '">' + (e.dir === 'ours' ? '↙ from ' : '↗ chase ') + mark(e.party) + '</span>' : '', e.type !== 'action' && who ? esc(who.replace(' · ', '')) : '', e.due ? 'due ' + esc(dayLabel(e.due)) : '', e.edited ? 'edited' : '', (e.notFound || []).length ? '<span class="nf">@' + esc(e.notFound.join(' @')) + ' not found</span>' : ''].filter(Boolean).join(' · ');
    var ed = S.edit === e.id;
    return '<button type="button" class="e ' + e.type + (ed ? ' ed' : '') + (S.fresh === e.id ? ' new' : '') + '" data-e="' + esc(e.id) + '"><span class="e-h"><span class="e-k">' + (ed ? PEN : '') + head + '</span><span>' + hm(e.time) + (e.shipped ? ' ✓' : '') + '</span></span>' +
      (e.text ? '<span class="e-t">' + mark(e.text) + '</span>' : '') + (e.type === 'flowon' ? (e.action ? '<span class="e-a">→ ' + mark(e.action) + '</span>' : '<span class="e-none">⚠ No action yet · tap to add</span>') : '') +
      (meta ? '<span class="e-m">' + meta + '</span>' : '') + picsHtml(pics(e), e.id) + '</button>';
  }
  var PEN = '<svg class="pen" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  var BIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
  // The line you're editing (1.4): a copy sits on top of the box (it can't scroll away when the keyboard comes up), dashed
  // with a pencil, the bin and × on it. No editing row.
  function pinHtml() {
    var e = S.entries.filter(function (x) { return x.id === S.edit; })[0]; if (!e) return '';
    var head = e.type === 'action' ? 'ACTION' + (e.who ? ' · ' + esc(whoTxt(e.who)) : '') : e.type === 'itp' ? itpHead(e) : TYPE[e.type].toUpperCase();
    return '<div class="pin ' + e.type + '"><div class="pin-b"><span class="e-k">' + PEN + 'EDITING ' + head + ' · ' + hm(e.time) + '</span>' +
      '<span class="pin-t">' + esc(e.text || '') + (e.type === 'flowon' && e.action ? ' → ' + esc(e.action) : '') + '</span></div>' +
      '<button type="button" class="pin-x del" data-act="delete" aria-label="Delete this line">' + BIN + '</button>' +
      '<button type="button" class="pin-x" data-act="cancel" aria-label="Stop editing">×</button></div>';
  }
  // The day opens with its name and totals; a place heading starts each stretch at one place (2.0).
  function dayHead(d, es) {
    var c = counts(es), t = today(), dd = dayDate(d);
    var chip = function (cls, n, w) { return n ? '<span><i class="' + cls + '"></i>' + n + ' ' + w + '</span>' : ''; };
    return '<div class="dayhead" id="dayhead"><div class="k">' + (d === t ? 'Today' : d === addDays(t, -1) ? 'Yesterday' : dd.getDate() + ' ' + MO[dd.getMonth()] + ' ' + dd.getFullYear()) + '</div><h1>' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dd.getDay()] + '</h1>' +
      (es.length ? '<div class="chips">' + chip('dot-n', c.note, 'note' + (c.note === 1 ? '' : 's')) + chip('dot-f', c.flowon, 'clash' + (c.flowon === 1 ? '' : 'es')) + chip('dot-a', c.action, 'action' + (c.action === 1 ? '' : 's')) + chip('dot-i', c.itp, 'ITP') + (c.photo ? '<span>▣ ' + c.photo + ' photo' + (c.photo === 1 ? '' : 's') + '</span>' : '') + '</div>' : '') + '<div id="wxslot"></div></div>';
  }
  function placeOf(e) { return e.location || ''; }
  function withPlaces(list, q) {
    var last = null;
    return list.map(function (e) {
      var p = placeOf(e), h = '';
      if (!q && p !== last && p) h = '<div class="place"><i></i>' + esc(p) + ' · from ' + hm(e.time) + '</div>';
      last = p; return h + entryHtml(e, q);
    }).join('');
  }
  function renderDay() {
    var d = S.day, es = S.entries.filter(function (e) { return e.day === d; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var q = S.find.trim().toLowerCase(), shown = q ? es.filter(function (e) { return matches(e, q); }) : es.filter(function (e) { return e.type !== 'weather'; });   // weather lives in the strip (2.1)
    var un = es.some(function (e) { return !e.shipped; });
    var loc = S.loc ? (S.loc.itp ? (S.loc.area ? S.loc.area + ' · ' : '') + S.loc.itp : S.loc.name) : '';
    main.innerHTML = '<div class="dhead"><button type="button" class="icon" data-act="back" aria-label="Back to days"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<span class="t"><b>' + (d === today() ? 'Today · ' : '') + esc(dayLabel(d)) + '</b><span>' + esc(S.proj.project.code || '') + ' · ' + es.length + ' line' + (es.length === 1 ? '' : 's') + ' · ' + (es.length ? (un ? 'not shipped' : 'sent') : 'nothing yet') + '</span></span>' +
      '<button type="button" class="icon" data-act="compileday" aria-label="Compile this day" title="Compile this day"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/></svg></button>' +
      '<button type="button" class="icon' + (S.findOpen ? ' on' : '') + '" data-act="findday" aria-label="Search this day"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></button></div>' +
      (S.findOpen ? '<div class="findbar"><input type="search" id="find-day" placeholder="Search this day" value="' + esc(S.find) + '" aria-label="Search this day"><span>' + (q ? shown.length + ' of ' + es.length : '') + '</span></div>' : '') +
      '<div class="chat" id="chat">' + (q ? '' : dayHead(d, es)) + (q && shown.length < es.length ? '<span class="note-c">' + (es.length - shown.length) + ' lines hidden · tap one to see it in the chat</span>' : '') +
      (shown.length ? withPlaces(shown, q) : '<div class="empty">' + (q ? 'Nothing matches.' : 'Type below: a note, a photo, a clash (<b>what changed ; what next</b>) or an action (<b>@person</b>, <b>P1</b>, <b>fri</b>). <b>at SBR 1</b> says where you are.') + '</div>') + '</div>' +
      (loc ? '<div class="loc"><span class="l">At</span><b>' + esc(loc) + '</b><button type="button" data-act="unloc" aria-label="Clear where you are">×</button></div>' : '') +
      '<div class="comp"><div class="reads" id="reads"></div><div class="sug" id="sug"></div>' + (S.photos.length ? '<div class="thumbs">' + S.photos.map(function (p, i) { return '<button type="button" class="thumb" data-tph="' + i + '" aria-label="Photo ' + (i + 1) + ': see it, or take it off"><img src="' + p + '" alt=""></button>'; }).join('') + '<span class="thumbs-t">' + S.photos.length + ' photo' + (S.photos.length === 1 ? '' : 's') + (S.edit ? ' on this line' : ' go with the next line') + '</span></div>' : '') +
      (S.edit ? pinHtml() : '') + '<div class="comp-row"><button type="button" class="cam" data-act="photo" aria-label="Add a photo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/></svg></button><button type="button" class="cam" data-act="pics" aria-label="Add photos from the phone"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg></button>' +
      '<textarea id="box" rows="1" placeholder="Log it…" aria-label="Write a line" enterkeyhint="send"></textarea><button type="button" class="send" id="send" data-act="send" aria-label="' + (S.edit ? 'Save' : 'Send') + '">' + (S.edit ? 'Save' : 'Send') + (S.edit ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>') + '</button></div></div>';
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
    if (!q) wxBlock(d, es).then(function (h) { var sl = $('wxslot'); if (sl && S.view === 'day' && S.day === d) { var was = chat.scrollHeight - chat.scrollTop; sl.innerHTML = h; if (S.stick) chat.scrollTop = chat.scrollHeight; } });
    sync();
  }
  function grow() { var b = $('box'); if (!b) return; b.style.height = 'auto'; b.style.height = Math.min(140, b.scrollHeight + 2) + 'px'; }
  function reads() {
    var b = $('box'), r = $('reads'), sg = $('sug'); if (!b || !r) return;
    var v = b.value, p = parse(v, S.day);
    // @ITP-06 then a space: that ITP's lines (1.6)
    var before = v.slice(0, b.selectionStart || v.length), lm = /(?:^|\s)@(\S+)\s+(\d[\d.]*)?$/.exec(before), li = lm ? itpByCode(lm[1]) : null;
    var at = /(?:^|\s)@([^@]*)$/.exec(before);
    if (li && (li.lines || []).length && !lineOf(li.code, lm[2] || '')) {
      var lk = lm[2] || '';
      sg.innerHTML = li.lines.filter(function (l) { return !lk || l.no.indexOf(lk) === 0; }).slice(0, 14).map(function (l) { return '<button type="button" data-line="' + esc(l.no) + '">' + esc(l.no) + '<small>' + esc(l.text) + '</small></button>'; }).join('');
    } else if (at && at[1].length <= 24 && !/\s{2}/.test(at[1])) {
      var k = key(at[1]);
      var list = (S.proj.people || []).map(function (x) { return { put: x.handle, label: x.name, sub: '@' + x.handle }; }).concat([{ put: 'all', label: 'Everyone', sub: '@all' }]).concat((S.proj.teams || []).map(function (t) { var tw = String(t.name).toLowerCase().replace(/\s+/g, ''); return { put: 'all-' + tw, label: 'Everyone in ' + t.name, sub: '@all-' + tw }; })).concat(partiesAll().map(function (x) { return { put: x.name.replace(/\s+/g, ''), label: x.name, sub: (x.role || 'party') + (x.contact ? ' · ' + x.contact : '') }; })).concat(places().map(function (x) { return { put: x.name, label: x.name, sub: x.kind === 'itp' ? x.area : x.kind }; }))
        .filter(function (x) { return !k || key(x.put).indexOf(k) === 0 || key(x.label).indexOf(k) === 0; }).slice(0, 12);
      if (list.length === 1 && k && (key(list[0].put) === k || key(list[0].label) === k)) list = [];   // already typed in full
      sg.innerHTML = list.map(function (x) { return '<button type="button" data-put="' + esc(x.put) + '">' + esc(x.label) + '<small>' + esc(x.sub) + '</small></button>'; }).join('');
    } else sg.innerHTML = v.trim() || S.edit ? '' : smart();
    if (!v.trim() && !S.photos.length) { r.innerHTML = ''; return; }
    if (p.move) { r.innerHTML = 'Moves you to <span class="chip">' + esc(p.move.name) + '</span>'; return; }
    var type = S.as || p.type;
    if (type === 'weather') { r.innerHTML = 'Logs the weather <span class="chip here">' + esc(wxWords(p.wx) || 'as you say it') + '</span><span class="chip">the rest stays the forecast</span>'; return; }
    if (type === 'crew') { r.innerHTML = 'Crew on site <span class="chip">' + esc((p.crew || []).map(function (c) { return c.who + ' ' + c.n; }).join(' · ') || 'type who and how many: HEB 6, sparkies 4') + '</span>'; return; }
    var where = p.itp ? (p.area ? p.area + ' · ' : '') + p.itp : p.area || p.tag || '';
    r.innerHTML = 'Log as <button type="button" class="as ' + type + '" data-act="as">' + TYPE[type].toUpperCase() + ' ▾</button>' +
      (where ? '<span class="chip warn">@ ' + esc(where) + '</span>' : '') + (type === 'action' ? '<span class="chip">' + (p.who ? esc(whoTxt(p.who)) : 'you') + '</span>' : p.who ? '<span class="chip">@' + esc(p.who) + '</span>' : '') +
      (type === 'delay' ? '<span class="chip warn">' + (p.lost ? fmtH(p.lost) + ' lost' : 'add the time lost: 2h, 30 min') + '</span>' : '') + (p.priority ? '<span class="chip">' + p.priority + '</span>' : '') + (p.due ? '<span class="chip">due ' + esc(dayLabel(p.due)) + '</span>' : '') +
      (type === 'flowon' ? (p.action ? '<span class="chip">→ ' + esc(p.action) + '</span>' : '<span class="chip warn">no action yet: add ; and what next</span>') : '') +
      (p.notFound.length ? '<span class="chip nf">@' + esc(p.notFound.join(' @')) + ' not found</span>' : '') +
      (p.party ? '<button type="button" class="chip pty ' + p.dir + '" data-act="flip">' + (p.dir === 'ours' ? '↙ from ' : '↗ chase ') + esc(p.party) + (p.partyNew ? ' · new' : p.partyRole ? ' · ' + esc(p.partyRole) : '') + ' ⇄</button>' : '') +
      (type === 'itp' ? (p.itp && p.line ? '<span class="chip">' + esc(p.line) + ' ' + esc((lineOf(p.itp, p.line) || {}).text || '') + '</span>'
        : (S.lastLine && !p.itp ? '<button type="button" class="chip itp" data-act="lastline">＋ ' + esc(S.lastLine.itp + ' ' + S.lastLine.line) + '</button>' : '') + '<span class="chip warn">' + (p.itp ? 'no line: ' : '') + 'sorted on the PC</span>') : '');
  }
  // It remembers for you (2.0): with the box empty, the likely next thing is one tap away: the next line on the ITP you
  // used last, the people you tag most, and the start words.
  function nextLine() {
    if (!S.lastLine) return null;
    var it = itpByCode(S.lastLine.itp), ls = it && it.lines || [], i = ls.map(function (l) { return l.no; }).indexOf(S.lastLine.line);
    return i >= 0 && i + 1 < ls.length ? { itp: it.code, line: ls[i + 1].no } : null;
  }
  function smart() {
    var out = [], nl = nextLine(), seen = {};
    if (nl) out.push('<button type="button" class="hot" data-ins="@' + esc(nl.itp + ' ' + nl.line) + ' ">@' + esc(nl.itp + ' ' + nl.line) + '</button>');
    if (S.lastLine) out.push('<button type="button" data-ins="@' + esc(S.lastLine.itp + ' ' + S.lastLine.line) + ' ">@' + esc(S.lastLine.itp + ' ' + S.lastLine.line) + '</button>');
    var tally = {}; S.entries.forEach(function (e) { String(e.who || '').split(/\s+/).filter(Boolean).forEach(function (h) { if (h !== 'all') tally[h] = (tally[h] || 0) + 1; }); });
    Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).slice(0, 2).forEach(function (h) { if (!seen[h]) { seen[h] = 1; out.push('<button type="button" data-ins=" @' + esc(h) + ' ">@' + esc(h) + '</button>'); } });
    ['clash.', 'action.', 'ITP.'].forEach(function (w) { out.push('<button type="button" data-ins="' + w + ' ">' + w + '</button>'); });
    return out.join('');
  }
  function matches(e, q) {
    if (q === 'clashes' || q === 'flowons' || q === 'clash') return e.type === 'flowon';
    if (q === 'actions' || q === 'action') return e.type === 'action';
    if (q === 'notes' || q === 'note') return e.type === 'note';
    if (q === 'itp' || q === 'itps') return e.type === 'itp';
    if (/^@/.test(q)) return String(e.who || '').split(/\s+/).some(function (h) { return key(h) === key(q.slice(1)); }) || key(e.area) === key(q.slice(1)) || key(e.itp) === key(q.slice(1));
    return [e.text, e.action, e.area, e.itp, e.tag, e.who, e.raw].join(' ').toLowerCase().indexOf(q) >= 0;
  }
  async function learnParty(name) {
    if (partyBy(name)) return;
    S.newParties = (S.newParties || []).concat([{ name: name, role: '', contact: '', new: true }]);
    await kvSet('parties:' + S.proj.project.id, S.newParties);
  }
  async function send() {
    var b = $('box'); if (!b) return;
    var raw = b.value.trim(); if (!raw && !S.photos.length && !S.edit) return;
    var p = parse(raw, S.day);
    if (p.move) { S.loc = p.move; await kvSet('loc', S.loc); S.draft = ''; b.value = ''; toast('At ' + p.move.name); renderDay(); return; }
    var type = S.as || p.type, now = new Date().toISOString();
    if (p.party && p.partyNew) await learnParty(p.party);
    var where = p.there ? {} : S.loc ? { area: S.loc.area || '', itp: S.loc.itp || '', tag: S.loc.tag || '' } : {};
    if (S.edit) {
      var e = S.entries.filter(function (x) { return x.id === S.edit; })[0];
      if (e && e.shippedAt && !e.was) { e.was = e.raw || e.text; e.wasType = e.type; }   // amended after shipping (2.1): BTC prints the original too
      if (e && e.shippedAt) e.amendedAt = new Date().toISOString();
      if (e) { Object.assign(e, { wx: p.wx, crew: p.crew, lost: p.lost }); Object.assign(e, { raw: raw, type: type, line: p.line, text: p.text || '', action: p.action, who: p.who, party: p.party || '', dir: p.dir || '', priority: p.priority, due: p.due, notFound: p.notFound, edited: true, shipped: false, synced: false, there: !!p.there }, p.there ? { area: p.area, itp: p.itp, tag: p.tag } : {}); e.photos = S.photos.slice(); delete e.photo; await putEntry(e); }
      S.edit = null; S.photos = []; S.as = null; renderDay(); toast('Saved'); return;
    }
    if (type === 'itp' && p.itp && p.line) { S.lastLine = { itp: p.itp, line: p.line }; kvSet('lastLine:' + S.proj.project.id, S.lastLine); }
    var en = { id: uid(), proj: S.proj.project.id, day: S.day, time: now, raw: raw, type: type, line: p.line, text: p.text || '', action: p.action, who: p.who, party: p.party || '', dir: p.dir || '', area: p.there ? p.area : where.area || '', itp: p.there ? p.itp : where.itp || '', tag: p.there ? p.tag : where.tag || '',
      location: S.loc ? S.loc.name : '', priority: p.priority, due: p.due, photos: S.photos.slice(), edited: false, shipped: false, notFound: p.notFound, there: !!p.there };
    if (p.wx) en.wx = p.wx; if (p.crew) en.crew = p.crew; if (p.lost) en.lost = p.lost;
    S.entries.push(en); await putEntry(en); if (type === 'action') syncSoon(6500);   // straight to BTC (2.12)
    S.draft = ''; S.photos = []; S.as = null; S.fresh = en.id; buzz(8); renderDay(); S.fresh = null;
    var np = pics(en).length;
    if (type === 'weather') { wxRefresh(); toast('Weather logged: ' + wxWords(en.wx) + '. The rest of the day stays on the forecast.', false, { label: 'Undo', fn: async function () { S.entries = S.entries.filter(function (x) { return x.id !== en.id; }); await delEntry(en.id); if (S.view === 'day') renderDay(); } }); return; }
    toast(type === 'itp' ? (en.itp && en.line ? 'Logged on ' + en.itp + ' ' + en.line : 'Logged, to sort on the PC') + (np ? ' · ' + np + ' photo' + (np === 1 ? '' : 's') : '') : 'Logged' + (np ? ' · ' + np + ' photo' + (np === 1 ? '' : 's') : ''), false,
      { label: 'Undo', fn: async function () { S.entries = S.entries.filter(function (x) { return x.id !== en.id; }); await delEntry(en.id); S.draft = raw; S.photos = pics(en).slice(); if (S.view === 'day') renderDay(); } });
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
    var es = S.entries.filter(function (e) { return (f === 'all' || (f === 'photo' ? pics(e).length > 0 : e.type === f)) && (!q || matches(e, q)); }).sort(function (a, b) { return a.time < b.time ? 1 : -1; });
    var byDay = {}; es.forEach(function (e) { (byDay[e.day] = byDay[e.day] || []).push(e); });
    var days = Object.keys(byDay).sort().reverse(), un = {}; daysOf().forEach(function (d) { un[d.day] = d.unshipped; });
    main.innerHTML = '<div class="findbar"><button type="button" class="icon" data-act="back" aria-label="Back to days"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><input type="search" id="find-all" placeholder="Search everything you’ve logged" value="' + esc(S.findAll) + '" aria-label="Search every day"></div>' +
      '<div class="filters">' + [['all', 'All'], ['photo', 'Photos'], ['note', 'Notes'], ['flowon', 'Clashes'], ['action', 'Actions'], ['itp', 'ITP']].map(function (x) { return '<button type="button" data-filter="' + x[0] + '"' + (f === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="scroll"><div class="pad" style="gap:0">' + (q || f !== 'all' ? '<div class="kick" style="padding-bottom:6px">' + es.length + ' line' + (es.length === 1 ? '' : 's') + ' on ' + days.length + ' day' + (days.length === 1 ? '' : 's') + '</div>' : '') +
      days.map(function (d) {
        return '<div class="res-day">' + (d === today() ? 'Today · ' : '') + esc(dayLabel(d)) + (un[d] && d !== today() ? ' <span class="tag" style="color:var(--flow-ink)">Not shipped</span>' : '') + '</div>' + byDay[d].map(function (e) {
          var dot = e.type === 'flowon' ? 'dot-f' : e.type === 'action' ? 'dot-a' : e.type === 'itp' ? 'dot-i' : 'dot-n', hlq = q && q.charAt(0) !== '@' ? q : '';
          var mk = function (s) { s = esc(s); if (!hlq) return s; return s.replace(new RegExp('(' + esc(hlq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + ')', 'ig'), '<mark>$1</mark>'); };
          var where = e.itp ? (e.area ? e.area + ' · ' : '') + e.itp : e.area || e.tag || '';
          return '<button type="button" class="res" data-jump="' + esc(e.id) + '"><span class="tm">' + hm(e.time) + '</span><span style="display:flex;flex-direction:column;gap:3px"><span style="font-size:15px"><span class="' + dot + '">●</span> ' + mk(e.text) + (e.action ? ' <b>→ ' + mk(e.action) + '</b>' : '') + (e.who ? ' @' + esc(e.who) : '') + '</span>' + (where || pics(e).length ? '<span class="e-m">' + esc(where) + (pics(e).length ? (where ? ' · ' : '') + '▣ ' + pics(e).length + ' photo' + (pics(e).length === 1 ? '' : 's') : '') + '</span>' : '') + '</span></button>';
        }).join('');
      }).join('') + (!days.length ? '<div class="empty">' + (q ? 'Nothing matches “' + esc(S.findAll) + '”.' : 'Type to search every day. <b>clashes</b>, <b>actions</b> or <b>@NH</b> work too.') + '</div>' : '') + '</div></div>';
    sync();
    var fa = $('find-all'); fa.oninput = function () { S.findAll = fa.value; var pos = fa.selectionStart; renderFindAll(); var f2 = $('find-all'); f2.focus(); f2.setSelectionRange(pos, pos); };
    if (!S.findAll) fa.focus();
  }

  // ---------- your actions, from BTC (2.8) ----------
  // BTC (Actions) locks each person's open actions and chases with the team password and puts them in the private
  // GitHub repo darathny-Bit/btc-drop (packs/<job hash>/<initials>.btcpack). The phone reads yours with the key and
  // unlocks it (PBKDF2-SHA256 → AES-256-GCM, the same code as BTC's, kept in step by hand). The key and password stay on
  // this phone (kv 'packs'); the last pack is kept for no signal. A tick goes back in the next ship (actionsDone).
  var PACK_REPO = 'darathny-Bit/btc-drop';
  function unb64(t) { var s2 = atob(t), a = new Uint8Array(s2.length); for (var i = 0; i < s2.length; i++) a[i] = s2.charCodeAt(i); return a; }
  async function sha256hex(text) { var h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.prototype.map.call(new Uint8Array(h), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  async function packUnlock(text, pass) {
    var j = JSON.parse(text);
    if (!j || j.btcpack !== 1) throw new Error('That isn’t a BTC pack.');
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(j.salt), iterations: j.iter || 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    try { return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(j.iv) }, key, unb64(j.data)))); }
    catch (e) { throw new Error('The team password doesn’t open it. Check it in ⋮ › Your actions.'); }
  }
  // ---------- shipping through btc-drop (2.10) ----------
  // Ship and Close Day lock the day with the team password (packLock: the same crypto as BTC's, kept in step by hand) and
  // put it in btc-drop at inbox/<job hash>/<file>.lock; BTC (Actions) takes it in, files it like the BTC Inbox and removes
  // it. No key, no password, no signal, or GitHub says no: the email/share way, as before.
  function b64(buf) { var s2 = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i += 0x8000) s2 += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s2); }
  async function packLock(obj, pass) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    var data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    return JSON.stringify({ btcpack: 1, kdf: 'PBKDF2-SHA256', iter: 310000, salt: b64(salt), iv: b64(iv), data: b64(data) });
  }
  async function dropSend(body, name) {
    var cfg = S.packCfg || (await kvGet('packs')) || {};
    if (!cfg.key || !cfg.pass || S.proj.demo) return false;
    if (!navigator.onLine) throw new Error('no signal');
    var job = (await sha256hex('btc-job:' + S.proj.project.id)).slice(0, 16), locked = await packLock(body, cfg.pass);
    var r = await fetch('https://api.github.com/repos/' + PACK_REPO + '/contents/inbox/' + job + '/' + encodeURIComponent(name) + '.lock', { method: 'PUT', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + cfg.key, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ship', content: b64(new TextEncoder().encode(locked)) }) });
    if (r.status === 401) throw new Error('GitHub turned the key down');
    if (r.status === 403 || r.status === 404) throw new Error('the key can’t write to btc-drop (it needs Contents: read and write)');
    if (!r.ok) throw new Error('GitHub answered ' + r.status);
    return true;
  }
  async function packsLoad(quiet) {
    await projSync(false);   // the job itself first (2.14): new, or newer
    if (!S.proj || S.proj.demo || !S.me) return;
    var cfg = (await kvGet('packs')) || {}; S.packCfg = cfg;
    if (!S.pack) S.pack = (await kvGet('pack:' + S.proj.project.id)) || null;
    S.packDone = (await kvGet('packDone:' + S.proj.project.id)) || [];
    S.packSeen = (await kvGet('packSeen:' + S.proj.project.id)) || [];
    syncSoon(2000);   // anything left from no signal goes now
    if (!cfg.key || !cfg.pass || !navigator.onLine) { if (S.view === 'days') renderDays(); return; }
    try {
      var job = (await sha256hex('btc-job:' + S.proj.project.id)).slice(0, 16);
      var r = await fetch('https://api.github.com/repos/' + PACK_REPO + '/contents/packs/' + job + '/' + encodeURIComponent(S.me.handle) + '.btcpack', { headers: { Authorization: 'Bearer ' + cfg.key, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' });
      if (r.status === 404) throw new Error('No actions from BTC yet for @' + S.me.handle + ' (BTC sends them once Phone packs is set up there).');
      if (r.status === 401) throw new Error('GitHub turned the key down (expired or cancelled?).');
      if (!r.ok) throw new Error('GitHub answered ' + r.status + '.');
      var pk = await packUnlock(await r.text(), cfg.pass);
      S.pack = pk; S.packErr = ''; await kvSet('pack:' + S.proj.project.id, pk);
      // a tick BTC has now closed drops out of the to-send list
      var open = {}; (pk.actions || []).forEach(function (a) { open[a.id] = 1; });
      var keep = S.packDone.filter(function (d) { return !d.sent || open[d.id]; }); if (keep.length !== S.packDone.length) { S.packDone = keep; await kvSet('packDone:' + S.proj.project.id, keep); }
    } catch (e) { S.packErr = (e && e.message) || 'No signal'; if (!quiet) toast(S.packErr, true); }
    if (S.view === 'days') renderDays();
  }
  function packList() { var done = {}; (S.packDone || []).forEach(function (d) { done[d.id] = 1; }); return ((S.pack && S.pack.actions) || []).filter(function (a) { return !done[a.id]; }); }
  // Ageing and NEW (2.12, the same as BTC's board): purple when given, brown at 7 days; NEW glows until it's been on screen for 2 seconds
  function ageOf(a) { var g = a.given ? (Date.now() - new Date(a.given)) / 864e5 : 0; return isNaN(g) ? 0 : Math.max(0, Math.min(1, g / 7)); }
  function isFresh(a) { if (!a.fresh || !a.fresh.at || Date.now() - new Date(a.fresh.at) > 12 * 36e5) return false; return !(S.packSeen || []).some(function (s) { return s.id === a.id && s.at >= a.fresh.at; }); }
  var seenObs = null, seenT = {};
  function watchSeen() {
    if (seenObs) seenObs.disconnect(); if (!window.IntersectionObserver) return;
    seenObs = new IntersectionObserver(function (es) { es.forEach(function (en) {
      var id = en.target.dataset.pid;
      if (en.isIntersecting && en.intersectionRatio >= 0.6) { if (!seenT[id]) seenT[id] = setTimeout(function () { seenT[id] = null; markSeen(id, en.target); }, 2000); }
      else { clearTimeout(seenT[id]); seenT[id] = null; }
    }); }, { threshold: [0, 0.6, 1] });
    document.querySelectorAll('.pa-sw.fresh').forEach(function (el) { if (document.visibilityState === 'visible') seenObs.observe(el); });
  }
  async function markSeen(id, el) {
    if (document.visibilityState !== 'visible' || !S.proj) return;
    var a = ((S.pack && S.pack.actions) || []).filter(function (x) { return x.id === id; })[0]; if (!a || !isFresh(a)) return;
    S.packSeen = (S.packSeen || []).filter(function (s) { return s.id !== id; }).concat([{ id: id, file: a.file || '', at: new Date().toISOString() }]);
    await kvSet('packSeen:' + S.proj.project.id, S.packSeen);
    if (el) { el.classList.remove('fresh'); el.classList.add('unglow'); }   // the glow comes off where it is; no redraw, no jump
    syncSoon(1500);
  }
  // Actions sync straight away (2.12): new action lines, done, passed on and seen go to BTC through btc-drop on their own, a
  // few seconds after (Undo first). Tiny files: no photos (an action line's photos go with Close Day), no notes, no weather.
  var syncT = null, syncBusy = false;
  function syncSoon(ms) { clearTimeout(syncT); syncT = setTimeout(syncActions, ms || 6500); }
  async function syncActions() {
    if (syncBusy || !S.proj || S.proj.demo || !S.me) return;
    var cfg = S.packCfg || (await kvGet('packs')) || {}; if (!cfg.key || !cfg.pass || !navigator.onLine) return;
    var old = function (iso) { return Date.now() - new Date(iso) > 6000; }, later = false;
    var acts = S.entries.filter(function (e) { if (e.type !== 'action' || e.shipped || e.synced) return false; if (!old(e.amendedAt || e.time)) { later = true; return false; } return true; });
    var dn = (S.packDone || []).filter(function (d) { if (d.sent) return false; if (!old(d.at)) { later = true; return false; } return true; });
    var sn = (S.packSeen || []).filter(function (s) { return !s.sent; });
    if (later) syncSoon(3000);
    if (!acts.length && !dn.length && !sn.length) return;
    var body = { format: FORMAT, v: 1, kind: 'actions', project: { id: S.proj.project.id, code: S.proj.project.code, name: S.proj.project.name }, shippedBy: { name: S.me.name, handle: S.me.handle }, shippedAt: new Date().toISOString(), app: 'BTC Walk ' + VERSION,
      walks: [], removed: [], closures: [],
      entries: acts.map(function (e) { return { id: e.id, day: e.day, time: e.time, type: e.type, raw: e.raw, text: e.text, action: e.action, who: e.who, party: e.party || '', dir: e.dir || '', area: e.area, itp: e.itp, line: e.line || '', tag: e.tag, location: e.location, priority: e.priority, due: e.due, photos: [], edited: e.edited, was: e.was, amendedAt: e.amendedAt }; }) };
    var d1 = dn.filter(function (d) { return !d.to; }), d2 = dn.filter(function (d) { return d.to; });
    if (d1.length) body.actionsDone = d1.map(function (d) { return { id: d.id, file: d.file, at: d.at }; });
    if (d2.length) body.actionsPassed = d2.map(function (d) { return { id: d.id, file: d.file, at: d.at, to: d.to }; });
    if (sn.length) body.actionsSeen = sn.map(function (s) { return { id: s.id, file: s.file, at: s.at }; });
    var n = new Date(), name = (S.proj.project.code || 'BTC').replace(/[^A-Za-z0-9]+/g, '') + '_' + S.me.handle + '_' + today() + '_' + String(n.getHours()).padStart(2, '0') + String(n.getMinutes()).padStart(2, '0') + String(n.getSeconds()).padStart(2, '0') + '_actions.btcwalk.txt';
    syncBusy = true;
    try {
      if (!(await dropSend(body, name))) return;
      var at = new Date().toISOString(), ids = {}; dn.forEach(function (d) { ids[d.id + '|' + d.at] = 1; });
      for (var i = 0; i < acts.length; i++) { acts[i].synced = at; await putEntry(acts[i]); }
      S.packDone = (S.packDone || []).map(function (d) { return ids[d.id + '|' + d.at] ? Object.assign({}, d, { sent: at }) : d; }); await kvSet('packDone:' + S.proj.project.id, S.packDone);
      var sids = {}; sn.forEach(function (s) { sids[s.id + '|' + s.at] = 1; });
      S.packSeen = (S.packSeen || []).map(function (s) { return sids[s.id + '|' + s.at] ? Object.assign({}, s, { sent: at }) : s; }); await kvSet('packSeen:' + S.proj.project.id, S.packSeen);
      S.syncedAt = at; if (S.view === 'days' && (acts.length || dn.length)) renderDays();
    } catch (e) { /* no signal or GitHub said no: it goes with the next try or the next ship */ }
    finally { syncBusy = false; }
  }
  window.addEventListener('online', function () { syncSoon(1000); });

  // Done or passed on, on site (2.8; pass on 2.11): off the list now, to BTC with the next ship; Undo for 6 seconds puts it back
  async function packMark(pid, to) {
    var a = ((S.pack && S.pack.actions) || []).filter(function (x) { return x.id === pid; })[0]; if (!a) return;
    var who = to ? (S.proj.people || []).filter(function (p) { return p.handle === to; })[0] : null;
    S.packDone = (S.packDone || []).concat([Object.assign({ id: pid, file: a.file || '', at: new Date().toISOString() }, to ? { to: to } : {})]);
    await kvSet('packDone:' + S.proj.project.id, S.packDone); buzz(to ? [8, 40, 8] : 10); renderDays(); syncSoon(6500);
    toast(to ? 'Passed on to ' + (who ? who.name.split(' ')[0] : '@' + to) : 'Done', false, { label: 'Undo', ms: 6000, fn: async function () { S.packDone = S.packDone.filter(function (d) { return d.id !== pid || d.sent; }); await kvSet('packDone:' + S.proj.project.id, S.packDone); renderDays(); } });
  }
  function passSheet(pid) {
    var a = ((S.pack && S.pack.actions) || []).filter(function (x) { return x.id === pid; })[0]; if (!a) return;
    var ps = (S.proj.people || []).filter(function (p) { return p.team !== false && !(S.me && p.handle === S.me.handle); });
    S.passFor = pid;
    sheet('<div class="grip"></div><h2>Pass on</h2><p>' + esc(a.title) + '</p><div class="list">' + ps.map(function (p) { return '<button type="button" data-passto="' + esc(p.handle) + '"><span class="lt"><b>' + esc(p.name) + '</b><span>' + esc(p.role || '@' + p.handle) + '</span></span></button>'; }).join('') + '</div>' +
      '<button type="button" class="btn" data-act="closesheet" style="width:100%;margin-top:10px">Cancel</button>');
  }
  // Swipe a row (2.11): right is done, left is pass on. Past a third of the row (or a quick flick) it goes; short of it, it springs back.
  (function () {
    var sw = null;
    document.addEventListener('pointerdown', function (e) {
      var w = e.target.closest && e.target.closest('.pa-sw'); if (!w || e.target.closest('.pa-tick') || e.button > 0) return;
      sw = { w: w, row: w.querySelector('.pa'), x: e.clientX, y: e.clientY, t: Date.now(), dx: 0, on: false, id: e.pointerId };
    });
    document.addEventListener('pointermove', function (e) {
      if (!sw || e.pointerId !== sw.id) return;
      var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (!sw.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; } if (Math.abs(dx) < 10) return; sw.on = true; sw.row.style.transition = 'none'; try { sw.w.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } }
      sw.dx = dx; sw.row.style.transform = 'translateX(' + dx + 'px)'; sw.w.dataset.dir = dx > 0 ? 'done' : 'pass';
      sw.w.classList.toggle('go', Math.abs(dx) > sw.w.offsetWidth / 3);
    });
    var end = function (e) {
      if (!sw || (e && e.pointerId !== sw.id)) return;
      var s = sw; sw = null; if (!s.on) return;
      var far = Math.abs(s.dx) > s.w.offsetWidth / 3 || (Math.abs(s.dx) > 60 && Date.now() - s.t < 250);
      s.row.style.transition = '';
      if (far && s.dx > 0) { s.row.style.transform = 'translateX(110%)'; setTimeout(function () { packMark(s.w.dataset.pid); }, MOTION ? 160 : 0); }
      else { s.row.style.transform = ''; s.w.classList.remove('go'); if (far) passSheet(s.w.dataset.pid); }
    };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', function () { if (sw) { sw.row.style.transition = ''; sw.row.style.transform = ''; sw.w.classList.remove('go'); sw = null; } });
  })();
  function packHtml() {
    if (!S.pack && !S.packErr) return '';
    var t = today(), list = packList(), late = list.filter(function (a) { return a.due && a.due < t; }).length;
    list = list.slice().sort(function (a, b) { return (isFresh(b) ? 1 : 0) - (isFresh(a) ? 1 : 0); });   // NEW on top (2.12)
    var show = S.packAll ? list : list.slice(0, 4);
    // Quiet cards (2.13): plain tiles like the rest of the app; age is a small dot and a day count, NEW a thin violet edge
    var dueOf = function (a) {
      if (!a.due) return { txt: '', cls: '' };
      if (a.due < t) return { txt: Math.round((dayDate(t) - dayDate(a.due)) / 864e5) + 'd late', cls: ' late' };
      if (a.due === t) return { txt: 'today', cls: ' today' };
      var d = dayDate(a.due); return { txt: d.toLocaleDateString('en-NZ', { weekday: 'short' }) + ' ' + d.getDate(), cls: '' };
    };
    var ago = function (iso) { var m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? m + ' min' : Math.round(m / 60) + ' h'; };
    var row = function (a) {
      var nw = isFresh(a), ag = ageOf(a), days = a.given ? Math.max(0, Math.floor((Date.now() - new Date(a.given)) / 864e5)) : 0, du = dueOf(a);
      var giver = nw ? (S.proj.people || []).filter(function (p) { return p.handle === a.fresh.by; })[0] : null, gname = giver ? giver.name.split(' ')[0] : a.fresh && a.fresh.by ? '@' + a.fresh.by : '';
      var meta = [a.kind === 'chase' ? '↗ chase ' + esc(a.waitingOn) : a.raisedBy ? '↙ from ' + esc(a.raisedBy) : '', a.with && a.with.length ? 'with ' + esc(a.with.map(function (x) { return '@' + x; }).join(' ')) : '', a.ref ? esc(a.ref) : ''].filter(Boolean).join(' · ');
      return '<div class="pa-sw' + (nw ? ' fresh' : '') + '" data-pid="' + esc(a.id) + '"><div class="pa-bg"><span class="pa-bd">✓ Done</span><span class="pa-bp">Pass on ⇢</span></div><div class="pa" style="--age:' + ag.toFixed(2) + '">' +
        (nw ? '<div class="pa-new"><i></i>' + (a.fresh.nudge ? 'Nudged by ' : 'New from ') + esc(gname) + ' · ' + ago(a.fresh.at) + '</div>' : '') +
        '<div class="pa-t"><b>' + (a.prio === 1 ? '<i class="pa-p">P1</i>' : '') + esc(a.title) + '</b>' + (du.txt ? '<span class="pa-due' + du.cls + '">' + du.txt + '</span>' : '') + '</div>' +
        '<div class="pa-m' + (meta ? '' : ' bare') + '"><span>' + meta + '</span>' + '<span class="pa-age"><i></i>' + days + 'd</span>' + '</div></div></div>';
    };
    return '<div class="sec">Your actions' + (list.length ? ' · ' + list.length + (late ? ' · <span class="pa-late">' + late + ' late</span>' : '') : '') + '</div>' +
      (S.packErr && !S.pack ? '<div class="bar-warn">' + esc(S.packErr) + '</div>' : '') +
      (list.length ? '<div class="pas">' + show.map(row).join('') + (list.length > 4 ? '<button type="button" class="pa-more" data-act="packall">' + (S.packAll ? 'Show fewer' : 'All ' + list.length) + '</button>' : '') + '</div>' : S.pack ? '<div class="allclear"><div><b>Nothing open</b><span>No actions or chases for you in BTC.</span></div></div>' : '') +
      (list.length ? '<div class="pa-hint">Swipe right: done · left: pass on</div>' : '') +
      (function () { var w = (S.packDone || []).filter(function (d) { return !d.sent; }), nd = w.filter(function (d) { return !d.to; }).length, np = w.length - nd;
        return w.length ? '<div class="bar-info">' + [nd ? nd + ' done' : '', np ? np + ' passed on' : ''].filter(Boolean).join(', ') + ' here · ' + ((S.packCfg || {}).key ? 'goes to BTC as soon as there’s signal' : 'goes to BTC with your next ship') + '</div>' : ''; })();
  }
  function packsSettings() {
    var c = S.packCfg || {};
    sheet('<div class="grip"></div><h2>' + (S.proj && S.proj.demo ? 'Connect to BTC' : 'Your actions') + '</h2><p>Your job, your open actions and chases come from BTC by themselves, locked with the team password. Get the key and the password from whoever set up Phone packs in BTC (once).</p>' +
      '<div class="list"><label class="fld"><span>GitHub key</span><input type="password" id="pk-key" autocomplete="off" placeholder="' + (c.key ? '•••• saved' : 'github_pat_…') + '"></label>' +
      '<label class="fld"><span>Team password</span><input type="text" id="pk-pass" autocomplete="off" autocapitalize="off" value="' + esc(c.pass || '') + '" placeholder="four words"></label></div>' +
      (S.packErr ? '<p class="small" style="color:var(--flow)">' + esc(S.packErr) + '</p>' : S.pack ? '<p class="small">Last from BTC ' + esc(dayLabel((S.pack.made || '').slice(0, 10))) + ' ' + hm(S.pack.made) + '.</p>' : '') +
      '<button type="button" class="btn primary" data-act="pksave" style="min-height:52px">Save</button>');
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
        '<div class="list">' + ds.map(function (d) { var cc = counts(d.entries); return '<label><input type="checkbox" data-pick="' + d.day + '"' + (S.shipPick[d.day] ? ' checked' : '') + '><span class="lt"><b>' + (d.day === today() ? 'Today · ' : '') + esc(dayLabel(d.day)) + (d.wxOnly ? ' <span class="tag" style="color:var(--note)">WEATHER TO SEND</span>' : '') + (d.changed ? ' <span class="tag" style="color:var(--flow)">CHANGED</span>' : d.day < today() ? ' <span class="tag" style="color:var(--flow)">NOT SHIPPED</span>' : '') + '</b><span>' + d.entries.length + ' entr' + (d.entries.length === 1 ? 'y' : 'ies') + (cc.photo ? ' · ' + cc.photo + ' photo' + (cc.photo > 1 ? 's' : '') : '') + (d.gone ? ' · ' + d.gone + ' deleted' : '') + '</span></span></label>'; }).join('') + '</div>' +
        '<div class="tiles"><div class="tile n"><b>' + c.note + '</b><span>notes</span></div><div class="tile f"><b>' + c.flowon + '</b><span>clashes</span></div><div class="tile a"><b>' + c.action + '</b><span>actions</span></div>' + (c.itp ? '<div class="tile i"><b>' + c.itp + '</b><span>ITP</span></div>' : '') + '</div>' +
        (noAct.length ? '<button type="button" class="bar-warn" data-fix="' + esc(noAct[0].id) + '" style="text-align:left">' + (noAct.length === 1 ? '1 clash has' : noAct.length + ' clashes have') + ' no action yet: <b>' + esc(noAct[0].text) + '</b><span style="margin-left:auto;color:var(--flow);font-weight:700;padding-right:8px">Fix ›</span></button>' : '') +
        '<button type="button" class="btn primary" data-act="doship"' + (pick.length ? '' : ' disabled') + ' style="min-height:56px;font-size:17px">Ship to Outlook</button>' +
        '<span class="fname">' + esc(fileName(pick)) + ' · ' + (mb < 0.1 ? '<0.1' : mb.toFixed(1)) + ' MB</span>');
      $('sheet').querySelectorAll('[data-pick]').forEach(function (cb) { cb.onchange = function () { S.shipPick[cb.dataset.pick] = cb.checked; draw(); }; });
    };
    draw();
  }
  // The ship moment (2.0): a tick that draws itself, and where everything goes.
  function shippedSheet(pick, es) {
    var c = counts(es), ev = es.filter(function (e) { return e.type === 'itp'; }), evp = 0; ev.forEach(function (e) { evp += pics(e).length; });
    var lines = ev.filter(function (e) { return e.itp && e.line; }).map(function (e) { return e.itp + ' ' + e.line; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var who = {}; es.forEach(function (e) { if (e.type === 'action') String(e.who || 'you').split(/\s+/).forEach(function (h) { who[S.me && h === S.me.handle ? 'you' : h] = 1; }); });
    var row = function (col, label, sub, n) { return n ? '<div><span class="dotl" style="background:' + col + '"></span><span class="lt"><b>' + label + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span><span class="rv">' + n + '</span></div>' : ''; };
    sheet('<div class="grip"></div><div class="shipped"><div class="tickc"><svg width="54" height="54" viewBox="0 0 52 52" role="img" aria-label="Shipped"><circle class="ring-d" cx="26" cy="26" r="23" fill="none" stroke="#D4FF3A" stroke-width="3"/><path class="tick-d" d="M15 27l7 7 15-16" fill="none" stroke="#D4FF3A" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<h2>' + (S.justClosed ? 'Day closed' : 'Shipped') + '</h2><p>' + (S.sentDirect ? '<b>Sent straight to BTC.</b> ' : '') + (S.justClosed ? 'Signed and on the way to BTC' + (S.justClosed.reviewer ? ', where ' + esc(S.justClosed.reviewer) + ' gets it to review and sign' : '') + '.<br>' : '') + (pick.length === 1 ? (pick[0].day === today() ? 'Today' : esc(dayLabel(pick[0].day))) + ' is' : pick.length + ' days are') + ' on the way to BTC.<br>It lands in your diary on the PC, and stays on this phone too.</p></div>' +
      '<div class="list">' + row('var(--note)', 'Notes', '', c.note) + row('var(--itp)', 'ITP evidence', evp ? evp + ' photo' + (evp === 1 ? '' : 's') + (lines.length ? ' → ' + lines.slice(0, 2).join(', ') + (lines.length > 2 ? '…' : '') : ' to sort on the PC') : '', c.itp) +
      row('var(--flow)', 'Clashes', 'to Build’s register', c.flowon) + row('var(--act)', 'Actions', 'cards for ' + Object.keys(who).join(', '), c.action) + '</div>' +
      '<button type="button" class="btn primary" data-act="closesheet" style="min-height:54px">Done</button>');
  }
  function fileName(pick) {
    var days = pick.map(function (d) { return d.day; }).sort(), code = (S.proj.project.code || 'BTC').replace(/[^A-Za-z0-9]+/g, '');
    var n = new Date(), hhmm = String(n.getHours()).padStart(2, '0') + String(n.getMinutes()).padStart(2, '0');   // the time (1.7): each ship its own file
    return code + '_' + (S.me ? S.me.handle : 'X') + '_' + (days[days.length - 1] || today()) + (days.length > 1 ? '_' + days.length + 'days' : '') + '_' + hhmm + '.btcwalk.txt';
  }
  async function doShip() {
    var CL = S.closeReq || null;
    var pick = daysOf().filter(function (d) { return (d.unshipped || (CL && d.day === CL.date)) && S.shipPick && S.shipPick[d.day]; });
    if (!pick.length) return;
    var es = [], pickDays = {}; pick.forEach(function (d) { es = es.concat(d.entries); pickDays[d.day] = true; });
    var gone = (S.gone || []).filter(function (g) { return pickDays[g.day]; });
    var body = { format: FORMAT, v: 1, project: { id: S.proj.project.id, code: S.proj.project.code, name: S.proj.project.name }, shippedBy: { name: S.me ? S.me.name : '', handle: S.me ? S.me.handle : '' }, shippedAt: new Date().toISOString(), app: 'BTC Walk ' + VERSION,
      walks: [], entries: es.map(function (e) { return { id: e.id, day: e.day, time: e.time, type: e.type, raw: e.raw, text: e.text, action: e.action, who: e.who, party: e.party || '', dir: e.dir || '', area: e.area, itp: e.itp, line: e.line || '', tag: e.tag, location: e.location, priority: e.priority, due: e.due, photos: pics(e), photo: pics(e)[0] || '', edited: e.edited, wx: e.wx, crew: e.crew, lost: e.lost, was: e.was, wasType: e.wasType, amendedAt: e.amendedAt }; }), removed: gone.map(function (g) { return { id: g.id, day: g.day }; }), closures: [] };
    // .btcwalk.txt as plain text (1.4.1): Android's share sheet refuses file types it doesn't know ("Permission denied"),
    // and plain text is one it always takes. BTC reads .btcwalk and .btcwalk.txt alike.
    var wx = {}; for (var wi = 0; wi < pick.length; wi++) { var fc = await wxForecast(pick[wi].day), st0 = await wxStart(pick[wi].day); if (fc || st0) wx[pick[wi].day] = Object.assign({}, fc || { day: pick[wi].day, source: 'MET Norway', hours: {} }, st0 ? { start: st0 } : {}); }
    if (Object.keys(wx).length) body.weather = wx;
    if (CL) body.close = { date: CL.date, at: CL.at, sig: CL.sig, title: CL.title, reviewer: CL.reviewer };   // Close the day (2.9): signed here
    var dn = (S.packDone || []).filter(function (d) { return !d.sent; }); if (dn.some(function (d) { return !d.to; })) body.actionsDone = dn.filter(function (d) { return !d.to; }).map(function (d) { return { id: d.id, file: d.file, at: d.at }; });   // ticked on site (2.8)
    if (dn.some(function (d) { return d.to; })) body.actionsPassed = dn.filter(function (d) { return d.to; }).map(function (d) { return { id: d.id, file: d.file, at: d.at, to: d.to }; });   // swiped left, passed on (2.11)
    var np2 = (S.newParties || []).filter(function (x) { return !(S.proj.parties || []).some(function (y) { return key(y.name) === key(x.name); }); });
    if (np2.length) body.parties = np2.map(function (x) { return { name: x.name, role: x.role || '', contact: x.contact || '' }; });   // new to BTC (2.4)   // the forecast BTC needs to draw the job's weather (2.1); logged weather goes as lines
    var name = fileName(pick), file = new File([JSON.stringify(body)], name, { type: 'text/plain' });
    var save = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    var shared = false;
    try { if (await dropSend(body, name)) shared = 'drop'; }
    catch (e0) { toast('Couldn’t send straight to BTC (' + e0.message + '): use email instead.', true); }
    if (!shared) try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name, text: (S.proj.project.name || '') + ' · site diary from BTC Walk' }); shared = true; }
      else { save(); shared = 'saved'; }
    } catch (e) {
      if (e && e.name === 'AbortError') { toast('Not shipped.'); return; }
      // the phone wouldn't open the share sheet: save it instead, so the day isn't stuck
      try { save(); } catch (e2) { toast('Could not ship: ' + e.message, true); return; }
      shared = 'saved';
    }
    if (!shared) return;
    var at = new Date().toISOString();
    if (CL) { S.closed = Object.assign({}, S.closed || {}); S.closed[CL.date] = CL.at; await kvSet('closed:' + S.proj.project.id, S.closed); if (CL.reviewer) await kvSet('reviewer:' + S.proj.project.id, CL.reviewer); S.closeReq = null; }
    for (var i = 0; i < es.length; i++) { es[i].shipped = true; es[i].shippedAt = at; await putEntry(es[i]); }
    for (var wd in wx) await kvSet('wxsent:' + S.proj.project.id + ':' + wd, wx[wd].at || at);   // BTC has this day's weather now (2.7)
    if (dn.length) { S.packDone = (S.packDone || []).map(function (d) { return d.sent ? d : Object.assign({}, d, { sent: at }); }); await kvSet('packDone:' + S.proj.project.id, S.packDone); }
    await wxRecalc();
    if (gone.length) { S.gone = (S.gone || []).filter(function (g) { return !pickDays[g.day]; }); await kvSet('gone:' + S.proj.project.id, S.gone); }
    S.shipPick = null; buzz([12, 60, 12]); S.view = 'days'; render();
    if (shared === 'saved') { closeSheet(); toast('The phone wouldn’t share it, so it’s in Downloads: attach ' + name + ' to an email to ship it.', true); return; }
    S.sentDirect = shared === 'drop'; shippedSheet(pick, es); S.justClosed = null;
  }


  // ---------- close the day (2.9): see the page, sign it, pick a reviewer, send ----------
  // The signature stays on this phone (kv 'sig'); a copy goes with the day it signs. Draw it with a finger, or take a
  // photo of it on paper: the paper turns clear and it's cropped to the ink (the same as BTC's team signatures).
  function myPerson() { return (S.proj.people || []).filter(function (p) { return S.me && p.handle === S.me.handle; })[0] || {}; }
  async function closeDaySheet(day) {
    day = day || today();
    var last = (await kvGet('reviewer:' + S.proj.project.id)) || '', ps = (S.proj.people || []).filter(function (p) { return p.team !== false && !(S.me && p.handle === S.me.handle); });
    var es = S.entries.filter(function (e) { return e.day === day && e.type !== 'weather'; }), c = counts(es), role = myPerson().role || '';
    sheet('<div class="grip"></div><h2>Close Day</h2><p>' + esc(dayLabel(day)) + ' · ' + es.length + ' line' + (es.length === 1 ? '' : 's') + (c.photo ? ' · ' + c.photo + ' photo' + (c.photo === 1 ? '' : 's') : '') + '</p>' +
      '<div class="list"><button type="button" data-act="closeprev" data-v="' + day + '"><span class="lt"><b>See the page</b><span>The day as it prints, weather on top</span></span></button></div>' +
      '<div class="sigrow">' + (S.sig ? '<img src="' + S.sig + '" alt="Your signature">' : '<span class="nosig">No signature yet</span>') + '<span class="lt"><b>' + esc(S.me ? S.me.name : '') + '</b><span>' + esc(role || 'Prepared by') + '</span></span><button type="button" class="btn" data-act="sigset" style="min-height:40px">' + (S.sig ? 'Change' : 'Add') + '</button></div>' +
      '<label class="fld"><span>Reviewer</span><select id="cl-rev"><option value="">Nobody, just sign</option>' + ps.map(function (p) { return '<option value="' + esc(p.handle) + '"' + (p.handle === last ? ' selected' : '') + '>' + esc(p.name + (p.role ? ' · ' + p.role : '')) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="btn primary" data-act="doclose" data-v="' + day + '" style="min-height:56px;font-size:17px"' + (S.sig ? '' : ' disabled') + '>Sign and Close Day</button>');
  }
  async function doClose(day) {
    if (!S.sig) { sigSheet(); return; }
    var sel = $('cl-rev'), rv = sel ? sel.value : '', rp = (S.proj.people || []).filter(function (p) { return p.handle === rv; })[0];
    S.closeReq = { date: day, at: new Date().toISOString(), sig: S.sig, title: myPerson().role || '', reviewer: rv };
    S.justClosed = { reviewer: rp ? rp.name : '' };
    S.shipPick = {}; daysOf().forEach(function (d) { if (d.unshipped || d.day === day) S.shipPick[d.day] = true; });
    await doShip();
    if (S.closeReq) { S.closeReq = null; S.justClosed = null; }   // not sent: nothing changes
  }
  function sigSheet() {
    sheet('<div class="grip"></div><h2>Your signature</h2><p>Kept on this phone. It goes on a day only when you close it.</p>' +
      (S.sig ? '<div class="sigrow"><img src="' + S.sig + '" alt="Your signature"><span class="lt"><b>Your signature now</b></span></div>' : '') +
      '<canvas id="sig-pad" width="900" height="300" class="sigpad" aria-label="Draw your signature here"></canvas>' +
      '<div class="row2"><button type="button" class="btn" data-act="sigclear">Clear</button><button type="button" class="btn" data-act="sigphoto">Photo of it on paper</button></div>' +
      '<input type="file" accept="image/*" capture="environment" id="sig-in" hidden>' +
      '<button type="button" class="btn primary" data-act="sigsave" style="min-height:54px">Use what I drew</button>');
    var cv = $('sig-pad'), x = cv.getContext('2d'), down = false, last = null; S.sigInked = false;
    x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#142050';
    var at = function (e) { var b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
    cv.onpointerdown = function (e) { down = true; last = at(e); cv.setPointerCapture(e.pointerId); e.preventDefault(); };
    cv.onpointermove = function (e) { if (!down) return; var q = at(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(q[0], q[1]); x.stroke(); last = q; S.sigInked = true; };
    cv.onpointerup = cv.onpointercancel = function () { down = false; };
    $('sig-in').onchange = async function () { var f = this.files && this.files[0]; if (!f) return; try { S.sig = await inkFromFile(f); await kvSet('sig', S.sig); toast('Signature saved.'); sigSheet(); } catch (e) { toast(e.message, true); } };
  }
  // keep in step with BTC's topbar.js inkOnly (2.37)
  function inkOnly(c) {
    var x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data, minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (var i = 0; i < d.length; i += 4) {
      var l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2], k = (i / 4);
      if (d[i + 3] < 10 || l > 165) { d[i + 3] = 0; continue; }
      d[i + 3] = Math.min(255, Math.round((165 - l) * 2.2)); d[i] = 20; d[i + 1] = 32; d[i + 2] = 80;
      var px = k % c.width, py = (k - px) / c.width; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    x.putImageData(im, 0, 0);
    if (maxX < 0) throw new Error('No signature found: sign on white paper with a dark pen, and fill the photo with it.');
    var pd = 6, w = Math.min(c.width, maxX - minX + 1 + 2 * pd), h = Math.min(c.height, maxY - minY + 1 + 2 * pd), o = document.createElement('canvas'), k2 = Math.min(1, 600 / w, 200 / h);
    o.width = Math.max(1, Math.round(w * k2)); o.height = Math.max(1, Math.round(h * k2));
    o.getContext('2d').drawImage(c, Math.max(0, minX - pd), Math.max(0, minY - pd), w, h, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  function inkFromFile(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onerror = function () { rej(new Error('That isn’t a picture.')); };
      img.onload = function () { var k = Math.min(1, 1600 / img.width, 1000 / img.height), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); try { res(inkOnly(c)); } catch (e) { rej(e); } };
      img.src = u;
    });
  }

  // ---------- project, you, settings ----------
  async function loadProjectFile(file) {
    var p;
    try { p = JSON.parse(await file.text()); } catch (e) { toast('That isn’t a BTC project file.', true); return; }
    if (!p || p.format !== PFORMAT || !p.project || !p.project.id) { toast('That isn’t a BTC project file (make it in Build: ⋮ › Phone project file…).', true); return; }
    await takeProject(p);
  }
  // The job from btc-drop (2.14): Build sends it locked with the team password to projects/<job hash>.btcpack, so a phone
  // with the key and password loads its job by itself, and keeps it up to date, with no file to email or pick.
  async function takeProject(p, quiet) {
    if (quiet && S.proj && !S.proj.demo && S.proj.project.id === p.project.id) {   // the same job, newer: people, areas, ITPs and clashes update; your days stay
      p.loadedAt = new Date().toISOString(); await kvSet('project', p); S.proj = p; if (S.view === 'days') renderDays(); return;
    }
    p.loadedAt = new Date().toISOString();
    await kvSet('project', p); S.proj = p;
    S.entries = await allEntries(p.project.id); S.newParties = (await kvGet('parties:' + p.project.id)) || []; S.gone = (await kvGet('gone:' + p.project.id)) || [];
    var me = await kvGet('me:' + p.project.id); S.me = me || null; S.loc = null; await kvSet('loc', null);
    closeSheet(); S.view = 'days'; render();
    toast('Loaded ' + p.project.name + (p.made ? ' (from ' + dayLabel(p.made.slice(0, 10)) + ')' : '') + '.');
    if (!S.me) pickMe(); else packsLoad(true);
  }
  async function projSync(manual) {
    var cfg = S.packCfg || (await kvGet('packs')) || {}; if (!cfg.key || !cfg.pass || !navigator.onLine) return;
    if (!manual && S.proj && !S.proj.demo && Date.now() - (S.projAt || 0) < 10 * 60000) return;   // a job already here: look for a newer one every 10 minutes at most
    S.projAt = Date.now();
    var H = { Authorization: 'Bearer ' + cfg.key, 'X-GitHub-Api-Version': '2022-11-28' }, base = 'https://api.github.com/repos/' + PACK_REPO + '/contents/';
    try {
      var r = await fetch(base + 'projects', { headers: Object.assign({ Accept: 'application/vnd.github+json' }, H), cache: 'no-store' });
      if (r.status === 404) { if (manual) toast('No job from BTC yet: in Build, ⋮ › Phone project file… sends it.', true); return; }
      if (!r.ok) return;
      var list = (await r.json()).filter(function (f) { return f.type === 'file' && /\.btcpack$/.test(f.name); }), jobs = [];
      for (var i = 0; i < list.length; i++) {
        try { var rr = await fetch(base + list[i].path, { headers: Object.assign({ Accept: 'application/vnd.github.raw' }, H), cache: 'no-store' }); if (!rr.ok) continue; var p = await packUnlock(await rr.text(), cfg.pass); if (p && p.format === PFORMAT && p.project && p.project.id) jobs.push(p); } catch (e) { /* not ours, or an old password */ }
      }
      if (!jobs.length) { if (manual) toast('No job from BTC opens with this team password.', true); return; }
      var cur = S.proj && !S.proj.demo ? jobs.filter(function (j) { return j.project.id === S.proj.project.id; })[0] : null;
      if (cur) { if ((cur.made || '') > (S.proj.made || '')) await takeProject(cur, true); return; }
      if (S.proj && !S.proj.demo && !manual) return;   // a job loaded by hand that BTC doesn't send: leave it
      if (jobs.length === 1) await takeProject(jobs[0]);
      else { S.jobsFound = jobs; sheet('<div class="grip"></div><h2>Which job?</h2><p>BTC sends these to your team.</p><div class="list">' + jobs.map(function (j, k) { return '<button type="button" data-job="' + k + '"><span class="lt"><b>' + esc(j.project.name) + '</b><span>' + (j.people || []).length + ' people · ' + (j.areas || []).length + ' areas</span></span></button>'; }).join('') + '</div>'); }
    } catch (e) { /* no signal: next time */ }
  }
  // the job's teams (2.15, from the project file): @all-m&e, @all-structures
  function teamByWord(w) { var k = String(w || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); return (S.proj && S.proj.teams || []).filter(function (t) { return t.id === k || String(t.name).toLowerCase().replace(/[^a-z0-9]+/g, '') === k; })[0] || null; }
  function pickMe() {
    var ps = (S.proj.people || []).filter(function (p) { return p.team !== false; });
    sheet('<div class="grip"></div><h2>Who are you?</h2><p>Your days go into your site diary in BTC. Pick yourself once on this phone.</p><div class="list">' +
      ps.map(function (p) { return '<button type="button" data-me="' + esc(p.handle) + '"><span class="lt"><b>' + esc(p.name) + '</b><span class="mono">@' + esc(p.handle) + '</span></span>' + (S.me && S.me.handle === p.handle ? '<span class="tag live">YOU</span>' : '') + '</button>'; }).join('') + '</div>');
  }
  function settings() {
    var p = S.proj, made = p.made ? dayLabel(p.made.slice(0, 10)) : '', n = S.entries.length;
    sheet('<div class="grip"></div><h2>' + esc(p.project.name) + '</h2>' +
      '<div class="list">' + (p.demo ? '<button type="button" data-act="pkset"><span class="lt"><b>Connect to BTC</b><span>The key and team password: your job and your actions come by themselves</span></span></button>' : '') + '<button type="button" data-act="load"><span class="lt"><b>Load project…</b><span>' + (p.demo ? 'Or pick a job file by hand' : 'Project file from ' + esc(made || '?') + '. Pick a newer one when the job changes.') + '</span></span></button>' +
      '<button type="button" data-act="sendnow"><span class="lt"><b>Send now, without closing</b><span>Part-way through the day: photos and actions reach BTC now</span></span></button>' +
      '<button type="button" data-act="sigset"><span class="lt"><b>Your signature: ' + (S.sig ? 'set' : 'not set') + '</b><span>Draw it, or a photo of it on paper</span></span></button>' +
      '<button type="button" data-act="me"><span class="lt"><b>You: ' + esc(S.me ? S.me.name : 'not picked') + '</b><span>Whose diary your days go into</span></span></button>' +
      (p.demo ? '' : '<button type="button" data-act="pkset"><span class="lt"><b>Your actions: ' + (S.packCfg && S.packCfg.key ? 'on' : 'off') + '</b><span>Your open actions and chases from BTC</span></span></button>') +
      '<button type="button" data-act="wxset"><span class="lt"><b>Weather: ' + (wxOn() ? 'on' : 'off') + '</b><span>' + (wxOn() ? 'Forecast from MET Norway' + (siteLoc() ? '' : ' · set the site location') : 'Fill in each day’s weather from MET Norway') + '</span></span></button>' +
      (p.demo ? '' : '<button type="button" data-act="demo"><span class="lt"><b>Try the demo</b><span>A made-up job to practise on. Your job’s lines stay on the phone.</span></span></button>') + '</div>' +
      '<div class="sec">On this phone</div>' + (function () { var o = oldShipped(); return o.length ? '<div class="list"><button type="button" data-act="clearold"><span class="lt"><b>Free up space</b><span>Clear ' + o.length + ' shipped line' + (o.length === 1 ? '' : 's') + ' older than a month (' + (JSON.stringify(o).length / 1048576).toFixed(1) + ' MB). They’re safe in BTC.</span></span></button></div>' : ''; })() + '<p>' + n + ' line' + (n === 1 ? '' : 's') + ' for this job. Nothing leaves the phone until you ship. Keep BTC Walk on your Home Screen (Safari › Share › Add to Home Screen) so the phone keeps them.</p>' +
      '<div class="sec">How to write</div><p><b>plinth moved 25 mm ; shop drawing 25 mm shorter</b> is a clash (or use --). <b>@NH</b> makes it NH’s action; <b>P1</b>, <b>fri</b>, <b>28-11</b> set priority and due. <b>@SBR 1</b> or <b>@ITP-06</b> tags where it is; <b>at SBR 1</b> on its own moves you there. Tap <b>LOG AS</b> to change the type.</p>' +
      '<div class="sec">This app</div><div class="list"><button type="button" data-act="checkupd"><span class="lt"><b>BTC Walk ' + esc(VERSION) + '</b><span>' + (upd.seen && upd.seen !== VERSION ? 'Version ' + esc(upd.seen) + ' is out: tap to check again' : 'Check for an update') + '</span></span></button></div>');
  }
  // Sheets rise from the bottom and slide away; drag one down to close it (1.3).
  var sheetT = null;
  function sheet(html) { var s = $('sheet'); clearTimeout(sheetT); s.classList.remove('out'); s.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>'; s.hidden = false; sync(); }
  function sheetOpen() { var s = $('sheet'); return !s.hidden && !s.classList.contains('out'); }
  function hideSheet(after) {
    var s = $('sheet'); if (!sheetOpen()) return;
    s.classList.add('out'); clearTimeout(sheetT);
    sheetT = setTimeout(function () { s.hidden = true; s.innerHTML = ''; s.classList.remove('out'); if (after) after(); }, MOTION ? 200 : 0);
  }
  function closeSheet() { hideSheet(sync); }
  async function useDemo() {
    var p = JSON.parse(JSON.stringify(DEMO)); p.made = new Date().toISOString(); p.loadedAt = p.made;
    await kvSet('project', p); S.proj = p; S.entries = await allEntries(p.project.id); S.newParties = (await kvGet('parties:' + p.project.id)) || []; S.gone = (await kvGet('gone:' + p.project.id)) || [];
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

  // ---------- evidence by ITP line (2.0) ----------
  // Every photo you've logged as ITP evidence, by ITP and line, from this phone alone: a ring for how many lines have
  // some, a line's photos in a grid, full screen to show the engineer, Share to send them on.
  function evOf(code, no) { return S.entries.filter(function (e) { return e.type === 'itp' && key(e.itp) === key(code) && (no == null || e.line === no); }).sort(function (a, b) { return a.time < b.time ? -1 : 1; }); }
  function ring(done, all, size) {
    var r0 = size / 2 - 5, c = 2 * Math.PI * r0, f = all ? done / all : 0;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + done + ' of ' + all + ' lines have evidence"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r0 + '" fill="none" stroke="#1B2124" stroke-width="' + (size > 50 ? 7 : 5) + '"/>' +
      (done ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r0 + '" fill="none" stroke="#5CB8FF" stroke-width="' + (size > 50 ? 7 : 5) + '" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' : '') +
      (size > 50 ? '<text x="' + size / 2 + '" y="' + (size / 2 + 5) + '" text-anchor="middle" fill="#F2F4F3" font-family="Geist, sans-serif" font-weight="800" font-size="15">' + done + '/' + all + '</text>' : '') + '</svg>';
  }
  function allItps() { var out = []; (S.proj.areas || []).forEach(function (a) { (a.itps || []).forEach(function (i) { out.push({ area: a.name, it: i }); }); }); return out; }
  function renderEvidence() {
    var code = S.evItp, html = '', head;
    if (!code) {
      var list = allItps(), any = S.entries.some(function (e) { return e.type === 'itp'; });
      head = '<span class="t"><b>Evidence</b><span>Photos by ITP line, from this phone</span></span>';
      html = list.map(function (x) {
        var ls = x.it.lines || [], ev = evOf(x.it.code), done = ls.filter(function (l) { return evOf(x.it.code, l.no).length; }).length, n = 0; ev.forEach(function (e) { n += pics(e).length; });
        if (!ls.length && !ev.length) return '';
        return '<button type="button" class="evrow" data-ev="' + esc(x.it.code) + '">' + ring(done, ls.length, 36) + '<span class="tx"><b>' + esc(x.it.code) + '</b> ' + esc(x.it.title || '') + '<small>' + esc(x.area) + ' · ' + done + ' of ' + ls.length + ' lines</small></span><span class="n' + (n ? '' : ' none') + '">' + (n ? n + ' photo' + (n === 1 ? '' : 's') : 'none yet') + '</span></button>';
      }).join('');
      var loose = S.entries.filter(function (e) { return e.type === 'itp' && !(e.itp && e.line); });
      if (loose.length) html += '<div class="kick">To sort on the PC</div><div class="bar-info">' + loose.length + ' ITP photo line' + (loose.length === 1 ? '' : 's') + ' logged without an ITP line. Build sorts them when you ship.</div>';
      if (!html) html = '<div class="empty"><b>No ITP evidence yet.</b><br>Log a photo with <b>@ITP-06 3.2</b> (or start with <b>ITP.</b>) and it shows up here by line.</div>';
      else if (!any) html = '<div class="bar-info">Log a photo with <b>@ITP-06 3.2</b> and it lands on that line here.</div>' + html;
    } else {
      var it = itpByCode(code) || { code: code, title: '', lines: [] }, ls = it.lines || [], done = ls.filter(function (l) { return evOf(code, l.no).length; }).length, tot = 0;
      evOf(code).forEach(function (e) { tot += pics(e).length; });
      head = '<span class="t"><b>' + esc(it.code) + '</b><span>' + esc(it.title || '') + '</span></span>';
      html = '<div class="ev-head">' + ring(done, ls.length, 64) + '<div><h1>Evidence</h1><p>' + done + ' of ' + ls.length + ' lines · ' + tot + ' photo' + (tot === 1 ? '' : 's') + ' from your phone</p></div></div>';
      var extra = evOf(code).filter(function (e) { return e.line && !ls.some(function (l) { return l.no === e.line; }); }).map(function (e) { return e.line; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      ls.concat(extra.map(function (n) { return { no: n, text: '' }; })).forEach(function (l) {
        var es = evOf(code, l.no), ps = []; es.forEach(function (e) { pics(e).forEach(function (p) { ps.push({ src: p, e: e }); }); });
        var on = S.evLine === l.no;
        html += '<button type="button" class="evrow' + (on ? ' on' : '') + '" data-evl="' + esc(l.no) + '"><span class="no">' + esc(l.no) + '</span><span class="tx">' + esc(l.text || 'Line ' + l.no) + (es.length ? '<small>' + esc(es[es.length - 1].text || '') + '</small>' : '') + '</span><span class="n' + (ps.length ? '' : ' none') + '">' + (ps.length ? ps.length + ' photo' + (ps.length === 1 ? '' : 's') : 'none yet') + '</span>' + (ps.length ? TICK.replace('currentColor', '#7BE0A6') : '') + '</button>';
        if (on && ps.length) {
          S.evPhotos = ps;
          html += '<div class="evgrid">' + ps.map(function (p, i) { return '<button type="button" data-ph="' + i + '" aria-label="Photo ' + (i + 1) + ' full screen"><img src="' + p.src + '" alt=""><span>' + hm(p.e.time) + '</span></button>'; }).join('') + '</div>' +
            '<div class="evbtns"><button type="button" class="btn primary" data-ph="0">Show full screen</button><button type="button" class="btn" data-act="shareev">Share</button></div>';
        }
      });
    }
    main.innerHTML = '<div class="dhead">' + '<button type="button" class="icon" data-act="back" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' + head + '</div><div class="scroll"><div class="pad">' + html + '</div></div>';
  }
  // Full screen (2.5): the Evidence photos, a line's photos, or the photos going with the line you're writing (S.viewBin:
  // a bin to take one off, with Undo). Tap the sides or swipe for the next and previous.
  function viewer(i) {
    var ps = S.evPhotos || [], p = ps[i]; if (!p) return; S.viewAt = i;
    var v = $('viewer'); if (!v) { v = document.createElement('div'); v.id = 'viewer'; document.body.appendChild(v); swipeOn(v); }
    v.className = 'viewer'; v.hidden = false;
    var e = p.e || {}, sub = [e.itp ? (e.itp + ' ' + (e.line || '')).trim() : '', e.day ? dayLabel(e.day) + ' ' + hm(e.time) : '', ps.length > 1 ? (i + 1) + ' of ' + ps.length : ''].filter(Boolean).join(' · ');
    v.innerHTML = '<img src="' + p.src + '" alt="Photo ' + (i + 1) + ' of ' + ps.length + '"><button type="button" class="vn p" data-act="vprev" aria-label="Previous photo"></button><button type="button" class="vn n" data-act="vnext" aria-label="Next photo"></button>' +
      '<div class="vcap">' + esc(e.text || '') + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button type="button" class="vx" data-act="vclose" aria-label="Close">×</button>' +
      (S.viewBin ? '<button type="button" class="vbin" data-act="vbin" aria-label="Take this photo off the line">' + BIN + '<span>Take off</span></button>' : '');
    sync();
  }
  function swipeOn(v) {
    var x0 = null;
    v.addEventListener('touchstart', function (ev) { x0 = ev.touches.length === 1 ? ev.touches[0].clientX : null; }, { passive: true });
    v.addEventListener('touchend', function (ev) { if (x0 == null) return; var dx = ev.changedTouches[0].clientX - x0, n = (S.evPhotos || []).length; x0 = null; if (Math.abs(dx) > 50 && n > 1) viewer((S.viewAt + (dx < 0 ? 1 : n - 1)) % n); }, { passive: true });
  }
  function showPhotos(list, i, bin) { S.evPhotos = list; S.viewBin = !!bin; viewer(i || 0); }
  function viewerOpen() { var v = $('viewer'); return !!(v && !v.hidden); }
  function closeViewer() { var v = $('viewer'); if (v) { v.hidden = true; v.innerHTML = ''; } S.viewBin = false; sync(); }
  async function shareEvidence() {
    var ps = S.evPhotos || []; if (!ps.length) return;
    var files = ps.map(function (p, i) { var b = atob(p.src.split(',')[1] || ''), a = new Uint8Array(b.length); for (var k = 0; k < b.length; k++) a[k] = b.charCodeAt(k); return new File([a], (S.evItp + ' ' + S.evLine + ' ' + (i + 1)).replace(/[^A-Za-z0-9 .-]+/g, '') + '.jpg', { type: 'image/jpeg' }); });
    try {
      if (navigator.canShare && navigator.canShare({ files: files })) await navigator.share({ files: files, title: S.evItp + ' ' + S.evLine, text: S.evItp + ' ' + S.evLine + ' · ' + files.length + ' photo' + (files.length === 1 ? '' : 's') });
      else toast('This phone can’t share photos from here.', true);
    } catch (e) { if (!e || e.name !== 'AbortError') toast('Could not share: ' + e.message, true); }
  }

  // ---------- compile the day (2.6) ----------
  // The day as a site diary page, like BTC's compiled diary (the same print colour, RGB 0 73 114): the job and who, the
  // weather, the lines running in places with their photos three across, then the clashes and actions raised, and a
  // sign-off. Share as PDF opens the phone's print box (Save as PDF, or share it from there).
  async function renderDayPrint() {
    var d = S.day, es = S.entries.filter(function (e) { return e.day === d; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var lines = es.filter(function (e) { return e.type !== 'weather'; }), wl = es.filter(function (e) { return e.type === 'weather'; });
    var st = await wxStart(d).catch(function () { return null; });
    var TAG = { note: 'Note', flowon: 'Clash', action: 'Action', itp: 'ITP', delay: 'Delay', instruction: 'Instruction', crew: 'Crew', visitor: 'Visitor' };
    var wx = [st && st.sum ? 'Forecast at ' + (/^\d{1,2}:\d{2}$/.test(String(st.at)) ? st.at : hm(st.at)) + ': ' + st.sum : '', wl.map(function (e) { return 'Logged ' + hm(e.time) + ': ' + (wxWords(e.wx) || e.text); }).join(' · ')].filter(Boolean);
    var c = counts(es), lost = lines.filter(function (e) { return e.type === 'delay'; }).reduce(function (t, e) { return t + (+e.lost || 0); }, 0);
    var tot = [lines.length + ' line' + (lines.length === 1 ? '' : 's'), c.photo ? c.photo + ' photo' + (c.photo === 1 ? '' : 's') : '', c.flowon ? c.flowon + ' clash' + (c.flowon === 1 ? '' : 'es') : '', c.action ? c.action + ' action' + (c.action === 1 ? '' : 's') : '', lost ? fmtH(lost) + ' lost' : ''].filter(Boolean).join(' · ');
    // the page (2.9, the same design as BTC's compiled diary): weather band, the day in numbers, lines by place with each
    // line's photos under it as P1, P2…, the sign-off with your signature once the day is closed, then the photos full size
    var pno = 0, numbered = [], other = [], last = null, crewN = 0;
    lines.filter(function (e) { return e.type === 'crew'; }).forEach(function (e) { (e.crew || []).forEach(function (x) { crewN += +x.n || 0; }); });
    var body = lines.map(function (e) {
      var pl = placeOf(e), h = '', ps = pics(e);
      if (!e.text && ps.length && e.type === 'note') { ps.forEach(function (x) { other.push({ src: x, cap: hm(e.time) + (pl ? ' · ' + pl : '') }); }); return ''; }
      if (pl !== last) h = '<div class="pp-place">' + esc(pl || 'Around site') + '</div>';
      last = pl;
      var ref = [e.itp && e.line ? e.itp + ' ' + e.line : '', e.who ? whoTxt(e.who) : '', e.party ? (e.dir === 'ours' ? '↙ from ' : '↗ chase ') + e.party : '', e.priority || '', e.due ? 'due ' + dayLabel(e.due) : '', e.type === 'delay' && e.lost ? fmtH(e.lost) + ' lost' : ''].filter(Boolean).join(' · ');
      var nums = ps.map(function (x) { pno++; numbered.push({ n: 'P' + pno, src: x, cap: hm(e.time) + (pl ? ' · ' + pl : '') + ' · ' + (TAG[e.type] || 'Note') + (e.text ? ': ' + e.text : '') }); return { n: 'P' + pno, src: x }; });
      var see = nums.length ? ' <b class="pp-see">see ' + nums[0].n + (nums.length > 1 ? '–' + nums[nums.length - 1].n : '') + '</b>' : '';
      return h + '<div class="pp-l"><span class="pp-t">' + hm(e.time) + '</span><span class="pp-k k-' + esc(e.type) + '">' + esc(TAG[e.type] || 'Note') + '</span><div class="pp-b"><div>' + esc(e.text || '–') + (e.action ? ' <b>→ ' + esc(e.action) + '</b>' : '') + (e.was ? ' <i>(amended; was: ' + esc(e.was) + ')</i>' : '') + see + '</div>' +
        (ref ? '<div class="pp-r">' + esc(ref) + '</div>' : '') + (nums.length ? '<div class="pp-th">' + nums.map(function (x) { return '<span><img src="' + x.src + '" alt=""><b>' + x.n + '</b></span>'; }).join('') + '</div>' : '') + '</div></div>';
    }).join('');
    var times = lines.map(function (e) { return hm(e.time); }).sort(), me = myPerson(), closed = (S.closed || {})[d];
    var parts = st && st.sum ? String(st.sum).split(' · ') : [];
    var wxb = st || wl.length ? '<div class="pp-wx2"><b>' + esc(parts[0] || (wl[0] ? wxWords(wl[0].wx) || wl[0].text : '')) + '</b>' + (parts.length > 1 ? '<span class="pp-ws">' + parts.slice(1).map(esc).join(' · ') + '</span>' : '') +
      '<small>' + (st ? 'Forecast at ' + esc(/^\d{1,2}:\d{2}$/.test(String(st.at)) ? st.at : hm(st.at)) + ' · MET Norway' : 'Logged on site') + '</small>' +
      (wl.length ? '<div class="pp-wl">' + wl.map(function (e) { return '<span><b>' + hm(e.time) + '</b> ' + esc(wxWords(e.wx) || e.text) + '</span>'; }).join('') + '</div>' : '') + '</div>' : '<div class="pp-wx2 none"><b>No weather recorded</b></div>';
    var tile = function (n, l) { return '<div><b>' + esc(n) + '</b><span>' + esc(l) + '</span></div>'; };
    var numsH = '<div class="pp-nums">' + tile(times[0] || '–', 'on site') + tile(times.length ? times[times.length - 1] : '–', 'off site') + tile(crewN || '–', 'crew') + tile(lost ? fmtH(lost) : '0', 'lost time') + tile(c.flowon, 'clashes') + tile(c.action, 'actions') + tile(lines.filter(function (e) { return e.type === 'instruction'; }).length, 'instructions') + tile(c.photo, 'photos') + '</div>';
    var sgn = '<div class="pp-sgs"><div class="pp-sg"><span class="k">Prepared by</span>' + (closed && S.sig ? '<img src="' + S.sig + '" alt="Signature">' : '<span class="ln"></span>') + '<b>' + esc(S.me ? S.me.name : '') + '</b><span>' + esc(me.role || '') + '</span><span class="dt">' + (closed ? esc(dayLabel(String(closed).slice(0, 10)) + ', ' + hm(closed)) : 'Date') + '</span></div>' +
      '<div class="pp-sg"><span class="k">Reviewed by</span><span class="ln"></span><span>Name</span><span class="dt">Date</span></div></div>';
    var html = '<div class="paper"><header class="pp-h"><div class="pp-kick">Site diary</div><h1>' + esc(dayLabel(d)) + '</h1><div class="pp-job">' + esc(S.proj.project.name || '') + ' · ' + esc(S.me ? S.me.name : '') + (me.role ? ' · ' + esc(me.role) : '') + '</div></header>' +
      wxb + numsH + (body || '<p class="pp-none">No commissioning activities recorded.</p>') +
      (numbered.length ? '<p class="pp-note">' + (numbered.length === 1 ? 'P1 is' : 'P1–P' + numbered.length + ' are') + ' printed full size after the sign-off.</p>' : '') + sgn +
      (numbered.length || other.length ? '<div class="pp-photos"><h2>Photos</h2>' + numbered.map(function (x) { return '<figure><span><img src="' + x.src + '" alt=""><b>' + x.n + '</b></span><figcaption><b>' + x.n + '</b> · ' + esc(x.cap) + '</figcaption></figure>'; }).join('') +
        (other.length ? '<h2>Other photos from the day</h2><div class="pp-ph">' + other.map(function (x) { return '<img src="' + x.src + '" alt="">'; }).join('') + '</div>' : '') + '</div>' : '') +
      '<div class="pp-foot">Compiled ' + esc(dayLabel(today())) + ' ' + hm(new Date().toISOString()) + ' from BTC Walk' + (es.some(function (e) { return !e.shipped; }) ? ' · not all lines shipped to BTC yet' : '') + '</div></div>';
    if (S.view !== 'dayprint') return;
    main.innerHTML = '<div class="dhead noprint"><button type="button" class="icon" data-act="back" aria-label="Back to the day"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<span class="t"><b>Compile this day</b><span>' + esc(dayLabel(d)) + ' · ' + esc(tot) + '</span></span></div><div class="scroll"><div class="pad pp-wrap">' + html + '</div></div>' +
      '<div class="foot"><button type="button" class="btn" data-act="print">Share as PDF</button>' + (!(S.closed || {})[d] ? '<button type="button" class="btn primary" data-act="closeday" data-v="' + d + '">Close Day</button>' : '<button type="button" class="btn primary" data-act="back">Done</button>') + '</div>';
  }

  // ---------- the week's recap (2.0) ----------
  function renderRecap() {
    var t = today(), wk = weekOf(t), es = wk.es, c = counts(es), per = [], mx = 0;
    for (var i = 0; i < 7; i++) { var d = addDays(wk.from, i), n = es.filter(function (e) { return e.day === d; }).length; if (i < 5 || n) { per.push({ d: d, n: n }); mx = Math.max(mx, n); } }
    var busiest = per.slice().sort(function (a, b) { return b.n - a.n; })[0], places = {};
    es.forEach(function (e) { var w = e.location || e.area; if (w) places[w] = (places[w] || 0) + 1; });
    var top = Object.keys(places).sort(function (a, b) { return places[b] - places[a]; })[0];
    var ds = daysOf().filter(function (d) { return d.day >= wk.from && d.day <= wk.to; }), waiting = ds.filter(function (d) { return d.unshipped; }).length;
    var note = es.length ? 'Busiest day ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayDate(busiest.d).getDay()] + (top ? ', mostly at ' + top : '') + '. ' + (waiting ? waiting + ' day' + (waiting === 1 ? '' : 's') + ' not shipped yet.' : 'Every day shipped.') : 'Nothing logged this week yet.';
    var html = '<div class="hello"><div class="k">' + (dayDate(t).getDay() === 5 ? 'Friday · ' : '') + 'Week ' + weekNo(t) + '</div><h1>Your week,<br><span>on the record.</span></h1></div>' +
      '<div class="recap"><div class="bars">' + per.map(function (p) { return '<div><div class="bh"><div class="b' + (p.n && p.n === mx ? ' top' : '') + '" style="height:' + (mx ? Math.max(4, Math.round(90 * p.n / mx)) : 4) + 'px"></div></div><small>' + WD[dayDate(p.d).getDay()].charAt(0) + '</small></div>'; }).join('') + '</div>' +
      '<div class="rstats"><div><b>' + es.length + '</b><span>lines logged</span></div><div><b>' + c.photo + '</b><span>photos</span></div><div><b style="color:var(--itp)">' + itpLinesDone(es) + '</b><span>ITP lines evidenced</span></div><div><b style="color:var(--flow)">' + c.flowon + '</b><span>clashes caught early</span></div></div>' +
      '<div class="rnote">' + esc(note) + '</div></div>' +
      (waiting ? '<div class="bar-warn">' + waiting + ' day' + (waiting === 1 ? '' : 's') + ' waiting to ship<button type="button" data-act="ship">Ship</button></div>' : es.length ? '<div class="allclear"><i>' + TICK.replace('currentColor', '#7BE0A6') + '</i><div><b>All clear</b><span>Everything is shipped. Nothing waiting.</span></div></div>' : '');
    main.innerHTML = '<div class="dhead noprint">' + '<button type="button" class="icon" data-act="back" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' + '<span class="t"><b>This week</b><span>' + esc(dayLabel(wk.from)) + ' – ' + esc(dayLabel(wk.to)) + '</span></span></div><div class="scroll"><div class="pad">' + html + '</div></div>' +
      '<div class="foot"><button type="button" class="btn" data-act="print">Share as PDF</button>' + (!(S.closed || {})[d] ? '<button type="button" class="btn primary" data-act="closeday" data-v="' + d + '">Close Day</button>' : '<button type="button" class="btn primary" data-act="back">Done</button>') + '</div>';
  }

  // ---------- free up space (2.0) ----------
  function oldShipped() { var cut = addDays(today(), -30); return S.entries.filter(function (e) { return e.shipped && e.day < cut; }); }
  async function clearOld() {
    var es = oldShipped(); if (!es.length) { toast('Nothing to clear: no shipped days older than a month.'); return; }
    var mb = JSON.stringify(es).length / 1048576;
    if (!confirm('Clear ' + es.length + ' shipped line' + (es.length === 1 ? '' : 's') + ' older than a month (' + mb.toFixed(1) + ' MB)? They’re safe in BTC, but they’ll be gone from this phone.')) return;
    for (var i = 0; i < es.length; i++) await delEntry(es[i].id);
    var ids = {}; es.forEach(function (e) { ids[e.id] = 1; }); S.entries = S.entries.filter(function (e) { return !ids[e.id]; });
    closeSheet(); render(); toast('Cleared ' + es.length + ' line' + (es.length === 1 ? '' : 's') + ' (' + mb.toFixed(1) + ' MB).');
  }

  // ---------- weather (2.1) ----------
  // The forecast for the site comes from MET Norway (api.met.no, free with credit, commercial use allowed), only once
  // someone has read and accepted their terms in ⋮ › Weather, for the site's location (the project file's, or this phone's
  // once, with permission). It's modelled weather, a forecast. A weather word on its own line ("rainy", "fine, windy")
  // or weather. logs what it's actually like; that wins for the part it says (sky, temperature, wind), and the rest stays
  // the forecast. A logged sky holds until the forecast clearly moves on (wet: two dry, clearing hours in a row;
  // dry: two hours of the forecast changing its mind), or someone logs again. Logged rain the forecast missed makes the rest
  // of that day lean wetter. Each hour from 07:00 to 17:00 (wider if lines are logged outside) gets one call.
  var WXSKY = { fine: 'Fine', cloudy: 'Cloudy', showers: 'Showers', rain: 'Rain', heavy: 'Heavy rain' };
  var WET = { showers: 1, rain: 1, heavy: 1 };
  function wxWords(w) { if (!w) return ''; var o = []; if (w.sky) o.push(WXSKY[w.sky].toLowerCase()); if (w.temp != null) o.push(w.temp + '°'); else if (w.feel) o.push(w.feel); if (w.wind != null) o.push(w.wind + ' km/h'); else if (w.windy) o.push('windy'); else if (w.windy === false) o.push('calm'); return o.join(', '); }
  function wxOn() { return !!(S.wx && S.wx.on); }
  function siteLoc() { var p = S.proj || {}; if (p.site && p.site.lat != null) return p.site; return S.wx && S.wx.loc || null; }
  function skyOf(f, wetter) {
    if (!f) return null;
    var mm = f.mm || 0, cl = f.cloud == null ? 50 : f.cloud;
    if (mm >= 2.5) return 'heavy'; if (mm >= 0.5) return 'rain'; if (mm > 0) return 'showers';
    if (wetter && cl >= 60) return 'showers';
    return cl >= 60 ? 'cloudy' : 'fine';
  }
  var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function compass(deg) { return deg == null ? '' : COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
  async function wxFetch(force) {
    if (!wxOn() || !navigator.onLine) return;
    var loc = siteLoc(); if (!loc) return;
    var last = S.wx.at || 0; if (!force && Date.now() - last < 30 * 60000) return;
    try {
      var url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + (+loc.lat).toFixed(4) + '&lon=' + (+loc.lon).toFixed(4);
      var res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) { S.wx.err = 'MET Norway answered ' + res.status + (res.status === 403 ? ' (refused)' : res.status === 429 ? ' (too many requests)' : ''); S.wx.errAt = Date.now(); await kvSet('wx', S.wx); return false; }
      var j = await res.json(), ts = (j.properties && j.properties.timeseries) || [], byDay = {};
      ts.forEach(function (t) {
        var d = new Date(t.time), day = ymd(d), h = d.getHours(), det = (t.data.instant || {}).details || {}, n1 = t.data.next_1_hours || null;
        if (!n1) return;
        (byDay[day] = byDay[day] || {})[h] = { t: det.air_temperature, ws: det.wind_speed != null ? Math.round(det.wind_speed * 3.6) : null, wd: det.wind_from_direction, cloud: det.cloud_area_fraction, mm: (n1.details || {}).precipitation_amount || 0, sym: (n1.summary || {}).symbol_code || '' };
      });
      // keep the hours already past as they were last seen; replace the rest with the newest forecast
      var nowH = new Date().getHours(), t0 = today();
      for (var day in byDay) {
        if (day < t0) continue;
        var keep = (await kvGet('wxf:' + S.proj.project.id + ':' + day)) || {};
        var hrs = keep.hours || {};
        Object.keys(byDay[day]).forEach(function (h) { if (day > t0 || +h >= nowH || !hrs[h]) hrs[h] = byDay[day][h]; });
        await kvSet('wxf:' + S.proj.project.id + ':' + day, { day: day, source: 'MET Norway', at: new Date().toISOString(), loc: { lat: +(+loc.lat).toFixed(4), lon: +(+loc.lon).toFixed(4) }, hours: hrs });
      }
      // the day starts with a forecast (2.2): the first time today's forecast arrives it's kept as it stood, never changed
      var snapKey = 'wxs:' + S.proj.project.id + ':' + t0, snap = await kvGet(snapKey);
      if (!snap) { var fct = await kvGet('wxf:' + S.proj.project.id + ':' + t0); if (fct) { var hs0 = wxDay(fct, [], []); await kvSet(snapKey, { at: new Date().toISOString(), sum: wxSummary(hs0), sky: mainSky(hs0) }); } }
      S.wx.at = Date.now(); S.wx.err = ''; await kvSet('wx', S.wx);
      await wxRecalc();
      if (S.view === 'day') renderDay(); else if (S.view === 'days') renderDays();
      return true;
    } catch (e) { S.wx.err = navigator.onLine ? 'MET Norway didn’t answer' : 'No signal'; S.wx.errAt = Date.now(); try { await kvSet('wx', S.wx); } catch (e2) { /* next time */ } return false; }   // carry on without, but say so in ⋮ › Weather (2.7)
  }
  function mainSky(hrs) { var wet = hrs.filter(function (x) { return WET[x.sky]; }); if (wet.length) return wet.sort(function (a, b) { return ['showers', 'rain', 'heavy'].indexOf(b.sky) - ['showers', 'rain', 'heavy'].indexOf(a.sky); })[0].sky; var c = hrs.filter(function (x) { return x.sky === 'cloudy'; }).length; return c > hrs.filter(function (x) { return x.sky === 'fine'; }).length ? 'cloudy' : hrs.some(function (x) { return x.sky; }) ? 'fine' : 'cloudy'; }
  // Weather BTC hasn't had (2.7): a day with lines whose forecast never went in a ship (it arrived after the lines were
  // shipped), or an earlier day whose final forecast is newer than the one sent. It makes the day "to ship" on its own.
  async function wxRecalc() {
    var owed = {};
    if (S.proj && wxOn()) {
      var t = today(), from = addDays(t, -14), seen = {};
      for (var i = 0; i < S.entries.length; i++) {
        var d = S.entries[i].day; if (seen[d] || d < from || d > t) continue; seen[d] = 1;
        var fc = await wxForecast(d); if (!fc || !fc.hours || !Object.keys(fc.hours).length) continue;
        var sent = await kvGet('wxsent:' + S.proj.project.id + ':' + d);
        if (!sent || (d < t && String(sent) < String(fc.at || ''))) owed[d] = true;
      }
    }
    var was = JSON.stringify(S.wxOwed || {}); S.wxOwed = owed;
    if (was !== JSON.stringify(owed)) { if (S.view === 'days') renderDays(); }
  }
  async function wxStart(day) { return S.proj ? ((await kvGet('wxs:' + S.proj.project.id + ':' + day)) || null) : null; }
  function wxRefresh() { if (S.view === 'day') renderDay(); }
  async function wxForecast(day) { return S.proj ? ((await kvGet('wxf:' + S.proj.project.id + ':' + day)) || null) : null; }
  // The day's weather, hour by hour: forecast hours (may be none) and the logged lines (from anyone) → one call per hour.
  function wxDay(fc, logs, extraHours) {
    // a 12-hour window from 7am, for now (2.37.1 / Walk 2.9.1; shifts carparked: Darath, 25 Nov). extraHours is kept for later.
    var hours = fc && fc.hours || {}, lo = 7, hi = 18;
    logs = (logs || []).filter(function (e) { return e.wx; }).slice().sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var hr = function (e) { return new Date(e.time).getHours(); };
    var wetter = logs.some(function (e) { return e.wx.sky && WET[e.wx.sky] && hours[hr(e)] && !WET[skyOf(hours[hr(e)])]; });
    var fsky = function (h) { return skyOf(hours[h], wetter && logs.some(function (e) { return e.wx.sky && WET[e.wx.sky] && hr(e) <= h; })); };
    var out = [], hold = null;
    for (var h = lo; h <= hi; h++) {
      var f = hours[h] || null, here = logs.filter(function (e) { return hr(e) === h && e.wx.sky; }), lastHere = here[here.length - 1];
      if (lastHere) hold = { sky: lastHere.wx.sky, from: h, by: lastHere.by || '', at: lastHere.time, fAt: fsky(h) };
      if (hold && hold.from < h) {
        var a = fsky(h), b = fsky(h + 1), gone = false;
        if (WET[hold.sky]) gone = h >= hold.from + 2 && a === 'fine' && (b === 'fine' || b == null);
        else { var catA = a ? !!WET[a] : null, catB = b ? !!WET[b] : null, cat0 = hold.fAt ? !!WET[hold.fAt] : null; gone = a != null && cat0 != null && catA !== cat0 && (catB == null || catB === catA); }
        if (gone) hold = null;
      }
      var tl = logs.filter(function (e) { return hr(e) === h && e.wx.temp != null; }).pop(), wl = logs.filter(function (e) { return hr(e) === h && (e.wx.wind != null || e.wx.windy != null); }).pop();
      var sky = hold ? hold.sky : fsky(h);
      out.push({ h: h, sky: sky, logged: !!hold, by: hold ? hold.by : '', at: hold ? hold.at : '', mark: !!lastHere,
        t: tl ? tl.wx.temp : f && f.t != null ? Math.round(f.t) : null, tLogged: !!tl, ws: wl && wl.wx.wind != null ? wl.wx.wind : f ? f.ws : null, wd: f ? f.wd : null, windy: wl ? wl.wx.windy : null, wLogged: !!wl });
    }
    return out;
  }
  function wxSummary(hrs) {
    var known = hrs.filter(function (x) { return x.sky; }); if (!known.length) return '';
    var segs = [];
    known.forEach(function (x) { var g = segs[segs.length - 1]; if (g && g.sky === x.sky) { g.to = x.h; if (x.logged) g.logged = g.logged || x; } else segs.push({ sky: x.sky, from: x.h, to: x.h, logged: x.logged ? x : null }); });
    var part = function (g, i) {
      var name = WXSKY[g.sky], t = g.from === known[0].h && g.to === known[known.length - 1].h ? '' : g.from === known[0].h ? (g.to < 12 ? ' morning' : ' until ' + pad(g.to + 1) + ':00') : g.to === known[known.length - 1].h ? (g.from >= 12 ? (i ? ' after' : ' afternoon') : ' from ' + pad(g.from) + ':00') : ' ' + pad(g.from) + ':00–' + pad(g.to + 1) + ':00';
      var lg = g.logged && g.logged.at ? ' (' + (g.logged.by ? g.logged.by + ' ' : '') + 'logged ' + hm(g.logged.at) + ')' : '';
      return (i ? name.toLowerCase() : name) + t + lg;
    };
    var ts = hrs.map(function (x) { return x.t; }).filter(function (v) { return v != null; });
    var ws = hrs.map(function (x) { return x.ws; }).filter(function (v) { return v != null; }), dirs = {}; hrs.forEach(function (x) { var c = compass(x.wd); if (c) dirs[c] = (dirs[c] || 0) + 1; });
    var dir = Object.keys(dirs).sort(function (a, b) { return dirs[b] - dirs[a]; })[0] || '';
    var windy = hrs.some(function (x) { return x.windy; });
    return segs.map(part).join(', ') + (ts.length ? ' · ' + Math.min.apply(null, ts) + (Math.max.apply(null, ts) !== Math.min.apply(null, ts) ? '–' + Math.max.apply(null, ts) : '') + '°' : '') +
      (ws.length ? ' · ' + (dir ? dir + ' ' : '') + Math.min.apply(null, ws) + (Math.max.apply(null, ws) !== Math.min.apply(null, ws) ? '–' + Math.max.apply(null, ws) : '') + ' km/h' : windy ? ' · windy' : '');
  }
  var WXICON = {
    fine: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FFD66B" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C9D0CD" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/></svg>',
    showers: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5CB8FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z"/><path d="M10 18l-1 2M15 18l-1 2"/></svg>',
    rain: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5CB8FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 7a3.5 3.5 0 0 0 1 7z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></svg>',
    heavy: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5CB8FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 13h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 6a3.5 3.5 0 0 0 1 7z"/><path d="M13 14l-2 4h3l-2 4"/><path d="M7 16l-1 3M18 16l-1 3"/></svg>' };
  function wxStrip(hrs, sum) {
    if (!hrs.some(function (x) { return x.sky; })) return '';
    var marks = hrs.filter(function (x) { return x.mark; }), lastMark = marks[marks.length - 1];
    return '<button type="button" class="wx" data-act="wxdetail" aria-label="Weather: ' + esc(sum) + '. Tap for the hour by hour.">' +
      '<span class="wx-row">' + hrs.map(function (x) { return '<span class="wx-h' + (WET[x.sky] ? ' wet' : '') + (x.logged ? ' lg' : '') + (x.mark ? ' mk' : '') + '">' + (x.sky ? WXICON[x.sky] : '<span class="wx-q">·</span>') + '<small>' + (x.t != null ? x.t + '°' : '') + '</small></span>'; }).join('') + '</span>' +
      '<span class="wx-ax">' + hrs.map(function (x, i) { return '<span>' + (i % 2 === 0 ? pad(x.h) : '') + '</span>'; }).join('') + '</span>' +
      '<span class="wx-s">' + (lastMark ? '<span class="wx-by">' + esc((lastMark.by ? lastMark.by + ' ' : '') + 'logged ' + WXSKY[lastMark.sky].toLowerCase() + ' ' + hm(lastMark.at)) + '</span>' : '') + esc(sum) + '</span></button>';
  }
  async function wxCalc(d, es) {
    var fc = await wxForecast(d), logs = es.filter(function (e) { return e.type === 'weather'; }).map(function (e) { return Object.assign({}, e, { by: S.me ? S.me.handle : '' }); });
    if (!fc && !logs.length) return null;
    var hs = es.map(function (e) { return new Date(e.time).getHours(); }), hrs = wxDay(fc, logs, hs);
    return { day: d, hrs: hrs, fc: fc, logs: logs };
  }
  // A day starts with the forecast as it stood when the day began (2.2), small, then what was logged; tap for the hour by hour.
  async function wxBlock(d, es) {
    var w = await wxCalc(d, es), st = await wxStart(d);
    if (!w && !st) return '';
    if (w) S.wxShown = w;
    var lg = w ? w.logs : [];
    return '<button type="button" class="wxf" data-act="wxdetail"><span class="wxf-i">' + WXICON[st ? st.sky : mainSky(w.hrs)] + '</span><span class="wxf-t">' +
      (st ? '<b>Forecast at ' + hm(st.at) + '</b> · ' + esc(st.sum) : '<b>Weather</b> · ' + esc(wxSummary(w.hrs))) +
      (lg.length ? '<span class="wxf-l">Logged: ' + lg.map(function (e) { return esc(wxWords(e.wx) + ' ' + hm(e.time)); }).join(' · ') + '</span>' : '') + '</span></button>';
  }
  // Home: what it's doing now, small, after the greeting (2.2).
  async function wxNow() {
    var t = today(), es = S.entries.filter(function (e) { return e.day === t; }), w = await wxCalc(t, es); if (!w) return '';
    S.wxShown = w;
    // the weather now is this hour's, even before 7am or after 7pm (2.9.2: it used to fall back to the evening's sky)
    var h = new Date().getHours(), cur = w.hrs.filter(function (x) { return x.h === h; })[0], f = w.fc && w.fc.hours && w.fc.hours[h];
    if (!cur && f) cur = { h: h, sky: skyOf(f), t: f.t != null ? Math.round(f.t) : null, ws: f.ws, wd: f.wd };
    if (!cur || !cur.sky) return '';
    var ws = cur.ws != null ? (compass(cur.wd) ? compass(cur.wd) + ' ' : '') + cur.ws : cur.windy ? 'windy' : '';
    return '<button type="button" class="wxc' + (cur.logged ? ' lg' : '') + '" data-act="wxdetail" aria-label="Weather now"><span class="wxc-t">' + WXICON[cur.sky] + '<b>' + (cur.t != null ? cur.t + '°' : WXSKY[cur.sky]) + '</b>' + (cur.logged ? '<i></i>' : '') + '</span>' +
      '<span class="wxc-s">' + [cur.t != null ? WXSKY[cur.sky] : '', ws].filter(Boolean).join(' · ') + '</span></button>';
  }
  function wxDetail() {
    var w = S.wxShown; if (!w) return;
    var rows = w.hrs.map(function (x) {
      return '<div><span class="mono" style="width:44px">' + pad(x.h) + ':00</span><span style="width:22px">' + (x.sky ? WXICON[x.sky] : '') + '</span><span class="lt"><b>' + (x.sky ? WXSKY[x.sky] : '–') + (x.logged ? ' · logged' : ' · forecast') + '</b><span>' +
        [x.t != null ? x.t + '°' + (x.tLogged ? ' (logged)' : '') : '', x.ws != null ? compass(x.wd) + ' ' + x.ws + ' km/h' + (x.wLogged ? ' (logged)' : '') : x.windy ? 'windy (logged)' : '', x.logged && x.at ? (x.by ? x.by + ' ' : '') + 'logged ' + hm(x.at) : ''].filter(Boolean).join(' · ') + '</span></span></div>';
    }).join('');
    var logs = w.logs.map(function (e) { return '<button type="button" data-e="' + esc(e.id) + '"><span class="mono" style="width:44px">' + hm(e.time) + '</span><span class="lt"><b>' + esc(e.raw || e.text) + '</b><span>Tap to change or delete</span></span></button>'; }).join('');
    sheet('<div class="grip"></div><h2>Weather</h2><p>' + esc(wxSummary(w.hrs)) + '</p>' +
      (logs ? '<div class="sec">Logged on site</div><div class="list">' + logs + '</div>' : '') +
      '<div class="sec">Hour by hour</div><div class="list wxl">' + rows + '</div>' +
      '<p class="small">' + (w.fc ? 'The forecast is modelled weather from MET Norway (yr.no), not a reading on site. ' : 'No forecast for this day: only what was logged. ') + 'Type what it’s actually like (rainy, pissing down since lunch, 8 deg and gusty); it wins for what it says.</p>');
  }
  // where the weather stands (2.7), so it never fails quietly
  function wxStatus() {
    if (!siteLoc()) return 'No site location: set it below, on site';
    var last = S.wx.at ? 'Last forecast ' + dayLabel(ymd(new Date(S.wx.at))) + ' ' + hm(new Date(S.wx.at).toISOString()) : 'No forecast yet';
    if (S.wx.err && (!S.wx.at || S.wx.errAt > S.wx.at)) return S.wx.err + ' at ' + hm(new Date(S.wx.errAt).toISOString()) + (S.wx.at ? ' · ' + last.toLowerCase() : '');
    var owed = Object.keys(S.wxOwed || {}).length;
    return last + (owed ? ' · ' + owed + ' day' + (owed === 1 ? '' : 's') + ' of weather to ship to BTC' : ' · BTC has it');
  }
  function wxSettings() {
    var on = wxOn(), loc = siteLoc();
    sheet('<div class="grip"></div><h2>Weather</h2><p>BTC Walk can fill in each day’s weather from <b>MET Norway</b> (yr.no): free, credited, and allowed for work use. It’s a modelled forecast for the site; what you log on site wins.</p>' +
      '<p>MET Norway keeps the phone’s internet address and the site’s location in its logs. Nothing else about the job is sent. Its terms are a legal agreement for you to read and accept yourself: <a href="https://api.met.no/doc/TermsOfService" target="_blank" rel="noopener">api.met.no/doc/TermsOfService</a></p>' +
      '<div class="list">' + (on ? '<button type="button" data-act="wxoff"><span class="lt"><b>Weather is on</b><span>Accepted ' + esc(S.wx.acceptedAt ? dayLabel(S.wx.acceptedAt.slice(0, 10)) : '') + '. Tap to turn it off.</span></span></button>'
        : '<button type="button" data-act="wxon"><span class="lt"><b>I’ve read MET Norway’s terms and accept them</b><span>Turns weather on for this phone</span></span></button>') +
      (on ? '<button type="button" data-act="wxtry"><span class="lt"><b>' + esc(wxStatus()) + '</b><span>Try now</span></span></button>' : '') +
      '<button type="button" data-act="wxhere"><span class="lt"><b>Site location: ' + (loc ? (+loc.lat).toFixed(3) + ', ' + (+loc.lon).toFixed(3) + ((S.proj.site && S.proj.site.lat != null) ? ' (project file)' : '') : 'not set') + '</b><span>Use where this phone is now (on site)</span></span></button></div>' +
      '<p class="small">Weather data: MET Norway, CC BY 4.0.</p>');
  }

  // ---------- pull-down stretch (2.0) ----------
  // Pull past the top or the bottom of a list and it stretches, with more resistance the further you go; let go and it
  // springs back. Our own, so it feels the same on iPhone and Android (the lists scroll inside the app, where the phone's
  // own stretch doesn't reach).
  var st = null;
  function stretchable() { main.querySelectorAll('.scroll > .pad, .chat').forEach(function (el) { el.classList.add('stretchy'); }); }
  function resist(d) { var a = Math.abs(d), k = 140 * (1 - Math.exp(-a / 260)); return d < 0 ? -k : k; }
  main.addEventListener('touchstart', function (ev) {
    st = null; if (!MOTION || ev.touches.length !== 1 || sw) return;
    var sc = ev.target.closest('.scroll, .chat'); if (!sc) return;
    var el = sc.classList.contains('chat') ? sc : sc.firstElementChild; if (!el) return;
    st = { sc: sc, el: el, y: ev.touches[0].clientY, x: ev.touches[0].clientX, d: 0, on: false };
  }, { passive: true });
  main.addEventListener('touchmove', function (ev) {
    if (!st) return;
    var y = ev.touches[0].clientY, dy = y - st.y, dx = ev.touches[0].clientX - st.x, sc = st.sc;
    if (!st.on) {
      if (Math.abs(dx) > Math.abs(dy)) { st = null; return; }
      var top = sc.scrollTop <= 0 && dy > 4, bot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1 && dy < -4;
      if (!top && !bot) return;
      st.on = true; st.y = y; dy = 0; st.el.classList.remove('springback');
    }
    st.d = resist(dy);
    if ((st.d > 0 && sc.scrollTop > 0) || (st.d < 0 && sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1)) st.d = 0;
    st.el.style.transform = st.d ? 'translateY(' + st.d.toFixed(1) + 'px)' : '';
  }, { passive: true });
  function letGo() {
    if (!st) return; var el = st.el, was = st.on && st.d; st = null;
    if (!was) return;
    el.classList.add('springback'); el.style.transform = '';
    setTimeout(function () { el.classList.remove('springback'); }, 480);
  }
  main.addEventListener('touchend', letGo, { passive: true });
  main.addEventListener('touchcancel', letGo, { passive: true });

  // ---------- drawing ----------
  function render() {
    $('proj').textContent = (S.proj.project.code || S.proj.project.name || '') + ' ▾';
    $('find').classList.toggle('on', S.view === 'findall');
    var was = S.shown; S.shown = S.view;
    if (S.view === 'day') renderDay(); else if (S.view === 'dayprint') renderDayPrint(); else if (S.view === 'findall') renderFindAll(); else if (S.view === 'evidence') renderEvidence(); else if (S.view === 'recap') renderRecap(); else renderDays();
    if (was && was !== S.view) slide(S.view === 'days' || (S.view === 'day' && was === 'dayprint') ? 'back' : 'fwd');
    stretchable();
    sync();
  }
  // Motion (1.3): a screen slides in from the right going in, from the left coming back; quick, no bounce, and none at
  // all if the phone asks for reduced motion. A short buzz on send and ship (Android; iPhone doesn't let web apps buzz).
  var MOTION = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function slide(dir) { if (!MOTION) return; main.classList.remove('in-fwd', 'in-back'); void main.offsetWidth; main.classList.add('in-' + dir); }
  main.addEventListener('animationend', function (ev) { if (ev.target === main) main.classList.remove('in-fwd', 'in-back'); });
  function buzz(p) { try { if (MOTION && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* no buzz here */ } }

  // ---------- Back (1.1) ----------
  // The phone's Back steps through the app: it closes a sheet, an edit or the day's search first, then takes you from a day
  // (or search) to the days. On the days, Back once says "Press back again to leave"; a second Back leaves. Each open layer
  // is one history entry above a guard entry; sync() keeps the count in step with what's open after every draw.
  var H = { n: 0, guard: false, skip: 0, leaving: null };
  function layers() { return (S.view !== 'days' ? 1 : 0) + (S.view === 'dayprint' ? 1 : 0) + (sheetOpen() ? 1 : 0) + (S.view === 'day' && S.edit ? 1 : 0) + (S.view === 'day' && S.findOpen ? 1 : 0) + (S.view === 'evidence' && S.evItp ? 1 : 0) + (viewerOpen() ? 1 : 0); }
  function sync() {
    if (!H.ready) return;
    if (!H.guard) { history.pushState({ walk: 'guard' }, ''); H.guard = true; }
    var want = layers();
    while (H.n < want) { history.pushState({ walk: 'layer' }, ''); H.n++; }
    if (H.n > want) { H.skip++; history.go(want - H.n); H.n = want; }
  }
  function closeTop() {
    if (viewerOpen()) { closeViewer(); return; }
    if (sheetOpen()) { hideSheet(); return; }
    if (S.view === 'evidence' && S.evItp) { S.evItp = null; S.evLine = null; renderEvidence(); slide('back'); return; }
    if (S.view === 'day' && S.edit) { S.edit = null; S.as = null; renderDay(); return; }
    if (S.view === 'day' && S.findOpen) { S.findOpen = false; S.find = ''; renderDay(); return; }
    if (S.view === 'dayprint') { S.view = 'day'; render(); return; }
    if (S.view !== 'days') { S.view = 'days'; S.edit = null; S.findOpen = false; S.find = ''; render(); }
  }
  window.addEventListener('popstate', function () {
    if (H.skip) { H.skip--; return; }
    if (H.n > 0) { H.n--; closeTop(); sync(); return; }
    // the guard went: one more Back leaves the app
    H.guard = false; toast('Press back again to leave');
    clearTimeout(H.leaving); H.leaving = setTimeout(function () { if (!H.guard) { history.pushState({ walk: 'guard' }, ''); H.guard = true; } }, 2600);
  });
  function openDay(d) { wxFetch(); S.view = 'day'; S.day = d; S.find = ''; S.findOpen = false; S.edit = null; S.as = null; render(); }

  document.addEventListener('click', async function (ev) {
    var t = ev.target.closest('button, [data-day], [data-e], [data-jump], [data-put], [data-line], [data-me], [data-filter], [data-fix]');
    if (t && t.dataset.ins != null) { var bi = $('box'); if (!bi) return; var cur = bi.value; bi.value = /^\w+\.$/.test(t.dataset.ins.trim()) ? t.dataset.ins + cur.replace(/^\s+/, '') : cur.replace(/\s*$/, '') + (cur.trim() ? ' ' : '') + t.dataset.ins.replace(/^\s+/, ''); S.draft = bi.value; bi.focus(); bi.setSelectionRange(bi.value.length, bi.value.length); grow(); reads(); buzz(4); return; }
    if (t && t.dataset.ev) { S.evItp = t.dataset.ev; S.evLine = null; renderEvidence(); slide('fwd'); sync(); return; }
    if (t && t.dataset.evl) { S.evLine = S.evLine === t.dataset.evl ? null : t.dataset.evl; renderEvidence(); return; }
    if (t && t.dataset.passto) { var pp = S.passFor; S.passFor = null; closeSheet(); if (pp) packMark(pp, t.dataset.passto); return; }
    if (t && t.dataset.ph != null) { S.viewBin = false; viewer(+t.dataset.ph); return; }
    var lph = ev.target.closest && ev.target.closest('[data-lph]');
    if (lph && !(S.edit && lph.closest('[data-e="' + S.edit + '"]'))) {   // a line's photo: full screen, not edit
      var lp = lph.dataset.lph.split('|'), le = S.entries.filter(function (x) { return x.id === lp[0]; })[0];
      if (le) { ev.preventDefault(); showPhotos(pics(le).map(function (src) { return { src: src, e: le }; }), +lp[1]); return; }
    }
    if (t && t.dataset.tph != null) { showPhotos(S.photos.map(function (src) { return { src: src, e: {} }; }), +t.dataset.tph, true); return; }
    if (!t) { if (ev.target.id === 'sheet') closeSheet(); return; }
    if (t.id === 'more' || t.id === 'proj') { settings(); return; }
    if (t.id === 'find') { S.view = S.view === 'findall' ? 'days' : 'findall'; render(); return; }
    if (t.dataset.day) { openDay(t.dataset.day); return; }
    if (t.dataset.put) { var b = $('box'), v = b.value, pos = b.selectionStart || v.length, i = v.lastIndexOf('@', pos - 1); b.value = v.slice(0, i + 1) + t.dataset.put + ' ' + v.slice(pos); b.focus(); var np = i + 2 + t.dataset.put.length; b.setSelectionRange(np, np); S.draft = b.value; reads(); return; }
    if (t.dataset.line) { var bl = $('box'), vl = bl.value, pl2 = bl.selectionStart || vl.length, head2 = vl.slice(0, pl2).replace(/\d[\d.]*$/, ''); bl.value = head2 + t.dataset.line + ' ' + vl.slice(pl2); var np2 = head2.length + t.dataset.line.length + 1; bl.focus(); bl.setSelectionRange(np2, np2); S.draft = bl.value; reads(); return; }
    if (t.dataset.e) {
      var e = S.entries.filter(function (x) { return x.id === t.dataset.e; })[0]; if (!e) return;
      if (sheetOpen()) { hideSheet(); if (S.view !== 'day' || S.day !== e.day) openDay(e.day); }
      if (S.find) { S.find = ''; S.findOpen = false; renderDay(); var el = document.querySelector('[data-e="' + e.id + '"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('sel'); setTimeout(function () { el.classList.remove('sel'); }, 1400); } return; }
      S.edit = e.id; S.photos = pics(e).slice(); S.as = e.type; renderDay(); var bx = $('box'); bx.focus(); return;
    }
    if (t.dataset.jump) { var j = S.entries.filter(function (x) { return x.id === t.dataset.jump; })[0]; if (!j) return; openDay(j.day); var el2 = document.querySelector('[data-e="' + j.id + '"]'); if (el2) { el2.scrollIntoView({ block: 'center' }); el2.classList.add('sel'); setTimeout(function () { el2.classList.remove('sel'); }, 1400); } return; }
    if (t.dataset.me) { var pp = (S.proj.people || []).filter(function (x) { return x.handle === t.dataset.me; })[0]; S.me = { name: pp.name, handle: pp.handle }; await kvSet('me:' + S.proj.project.id, S.me); closeSheet(); toast('You’re ' + pp.name + '.'); render(); S.pack = null; packsLoad(true); return; }
    if (t.dataset.job != null) { var jb = (S.jobsFound || [])[+t.dataset.job]; S.jobsFound = null; if (jb) await takeProject(jb); return; }
    if (t.dataset.filter) { S.filter = t.dataset.filter; renderFindAll(); return; }
    if (t.dataset.fix) { closeSheet(); var fx = S.entries.filter(function (x) { return x.id === t.dataset.fix; })[0]; openDay(fx.day); S.edit = fx.id; S.as = 'flowon'; renderDay(); var bb = $('box'); bb.value = (fx.raw || fx.text) + ' ; '; bb.focus(); reads(); return; }
    var act = t.dataset.act;
    if (!act) return;
    if (act === 'today') openDay(today());
    else if (act === 'back') { if ((S.view === 'evidence' && S.evItp) || S.view === 'dayprint') { history.back(); return; } S.view = 'days'; S.edit = null; render(); }
    else if (act === 'compileday') { S.edit = null; S.findOpen = false; S.find = ''; S.view = 'dayprint'; render(); }
    else if (act === 'evidence') { S.view = 'evidence'; S.evItp = null; S.evLine = null; render(); }
    else if (act === 'recap') { S.view = 'recap'; render(); }
    else if (act === 'closesheet') { S.passFor = null; closeSheet(); }
    else if (act === 'print') window.print();
    else if (act === 'shareev') shareEvidence();
    else if (act === 'vclose') history.back();
    else if (act === 'vprev' || act === 'vnext') { var nn = (S.evPhotos || []).length; if (nn) viewer((S.viewAt + (act === 'vnext' ? 1 : nn - 1)) % nn); }
    else if (act === 'undo') { var u = toastUndo; toastUndo = null; $('toast').hidden = true; if (u) { await u.fn(); toast('Undone'); } }
    else if (act === 'closesheet') closeSheet();
    else if (act === 'clearold') clearOld();
    else if (act === 'wxdetail') wxDetail();
    else if (act === 'wxset') wxSettings();
    else if (act === 'pkset') packsSettings();
    else if (act === 'packall') { S.packAll = !S.packAll; renderDays(); }
    else if (act === 'pksave') {
      var c0 = (await kvGet('packs')) || {}, k0 = ($('pk-key') || {}).value || '', p0 = (($('pk-pass') || {}).value || '').trim();
      k0 = k0.trim(); if (k0) { if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(k0)) { toast('That doesn’t look like a GitHub key (github_pat_…).', true); return; } c0.key = k0; }
      if (!c0.key || !p0) { toast('Both the key and the team password are needed.', true); return; }
      c0.pass = p0; await kvSet('packs', c0); S.packCfg = c0; closeSheet(); toast('Getting your job from BTC…'); await projSync(true); if (!S.me || S.proj.demo) return; await packsLoad(false); if (S.pack && !S.packErr) toast(packList().length + ' open for you');
    }
    else if (act === 'wxon') { S.wx = Object.assign(S.wx || {}, { on: true, acceptedAt: new Date().toISOString() }); await kvSet('wx', S.wx); wxSettings(); if (!siteLoc()) toast('Now set the site location: tap “Use where this phone is now” on site.'); else wxFetch(true); }
    else if (act === 'wxtry') { if (!navigator.onLine) { toast('No signal: try again when you have some.', true); return; } toast('Getting the forecast…'); var okw = await wxFetch(true); wxSettings(); toast(okw ? 'Forecast in. ' + (Object.keys(S.wxOwed || {}).length ? 'Ship to send it to BTC.' : 'BTC has it.') : (S.wx.err || 'No forecast') + '.', !okw); }
    else if (act === 'wxoff') { S.wx.on = false; await kvSet('wx', S.wx); wxSettings(); }
    else if (act === 'wxhere') {
      if (!navigator.geolocation) { toast('This phone can’t share its location here.', true); return; }
      navigator.geolocation.getCurrentPosition(async function (pos) { S.wx = Object.assign(S.wx || {}, { loc: { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) }, at: 0 }); await kvSet('wx', S.wx); wxSettings(); toast('Site location set.'); wxFetch(true); },
        function () { toast('No location: allow it for BTC Walk in the phone’s settings, then try again.', true); }, { enableHighAccuracy: false, timeout: 15000 });
    }
    else if (act === 'update') doUpdate();
    else if (act === 'checkupd') { closeSheet(); checkUpdate(true); }
    else if (act === 'earlier') { S.showEarlier = true; renderDays(); }
    else if (act === 'ship') shipSheet();
    else if (act === 'closeday') { closeSheet(); closeDaySheet(t.dataset.v || today()); }
    else if (act === 'sendnow') { closeSheet(); shipSheet(); }
    else if (act === 'closeprev') { closeSheet(); S.day = t.dataset.v; S.view = 'dayprint'; S.fromClose = true; render(); }
    else if (act === 'doclose') doClose(t.dataset.v);
    else if (act === 'sigset') sigSheet();
    else if (act === 'sigclear') sigSheet();
    else if (act === 'sigphoto') $('sig-in').click();
    else if (act === 'sigsave') { if (!S.sigInked) { toast('Sign in the box first, or use a photo.', true); return; } try { S.sig = inkOnly($('sig-pad')); } catch (e) { toast(e.message, true); return; } await kvSet('sig', S.sig); toast('Signature saved.'); if (S.view === 'days' && !(S.closed || {})[today()]) closeDaySheet(today()); else closeSheet(); }
    else if (act === 'doship') doShip();
    else if (act === 'send') send();
    else if (act === 'photo') $('photo-in').click();   // the camera, straight away
    else if (act === 'pics') $('pics-in').click();     // several from the phone's photos (1.9)
    else if (act === 'nophoto') { S.photos.splice(+t.dataset.i || 0, 1); renderDay(); }
    else if (act === 'vbin') {   // take a photo off the line you're writing (2.5), with Undo
      var bi2 = S.viewAt, gone = S.photos[bi2]; if (gone == null) return;
      S.photos.splice(bi2, 1); history.back(); renderDay(); buzz(8);
      toast('Photo taken off', false, { label: 'Undo', fn: function () { S.photos.splice(Math.min(bi2, S.photos.length), 0, gone); if (S.view === 'day') renderDay(); } });
    }
    else if (act === 'findday') { S.findOpen = !S.findOpen; if (!S.findOpen) S.find = ''; renderDay(); var fd = $('find-day'); if (fd) fd.focus(); }
    else if (act === 'flip') { var bf = $('box'); if (bf) { bf.value = flipText(bf.value); S.draft = bf.value; bf.focus(); reads(); } }
    else if (act === 'as') { var cur = $('box') ? (S.as || parse($('box').value, S.day).type) : 'note'; S.as = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length]; reads(); }
    else if (act === 'lastline') { var bx2 = $('box'); bx2.value = bx2.value.replace(/\s*$/, '') + ' @' + S.lastLine.itp + ' ' + S.lastLine.line; S.draft = bx2.value; bx2.focus(); reads(); }
    else if (act === 'unloc') { S.loc = null; await kvSet('loc', null); renderDay(); }
    else if (act === 'cancel') { S.edit = null; S.as = null; S.photos = []; renderDay(); }
    else if (act === 'delete') { var dl = S.edit; var gel = document.querySelector('[data-e="' + dl + '"]'); if (gel && MOTION) { gel.style.height = gel.offsetHeight + 'px'; void gel.offsetWidth; gel.classList.add('gone'); await new Promise(function (r) { setTimeout(r, 200); }); } var dx = S.entries.filter(function (x) { return x.id === dl; })[0]; S.entries = S.entries.filter(function (x) { return x.id !== dl; }); await delEntry(dl);
      if (dx && dx.shippedAt) { S.gone = (S.gone || []).concat([{ id: dl, day: dx.day }]); await kvSet('gone:' + S.proj.project.id, S.gone); }   // shipped already: BTC takes it out next ship
      S.edit = null; S.photos = []; renderDay(); buzz(6);
      toast(dx && dx.shippedAt ? 'Deleted. Ship again to take it out of BTC.' : 'Deleted', false, dx ? { label: 'Undo', fn: async function () {
        S.entries.push(dx); await putEntry(dx);
        if (dx.shippedAt) { S.gone = (S.gone || []).filter(function (g) { return g.id !== dx.id; }); await kvSet('gone:' + S.proj.project.id, S.gone); }
        if (S.view === 'day') renderDay();
      } } : null); }
    else if (act === 'load') $('proj-in').click();
    else if (act === 'me') pickMe();
    else if (act === 'demo') useDemo();
  });
  $('sheet').addEventListener('click', function (ev) { if (ev.target.id === 'sheet') closeSheet(); });
  async function addPics() {
    var fs = Array.prototype.slice.call(this.files || []); this.value = ''; if (!fs.length) return;
    var room = MAXPICS - S.photos.length, bad = 0, keep = S.edit ? null : ($('box') || {}).value;
    if (fs.length > room) toast('Up to ' + MAXPICS + ' photos on a line; the first ' + Math.max(room, 0) + ' are in.', true);
    for (var i = 0; i < Math.min(fs.length, room); i++) { try { S.photos.push(await shrink(fs[i])); } catch (e) { bad++; } }
    if (keep != null) S.draft = keep;
    if (S.photos.length) buzz(6);
    renderDay(); var b = $('box'); if (b) b.focus();
    if (bad) toast(bad === 1 ? 'Could not use one of those photos.' : 'Could not use ' + bad + ' of those photos.', true);
  }
  $('photo-in').addEventListener('change', addPics);
  $('pics-in').addEventListener('change', addPics);
  $('proj-in').addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) loadProjectFile(f); });

  // Keyboard down: iPhone can leave the page scrolled up under the status bar; put it back (1.9).
  document.addEventListener('focusout', function () { setTimeout(function () { var a = document.activeElement; if (!a || !/^(TEXTAREA|INPUT)$/.test(a.tagName)) { if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0); } }, 120); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (window.visualViewport.height >= window.innerHeight - 1 && window.scrollY) window.scrollTo(0, 0); });

  // ---------- updates (2.0.1) ----------
  // Each time the app opens or comes back on screen (and every 10 minutes while it's open) it asks for version.json,
  // straight from the site (never a saved copy). A newer version shows a bar: tap to update. Your lines are in the
  // phone's storage, not in the app's files, so updating never touches them. version.json changes with VERSION.
  var upd = { seen: '', at: 0 };
  async function checkUpdate(force) {
    if (!force && Date.now() - upd.at < 60000) return; upd.at = Date.now();
    try {
      var r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      var v = (await r.json()).v;
      if (v && v !== VERSION) showUpdate(v); else if (force) toast('You’re on the newest: BTC Walk ' + VERSION + '.');
    } catch (e) { if (force) toast('No signal: can’t check for an update now.', true); }
  }
  function showUpdate(v) {
    upd.seen = v; var b = $('upd');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'upd'; b.className = 'upd'; b.dataset.act = 'update'; document.body.insertBefore(b, document.body.firstChild); }
    b.innerHTML = '<span>New version ' + esc(v) + '</span><b>Tap to update</b>';
  }
  async function doUpdate() {
    var b = $('upd'); if (b) b.innerHTML = '<span>Updating…</span>';
    try {
      if (navigator.serviceWorker) { var reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); }
      if (window.caches) { var ks = await caches.keys(); await Promise.all(ks.filter(function (k) { return !/-fonts$/.test(k); }).map(function (k) { return caches.delete(k); })); }
    } catch (e) { /* reload anyway */ }
    location.reload();
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { checkUpdate(); wxFetch(); packsLoad(true); } });
  setInterval(function () { if (document.visibilityState === 'visible') checkUpdate(); }, 600000);

  // ---------- start ----------
  (async function start() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* best effort */ }
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is a bonus */ });
    var p = await kvGet('project');
    if (!p) { H.ready = true; history.replaceState({ walk: 'root' }, ''); await useDemo(); checkUpdate(); return; }
    S.proj = p; S.entries = await allEntries(p.project.id); S.newParties = (await kvGet('parties:' + p.project.id)) || [];
    S.me = (await kvGet('me:' + p.project.id)) || null; S.loc = (await kvGet('loc')) || null; S.lastLine = (await kvGet('lastLine:' + p.project.id)) || null; S.gone = (await kvGet('gone:' + p.project.id)) || [];
    S.wx = (await kvGet('wx')) || {};
    S.sig = (await kvGet('sig')) || ''; S.closed = (await kvGet('closed:' + p.project.id)) || {};
    H.ready = true; history.replaceState({ walk: 'root' }, ''); render();
    if (!S.me && !p.demo) pickMe();
    checkUpdate(); wxFetch(); wxRecalc(); packsLoad(true);
  })();
  // Swipe back on iPhone (1.2). A Home Screen app on iPhone has no swipe-back of its own, so BTC Walk does it: start at
  // the left edge and drag right, the same steps as Back on Android. Only in the Home Screen app on iPhone (in Safari,
  // Safari's own swipe does it); on the days there's nowhere further back, so it does nothing.
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var HOME = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  S.edgeSwipe = IOS && HOME;
  var sw = null;
  document.addEventListener('touchstart', function (ev) {
    sw = null;
    if (!S.edgeSwipe || ev.touches.length !== 1 || ev.touches[0].clientX > 24 || H.n < 1) return;
    sw = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, dx: 0, el: sheetOpen() ? $('sheet').firstElementChild : main };
  }, { passive: true });
  document.addEventListener('touchmove', function (ev) {
    if (!sw) return;
    var t = ev.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (Math.abs(dy) > 60 && Math.abs(dy) > dx) { if (sw.el) sw.el.style.transform = ''; sw = null; return; }
    sw.dx = Math.max(0, dx); if (sw.el) sw.el.style.transform = 'translateX(' + Math.min(sw.dx, 160) * 0.6 + 'px)';
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (!sw) return;
    var go = sw.dx > 70; if (sw.el) sw.el.style.transform = ''; sw = null;
    if (go && H.n > 0) history.back();
  }, { passive: true });
  document.addEventListener('touchcancel', function () { if (sw && sw.el) sw.el.style.transform = ''; sw = null; }, { passive: true });
  var sd = null;
  $('sheet').addEventListener('touchstart', function (ev) {
    var sh = $('sheet').firstElementChild; sd = null;
    if (!sh || ev.touches.length !== 1 || sw || sh.scrollTop > 0 || !sh.contains(ev.target)) return;
    sd = { y: ev.touches[0].clientY, dy: 0, el: sh };
  }, { passive: true });
  $('sheet').addEventListener('touchmove', function (ev) {
    if (!sd) return;
    sd.dy = Math.max(0, ev.touches[0].clientY - sd.y);
    if (sd.dy > 6) { sd.el.style.transition = 'none'; sd.el.style.transform = 'translateY(' + sd.dy + 'px)'; }
  }, { passive: true });
  $('sheet').addEventListener('touchend', function () {
    if (!sd) return;
    var el = sd.el, go = sd.dy > 110; sd = null;
    el.style.transition = ''; el.style.transform = '';
    if (go) { if (H.n > 0) history.back(); else closeSheet(); }
  }, { passive: true });
  // The keyboard (1.1): the app shrinks to the space above it instead of being pushed up. Android does it from the viewport
  // tag (interactive-widget=resizes-content); iPhone overlays the keyboard, so the app follows the visible area itself.
  if (window.visualViewport) {
    var fit = function () { var v = window.visualViewport; document.body.style.height = v.height + 'px'; document.body.style.transform = v.offsetTop ? 'translateY(' + v.offsetTop + 'px)' : ''; };
    window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); fit();
  }
  window.BTCWalk = { parse: parse, state: S, version: VERSION, loadProjectFile: loadProjectFile };
})();
