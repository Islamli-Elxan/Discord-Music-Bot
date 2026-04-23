# 🚀 Quick Start Guide

## Prerequisites

Your `.env` file should have:
```env
DISCORD_TOKEN=your_token
CLIENT_ID=your_client_id
CLIENT_SECRET=PU7dcf3due1y9MSoeVPbaztuc5si1aAG
CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=your_session_secret
PORT=3000
```

Generate session secret if needed:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Start Everything (Single Command)

```bash
node src/index.js
```

or

```bash
npm start
```

This starts:
- ✅ Discord Bot
- ✅ Web Dashboard (http://localhost:3000)
- ✅ Socket.io (real-time sync)

## Access Dashboard

1. Open: http://localhost:3000
2. Click "Login with Discord"
3. Authorize the application
4. Click "Select Server"
5. Choose your guild
6. Start controlling music!

## Features You Can Use Now

### Discord Commands

```
/play <song>          - Play a song
/electro              - Play Electro Mix
/rock                 - Play Rock Mix
/pause                - Pause/resume
/skip                 - Skip current track
/autoplay             - Enable infinite autoplay
/stop                 - Stop playback
/volume <1-100>       - Set volume
/queue                - View queue
/shuffle              - Shuffle queue
/loop <off|track|queue> - Set loop mode
/nowplaying           - Current track
```

### Dashboard Features

**Queue Tab:**
- View now playing (large album art)
- See "Up Next" queue
- Recently played tracks
- Control playback from bottom bar

**Playlists Tab:**
- Click "Electro Mix" → instant playlist
- Click "Rock Mix" → instant playlist
- Both auto-shuffle and loop

**Search Tab:**
- Type song name
- Click Search or press Enter
- Click Play button on any result
- Instant playback

**History Tab:**
- View last 50 played tracks
- Updates in real-time
- Shows "time ago"

**Bottom Player Bar (Always Visible):**
- Album art + song info
- Shuffle button
- Previous button
- Play/Pause button (icon changes with state)
- Skip button
- Loop button (purple when active)
- Volume slider
- Progress bar

## Testing Autoplay

1. Play a song: `/play linkin park numb`
2. Enable autoplay: `/autoplay`
3. Wait for the song to end
4. Bot automatically plays a related music track
5. **Will NOT play**: TV shows, podcasts, remixes, slowed versions

The autoplay algorithm:
- ✅ Searches for music by same artist/genre
- ✅ Filters non-music content
- ✅ Avoids duplicates
- ✅ Infinite playback

## Testing Dashboard

### Play/Pause Sync:
1. Click Play/Pause on dashboard
2. Icon switches: Play ↔ Pause
3. Bot pauses/resumes in Discord voice channel

### Volume Sync:
1. Move volume slider on dashboard
2. Bot volume changes in voice channel
3. Change volume in Discord with `/volume 80`
4. Dashboard slider updates automatically

### Search & Play:
1. Go to Search tab
2. Type "imagine dragons believer"
3. Click Search
4. Click Play on any result
5. Track starts playing immediately

### Playlists:
1. Go to Playlists tab
2. Click "Electro Mix" or "Rock Mix"
3. Playlist loads, shuffles, and starts playing
4. Loops automatically

### History:
1. Play several songs
2. Go to History tab
3. See all recently played tracks
4. Updates in real-time

## Troubleshooting

### Dashboard buttons don't work:
- Check console for errors
- Make sure Socket.io is connected
- Verify you selected a server

### Autoplay plays non-music:
- The filter is strict; if it happens, please report the track
- Keywords will be updated

### Volume not syncing:
- Make sure bot is in a voice channel
- Check `DASHBOARD_REQUIRE_VOICE_CHANNEL` in `.env`

### Can't select server:
- Make sure bot is in at least one guild
- Check OAuth2 scopes include `guilds`

## Environment Variables

### Required:
```env
DISCORD_TOKEN=...
CLIENT_ID=...
CLIENT_SECRET=...
CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=...
```

### Optional:
```env
DASHBOARD_REQUIRE_VOICE_CHANNEL=true   # Require user in voice channel to control
PORT=3000                              # Dashboard port
NODE_ENV=production                    # Production mode
```

## Next Steps

1. ✅ Start the bot: `node src/index.js`
2. ✅ Open dashboard: http://localhost:3000
3. ✅ Login with Discord
4. ✅ Select your server
5. ✅ Play music from dashboard or Discord
6. ✅ Enable autoplay for infinite music

## File Structure

```
Nicraen-Bot/
├── server.js                  # Dashboard web server
├── dashboard-bridge.js        # Bot ↔ Dashboard sync
├── dashboard.config.js        # Dashboard configuration
├── views/
│   ├── index.js              # Login page
│   └── dashboard.ejs          # Main dashboard UI
├── src/
│   ├── index.js              # Bot entry point ★ START HERE
│   ├── commands/             # Slash commands
│   └── ...
└── .env                       # Configuration (add CLIENT_SECRET here)
```

## Support

See full documentation:
- `DASHBOARD_CHANGELOG.md` - All changes
- `INTEGRATION_GUIDE.md` - Integration details
- `DASHBOARD_README.md` - Full docs

---

**Everything is ready! Just run `node src/index.js` and enjoy your music bot with a beautiful dashboard! 🎵**
