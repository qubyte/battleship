'use strict';

/* eslint no-console: off */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const decode = require('./decode-radar-data');

const sseHeaders = {
  'Cache-Control': 'no-cache',
  'Content-Type': 'text/event-stream',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no' // Tell Nginx not to buffer this response.
};

function makeAppendMessage(res, buffer, offset) {
  const decoded = decode(buffer.toString());

  res.write(`id: ${offset}\nevent: append\ndata: ${JSON.stringify(decoded)}\n\n`);
}

function makeErrorMessage(res, error) {
  res.write(`event: error\ndata: ${JSON.stringify(error.stack)}\n\n`);
}

function makeHeartbeatMessage(res) {
  res.write('event: heartbeat\ndata: heartbeat\n\n');
}

// Make an HTTP request handler which monitors the given path for changes.
// Upon changes, emit the end part of the file connected clients don't have.
// On connection, send only what the client needs by using the SSE last-event-id
// as a byte offset.
function makeRequestHandler(hardwarePath) {
  const relay = new EventEmitter().setMaxListeners(Infinity);

  let lastChange = null;
  let fileContent = Buffer.from('');
  let timeout;

  async function pollStats() {
    const { mtimeMs } = fs.stat(hardwarePath);

    if (lastChange !== mtimeMs) {
      try {
        lastChange = mtimeMs;
        fileContent = await fs.readFile(hardwarePath);
        relay.emit('append');
      } catch (error) {
        console.error('Error reading file:', error.stack);
      }
    }

    timeout = setTimeout(pollStats, 100).unref();
  }

  pollStats();

  function requestHandler(req, res) {
    // Send minimal HTML for non-events requests.
    if (req.url !== '/events') {
      return res
        .writeHead(200, { 'Content-Type': 'text/html' })
        .end('<!doctype html><html lang="en"><body>hi</body></html>');
    }

    // SSE supports a cursor, set by the `id` field when sending.
    // On reconnect, resume where we left off by letting the id be the offset.
    let offset = parseInt(req.headers['last-event-id'], 10) || 0;

    res.writeHead(200, { ...sseHeaders });

    // SSE needs a newline after headers.
    res.write('\n');

    function onAppend() {
      try {
        const toSend = fileContent.slice(offset);

        if (toSend.length) {
          offset += toSend.length;

          makeAppendMessage(res, toSend, offset);
        }
      } catch (error) {
        makeErrorMessage(res, error);
      }
    }

    // Send new data as it comes in.
    relay.on('append', onAppend);

    // Send the initial set of data.
    onAppend();

    // Heartbeats are sent on a special event to keep the connection alive.
    const interval = setInterval(makeHeartbeatMessage, 1000, res);

    // When the connection closes, clean things up to avoid leaks.
    res.once('close', () => {
      relay.off('append', onAppend);
      clearInterval(interval);
    });
  }

  // Use this to dispose of the request handler, otherwise the poll timeout will
  // cause it to hang.
  requestHandler.close = function () {
    clearTimeout(timeout);
  };

  return requestHandler;
}

module.exports = makeRequestHandler;
