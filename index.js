const { Client, GatewayIntentBits } = require('discord.js');
const { Player, QueryType, QueueRepeatMode } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const yts = require('yt-search');

// --- FFmpeg Yolu ---
try {
    const ffmpegPath = require('ffmpeg-static');
    process.env.FFMPEG_PATH = ffmpegPath;
    console.log(`CX FFmpeg yolu: ${ffmpegPath}`);
} catch (e) {
    console.log("⚠️ Xəbərdarlıq: ffmpeg-static tapılmadı.");
}

// --- WEB SERVER ---
const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- PLAYER ---
const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        requestOptions: {
            headers: {
                cookie: process.env.YOUTUBE_COOKIE || ''
            }
        }
    },
    skipFFmpeg: false,
    connectionTimeout: 60000
});

async function init() {
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("✅ Audivine Bot: Sistem tam hazırdır.");
}
init();

// --- KOMANDALAR ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const query = args.join(' ');
    const channel = message.member?.voice?.channel;

    // --- !PLAY ---
    if (command === 'play' || command === 'p') {
        if (!channel) return message.reply("❌ Səsli kanala gir!");
        if (!query) return message.reply("❌ Mahnı adı yaz!");

        const searchMsg = await message.reply(`🔍 Axtarılır: **${query}**...`);

        try {
            const result = await player.play(channel, query, {
                nodeOptions: {
                    metadata: { channel: message.channel },
                    selfDeaf: true,
                    volume: 80,
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    bufferingTimeout: 10000
                },
                searchEngine: QueryType.AUTO
            });

            if (result && result.track) {
                await searchMsg.edit(`✅ **${result.track.title}** növbəyə əlavə edildi / oxunur...`);
            } else {
                await searchMsg.edit("❌ Tapılmadı.");
            }
        } catch (error) {
            console.error(error);
            await searchMsg.edit(`❌ Xəta: ${error.message}`);
        }
    }

    // --- !LOCAL (DÜZƏLDİLMİŞ VERSİYA) ---
    if (command === 'local') {
        if (!channel) return message.reply("❌ Səsli kanala daxil ol!");
        
        const musicFolder = path.join(__dirname, 'mahnilar');
        if (!fs.existsSync(musicFolder)) return message.reply("📂 'mahnilar' papkası yoxdur!");

        // Yalnız mp3 fayllarını tapırıq
        const files = fs.readdirSync(musicFolder).filter(f => f.endsWith('.mp3'));
        if (files.length === 0) return message.reply("📂 Papka boşdur!");

        const loadingMsg = await message.reply(`📂 **Arxiv:** ${files.length} fayl yüklənir...`);

        try {
            // Növbəni yaradırıq
            const queue = player.nodes.create(message.guild, {
                metadata: { channel: message.channel },
                selfDeaf: true,
                leaveOnEnd: false,
                leaveOnEmpty: false
            });

            if (!queue.connection) await queue.connect(channel);

            // Faylları tək-tək növbəyə əlavə edirik
            for (const file of files) {
                const filePath = path.join(musicFolder, file);
                const searchResult = await player.search(filePath, {
                    searchEngine: QueryType.FILE
                });
                
                if (searchResult && searchResult.tracks.length > 0) {
                    queue.addTrack(searchResult.tracks[0]);
                }
            }

            if (!queue.isPlaying()) await queue.node.play();
            await loadingMsg.edit(`✅ **Arxiv:** ${files.length} mahnı oxunmağa başladı!`);

        } catch (e) {
            console.error(e);
            await loadingMsg.edit("❌ Local xətası: " + e.message);
        }
    }

    // --- !STOP ---
    if (command === 'stop') {
        const queue = player.nodes.get(message.guild.id);
        if (queue) { queue.node.stop(); queue.tracks.clear(); message.reply("🛑 Dayandırıldı."); }
    }

    // --- !SKIP ---
    if (command === 'skip' || command === 'next') {
        const queue = player.nodes.get(message.guild.id);
        if (queue) { queue.node.skip(); message.reply("⏭️ Keçildi."); }
    }

    // --- !AUTOPLAY ---
    if (command === 'autoplay') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue || !queue.isPlaying()) return message.reply("❌ Musiqi yoxdur!");
        const mode = queue.repeatMode === QueueRepeatMode.AUTOPLAY ? QueueRepeatMode.OFF : QueueRepeatMode.AUTOPLAY;
        queue.setRepeatMode(mode);
        message.reply(mode === QueueRepeatMode.AUTOPLAY ? "Zw Autoplay aktivdir!" : "Sz Autoplay bağlandı.");
    }
});

// --- WEB API ---
app.get('/api/search', async (req, res) => {
    try { const r = await yts(req.query.q || ''); res.json(r.videos.slice(0, 12)); } catch { res.json([]); }
});

app.get('/api/play', async (req, res) => {
    const query = req.query.query;
    if (!query) return res.json({ success: false, message: "Boşdur" });
    const guild = client.guilds.cache.first();
    let channel = null;
    for (const [id, c] of guild.channels.cache) { if (c.isVoiceBased() && c.members.size > 0) { channel = c; break; } }
    if (!channel) return res.json({ success: false, message: "Kanal yoxdur" });

    try {
        const queue = player.nodes.get(guild.id);
        if (queue) { queue.node.stop(); queue.tracks.clear(); }
        const result = await player.play(channel, query, {
            nodeOptions: { metadata: { channel: channel, source: '🖥️ Web' }, selfDeaf: true, volume: 80 },
            searchEngine: QueryType.AUTO
        });
        return res.json({ success: true, message: `Oxunur: ${result.track.title}` });
    } catch (e) { return res.json({ success: false, message: e.message }); }
});

app.listen(PORT, () => console.log(`🌍 Web: http://localhost:${PORT}`));

// --- HADİSƏLƏR ---
player.events.on('playerStart', (queue, track) => {
    const channel = queue.metadata.channel;
    if (channel && channel.send) channel.send(`🎶 **${track.title}** oxunur...`);
});
player.events.on('error', (queue, error) => console.log(`[Queue Xəta]: ${error.message}`));
player.events.on('playerError', (queue, error) => {
    console.log(`[Player Xəta]: ${error.message}`);
    setTimeout(() => queue.node.skip(), 1000);
});

// --- GİRİŞ (Token .env faylından: DISCORD_TOKEN) ---
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("❌ .env faylında DISCORD_TOKEN təyin edin. Əsas bot üçün: npm start (src/index.js)");
    process.exit(1);
}
client.login(token);