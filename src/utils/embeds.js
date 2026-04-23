const { EmbedBuilder } = require("discord.js");

function baseEmbed(client, title) {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(title || null)
    .setTimestamp()
    .setFooter({ text: client.user ? client.user.username : "Music Bot" });
}

function errorEmbed(client, message) {
  return baseEmbed(client, "Error").setDescription(message);
}

function infoEmbed(client, message, title) {
  return baseEmbed(client, title || "Info").setDescription(message);
}

module.exports = { baseEmbed, errorEmbed, infoEmbed };
