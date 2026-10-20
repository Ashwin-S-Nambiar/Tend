<p align="center">
  <a href="https://tend.ashwin.co.in">
    <img src="./docs/screenshots/today-tablet.webp" width="100%" alt="Tend on an Android tablet: a navigation rail, Apidra due before dinner with Take, Snooze and Skip, later reminders, and a side panel with this week, running low and the current course">
  </a>
</p>

<p align="center">
  <a href="https://tend.ashwin.co.in"><strong>tend.ashwin.co.in</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Ashwin-S-Nambiar/Tend/releases/latest/download/tend.apk">download the apk</a>
  &nbsp;·&nbsp;
  <a href="#what-it-does">what it does</a>
  &nbsp;·&nbsp;
  <a href="#running-it">running it</a>
</p>

<br>

tend is a gentle medicine reminder for android. add what you take and when, and pip, a small teal capsule, taps you on the shoulder at each time. reminders are exact alarms on the phone, Taken and Snooze work from the notification, and nothing leaves the device: no account, no server.

this repo holds the app in [`android/`](./android/README.md) and its page at the root, served at [tend.ashwin.co.in](https://tend.ashwin.co.in). the screenshots use sample medicines; they show the app, not a treatment plan.

## what it does

<p align="center">
  <img src="./docs/screenshots/today-phone.webp" width="30%" alt="Today: Time for Apidra, 6 units before dinner, with Take, then Amoxicillin, Metformin and Lantus later, Paracetamol when needed and Metformin running low">
  &nbsp;
  <img src="./docs/screenshots/notification-phone.webp" width="30%" alt="A Tend notification over Today: Dinner medicines, Apidra 6 units before food, with Taken, Snooze 10 min and Skip">
  &nbsp;
  <img src="./docs/screenshots/night-phone.webp" width="30%" alt="After the last dose: a navy sky with a moon, Pip asleep and All done for today, 9 of 9 logged">
</p>

- **times around your day.** link a medicine to waking, a meal or bedtime, or give it a clock time. move breakfast and everything tied to it moves too. weekends can have their own times.
- **different doses at different times,** like 14, 8 and 6 units of insulin across meals. tend records the plan; it never calculates doses.
- **alarms on the minute,** with a follow-up 30 minutes later if nothing is logged. they survive reboots, clock and zone changes and updates.
- **log from the notification.** Taken, Snooze 10 min and Skip work without opening the app. with names hidden, the lock screen just says "Time for your 8:00 AM medicines".
- **logging that forgives.** take a group or one medicine, swipe a row to skip it, or long-press Take and spin the wheel to when you actually took it. everything has Undo.
- **every kind of medicine.** tablets, capsules, liquids, insulin, injections, inhalers, drops, creams and patches each get their own fields.
- **flexible schedules.** every day, some weekdays, every few days, on-and-off cycles, once, or when needed with gaps and limits. courses end on their own.
- **shorthand and label scanning.** `Metformin 500mg 1-0-1 PC` fills the form, or the camera reads the label on the device.
- **refills.** each dose takes from the count, and tend warns when about a week is left.
- **history without streaks.** a ring per day for the last week and a percentage per medicine over 30 days.
- **widgets, shortcuts, travel and backup.** home-screen widgets, long-press shortcuts, home time or local time when you travel, a medicines card, a calendar export and a json backup.

<p align="center">
  <img src="./docs/screenshots/medicines-phone.webp" width="23%" alt="The Medicines list: Metformin with 6 left and refill soon, Apidra, Lantus, Vitamin D3, Paracetamol and Amoxicillin on day 3 of 5">
  &nbsp;
  <img src="./docs/screenshots/medicine-phone.webp" width="23%" alt="Apidra's detail page: 14, 8 and 6 units 15 minutes before each meal, 212 units left, and the last two weeks of logs">
  &nbsp;
  <img src="./docs/screenshots/history-phone.webp" width="23%" alt="History: a ring for each of the last seven days and the share of doses taken per medicine over 30 days">
  &nbsp;
  <img src="./docs/screenshots/dark-phone.webp" width="23%" alt="Today in the dark theme: navy surfaces with the teal Take button">
</p>

### adding a medicine and logging a dose

the editor has three steps: what you take, when, and a review showing each dose at its real reminder time. the dose menu snoozes, skips, or logs a different time on the wheel.

<p align="center">
  <img src="./docs/screenshots/editor-phone.webp" width="23%" alt="The medicine step: name and medicine type, with Insulin selected">
  &nbsp;
  <img src="./docs/screenshots/schedule-phone.webp" width="23%" alt="The schedule step: meal times, a reminder 15 minutes before meals, and 14 units at breakfast at 7:45 AM">
  &nbsp;
  <img src="./docs/screenshots/dose-phone.webp" width="23%" alt="The dose menu: Snooze 10 min, Snooze 30 min, Taken at another time, Choose medicines, Skip in red and Cancel">
  &nbsp;
  <img src="./docs/screenshots/wheel-phone.webp" width="23%" alt="The When did you take it? sheet with an hour, minute and AM/PM wheel set to 8:15 PM">
</p>

on tablets and foldables, a rail replaces the tab bar and lists sit beside their details.

<p align="center">
  <img src="./docs/screenshots/medicines-tablet.webp" width="80%" alt="Medicines on a tablet: the list beside Apidra's details, refill status and the last two weeks of logs">
</p>

## how reminders work

`core/Reminders.kt` turns schedules into reminders and follow-ups. only one alarm is armed at a time, for the earliest upcoming one. when it rings, `Alarms.ring` posts everything due and arms the next. any change to the data re-arms it and clears notifications for doses already logged, so a dose taken in the app never rings later. the notification buttons run the same pure actions as the screens (`core/Actions.kt`).

## the design

the object is pip's day: sunrise, noon, dusk and night, each with its own wash, orb and hill. teal is the one action colour.

- **pip.** a capsule whose eyes run on hand-written springs: gaze, blink, poke and a few moods. the page runs the same rig on inline svgs.
- **type.** gabarito for headings and buttons, rethink sans for reading.
- **sheets.** one component: drawer curve, 1:1 drag, rubber-banding, flick to close, predictive back. a centred dialog from 600dp.
- **sound and touch.** every sound is synthesized, paired with a named haptic, and silenced by animator scale 0.
- **night.** after the last bedtime dose, today turns navy with a sleeping pip, and the bars go navy with it in either theme.
- **the page.** a day told from a 7:45 am dose to a 10:30 pm one, with screenshots in css device frames and the notification drawn in html. nothing shifts as it loads.

## the stack

| layer | choices |
| --- | --- |
| app | kotlin 2.4, jetpack compose, kotlinx.serialization, ml kit text recognition; no navigation or material libraries |
| page | static html, css and two small typescript modules, built with vite 8 |
| tooling | biome, playwright for the share image, github actions for signed releases |
| hosting | vercel for the page, github releases for the apk |

## running it

the app needs jdk 17 and the android sdk with platform 37; see [`android/README.md`](./android/README.md) for building and releasing.

the page needs node 24:

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # lint and format
npm run build
```

`node scripts/og.mjs` renders the share image.

## the shape of it

```text
android/        the app
index.html      the page
src/            the download dock, pip's eye rig and the page's css
public/         fonts, icons, app screenshots, share image and 404 page
docs/           readme screenshots
scripts/        share image rendering
```

## known rough edges

- **not on the play store.** installing means allowing your browser to install apps once, and updates are a newer download installed over the top.
- **oem battery savers.** autostart screens move between os versions; tend falls back to battery settings, then the app's own page.
- **label scanning** reads latin script only and works best on flat labels.
- **android only.** there's no ios app.
- **accessibility** still needs a talkback and largest-font pass on a real phone.

<details>
<summary><strong>the page</strong></summary>

<br>

![The marketing page on desktop: Your medicines, on time, with Pip leaning on the full stop, Download for Android, and a phone showing Today on a sunrise-yellow sky](./docs/screenshots/site-desktop.webp)

<p align="center">
  <img src="./docs/screenshots/site-phone.webp" width="32%" alt="The marketing page on a phone: the headline, Download for Android and How to install, and the Today screen below">
</p>

</details>

## references

the medicine fields draw on NHS guidance for [insulin](https://www.nhs.uk/medicines/insulin/rapid-acting-insulin/how-and-when-to-take-rapid-acting-insulin/), [topical treatments](https://www.nhs.uk/medicines/mometasone-for-skin/how-and-when-to-use-mometasone-for-skin/), [patches](https://www.nhs.uk/medicines/buprenorphine-for-pain/how-and-when-to-use-buprenorphine/), [inhalers](https://www.nhs.uk/medicines/salbutamol-inhaler/how-and-when-to-use-salbutamol-inhalers/) and [drops](https://www.nhs.uk/medicines/dexamethasone-eye-drops/how-and-when-to-use-dexamethasone-eye-drops/). tend records a prescribed plan; it does not give treatment advice.
