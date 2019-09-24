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
    if (req.url !== '/events') {
      return res
        .writeHead(200, { 'Content-Type': 'text/html' })
        .end('<!doctype html><html lang="en"><body>hi</body></html>');
    }

    // SSE supports a cursor, set by the `id` field when sending.
    // On reconnect, resume where we left off by letting the id be the offset.
    let offset = parseInt(req.headers['last-event-id'], 10) || 0;

    res.writeHead(200, { ...sseHeaders });

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

      relay.once('append', onAppend);
    }

    onAppend();

    // Heartbeats are sent on a special event to keep the connection alive.
    const interval = setInterval(makeHeartbeatMessage, 1000, res);

    // When the connection closes, clean things up to avoid leaks.
    res.once('close', () => {
      relay.off('append', onAppend);
      clearInterval(interval);
    });
  }

  requestHandler.close = function () {
    clearTimeout(timeout);
  };

  return requestHandler;
}

module.exports = makeRequestHandler;
