# China Delight Android Print Bridge

Simple native Android app for manual Epson kitchen printing from the restaurant tablet.

The app does not depend on WebView for printing. It logs in through the existing admin login endpoint, loads recent active orders through the existing protected orders endpoint, fetches the existing ESC/POS ticket payload, and sends the decoded bytes to the Epson printer.

## Endpoints Used

- Admin login: `POST https://chinadelightct.com/api/admin/login`
- Recent orders: `GET https://chinadelightct.com/api/orders?status=all`
- Ticket payload: `GET https://chinadelightct.com/api/admin/print-ticket/payload?orderNumber=ORDER_NUMBER`
- Admin fallback in Chrome: `https://chinadelightct.com/admin`

No Supabase keys, service role keys, JSON key files, or other secrets are stored in the app.

## Printer

- IP: `192.168.1.172`
- Port: `9100`
- Protocol: raw TCP ESC/POS

## Build APK

From this folder:

```bash
./gradlew assembleDebug
```

On Windows PowerShell:

```powershell
.\gradlew.bat assembleDebug
```

APK path:

`app/build/outputs/apk/debug/app-debug.apk`

## Install APK On Tablet

1. Enable developer options on the Lenovo tablet.
2. Enable USB debugging.
3. Connect the tablet by USB and run from Android Studio, or copy/install the debug APK manually.

## Restaurant Use

1. Open the app.
2. Confirm printer IP `192.168.1.172` and port `9100`.
3. Tap **Test Print** to confirm tablet-to-printer connection.
4. Enter the admin password.
5. Tap **Log in**.
6. Tap **Load recent active orders**.
7. Tap **Print to Epson** on the order row.

Manual backup:

1. Type/paste an order number.
2. Tap **Fetch ticket**, then **Print order**.
3. Or tap **Fetch & Print**.

Fallback:

- Tap **Open Admin in Chrome** to view or manage orders in the normal website admin screen.

## Notes

- Tablet and printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi/client isolation can block access to `192.168.1.172`.
- A successful socket write means bytes were sent to the Epson printer; it cannot prove paper physically printed.
- If the printer IP changes, update the IP field and tap **Save settings**.
- No polling or auto-printing is included yet.
