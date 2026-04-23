# 🔌 Socket.io Connection Debugging Guide

## Quick Test Checklist

### 1️⃣ Start the Bot
```bash
node src/index.js
```

**Expected Terminal Output:**
```
═══════════════════════════════════════
✅ Socket.io Server initialized
   Transport: websocket only
   CORS: origin matching enabled
═══════════════════════════════════════
═══════════════════════════════════════
✅ Dashboard Server Running
🌐 URL: http://localhost:3000
🔗 Login: http://localhost:3000/login
🔌 Socket.io: Ready and listening
═══════════════════════════════════════
```

### 2️⃣ Open Dashboard
1. Go to: `http://localhost:3000/login`
2. Login with Discord
3. You'll be redirected to `/dashboard`
4. Add `?guild_id=YOUR_GUILD_ID` to the URL

**Example:** `http://localhost:3000/dashboard?guild_id=123456789012345678`

### 3️⃣ Check Browser Console (F12)

**Expected Console Output:**
```
═══════════════════════════════════════
🔌 Initializing Socket.io connection...
   Target: http://localhost:3000
   Transport: websocket
═══════════════════════════════════════
✅ Socket.io client initialized
═══════════════════════════════════════
✅ Socket CONNECTED!
   Socket ID: ABC123xyz
   Guild ID: 123456789012345678
═══════════════════════════════════════
Joining guild: 123456789012345678
═══════════════════════════════════════
✅ Received player:update
   Status: idle (or playing)
   Has track: false (or true)
   Queue size: 0
   Full data: { ... }
═══════════════════════════════════════
```

### 4️⃣ Check Terminal (VS Code)

**Expected Terminal Output (after browser connects):**
```
🔌 [Socket.io] Handshake attempt: {
  sessionID: 'xxx',
  hasSession: true,
  hasUser: true,
  userID: '123456789',
  userName: 'YourUsername'
}
✅ [Socket.io] User authenticated: 123456789
✅ NEW SOCKET CONNECTED: ABC123xyz User: 123456789
📥 [join-guild] Socket ABC123xyz joined guild:123456789012345678
✅ [join-guild] Sent initial state to socket ABC123xyz: {
  hasTrack: false,
  queueSize: 0,
  isPlaying: false
}
```

---

## 🚨 Troubleshooting

### ❌ Error: "Connecting..." (Red Dot Forever)

**Possible Causes:**

1. **Session Cookie Not Sent**
   - Check browser DevTools → Application → Cookies
   - Look for `connect.sid` cookie for `localhost:3000`
   - If missing, clear browser cache and login again

2. **CORS Blocked**
   - Check browser console for CORS errors
   - Server uses `origin: true` which should match any origin
   - Try accessing dashboard from the EXACT same origin as login

3. **Port Mismatch**
   - Client connects to `http://localhost:3000`
   - Server must run on port `3000` (or update client code)

4. **Websocket Blocked by Firewall/Proxy**
   - Check if websocket upgrade request succeeds in Network tab
   - Look for "101 Switching Protocols" response
   - If blocked, change server to allow `polling` fallback

### ❌ Error: "Authentication required"

**Terminal shows:**
```
❌ [Socket.io] Authentication failed: No user in passport
```

**Fix:**
1. Make sure you logged in via `/login` first
2. Session must have `req.user` set by Passport
3. Check `dashboard.config.js` has correct Discord OAuth credentials

### ❌ Browser Console: "connect_error"

**Full error logged:**
```
❌ Socket Connection Error
Error message: xhr poll error
Error type: TransportError
```

**Possible Fixes:**
- Server not running → Start with `node src/index.js`
- Port blocked → Check firewall settings
- CORS issue → Server logs will show handshake failures

---

## 🔧 Advanced Debugging

### Enable Verbose Socket.io Logging

**Client-side (dashboard.ejs):**
Add before `io()`:
```javascript
localStorage.debug = '*';
```

**Server-side (server.js):**
Set environment variable:
```bash
DEBUG=socket.io:* node src/index.js
```

### Test Without Authentication
Use the test file:
```
http://localhost:3000/test-socket-connection.html
```
This bypasses authentication to isolate connection issues.

---

## ✅ Success Indicators

**Browser UI:**
- Green dot next to "Connected"
- Album art appears (or gray placeholder if no song)
- Song title shows (or "—" if idle)
- Queue section shows tracks or "No songs in queue"

**Browser Console:**
- No red errors
- All checkmarks (✅) visible
- "Received player:update" with data object

**Server Terminal:**
- "NEW SOCKET CONNECTED" appears
- "Sent initial state" appears
- No "Authentication failed" errors

---

## 📝 Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Red dot stuck | No session cookie | Login again, check cookies |
| "No guild ID" modal | Missing URL param | Add `?guild_id=...` to URL |
| Broken images | Missing album art | Images use fallback automatically |
| Buttons don't work | JavaScript error | Check console for errors |
| "Must be in voice channel" | Permission check | Join voice in Discord first |

---

## 🎯 Next Steps If Still Failing

1. **Check `.env` file** - Ensure Discord credentials are correct
2. **Restart completely** - Stop server, clear browser cache, restart
3. **Try different browser** - Rule out browser-specific issues
4. **Check Discord Bot** - Ensure bot is online and in the guild
5. **Verify Guild ID** - Get it from Discord (right-click server → Copy ID)
