// Campos essenciais e cláusulas críticas por tipo de contrato
// Adicione ou ajuste conforme necessário para cada tipo

const contractTypeRules = {
  prestacao_servico: {
    essentialFields: [
      'partes envolvidas',
      'objeto do contrato',
      'valor do contrato',
      'prazo do contrato',
      'forma de pagamento',
      'rescisao',
      'assinatura das partes',
      'data e local',
    ],
    criticalClauses: ['multa rescisoria', 'confidencialidade', 'responsabilidade'],
  },
  locacao: {
    essentialFields: [
      'partes envolvidas',
      'objeto do contrato',
      'valor do contrato',
      'prazo do contrato',
      'forma de pagamento',
      'rescisao',
      'foro',
      'assinatura das partes',
      'data e local',
    ],
    criticalClauses: ['multa rescisoria', 'indenizacao', 'responsabilidade'],
  },
  compra_venda: {
    essentialFields: [
      'partes envolvidas',
      'objeto do contrato',
      'valor do contrato',
      'prazo do contrato',
      'forma de pagamento',
      'rescisao',
      'assinatura das partes',
      'data e local',
    ],
    criticalClauses: ['multa rescisoria', 'indenizacao', 'responsabilidade'],
  },
  confidencialidade: {
    essentialFields: [
      'partes envolvidas',
      'objeto do contrato',
      'prazo do contrato',
      'assinatura das partes',
      'data e local',
    ],
    criticalClauses: ['confidencialidade'],
  },
  nao_informado: {
    essentialFields: [
      'partes envolvidas',
      'objeto do contrato',
      'valor do contrato',
      'prazo do contrato',
      'forma de pagamento',
      'rescisao',
      'assinatura das partes',
      'data e local',
    ],
    criticalClauses: [],
  },
};

module.exports = { contractTypeRules };