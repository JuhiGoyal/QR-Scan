...existing code...
# QR Code Verification System

A small, self-hosted QR code verification system to track gate and washroom IN/OUT status for users. The project includes a backend server (one example with MongoDB and one simple in-memory demo), QR generation, file-based PNG storage, and a small frontend for registration, scanning and admin operations.

## Contents
- Backend:
  - [`app.js`](app.js) — MongoDB-backed server (recommended)
  - [`index.js`](index.js) — simple in-memory server (for quick testing)
- Frontend UI:
  - Registration & QR display: [frontend/register.html](frontend/register.html), [frontend/qr.html](frontend/qr.html)
  - Scanner: [frontend/scanner.html](frontend/scanner.html)
  - Manual verify: [frontend/manual.html](frontend/manual.html)
  - Admin dashboard & update: [frontend/dashboard.html](frontend/dashboard.html), [frontend/update.html](frontend/update.html)
- Generated QR files: `qr-codes/` (served at the `/qr` route by [`app.js`](app.js))

## Features
- Register users and generate a unique QR (PNG) and manual code
- Scan QR to toggle gate or washroom status (`/scan/:id?action=gate|washroom`)
- Manual fallback via code (`/manual?code=XXXXXX&action=gate|washroom`)
- Admin list (`/users`) and update (`/update`) endpoints
- QR PNGs saved to `qr-codes/` and served statically via `/qr/:filename`

## Quick start

1. Install
```bash
npm install
```

2. Configure
- For MongoDB mode, create a `.env` file with:
```
MONGO_URI=your_mongo_connection_string
```
- The frontend and some server code reference a local IP (default `http://192.168.137.1:3000`). Replace that IP with your machine IP in frontend files if necessary.

3. Run
- MongoDB-backed server:
```bash
node app.js
```
- In-memory demo:
```bash
node index.js
```

Server listens on port `3000` by default.

## API Endpoints (implemented in [`app.js`](app.js))
- POST `/register` — register a user and generate QR + manual code (see registration payload in [frontend/register.html](frontend/register.html))
- GET `/scan/:id?action=gate|washroom` — universal QR scan handler
- GET `/manual?code=XXXXXX&action=gate|washroom` — manual code fallback
- GET `/users` — list all users (admin)
- POST `/update` — update user details by manual code

Reference symbols: [`User`](app.js) model and its fields.

## How the QR flow works
1. Register via `/register` (frontend or API) → server generates `manualCode` and a PNG QR stored in `qr-codes/` and sets `qrCode` to `/qr/<id>.png`.
2. Scan QR (mobile camera + [html5-qrcode](https://github.com/mebjas/html5-qrcode) used in frontends) → scanner calls `/scan/:id?action=...`.
3. `/scan` toggles IN/OUT for requested resource and returns updated user info.

## Notes & Troubleshooting
- If using cameras from a phone, prefer HTTPS or localhost to avoid permission issues.
- If cameras don't work, use manual code flow in [frontend/manual.html](frontend/manual.html).
- If you see "Server running on port 3000" in logs, the server started correctly.
- QR generation uses the server IP in the generated URL. Make sure it matches your network IP.
- For quick testing without MongoDB, run [`index.js`](index.js) (resets on restart).

## License
MIT

...existing code...