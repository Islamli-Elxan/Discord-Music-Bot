/**
 * Dashboard Configuration
 * This file contains configuration and helper functions for the web dashboard
 */

const config = require('./src/config/config');

module.exports = {
    // Web server configuration
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/callback'
    },

    // Discord OAuth2
    oauth: {
        clientId: config.clientId,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: ['identify', 'guilds']
    },

    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'change-this-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            httpOnly: true,
            sameSite: 'lax'
        }
    },

    // Dashboard features
    features: {
        queue: true,
        playlists: true,
        history: true,
        search: true,
        filters: true,
        lyrics: false // Coming soon
    },

    // Helper functions
    helpers: {
        /**
         * Format duration in seconds to MM:SS
         */
        formatDuration(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        },

        /**
         * Get user avatar URL
         */
        getAvatarURL(user) {
            if (!user.avatar) {
                return `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
            }
            return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
        },

        /**
         * Get guild icon URL
         */
        getGuildIcon(guild) {
            if (!guild.icon) return null;
            return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
        },

        /**
         * Format relative time (e.g., "2 minutes ago")
         */
        timeAgo(date) {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            
            const intervals = {
                year: 31536000,
                month: 2592000,
                week: 604800,
                day: 86400,
                hour: 3600,
                minute: 60,
                second: 1
            };

            for (const [unit, secondsInUnit] of Object.entries(intervals)) {
                const interval = Math.floor(seconds / secondsInUnit);
                if (interval >= 1) {
                    return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
                }
            }

            return 'just now';
        }
    }
};
