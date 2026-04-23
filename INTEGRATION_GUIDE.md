# 🔗 Connecting Dashboard to Discord Bot

This guide shows you how to integrate the dashboard with your existing Discord music bot so it displays **real player data** instead of mock data.

## Quick Integration (5 minutes)

### Step 1: Import the Dashboard Bridge

Add this to the top of your player event handler file (e.g., `src/events/voiceStateUpdate.js` or wherever you handle player events):

```javascript
const dashboardBridge = require('../../dashboard-bridge');
```

### Step 2: Update Track When It Starts Playing

Find where your player emits the "track start" event. Add this code:

```javascript
// Example with discord-player
const { useMainPlayer } = require('discord-player');
const player = useMainPlayer();

player.events.on('playerStart', (queue, track) => {
    // Send to dashboard
    dashboardBridge.updateTrack(queue.guild.id, {
        title: track.title,
        artist: track.author,
        albumArt: track.thumbnail,
        duration: Math.floor(track.durationMS / 1000),
        url: track.url
    });
    
    // Update queue
    dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
});
```

### Step 3: Update Play/Pause State

```javascript
player.events.on('playerPause', (queue) => {
    dashboardBridge.updatePlayState(queue.guild.id, false);
});

player.events.on('playerResume', (queue) => {
    dashboardBridge.updatePlayState(queue.guild.id, true);
});
```

### Step 4: Update Queue When Tracks Are Added

```javascript
player.events.on('audioTrackAdd', (queue, track) => {
    dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
});

player.events.on('audioTracksAdd', (queue, tracks) => {
    dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
});
```

### Step 5: Clear State When Player Stops

```javascript
player.events.on('emptyQueue', (queue) => {
    dashboardBridge.clearState(queue.guild.id);
});
```

### Step 6: Update Volume and Loop Mode

```javascript
// If you have a volume command (src/commands/volume.js)
// After changing volume:
const { useQueue } = require('discord-player');
const queue = useQueue(interaction.guild.id);

if (queue) {
    dashboardBridge.updateVolume(interaction.guild.id, newVolume);
}

// If you have a loop command (src/commands/loop.js)
// After changing loop mode:
const loopMode = queue.repeatMode === 0 ? 'off' : 
                 queue.repeatMode === 1 ? 'track' : 'queue';
dashboardBridge.updateLoopMode(interaction.guild.id, loopMode);
```

## Complete Example Integration

Here's a complete example file you can reference:

### File: `src/events/player-dashboard-sync.js`

```javascript
const { useMainPlayer } = require('discord-player');
const dashboardBridge = require('../../dashboard-bridge');

module.exports = {
    name: 'player-dashboard-sync',
    once: false,
    
    execute(client) {
        const player = useMainPlayer();
        
        // Track starts playing
        player.events.on('playerStart', (queue, track) => {
            console.log('📊 [Dashboard] Updating track:', track.title);
            
            dashboardBridge.updateTrack(queue.guild.id, {
                title: track.title,
                artist: track.author,
                albumArt: track.thumbnail,
                duration: Math.floor(track.durationMS / 1000),
                url: track.url
            });
            
            dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
        });
        
        // Player paused
        player.events.on('playerPause', (queue) => {
            console.log('📊 [Dashboard] Player paused');
            dashboardBridge.updatePlayState(queue.guild.id, false);
        });
        
        // Player resumed
        player.events.on('playerResume', (queue) => {
            console.log('📊 [Dashboard] Player resumed');
            dashboardBridge.updatePlayState(queue.guild.id, true);
        });
        
        // Track added to queue
        player.events.on('audioTrackAdd', (queue, track) => {
            console.log('📊 [Dashboard] Track added to queue');
            dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
        });
        
        // Multiple tracks added
        player.events.on('audioTracksAdd', (queue, tracks) => {
            console.log('📊 [Dashboard] Multiple tracks added');
            dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
        });
        
        // Queue is empty
        player.events.on('emptyQueue', (queue) => {
            console.log('📊 [Dashboard] Queue empty, clearing state');
            dashboardBridge.clearState(queue.guild.id);
        });
        
        // Track skipped
        player.events.on('playerSkip', (queue, track) => {
            console.log('📊 [Dashboard] Track skipped');
            dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
        });
        
        // Error occurred
        player.events.on('playerError', (queue, error) => {
            console.error('📊 [Dashboard] Player error:', error);
        });
        
        console.log('✅ Dashboard sync events registered');
    }
};
```

Then in your `src/core/loader.js`, make sure this event file is loaded:

```javascript
// Load all event files
const eventFiles = fs.readdirSync('./src/events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`../events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}
```

## Testing the Integration

1. **Start your Discord bot:**
   ```bash
   npm start
   ```

2. **Start the dashboard:**
   ```bash
   npm run dashboard
   ```

3. **Play a song in Discord** using your bot commands

4. **Open the dashboard** at `http://localhost:3000`

5. **You should see:**
   - The current playing song (real data)
   - The queue (real tracks)
   - Recently played tracks
   - Real play/pause state

## Troubleshooting

### Dashboard still shows mock data

**Problem:** The dashboard continues to show placeholder data.

**Solution:** 
- Make sure the bot is running
- Play a song using the bot commands
- Refresh the dashboard page
- Check the console for "📊 [Dashboard]" log messages

### Cannot control bot from dashboard

**Problem:** Clicking play/pause doesn't work.

**Solution:**
This is expected! The current setup only syncs data **from bot → dashboard**. 

To add **dashboard → bot control**, you need to implement one of these:

1. **WebSocket communication** (recommended)
2. **HTTP endpoints** in your bot
3. **Redis pub/sub**

See `examples/dashboard-integration.js` for detailed examples.

### Player state not updating in real-time

**Problem:** Have to refresh to see changes.

**Solution:**
Add WebSocket support for real-time updates:

```bash
npm install socket.io
```

Then modify `server.js` to emit events to connected clients when state changes.

## Next Steps

### 1. Add Real-time Updates with WebSocket

Currently, you need to refresh the page to see updates. Add socket.io for live updates!

### 2. Add Bot Control from Dashboard

Allow the dashboard to control the bot (play, pause, skip, etc.) by:
- Setting up API endpoints in your bot
- Using WebSocket commands
- Implementing Redis pub/sub

### 3. Add More Features

- Search for songs from dashboard
- Create and manage playlists
- View bot settings and configuration
- Add filters and equalizer controls

## Need Help?

Check these files:
- `examples/dashboard-integration.js` - More integration examples
- `dashboard-bridge.js` - The bridge API reference
- `DASHBOARD_README.md` - Full dashboard documentation

---

**You're almost done! Just add the event handlers and you'll have a fully functional dashboard! 🎉**
