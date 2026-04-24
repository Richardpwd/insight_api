// Armazenamento em memoria para historico de analises.
// Os dados sao perdidos ao reiniciar o servidor.
// Para persistencia real, substitua por um banco de dados.

const MAX_ENTRIES = 100;

const history = [];
let nextId = 1;

function saveAnalysis({ contractType, riskScore, riskLevel, executiveSummary, source, fileName }) {
  const entry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    contractType,
    riskScore,
    riskLevel,
    executiveSummary,
    source,
    fileName: fileName || null,
  };

  // Insere no inicio para mostrar mais recente primeiro.
  history.unshift(entry);

  // Limita o tamanho para nao acumular indefinidamente em memoria.
  if (history.length > MAX_ENTRIES) {
    history.pop();
  }

  return entry;
}

function getHistory() {
  return history;
}

module.exports = { saveAnalysis, getHistory };
