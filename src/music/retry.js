const retryMap = new Map();

function getKey(guildId, track) {
  const id = track?.id || track?.url || track?.title || "unknown";
  return `${guildId}:${id}`;
}

function getRetryCount(guildId, track) {
  return retryMap.get(getKey(guildId, track)) || 0;
}

function incrementRetry(guildId, track) {
  const key = getKey(guildId, track);
  const count = (retryMap.get(key) || 0) + 1;
  retryMap.set(key, count);
  return count;
}

function clearRetry(guildId, track) {
  retryMap.delete(getKey(guildId, track));
}

module.exports = { getRetryCount, incrementRetry, clearRetry };
