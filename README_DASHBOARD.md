# 🎵 Music Bot Web Dashboard

<div align="center">

![Dashboard Preview](https://img.shields.io/badge/Status-Ready-success?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)
![Discord.js](https://img.shields.io/badge/Discord.js-14+-blue?style=for-the-badge&logo=discord)

**A beautiful, FredBoat-inspired web dashboard for your Discord Music Bot**

</div>

---

## ✨ Features

- 🎨 **Modern Dark Theme** - Deep dark background with neon purple/pink accents
- 🎵 **Now Playing Display** - Large album art with real-time playback information
- 📋 **Queue Management** - View and manage your music queue
- 🕐 **Recently Played** - Track your listening history
- 🎛️ **Player Controls** - Play, pause, skip, shuffle, loop, and volume control
- 🔐 **Discord OAuth2** - Secure authentication via Discord
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- ⚡ **Real-time Data** - Connect to your bot for live player updates

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20 or higher
- A Discord bot with music functionality
- Discord Application with OAuth2 configured

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Discord OAuth2**
   
   Visit [Discord Developer Portal](https://discord.com/developers/applications):
   - Select your application
   - Go to **OAuth2** → **General**
   - Copy your **Client Secret**
   - Go to **OAuth2** → **Redirects**
   - Add: `http://localhost:3000/auth/callback`
   - Save changes

3. **Update Environment Variables**
   
   Edit `.env` and add:
   ```env
   CLIENT_SECRET=your_client_secret_here
   SESSION_SECRET=generate_random_string_here
   CALLBACK_URL=http://localhost:3000/auth/callback
   PORT=3000
   ```

   Generate a secure session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Start the Dashboard**
   ```bash
   npm run dashboard
   ```

5. **Access the Dashboard**
   
   Open your browser: `http://localhost:3000`

---

## 📖 Documentation

### Complete Setup Guides

- **[📝 SETUP_DASHBOARD.md](./SETUP_DASHBOARD.md)** - Quick setup guide with step-by-step instructions
- **[📚 DASHBOARD_README.md](./DASHBOARD_README.md)** - Comprehensive documentation
- **[🔗 INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Connect dashboard to your Discord bot

### File Structure

```
Nicraen-Bot/
├── server.js                          # Express server with OAuth2
├── dashboard.config.js                # Dashboard configuration
├── dashboard-bridge.js                # Bot ↔ Dashboard data bridge
├── test-dashboard-data.js             # Test script with sample data
│
├── views/
│   ├── index.ejs                      # Landing/login page
│   └── dashboard.ejs                  # Main dashboard interface
│
├── public/
│   └── style.css                      # Additional custom styles
│
├── examples/
│   └── dashboard-integration.js       # Integration examples
│
├── src/                               # Your Discord bot code
│   ├── commands/                      # Bot commands
│   ├── events/                        # Bot events
│   └── ...
│
└── docs/
    ├── SETUP_DASHBOARD.md            # Quick setup
    ├── DASHBOARD_README.md           # Full documentation
    └── INTEGRATION_GUIDE.md          # Integration guide
```

---

## 🎯 Usage

### Running Both Bot and Dashboard

**Option 1: Two Terminal Windows**

Terminal 1 (Bot):
```bash
npm start
```

Terminal 2 (Dashboard):
```bash
npm run dashboard
```

**Option 2: Using PM2 (Recommended for Production)**

```bash
npm install -g pm2

# Start both
pm2 start src/index.js --name "music-bot"
pm2 start server.js --name "dashboard"

# View logs
pm2 logs

# Stop all
pm2 stop all
```

### Testing with Sample Data

To test the dashboard without connecting to the bot:

```bash
node test-dashboard-data.js
npm run dashboard
```

Then visit: `http://localhost:3000/dashboard?guild=1234567890123456789`

---

## 🔌 Connecting to Your Bot

The dashboard is ready to display real data from your Discord bot!

### Quick Integration (5 minutes)

1. **Add this to your player event handler:**

```javascript
const dashboardBridge = require('../../dashboard-bridge');
const { useMainPlayer } = require('discord-player');
const player = useMainPlayer();

// When track starts
player.events.on('playerStart', (queue, track) => {
    dashboardBridge.updateTrack(queue.guild.id, {
        title: track.title,
        artist: track.author,
        albumArt: track.thumbnail,
        duration: Math.floor(track.durationMS / 1000)
    });
    dashboardBridge.updateQueue(queue.guild.id, queue.tracks.data);
});

// When player pauses
player.events.on('playerPause', (queue) => {
    dashboardBridge.updatePlayState(queue.guild.id, false);
});

// When player resumes
player.events.on('playerResume', (queue) => {
    dashboardBridge.updatePlayState(queue.guild.id, true);
});
```

2. **See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for complete setup!**

---

## 🎨 Customization

### Theme Colors

The dashboard uses these default colors (defined in `views/dashboard.ejs`):

- Background: `#18181b`
- Sidebar: `#0f0f11`
- Accent: `#d946ef` (Purple/Pink)

To change colors, search and replace in `views/dashboard.ejs`:
- Replace `#d946ef` with your preferred accent color
- Replace `#18181b` with your preferred background color

### Branding

Edit the logo in `views/dashboard.ejs`:

```html
<h1 class="text-2xl font-bold">
    <span class="accent-purple">
        <i class="fas fa-music mr-2"></i>Your Bot Name
    </span>
</h1>
```

Or use an image:

```html
<img src="/logo.png" alt="Bot Logo" class="h-10">
```

---

## 🔒 Security

### Development

- Uses HTTP on localhost
- Session secret should be changed from default
- OAuth2 redirect: `http://localhost:3000/auth/callback`

### Production

**Required Security Updates:**

1. **Use HTTPS** (Required for OAuth2 in production)
   ```env
   NODE_ENV=production
   CALLBACK_URL=https://yourdomain.com/auth/callback
   ```

2. **Strong Session Secret**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Update Discord OAuth2 Redirects**
   - Add your production URL in Discord Developer Portal
   - Remove localhost redirect in production

4. **Add Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

5. **Use Environment Variables**
   - Never commit `.env` to version control
   - Use `.env.example` for documentation

---

## 📊 API Endpoints

### Authentication

- `GET /` - Landing page
- `GET /login` - Initiate Discord OAuth2
- `GET /auth/callback` - OAuth2 callback
- `GET /logout` - Logout

### Dashboard

- `GET /dashboard` - Main dashboard (requires auth)
- `GET /dashboard?guild=ID` - Dashboard for specific guild

### API (All require authentication)

- `GET /api/player/status?guild=ID` - Get player status
- `POST /api/player/play` - Resume playback
- `POST /api/player/pause` - Pause playback
- `POST /api/player/skip` - Skip current track
- `POST /api/player/volume` - Change volume

---

## 🛠️ Development

### Scripts

```bash
# Start Discord bot
npm start

# Start bot with auto-reload
npm run dev

# Start dashboard
npm run dashboard

# Start dashboard with auto-reload
npm run dashboard:dev

# Test with sample data
node test-dashboard-data.js
```

### Environment Variables

```env
# Bot Configuration
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id

# Dashboard Configuration
CLIENT_SECRET=your_client_secret
CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=your_session_secret
PORT=3000

# Optional
NODE_ENV=development
LOG_LEVEL=info
```

---

## 🐛 Troubleshooting

### "Invalid OAuth2 redirect_uri"

- Verify redirect URL in Discord Developer Portal matches exactly
- Check PORT in `.env` matches the callback URL

### Session not persisting

- Ensure `SESSION_SECRET` is set in `.env`
- Clear browser cookies
- Check that cookies are enabled

### Dashboard shows mock data

- Integrate the dashboard-bridge in your bot (see INTEGRATION_GUIDE.md)
- Make sure bot is running and playing music
- Refresh the dashboard page

### Cannot control bot from dashboard

This is expected! Current version only syncs bot → dashboard. For full control, implement WebSocket or API endpoints (see `examples/dashboard-integration.js`).

---

## 🚧 Roadmap

- [ ] WebSocket for real-time updates
- [ ] Full bot control from dashboard (play/pause/skip)
- [ ] Search functionality
- [ ] Playlist management
- [ ] Audio filters and equalizer
- [ ] Lyrics display
- [ ] Multi-guild support
- [ ] User preferences and settings
- [ ] Mobile app (React Native)

---

## 📄 License

Part of the Nicraen Music Bot project.

---

## 🙏 Acknowledgments

- Inspired by [FredBoat](https://fredboat.com/)
- Built with [Express](https://expressjs.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Powered by [Discord.js](https://discord.js.org/)

---

## 📞 Support

- [Documentation](./DASHBOARD_README.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Quick Setup](./SETUP_DASHBOARD.md)

---

<div align="center">

**Made with ❤️ for the Discord music community**

[⬆ Back to Top](#-music-bot-web-dashboard)

</div>
