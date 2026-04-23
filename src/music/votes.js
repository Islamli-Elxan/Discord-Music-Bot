const voteMap = new Map();

function getVoteKey(guildId) {
  return `${guildId}`;
}

function addVote(guildId, userId) {
  const key = getVoteKey(guildId);
  if (!voteMap.has(key)) voteMap.set(key, new Set());
  const set = voteMap.get(key);
  set.add(userId);
  return set.size;
}

function getVotes(guildId) {
  const key = getVoteKey(guildId);
  return voteMap.get(key) ? voteMap.get(key).size : 0;
}

function clearVotes(guildId) {
  voteMap.delete(getVoteKey(guildId));
}

module.exports = { addVote, getVotes, clearVotes };
