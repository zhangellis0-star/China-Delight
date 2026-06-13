# Android Print Bridge Phase 1

This project still prints kitchen tickets through the existing server route:

- `POST /api/admin/print-ticket`
- Epson printer: `192.168.1.172:9100`
- Transport: raw TCP ESC/POS

Phase 1 adds a protected payload endpoint for a future Android tablet app:

- `GET /api/admin/print-ticket/payload?orderNumber=CD-123456-ABC`
- `POST /api/admin/print-ticket/payload` with `{ "orderNumber": "CD-123456-ABC" }`

The endpoint returns JSON with:

- `success`
- `orderNumber`
- `printerHost`
- `printerPort`
- `contentType: application/vnd.china-delight.escpos`
- `escposBase64`

It does not print. It uses the same ESC/POS ticket builder as the current server print route, including scheduled pickup emphasis.

## Future Android App Flow

1. Staff opens the China Delight Android app on the restaurant tablet.
2. The tablet is on the same Wi-Fi/LAN as the Epson printer.
3. The app loads the admin/orders screen.
4. Staff taps Kitchen Print.
5. The app calls the protected payload endpoint for the order number.
6. The app decodes `escposBase64` into raw bytes.
7. The app opens a TCP socket to Epson `192.168.1.172:9100`.
8. The app writes the bytes to the socket and closes it.
9. The app shows success or failure.

## Backup

The Windows/server print route remains the production backup until tablet printing is tested and stable.

## Not Needed

- Bluetooth is not needed.
- AirPrint is not needed for the thermal kitchen ticket.
- Android Chrome should not be expected to open raw TCP sockets directly.

## Risks

- Tablet and printer must be on the same Wi-Fi/LAN.
- Guest Wi-Fi or LAN isolation can block the tablet from reaching the printer.
- Android sleep or battery optimization can stop a bridge app unless the tablet is configured to stay awake.
- Printer IP changes will break printing until the app or env config is updated.
- A TCP write confirms bytes were sent; it does not prove paper successfully printed.
