const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');

const { getAvailablePort } = require('./server.js');

test('getAvailablePort skips a busy port and returns the next free port', async () => {
  const blocker = net.createServer();
  const occupiedPort = await new Promise((resolve) => {
    blocker.listen(0, '127.0.0.1', () => {
      const port = blocker.address().port;
      resolve(port);
    });
  });

  try {
    const nextFreePort = await getAvailablePort(occupiedPort);
    assert.notEqual(nextFreePort, occupiedPort);
    assert.ok(nextFreePort >= occupiedPort);
  } finally {
    await new Promise((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
