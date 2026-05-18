# Firebase Test Lab

VizMinder A4 is intended to be installed and tested as an APK, not run only through Expo Go.

## Build APK

```bash
npm run build:apk
```

The local release APK is generated at:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Copy it to the Test Lab input path:

```text
build/vizminder-a4.apk
```

If you still want to use EAS cloud build, run:

```bash
npm run build:apk:eas
```

## Run Firebase Test Lab Robo Test

```bash
npm run test:firebase-lab
```

This runs a Firebase Test Lab Robo test on a current virtual Android phone profile:

```bash
gcloud firebase test android run \
  --type robo \
  --app ./build/vizminder-a4.apk \
  --device model=MediumPhone.arm,version=35,locale=en,orientation=portrait
```

If Google changes the device catalog, run this first and replace the model/version with an available pair:

```bash
gcloud firebase test android models list
```

## Evidence To Capture

- Firebase Test Lab device matrix result
- Robo crawl video
- Logcat output
- Screenshots from the run
- Any crash or accessibility warnings

These screenshots/logs should be included in the Assessment 4 testing and deployment report.
