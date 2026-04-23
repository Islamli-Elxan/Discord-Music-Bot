function progressBar(position, duration, size = 20) {
  if (!duration || duration === 0) return "─".repeat(size);
  const ratio = Math.min(Math.max(position / duration, 0), 1);
  const index = Math.round(ratio * size);
  let bar = "";
  for (let i = 0; i < size; i += 1) {
    bar += i === index ? "🔘" : "─";
  }
  return bar;
}

module.exports = { progressBar };
