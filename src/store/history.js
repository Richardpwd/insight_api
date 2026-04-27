const crypto = require('crypto');
const pool = require('../db');

const inMemoryHistory = [];
const inMemoryContracts = [];
const inMemoryAuditLogs = [];
let inMemoryHistoryId = 1;
let inMemoryContractId = 1;
let inMemoryAuditId = 1;

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
    CREATE TABLE IF NOT EXISTS contracts (
      id               INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
      createdAt        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source           VARCHAR(20)   NOT NULL,
      fileName         VARCHAR(255),
      contractType     VARCHAR(50)   NOT NULL,
      contractText     LONGTEXT,
      extractedText    LONGTEXT,
      textHash         CHAR(64)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS analyses (
      id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      contractId       INT          NOT NULL,
      timestamp        VARCHAR(30)  NOT NULL,
      contractType     VARCHAR(50)  NOT NULL,
      riskScore        INT          NOT NULL,
      riskLevel        VARCHAR(20)  NOT NULL,
      executiveSummary TEXT         NOT NULL,
      source           VARCHAR(20)  NOT NULL,
      fileName         VARCHAR(255),
      analysisEngine   VARCHAR(30)  NOT NULL DEFAULT 'rules',
      aiResult         LONGTEXT,
      FOREIGN KEY (contractId) REFERENCES contracts(id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id               INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
      createdAt        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      requestId        VARCHAR(80),
      eventType        VARCHAR(80)   NOT NULL,
      endpoint         VARCHAR(120),
      method           VARCHAR(10),
      statusCode       INT,
      apiKeyHash       CHAR(64),
      ipAddress        VARCHAR(80),
      userAgent        VARCHAR(255),
      metadata         LONGTEXT
    )
  `);

  // Mantem compatibilidade com bancos criados antes do relacionamento com contratos.
  if (!(await hasColumn('analyses', 'contractId'))) {
    await pool.execute(`
      ALTER TABLE analyses
      ADD COLUMN contractId INT NULL
    `);

    if (!(await hasColumn('contracts', 'legacyAnalysisId'))) {
      await pool.execute(`
        ALTER TABLE contracts
        ADD COLUMN legacyAnalysisId INT NULL
      `);
    }

    await pool.execute(`
      INSERT INTO contracts (
        source,
        fileName,
        contractType,
        contractText,
        extractedText,
        textHash,
        legacyAnalysisId
      )
      SELECT
        COALESCE(a.source, 'texto') AS source,
        a.fileName,
        COALESCE(a.contractType, 'nao_informado') AS contractType,
        NULL,
        NULL,
        NULL,
        a.id
      FROM analyses a
      WHERE a.contractId IS NULL
    `);

    await pool.execute(`
      UPDATE analyses a
      INNER JOIN contracts c
        ON c.legacyAnalysisId = a.id
      SET a.contractId = c.id
      WHERE a.contractId IS NULL
    `);

    await pool.execute(`
      UPDATE contracts
      SET legacyAnalysisId = NULL
      WHERE legacyAnalysisId IS NOT NULL
    `);

    await pool.execute(`
      ALTER TABLE analyses
      MODIFY contractId INT NOT NULL
    `);
  }

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
  contractText,
  extractedText,
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
  const normalizedContractType = contractType || 'nao_informado';
  const safeContractText = typeof contractText === 'string' ? contractText : null;
  const safeExtractedText = typeof extractedText === 'string' ? extractedText : null;
  const textHash = safeContractText
    ? crypto.createHash('sha256').update(safeContractText).digest('hex')
    : null;

  if (!pool) {
    const contract = {
      id: inMemoryContractId,
      createdAt: timestamp,
      source,
      fileName: fileName || null,
      contractType: normalizedContractType,
      contractText: safeContractText,
      extractedText: safeExtractedText,
      textHash,
    };

    inMemoryContractId += 1;
    inMemoryContracts.unshift(contract);

    const entry = {
      id: inMemoryHistoryId,
      contractId: contract.id,
      timestamp,
      contractType: normalizedContractType,
      riskScore,
      riskLevel,
      executiveSummary,
      source,
      fileName: fileName || null,
      analysisEngine: analysisEngine || 'rules',
      aiResult: aiResult || null,
    };

    inMemoryHistoryId += 1;
    inMemoryHistory.unshift(entry);
    return entry;
  }

  const [contractResult] = await pool.execute(
    `INSERT INTO contracts (
      source,
      fileName,
      contractType,
      contractText,
      extractedText,
      textHash
    )
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      source,
      fileName || null,
      normalizedContractType,
      safeContractText,
      safeExtractedText,
      textHash,
    ]
  );

  const contractId = contractResult.insertId;

  const [result] = await pool.execute(
    `INSERT INTO analyses (
      contractId,
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contractId,
      timestamp,
      normalizedContractType,
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
    contractId,
    timestamp,
    contractType: normalizedContractType,
    riskScore,
    riskLevel,
    executiveSummary,
    source,
    fileName: fileName || null,
    analysisEngine: analysisEngine || 'rules',
    aiResult: aiResult || null,
  };
}

async function getHistory(limit = 100) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(500, Number(limit))) : 100;

  if (!pool) {
    return inMemoryHistory.slice(0, safeLimit);
  }

  const [rows] = await pool.execute(
    `SELECT
      a.id,
      a.contractId,
      a.timestamp,
      a.contractType,
      a.riskScore,
      a.riskLevel,
      a.executiveSummary,
      a.source,
      a.fileName,
      a.analysisEngine,
      a.aiResult,
      c.createdAt AS contractCreatedAt,
      c.textHash
     FROM analyses a
     INNER JOIN contracts c ON c.id = a.contractId
     ORDER BY a.id DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows;
}

function buildAuditPayload({
  requestId,
  eventType,
  endpoint,
  method,
  statusCode,
  apiKey,
  ipAddress,
  userAgent,
  metadata,
}) {
  const apiKeyHash =
    typeof apiKey === 'string' && apiKey.trim()
      ? crypto.createHash('sha256').update(apiKey.trim()).digest('hex')
      : null;

  return {
    requestId: requestId || null,
    eventType,
    endpoint: endpoint || null,
    method: method || null,
    statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
    apiKeyHash,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };
}

async function saveAuditLog(payload) {
  const createdAt = new Date().toISOString();
  const normalized = buildAuditPayload(payload);

  if (!pool) {
    const entry = {
      id: inMemoryAuditId,
      createdAt,
      ...normalized,
    };

    inMemoryAuditId += 1;
    inMemoryAuditLogs.unshift(entry);
    return entry;
  }

  const [result] = await pool.execute(
    `INSERT INTO audit_logs (
      requestId,
      eventType,
      endpoint,
      method,
      statusCode,
      apiKeyHash,
      ipAddress,
      userAgent,
      metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.requestId,
      normalized.eventType,
      normalized.endpoint,
      normalized.method,
      normalized.statusCode,
      normalized.apiKeyHash,
      normalized.ipAddress,
      normalized.userAgent,
      normalized.metadata,
    ]
  );

  return { id: result.insertId, createdAt, ...normalized };
}

async function getAuditTrail(limit = 100) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(500, Number(limit))) : 100;

  if (!pool) {
    return inMemoryAuditLogs.slice(0, safeLimit);
  }

  const [rows] = await pool.execute(
    `SELECT id, createdAt, requestId, eventType, endpoint, method, statusCode, apiKeyHash, ipAddress, userAgent, metadata
     FROM audit_logs
     ORDER BY id DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows;
}

function resetInMemoryStore() {
  inMemoryHistory.length = 0;
  inMemoryContracts.length = 0;
  inMemoryAuditLogs.length = 0;
  inMemoryHistoryId = 1;
  inMemoryContractId = 1;
  inMemoryAuditId = 1;
}

module.exports = {
  saveAnalysis,
  getHistory,
  saveAuditLog,
  getAuditTrail,
  resetInMemoryStore,
};
