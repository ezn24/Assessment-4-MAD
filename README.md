# VizMinder A4

VizMinder A4 is an Android-focused React Native app for visual-first reminders. It keeps the UI direction from `VizMinder-MAD`: Material-style surfaces, visual reminder cues, a bottom search/add dock, pill navigation, and a low-friction Yes/No reminder flow.

This version is intended to be installed as an APK, not run only in Expo Go. Native Android code is included for exact alarms and a full-screen reminder Activity.

## Features

- Visual reminders with a photo, Material icon, or emoji cue.
- Add, edit, search, toggle, delete, and swipe-delete reminder tasks.
- Risk warnings before destructive actions, plus Snackbar undo after deleting one reminder.
- Schedule tab with month distribution and clickable reminder rows.
- Daily repeat reminders and one-shot reminders.
- Native Android full-screen alarm path using `AlarmManager`, full-screen notification intent, and a lock-screen Activity.
- Firebase Authentication with anonymous fallback, email/password login, and Firestore sync.
- SQLite local persistence for offline and app-restart safety.
- Material 3 light/dark theme and optional dynamic color settings.
- Image picker with camera/gallery menu.
- Jest tests for reminder model behavior.

## Requirements

- Node.js 20+ and npm.
- Java JDK 17.
- Android SDK with platform tools and build tools installed.
- Android device or emulator for installed APK testing.
- Firebase project if cloud sync or Test Lab evidence is required.
- Google Cloud CLI if running Firebase Test Lab from the command line.

Check Android SDK environment variables:

```bash
echo $env:ANDROID_HOME
adb version
```

On Windows, a common SDK path is:

```text
C:\Users\<you>\AppData\Local\Android\Sdk
```

## Install

```bash
npm install
```

## Development

Expo Go can preview some React Native screens, but it cannot fully test native alarm behavior, exact alarms, or the custom lock-screen Activity. Use an installed APK for final verification.

```bash
npm start
```

The `npm start`, `npm run android`, and `npm run web` commands intentionally avoid shell-specific environment syntax so they work on Windows, macOS, and Linux.

For export validation:

```bash
npm run export:android
```

Run tests:

```bash
npm test
```

## Local APK Build

The project supports local Android builds through the checked-in `android` folder. APK builds should use the Gradle wrapper directly rather than a custom PowerShell, Bash, or Node helper script. This keeps the build path transparent and usable on Windows, macOS, and Linux. There is no required custom build script in `scripts/`.

Windows PowerShell:

```powershell
cd android
.\gradlew.bat assembleRelease
cd ..
```

macOS / Linux:

```bash
cd android
./gradlew assembleRelease
cd ..
```

Equivalent npm shortcuts are provided only as thin wrappers around the same Gradle commands:

```bash
npm run build:apk:windows
npm run build:apk:unix
```

Expected APK output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

The convenience copy used by the Test Lab script is:

```text
build/vizminder-a4.apk
```

If it is missing after a build:

```powershell
New-Item -ItemType Directory -Force build
Copy-Item android\app\build\outputs\apk\release\app-release.apk build\vizminder-a4.apk -Force
```

macOS / Linux equivalent:

```bash
mkdir -p build
cp android/app/build/outputs/apk/release/app-release.apk build/vizminder-a4.apk
```

## Firebase Setup

The app works offline without Firebase values. With Firebase configured, it supports anonymous fallback, email/password accounts, and Firestore reminder sync.

Create a Firebase project, then enable:

- Authentication: Anonymous provider.
- Authentication: Email/Password provider.
- Firestore Database.
- Test Lab, if assessment evidence requires automated device testing.

Prefer environment variables instead of editing `app.json` directly. Copy `.env.example` to `.env` and fill:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

These map to `app.config.js`, then into `expo.extra`:

```json
{
  "firebaseApiKey": "YOUR_API_KEY",
  "firebaseAuthDomain": "YOUR_PROJECT.firebaseapp.com",
  "firebaseProjectId": "YOUR_PROJECT_ID",
  "firebaseStorageBucket": "YOUR_PROJECT.appspot.com",
  "firebaseMessagingSenderId": "YOUR_SENDER_ID",
  "firebaseAppId": "YOUR_APP_ID"
}
```

Firestore path:

```text
users/{firebaseUserId}/reminders/{reminderId}
```

Do not commit production secrets. The `.env` file should stay local.

### Email/Password Sign-In

In Firebase Console:

1. Open your Firebase project.
2. Go to `Build > Authentication > Sign-in method`.
3. Enable `Email/Password`.
4. Build and install the APK.
5. In the app, open `Account`, enter email/password, then press `Register` or `Login`.

The app currently enforces this password rule before calling Firebase:

- At least 8 characters.
- At least 2 English letters.
- At least 6 numbers.

Troubleshooting:

- `Firebase: Error (auth/operation-not-allowed)`: the provider is disabled in Firebase Console. Enable `Email/Password` for email login/register.
- Firebase login works but sync fails: check Firestore rules and confirm the app is using the same `firebaseProjectId` as the Firebase Console project.

## Firebase Test Lab

Build the APK first:

```powershell
cd android
.\gradlew.bat assembleRelease
cd ..
New-Item -ItemType Directory -Force build
Copy-Item android\app\build\outputs\apk\release\app-release.apk build\vizminder-a4.apk -Force
```

Or on macOS / Linux:

```bash
cd android
./gradlew assembleRelease
cd ..
mkdir -p build
cp android/app/build/outputs/apk/release/app-release.apk build/vizminder-a4.apk
```

Then run:

```bash
npm run test:firebase-lab
```

If Google rejects a device model, list valid models:

```bash
gcloud firebase test android models list
```

Then update the script in `package.json` to a valid model/version pair.

## Android Alarm Notes

VizMinder uses native Android code for the installed APK alarm flow:

- `AlarmManager` schedules exact reminder alarms.
- `AlarmReceiver` creates a high-priority full-screen notification.
- `AlarmActivity` displays the Yes/No visual reminder UI over the lock screen where Android allows it.

Android may still require the user to allow:

- Notifications.
- Exact alarms.
- Full-screen notifications, on newer Android versions.

Some OEM lock-screen policies can block direct full-screen display until the screen wakes or the notification is tapped. The app avoids requesting device unlock; it only requests lock-screen display and screen wake.

## Main Packages

- [`expo`](https://www.npmjs.com/package/expo): React Native runtime and build tooling.
- [`react-native-paper`](https://www.npmjs.com/package/react-native-paper): Material 3 UI components.
- [`@pchmn/expo-material3-theme`](https://www.npmjs.com/package/@pchmn/expo-material3-theme): Android dynamic Material color extraction.
- [`firebase`](https://www.npmjs.com/package/firebase): Authentication and Firestore sync.
- [`expo-sqlite`](https://www.npmjs.com/package/expo-sqlite): offline local reminder persistence.
- [`@react-native-async-storage/async-storage`](https://www.npmjs.com/package/@react-native-async-storage/async-storage): app settings persistence.
- [`expo-notifications`](https://www.npmjs.com/package/expo-notifications): notification permissions and non-Android scheduling fallback.
- [`@react-native-community/datetimepicker`](https://www.npmjs.com/package/@react-native-community/datetimepicker): native Android date/time pickers.
- [`expo-image-picker`](https://www.npmjs.com/package/expo-image-picker): camera and gallery visual cues.
- [`react-native-gesture-handler`](https://www.npmjs.com/package/react-native-gesture-handler): native swipe-delete gesture.
- [`react-native-animatable`](https://www.npmjs.com/package/react-native-animatable): screen and list animations.
- [`react-native-confetti-cannon`](https://www.npmjs.com/package/react-native-confetti-cannon): completion celebration for important reminders.
- [`date-fns`](https://www.npmjs.com/package/date-fns): date formatting and countdown labels.
- [`react-native-calendars`](https://www.npmjs.com/package/react-native-calendars): Schedule month view.
- [`expo-haptics`](https://www.npmjs.com/package/expo-haptics): tactile feedback for completion and deletion.
- [`react-native-google-mobile-ads`](https://www.npmjs.com/package/react-native-google-mobile-ads): AdMob banner/interstitial/rewarded ad integration with defensive native-module fallback.
- [`jest-expo`](https://www.npmjs.com/package/jest-expo): Jest preset for Expo tests.

## Contributing Guide

1. Create a focused branch for each change.
2. Keep commits small and descriptive. Do not mix UI polish, native alarm changes, and Firebase changes in one commit unless they are tightly related.
3. Before changing screens, compare with the original VizMinder visual direction: soft Material surfaces, clear visual cues, bottom search/add dock, and low cognitive load.
4. Do not add default demo tasks unless the task specifically requires seeded data.
5. Native reminder changes must be tested on an installed APK, not only Expo Go.
6. Run `npm test` before committing JavaScript logic changes.
7. Run `npm run export:android` after React Native screen or dependency changes.
8. Run the Gradle wrapper directly after native Android, permissions, package, or alarm changes:
   - Windows: `cd android; .\gradlew.bat assembleRelease; cd ..`
   - macOS/Linux: `cd android && ./gradlew assembleRelease && cd ..`
9. Update this README when build steps, Firebase setup, permissions, or package responsibilities change.

## Known Limitations

- Full-screen lock-screen alarms depend on Android version, OEM policy, notification permission, exact alarm permission, and full-screen notification settings.
- Firestore sync currently uses simple last-write merging between local SQLite and cloud data.
- Image cues can consume local storage quickly; production builds should add image compression and cleanup for deleted reminders.
- Test Lab results are not bundled in the repository; capture screenshots/logs separately for assessment submission.
