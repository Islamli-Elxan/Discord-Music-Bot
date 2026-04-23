/**
 * Dashboard Bridge — Singleton (Logic Layer).
 * Manages state and Bot ↔ Web via Socket.io. Uses discord-player nodes: client.player.nodes.get(guildId).
 */

const { buildFullFfmpegFilters } = require("./src/music/audioProcessing");
const { isValidPreset } = require("./src/music/eqPresetToFilters");

const GUILD_ROOM = (guildId) => `guild:${guildId}`;

class DashboardBridge {
    constructor() {
        this.client = null;
        this.io = null;
        this.cache = new Map(); // guildId -> { currentTrack, queue, isPlaying, volume, isShuffled, loopMode }
        this.history = new Map(); // guildId -> [ { track, playedAt } ]
        this.audioBufferState = new Map(); // guildId -> boolean buffering
    }

    /**
     * Returns guilds where both the bot and the user are present.
     * @param {Array<{ id: string, name?: string }>} userGuilds - From passport (e.g. req.user.guilds)
     */
    getMutualGuilds(userGuilds) {
        if (!this.client || !Array.isArray(userGuilds)) return [];
        return userGuilds
            .filter((g) => this.client.guilds.cache.has(g.id))
            .map((g) => {
                const botGuild = this.client.guilds.cache.get(g.id);
                return {
                    id: botGuild?.id || g.id,
                    name: botGuild?.name || g.name || g.id,
                    icon: botGuild?.iconURL({ dynamic: true, size: 64 }) || null,
                    memberCount: botGuild?.memberCount ?? null
                };
            });
    }

    setClient(client) {
        this.client = client;
    }

    setIo(io) {
        this.io = io;
    }

    _getQueue(guildId) {
        if (!this.client || !this.client.player) return null;
        return this.client.player.nodes.get(guildId) || null;
    }

    /**
     * If DASHBOARD_REQUIRE_VOICE_CHANNEL === 'true', user must be in the same voice channel as the bot.
     */
    _canControl(guildId, userId) {
        if (process.env.DASHBOARD_REQUIRE_VOICE_CHANNEL !== 'true') return true;
        const queue = this._getQueue(guildId);
        if (!queue || !queue.channelId) return true;
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return false;
            const member = guild.members.cache.get(userId);
            if (!member || !member.voice) return false;
            return member.voice.channelId === queue.channelId;
        } catch {
            return false;
        }
    }

    _getOrCreate(guildId) {
        if (!this.cache.has(guildId)) {
            this.cache.set(guildId, {
                currentTrack: null,
                queue: [],
                isPlaying: false,
                volume: 50,
                isShuffled: false,
                loopMode: 0
            });
        }
        return this.cache.get(guildId);
    }

    _emitUpdate(guildId, payload) {
        try {
            if (this.io && guildId) {
                let currentTime = payload.currentTrack && typeof payload.currentTrack.currentTime === 'number' ? payload.currentTrack.currentTime : 0;
                if (payload.currentTrack) {
                    const queue = this._getQueue(guildId);
                    if (queue?.node) {
                        const ts = queue.node.getTimestamp && queue.node.getTimestamp();
                        if (ts && typeof ts.current?.value === 'number') {
                            currentTime = Math.floor(ts.current.value / 1000);
                        } else if (typeof queue.node.streamTime === 'number') {
                            currentTime = Math.floor(queue.node.streamTime / 1000);
                        }
                    }
                }
                const safe = {
                    status: payload.currentTrack ? 'playing' : 'idle',
                    currentTrack: payload.currentTrack ? {
                        title: payload.currentTrack.title || '—',
                        artist: payload.currentTrack.artist || payload.currentTrack.author || '—',
                        albumArt: payload.currentTrack.albumArt || payload.currentTrack.thumbnail || '',
                        duration: typeof payload.currentTrack.duration === 'number' ? payload.currentTrack.duration : 0,
                        currentTime,
                        url: payload.currentTrack.url || ''
                    } : null,
                    queue: Array.isArray(payload.queue) ? payload.queue.map((t) => ({
                        title: (t && t.title) || '—',
                        artist: (t && (t.artist || t.author)) || '—',
                        albumArt: (t && (t.albumArt || t.thumbnail)) || '',
                        duration: (t && typeof t.duration === 'number') ? t.duration : 0,
                        requestedBy: (t && t.requestedBy) || '—'
                    })) : [],
                    isPlaying: !!payload.isPlaying,
                    volume: typeof payload.volume === 'number' ? Math.max(0, Math.min(100, payload.volume)) : 50,
                    isShuffled: !!payload.isShuffled,
                    loopMode: typeof payload.loopMode === 'number' ? payload.loopMode : 0,
                    history: Array.isArray(payload.history) ? payload.history.slice(0, 50) : []
                };
                this.io.to(GUILD_ROOM(guildId)).emit('player:update', safe);
                console.log(`📤 [Bridge] Emitted update to guild:${guildId}`, { status: safe.status, hasTrack: !!safe.currentTrack });
            }
        } catch (err) {
            console.error('[DashboardBridge] _emitUpdate error:', err);
        }
    }

    /**
     * Cache track data and emit player:update to room guild:${guildId}.
     */
    updateTrack(guildId, trackData) {
        const state = this._getOrCreate(guildId);
        
        if (state.currentTrack) {
            const hist = this.history.get(guildId) || [];
            hist.unshift({ ...state.currentTrack, playedAt: new Date() });
            if (hist.length > 50) hist.pop();
            this.history.set(guildId, hist);
        }
        
        const currentTrack = {
            title: trackData.title || 'Unknown',
            artist: trackData.artist || trackData.author || 'Unknown Artist',
            albumArt: trackData.albumArt || trackData.thumbnail || '',
            duration: typeof trackData.duration === 'number' ? trackData.duration : (trackData.durationMS ? Math.floor(trackData.durationMS / 1000) : 0),
            currentTime: 0,
            url: trackData.url || ''
        };
        state.currentTrack = currentTrack;
        state.isPlaying = true;
        const q = this._getQueue(guildId);
        if (q) state.loopMode = q.metadata && q.metadata.isAutoplayEnabled ? 3 : (q.repeatMode ?? 0);
        this.cache.set(guildId, state);

        const payload = {
            currentTrack,
            queue: state.queue || [],
            isPlaying: true,
            volume: state.volume ?? 50,
            isShuffled: state.isShuffled ?? false,
            loopMode: state.loopMode ?? 0,
            history: this.history.get(guildId) || []
        };
        this._emitUpdate(guildId, payload);
    }

    updateQueue(guildId, tracks) {
        const state = this._getOrCreate(guildId);
        state.queue = Array.isArray(tracks)
            ? tracks.map((t) => ({
                title: t.title || 'Unknown',
                artist: t.artist || t.author || 'Unknown Artist',
                albumArt: t.albumArt || t.thumbnail || '',
                duration: typeof t.duration === 'number' ? t.duration : (t.durationMS ? Math.floor(t.durationMS / 1000) : 0),
                requestedBy: t.requestedBy?.username || (typeof t.requestedBy === 'string' ? t.requestedBy : 'Unknown')
            }))
            : [];
        const q = this._getQueue(guildId);
        if (q) state.loopMode = q.metadata && q.metadata.isAutoplayEnabled ? 3 : (q.repeatMode ?? 0);
        this.cache.set(guildId, state);
        this._emitUpdate(guildId, {
            currentTrack: state.currentTrack,
            queue: state.queue,
            isPlaying: state.isPlaying,
            volume: state.volume ?? 50,
            isShuffled: state.isShuffled ?? false,
            loopMode: state.loopMode ?? 0,
            history: this.history.get(guildId) || []
        });
    }

    /** Emit player:update with live progress (currentTime from queue.node.getTimestamp). Call periodically while playing. */
    pushProgress(guildId) {
        const state = this.cache.get(guildId);
        if (!state || !state.currentTrack) return;
        const queue = this._getQueue(guildId);
        if (!queue?.node) return;
        this._emitUpdate(guildId, {
            currentTrack: state.currentTrack,
            queue: state.queue || [],
            isPlaying: state.isPlaying,
            volume: state.volume ?? 50,
            isShuffled: state.isShuffled ?? false,
            loopMode: state.loopMode ?? 0,
            history: this.history.get(guildId) || []
        });
    }

    getState(guildId) {
        try {
            const state = this.cache.get(guildId);
            const queue = this._getQueue(guildId);
            const isAutoplay = !!(queue && queue.metadata && queue.metadata.isAutoplayEnabled);
            const loopMode = isAutoplay ? 3 : (queue && typeof queue.repeatMode === 'number' ? queue.repeatMode : (state && typeof state.loopMode === 'number' ? state.loopMode : 0));
            const hist = this.history.get(guildId) || [];
            if (!state) {
                console.log(`📭 [Bridge] getState: No cached state for guild ${guildId}`);
                return { status: 'idle', currentTrack: null, queue: [], isPlaying: false, volume: 50, isShuffled: false, loopMode: isAutoplay ? 3 : loopMode, history: hist };
            }
            let currentTime = typeof state.currentTrack.currentTime === 'number' ? state.currentTrack.currentTime : 0;
            if (state.currentTrack && queue?.node) {
                const ts = queue.node.getTimestamp && queue.node.getTimestamp();
                if (ts && typeof ts.current?.value === 'number') currentTime = Math.floor(ts.current.value / 1000);
                else if (typeof queue.node.streamTime === 'number') currentTime = Math.floor(queue.node.streamTime / 1000);
            }
            const currentTrack = state.currentTrack ? {
                title: state.currentTrack.title || '—',
                artist: state.currentTrack.artist || state.currentTrack.author || '—',
                albumArt: state.currentTrack.albumArt || state.currentTrack.thumbnail || '',
                duration: typeof state.currentTrack.duration === 'number' ? state.currentTrack.duration : 0,
                currentTime,
                url: state.currentTrack.url || ''
            } : null;
            const effectiveLoopMode = typeof state.loopMode === 'number' ? state.loopMode : (isAutoplay ? 3 : loopMode);
            let isPlaying = !!state.isPlaying;
            if (queue?.node && typeof queue.node.isPaused === 'function') {
                isPlaying = !queue.node.isPaused();
            }
            return {
                status: currentTrack ? 'playing' : 'idle',
                currentTrack,
                queue: Array.isArray(state.queue) ? state.queue : [],
                isPlaying,
                volume: typeof state.volume === 'number' ? state.volume : 50,
                isShuffled: !!state.isShuffled,
                loopMode: effectiveLoopMode,
                history: hist
            };
        } catch (err) {
            console.error('[DashboardBridge] getState error:', err);
            return { status: 'error', currentTrack: null, queue: [], isPlaying: false, volume: 50, isShuffled: false, loopMode: 0, history: [] };
        }
    }

    getHistory(guildId, limit = 10) {
        const hist = this.history.get(guildId) || [];
        return hist.slice(0, limit);
    }

    clearState(guildId) {
        this.cache.delete(guildId);
        this.history.delete(guildId);
        this.audioBufferState.delete(guildId);
        this._emitUpdate(guildId, { currentTrack: null, queue: [], isPlaying: false, volume: 50, history: [] });
    }

    /** Push current track to history and emit (does not clear state). Use when queue goes empty but we might autoplay. */
    pushCurrentToHistoryOnly(guildId) {
        const state = this.cache.get(guildId);
        if (state && state.currentTrack) {
            const hist = this.history.get(guildId) || [];
            hist.unshift({ ...state.currentTrack, playedAt: new Date() });
            if (hist.length > 50) hist.pop();
            this.history.set(guildId, hist);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: state.queue || [],
                isPlaying: state.isPlaying,
                volume: state.volume ?? 50,
                isShuffled: state.isShuffled ?? false,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
        }
    }

    /** When queue finishes: push current track to history, then clear current/queue and emit so Recently Played updates. */
    pushCurrentToHistoryThenClear(guildId) {
        const state = this.cache.get(guildId);
        if (state && state.currentTrack) {
            const hist = this.history.get(guildId) || [];
            hist.unshift({ ...state.currentTrack, playedAt: new Date() });
            if (hist.length > 50) hist.pop();
            this.history.set(guildId, hist);
        }
        const next = this._getOrCreate(guildId);
        next.currentTrack = null;
        next.queue = [];
        next.isPlaying = false;
        this.cache.set(guildId, next);
        this._emitUpdate(guildId, {
            currentTrack: null,
            queue: [],
            isPlaying: false,
            volume: next.volume ?? 50,
            isShuffled: next.isShuffled ?? false,
            loopMode: next.loopMode ?? 0,
            history: this.history.get(guildId) || []
        });
    }

    handleSeek(guildId, userId, seconds) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            const ms = Math.max(0, Math.floor(Number(seconds) || 0) * 1000);
            queue.node.seek(ms);
            const state = this._getOrCreate(guildId);
            if (state.currentTrack) state.currentTrack.currentTime = Math.floor(ms / 1000);
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: state.queue || [],
                isPlaying: state.isPlaying,
                volume: state.volume ?? 50,
                isShuffled: state.isShuffled ?? false,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
            return { seconds: Math.floor(ms / 1000) };
        } catch (e) {
            return { error: e.message };
        }
    }

    handleRemoveTrack(guildId, userId, index) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            const arr = queue.tracks && typeof queue.tracks.toArray === 'function' ? queue.tracks.toArray() : [];
            if (index < 0 || index >= arr.length) return { error: 'Invalid position' };
            queue.removeTrack(index);
            const state = this._getOrCreate(guildId);
            state.queue = (queue.tracks && queue.tracks.toArray ? queue.tracks.toArray() : []).map((t) => ({
                title: t.title || 'Unknown',
                artist: t.author || 'Unknown Artist',
                albumArt: t.thumbnail || '',
                duration: t.durationMS ? Math.floor(t.durationMS / 1000) : 0,
                requestedBy: t.requestedBy?.username || 'Unknown'
            }));
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: state.queue,
                isPlaying: state.isPlaying,
                volume: state.volume ?? 50,
                isShuffled: state.isShuffled ?? false,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
            return {};
        } catch (e) {
            return { error: e.message };
        }
    }

    handleClearQueue(guildId, userId) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            if (typeof queue.clear === 'function') queue.clear();
            else if (queue.tracks && typeof queue.tracks.clear === 'function') queue.tracks.clear();
            const state = this._getOrCreate(guildId);
            state.queue = [];
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: [],
                isPlaying: state.isPlaying,
                volume: state.volume ?? 50,
                isShuffled: state.isShuffled ?? false,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
            return {};
        } catch (e) {
            return { error: e.message };
        }
    }

    async getPlaylistTracks(name) {
        if (!this.client || !this.client.player) return [];
        const playlists = {
            electro: 'https://youtube.com/playlist?list=PLWb11GoYI7aEce0WGdajPcmMsCZkxC8l_',
            rock: 'https://youtube.com/playlist?list=PLWb11GoYI7aGxBVz6o9LpxtAxLMXeHDhH&si=ohLq0N1bBaIMuGH3'
        };
        const url = playlists[name && name.toLowerCase()];
        if (!url) return [];
        const { QueryType } = require('discord-player');
        try {
            const result = await this.client.player.search(url, { searchEngine: QueryType.YOUTUBE_PLAYLIST });
            if (!result || !result.tracks || result.tracks.length === 0) return [];
            return result.tracks.map((t) => ({
                title: t.title || 'Unknown',
                artist: t.author || 'Unknown Artist',
                albumArt: t.thumbnail || '',
                duration: t.durationMS ? Math.floor(t.durationMS / 1000) : 0,
                url: t.url || ''
            }));
        } catch {
            return [];
        }
    }

    handleSkip(guildId, userId) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            queue.node.skip();
            return {};
        } catch (e) {
            return { error: e.message };
        }
    }

    handlePause(guildId, userId) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            const wasPaused = queue.node.isPaused();
            queue.node.setPaused(!wasPaused);
            const state = this._getOrCreate(guildId);
            state.isPlaying = wasPaused;
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: state.queue,
                isPlaying: wasPaused,
                volume: state.volume ?? 50,
                isShuffled: state.isShuffled ?? false,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
            return {};
        } catch (e) {
            return { error: e.message };
        }
    }

    handleVolume(guildId, userId, volume) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        const value = Math.max(0, Math.min(100, Number(volume)));
        if (Number.isNaN(value)) return { error: 'Invalid volume' };
        try {
            queue.node.setVolume(value);
            const state = this._getOrCreate(guildId);
            state.volume = value;
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: state.queue,
                isPlaying: state.isPlaying,
                volume: value,
                isShuffled: state.isShuffled ?? false,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
            return { volume: value };
        } catch (e) {
            return { error: e.message };
        }
    }

    handlePrevious(guildId, userId) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            const prev = queue.history?.previousTrack;
            if (!prev) return { error: 'No previous track' };
            if (typeof queue.insertTrack === 'function') {
                queue.insertTrack(prev, 0);
                queue.node.skip();
            } else {
                return { error: 'Previous track not supported' };
            }
            return {};
        } catch (e) {
            return { error: e.message };
        }
    }

    handleShuffle(guildId, userId) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            if (queue.tracks && typeof queue.tracks.shuffle === 'function') {
                queue.tracks.shuffle();
            }
            const state = this._getOrCreate(guildId);
            state.isShuffled = true;
            const arr = queue.tracks && typeof queue.tracks.toArray === 'function' ? queue.tracks.toArray().map((t) => ({
                title: t.title || 'Unknown',
                artist: t.author || 'Unknown Artist',
                albumArt: t.thumbnail || '',
                duration: t.durationMS ? Math.floor(t.durationMS / 1000) : 0,
                requestedBy: t.requestedBy?.username || 'Unknown'
            })) : state.queue || [];
            state.queue = arr;
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: arr,
                isPlaying: state.isPlaying,
                volume: state.volume ?? 50,
                isShuffled: true,
                loopMode: state.loopMode ?? 0,
                history: this.history.get(guildId) || []
            });
            return { isShuffled: true };
        } catch (e) {
            return { error: e.message };
        }
    }

    handleLoop(guildId, userId) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        const queue = this._getQueue(guildId);
        if (!queue) return { error: 'No queue' };
        try {
            const isAutoplay = !!(queue.metadata && queue.metadata.isAutoplayEnabled);
            const current = isAutoplay ? 3 : (queue.repeatMode ?? 0);
            const next = (current + 1) % 4;
            queue.metadata.isAutoplayEnabled = (next === 3);
            queue.setRepeatMode(next === 3 ? 0 : next);
            const state = this._getOrCreate(guildId);
            state.loopMode = next;
            this.cache.set(guildId, state);
            this._emitUpdate(guildId, {
                currentTrack: state.currentTrack,
                queue: state.queue || [],
                isPlaying: state.isPlaying,
                volume: state.volume ?? 50,
                isShuffled: state.isShuffled ?? false,
                loopMode: next,
                history: this.history.get(guildId) || []
            });
            return { loopMode: next };
        } catch (e) {
            return { error: e.message };
        }
    }

    async handleSearch(query, userId) {
        if (!this.client || !this.client.player) throw new Error('Bot not connected');
        const { QueryType } = require('discord-player');
        try {
            const result = await this.client.player.search(query, {
                searchEngine: QueryType.YOUTUBE_SEARCH
            });
            if (!result || !result.tracks || result.tracks.length === 0) {
                return [];
            }
            return result.tracks.slice(0, 10).map(t => ({
                title: t.title,
                artist: t.author,
                albumArt: t.thumbnail,
                duration: t.durationMS ? Math.floor(t.durationMS / 1000) : 0,
                url: t.url
            }));
        } catch (e) {
            throw e;
        }
    }

    async handlePlayTrack(guildId, userId, url) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        if (!this.client || !this.client.player) return { error: 'Bot not connected' };
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return { error: 'Guild not found' };
        
        const member = guild.members.cache.get(userId);
        if (!member || !member.voice || !member.voice.channel) {
            return { error: 'Join a voice channel first' };
        }
        
        const { QueryType } = require('discord-player');
        try {
            const result = await this.client.player.play(member.voice.channel, url, {
                nodeOptions: {
                    metadata: { textChannelId: null, source: '🌐 Dashboard', lastChannelId: member.voice.channel.id }
                },
                searchEngine: QueryType.AUTO
            });
            return { success: true, track: result.track?.title };
        } catch (e) {
            return { error: e.message };
        }
    }

    async handlePlayPlaylist(guildId, userId, name) {
        if (!this._canControl(guildId, userId)) return { error: 'Must be in voice channel' };
        if (!this.client || !this.client.player) return { error: 'Bot not connected' };
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return { error: 'Guild not found' };

        const member = guild.members.cache.get(userId);
        if (!member || !member.voice || !member.voice.channel) {
            return { error: 'Join a voice channel first' };
        }

        const playlists = {
            electro: 'https://youtube.com/playlist?list=PLWb11GoYI7aEce0WGdajPcmMsCZkxC8l_',
            rock: 'https://youtube.com/playlist?list=PLWb11GoYI7aGxBVz6o9LpxtAxLMXeHDhH&si=ohLq0N1bBaIMuGH3'
        };

        const url = playlists[name && name.toLowerCase()];
        if (!url) return { error: 'Playlist not found' };

        const { QueryType } = require('discord-player');
        try {
            const searchResult = await this.client.player.search(url, {
                searchEngine: QueryType.YOUTUBE_PLAYLIST
            });

            if (!searchResult?.tracks?.length) {
                return { error: 'Could not load playlist' };
            }

            const tracks = searchResult.tracks;
            let queue = this._getQueue(guildId);

            if (!queue) {
                await this.client.player.play(member.voice.channel, tracks[0], {
                    nodeOptions: {
                        metadata: { textChannelId: null, source: '🌐 Dashboard', lastChannelId: member.voice.channel.id }
                    }
                });
                queue = this._getQueue(guildId);
                if (queue && tracks.length > 1) {
                    for (let i = 1; i < tracks.length; i++) {
                        queue.addTrack(tracks[i]);
                    }
                }
            } else {
                // Keep reconnect metadata in sync for future reconnections.
                if (queue?.metadata) queue.metadata.lastChannelId = member.voice.channel.id;
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }
                if (!queue.currentTrack && queue.tracks && queue.tracks.length > 0) {
                    await queue.node.play();
                }
            }

            return { success: true, count: tracks.length };
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Set EQ preset for a guild, persist it, and (best-effort) apply it immediately
     * to the current playing track.
     */
    async handleSetEqPreset(guildId, userId, presetName) {
        if (!this._canControl(guildId, userId)) return { error: "Must be in voice channel" };
        if (!this.client?.db) return { error: "DB not ready" };
        if (!isValidPreset(presetName)) return { error: "Invalid EQ preset" };

        // Persist
        await this.client.db.upsertEqPreset(guildId, presetName);

        const queue = this._getQueue(guildId);
        if (queue?.metadata) queue.metadata.eqPreset = presetName;

        // Best-effort: apply for current track too.
        try {
            if (queue?.currentTrack?.url && queue.filters?.ffmpeg?.setFilters) {
                const row = await this.client.db.getTrackLoudnessGain(queue.currentTrack.url);
                const loudnormMeta = row
                    ? {
                          measured_I: row.measured_I != null ? Number(row.measured_I) : null,
                          measured_TP: row.measured_TP != null ? Number(row.measured_TP) : null,
                          measured_LRA: row.measured_LRA != null ? Number(row.measured_LRA) : null,
                          measured_thresh: row.measured_thresh != null ? Number(row.measured_thresh) : null,
                          target_offset: row.target_offset != null ? Number(row.target_offset) : null
                      }
                    : null;

                const ffmpegFilters = buildFullFfmpegFilters({
                    userFilterNames: queue.metadata?.filters,
                    eqPresetName: presetName,
                    loudnormMeta
                });
                await queue.filters.ffmpeg.setFilters(ffmpegFilters);
            }
        } catch {
            // Don’t fail the API if immediate filter update fails.
        }

        return { preset: presetName };
    }

    /**
     * Emit socket events for audio buffering state:
     * - `audio:buffering` when buffering starts
     * - `audio:ready` when buffering ends
     */
    pushAudioStatus(guildId) {
        try {
            if (!this.io) return;
            const queue = this._getQueue(guildId);
            if (!queue?.node?.isBuffering || !queue.node.isPlaying?.()) return;

            const isBuffering = !!queue.node.isBuffering();
            const prev = this.audioBufferState.get(guildId);
            if (prev === undefined) {
                this.audioBufferState.set(guildId, isBuffering);
                this.io.to(GUILD_ROOM(guildId)).emit(isBuffering ? "audio:buffering" : "audio:ready", { guildId });
                return;
            }

            if (prev !== isBuffering) {
                this.audioBufferState.set(guildId, isBuffering);
                this.io.to(GUILD_ROOM(guildId)).emit(isBuffering ? "audio:buffering" : "audio:ready", { guildId });
            }
        } catch (err) {
            console.error("[DashboardBridge] pushAudioStatus error:", err);
        }
    }

    /**
     * Emit a single "next predicted track" payload to the dashboard.
     * Dashboard can display this before the song ends.
     */
    pushAutoplayPrediction(guildId, prediction) {
        try {
            if (!this.io) return;
            const payload = {
                guildId,
                prediction: prediction || null
            };
            this.io.to(GUILD_ROOM(guildId)).emit("autoplay:next-predicted", payload);
        } catch (err) {
            console.error("[DashboardBridge] pushAutoplayPrediction error:", err);
        }
    }
}

module.exports = new DashboardBridge();
