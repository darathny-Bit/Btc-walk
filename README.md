# BTC Walk

A site diary on your phone. Open it and type: notes, photos, flow-ons and actions all go into the day's one chat. When you're done, **Ship** sends the day to BTC as one file through your phone's share sheet (Outlook), and BTC files it into your site diary.

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
| `plinth moved 25 mm ; shop drawing 25 mm shorter` (or `--`, `→`, `->`) | a **flow-on**: what changed, then what has to happen downstream |
| `chase the cable schedule @AK P1 fri` | an **action** for AK, priority 1, due Friday |
| `replace the isolator label` | an **action** for you (it starts with a doing word) |
| `flange gasket weeping @ITP-06` | tagged to that place, not where you are |
| `walk the decanter @AK @SR` or `toolbox talk @all` | an **action** for both (or everyone): one card in BTC, each closes their own part |
| `at SBR 1` | moves you there (no line logged) |
| `bolts torqued @ITP-06 3.2` (with a photo) | **ITP** evidence for that line: BTC files the photo on ITP-06 line 3.2 by itself. After `@ITP-06` and a space the ITP's lines are offered |
| `ITP. grout done` or `@ITP grout done` | **ITP** evidence you'll put on its line on the PC (Build's Sort page) |
| `note.` `action.` `flow.` `ITP.` at the start | says what the line is (the word is dropped); `@flow-on` is the same as `flow.` |

Tap **LOG AS** to change the type before sending (note, flow-on, action, ITP). With ITP and no line, the last line you used is a one-tap chip. Tap a line to edit or delete it. The camera button adds a photo to the next line (shrunk on the phone to about 200 KB).

Due dates: `today`, `tomorrow`/`tmrw`, `fri`/`by Friday`/`on Fri`, `next Friday`, `eow`, `next week`, `in 3 days`, `28-11` or `28/11`. Saturday and Sunday need the full name.

## The two files
BTC Walk only talks to BTC through two files.

**Project file** (`.btcproject`, made by BTC's Build: ⋮ › Phone project file…), loaded once per phone and again when the job changes:
```
{ "format": "btcproject", "v": 1, "made": ISO time,
  "project": { "id", "code", "name" },
  "people": [{ "name", "handle", "team": true }],
  "areas": [{ "name", "itps": [{ "code", "title", "lines": [{ "no", "text" }] }] }],
  "flowons": [{ "no", "area", "itp", "desc", "action" }] }
```

**Ship file** (`<code>_<you>_<day>.btcwalk.txt`: JSON, named .txt because Android's share sheet only takes file types it knows; BTC reads `.btcwalk` and `.btcwalk.txt`), what Ship sends:
```
{ "format": "btcwalk", "v": 1, "project": { "id", "code", "name" }, "shippedBy": { "name", "handle" }, "shippedAt",
  "entries": [{ "id", "day", "time", "type": "note|flowon|action|itp", "raw", "text", "action", "who", "area", "itp", "line", "tag",
                "location", "priority", "due", "photo" (data URL), "edited" }],
  "walks": [], "closures": [] }
```

## This repo
App code only: `index.html`, `app.js`, `styles.css`, `sw.js` (keeps the app working with no signal), `manifest.webmanifest`, `icons/`. **Never commit a project file, a ship file or anything from a real job.** The demo job is made up.

## Ship as often as you like
Each ship is its own file (the time is in the name) and carries the whole day; BTC files each line once. Edit or delete a line after shipping and the day shows **CHANGED · RESHIP** until you ship again: BTC then updates the edited line (marked edited on the phone) and takes deleted ones out (`removed` in the ship file).
