async function getSettings(client, guildId) {
  const cached = client.cache.getSettings(guildId);
  if (cached) return cached;
  const data = await client.db.getGuildSettings(guildId);
  const normalized = {
    volume: data?.volume ?? client.config.defaultVolume,
    loop_mode: data?.loop_mode ?? "off",
    autoplay: data?.autoplay ?? 0,
    stay_247: data?.stay_247 ?? 0,
    dj_role_id: data?.dj_role_id ?? null
  };
  client.cache.setSettings(guildId, normalized);
  return normalized;
}

async function updateSettings(client, guildId, patch) {
  const current = await getSettings(client, guildId);
  const next = { ...current, ...patch };
  await client.db.upsertGuildSettings(guildId, {
    volume: next.volume,
    loop_mode: next.loop_mode,
    autoplay: next.autoplay,
    stay_247: next.stay_247,
    dj_role_id: next.dj_role_id
  });
  client.cache.setSettings(guildId, next);
  return next;
}

module.exports = { getSettings, updateSettings };
