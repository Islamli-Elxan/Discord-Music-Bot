function isDJ(member, settings) {
  if (!member) return false;
  if (member.permissions.has("ManageGuild")) return true;
  if (!settings || !settings.dj_role_id) return false;
  return member.roles.cache.has(settings.dj_role_id);
}

module.exports = { isDJ };
