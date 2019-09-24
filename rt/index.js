'use strict';

const http = require('http');
const handler = require('./request-handler');
const port = process.env.PORT || 8000;

const server = http.createServer(handler);

server.listen(port, () => {
  console.log('Listening on port:', port); // eslint-disable-line no-console
});
