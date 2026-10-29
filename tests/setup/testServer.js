process.env.NODE_ENV = 'test';
process.env.PORT = '0';

let server = null;
let db = null;
let activeBaseUrl = '';

/**
 * Initializes and starts the test server on an ephemeral OS-assigned port (port 0)
 * to avoid collisions with any locally running dev server on port 5000.
 */
export async function startTestServer() {
  if (activeBaseUrl) {
    return activeBaseUrl;
  }

  if (!server) {
    const serverModule = await import('../../backend/src/server.js');
    server = serverModule.server;
    db = serverModule.db;
  }

  if (!server.listening) {
    await new Promise((resolve) => {
      server.listen(0, resolve);
    });
  }

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 5000;
  activeBaseUrl = `http://127.0.0.1:${port}`;
  return activeBaseUrl;
}

/**
 * Returns the currently active test server base URL.
 */
export function getBaseUrl() {
  if (!activeBaseUrl && server) {
    const address = server.address();
    if (address && typeof address === 'object') {
      activeBaseUrl = `http://127.0.0.1:${address.port}`;
    }
  }
  return activeBaseUrl;
}

/**
 * Cleanly shuts down the test server and database connections.
 */
export async function stopTestServer() {
  if (server && server.listening) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  try {
    const { disconnectDatabase } = await import('../../backend/src/config/db.js');
    await disconnectDatabase();
  } catch (_) {}
  activeBaseUrl = '';
}

export { server, db };
