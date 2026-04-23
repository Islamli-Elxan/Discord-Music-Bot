const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.Channel]
  });

  client.commands = new Collection();
  client.cooldowns = new Collection();

  return client;
}

module.exports = { createClient };
