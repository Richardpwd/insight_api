const essentialFields = [
  {
    key: 'partes envolvidas',
    description: 'identificacao das partes',
    patterns: [
      'contratante',
      'contratada',
      'contratado',
      'partes',
      'representada',
      'cpf',
      'cnpj',
    ],
  },
  {
    key: 'objeto do contrato',
    description: 'descricao do servico ou objeto contratado',
    patterns: [
      'objeto',
      'servicos',
      'serviço',
      'prestacao de servicos',
      'prestação de serviços',
      'finalidade',
    ],
  },
  {
    key: 'valor do contrato',
    description: 'valor total ou precificacao',
    patterns: ['valor', 'r$', 'preco', 'preço', 'remuneracao', 'remuneração'],
  },
  {
    key: 'prazo do contrato',
    description: 'vigencia e duracao',
    patterns: ['prazo', 'vigencia', 'vigência', 'inicio', 'início', 'termino', 'término'],
  },
  {
    key: 'forma de pagamento',
    description: 'condicoes de pagamento',
    patterns: ['pagamento', 'forma de pagamento', 'forma de pgto', 'parcelas', 'boleto', 'pix'],
  },
  {
    key: 'multa',
    description: 'penalidades financeiras',
    patterns: ['multa', 'penalidade', 'clausula penal', 'cláusula penal'],
  },
  {
    key: 'rescisao',
    description: 'encerramento contratual',
    patterns: ['rescisao', 'rescisão', 'rescind', 'encerramento', 'resiliacao', 'resiliação'],
  },
  {
    key: 'foro',
    description: 'foro competente',
    patterns: ['foro', 'comarca', 'jurisdicao', 'jurisdição'],
  },
  {
    key: 'assinatura das partes',
    description: 'assinatura ou aceite das partes',
    patterns: ['assinatura', 'assinam', 'firmam', 'aceite', 'assinaturas'],
  },
  {
    key: 'testemunhas',
    description: 'assinatura de testemunhas',
    patterns: ['testemunhas', 'testemunha'],
  },
  {
    key: 'data e local',
    description: 'cidade, data ou local da assinatura',
    patterns: ['data', 'local', 'cidade', 'municipio', 'município'],
  },
];

const criticalKeywords = [
  {
    type: 'multa rescisoria',
    severity: 'alta',
    keyword: 'multa',
    description: 'Foi identificada clausula relacionada a multa contratual.',
  },
  {
    type: 'rescisao',
    severity: 'alta',
    keywords: ['rescisao', 'rescisão', 'rescind'],
    description: 'Foi identificada clausula de rescisao do contrato.',
  },
  {
    type: 'indenizacao',
    severity: 'alta',
    keyword: 'indenizacao',
    description: 'Foi identificada clausula de indenizacao.',
  },
  {
    type: 'confidencialidade',
    severity: 'media',
    keyword: 'confidencialidade',
    description: 'Foi identificada clausula de confidencialidade.',
  },
  {
    type: 'exclusividade',
    severity: 'media',
    keyword: 'exclusividade',
    description: 'Foi identificada clausula de exclusividade.',
  },
  {
    type: 'foro',
    severity: 'media',
    keyword: 'foro',
    description: 'Foi identificada definicao de foro competente.',
  },
  {
    type: 'atraso',
    severity: 'media',
    keyword: 'atraso',
    description: 'Foi identificada clausula relacionada a atraso.',
  },
  {
    type: 'penalidade',
    severity: 'alta',
    keyword: 'penalidade',
    description: 'Foi identificada clausula de penalidade.',
  },
  {
    type: 'inadimplencia',
    severity: 'alta',
    keyword: 'inadimplencia',
    description: 'Foi identificada clausula de inadimplencia.',
  },
  {
    type: 'responsabilidade',
    severity: 'alta',
    keyword: 'responsabilidade',
    description: 'Foi identificada clausula de responsabilidade.',
  },
  {
    type: 'renovacao automatica',
    severity: 'alta',
    keyword: 'renovacao automatica',
    description: 'Foi identificada clausula de renovacao automatica.',
  },
  {
    type: 'prazo indeterminado',
    severity: 'alta',
    keyword: 'prazo indeterminado',
    description: 'Foi identificada clausula de prazo indeterminado.',
  },
];

const riskPatterns = [
  {
    key: 'prazo indeterminado',
    type: 'prazo indeterminado',
    score: 12,
    risk: 'Contrato com prazo indeterminado',
    severity: 'alta',
    recommendation: 'Definir um prazo de vigencia claro e revisoes formais.',
  },
  {
    key: 'renovacao automatica',
    type: 'renovacao automatica',
    score: 10,
    risk: 'Contrato com renovacao automatica',
    severity: 'alta',
    recommendation: 'Prever aprovacao expressa para renovacoes futuras.',
  },
];

module.exports = {
  essentialFields,
  criticalKeywords,
  riskPatterns,
};
