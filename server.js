/**
 * Web Layer — Export createDashboard(client). Single-process: run from bot entry point.
 */

const express = require('express');
const http = require('http');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const dashboardConfig = require('./dashboard.config');
const dashboardBridge = require('./dashboard-bridge');

function createDashboard(client) {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // ——— Setup: Express, Session ———
    passport.use(new DiscordStrategy({
        clientID: dashboardConfig.oauth.clientId,
        clientSecret: dashboardConfig.oauth.clientSecret,
        callbackURL: dashboardConfig.server.callbackURL,
        scope: dashboardConfig.oauth.scopes
    }, (accessToken, refreshToken, profile, done) => {
        profile.accessToken = accessToken;
        return done(null, profile);
    }));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    const sessionMiddleware = session({
        secret: dashboardConfig.session.secret,
        resave: dashboardConfig.session.resave,
        saveUninitialized: dashboardConfig.session.saveUninitialized,
        cookie: dashboardConfig.session.cookie
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(sessionMiddleware);
    app.use(passport.initialize());
    app.use(passport.session());

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    function ensureAuthenticated(req, res, next) {
        if (req.isAuthenticated()) return next();
        res.redirect('/login');
    }

    app.get('/', (req, res) => {
        if (req.isAuthenticated()) return res.redirect('/dashboard');
        res.render('index', { user: req.user });
    });

    app.get('/login', passport.authenticate('discord'));

    app.get('/auth/callback',
        passport.authenticate('discord', { failureRedirect: '/' }),
        (req, res) => res.redirect('/dashboard')
    );

    app.get('/dashboard', ensureAuthenticated, async (req, res) => {
        const userGuilds = req.user.guilds || [];
        const guildId = req.query.guild_id || req.query.guild || (userGuilds[0]?.id);
        const state = dashboardBridge.getState(guildId);
        const hist = dashboardBridge.getHistory(guildId, 10);
        let autoplayEnabled = false;
        let autoplaySettings = {
            mode: "smart",
            exploration_rate: 20,
            block_explicit: 1,
            preferred_sources: "both"
        };
        try {
            const guildRow = await client.db.getGuildSettings(guildId);
            autoplayEnabled = !!guildRow?.autoplay;
            autoplaySettings = await client.db.getAutoplaySettings(guildId);
        } catch (e) {}
        const mock = {
            currentSong: { title: '—', artist: '—', albumArt: '', duration: 0, currentTime: 0 },
            queue: [],
            isPlaying: false,
            volume: 50
        };
        const defaultAlbumArt = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%233f3f46' width='200' height='200'/%3E%3Cpath fill='%239ca3af' d='M100 70v60l50-30zM80 65a15 15 0 1 1 0-30 15 15 0 0 1 0 30z'/%3E%3C/svg%3E";

        const formatTimeAgo = (date) => {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
            return Math.floor(seconds / 86400) + ' days ago';
        };
        
        res.render('dashboard', {
            user: req.user,
            selectedGuild: guildId,
            currentSong: state.currentTrack || mock.currentSong,
            queue: state.queue ?? mock.queue,
            isPlaying: state.isPlaying ?? mock.isPlaying,
            volume: state.volume ?? mock.volume,
            recentlyPlayed: hist.map(h => ({ ...h, playedAt: formatTimeAgo(h.playedAt) })),
            hasRealData: !!dashboardBridge.cache.get(guildId),
            loopMode: state.loopMode ?? 0,
            isShuffled: state.isShuffled ?? false,
            defaultAlbumArt,
            autoplayEnabled,
            autoplaySettings
        });
    });

    // ——— HTTP API: Bot guilds list (for debugging + optional UI) ———
    app.get("/api/guilds", ensureAuthenticated, async (req, res) => {
        try {
            const guilds = client.guilds.cache.map((guild) => ({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL({ dynamic: true, size: 64 }) || null,
                memberCount: guild.memberCount ?? null
            }));
            res.json({ success: true, guilds });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // ——— Dashboard HTTP API: EQ preset ———
    app.post("/api/eq", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = req.body?.guildId || req.body?.guild_id || req.query?.guildId || req.query?.guild_id;
            const preset = req.body?.preset;
            if (!guildId || !preset) {
                return res.status(400).json({ success: false, error: "Missing guildId or preset" });
            }
            const result = await dashboardBridge.handleSetEqPreset(String(guildId), req.user?.id, preset);
            if (result?.error) {
                return res.status(400).json({ success: false, error: result.error });
            }
            return res.json({ success: true, preset: result?.preset ?? preset });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // ——— Dashboard HTTP API: Smart Autoplay ———
    app.get("/api/:guildId/recommendations", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const queue = client.player.nodes.get(guildId);
            const currentTrack = queue?.currentTrack || null;
            if (!currentTrack) {
                return res.json({ success: true, tracks: [] });
            }
            const top = await require("./src/services/recommendationEngine").getTopRecommendations(
                guildId,
                currentTrack,
                10
            );
            const tracks = (top || []).map((t) => ({
                title: t.track?.title || "—",
                artist: t.track?.author || t.track?.artist || "—",
                url: t.track?.url || t.track?.id || "",
                score: t.score,
                why: t.why || {}
            }));
            return res.json({ success: true, tracks });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get("/api/:guildId/autoplay-stats", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const sessionMemory = require("./src/services/sessionMemory");
            const accuracy = sessionMemory.getPredictionAccuracy(guildId);
            const topGenres = sessionMemory.getTopGenresThisSession(guildId, 5);
            return res.json({ success: true, accuracy, topGenres });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // ——— Dashboard HTTP API: Smart Autoplay current settings ———
    app.get("/api/:guildId/autoplay-settings", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const guildRow = await client.db.getGuildSettings(guildId);
            const enabled = !!guildRow?.autoplay;
            const settings = await client.db.getAutoplaySettings(guildId);
            return res.json({ success: true, enabled, settings });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // ——— Dashboard HTTP API: EQ current preset ———
    app.get("/api/:guildId/eq", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const preset = await client.db.getEqPreset(guildId);
            return res.json({ success: true, preset });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // ——— Dashboard HTTP API: Analytics ———
    app.get("/api/:guildId/analytics/summary", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const summary = await client.db.getAnalyticsSummary(guildId);
            return res.json({ success: true, summary });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get("/api/:guildId/analytics/daily", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const daily = await client.db.getAnalyticsDaily(guildId, 7);
            return res.json({ success: true, daily });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get("/api/:guildId/analytics/top-tracks", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const topTracks = await client.db.getAnalyticsTopTracks(guildId, 10);
            return res.json({ success: true, topTracks });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get("/api/:guildId/analytics/top-listeners", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const listeners = await client.db.getAnalyticsTopListeners(guildId, 10);
            return res.json({ success: true, listeners });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get("/api/:guildId/analytics/genres", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const genres = await client.db.getAnalyticsGenres(guildId, 8);
            return res.json({ success: true, genres });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get("/api/:guildId/analytics/heatmap", ensureAuthenticated, async (req, res) => {
        try {
            const guildId = String(req.params.guildId);
            const heatmap = await client.db.getAnalyticsHeatmap(guildId);
            return res.json({ success: true, heatmap });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get('/logout', (req, res) => {
        req.logout(() => res.redirect('/'));
    });

    app.get('/test-socket', ensureAuthenticated, (req, res) => {
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Socket.io Connection Test</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        body { font-family: monospace; padding: 20px; background: #18181b; color: #e4e4e7; }
        .log { background: #27272a; padding: 10px; margin: 5px 0; border-radius: 5px; border-left: 3px solid #3f3f46; }
        .success { border-left-color: #22c55e; }
        .error { border-left-color: #ef4444; }
        .info { border-left-color: #3b82f6; }
        h1 { color: #d946ef; }
    </style>
</head>
<body>
    <h1>🔌 Socket.io Connection Test</h1>
    <p>Logged in as: <strong>${req.user.username}#${req.user.discriminator}</strong></p>
    <p>Testing connection to: <strong>http://localhost:${PORT}</strong></p>
    <div id="logs"></div>

    <script>
        const logEl = document.getElementById('logs');
        
        function log(msg, type = 'info') {
            const div = document.createElement('div');
            div.className = 'log ' + type;
            div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
            logEl.appendChild(div);
            console.log(msg);
        }

        log('🔌 Initializing Socket.io client...');
        
        const socket = io('http://localhost:${PORT}', {
            transports: ['websocket'],
            withCredentials: true,
            reconnection: true
        });

        socket.on('connect', () => {
            log('✅ CONNECTED! Socket ID: ' + socket.id, 'success');
            log('   Emitting test join-guild...', 'info');
            socket.emit('join-guild', 'test-guild-id');
        });

        socket.on('player:update', (data) => {
            log('✅ Received player:update!', 'success');
            log('   Data: ' + JSON.stringify(data, null, 2), 'info');
        });

        socket.on('connect_error', (err) => {
            log('❌ CONNECTION ERROR: ' + err.message, 'error');
            log('   Type: ' + (err.type || 'unknown'), 'error');
            log('   Full error: ' + JSON.stringify(err, Object.getOwnPropertyNames(err)), 'error');
        });

        socket.on('disconnect', (reason) => {
            log('🔴 DISCONNECTED: ' + reason, 'error');
        });

        socket.on('reconnect_attempt', (attempt) => {
            log('🔄 Reconnection attempt ' + attempt + '...', 'info');
        });

        log('⏳ Waiting for connection...');
    </script>
</body>
</html>
        `);
    });

    // ——— HTTP Server + Socket.io ———
    const server = http.createServer(app);
    const { Server } = require('socket.io');
    const io = new Server(server, {
        cors: {
            origin: true, // Match request origin
            methods: ["GET", "POST"],
            credentials: true
        },
        allowEIO3: true,
        transports: ['websocket'] // Force websocket for stability
    });

    console.log('═══════════════════════════════════════');
    console.log('✅ Socket.io Server initialized');
    console.log('   Transport: websocket only');
    console.log('   CORS: origin matching enabled');
    console.log('═══════════════════════════════════════');

    // ——— Middleware: Share Express session with Socket.io ———
    const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
    io.use(wrap(sessionMiddleware));
    io.use(wrap(passport.initialize()));
    io.use(wrap(passport.session()));

    io.use((socket, next) => {
        const session = socket.request.session;
        const user = socket.request.user;
        
        console.log('🔌 [Socket.io] Handshake attempt:', {
            sessionID: session?.id,
            hasSession: !!session,
            hasUser: !!user,
            userID: user?.id,
            userName: user?.username
        });

        if (session && session.passport && session.passport.user) {
            const u = session.passport.user;
            socket.userId = typeof u === 'object' && u.id ? u.id : u;
            socket.user = typeof u === 'object' ? u : { id: u, guilds: [] };
            console.log('✅ [Socket.io] User authenticated:', socket.userId);
            next();
        } else {
            const errorMsg = !session ? 'No session' : !session.passport ? 'No passport in session' : 'No user in passport';
            console.error('❌ [Socket.io] Authentication failed:', errorMsg);
            next(new Error('Authentication required: ' + errorMsg));
        }
    });

    // ——— Init: Bridge has client and io before handling connections ———
    dashboardBridge.setClient(client);
    dashboardBridge.setIo(io);

    // ——— Socket logic ———
    io.on('connection', (socket) => {
        console.log('✅ NEW SOCKET CONNECTED:', socket.id, 'User:', socket.userId);

        socket.on('join-guild', (guildId) => {
            const gid = (guildId && String(guildId).trim()) || null;
            if (!gid) {
                console.warn('⚠️ [join-guild] No guild ID provided');
                socket.emit('player:update', { status: 'idle', error: 'No guild ID' });
                return;
            }
            
            socket.guildId = gid;
            socket.join(`guild:${gid}`);
            console.log(`📥 [join-guild] Socket ${socket.id} joined guild:${gid}`);
            
            const cached = dashboardBridge.getState(gid);
            socket.emit('player:update', cached);
            console.log(`✅ [join-guild] Sent initial state to socket ${socket.id}:`, {
                hasTrack: !!cached.currentTrack,
                queueSize: cached.queue?.length || 0,
                isPlaying: cached.isPlaying
            });
        });

        // ——— Dashboard Socket API: Select guild ———
        // Frontend can emit this instead of (or in addition to) `join-guild`.
        socket.on('dashboard:select-guild', (payload) => {
            try {
                const gid = payload?.guildId || payload?.guild_id || socket.guildId;
                if (!gid) return;
                const guildId = String(gid).trim();
                socket.guildId = guildId;
                socket.join(`guild:${guildId}`);
                const cached = dashboardBridge.getState(guildId);
                socket.emit('player:update', cached);
            } catch (e) {}
        });

        // ——— Dashboard Socket API: EQ preset ———
        socket.on("audio:eq", (payload, cb) => {
            const gid = payload?.guildId || payload?.guild_id || socket.guildId;
            const preset = payload?.preset;
            if (!gid || !preset) {
                if (typeof cb === "function") cb({ error: "Missing guildId or preset" });
                return;
            }
            dashboardBridge
                .handleSetEqPreset(String(gid), socket.userId, preset)
                .then((result) => {
                    if (typeof cb === "function") cb(result);
                })
                .catch((e) => {
                    if (typeof cb === "function") cb({ error: e.message });
                });
        });

        socket.on('get-state', (payload, cb) => {
            const gid = (payload && payload.guildId) ? String(payload.guildId).trim() : (socket.guildId && String(socket.guildId).trim()) || null;
            if (!gid) return (typeof cb === 'function' && cb(null));
            const cached = dashboardBridge.getState(gid);
            socket.emit('player:update', cached);
            if (typeof cb === 'function') cb(cached);
        });

        socket.on('player:skip', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const result = dashboardBridge.handleSkip(gid, socket.userId);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:pause', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const result = dashboardBridge.handlePause(gid, socket.userId);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:previous', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const result = dashboardBridge.handlePrevious(gid, socket.userId);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:shuffle', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const result = dashboardBridge.handleShuffle(gid, socket.userId);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:loop', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const result = dashboardBridge.handleLoop(gid, socket.userId);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('get-guilds', () => {
            const userGuilds = (socket.user && socket.user.guilds) ? socket.user.guilds : [];
            const mutual = dashboardBridge.getMutualGuilds(userGuilds);
            socket.emit('receive-guilds', mutual);
        });

        socket.on('player:volume', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const vol = (payload && typeof payload.volume === 'number') ? payload.volume : payload;
            const result = dashboardBridge.handleVolume(gid, socket.userId, vol);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:seek', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const seconds = payload && (payload.positionSeconds != null || payload.seconds != null)
                ? (payload.positionSeconds != null ? payload.positionSeconds : payload.seconds)
                : 0;
            const result = dashboardBridge.handleSeek(gid, socket.userId, seconds);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:removeTrack', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const index = payload && typeof payload.index === 'number' ? payload.index : 0;
            const result = dashboardBridge.handleRemoveTrack(gid, socket.userId, index);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('player:clearQueue', (payload, cb) => {
            const gid = (payload && payload.guildId) != null ? payload.guildId : socket.guildId;
            const result = dashboardBridge.handleClearQueue(gid, socket.userId);
            if (typeof cb === 'function') cb(result);
        });

        socket.on('get-playlist-tracks', (payload, cb) => {
            const name = payload && payload.name;
            if (!name) return (typeof cb === 'function' && cb({ tracks: [] }));
            dashboardBridge.getPlaylistTracks(name).then(tracks => {
                if (typeof cb === 'function') cb({ tracks });
            }).catch(() => {
                if (typeof cb === 'function') cb({ tracks: [] });
            });
        });

        socket.on('search', (payload, cb) => {
            const query = payload && payload.query;
            if (!query) return cb({ error: 'Query required' });
            dashboardBridge.handleSearch(query, socket.userId).then(results => {
                cb({ results });
            }).catch(e => {
                cb({ error: e.message });
            });
        });

        socket.on('play-track', (payload, cb) => {
            const gid = (payload && payload.guildId) || socket.guildId;
            const url = payload && payload.url;
            if (!url) return cb({ error: 'URL required' });
            dashboardBridge.handlePlayTrack(gid, socket.userId, url).then(result => {
                cb(result);
            }).catch(e => {
                cb({ error: e.message });
            });
        });

        socket.on('play-playlist', (payload, cb) => {
            const gid = (payload && payload.guildId) || socket.guildId;
            const name = payload && payload.name;
            if (!name) return cb({ error: 'Playlist name required' });
            dashboardBridge.handlePlayPlaylist(gid, socket.userId, name).then(result => {
                cb(result);
            }).catch(e => {
                cb({ error: e.message });
            });
        });

        // ——— Dashboard Socket: Smart autoplay settings ———
        socket.on("settings:autoplay", async (payload, cb) => {
            try {
                const gid = payload?.guildId || payload?.guild_id || socket.guildId;
                const enabled = !!payload?.enabled;
                const mode = payload?.mode || "smart";
                const exploration_rate = payload?.exploration_rate != null ? Number(payload.exploration_rate) : 20;
                const block_explicit = payload?.block_explicit == null ? 1 : (payload.block_explicit ? 1 : 0);
                const preferred_sources = payload?.preferred_sources || "both";

                if (!gid) {
                    if (typeof cb === "function") cb({ error: "Missing guildId" });
                    return;
                }

                const guildId = String(gid);
                await client.db.upsertAutoplaySettings(guildId, {
                    mode,
                    exploration_rate: Math.max(0, Math.min(100, exploration_rate)),
                    block_explicit,
                    preferred_sources
                });

                // Persist autoplay on/off in the existing guild_settings table.
                const { updateSettings } = require("./src/systems/settings");
                await updateSettings(client, guildId, { autoplay: enabled ? 1 : 0 });

                // Apply immediately to active queue if any.
                const queue = client.player.nodes.get(guildId);
                if (queue?.metadata) {
                    queue.metadata.isAutoplayEnabled = enabled;
                }

                if (typeof cb === "function") cb({ success: true });
            } catch (e) {
                if (typeof cb === "function") cb({ error: e.message });
            }
        });
    });

    const onListen = (port) => {
        console.log('═══════════════════════════════════════');
        console.log(`✅ Dashboard Server Running`);
        console.log(`🌐 URL: http://localhost:${port}`);
        console.log(`🔗 Login: http://localhost:${port}/login`);
        console.log(`🔌 Socket.io: Ready and listening`);
        console.log('═══════════════════════════════════════');
    };

    let fallbackDone = false;
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && !fallbackDone) {
            fallbackDone = true;
            const nextPort = (parseInt(PORT, 10) || 3000) + 1;
            console.warn(`⚠️ Port ${PORT} in use, trying ${nextPort}...`);
            server.once('error', (e2) => {
                console.error('[Dashboard] Port', nextPort, 'also in use:', e2.message);
            });
            server.listen(nextPort, () => onListen(nextPort));
        } else {
            console.error('[Dashboard] Server error:', err.message);
        }
    });

    server.listen(PORT, () => onListen(PORT));

    return { app, server, io };
}

module.exports = { createDashboard };
