function setupAntiCrash(logger) {
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { reason });
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { message: error.message, stack: error.stack });
  });
}

module.exports = { setupAntiCrash };
