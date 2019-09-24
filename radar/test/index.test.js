'use strict';

const http = require('http');
const fs = require('fs').promises;
const { once } = require('events');
const assert = require('assert').strict;
const EventSource = require('eventsource');
const makeHandler = require('../make-request-handler');

const HARDWARE_PATH = require('path').join(__dirname, 'radar.dat');

function listenNTimes(eventSource, eventName, n) {
  let calls = 0;

  const events = [];

  return new Promise((resolve, reject) => {
    function listener(event) {
      calls++;
      events.push(event);

      if (calls === n) {
        eventSource.close();
        eventSource.removeEventListener(eventName, listener);
        eventSource.removeEventListener('error', onError);
        resolve(events);
      }
    }

    function onError(error) {
      eventSource.close();
      eventSource.removeEventListener(eventName, listener);
      eventSource.removeEventListener('error', onError);
      reject(error);
    }

    eventSource.addEventListener(eventName, listener);
    eventSource.addEventListener('error', onError);
  });
}

describe('radar', () => {
  let server;
  let handler;

  beforeEach(done => {
    fs.writeFile(HARDWARE_PATH, '100,100,0,50,0,0,0\n')
      .then(() => {
        handler = makeHandler(HARDWARE_PATH);
        server = http.createServer(handler).listen(1234, done);
      })
      .catch(done);
  });

  afterEach(async () => {
    handler.close();
    await fs.unlink(HARDWARE_PATH);
    server.close();
  });

  it('responds with text/html on /', async () => {
    const req = http.get('http://localhost:1234');
    const [res] = await once(req, 'response');
    const chunks = [];

    assert.equal(res.statusCode, 200);

    for await (const chunk of res) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString();

    assert.ok(body.trim().startsWith('<!doctype html>'));
  });

  it('responds with text/event-stream on /events', async () => {
    const req = http.get('http://localhost:1234/events');
    const [res] = await once(req, 'response');

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'text/event-stream');

    res.destroy();
  });

  it('sends initial data upon connection', async () => {
    const source = new EventSource('http://localhost:1234/events');
    const events = await listenNTimes(source, 'append', 1);

    assert.equal(events.length, 1);
    assert.equal(events[0].data, '[{"x":100,"y":100,"z":0,"dx":0,"dy":0,"dz":0,"reflectivity":50}]');
  });

  it('sends the correct offset as the id', async () => {
    const source = new EventSource('http://localhost:1234/events');
    const events = await listenNTimes(source, 'append', 1);
    const stat = await fs.stat(HARDWARE_PATH);

    assert.equal(events.length, 1);
    assert.equal(events[0].lastEventId, `${stat.size}`);
  });
});
