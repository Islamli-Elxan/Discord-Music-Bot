const filters = {
  bassboost: "bass=g=8",
  nightcore: "aresample=48000,asetrate=48000*1.25",
  vaporwave: "aresample=44100,asetrate=44100*0.85",
  "8d": "apulsator=hz=0.09",
  karaoke: "stereotools=mlev=0.03",
  treble: "treble=g=5",
  // Optional echo depth effect for the base pipeline.
  // Toggleable via `/filter echo`.
  echo: "aecho=0.8:0.9:1000:0.3"
};

function getFilterNames() {
  return Object.keys(filters);
}

function getFilterValue(name) {
  return filters[name];
}

module.exports = { getFilterNames, getFilterValue };
