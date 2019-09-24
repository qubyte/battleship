'use strict';

const http = require('http');
const path = require('path');
const makeHandler = require('./make-request-handler');

const port = process.env.PORT || 8000;
const hardwarePath = path.join(process.env.HARDWARE_PATH);
const handler = makeHandler(hardwarePath);

const server = http.createServer(handler);

server.listen(port, () => {
  console.log('Listening on port:', port); // eslint-disable-line no-console
});

process.on('SIGTERM', () => {
  handler.close();
  process.exit();
});
