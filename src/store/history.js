const pool = require('../db');
const inMemoryHistory = [];
let inMemoryId = 1;

async function hasColumn(tableName, columnName) {
  if (!pool) {
    return false;
  }

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function initTable() {
  if (!pool) {
    return;
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS analyses (
      id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      timestamp        VARCHAR(30)  NOT NULL,
      contractType     VARCHAR(50)  NOT NULL,
      riskScore        INT          NOT NULL,
      riskLevel        VARCHAR(20)  NOT NULL,
      executiveSummary TEXT         NOT NULL,
      source           VARCHAR(20)  NOT NULL,
      fileName         VARCHAR(255),
      analysisEngine   VARCHAR(30)  NOT NULL DEFAULT 'rules',
      aiResult         LONGTEXT
    )
  `);

  // Mantem compatibilidade com bancos criados antes dessas colunas.
  if (!(await hasColumn('analyses', 'analysisEngine'))) {
    await pool.execute(`
      ALTER TABLE analyses
      ADD COLUMN analysisEngine VARCHAR(30) NOT NULL DEFAULT 'rules'
    `);
  }

  if (!(await hasColumn('analyses', 'aiResult'))) {
    await pool.execute(`
      ALTER TABLE analyses
      ADD COLUMN aiResult LONGTEXT
    `);
  }
}

// Cria a tabela na primeira vez que o modulo e carregado.
initTable().catch((err) => {
  console.error('Erro ao criar tabela analyses:', err.message);
  process.exit(1);
});

async function saveAnalysis({
  contractType,
  riskScore,
  riskLevel,
  executiveSummary,
  source,
  fileName,
  analysisEngine,
  aiResult,
}) {
  const timestamp = new Date().toISOString();

  if (!pool) {
    const entry = {
      id: inMemoryId,
      timestamp,
      contractType,
      riskScore,
      riskLevel,
      executiveSummary,
      source,
      fileName: fileName || null,
      analysisEngine: analysisEngine || 'rules',
      aiResult: aiResult || null,
    };

    inMemoryId += 1;
    inMemoryHistory.unshift(entry);
    return entry;
  }

  const [result] = await pool.execute(
    `INSERT INTO analyses (
      timestamp,
      contractType,
      riskScore,
      riskLevel,
      executiveSummary,
      source,
      fileName,
      analysisEngine,
      aiResult
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timestamp,
      contractType,
      riskScore,
      riskLevel,
      executiveSummary,
      source,
      fileName || null,
      analysisEngine || 'rules',
      aiResult || null,
    ]
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
    analysisEngine: analysisEngine || 'rules',
    aiResult: aiResult || null,
  };
}

async function getHistory() {
  if (!pool) {
    return inMemoryHistory;
  }

  const [rows] = await pool.execute('SELECT * FROM analyses ORDER BY id DESC');
  return rows;
}

module.exports = { saveAnalysis, getHistory };
