'use strict';

function parseLine(line) {
  const [x, y, z, ...rawEmissions] = line
    .split(',')
    .flatMap(el => el.split(':'))
    .map(el => parseInt(el, 10));

  const emissions = [];

  for (let i = 0; i < rawEmissions.length; i += 2) {
    emissions.push({ frequency: rawEmissions[i], intensity: rawEmissions[i + 1] });
  }

  return { x, y, z, emissions };
}

module.exports = function decodeRadarData(data) {
  return data
    .trim()
    .split('\n')
    .map(parseLine);
};
