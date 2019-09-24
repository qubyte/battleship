'use strict';

const fs = require('fs').promises;
const EventSource = require('eventsource');

const objects = new Map();

function updateRadar({ x, y, z, dx, dy, dz, reflectivity }) {
  const key = `${x}:${y}:${z}`;

  let object;

  if (objects.has(key)) {
    object = objects.get(key);
  } else {
    object = { x, y, z };
    objects.set(key, object);
  }

  Object.assign(object, { dx, dy, dz, reflectivity });
}

function updateRt({ x, y, z, emissions }) {
  const key = `${x}:${y}:${z}`;

  let object;

  if (objects.has(key)) {
    object = objects.get(key);
  } else {
    object = { x, y, z };
    objects.set(key, object);
  }

  Object.assign(object, { emissions });
}

function writeOutput() {
  const lines = [];

  for (const { x, y, z, dx, dy, dz, reflectivity, emissions = [] } of objects.values()) {
    if (reflectivity) {
      const emissionsPart = emissions.map(({ frequency, intensity }) => `,${frequency}:${intensity}`).join('');
      const line = `${x},${y},${z},${reflectivity},${dx},${dy},${dz}${emissionsPart}`;
      lines.push(line);
    }
  }

  return fs.writeFile('/hw/holoscreen', lines.join('\n'));
}

function writeUnavailable() {
  return fs.writeFile('/hw/holoscreen', 'ERROR: SOURCES UNAVAILABLE');
}

function start() {
  const radar = new EventSource('http://radar:8000/events');

  radar.addEventListener('append', ({ data }) => {
    JSON.parse(data).map(updateRadar);
  });

  const rt = new EventSource('http://rt:8000/events');

  rt.addEventListener('append', ({ data }) => {
    JSON.parse(data).map(updateRt);
  });

  let timeout;

  // On error write an error status to the file when neither source is available.
  radar.onerror = rt.onerror = () => {
    if (radar.readState !== 1 && rt.readState !== 1) {
      clearTimeout(timeout);
      writeUnavailable();
    }
  };

  async function run() {
    timeout = null;
    await writeOutput();
    timeout = setTimeout(run, 500);
  }

  // When at least one source is open begin recording data.
  radar.onopen = rt.onopen = () => {
    if (!timeout) {
      run();
    }
  };
}

start();

process.on('SIGTERM', () => process.exit());
