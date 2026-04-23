const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { infoEmbed } = require("../utils/embeds");
const { updateSettings } = require("../systems/settings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("djrole")
    .setDescription("Set the DJ role for music commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) => o.setName("role").setDescription("DJ role").setRequired(false)),
  cooldown: 5,
  async execute(client, interaction) {
    await interaction.deferReply();
    const role = interaction.options.getRole("role");
    await updateSettings(client, interaction.guild.id, { dj_role_id: role ? role.id : null });
    return interaction.editReply({
      embeds: [
        infoEmbed(
          client,
          role ? `DJ role set to **${role.name}**.` : "DJ role cleared.",
          "DJ Role"
        )
      ]
    });
  }
};
