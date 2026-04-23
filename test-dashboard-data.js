/**
 * Test Script - Populate Dashboard with Sample Data
 * 
 * Run this script to test the dashboard with sample player data
 * 
 * Usage: node test-dashboard-data.js
 */

const dashboardBridge = require('./dashboard-bridge');

console.log('🎵 Populating dashboard with test data...\n');

// Sample guild ID (replace with your guild ID for testing)
const GUILD_ID = '1234567890123456789';

// Add a currently playing track
dashboardBridge.updateTrack(GUILD_ID, {
    title: 'Lost in the Echo',
    artist: 'Linkin Park',
    albumArt: 'https://picsum.photos/400/400?random=10',
    duration: 206,
    url: 'https://www.youtube.com/watch?v=example'
});

console.log('✅ Added current track: Lost in the Echo - Linkin Park');

// Update play state
dashboardBridge.updatePlayState(GUILD_ID, true);
console.log('✅ Set player state: Playing');

// Add some tracks to the queue
const queueTracks = [
    {
        title: 'In the End',
        author: 'Linkin Park',
        thumbnail: 'https://picsum.photos/400/400?random=11',
        duration: 216,
        requestedBy: 'TestUser#1234'
    },
    {
        title: 'Numb',
        author: 'Linkin Park',
        thumbnail: 'https://picsum.photos/400/400?random=12',
        duration: 185,
        requestedBy: 'MusicFan#5678'
    },
    {
        title: 'Breaking the Habit',
        author: 'Linkin Park',
        thumbnail: 'https://picsum.photos/400/400?random=13',
        duration: 196,
        requestedBy: 'RockLover#9012'
    },
    {
        title: 'What I\'ve Done',
        author: 'Linkin Park',
        thumbnail: 'https://picsum.photos/400/400?random=14',
        duration: 205,
        requestedBy: 'TestUser#1234'
    }
];

dashboardBridge.updateQueue(GUILD_ID, queueTracks);
console.log(`✅ Added ${queueTracks.length} tracks to queue`);

// Update volume
dashboardBridge.updateVolume(GUILD_ID, 75);
console.log('✅ Set volume: 75%');

// Update loop mode
dashboardBridge.updateLoopMode(GUILD_ID, 'queue');
console.log('✅ Set loop mode: queue');

// Update shuffle state
dashboardBridge.updateShuffleState(GUILD_ID, false);
console.log('✅ Set shuffle: off');

// Add some history
const historyTracks = [
    {
        title: 'Crawling',
        artist: 'Linkin Park',
        albumArt: 'https://picsum.photos/400/400?random=15',
        duration: 209
    },
    {
        title: 'One Step Closer',
        artist: 'Linkin Park',
        albumArt: 'https://picsum.photos/400/400?random=16',
        duration: 156
    },
    {
        title: 'Papercut',
        artist: 'Linkin Park',
        albumArt: 'https://picsum.photos/400/400?random=17',
        duration: 184
    }
];

historyTracks.forEach(track => {
    dashboardBridge.addToHistory(GUILD_ID, track);
});

console.log(`✅ Added ${historyTracks.length} tracks to history`);

console.log('\n🎉 Test data populated successfully!');
console.log(`📊 Guild ID: ${GUILD_ID}`);
console.log('\n💡 To view this data:');
console.log('   1. Start the dashboard: npm run dashboard');
console.log('   2. Login at: http://localhost:3000');
console.log('   3. Add ?guild=' + GUILD_ID + ' to the URL');
console.log('   4. Example: http://localhost:3000/dashboard?guild=' + GUILD_ID);

console.log('\n🔄 To test different scenarios:');
console.log('   - Pause: dashboardBridge.updatePlayState(guildId, false)');
console.log('   - Skip: Add a new track and update queue');
console.log('   - Volume: dashboardBridge.updateVolume(guildId, 50)');

console.log('\n📝 Note: This data is stored in memory and will be cleared when the server restarts.');

// Keep the script running for a moment
setTimeout(() => {
    console.log('\n✨ You can now start the dashboard and see this data!');
    process.exit(0);
}, 1000);
