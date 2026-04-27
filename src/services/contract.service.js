
const { essentialFields, criticalKeywords, riskPatterns } = require('../utils/keywords');
const { contractTypeRules } = require('../utils/contractTypes');

function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
}

function inferContractType(normalizedText) {
  if (containsAny(normalizedText, ['prestacao de servicos', 'servicos', 'escopo'])) {
    return 'prestacao_servico';
  }

  if (containsAny(normalizedText, ['locador', 'locatario', 'aluguel'])) {
    return 'locacao';
  }

  if (containsAny(normalizedText, ['comprador', 'vendedor', 'compra e venda'])) {
    return 'compra_venda';
  }

  if (containsAny(normalizedText, ['sigilo', 'confidencialidade', 'informacoes confidenciais'])) {
    return 'confidencialidade';
  }

  return 'nao_informado';
}

function getRiskLevel(score) {
  if (score <= 30) {
    return 'baixo';
  }

  if (score <= 60) {
    return 'medio';
  }

  if (score <= 80) {
    return 'alto';
  }

  return 'critico';
}

function buildMissingFieldRisks(missingFields) {
  const riskMap = {
    'partes envolvidas': {
      risk: 'Contrato sem identificacao clara das partes',
      severity: 'alta',
      recommendation: 'Informar nome, documento e qualificacao de cada parte.',
    },
    'objeto do contrato': {
      risk: 'Contrato sem objeto bem definido',
      severity: 'alta',
      recommendation: 'Descrever com clareza o servico, produto ou obrigacao contratada.',
    },
    'valor do contrato': {
      risk: 'Contrato sem valor definido',
      severity: 'alta',
      recommendation: 'Informar valor total, indice de reajuste e moeda aplicavel.',
    },
    'prazo do contrato': {
      risk: 'Contrato sem prazo definido',
      severity: 'alta',
      recommendation: 'Definir data de inicio, fim ou periodo de vigencia.',
    },
    'forma de pagamento': {
      risk: 'Contrato sem forma de pagamento detalhada',
      severity: 'media',
      recommendation: 'Especificar vencimentos, meio de pagamento e condicoes de atraso.',
    },
    multa: {
      risk: 'Contrato sem previsao objetiva de multa',
      severity: 'media',
      recommendation: 'Avaliar se faz sentido prever multa para inadimplemento ou rescisao.',
    },
    rescisao: {
      risk: 'Contrato sem regras claras de rescisao',
      severity: 'alta',
      recommendation: 'Definir hipoteses, prazos de aviso e efeitos da rescisao.',
    },
    foro: {
      risk: 'Contrato sem definicao de foro',
      severity: 'media',
      recommendation: 'Definir o foro competente para eventuais disputas.',
    },
    'assinatura das partes': {
      risk: 'Contrato sem assinatura das partes',
      severity: 'alta',
      recommendation: 'Garantir assinatura ou aceite formal de todos os envolvidos.',
    },
    testemunhas: {
      risk: 'Contrato sem testemunhas',
      severity: 'baixa',
      recommendation: 'Avaliar a inclusao de testemunhas para reforcar a formalizacao.',
    },
    'data e local': {
      risk: 'Contrato sem data e local de formalizacao',
      severity: 'media',
      recommendation: 'Adicionar cidade, data de assinatura e referencia temporal.',
    },
  };

  return missingFields.map((field) => riskMap[field]);
}

function buildRecommendations(missingFields, matchedPatterns, criticalClauses) {
  const recommendations = [];

  if (missingFields.includes('prazo do contrato')) {
    recommendations.push('Adicionar prazo de vigencia.');
  }

  if (missingFields.includes('valor do contrato') || missingFields.includes('forma de pagamento')) {
    recommendations.push('Confirmar valor e forma de pagamento.');
  }

  if (missingFields.includes('assinatura das partes')) {
    recommendations.push('Coletar assinatura ou aceite formal das partes.');
  }

  if (missingFields.includes('rescisao')) {
    recommendations.push('Revisar as clausulas de rescisao.');
  }

  if (matchedPatterns.some((pattern) => pattern.key === 'renovacao automatica')) {
    recommendations.push('Avaliar se a renovacao automatica deve exigir aprovacao expressa.');
  }

  if (matchedPatterns.some((pattern) => pattern.key === 'prazo indeterminado')) {
    recommendations.push('Substituir prazo indeterminado por vigencia definida ou criterio objetivo de renovacao.');
  }

  if (criticalClauses.some((clause) => clause.type === 'confidencialidade')) {
    recommendations.push('Verificar se as obrigacoes de confidencialidade possuem prazo e escopo proporcionais.');
  }

  if (criticalClauses.some((clause) => clause.type === 'responsabilidade')) {
    recommendations.push('Confirmar limites de responsabilidade e exclusoes aplicaveis.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Manter revisao juridica final antes da assinatura.');
  }

  return [...new Set(recommendations)];
}

function buildExecutiveSummary(contractType, riskLevel, missingFields, risks) {
  const typeLabel = contractType === 'nao_informado' ? 'analisado' : `do tipo ${contractType}`;
  const mainMissing = missingFields.slice(0, 2).join(' e ');
  const mainRisk = risks[0] ? risks[0].risk.toLowerCase() : 'sem pontos criticos relevantes';

  if (missingFields.length > 0) {
    return `O contrato ${typeLabel} apresenta risco ${riskLevel}, principalmente pela ausencia de ${mainMissing}. Recomenda-se revisao antes da assinatura.`;
  }

  return `O contrato ${typeLabel} apresenta risco ${riskLevel}, com destaque para ${mainRisk}. Recomenda-se validar as clausulas criticas identificadas antes da formalizacao.`;
}


function analyzeContractText(contractText, contractType) {
  const normalizedText = normalizeText(contractText);
  const detectedContractType = contractType ? contractType.trim() : inferContractType(normalizedText);

  // Busca regras específicas para o tipo de contrato, ou fallback para 'nao_informado'
  const rules = contractTypeRules[detectedContractType] || contractTypeRules['nao_informado'];

  // Filtra campos essenciais conforme o tipo
  const missingFields = rules.essentialFields
    .filter((fieldKey) => {
      const fieldObj = essentialFields.find((f) => f.key === fieldKey);
      if (!fieldObj) return true;
      return !containsAny(normalizedText, fieldObj.patterns);
    });

  // Filtra cláusulas críticas conforme o tipo
  const criticalClauses = criticalKeywords
    .filter((item) => {
      if (!rules.criticalClauses.length) return false;
      if (!rules.criticalClauses.includes(item.type)) return false;
      const patterns = item.keywords || [item.keyword];
      return patterns.some((pattern) => normalizedText.includes(normalizeText(pattern)));
    })
    .map((item) => ({
      type: item.type,
      severity: item.severity,
      found: true,
      description: item.description,
    }));

  const matchedPatterns = riskPatterns.filter((pattern) =>
    normalizedText.includes(normalizeText(pattern.key))
  );

  const risks = buildMissingFieldRisks(missingFields);

  matchedPatterns.forEach((pattern) => {
    risks.push({
      risk: pattern.risk,
      severity: pattern.severity,
      recommendation: pattern.recommendation,
    });
  });

  // Score ajustado conforme regras específicas
  let riskScore = 0;
  riskScore += missingFields.length * 8;
  riskScore += criticalClauses.length * 6;
  matchedPatterns.forEach((pattern) => {
    riskScore += pattern.score;
  });
  if (missingFields.includes('assinatura das partes')) {
    riskScore += 15;
  }
  if (missingFields.includes('valor do contrato')) {
    riskScore += 10;
  }
  if (missingFields.includes('prazo do contrato')) {
    riskScore += 10;
  }
  riskScore = Math.min(riskScore, 100);

  const riskLevel = getRiskLevel(riskScore);
  const executiveSummary = buildExecutiveSummary(
    detectedContractType,
    riskLevel,
    missingFields,
    risks
  );
  const recommendations = buildRecommendations(missingFields, matchedPatterns, criticalClauses);

  return {
    summary: {
      contractType: detectedContractType,
      riskScore,
      riskLevel,
      executiveSummary,
    },
    missingFields,
    criticalClauses,
    risks,
    recommendations,
  };
}

module.exports = {
  analyzeContractText,
};
