# tend

a gentle medicine reminder that lives on your phone. tell it when your day happens and what you take, and pip, a small teal capsule, taps you on the shoulder at each scheduled time.

<p>
  <img src="docs/today-phone.webp" width="24%" alt="Today on a phone: a sunrise card says Time for 2 medicines with Vitamin D3 and Metformin, a Take both button, and separate meal-time insulin reminders below" />
  <img src="docs/dose-phone.webp" width="24%" alt="The dose sheet risen from the bottom: Pip, the two medicines with checkboxes, and Taken, both above Snooze 10 min, Other time and Skip" />
  <img src="docs/night-phone.webp" width="24%" alt="Night screen: navy sky with a crescent moon and stars, Pip asleep, All done for today and the next dose tomorrow" />
  <img src="docs/welcome-phone.webp" width="24%" alt="Onboarding on sunrise yellow: Pip smiling above Hi, I'm Pip and a Let's set up button" />
</p>

<img src="docs/today-desktop.webp" alt="Tend on a 1440 wide screen: a sidebar with keyboard keys, Today with the morning scene, upcoming reminders and medicine cards, and a right column with week rings and refill reminders" />

## what it does

- **routines, not alarms.** you set when you wake, eat and sleep once. a dose hangs off a routine ("15 min before breakfast", "at bedtime") or a clock time, so moving breakfast moves every morning dose. weekends can have their own times. before-meal and meal-time medicines keep their separate reminder times.
- **flexible schedules.** every day, chosen weekdays, every few days, on and off cycles, once, and when needed, with an optional prescribed minimum gap and daily maximum. courses end on their own and show "day 3 of 5".
- **a form that fits the medicine.** choose a type, set the schedule, then review before saving. tablets, capsules, liquids, insulin, other injections, inhalers, drops, creams and patches get the fields and units they need. add several medicines during onboarding with the same editor.
- **different doses at different times.** insulin can follow breakfast, lunch and dinner with separate unit amounts, or use set times such as bedtime. meal offsets are editable; the app does not calculate or recommend doses.
- **type it like the prescription.** `Metformin 500mg 1-0-1 PC`, `Syp Calpol 5ml TDS x 3 days`, `Tab Dolo 650mg SOS`, or `Inj Apidra 14-8-6 units AC`. an optional shortcut previews the interpretation; choose “Use these details” to fill the form, then review it before saving.
- **logging that forgives.** take a whole routine at once, one medicine, or at another time (long-press). snooze, skip, swipe a row to skip just that one. every action has undo. a dose you never logged says not logged, never missed.
- **stock.** a count per medicine that drops when you take it, a refill nudge at a chosen number of days of supply, and a refilled button that adds your saved refill amount. counts use tablets, ml, puffs, patches or insulin units as appropriate.
- **edit, archive or delete.** open a medicine to edit it, or use its menu to archive it while keeping history. deleting removes the medicine and its logs, with a brief undo. closing a new-medicine sheet stays in Medicines, including when it was opened from Today.
- **history without streaks.** a ring per day for the week, the times for any day, and a gentle percentage per medicine over 30 days.
- **travel mode.** doses follow the local clock by default. keep home time instead and every routine stays on your home zone abroad, for medicines that need a steady gap, with the time here shown beside it. tend notices a new zone and asks.
- **for the doctor.** a my medicines card to share or copy, an `.ics` export with alerts for anyone who won't install, and a json backup and restore.
- **everything stays on the phone.** medicines and logs live in indexeddb. the reminder server only ever sees an anonymous device id and some times.

### adding a medicine

<p>
  <img src="docs/add-medicine-phone.webp" width="32%" alt="Medicine step: one consistent picker for tablets, insulin, cream and six other medicine types, with a tablet dose field" />
  <img src="docs/insulin-schedule-phone.webp" width="32%" alt="Schedule step: Apidra has separate breakfast, lunch and dinner doses of 14, 8 and 6 units with an adjustable before-meal reminder" />
  <img src="docs/review-medicine-phone.webp" width="32%" alt="Review step: medicine details and each reminder's dose appear together before Add medicine, with refill tracking kept optional" />
</p>

1. **medicine.** enter the name and choose the type. only the relevant dose and application fields appear. strength, concentration, notes and prescription shorthand are optional.
2. **schedule.** choose routines or clock times. repeated daily schedules stay compact; expand Repeat for other frequencies. food timing appears for oral medicines, and insulin offers meal times or set times. doses and timings come from the prescription.
3. **review.** check the dose at each reminder before saving. refill tracking and pill appearance are optional. the same steps work in onboarding and when editing a saved medicine.

| type | fields that fit it |
|---|---|
| tablet / capsule | number per dose; optional strength and food timing; appearance if useful |
| liquid | ml per dose; optional concentration such as mg per 5 ml |
| insulin | prescribed units at each reminder; meal or set times; adjustable meal offset; optional concentration |
| other injection | prescribed amount and dose unit; optional concentration |
| inhaler | puffs per dose; regular or when-needed schedule; optional prescribed limits |
| drops | drops per application; optional eye, ear or other application site |
| cream / gel | optional application amount in words and treatment area; no pill count or food controls |
| patch | patches per change and the prescribed change schedule; optional label strength and site instructions |

The field choices follow medicine-use guidance from the NHS for [insulin](https://www.nhs.uk/medicines/insulin/rapid-acting-insulin/how-and-when-to-take-rapid-acting-insulin/), [topical treatments](https://www.nhs.uk/medicines/mometasone-for-skin/how-and-when-to-use-mometasone-for-skin/), [patches](https://www.nhs.uk/medicines/buprenorphine-for-pain/how-and-when-to-use-buprenorphine/), [inhalers](https://www.nhs.uk/medicines/salbutamol-inhaler/how-and-when-to-use-salbutamol-inhalers/) and [drops](https://www.nhs.uk/medicines/dexamethasone-eye-drops/how-and-when-to-use-dexamethasone-eye-drops/). These are reminder fields, not dose calculations. The screenshot entries are examples.

[See the cream editor](docs/cream-phone.webp) · [See multiple medicines in onboarding](docs/welcome-medicines-phone.webp) · [See medicine details on desktop](docs/medicine-desktop.webp)

### left out on purpose

- interaction checks. that is medical advice, there is no free licensed data, and most indian brands are missing.
- name lookup. rxnorm is us only, so names you have already typed are suggested instead.
- caregiver alerts. they need accounts. maybe later.
- alarms that break silent mode. the web can't.
- streaks.

## how reminders work without an app

a web page can't schedule a local notification (chrome's notification triggers have sat behind a flag since 2022), so a tiny server sends a web push at each scheduled time.

1. the phone works out the next 14 days of reminder times itself and sends `PUT /plan/<device>` with the push subscription and a list of `{ key: "2026-10-17T08:00", at }`. no names, no doses.
2. a cloudflare worker routes each device to its own sqlite-backed durable object, which stores the list and calls `setAlarm()` for the earliest one.
3. the alarm sends the push (rfc 8291 `aes128gcm` encryption and an es256 vapid token, all web crypto, about 100 lines in `worker/src/push.ts`, checked byte for byte against the rfc's example), queues one follow-up 30 minutes later, and re-arms for the next item.
4. the service worker wakes, reads the plan it saved in indexeddb, and writes the notification on the phone: "Morning medicines", "Metformin 500 mg and Vitamin D3, after food." with taken and snooze buttons. each reminder uses its own dose amount. hide names in settings and it says "Time for your 8:00 medicines".
5. taken logs straight into indexeddb and tells the server to drop the follow-up. snooze re-arms in ten minutes. a tap opens `/dose/<key>`.

the free plan covers it: alarms count as requests and each `setAlarm()` is one row write, about 15 of each per person a day against 100,000. no cron triggers are used.

iphones get pushes only once tend is on the home screen, and without action buttons, so a tap lands on the dose sheet. onboarding shows the add to home screen steps there. permission and reminder setup have separate progress states: successful setup shows a check mark and “Let’s go”; a stalled connection offers retry or continue.

## installed app updates

the Android home-screen app loads the deployed website. Tend tries the network first on each fresh navigation and falls back to its cached page offline or after a slow connection. new scripts and styles have unique filenames, and the service worker activates updates without requiring a reinstall.

after a deployment finishes, close Tend from recent apps and reopen it while online to load the latest version. returning to an already-open screen can keep its existing code running. medicines, logs and settings stay stored on the device during normal updates.

## pip

pip is one svg with two quadratic-curve eyes. each eye blends between a pill (a short stroke with round caps) and an arc, so happy is a smile of arches and asleep is a pair of cups. gaze, size and the curve run on closed-form springs at 120 hz, written straight to the nodes, never through react. pip blinks, glances about, follows the pointer, squashes when poked, and stops its loop when off screen or the tab is hidden. under reduced motion the poses just fade.

## the design

- **headspace's warmth with our own parts.** one round character, soft scenes instead of photos, big rounded controls, very few words. the house rule of one physical object is waived for this one.
- **teal means log it.** `#0e8576` is the only colour on controls and it means due now. the four routine scenes (sunrise, noon, dusk, night) are backgrounds only. taken isn't green and not logged isn't red.
- **a night mode that earns it.** the bedtime dose gets checked in a dark room, so dark follows the system, and once bedtime is logged today turns navy and pip goes to sleep whatever the theme.
- **type.** gabarito for greetings, titles, times and buttons, rethink sans for names, doses and everything you read. both ofl, self-hosted as latin and latin-ext woff2, preloaded, with arial fallbacks tuned by size-adjust and ascent, descent and line-gap overrides so nothing jumps when they load.
- **one layout per size.** a bottom tab bar on phones, a rail in landscape and on tablets, a context panel from 1024 where the dose and medicine details open, and a sidebar with keys from 1440.
- **pickers belong to the app.** time and date controls use Tend sheets, colours and touch targets instead of opening a separate native picker. sheets follow the visible viewport when the keyboard opens.
- **installed, it feels installed.** standalone with no url bar, an animated pip splash with matching ios launch images, and theme colours for the status bar.

## keyboard

| key | does |
|---|---|
| `t` | take what is due |
| `z` | snooze 10 minutes |
| `s` | skip what is due |
| `enter` | open the due dose |
| `n` | add a medicine |
| `1` to `5` | today, medicines, history, routines, you |
| `⌘ z` | undo |
| `esc` | close a sheet or panel |

## the stack

react 19, vite 8, tailwind 4, typescript 7, biome 2 with a pre-commit hook, node 24. no ui or animation libraries: sheets, swipes, springs and view transitions are hand written. the reminder server is a cloudflare worker with a durable object. sounds are synthesised in web audio and haptics are named `navigator.vibrate` patterns.

## running it

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # scheduling, doses, saved-data editing, shorthand and time zones
npm run build

cd worker
npm install
npm run keys         # prints a vapid key pair
npm test             # rfc 8291 and vapid checks
npm run dev          # http://localhost:8787
```

for reminders locally, put the private key in `worker/.dev.vars` as `VAPID_PRIVATE='{...}'` with `VAPID_PUBLIC=...`, and in `.env.local` set `VITE_PUSH_URL=http://localhost:8787` and `VITE_VAPID_PUBLIC=...`. the service worker only registers in a production build, so use `npm run build && npx vite preview`.

the live worker is `tend-push` on workers.dev. its public key sits in `wrangler.toml` and `.env.production` (both public by design: they end up in the browser anyway), and the private key is a worker secret. a new key pair means `wrangler secret put VAPID_PRIVATE`, both public copies updated, `npm run deploy`, and everyone turning reminders on again.

`node scripts/og.mjs` renders `public/og.jpg` from `scripts/og.html`.

## the shape of it

```
src/
  app/          layout modes, nav (tab bar, rail, sidebar), theme, shortcuts
  screens/      Welcome, Today, DoseSheet, Medicines, MedicineDetail, MedicineEdit,
                History, Routines, You, NotFound, PipLab (dev only, /pip)
  components/   Pip, Scene, Sheet, SwipeRow, MedRow, DayRing, WeekRings, ...
  lib/          schedule, medicine-draft, medicine-fields, shorthand, dose-format, db, push,
                actions, today, route, sound, haptics, ics, backup
public/         sw.js, manifest, icons, splash, fonts with their licences
worker/         the reminder server
```

## known rough edges

- the icon set and every line of copy are still waiting on a final pick.
- an installed android app shows chrome's own splash for a moment before pip's.
- if nobody opens the app for 14 days the plan runs dry. the last reminder says so.
- not yet checked on real phones, with voiceover or talkback, or at the largest text sizes.
