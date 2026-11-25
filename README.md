# BTC Walk

A site diary on your phone. Open it and type: notes, photos, clashes and actions all go into the day's one chat. When you're done, **Ship** sends the day to BTC as one file through your phone's share sheet (Outlook), and BTC files it into your site diary.

Everything stays on the phone until you ship. There's no server and no account: the app is static files, and your lines live in the phone's own storage.

## Install
Open **https://darathny-bit.github.io/Btc-walk/** on the phone, then:
- **iPhone:** in Safari, Share › **Add to Home Screen**. (Keep it on the Home Screen: Safari clears data for sites you haven't opened in a while, Home Screen apps keep it.)
- **Android:** in Chrome, ⋮ › **Install app** (or Add to Home screen › Install). Use it from the icon: it opens in its own window, and Back steps through the app.

Back (Android): closes a sheet, an edit or the day's search first, then goes from a day to the days; on the days it says "Press back again to leave". On iPhone (the Home Screen app), swipe from the left edge to the right for the same steps. Screens slide in and out, sheets rise and drag down to close, new lines animate in, and there's a short buzz on send and ship (Android). All of it switches off if the phone is set to reduce motion. The keyboard shrinks the app rather than pushing it up: the newest line stays just above the box.

It opens on a made-up demo job. Load your job with ⋮ › **Load project…** and pick yourself.

## Writing a line
| You type | It's logged as |
|---|---|
| `pump plinth grouted` | a **note** |
| `plinth moved 25 mm ; shop drawing 25 mm shorter` (or `--`, `→`, `->`) | a **clash**: what changed, then what has to happen downstream |
| `chase the cable schedule @AK P1 fri` | an **action** for AK, priority 1, due Friday |
| `replace the isolator label` | an **action** for you (it starts with a doing word) |
| `flange gasket weeping @ITP-06` | tagged to that place, not where you are |
| `pump curves @Beca fri` or `chase @Beca for pump curves` | an **action** with a party: **↗ they owe us**, you chase it |
| `review comments from @Beca` or `Beca asked for the O&M manuals @Beca` | **↙ ours to do**, raised by Beca (also `@AK … @Beca`) |
| `walk the decanter @AK @SR` or `toolbox talk @all` | an **action** for both (or everyone): one card in BTC, each closes their own part |
| `at SBR 1` | moves you there (no line logged) |
| `bolts torqued @ITP-06 3.2` (with a photo) | **ITP** evidence for that line: BTC files its photos on ITP-06 line 3.2 by itself. After `@ITP-06` and a space the ITP's lines are offered |
| `ITP. grout done` or `@ITP grout done` | **ITP** evidence you'll put on its line on the PC (Build's Sort page) |
| `note.` `action.` `clash.` `ITP.` at the start | says what the line is (the word is dropped); `@clash` is the same as `clash.` (`flow.` and `@flow-on` still work) |

**Photos (2.5):** tap a photo on a line to see it full screen (swipe or tap the sides for the others, × to close); tapping the words still edits the line. Editing a line, tap a photo above the box to see it; **Take off** in the viewer removes it, with Undo.

Tap **LOG AS** to change the type before sending (note, clash, action, ITP). With ITP and no line, the last line you used is a one-tap chip. Tap a line to edit or delete it. The camera button takes a photo straight away; the photos button beside it picks several from the phone. Up to 10 photos go with the next line (each shrunk on the phone to about 200 KB): one description, several photos, for example 5 photos of `bolts torqued @ITP-06 3.2`. Take or pick more and they add on; × takes one off. Tap a line to edit it: its photos come back above the box to add to or take off.

Due dates: `today`, `tomorrow`/`tmrw`, `fri`/`by Friday`/`on Fri`, `next Friday`, `eow`, `next week`, `in 3 days`, `28-11` or `28/11`. Saturday and Sunday need the full name.

## Night shift (2.0)

The look and feel are in [DESIGN.md](DESIGN.md). What 2.0 adds:

- **Your week:** a greeting, the week's lines, photos and ITP lines, an orange banner when a day isn't shipped, a green "All clear" when everything is.
- **A day** opens with its name and totals; lines run down a timeline with a coloured dot per kind; a place heading starts each stretch after `at SBR 1`.
- **It remembers for you:** with the box empty, the next line on the ITP you used last, the people you tag most and `clash.` `action.` `ITP.` are one tap away.
- **Mistakes cost nothing:** Undo after a send (the words and photos come back) and after a delete (no "are you sure").
- **Evidence:** every ITP photo you've logged, by ITP and line, with a ring for how many lines have some; full screen to show the engineer (tap the sides for next and previous), Share to send a line's photos.
- **This week:** your week on the record (lines per day, photos, ITP lines evidenced, clashes caught early); Share as PDF prints it.
- **The ship moment:** a tick that draws itself and where everything goes.
- **Pull-down stretch** on every list; a light buzz on Android for send, photos and ship.
- **Free up space** (⋮): clear shipped lines older than a month; they're safe in BTC.

## Weather and site lines (2.1)

- **Weather** (⋮ › Weather) is off until someone reads and accepts [MET Norway's terms](https://api.met.no/doc/TermsOfService) on the phone. Then the forecast for the site (the project file's `site: { lat, lon }`, or this phone's location once) fills each hour 07:00–17:00 with an icon and temperature. It's a modelled forecast, credited to MET Norway (CC BY 4.0). MET Norway logs the phone's internet address and the site's location; nothing else about the job is sent.
- **Log what it's actually like:** just type it (`rainy`, `pissing down since lunch`, `8 deg and blowing a gale`, `southerly 20 knots`), or start with `weather.`. A line counts as weather when every word is about the weather, a small word, a time or a number with a unit (2.3); "checked the rain gauge" stays a note. Temperatures are always °C (`8 deg`, `8°`, `8 degrees`); knots turn into km/h. It wins for what it says (sky, temperature, wind) and the rest stays on the forecast. A logged sky holds until the forecast clearly moves on (wet: two dry, clearing hours in a row; dry: two hours of the forecast changing its mind) or someone logs again; logged rain the forecast missed makes the rest of that day lean wetter. Weather lines stay out of the day's list.
- **Small, and the day starts with a forecast (2.2, 2.3):** home shows the weather now, small, top right beside the greeting: the temperature big, sky and wind under it, a lime dot when someone logged it. The day shows one small box: "Forecast at 06:52 · …", the first forecast the phone got that day (kept as it was), and what's been logged; tap it for the hour by hour. The ship file's `weather[day].start` carries that first forecast (`at`, `sum`, `sky`).
- **Site lines:** `delay. waiting on the crane 2h` (time lost), `instruction. hold the pour @SR` (who gave it), `crew. HEB 6, sparkies 4` (who's on site), `visitor. council inspector`.
- **Amended:** a line changed after it was shipped keeps what it said before (`was`, `amendedAt`), and BTC prints both.
- **Ship file:** `weather: { "<day>": { source, at, loc, hours: { "<h>": { t, ws, wd, cloud, mm, sym } } } }` with the forecast; entries add `wx`, `crew`, `lost`, `was`, `wasType`, `amendedAt`.

## Straight to BTC (2.10)
With the key and team password set (⋮ › Your actions; the key needs **Contents: read and write** on btc-drop), every ship is locked on the phone with the team password (the same lock as packs) and put in btc-drop at `inbox/<job hash>/<ship file name>.lock` (`dropSend`). The sheet says **Sent straight to BTC**; nothing to email. BTC's Actions checks that inbox every couple of minutes, files each day as it would from the BTC Inbox (a copy to `Processed/`) and deletes it from btc-drop. No key, no signal or GitHub saying no: it falls back to share / email, with the reason in a toast.

## iPhone: a taller top bar (2.16.1)
iOS 27 lays a hazy glass over the top of home-screen web apps. On an iPhone or iPad (the `ios` class on `<html>`) the top bar is taller: empty black under the haze, its buttons shifted down below it. Android and the PC are as before. Take the class away when Apple fixes it.

## @all-m&e (2.15)
`@all` is everyone in the job; `@all-m&e`, `@all-structures`, `@all-civil` (any team's name, letters and digits only) is everyone in that team. The project file carries the job's `teams: [{ id, name }]`; the line goes as `who: 'all-<team id>'` and BTC expands it. The @ list offers each team.

## The job comes by itself (2.14)
With the key and team password in (⋮ › Your actions; on the demo it's ⋮ › **Connect to BTC**, first in the list, 2.14.1), the phone looks in btc-drop's `projects/` folder, opens each `.btcpack` with the team password and loads the job it finds over the demo (several: it asks which), then asks who you are. Build sends it (`projects/<job hash>.btcpack`, the project file locked like a pack) when someone makes it (⋮ › Phone project file…) and by itself when anything in it changed; the phone checks for a newer one every 10 minutes at most when it opens, and takes it without touching your days. **Load project…** still works for a file, and now takes any file (an iPhone greys out `.btcproject` otherwise); the app checks it.

## Swipe your actions (2.11)
On **Your actions**, swipe a row right for **done** (green) or left to **pass it on** (amber; pick a person from the team). Past a third of the row (or a quick flick) it goes; short of that it springs back. **Undo** shows for 6 seconds (at the top when a sheet is open). No tick circle from 2.12: swipe only.

## Actions sync straight away (2.12)
Everything about actions goes to BTC on its own, through btc-drop, without a ship: done and passed on (once Undo has run out), an action line you type (`@AK fit the guard by fri`, a few seconds after; edit it and it goes again), and **seen**. Each is a small file named `…_actions.btcwalk.txt` with `kind: 'actions'`, only those entries and `actionsDone` / `actionsPassed` / `actionsSeen: [{ id, file, at }]`: no photos (an action line's photos come with Close Day; BTC adds them to the line), notes or weather. With no signal they wait and go when it's back, or with the next ship. **Quiet cards (2.13), colour in the edge (2.14.3):** dark tiles whose edge is violet when given, turning amber-brown by 7 days; NEW glows (bright violet edge, soft pulsing glow) until seen; the due date on the right (`6d late`, `today`, `Fri 27`), and the age as a small dot and day count (`3d`) going from purple when given to brown at 7 days (`given` in the pack). One someone gave you or nudged you about has a thin violet edge and "New from Alex · 20 min" at the top (`fresh` in the pack) until it's been on screen for 2 seconds, then it's seen (BTC shows the giver ✓ seen). A refresh keeps your place on the screen. Both go with the next ship: done as `actionsDone`, passed as `actionsPassed: [{ id, file, at, to }]` (`to` = the person's handle).

## Close the day (2.9; Close Day from 2.10)
The home screen's main button at the end of the day is **Close Day**; afterwards it reads **Send changes** when something changed, else **Closed**. A past day's page has its own **Close Day** at the foot until it's closed. The sheet: **See the page** (the day as it prints: weather on top, the day in numbers, lines by place with each line's photos under it as P1, P2…, the sign-off, then the photos full size), your signature and title (title from the project file's `role`), a **Reviewer** (anyone in the team, remembered; or nobody), then **Sign and Close Day**, which ships the whole day with `close` in the ship file. **⋮ › Send now, without closing** ships part-way through a day as before.

**Your signature** (⋮ › Your signature, or from Close the day): draw it with a finger, or take a photo of it on paper (the paper turns clear, cropped to the ink; `inkOnly` is kept in step with BTC's `topbar.js`). It stays on this phone (`kv 'sig'`); a copy goes only with a day you close.

## Your actions (2.8)
⋮ › **Your actions**: the GitHub key and the team password (from whoever set up Phone packs in BTC), once. The home screen then shows **Your actions**: your open actions and chases from BTC (P1 and late first, ↗ chase, ↙ raised by, who else is on it), fetched from the private repo `darathny-Bit/btc-drop` on open and whenever the app comes back, unlocked on the phone (PBKDF2-SHA256 → AES-256-GCM; the same as BTC's `packLock`). The last pack is kept for no signal. Tick one done and it leaves the list (Undo for a few seconds); the tick goes with the next ship (`actionsDone: [{ id, file, at }]`), which counts as something to ship even on a day with no lines. Nothing about the job is in this repo: the repo name and the key are all the app knows until you type them.

## Weather that gets to BTC (2.7)
A forecast that arrives after a day's lines were shipped used to stay on the phone. Now a day (last 14 days) whose forecast BTC never had, or an earlier day whose final forecast is newer than the one sent, counts as to ship on its own (**WEATHER TO SEND** in the ship sheet); each ship remembers what it sent (`wxsent:<project>:<day>`). ⋮ › Weather shows where it stands: the last forecast, MET Norway's answer if it refused (403, 429) or no signal, and how many days of weather are still to ship; tap it to **Try now**.

## Compile a day (2.6)
In a day, the page button (top right) compiles it as a site diary page in BTC's print colour: the job and who, the weather (the day's first forecast and what was logged), the lines in places with their photos three across, the clashes and actions raised, and a sign-off. **Share as PDF** opens the phone's print box (Save as PDF, or share it from there).

## Parties (2.4)
Outside parties for the job (Beca, the Engineer, CCC) come from the project file (`parties`). Type `@` and they're offered with their role. An @ that isn't a person or a place (letters only) is a party: a new one is remembered on this phone and shipped to BTC, which adds it to the job's list. Each item runs one way: **↗ chase** (they owe us) or **↙ from** (they raised it, ours to do). `chase @Beca` and `from @Beca` say it; otherwise a raising word (asked, comments, query…) or a team member beside it makes it ours, else a chase. Tap the chip to turn it round (it changes the words).

## The two files
BTC Walk only talks to BTC through two files.

**Project file** (`.btcproject`, made by BTC's Build: ⋮ › Phone project file…), loaded once per phone and again when the job changes:
```
{ "format": "btcproject", "v": 1, "made": ISO time,
  "project": { "id", "code", "name" },
  "people": [{ "name", "handle", "team": true }],
  "parties": [{ "name", "contact", "role" }],   (2.4)
  "areas": [{ "name", "itps": [{ "code", "title", "lines": [{ "no", "text" }] }] }],
  "flowons": [{ "no", "area", "itp", "desc", "action" }] }
```

**Ship file** (`<code>_<you>_<day>.btcwalk.txt`: JSON, named .txt because Android's share sheet only takes file types it knows; BTC reads `.btcwalk` and `.btcwalk.txt`), what Ship sends:
```
{ "format": "btcwalk", "v": 1, "project": { "id", "code", "name" }, "shippedBy": { "name", "handle" }, "shippedAt",
  "entries": [{ "id", "day", "time", "type": "note|flowon|action|itp", "raw", "text", "action", "who", "party", "dir" (chase|ours, 2.4), "area", "itp", "line", "tag",
                "location", "priority", "due", "photos" ([data URL, …], 1.9), "photo" (the first, for BTC before 2.24), "edited" }],
  "walks": [], "closures": [], "actionsDone": [{ "id", "file", "at" }] (2.8), "close": { "date", "at", "sig" (PNG data URL), "title", "reviewer" (initials or "") } (2.9), "parties": [{ "name", "role", "contact" }] (new on this phone, 2.4) }
```

## Updates (2.0.1)

The app checks `version.json` each time it opens or comes back on screen, straight from the site; a newer version shows a lime bar, **Tap to update**. Lines live in the phone's storage, so updating never touches them. When releasing, change `VERSION` in `app.js` and `version.json` together (and the `?v=` numbers in `index.html` and `sw.js`, and `CACHE` in `sw.js`).

## This repo
App code only: `index.html`, `app.js`, `styles.css`, `sw.js` (keeps the app working with no signal), `manifest.webmanifest`, `icons/`. **Never commit a project file, a ship file or anything from a real job.** The demo job is made up.

## Ship as often as you like
Each ship is its own file (the time is in the name) and carries the whole day; BTC files each line once. Edit or delete a line after shipping and the day shows **CHANGED · RESHIP** until you ship again: BTC then updates the edited line (marked edited on the phone) and takes deleted ones out (`removed` in the ship file).
