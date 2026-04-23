# ✅ Setup Verification Checklist

Run through these steps to verify everything is working:

## 1. Start the Server

```bash
node src/index.js
```

### ✅ Expected Output:
```
═══════════════════════════════════════
✅ Socket.io Server initialized
   Transport: websocket only
   CORS: origin matching enabled
═══════════════════════════════════════
✅ Dashboard Server Running
🌐 URL: http://localhost:3000
🔗 Login: http://localhost:3000/login
🔌 Socket.io: Ready and listening
═══════════════════════════════════════
```

**❌ If you DON'T see this:** The server didn't start. Check for errors above.

---

## 2. Test Socket Connection (Minimal Test)

Open browser: **http://localhost:3000/test-socket**

### ✅ Expected:
- Page loads showing your Discord username
- Console logs show "✅ CONNECTED!"
- You see "Received player:update" with data

**❌ If connection fails:** Check the full error logged in browser console.

---

## 3. Login & Access Dashboard

1. Go to: **http://localhost:3000/login**
2. Authorize with Discord
3. You'll be redirected to `/dashboard`

### ✅ Expected:
- Page loads without errors
- Header shows green dot + "Connected"
- UI shows placeholders (gray album art, "—" for title)

**❌ If stuck on "Connecting...":**
- Open browser console (F12)
- Look for the error in the logged output
- Check server terminal for "Authentication failed" message

---

## 4. Select Guild

Click "Select Server" button in header OR add to URL:
```
http://localhost:3000/dashboard?guild_id=YOUR_GUILD_ID
```

### ✅ Expected Browser Console:
```
Joining guild: 123456789012345678
✅ Received player:update
   Status: idle
   Has track: false
   Queue size: 0
```

### ✅ Expected Server Terminal:
```
📥 [join-guild] Socket ABC123 joined guild:123456789012345678
✅ [join-guild] Sent initial state to socket ABC123: {
  hasTrack: false,
  queueSize: 0,
  isPlaying: false
}
```

**❌ If no data received:**
- Check if guild ID is correct (right-click server in Discord → Copy ID)
- Check if bot is in that guild
- Check server console for errors

---

## 5. Play a Song (via Discord)

In Discord, use a slash command:
```
/play Never Gonna Give You Up
```

### ✅ Expected Browser Console:
```
✅ Received player:update
   Status: playing
   Has track: true
   Queue size: 0
   Full data: { currentTrack: {...}, ... }
```

### ✅ Expected Dashboard UI:
- Album art appears
- Song title and artist show
- Progress bar fills
- Play button changes to Pause
- Time shows (e.g., "0:05 / 3:32")

**❌ If UI doesn't update:**
- Check if the bot actually started playing (check Discord voice channel)
- Check server terminal for "Emitted update to guild" log
- Check browser console for player:update event

---

## 6. Test Dashboard Controls

Click **Play/Pause** button in dashboard.

### ✅ Expected:
- Music pauses in Discord
- Browser console shows emission
- Server shows received event
- UI updates (Pause → Play icon)

**Test each control:**
- ✅ Skip - Next track plays
- ✅ Previous - Previous track plays (if available)
- ✅ Shuffle - Queue shuffles
- ✅ Loop - Loop mode cycles
- ✅ Volume - Changes volume in Discord
- ✅ Seek - Jumps to timestamp

---

## 7. Test Playlist Modal

1. Click sidebar "Playlists"
2. Click "Electro Mix" card

### ✅ Expected:
- Modal opens
- "Loading tracks..." appears
- Track list loads (20+ songs)
- Each song has a Play button
- "Play All" button at top

**Click "Play All":**
- Modal closes
- Toast shows "Playing playlist (XX tracks)"
- Queue view shows all tracks
- Music starts playing

---

## 8. Test Queue Management

With tracks in queue:

**Click "Clear All":**
- ✅ All tracks removed
- ✅ "No songs in queue" message appears

**Click "X" on a track:**
- ✅ That track removed
- ✅ Queue re-numbers automatically

---

## 9. Check Recently Played

Let a song finish playing completely.

### ✅ Expected:
- Song appears in "Recently Played" section
- Shows "just now" or "X min ago"
- Appears in both Queue view and History view

---

## 10. Test Search

1. Click sidebar "Search"
2. Type "Electronic Music"
3. Click Search

### ✅ Expected:
- "Searching..." appears
- Results load (10 tracks)
- Each has a Play button
- Clicking Play adds to queue and starts

---

## ✅ All Tests Pass?

**Congratulations! Your dashboard is fully functional.**

Features working:
- ✅ Real-time updates via Socket.io
- ✅ Interactive seeking
- ✅ Spotify-style playlists
- ✅ Queue management
- ✅ History tracking
- ✅ Toast notifications
- ✅ Resilient connection handling

---

## ❌ Tests Failing?

See **SOCKET_DEBUG_GUIDE.md** for detailed troubleshooting.

Common fixes:
1. Clear browser cache and cookies
2. Restart the server
3. Re-login via /login
4. Check .env file for correct Discord credentials
5. Ensure bot is online and in the guild
