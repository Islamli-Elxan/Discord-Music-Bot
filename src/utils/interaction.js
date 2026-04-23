async function safeEdit(client, interaction, payload) {
  try {
    return await interaction.editReply(payload);
  } catch (err) {
    if (err.code === 10062 || err.message?.includes("Unknown interaction")) {
      if (interaction.channel?.send) {
        await interaction.channel.send({ embeds: payload.embeds || [] }).catch(() => {});
      }
      return;
    }
    throw err;
  }
}

module.exports = { safeEdit };
