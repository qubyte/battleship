'use strict';

const path = require('path');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const decode = require('./decode-radiotelescope-data');

const hardwarePath = path.join(process.env.HARDWARE_PATH);

const relay = new EventEmitter().setMaxListeners(Infinity);
const watcher = chokidar.watch(hardwarePath, { persistent: false });
const sseHeaders = {
  'Cache-Control': 'no-cache',
  'Content-Type': 'text/event-stream',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no' // Tell Nginx not to buffer this response.
};

watcher.once('ready', () => {
  relay.emit('append');
  watcher.on('change', () => relay.emit('append'));
});

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

async function readFileFromOffset(path, offset) {
  let descriptor;

  try {
    descriptor = await fs.open(path, 'r');

    const stat = await descriptor.stat();
    const length =  stat.size - offset;

    return await descriptor.read(Buffer.alloc(length), 0, length, offset);
  } finally {
    if (descriptor) {
      descriptor.close();
    }
  }
}

function requestHandler(req, res) {
  if (req.url !== '/events') {
    return res.writeHead(200).end('<!doctype html><html lang="en"><body>hi</body></html>');
  }

  // SSE supports a cursor, set by the `id` field when sending.
  // On reconnect, resume where we left off.
  let offset = parseInt(req.headers['last-event-id'], 10) || 0;

  res.writeHead(200, { ...sseHeaders });

  res.write('\n');

  async function onAppend() {
    try {
      const { bytesRead, buffer } = await readFileFromOffset(hardwarePath, offset);

      if (bytesRead) {
        offset += bytesRead;

        makeAppendMessage(res, buffer, offset);
      }
    } catch (error) {
      makeErrorMessage(res, error);
    }

    relay.once('append', onAppend);
  }

  onAppend();

  const interval = setInterval(makeHeartbeatMessage, 1000, res);

  res.once('close', () => {
    relay.off('append', onAppend);
    clearInterval(interval);
  });
}

module.exports = requestHandler;
