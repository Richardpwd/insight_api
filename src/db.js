const mysql = require('mysql2/promise');

const useInMemoryHistory =
  process.env.USE_IN_MEMORY_HISTORY === 'true' ||
  (process.env.NODE_ENV === 'test' && !process.env.DATABASE_URL);

if (useInMemoryHistory) {
  module.exports = null;
  return;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL nao definida. Configure a variavel de ambiente antes de iniciar.');
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
});

module.exports = pool;
