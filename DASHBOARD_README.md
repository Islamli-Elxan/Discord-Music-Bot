# Music Bot Web Dashboard

A beautiful, FredBoat-style web dashboard for your Discord Music Bot built with Express, EJS, and Tailwind CSS.

## Features

- 🎵 **Now Playing Display** - Large album art with real-time playback information
- 📋 **Queue Management** - View and manage the music queue
- 🕐 **Recently Played** - Track your listening history
- 🎨 **Dark Theme** - Deep dark background with neon purple/pink accents
- 🔐 **Discord OAuth2** - Secure authentication via Discord
- 📱 **Responsive Design** - Works perfectly on desktop and mobile devices

## Setup Instructions

### 1. Install Dependencies

The required packages have already been installed:
```bash
npm install
```

### 2. Configure Discord OAuth2

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create a new one)
3. Navigate to **OAuth2** → **General**
4. Copy your **Client Secret**
5. Add the redirect URL: `http://localhost:3000/auth/callback`

### 3. Update Environment Variables

Edit your `.env` file with the following:

```env
# Bot Configuration (Already exists)
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id

# Web Dashboard Configuration (Add these)
CLIENT_SECRET=your_client_secret_from_discord_portal
CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=generate_a_random_string_here
PORT=3000
```

**Generate a secure session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Update Discord OAuth2 Redirects

In the Discord Developer Portal, under **OAuth2** → **Redirects**, add:
- `http://localhost:3000/auth/callback`

For production, also add your production URL:
- `https://yourdomain.com/auth/callback`

### 5. Run the Dashboard

Start the web server:
```bash
node server.js
```

The dashboard will be available at: `http://localhost:3000`

### 6. Run Both Bot and Dashboard (Optional)

If you want to run both the Discord bot and the web dashboard simultaneously, you can use a process manager like PM2:

```bash
npm install -g pm2

# Start the bot
pm2 start src/index.js --name "music-bot"

# Start the dashboard
pm2 start server.js --name "dashboard"

# View logs
pm2 logs
```

Or simply open two terminal windows:
- Terminal 1: `node src/index.js` (Discord bot)
- Terminal 2: `node server.js` (Web dashboard)

## File Structure

```
Nicraen-Bot/
├── server.js                 # Express server with OAuth2
├── views/
│   ├── index.ejs            # Landing/login page
│   └── dashboard.ejs        # Main dashboard interface
├── public/                   # Static assets (CSS, JS, images)
├── src/                      # Discord bot source code
└── .env                      # Environment configuration
```

## Dashboard Routes

- `/` - Landing page
- `/login` - Initiates Discord OAuth2 login
- `/auth/callback` - OAuth2 callback handler
- `/dashboard` - Main dashboard (requires authentication)
- `/logout` - Logout and clear session

## API Endpoints (For Future Integration)

- `GET /api/player/status` - Get current player status
- `POST /api/player/play` - Resume playback
- `POST /api/player/pause` - Pause playback
- `POST /api/player/skip` - Skip to next track
- `POST /api/player/volume` - Change volume

## Customization

### Theme Colors

Edit the Tailwind classes in `dashboard.ejs`:
- Background: `#18181b`
- Sidebar: `#0f0f11`
- Accent: `#d946ef` (purple/pink)

### Logo/Branding

Update the sidebar brand in `dashboard.ejs`:
```html
<h1 class="text-2xl font-bold">
    <span class="accent-purple"><i class="fas fa-music mr-2"></i>Music</span>
    <span class="text-white">Bot</span>
</h1>
```

## Production Deployment

### Environment Variables for Production

```env
CLIENT_SECRET=your_production_client_secret
CALLBACK_URL=https://yourdomain.com/auth/callback
SESSION_SECRET=your_production_session_secret
PORT=3000
NODE_ENV=production
```

### Security Recommendations

1. **Use HTTPS** - Always use SSL/TLS in production
2. **Secure Session Secret** - Use a strong, random session secret
3. **Environment Variables** - Never commit `.env` to version control
4. **Rate Limiting** - Add rate limiting middleware (express-rate-limit)
5. **CORS** - Configure CORS properly for your domain

### Deploy with PM2

```bash
pm2 start server.js --name "dashboard" --env production
pm2 startup
pm2 save
```

## Connecting to Your Discord Bot

To make the dashboard control your actual Discord bot, you'll need to:

1. **Create a WebSocket connection** between the dashboard and bot
2. **Use Redis** or a similar pub/sub system for real-time updates
3. **Expose bot player methods** via API endpoints

Example integration coming soon!

## Troubleshooting

### "Invalid OAuth2 redirect_uri"
- Verify the callback URL matches exactly in Discord Developer Portal
- Check that the PORT in `.env` matches your server

### "Cannot find module 'express'"
- Run `npm install` to install all dependencies

### Session not persisting
- Ensure `SESSION_SECRET` is set in `.env`
- Check that cookies are enabled in your browser

## Screenshots

The dashboard features:
- **Large Now Playing Display** with album art and progress bar
- **Persistent Bottom Player Bar** for quick controls
- **Dark Sidebar Navigation** with active state indicators
- **Queue and History Sections** in a two-column layout
- **Responsive Design** that works on all screen sizes

## License

This project is part of the Nicraen Music Bot.

## Support

For issues or questions, please open an issue on GitHub.

---

**Enjoy your beautiful music dashboard! 🎵**
