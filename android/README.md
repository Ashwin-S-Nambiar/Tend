# tend for android

how the app is built and released. the [main readme](../README.md) covers what it does.

## how it's put together

- **one data file.** `data/Repo` holds everything in one json file in memory, written off the main thread. android auto backup copies it. its field names match the old web app's backups, so those still restore.
- **pure logic.** `core/` is plain kotlin with `java.time` and no android imports (a test checks), so schedules, reminders, actions and undo are unit tested.
- **one alarm.** `alarm/Alarms` arms a single exact alarm for the earliest upcoming reminder, follow-up or refill check, falling back to inexact when exact alarms aren't allowed. every data change re-arms it and clears notifications for doses already logged.
- **notification buttons.** `ActionReceiver` applies the same actions as the screens and waits for the write to reach disk before returning.
- **no ui libraries.** navigation, sheets, controls and type are tend's own, on compose foundation.
- **reduced motion.** animator scale 0 turns movement into fades and silences haptics and sound.

```
android/app/src/main/java/co/ashwin/tend/
  core/       schedules, reminders, actions, formats (pure kotlin)
  data/       Repo
  alarm/      alarms, notifications, receivers, permission screens
  widget/     the three home-screen widgets
  feel/       haptics and synthesized sound
  ui/         theme, pip, scenes, sheets, controls, navigation, shell
  ui/screens/ today, dose sheet, medicines, editor, history, you, welcome
```

## running it

needs jdk 17 and the android sdk with platform 37.

```sh
cd android
./gradlew :app:testDebugUnitTest   # logic tests
./gradlew :app:installDebug        # installs "in.co.ashwin.tend.debug" beside a release build
```

debug builds take `tend://debug/sample` (sample medicines and a week of logs), `tend://debug/night` (the same with today logged, for the night scene) and `tend://debug/widgets` (renders the widgets as pngs into the cache folder), for example `adb shell am start -d tend://debug/sample`.

## releasing

push an annotated tag whose message is the release notes:

```sh
git tag -a v1.0.2 -m "- what changed, in a line someone using the app understands
- one line per change, three to five in all"
git push origin v1.0.2
```

`.github/workflows/android-release.yml` runs the tests, builds a signed apk and attaches it to the github release as `tend.apk`, with the tag's message as the notes (a plain tag gets github's generated notes). the version name comes from the tag and the version code from the run number. the name never changes, so the page's `releases/latest/download/tend.apk` link picks up each new release on its own; the release itself carries the version.

the workflow needs four repository secrets and refuses to publish without them:

| secret | what |
| --- | --- |
| `TEND_KEYSTORE_BASE64` | the release keystore, `base64 -i tend.jks` |
| `TEND_KEYSTORE_PASSWORD` | its password |
| `TEND_KEY_ALIAS` | the key's alias |
| `TEND_KEY_PASSWORD` | the key's password |

the keystore lives at `~/.tend-signing/tend-release.jks`, with its passwords in `tend-release.env` beside it, never in the repo. back that folder up: android only installs an update signed with the same key.

to sign a build locally:

```sh
set -a; . ~/.tend-signing/tend-release.env; set +a
./gradlew :app:assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

without those variables the apk comes out unsigned, and phones refuse to install it.

## known rough edges

- widgets refresh on every change and alarm, and at least every 30 minutes; after a reboot one can show the previous state for a moment.
