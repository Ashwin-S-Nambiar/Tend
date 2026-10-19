# tend for android

the android app: what tend is now. same pip, same day and same data model as the web app it replaced, with reminders that are real alarms on the phone instead of pushes from a server. the [main readme](../README.md) covers the features; this one covers how it's built and released.

## what it does

everything the web app did, plus:

- **alarms on the minute.** each reminder is a local exact alarm (`SCHEDULE_EXACT_ALARM`, falling back to inexact when it isn't allowed). a follow-up comes 30 minutes later if nothing is logged. alarms re-arm after a reboot, a clock or time-zone change, and an app update. there is no server and no account.
- **Taken, Snooze 10 min and Skip on the notification.** they work without opening the app. channels for doses, follow-ups, refills and travel, so each can sound different. with names hidden, the lock screen shows "Time for your 8:00 AM medicines" and nothing else.
- **an animated splash.** the system splash and pip's rise share one frame, so there is no black flash on any phone (the bug the installed web app had on HyperOS).
- **onboarding that asks once, plainly.** notifications, alarms on the minute, and a link to the autostart and battery screens that xiaomi, oppo, oneplus, realme and vivo use to stop background alarms.
- **widgets and shortcuts.** a next-dose widget with Take and Snooze, a small next-dose widget, a week-rings widget, long-press shortcuts (Log a dose, Add medicine, Today) and a themed monochrome icon.
- **label scanning.** the camera button in prescription shorthand reads a label with on-device text recognition and fills the box. the photo never leaves the phone.
- **history shows the last 7 days,** ending today, rather than the calendar week.
- **backup and restore in the web app's json format,** so `tend-2026-10-19.json` from the browser opens here. android auto backup also copies the data file.
- **tablets and foldables.** a navigation rail, medicines and history as list and detail side by side, and a context pane beside today.

## how reminders work

`core/Reminders.kt` turns the schedule into a list of reminders and follow-ups, the same text the web push server sent. only one alarm is armed at a time, for the earliest of the next reminder, follow-up or the 9 am refill check. when it rings, `Alarms.ring` posts everything due since the last ring (or the last 20 minutes, after a reboot), then arms the next one. any change to the data re-arms it and clears notifications for doses that are now logged, so a dose taken in the app never rings later.

the notification buttons go to `ActionReceiver`, which applies the same pure actions the screens use (`core/Actions.kt`) and waits for the write to reach disk before the receiver returns.

## how the logic is shared

`core/` is a one-to-one port of `src/lib/` in pure kotlin with `java.time`: no android imports (a test checks). json field names match `types.ts` exactly, `Anchor` is told apart by the presence of `time`, and `Schedule` is tagged by `kind`. the web tests are ported in `app/src/test`, plus tests for reading a real web backup, round-tripping it without inventing fields, undo, and follow-ups.

## the design

the design canvas is the source of truth: https://claude.ai/artifact/L9fjiAcA4a1SZo4kNe99Xw. teal is the one action colour; sun, noon, dusk and night belong to pip's day.

- **sheets.** one component. on phones it rises on the drawer curve, follows the finger down 1:1, rubber-bands up, closes past 30% or on a flick, and the back gesture previews the close. from 600dp wide it's a centred dialog that rises 12dp from 0.97. the zone picker and medicines card have detents.
- **motion.** pip's eyes run on hand-written springs (response and damping), the body on the web's keyframes. presses sink to 0.96 in 80ms and spring back. screens slide by direction; tabs cross-fade. animator scale 0 turns movement into fades and silences haptics and sounds.
- **sound.** every sound is synthesized pcm (sine tones and band-passed noise with exponential envelopes), generated at runtime. no audio files.
- **sizes.** compact phones from 320dp (tighter padding and type), standard phones like the oneplus 13s, landscape phones (two columns and a slim rail), foldables and tablets (rail), and wide tablets (list and detail, context pane). times use a no-break space so "8:00 AM" never wraps.

## the stack

kotlin 2.4, jetpack compose (bom 2026.09), agp 9.4 with built-in kotlin, kotlinx.serialization, core-splashscreen, ml kit text recognition (bundled). no navigation or material libraries: the navigation stack, sheets, controls and type are tend's own.

## running it

needs jdk 17 and the android sdk with platform 37.

```sh
cd android
./gradlew :app:testDebugUnitTest   # the ported logic tests
./gradlew :app:installDebug        # installs "in.co.ashwin.tend.debug" beside a release build
```

## releasing

push a tag like `v1.0.0`. `.github/workflows/android-release.yml` runs the tests, builds a signed apk and attaches it to the github release. it needs four repository secrets, and refuses to publish without them:

| secret | what |
| --- | --- |
| `TEND_KEYSTORE_BASE64` | the release keystore, `base64 -i tend.jks` |
| `TEND_KEYSTORE_PASSWORD` | its password |
| `TEND_KEY_ALIAS` | the key's alias |
| `TEND_KEY_PASSWORD` | the key's password |

the keystore is not in the repo. it lives at `~/.tend-signing/tend-release.jks`, with its passwords in `tend-release.env` beside it, and the same values are in the repository secrets. back that folder up somewhere safe: android only installs an update signed with the same key, so losing it means everyone has to uninstall and reinstall.

to sign a build locally:

```sh
set -a; . ~/.tend-signing/tend-release.env; set +a
./gradlew :app:assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

an apk built without these variables comes out unsigned, and phones refuse to install it ("App not installed").

## the shape of it

```
android/app/src/main/java/co/ashwin/tend/
  core/      the shared logic, ported from src/lib (pure kotlin)
  data/      Repo: one json file in memory, written off the main thread
  alarm/     exact alarms, notifications, receivers, permission screens
  widget/    the three home-screen widgets
  feel/      haptics and synthesized sound
  ui/        theme, pip, scenes, pills, sheets, controls, navigation, shell
  ui/screens today, dose sheet, medicines, editor, history, you, welcome
```

## known rough edges

- the oem autostart screens move between os versions; when none is found tend opens battery optimisation settings, then the app's own settings page.
- widgets refresh on every change and every alarm, and at least every 30 minutes; a widget can show the previous state for a moment after a reboot.
- label scanning reads latin script only, and works best on a printed prescription or box rather than a curved bottle.
