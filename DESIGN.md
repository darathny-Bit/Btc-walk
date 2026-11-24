# BTC Walk design

How BTC Walk should look and feel. It is a site diary engineers keep on their phone all day; the aim is an app people
reach for because it feels good and pays them back, not because it nags or rewards them. No points, no leaderboards,
nothing that feels like a game of chance.

Built in BTC Walk 2.0. The concept it came from: **Night shift** (four phone screens: a day on site, your week, ship it, pull-down stretch).

## Principles

1. **Fast to the first word.** Open the app and today is open with the keyboard ready. Nothing stands between pulling
   the phone out and typing: no splash, no picker, no question that has an obvious answer.
2. **Every touch answers back.** A tap presses in, a send lifts the line into place, a ship draws its tick, Android gives
   a light buzz. Nothing the hand does goes unanswered for more than a tenth of a second.
3. **It remembers for you.** Where you are, the last ITP line, who you tag most, your shortcuts. It never asks the same
   thing twice and its defaults are the likely answer.
4. **Mistakes cost nothing.** Anything can be edited or deleted; a slip can be undone straight away; nothing is lost when
   the app closes, the phone sleeps or the signal drops. People log freely when they're not afraid of getting it wrong.
5. **Smooth over flashy.** Motion is short, springy and follows the finger. Nothing makes you wait for an animation to
   finish. If motion doesn't help you see what happened, it goes.
6. **It pays you back.** Finding a photo from three months ago in two seconds, every piece of evidence for an ITP line in
   one place, a clean diary at the end of the week. Being useful is the hook.
7. **It never nags.** One quiet reminder when today isn't shipped. No badges, no red dots, no streak guilt.
8. **One way, and private.** The phone sends to BTC and nothing comes back. Everything the phone shows comes from what you
   logged on it. Your data stays on your phone until you ship it.

## Design language

**Mood.** Calm, sharp and quiet, with one bright thing at a time. Black, not grey. Content first, chrome last.

**Colour.**

| Role | Value | Use |
|---|---|---|
| Ground | `#000000` | the page: true black, crisp on OLED, readable in glare |
| Surface | `#0E1112` | cards, lines |
| Raised | `#15181A` | chips, buttons, the compose bar |
| Hairline | `rgba(255,255,255,.06)` | card edges, dividers |
| Ink | `#F2F4F3` | text |
| Muted | `#8B9490` | times, labels (4.5:1 or better on surface) |
| Accent | `#D4FF3A` (lime) | send, ship, today, where you are; never more than one or two on a screen |
| Note | `#8B9490` | grey dot |
| Clash | `#FF9A3D` | orange dot, edge, label |
| Action | `#B595FF` | violet |
| ITP evidence | `#5CB8FF` | blue |
| Shipped | `#7BE0A6` | green tick |

Kinds of line differ in lightness as well as hue, and always carry a word label too, so colour is never the only cue.

**Type.** Geist for everything; Geist Mono for times and references (ITP-06 3.2, CL-004) so they line up. Big, tight
headings (34–36 px, weight 800, −0.035em); body 15 px at 1.4; labels 11–12 px, weight 600, letter-spaced caps.

**Shape and space.** 4 px grid. Cards 16 px radius, sheets 30 px, buttons and chips fully round. 18–20 px page margins.
Touch targets at least 44 px. Cards are separated by space and a hairline, never heavy borders or shadows.

**Glass.** The top bar and compose bar are frosted (black at ~72%, 18–20 px blur) so lines blur as they scroll under.
Nothing else is see-through.

**Timeline.** A day reads down a thin rail on the left with a coloured dot per line; a place heading (lime square) starts
each stretch at one place.

**Motion.**

| Moment | Motion |
|---|---|
| Open a day / go back | slide 28% / 18% with fade, 240 ms, ease-out |
| Send a line | lifts 10 px and settles, 220 ms spring |
| Photos added | pop in from 0.9 scale, staggered 30 ms |
| Delete | card shrinks and the rest close up, 200 ms |
| Sheet | rises from the bottom, background dims, 260 ms |
| Ship | ring draws (600 ms), then the tick (350 ms) |
| Pull past the top or bottom | rubber-band stretch, top lines most, resistance grows; springs back on release |
| Press | 0.97 scale while held |

Everything stops when the phone asks for reduced motion.

**Touch.** A light buzz on Android for send, photo added and ship (iPhone doesn't let web apps vibrate). No sounds.

**Words.** Short, plain, friendly, in the person's terms: "Today isn't shipped yet", "Shipped", "Log it…". Never blame
("Error"), never shout (no exclamation marks, no caps sentences).
