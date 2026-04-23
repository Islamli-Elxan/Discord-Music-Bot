const fs = require("node:fs");
const path = require("node:path");

function getCommandFiles(dir, base = "") {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = base ? path.join(base, item.name) : item.name;
    if (item.isDirectory()) {
      results.push(...getCommandFiles(fullPath, relPath));
    } else if (item.name.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadCommands(client, commandsPath, config, logger) {
  const files = getCommandFiles(commandsPath);
  const commands = [];

  for (const filePath of files) {
    try {
      const command = require(filePath);
      if (!command.data || !command.execute) {
        logger?.warn?.("Skipped command file (missing data/execute)", { file: path.basename(filePath) });
        continue;
      }
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    } catch (err) {
      logger?.error?.("Failed to load command", { file: filePath, message: err?.message, stack: err?.stack });
      console.error(`[Loader] Failed to load ${filePath}:`, err.message);
    }
  }

  const names = commands.map((c) => c.name).join(", ");
  logger?.info?.("Loaded commands", { count: commands.length, names });
  console.log(`[INFO] Loaded ${commands.length} commands: ${names}`);

  // Store commands for registration in ready event (uses application.commands)
  client._slashCommandsJSON = commands;
}

function loadEvents(client, eventsPath) {
  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js")).sort();
  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
      client.on(event.name, (...args) => event.execute(client, ...args));
    }
  }
}

module.exports = { loadCommands, loadEvents };
