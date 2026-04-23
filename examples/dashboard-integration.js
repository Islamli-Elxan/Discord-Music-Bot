/**
 * Example: Integrating Dashboard with Discord Bot
 * 
 * This file demonstrates how to connect your web dashboard
 * to your Discord bot's music player using events.
 * 
 * You would integrate this into your existing bot code.
 */

// ============================================
// METHOD 1: Using EventEmitter (Simple)
// ============================================

const EventEmitter = require('events');
const dashboardEvents = new EventEmitter();

// In your Discord bot's player code (src/music/player.js or similar):
// Emit events when player state changes

/*
// Example in your player code:
const { useQueue } = require('discord-player');

// When a track starts
player.events.on('playerStart', (queue, track) => {
    dashboardEvents.emit('trackStart', {
        guildId: queue.guild.id,
        track: {
            title: track.title,
            author: track.author,
            url: track.url,
            duration: track.duration,
            thumbnail: track.thumbnail
        }
    });
});

// When queue updates
player.events.on('audioTrackAdd', (queue, track) => {
    dashboardEvents.emit('queueUpdate', {
        guildId: queue.guild.id,
        queue: queue.tracks.data.map(t => ({
            title: t.title,
            author: t.author,
            duration: t.duration,
            thumbnail: t.thumbnail,
            requestedBy: t.requestedBy?.username
        }))
    });
});
*/

// In your server.js, listen to these events:
module.exports.setupDashboardIntegration = (client) => {
    
    // Store player states for each guild
    const playerStates = new Map();

    dashboardEvents.on('trackStart', (data) => {
        playerStates.set(data.guildId, {
            currentTrack: data.track,
            isPlaying: true,
            timestamp: Date.now()
        });
    });

    dashboardEvents.on('queueUpdate', (data) => {
        const state = playerStates.get(data.guildId) || {};
        state.queue = data.queue;
        playerStates.set(data.guildId, state);
    });

    // API endpoint to get player state
    return {
        getPlayerState(guildId) {
            return playerStates.get(guildId) || {
                currentTrack: null,
                isPlaying: false,
                queue: []
            };
        }
    };
};


// ============================================
// METHOD 2: Using WebSocket (Real-time)
// ============================================

/*
// Install socket.io:
// npm install socket.io

const { Server } = require('socket.io');

// In server.js:
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('Dashboard client connected:', socket.id);

    // Join guild-specific rooms
    socket.on('join-guild', (guildId) => {
        socket.join(`guild-${guildId}`);
    });

    // Handle player controls from dashboard
    socket.on('player:play', async (data) => {
        const { guildId } = data;
        // Call your bot's play function
        // await bot.player.resume(guildId);
        
        // Broadcast to all connected clients
        io.to(`guild-${guildId}`).emit('player:status', {
            isPlaying: true
        });
    });

    socket.on('player:pause', async (data) => {
        // Similar to play
    });

    socket.on('player:skip', async (data) => {
        // Similar to play
    });
});

// In your Discord bot, emit events:
player.events.on('playerStart', (queue, track) => {
    io.to(`guild-${queue.guild.id}`).emit('track:start', {
        title: track.title,
        author: track.author,
        thumbnail: track.thumbnail
    });
});
*/


// ============================================
// METHOD 3: Using Redis Pub/Sub (Scalable)
// ============================================

/*
// Install redis:
// npm install redis

const redis = require('redis');
const publisher = redis.createClient();
const subscriber = redis.createClient();

// In your Discord bot:
player.events.on('playerStart', (queue, track) => {
    publisher.publish('bot:player:track', JSON.stringify({
        guildId: queue.guild.id,
        track: {
            title: track.title,
            author: track.author,
            thumbnail: track.thumbnail
        }
    }));
});

// In server.js:
subscriber.subscribe('bot:player:track');

subscriber.on('message', (channel, message) => {
    const data = JSON.parse(message);
    
    // Update in-memory cache or broadcast via WebSocket
    console.log('Track update:', data);
});
*/


// ============================================
// SIMPLE EXAMPLE FOR YOUR CURRENT SETUP
// ============================================

// Add this to your src/music/player.js or wherever you handle player events:

/*
const dashboardBridge = require('../../dashboard-bridge');

// Inside your player event handlers:
player.events.on('playerStart', (queue, track) => {
    dashboardBridge.updateTrack(queue.guild.id, {
        title: track.title,
        artist: track.author,
        albumArt: track.thumbnail,
        duration: Math.floor(track.durationMS / 1000),
        currentTime: 0
    });
});

player.events.on('playerPause', (queue) => {
    dashboardBridge.updatePlayState(queue.guild.id, false);
});

player.events.on('playerResume', (queue) => {
    dashboardBridge.updatePlayState(queue.guild.id, true);
});
*/

// Then create dashboard-bridge.js:
/*
const playerStates = new Map();

module.exports = {
    updateTrack(guildId, track) {
        const state = playerStates.get(guildId) || {};
        state.currentTrack = track;
        state.isPlaying = true;
        playerStates.set(guildId, state);
    },

    updatePlayState(guildId, isPlaying) {
        const state = playerStates.get(guildId) || {};
        state.isPlaying = isPlaying;
        playerStates.set(guildId, state);
    },

    getState(guildId) {
        return playerStates.get(guildId) || null;
    }
};
*/

// ============================================
// RECOMMENDED APPROACH FOR BEGINNERS
// ============================================

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  Dashboard Integration Guide                   ║
╚════════════════════════════════════════════════════════════════╝

To connect the dashboard to your bot:

1. Create a simple in-memory store (dashboard-bridge.js)
2. Update the store when player events fire
3. Read from the store in your API endpoints

Example flow:
Bot Player → Events → Update Store → Dashboard reads Store

This file shows examples of three methods:
- EventEmitter (simplest, single process)
- WebSocket (real-time, separate processes)
- Redis (scalable, production-ready)

Start with EventEmitter if bot and dashboard run together!
`);
