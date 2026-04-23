const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { buildFullFfmpegFilters } = require("../music/audioProcessing");
const { getAvailablePresets, isValidPreset } = require("../music/eqPresetToFilters");

function toLoudnormMeta(row) {
  if (!row) return null;
  return {
    measured_I: row.measured_I != null ? Number(row.measured_I) : null,
    measured_TP: row.measured_TP != null ? Number(row.measured_TP) : null,
    measured_LRA: row.measured_LRA != null ? Number(row.measured_LRA) : null,
    measured_thresh: row.measured_thresh != null ? Number(row.measured_thresh) : null,
    target_offset: row.target_offset != null ? Number(row.target_offset) : null
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eq")
    .setDescription("Choose an EQ preset for audio processing")
    .addStringOption((o) => {
      const opt = o.setName("preset").setDescription("EQ preset").setRequired(true);
      for (const p of getAvailablePresets()) opt.addChoices({ name: p, value: p });
      return opt;
    }),
  djOnly: true,
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();

    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)] });

    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)] });

    const presetName = interaction.options.getString("preset", true);
    if (!isValidPreset(presetName)) {
      return interaction.editReply({ embeds: [errorEmbed(client, "Invalid EQ preset.")] });
    }

    await client.db.upsertEqPreset(interaction.guild.id, presetName);
    if (queue?.metadata) queue.metadata.eqPreset = presetName;

    // Apply for current track too (best-effort). Next tracks will be correct because
    // `onBeforeCreateStream` also rebuilds the filter chain.
    try {
      const currentTrack = queue.currentTrack;
      if (currentTrack) {
        const trackKey = currentTrack.url || currentTrack.id || currentTrack.title;
        const loudRow = trackKey ? await client.db.getTrackLoudnessGain(trackKey) : null;
        const loudnormMeta = toLoudnormMeta(loudRow);

        const ffmpegFilters = buildFullFfmpegFilters({
          userFilterNames: queue.metadata.filters,
          eqPresetName: presetName,
          loudnormMeta
        });
        await queue.filters.ffmpeg.setFilters(ffmpegFilters);
      }
    } catch (_) {
      // If filter update fails mid-playback, don't block EQ selection.
    }

    return interaction.editReply({
      embeds: [infoEmbed(client, `EQ preset set to **${presetName}**.`, "EQ")]
    });
  }
};

