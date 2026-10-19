# Tend for Android: handoff

Start here when building the native Android app. Design and features are signed off; development has not started.

- **Branch:** `native-android` (from `main` at `d7823ba`). Do all work here.
- **Design canvas:** https://claude.ai/artifact/L9fjiAcA4a1SZo4kNe99Xw (36 boards, 9 pages). Read it with the Artifact tool (`action: "read"`), not a web fetch. It is the source of truth for layout, copy, colours and states. Comments left on it reach the session that watches it.
- **Animation guidance:** use the `/apple-design` skill for springs, sheets, gestures and the splash.
- **House rules:** `.claude/CLAUDE.md` applies. The object is Pip's day (sun, noon, dusk, night scenes); teal is the one action colour.

## Decisions (final)

| question | answer |
| --- | --- |
| where it lives | this repo, `android/` folder; web stays at the root |
| distribution | GitHub Releases only, no Play Store |
| package id | `in.co.ashwin.tend` (Kotlin namespace `co.ashwin.tend`, because `in` is a Kotlin keyword) |
| reminders | local exact alarms on the phone; no server |
| log-time picker | the wheel (hour, minute, AM/PM) |
| label scanning | in v1 (on-device text recognition, fills the shorthand box) |
| after launch | the website becomes Tend's marketing page and `worker/` (Cloudflare push) is deleted |

## Features

Full parity with the web app, plus:

1. **Animated splash.** A solid (not translucent) launcher theme so Android draws the system splash during the icon zoom; no black frame. Cream `#faf7f3` in light, navy `#0e1528` in dark (`values-night`). Yellow `#ffc845` icon circle; Pip rises, hops, then hands off to Today. Boards: `Splash`, `SplashNight`.
2. **Exact local alarms.** `SCHEDULE_EXACT_ALARM` with a fallback to inexact; re-arm on boot, time change, time-zone change and app update. Follow-up 30 min later if nothing is logged.
3. **Notifications.** Channels: Doses, Follow-ups, Refills, Travel. Taken, Snooze 10 min and Skip actions work without opening the app. When names are hidden, a public lock-screen version says "Time for your 8:00 AM medicines". Boards: `Notifications`, `LockScreen`.
4. **Onboarding permissions.** Notifications, exact alarms, and a "keep running in the background" link for Xiaomi, Oppo and Vivo autostart and battery settings. Board: `WelcomeReminders`.
5. **Widgets and shortcuts.** A next-dose widget with Take and Snooze, a week-rings widget, a small next-dose widget, long-press shortcuts (Log a dose, Add medicine, Today), and a monochrome themed icon. Board: `HomeScreen`.
6. **Native sheets.** Drag, flick shut, predictive back, detents for the medicines card. Haptics and synthesized sounds (generate PCM; ship no audio files) are skipped under reduced motion / animator scale 0.
7. **History** shows the last 7 days, not the calendar week.
8. **Backup and restore** in the same JSON format as the web app (`src/lib/backup.ts`), so web users can move over. Also opt into Android Auto Backup.
9. **Tablets and foldables.** A navigation rail, list and detail side by side, and a context pane on Today. Boards: `TabletToday`, `TabletMedicines`.
10. **Release workflow.** A GitHub Actions workflow builds a signed APK when a `v*` tag is pushed and attaches it to the GitHub Release. The keystore and its passwords go in repo secrets; never commit them. The user declined creating a key earlier in the session, so ask before generating one.

## Porting the logic

Port these one-to-one to pure Kotlin (no Android imports) and port their tests from `tests/` too:

- `src/lib/types.ts`: the data model. Keep JSON field names identical for backup compatibility. `Anchor` is either `{routine, offsetMin, amount?}` or `{time, amount?}`; `Schedule` is tagged by `kind`.
- `src/lib/time.ts`: day and due keys (`yyyy-MM-dd`, `yyyy-MM-ddTHH:mm`), home-zone override. Use `java.time` with `activeZone = homeZone ?: systemDefault`.
- `src/lib/schedule.ts`: doses, groups, group states, PRN, stock, plan.
- `src/lib/today.ts`, `src/lib/actions.ts`: take, skip, snooze, unlog, with undo.
- `src/lib/dose-format.ts`, `src/lib/medicine-fields.ts`, `src/lib/medicine-draft.ts`, `src/lib/shorthand.ts`.
- `src/lib/ics.ts`, `src/lib/backup.ts`, `src/lib/travel.ts`.
- `src/lib/push.ts`: `entries()` is the notification text; replace the server sync with alarm scheduling.
- `src/components/Pip.tsx`: the eye rig (springs, blink, glance, poke) and body animations. `PipMoods` on the canvas shows every mood.

## Toolchain found on this Mac

- JDK 17: `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` (no system Java; set `JAVA_HOME`).
- Android SDK: `/opt/homebrew/share/android-commandlinetools` (platform `android-36`, build-tools `35.0.0`, licences accepted). `adb` is at `/opt/homebrew/bin/adb`.
- No Gradle installed. Download `gradle-9.8.1-bin.zip` into the scratchpad and run `gradle wrapper` once to commit a wrapper.
- Versions current as of 2026-10-19: AGP `9.4.1` (built-in Kotlin; don't apply `kotlin-android`), Kotlin `2.4.21` (compose and serialization plugins), Compose BOM `2026.09.00`, activity-compose `1.13.0`, core-ktx `1.19.1`, core-splashscreen `1.2.0`, lifecycle `2.11.0`, kotlinx-serialization-json `1.11.0`, coroutines `1.11.0`.
- Fonts: variable TTFs from `google/fonts` (`ofl/gabarito/Gabarito[wght].ttf`, `ofl/rethinksans/RethinkSans[wght].ttf`). Copy the OFL licences from `public/fonts/`.

## Gotchas already learned

- Bubblewrap/TWA templates use a translucent launcher theme. On HyperOS that shows a black rectangle during launch, which is the bug the user reported. Never use a translucent launch theme.
- Xiaomi (the user's phone) kills background alarms unless autostart is allowed; onboarding must explain it.
- Time labels like "8:00 AM" must never break mid-word; size controls so they fit at 320 dp.

## Sample data used on the canvas

Metformin 500 mg tablet after breakfast and dinner (6 left, refill soon); Apidra insulin 14 / 8 / 6 units 15 min before meals; Lantus 24 units at bedtime; Amoxicillin 500 mg capsule three times a day, day 3 of 5; Vitamin D3 60,000 IU Saturdays; Paracetamol 650 mg when needed (6 h apart, up to 4 a day). Today is Monday 19 Oct 2026.
