# VizMinder A4

VizMinder A4 is an Android-focused React Native / Expo application for context-aware visual reminders. It carries forward the visual design language from `VizMinder-MAD`: a soft Material-inspired interface, visual-first reminder rows, bottom search/add dock, pill-style bottom navigation, and a low-friction full-screen Yes/No reminder prompt.

This version is built as an Assessment 4 app foundation rather than a throwaway prototype. It keeps the VizMinder interaction model while adding the required mobile development technologies: Firebase, SQLite, device capabilities, notifications, background work, testing, and build readiness.

## Implemented Requirements

| A4 requirement | Implementation |
| --- | --- |
| Functional screens and navigation | Home, Schedule, Map, Account, Settings, Add/Edit, and Reminder Prompt screens with VizMinder-style bottom navigation and data passing through selected reminder objects. |
| Firebase Authentication | Anonymous sign-in service in `src/services/firebase.js`; falls back to offline demo mode when credentials are not configured. |
| Firebase Firestore | Reminder sync service writes user reminders to `users/{uid}/reminders`; disabled safely without credentials. |
| Firebase Test Lab | Project is prepared for APK/build testing; Test Lab evidence should be captured after building an APK. |
| SQLite / relational storage | `expo-sqlite` stores reminders in a local `reminders` table for reliable offline use. |
| Device capability: notifications | `expo-notifications` schedules local reminders and opens the in-app prompt when notifications are received or tapped. |
| Device capability: GPS/maps | `expo-location` attaches current coordinates; `react-native-maps` displays reminders with markers. |
| Device capability: media | `expo-image-picker` lets users attach photos as visual reminder cues. |
| Battery | `expo-battery` displays current battery level in Settings. |
| Parallel/background work | `expo-background-task` and `expo-task-manager` register a reminder sweep task. |
| Testing | Jest is configured with initial unit tests for reminder model logic. |
| No hard-coded secrets | Firebase configuration is read from `app.json` `extra` values and can be moved to environment-driven config for production. |

## Setup

```bash
npm install
npm start
```

For Android export validation:

```bash
npm run export:android
```

For tests:

```bash
npm test
```

## Firebase Configuration

The app runs in offline demo mode without Firebase credentials. To enable Firebase, set these values in `app.json` under `expo.extra`:

- `firebaseApiKey`
- `firebaseAuthDomain`
- `firebaseProjectId`
- `firebaseStorageBucket`
- `firebaseMessagingSenderId`
- `firebaseAppId`

Do not commit real secrets or production credentials.

## Main Packages

- [`expo`](https://www.npmjs.com/package/expo): managed React Native runtime.
- [`react-native-paper`](https://www.npmjs.com/package/react-native-paper): Material Design components.
- [`firebase`](https://www.npmjs.com/package/firebase): Authentication and Firestore integration.
- [`expo-sqlite`](https://www.npmjs.com/package/expo-sqlite): local relational storage.
- [`expo-notifications`](https://www.npmjs.com/package/expo-notifications): local scheduled notifications.
- [`expo-location`](https://www.npmjs.com/package/expo-location): GPS coordinates for context-aware reminders.
- [`react-native-maps`](https://www.npmjs.com/package/react-native-maps): map and marker display.
- [`expo-image-picker`](https://www.npmjs.com/package/expo-image-picker): photo visual cues.
- [`expo-background-task`](https://www.npmjs.com/package/expo-background-task): registered background sweep task.
- [`expo-battery`](https://www.npmjs.com/package/expo-battery): battery status evidence.
- [`jest-expo`](https://www.npmjs.com/package/jest-expo): test runner preset for Expo.

## Known Limitations

- Full lock-screen alarm style behavior requires native Android work and a development build; Expo Go cannot fully emulate system alarm UI.
- Firebase Test Lab evidence must be collected after an APK/AAB build is produced.
- Firestore sync is one-way in the current prototype; conflict resolution should be added before production use.
- Location reminders store coordinates, but geofencing is not yet implemented.
