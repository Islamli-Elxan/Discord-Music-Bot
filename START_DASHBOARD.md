# 🚀 Quick Start: Dashboard

## Step 1: Start the Bot

```bash
node src/index.js
```

**Wait for this output:**
```
✅ Dashboard Server Running
🌐 URL: http://localhost:3000
```

## Step 2: Login

Open browser: **http://localhost:3000/login**

Authorize with Discord → You'll be redirected to `/dashboard`

## Step 3: Select Guild

### Option A: URL Parameter (Recommended)
Add your Discord server ID to the URL:
```
http://localhost:3000/dashboard?guild_id=YOUR_GUILD_ID
```

### Option B: Use the Modal
Click "Select Server" button in the dashboard header

## Step 4: Verify Connection

**Browser Console (F12) should show:**
```
✅ Socket CONNECTED!
✅ Received player:update
```

**VS Code Terminal should show:**
```
✅ NEW SOCKET CONNECTED: [socket-id] User: [your-discord-id]
```

## ✅ Ready!

You should see:
- ✅ Green dot (Connected)
- Album art or gray placeholder
- Song info or "—"
- Working play/pause controls

---

## 🔍 Still Not Working?

See `SOCKET_DEBUG_GUIDE.md` for detailed troubleshooting.
