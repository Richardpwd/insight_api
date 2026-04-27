const AI_REQUEST_TIMEOUT_MS = 20000;
const MAX_AI_CONTRACT_TEXT_LENGTH = 12000;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

function resolveModelName() {
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
}

function sanitizeString(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const text = value.trim();
  return text || fallback;
}

function normalizeRiskLevel(value) {
  const allowed = new Set(['baixo', 'medio', 'alto', 'critico']);
  const normalized = sanitizeString(value, 'medio').toLowerCase();
  return allowed.has(normalized) ? normalized : 'medio';
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeString(item))
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeClauseList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const type = sanitizeString(item.type);
      const description = sanitizeString(item.description);
      const severity = sanitizeString(item.severity, 'media').toLowerCase();

      if (!type || !description) {
        return null;
      }

      return {
        type,
        severity,
        description,
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeRiskList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const risk = sanitizeString(item.risk);
      const recommendation = sanitizeString(item.recommendation);
      const severity = sanitizeString(item.severity, 'media').toLowerCase();

      if (!risk || !recommendation) {
        return null;
      }

      return {
        risk,
        recommendation,
        severity,
      };
    })
    .filter(Boolean)
    .slice(0, 30);
}

function parseJsonFromOpenAI(content) {
  if (typeof content !== 'string') {
    throw new Error('Resposta da OpenAI sem conteudo textual.');
  }

  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('Resposta da OpenAI nao esta em JSON valido.');
    }

    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

function buildPrompt(contractText, contractType) {
  const optionalContractType = sanitizeString(contractType, 'nao_informado');

  return [
    'Voce e um analista de contratos com foco juridico e de risco.',
    'Analise o texto abaixo e responda SOMENTE em JSON valido, sem markdown e sem texto adicional.',
    'A resposta JSON deve conter obrigatoriamente as chaves:',
    'summary, riskScore, riskLevel, missingFields, criticalClauses, risks, suggestions.',
    'Regras de formato:',
    '- summary: string curta e objetiva em portugues.',
    '- riskScore: inteiro de 0 a 100.',
    '- riskLevel: um destes valores: baixo, medio, alto, critico.',
    '- missingFields: array de strings.',
    '- criticalClauses: array de objetos { type, severity, description }.',
    '- risks: array de objetos { risk, severity, recommendation }.',
    '- suggestions: array de strings com acoes praticas.',
    'Nao invente dados inexistentes; use linguagem prudente.',
    `Tipo de contrato informado: ${optionalContractType}.`,
    'Texto do contrato para analise:',
    contractText,
  ].join('\n');
}

async function analyzeContractWithAI({ contractText, contractType }) {
  if (typeof contractText !== 'string' || !contractText.trim()) {
    throw new Error('contractText invalido para analise por IA.');
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao configurada no ambiente.');
  }

  if (typeof fetch !== 'function') {
    throw new Error('Runtime sem suporte a fetch para chamada da OpenAI API.');
  }

  const trimmedContractText = contractText.trim();
  const limitedContractText = trimmedContractText.slice(0, MAX_AI_CONTRACT_TEXT_LENGTH);
  const wasTruncated = trimmedContractText.length > limitedContractText.length;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolveModelName(),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Responda sempre em JSON valido e estrito, sem comentarios, sem markdown e sem campos extras desnecessarios.',
          },
          {
            role: 'user',
            content: buildPrompt(limitedContractText, contractType),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI retornou erro HTTP ${response.status}: ${errorBody.slice(0, 400)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseJsonFromOpenAI(content);

    const summary = sanitizeString(parsed.summary, 'Analise concluida pela IA.');
    const riskScoreRaw = Number(parsed.riskScore);
    const riskScore = Number.isFinite(riskScoreRaw)
      ? Math.max(0, Math.min(100, Math.round(riskScoreRaw)))
      : 50;

    return {
      summary,
      riskScore,
      riskLevel: normalizeRiskLevel(parsed.riskLevel),
      missingFields: normalizeList(parsed.missingFields),
      criticalClauses: normalizeClauseList(parsed.criticalClauses),
      risks: normalizeRiskList(parsed.risks),
      suggestions: normalizeList(parsed.suggestions),
      model: data?.model || resolveModelName(),
      wasTruncated,
      sentChars: limitedContractText.length,
      usage: data?.usage || null,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Timeout ao chamar OpenAI API.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveVisionModelName() {
  const model = process.env.VISION_MODEL;

  if (!model || !model.trim()) {
    throw new Error(
      'VISION_MODEL nao configurado no ambiente. ' +
        'Defina VISION_MODEL=gpt-4o (ou outro modelo com visao) no arquivo .env.'
    );
  }

  return model.trim();
}

function buildVisionPrompt(contractType) {
  const optionalContractType = sanitizeString(contractType, 'nao_informado');

  return [
    'Voce e um analista de contratos com foco juridico e de risco.',
    'A imagem enviada contem um contrato. Extraia o texto visivel e analise o contrato.',
    'Responda SOMENTE em JSON valido, sem markdown e sem texto adicional.',
    'A resposta JSON deve conter obrigatoriamente as chaves:',
    'summary, riskScore, riskLevel, missingFields, criticalClauses, risks, suggestions.',
    'Regras de formato:',
    '- summary: string curta e objetiva em portugues.',
    '- riskScore: inteiro de 0 a 100.',
    '- riskLevel: um destes valores: baixo, medio, alto, critico.',
    '- missingFields: array de strings.',
    '- criticalClauses: array de objetos { type, severity, description }.',
    '- risks: array de objetos { risk, severity, recommendation }.',
    '- suggestions: array de strings com acoes praticas.',
    'Nao invente dados inexistentes; use linguagem prudente.',
    `Tipo de contrato informado: ${optionalContractType}.`,
  ].join('\n');
}

async function analyzeContractWithVision({ imageBase64, mimeType, contractType }) {
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    throw new Error('imageBase64 invalido para analise por visao.');
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao configurada no ambiente.');
  }

  if (typeof fetch !== 'function') {
    throw new Error('Runtime sem suporte a fetch para chamada da OpenAI API.');
  }

  const visionModel = resolveVisionModelName();

  const safeMimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    ? mimeType
    : 'image/jpeg';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Responda sempre em JSON valido e estrito, sem comentarios, sem markdown e sem campos extras desnecessarios.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildVisionPrompt(contractType) },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${safeMimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI retornou erro HTTP ${response.status}: ${errorBody.slice(0, 400)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseJsonFromOpenAI(content);

    const summary = sanitizeString(parsed.summary, 'Analise concluida pela IA.');
    const riskScoreRaw = Number(parsed.riskScore);
    const riskScore = Number.isFinite(riskScoreRaw)
      ? Math.max(0, Math.min(100, Math.round(riskScoreRaw)))
      : 50;

    return {
      summary,
      riskScore,
      riskLevel: normalizeRiskLevel(parsed.riskLevel),
      missingFields: normalizeList(parsed.missingFields),
      criticalClauses: normalizeClauseList(parsed.criticalClauses),
      risks: normalizeRiskList(parsed.risks),
      suggestions: normalizeList(parsed.suggestions),
      model: data?.model || visionModel,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Timeout ao chamar OpenAI Vision API.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  analyzeContractWithAI,
  analyzeContractWithVision,
  MAX_AI_CONTRACT_TEXT_LENGTH,
};
