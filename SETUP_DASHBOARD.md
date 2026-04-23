# 🚀 Quick Start Guide - Web Dashboard Setup

## Step 1: Get Your Client Secret

1. Visit https://discord.com/developers/applications
2. Select your application: **1465111531925540905**
3. Go to **OAuth2** → **General**
4. Click **Reset Secret** (or copy if visible)
5. **Copy the Client Secret** - you'll need this!

## Step 2: Add OAuth2 Redirect URL

While in the Discord Developer Portal:

1. Go to **OAuth2** → **Redirects**
2. Click **Add Redirect**
3. Enter: `http://localhost:3000/auth/callback`
4. Click **Save Changes**

## Step 3: Update Your .env File

Open `.env` and replace `your_client_secret_here` with your actual Client Secret:

```env
CLIENT_SECRET=paste_your_actual_client_secret_here
```

Also generate a secure session secret:

**On Windows (PowerShell):**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and replace `your_random_session_secret_here_change_in_production` in `.env`

## Step 4: Start the Dashboard

```bash
npm run dashboard
```

Or with auto-reload during development:
```bash
npm run dashboard:dev
```

## Step 5: Access the Dashboard

Open your browser and go to:
```
http://localhost:3000
```

Click **"Login with Discord"** and authorize the application.

---

## 🎉 You're Done!

You should now see the beautiful FredBoat-style dashboard with:
- ✅ Dark theme with purple/pink accents
- ✅ Sidebar navigation
- ✅ Large now playing display
- ✅ Queue management
- ✅ Recently played tracks
- ✅ Bottom player bar with controls

---

## 🔧 Troubleshooting

### Error: "Invalid OAuth2 redirect_uri"
- Make sure you added `http://localhost:3000/auth/callback` in Discord Developer Portal
- Verify the PORT is 3000 in your `.env`

### Error: "Invalid client_secret"
- Double-check you copied the entire Client Secret
- Make sure there are no extra spaces in the `.env` file

### Dashboard shows "Cannot read property..."
- Make sure all dependencies are installed: `npm install`

### Session doesn't persist / Keeps logging out
- Ensure SESSION_SECRET is set in `.env`
- Try clearing your browser cookies

---

## 📱 Next Steps

### Connect to Your Bot's Player

Currently, the dashboard shows mock data. To connect it to your actual Discord bot:

1. **Create an IPC (Inter-Process Communication) system** using:
   - WebSocket (socket.io)
   - Redis pub/sub
   - HTTP polling

2. **Expose bot player state** in your Discord bot code

3. **Update the dashboard routes** to fetch real data

### Example Integration (Coming Soon)

We'll add a real-time connection between your Discord bot and the dashboard so you can:
- See actual playing songs
- Control the bot from the web interface
- View real queue data
- Update settings

---

## 🎨 Customization Tips

### Change the Accent Color

Edit `views/dashboard.ejs` and replace all instances of `#d946ef` with your preferred color.

### Add Your Bot's Logo

Replace the `<i class="fas fa-music">` icon with your bot's logo image.

### Modify the Sidebar Links

Edit the navigation section in `views/dashboard.ejs` to add/remove pages.

---

**Need help? Check `DASHBOARD_README.md` for detailed documentation!**
