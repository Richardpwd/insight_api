-- Verifica se as tabelas existem e mostra contagem de registros
SHOW TABLES;

-- Contagem de contratos
SELECT COUNT(*) AS total_contracts FROM contracts;

-- Contagem de análises
SELECT COUNT(*) AS total_analyses FROM analyses;

-- Contagem de logs de auditoria
SELECT COUNT(*) AS total_audit_logs FROM audit_logs;

-- Visualiza as 5 últimas análises (com vínculo ao contrato)
SELECT a.id, a.contractId, a.timestamp, a.contractType, a.riskScore, a.riskLevel, a.executiveSummary, c.fileName
FROM analyses a
INNER JOIN contracts c ON c.id = a.contractId
ORDER BY a.id DESC
LIMIT 5;

-- Visualiza as 5 últimas entradas de auditoria
SELECT id, createdAt, eventType, endpoint, statusCode, ipAddress, userAgent
FROM audit_logs
ORDER BY id DESC
LIMIT 5;