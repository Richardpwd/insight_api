function analyzeContractRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      message: 'O corpo da requisicao deve ser um objeto JSON valido.',
    };
  }

  const { contractText, contractType } = body;

  if (contractText === undefined || contractText === null || contractText === '') {
    return {
      valid: false,
      message: 'O campo contractText e obrigatorio.',
    };
  }

  if (typeof contractText !== 'string') {
    return {
      valid: false,
      message: 'O campo contractText deve ser uma string.',
    };
  }

  if (contractText.trim().length < 200) {
    return {
      valid: false,
      message: 'O campo contractText deve ter pelo menos 200 caracteres.',
    };
  }

  if (contractType !== undefined && typeof contractType !== 'string') {
    return {
      valid: false,
      message: 'O campo contractType deve ser uma string quando informado.',
    };
  }

  return { valid: true };
}

module.exports = {
  analyzeContractRequest,
};
