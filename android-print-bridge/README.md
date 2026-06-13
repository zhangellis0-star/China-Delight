# China Delight Android Print Bridge

Small Android app for manual Epson kitchen printing from a restaurant tablet.

The current website printing route stays unchanged and remains the backup:

- Website backup print route: `POST /api/admin/print-ticket`
- Android payload route: `GET /api/admin/print-ticket/payload?orderNumber=ORDER_NUMBER`
- Printer: Epson network receipt printer at `192.168.1.172:9100`
- Transport from tablet to printer: raw TCP ESC/POS

## Authentication

The ticket payload endpoint is protected by the normal China Delight admin session.

This app includes an embedded WebView. Staff should tap **Open admin login**, log in to the admin screen inside the app, and then use **Fetch ticket** or **Print order**. The app reuses the admin session cookies stored by the WebView and sends them to:

`https://chinadelightct.com/api/admin/print-ticket/payload?orderNumber=...`

No admin password, Supabase key, service role key, printer secret, or other secret is stored in the app.

## Build APK

Open this folder in Android Studio:

`android-print-bridge/`

Then:

1. Let Android Studio sync Gradle.
2. Choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. The debug APK will be created under:

`app/build/outputs/apk/debug/app-debug.apk`

Command-line build, if Android Studio/Gradle is installed:

```bash
gradle assembleDebug
```

This repository does not include an Android Gradle wrapper. Android Studio can create one later if desired.

## Install APK On Tablet

1. Enable developer options on the Android tablet.
2. Enable USB debugging.
3. Connect the tablet by USB.
4. In Android Studio, press **Run**.

Or copy `app-debug.apk` to the tablet and open it, allowing installation from that source when Android prompts.

## Print A Test Ticket

1. Connect the tablet to the same restaurant Wi-Fi/LAN as the Epson printer.
2. Open the app.
3. Confirm printer IP is `192.168.1.172`.
4. Confirm printer port is `9100`.
5. Tap **Print test ticket**.
6. The app opens a raw TCP socket to the printer, writes a simple ESC/POS test ticket, and reports success or failure.

## Print A Real Order

1. Open the app.
2. Tap **Open admin login**.
3. Log in to the China Delight admin page inside the app.
4. Enter an order number.
5. Tap **Fetch ticket** to confirm the protected payload can be loaded.
6. Tap **Print order**.
7. The app decodes `escposBase64`, opens a TCP socket to the Epson printer, writes the bytes, and reports success only after the socket write completes.

## Limitations

- The tablet and printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi or client isolation can block access to `192.168.1.172`.
- Android battery optimization or sleep settings can interrupt staff workflow; the app requests the screen to stay awake while open.
- A successful socket write means bytes were sent to the printer, but it cannot prove the paper physically printed.
- If the printer IP changes, update the IP field in the app.
- The app is for manual printing first. Auto-printing can be added later after the manual workflow is stable.

## Backup

Keep the Windows/server print route available during testing. If the tablet bridge fails, staff can still use the current website kitchen print path.
