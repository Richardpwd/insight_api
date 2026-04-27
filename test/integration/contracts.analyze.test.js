const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { clearRateLimitBuckets } = require('../../src/middleware/rateLimit');
const { resetInMemoryStore } = require('../../src/store/history');

process.env.NODE_ENV = 'test';
process.env.USE_IN_MEMORY_HISTORY = 'true';
process.env.API_KEY = 'test-key';
process.env.DISABLE_RATE_LIMIT = 'true';

delete process.env.OPENAI_API_KEY;

const app = require('../../src/app');

const validContractText =
  'CONTRATO DE PRESTACAO DE SERVICOS entre Empresa A e Empresa B. '.repeat(12);

function buildAiResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: 'Resumo gerado por IA.',
            riskScore: 42,
            riskLevel: 'medio',
            missingFields: ['testemunhas'],
            criticalClauses: [
              {
                type: 'rescisao',
                severity: 'alta',
                description: 'Clausula de rescisao detectada.',
              },
            ],
            risks: [
              {
                risk: 'Risco de ambiguidade de prazo.',
                severity: 'media',
                recommendation: 'Definir prazo objetivo.',
              },
            ],
            suggestions: ['Incluir prazo de vigencia.'],
          }),
        },
      },
    ],
    model: 'gpt-4.1-mini',
    usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
  };
}

test.beforeEach(() => {
  clearRateLimitBuckets();
  resetInMemoryStore();
});

test('POST /contracts/analyze usa IA quando OpenAI responde com sucesso', async () => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => buildAiResponse(),
  });

  try {
    const response = await request(app)
      .post('/contracts/analyze')
      .set('x-api-key', 'test-key')
      .send({ contractText: validContractText, contractType: 'prestacao_servico' });

    assert.equal(response.status, 200);
    assert.equal(response.body.analysisSource, 'ai-openai');
    assert.equal(response.body.summary, 'Resumo gerado por IA.');
    assert.equal(response.body.riskScore, 42);
    assert.equal(response.body.riskLevel, 'medio');
    assert.deepEqual(response.body.suggestions, ['Incluir prazo de vigencia.']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('GET /contracts/history retorna analises persistidas com contractId', async () => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => buildAiResponse(),
  });

  try {
    await request(app)
      .post('/contracts/analyze')
      .set('x-api-key', 'test-key')
      .send({ contractText: validContractText, contractType: 'prestacao_servico' });

    const historyRes = await request(app).get('/contracts/history').set('x-api-key', 'test-key');

    assert.equal(historyRes.status, 200);
    assert.equal(Array.isArray(historyRes.body.history), true);
    assert.equal(historyRes.body.history.length > 0, true);
    assert.equal(typeof historyRes.body.history[0].contractId, 'number');
  } finally {
    global.fetch = originalFetch;
  }
});

test('GET /contracts/history/audit retorna trilha de auditoria', async () => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => buildAiResponse(),
  });

  try {
    await request(app)
      .post('/contracts/analyze')
      .set('x-api-key', 'test-key')
      .send({ contractText: validContractText, contractType: 'prestacao_servico' });

    const auditRes = await request(app)
      .get('/contracts/history/audit')
      .set('x-api-key', 'test-key');

    assert.equal(auditRes.status, 200);
    assert.equal(Array.isArray(auditRes.body.audit), true);
    assert.equal(auditRes.body.audit.length > 0, true);
    assert.equal(typeof auditRes.body.audit[0].eventType, 'string');
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST /contracts/analyze aplica fallback por regras quando OpenAI falha', async () => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('falha simulada na openai');
  };

  try {
    const response = await request(app)
      .post('/contracts/analyze')
      .set('x-api-key', 'test-key')
      .send({ contractText: validContractText, contractType: 'prestacao_servico' });

    assert.equal(response.status, 200);
    assert.equal(response.body.analysisSource, 'rules-fallback');
    assert.equal(typeof response.body.summary, 'string');
    assert.equal(typeof response.body.riskScore, 'number');
    assert.equal(Array.isArray(response.body.suggestions), true);
    assert.equal(
      response.body.aiFallbackReason,
      'Analise por IA indisponivel no momento. Fallback por regras aplicado.'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST /contracts/analyze respeita rate limit por x-api-key', async () => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';
  process.env.DISABLE_RATE_LIMIT = 'false';
  clearRateLimitBuckets();

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => buildAiResponse(),
  });

  try {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/contracts/analyze')
        .set('x-api-key', 'test-key')
        .send({ contractText: validContractText, contractType: 'prestacao_servico' });

      assert.equal(res.status, 200);
    }

    const blocked = await request(app)
      .post('/contracts/analyze')
      .set('x-api-key', 'test-key')
      .send({ contractText: validContractText, contractType: 'prestacao_servico' });

    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, true);
  } finally {
    process.env.DISABLE_RATE_LIMIT = 'true';
    global.fetch = originalFetch;
    clearRateLimitBuckets();
  }
});

test('POST /contracts/analyze/image retorna erro claro quando VISION_MODEL nao configurado', async () => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';
  const savedVisionModel = process.env.VISION_MODEL;
  delete process.env.VISION_MODEL;

  // 1x1 px PNG minimo valido para satisfazer o multer sem subir imagem real.
  const minimalPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  try {
    const res = await request(app)
      .post('/contracts/analyze/image')
      .set('x-api-key', 'test-key')
      .attach('file', minimalPng, { filename: 'contrato.png', contentType: 'image/png' });

    assert.equal(res.status, 500);
    assert.equal(res.body.error, true);
    assert.ok(
      typeof res.body.message === 'string' && res.body.message.includes('VISION_MODEL'),
      `Mensagem deveria mencionar VISION_MODEL, recebeu: "${res.body.message}"`
    );
  } finally {
    if (savedVisionModel !== undefined) {
      process.env.VISION_MODEL = savedVisionModel;
    }
  }
});

test('POST /contracts/analyze retorna erro claro quando OPENAI_API_KEY ausente e sem fallback', async () => {
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const res = await request(app)
      .post('/contracts/analyze')
      .set('x-api-key', 'test-key')
      .send({ contractText: validContractText });

    // Com fallback ativo, ainda retorna 200 via rules-fallback; aiFallbackReason deve existir.
    assert.equal(res.status, 200);
    assert.equal(res.body.analysisSource, 'rules-fallback');
    assert.ok(typeof res.body.aiFallbackReason === 'string');
  } finally {
    if (savedKey !== undefined) {
      process.env.OPENAI_API_KEY = savedKey;
    }
  }
});
