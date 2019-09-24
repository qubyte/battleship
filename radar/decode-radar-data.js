'use strict';

function parseLine(line) {
  const [x, y, z, reflectivity, dx, dy, dz] = line.split(',').map(n => parseInt(n, 10));

  return { x, y, z, dx, dy, dz, reflectivity };
}

module.exports = function decodeRadarData(data) {
  return data
    .trim()
    .split('\n')
    .map(parseLine);
};
