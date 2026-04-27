const pool = require('../db');

async function initTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS analyses (
      id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      timestamp        VARCHAR(30)  NOT NULL,
      contractType     VARCHAR(50)  NOT NULL,
      riskScore        INT          NOT NULL,
      riskLevel        VARCHAR(20)  NOT NULL,
      executiveSummary TEXT         NOT NULL,
      source           VARCHAR(20)  NOT NULL,
      fileName         VARCHAR(255)
    )
  `);
}

// Cria a tabela na primeira vez que o modulo e carregado.
initTable().catch((err) => {
  console.error('Erro ao criar tabela analyses:', err.message);
  process.exit(1);
});

async function saveAnalysis({ contractType, riskScore, riskLevel, executiveSummary, source, fileName }) {
  const timestamp = new Date().toISOString();

  const [result] = await pool.execute(
    `INSERT INTO analyses (timestamp, contractType, riskScore, riskLevel, executiveSummary, source, fileName)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [timestamp, contractType, riskScore, riskLevel, executiveSummary, source, fileName || null]
  );

  return {
    id: result.insertId,
    timestamp,
    contractType,
    riskScore,
    riskLevel,
    executiveSummary,
    source,
    fileName: fileName || null,
  };
}

async function getHistory() {
  const [rows] = await pool.execute('SELECT * FROM analyses ORDER BY id DESC');
  return rows;
}

module.exports = { saveAnalysis, getHistory };
