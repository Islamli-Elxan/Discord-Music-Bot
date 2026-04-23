module.exports = {
  name: "clientReady",
  once: true,
  execute(client) {
    client.logger.info(`Logged in as ${client.user.tag}`);
    client.user.setActivity("music", { type: 2 });
  }
};
