# QR Code Verification System

A complete QR code-based user verification system for tracking gate and washroom entry/exit with both QR scanning and manual code fallback options.

## 📋 Features

- **User Registration**: Register users and generate unique QR codes and manual codes
- **QR Code Scanning**: Scan QR codes to track gate and washroom entry/exit
- **Manual Code Verification**: Fallback option using 6-digit alphanumeric codes
- **Dual Tracking**: Separate tracking for gate and washroom access
- **Status Toggle**: Automatic IN/OUT status toggling
- **Admin Dashboard**: View all registered users and their current status

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js
- **QR Code Generation**: qrcode library
- **QR Code Scanning**: html5-qrcode library
- **Other**: CORS, Body-Parser

## 📦 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 12 or higher)
- npm (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

## 🚀 Installation Steps

### Step 1: Clone or Download the Repository

If using Git:
```bash
git clone https://github.com/JuhiGoyal/qr-entries.git
cd qr-entries
```

Or download and extract the ZIP file, then navigate to the project folder.

### Step 2: Install Dependencies

Open PowerShell or Command Prompt in the project directory and run:
```bash
npm install
```

This will install all required dependencies:
- express
- qrcode
- body-parser
- cors

### Step 3: Configure IP Address

**Important**: You need to update the IP address in the code files to match your local network IP.

1. Find your IP address:
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)

2. Update the following files with your IP address:
   - `index.js` (line 35): Change `http://192.168.137.1:3000` to `http://YOUR_IP:3000`
   - `manual.html` (line 25): Change `http://192.168.137.1:3000` to `http://YOUR_IP:3000`
   - `scanner.html` (line 37): Change the fetch URL to use your IP address

### Step 4: Start the Server

Run the following command:
```bash
node index.js
```

You should see:
```
Server running on port 3000
```

## 📱 How to Use

### 1. Register a User

**Option A: Using curl (PowerShell)**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/register" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"name":"John Doe","email":"john@example.com","phone":"1234567890"}'
```

**Option B: Using Postman or similar API tool**
- URL: `POST http://localhost:3000/register`
- Headers: `Content-Type: application/json`
- Body (JSON):
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890"
  }
  ```

**Response** will include:
- User details
- QR code (base64 image)
- Manual code (6-digit alphanumeric)
- Scan URL

### 2. Display QR Code

1. Copy the QR code data (base64 string) from the registration response
2. Open `showqr.html` in a text editor
3. Replace the existing QR code data in line 10 with your new QR code
4. Open `showqr.html` in a web browser to display the QR code

### 3. Scan QR Code

1. Open `scanner.html` in a web browser (preferably on a mobile device with a camera)
2. Allow camera permissions when prompted
3. Select the scan type (Gate or Washroom) from the dropdown
4. Point the camera at the QR code
5. The system will automatically scan and update the user's status
6. View the result displayed on the page

### 4. Manual Code Verification

If QR scanning is not available:

1. Open `manual.html` in a web browser
2. Enter the 6-digit manual code provided during registration
3. Select the action type (Gate or Washroom)
4. Click "Submit"
5. View the verification result

### 5. View All Users (Admin)

Access the admin dashboard to see all registered users:
```
http://localhost:3000/users
```

Or using PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/users" | Select-Object -ExpandProperty Content
```

## 📡 API Endpoints

### POST `/register`
Register a new user and generate QR code + manual code

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string"
}
```

### GET `/scan/:id?action=gate|washroom`
Scan QR code to update user status

**Parameters:**
- `id`: User ID
- `action`: Either "gate" or "washroom"

### GET `/manual?code=XXXXXX&action=gate|washroom`
Verify using manual code

**Query Parameters:**
- `code`: 6-digit manual code
- `action`: Either "gate" or "washroom"

### GET `/users`
Retrieve all registered users

## 🔧 Troubleshooting

### Camera Not Working
- Ensure you're using HTTPS or localhost
- Grant camera permissions in browser settings
- Try a different browser (Chrome recommended)

### Cannot Connect from Other Devices
- Verify your firewall allows connections on port 3000
- Ensure all devices are on the same network
- Double-check IP address configuration

### QR Code Not Displaying
- Verify the base64 string is complete and properly formatted
- Check browser console for errors
- Ensure the image data includes the `data:image/png;base64,` prefix

### Server Won't Start
- Check if port 3000 is already in use
- Verify all dependencies are installed (`npm install`)
- Check for syntax errors in modified files

## 📝 Notes

- This is an in-memory system (data resets when server restarts)
- For production use, implement a proper database
- QR codes are generated with the server's IP address - update this for different networks
- Status automatically toggles between IN and OUT on each scan
