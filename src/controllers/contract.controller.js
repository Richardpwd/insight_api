const pdfParse = require('pdf-parse');
const crypto = require('crypto');

const { analyzeContractRequest } = require('../utils/validators');
const { analyzeContractText } = require('../services/contract.service');
const {
  analyzeContractWithAI,
  analyzeContractWithVision,
  MAX_AI_CONTRACT_TEXT_LENGTH,
} = require('../services/aiAnalysisService');
const { saveAnalysis, getHistory, saveAuditLog, getAuditTrail } = require('../store/history');

function getRequestId(req) {
  return req.headers['x-request-id'] || crypto.randomUUID();
}

function getApiKeyFromRequest(req) {
  const key = req.headers['x-api-key'];
  return typeof key === 'string' ? key : null;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || null;
}

async function registerAudit(req, payload) {
  try {
    await saveAuditLog({
      requestId: getRequestId(req),
      endpoint: req.originalUrl,
      method: req.method,
      apiKey: getApiKeyFromRequest(req),
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      ...payload,
    });
  } catch (auditError) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Falha ao salvar auditoria:', auditError.message);
    }
  }
}

function buildApiResponseFromRuleAnalysis(ruleAnalysis, analysisSource, extraMeta = {}) {
  const summaryText = ruleAnalysis.summary.executiveSummary;

  return {
    summary: summaryText,
    riskScore: ruleAnalysis.summary.riskScore,
    riskLevel: ruleAnalysis.summary.riskLevel,
    missingFields: ruleAnalysis.missingFields,
    criticalClauses: ruleAnalysis.criticalClauses,
    risks: ruleAnalysis.risks,
    suggestions: ruleAnalysis.recommendations || [],
    contractType: ruleAnalysis.summary.contractType,
    analysisSource,
    ...extraMeta,

    // Compatibilidade com clientes existentes.
    summaryDetails: {
      contractType: ruleAnalysis.summary.contractType,
      riskScore: ruleAnalysis.summary.riskScore,
      riskLevel: ruleAnalysis.summary.riskLevel,
      executiveSummary: summaryText,
    },
    recommendations: ruleAnalysis.recommendations || [],
  };
}

function buildApiResponseFromAI(aiAnalysis, contractType, extraMeta = {}) {
  const normalizedContractType =
    typeof contractType === 'string' && contractType.trim() ? contractType.trim() : 'nao_informado';

  return {
    summary: aiAnalysis.summary,
    riskScore: aiAnalysis.riskScore,
    riskLevel: aiAnalysis.riskLevel,
    missingFields: aiAnalysis.missingFields,
    criticalClauses: aiAnalysis.criticalClauses,
    risks: aiAnalysis.risks,
    suggestions: aiAnalysis.suggestions,
    contractType: normalizedContractType,
    analysisSource: 'ai-openai',
    model: aiAnalysis.model,
    wasTruncated: aiAnalysis.wasTruncated,
    sentChars: aiAnalysis.sentChars,
    ...extraMeta,

    // Compatibilidade com clientes existentes.
    summaryDetails: {
      contractType: normalizedContractType,
      riskScore: aiAnalysis.riskScore,
      riskLevel: aiAnalysis.riskLevel,
      executiveSummary: aiAnalysis.summary,
    },
    recommendations: aiAnalysis.suggestions,
  };
}

// Analisa contrato enviado como texto JSON.
async function analyzeContract(req, res, next) {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);

  try {
    const validation = analyzeContractRequest(req.body);

    if (!validation.valid) {
      const response = {
        error: true,
        message: validation.message,
      };

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_TEXT_VALIDATION_ERROR',
        statusCode: 400,
        metadata: { message: validation.message },
      });

      return res.status(400).json(response);
    }

    const { contractText, contractType } = req.body;

    if (!contractText || !String(contractText).trim()) {
      const response = {
        error: true,
        message: 'O campo contractText e obrigatorio.',
      };

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_TEXT_VALIDATION_ERROR',
        statusCode: 400,
        metadata: { message: response.message },
      });

      return res.status(400).json(response);
    }

    try {
      const aiAnalysis = await analyzeContractWithAI({
        contractText,
        contractType,
      });

      const aiResponse = buildApiResponseFromAI(aiAnalysis, contractType, {
        aiTextLimit: MAX_AI_CONTRACT_TEXT_LENGTH,
      });

      await saveAnalysis({
        contractText,
        extractedText: contractText,
        contractType: aiResponse.contractType,
        riskScore: aiResponse.riskScore,
        riskLevel: aiResponse.riskLevel,
        executiveSummary: aiResponse.summary,
        source: 'texto',
        analysisEngine: 'ai-openai',
        aiResult: JSON.stringify({
          summary: aiResponse.summary,
          riskScore: aiResponse.riskScore,
          riskLevel: aiResponse.riskLevel,
          missingFields: aiResponse.missingFields,
          criticalClauses: aiResponse.criticalClauses,
          risks: aiResponse.risks,
          suggestions: aiResponse.suggestions,
          model: aiResponse.model,
          sentChars: aiResponse.sentChars,
          wasTruncated: aiResponse.wasTruncated,
        }),
      });

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_TEXT_SUCCESS',
        statusCode: 200,
        metadata: {
          analysisSource: aiResponse.analysisSource,
          contractType: aiResponse.contractType,
          riskLevel: aiResponse.riskLevel,
          riskScore: aiResponse.riskScore,
        },
      });

      return res.status(200).json(aiResponse);
    } catch (aiError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Falha na analise por IA. Aplicando fallback por regras:', aiError.message);
      }

      const fallbackAnalysis = analyzeContractText(contractText, contractType);
      const fallbackResponse = buildApiResponseFromRuleAnalysis(
        fallbackAnalysis,
        'rules-fallback',
        {
          aiFallbackReason: 'Analise por IA indisponivel no momento. Fallback por regras aplicado.',
        }
      );

      await saveAnalysis({
        contractText,
        extractedText: contractText,
        contractType: fallbackResponse.contractType,
        riskScore: fallbackResponse.riskScore,
        riskLevel: fallbackResponse.riskLevel,
        executiveSummary: fallbackResponse.summary,
        source: 'texto',
        analysisEngine: 'rules-fallback',
      });

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_TEXT_FALLBACK_SUCCESS',
        statusCode: 200,
        metadata: {
          analysisSource: fallbackResponse.analysisSource,
          contractType: fallbackResponse.contractType,
          riskLevel: fallbackResponse.riskLevel,
          riskScore: fallbackResponse.riskScore,
          fallbackReason: aiError.message,
        },
      });

      return res.status(200).json(fallbackResponse);
    }
  } catch (error) {
    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_TEXT_ERROR',
      statusCode: error.statusCode || 500,
      metadata: { message: error.message },
    });

    return next(error);
  }
}

// Analisa contrato enviado como arquivo PDF.
async function analyzeContractPdf(req, res, next) {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);

  try {
    if (!req.file) {
      const response = {
        error: true,
        message: 'Envie um arquivo PDF no campo file.',
      };

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_PDF_VALIDATION_ERROR',
        statusCode: 400,
        metadata: { message: response.message },
      });

      return res.status(400).json(response);
    }

    let contractText;

    try {
      const parsed = await pdfParse(req.file.buffer);
      contractText = parsed.text;
    } catch (_) {
      const response = {
        error: true,
        message: 'Nao foi possivel extrair texto do PDF enviado.',
      };

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_PDF_PARSE_ERROR',
        statusCode: 422,
        metadata: { message: response.message, fileName: req.file?.originalname || null },
      });

      return res.status(422).json(response);
    }

    if (!contractText || contractText.trim().length < 200) {
      const response = {
        error: true,
        message: 'O PDF nao continha texto suficiente para analise (minimo 200 caracteres).',
      };

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_PDF_VALIDATION_ERROR',
        statusCode: 400,
        metadata: { message: response.message, fileName: req.file?.originalname || null },
      });

      return res.status(400).json(response);
    }

    const contractType =
      typeof req.body.contractType === 'string' ? req.body.contractType : undefined;

    const analysis = analyzeContractText(contractText, contractType);
    const response = buildApiResponseFromRuleAnalysis(analysis, 'rules-pdf');

    const entry = await saveAnalysis({
      contractText,
      extractedText: contractText,
      contractType: response.contractType,
      riskScore: response.riskScore,
      riskLevel: response.riskLevel,
      executiveSummary: response.summary,
      source: 'pdf',
      fileName: req.file.originalname,
      analysisEngine: 'rules-pdf',
    });

    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_PDF_SUCCESS',
      statusCode: 200,
      metadata: {
        analysisSource: response.analysisSource,
        contractType: response.contractType,
        riskLevel: response.riskLevel,
        riskScore: response.riskScore,
        fileName: req.file.originalname,
      },
    });

    return res.status(200).json({ ...response, historyId: entry.id });
  } catch (error) {
    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_PDF_ERROR',
      statusCode: error.statusCode || 500,
      metadata: { message: error.message, fileName: req.file?.originalname || null },
    });

    return next(error);
  }
}

// Analisa contrato enviado como imagem (foto).
async function analyzeContractImage(req, res, next) {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);

  try {
    if (!req.file) {
      const response = {
        error: true,
        message: 'Envie uma imagem no campo file.',
      };

      await registerAudit(req, {
        requestId,
        eventType: 'ANALYZE_IMAGE_VALIDATION_ERROR',
        statusCode: 400,
        metadata: { message: response.message },
      });

      return res.status(400).json(response);
    }

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const contractType =
      typeof req.body.contractType === 'string' ? req.body.contractType : undefined;

    const aiAnalysis = await analyzeContractWithVision({ imageBase64, mimeType, contractType });

    const response = buildApiResponseFromAI(aiAnalysis, contractType, {
      analysisSource: 'ai-vision',
    });

    const entry = await saveAnalysis({
      contractText: null,
      extractedText: null,
      contractType: response.contractType,
      riskScore: response.riskScore,
      riskLevel: response.riskLevel,
      executiveSummary: response.summary,
      source: 'imagem',
      analysisEngine: 'ai-vision',
    });

    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_IMAGE_SUCCESS',
      statusCode: 200,
      metadata: {
        analysisSource: response.analysisSource,
        contractType: response.contractType,
        riskLevel: response.riskLevel,
        riskScore: response.riskScore,
        mimeType,
      },
    });

    return res.status(200).json({ ...response, historyId: entry?.id });
  } catch (error) {
    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_IMAGE_ERROR',
      statusCode: error.statusCode || 500,
      metadata: { message: error.message, mimeType: req.file?.mimetype || null },
    });

    return next(error);
  }
}

// Retorna o historico de analises persistido no banco.
async function getAnalysisHistory(req, res, next) {
  try {
    const history = await getHistory(req.query.limit);

    await registerAudit(req, {
      eventType: 'HISTORY_READ_SUCCESS',
      statusCode: 200,
      metadata: { count: history.length },
    });

    res.json({ history });
  } catch (error) {
    await registerAudit(req, {
      eventType: 'HISTORY_READ_ERROR',
      statusCode: error.statusCode || 500,
      metadata: { message: error.message },
    });

    next(error);
  }
}

async function getAnalysisAuditTrail(req, res, next) {
  try {
    const audit = await getAuditTrail(req.query.limit);
    res.json({ audit });
  } catch (error) {
    next(error);
  }
}


// Dependências extras para DOCX e OCR
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const { fromBuffer } = require('pdf2pic');

// Handler para upload geral (PDF, DOCX, imagens)
async function analyzeContractUpload(req, res, next) {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);

  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'Envie um arquivo PDF, DOCX ou imagem no campo file.' });
    }

    let contractText = '';
    let fileType = req.file.mimetype;
    let contractType = typeof req.body.contractType === 'string' ? req.body.contractType : undefined;
    let extractedText = '';

    if (fileType === 'application/pdf') {
      // Tenta extrair texto normalmente
      try {
        const parsed = await pdfParse(req.file.buffer);
        contractText = parsed.text;
        extractedText = contractText;
      } catch (e) {
        contractText = '';
      }
      // Se texto insuficiente, tenta OCR nas páginas do PDF
      if (!contractText || contractText.trim().length < 200) {
        // Converte PDF em imagens e faz OCR
        const pdf2pic = fromBuffer(req.file.buffer, { density: 200, format: 'png', savePath: '/tmp' });
        const numPages = (await pdfParse(req.file.buffer)).numpages || 1;
        let ocrText = '';
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf2pic(i);
          const ocr = await Tesseract.recognize(page.path, 'por');
          ocrText += ocr.data.text + '\n';
        }
        contractText = ocrText;
        extractedText = ocrText;
      }
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
      // DOCX
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      contractText = result.value;
      extractedText = contractText;
    } else if (fileType.startsWith('image/')) {
      // Imagem: OCR direto
      const ocr = await Tesseract.recognize(req.file.buffer, 'por');
      contractText = ocr.data.text;
      extractedText = contractText;
    } else {
      return res.status(400).json({ error: true, message: 'Tipo de arquivo nao suportado.' });
    }

    if (!contractText || contractText.trim().length < 200) {
      return res.status(400).json({ error: true, message: 'Nao foi possivel extrair texto suficiente do arquivo.' });
    }

    // Analisa texto extraído
    const aiAnalysis = await analyzeContractWithAI({ contractText, contractType });
    const response = buildApiResponseFromAI(aiAnalysis, contractType, { analysisSource: 'upload' });

    const entry = await saveAnalysis({
      contractText,
      extractedText,
      contractType: response.contractType,
      riskScore: response.riskScore,
      riskLevel: response.riskLevel,
      executiveSummary: response.summary,
      source: 'upload',
      fileName: req.file.originalname,
      analysisEngine: 'ai-openai',
    });

    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_UPLOAD_SUCCESS',
      statusCode: 200,
      metadata: {
        analysisSource: response.analysisSource,
        contractType: response.contractType,
        riskLevel: response.riskLevel,
        riskScore: response.riskScore,
        fileName: req.file.originalname,
      },
    });

    return res.status(200).json({ ...response, historyId: entry.id });
  } catch (error) {
    await registerAudit(req, {
      requestId,
      eventType: 'ANALYZE_UPLOAD_ERROR',
      statusCode: error.statusCode || 500,
      metadata: { message: error.message, fileName: req.file?.originalname || null },
    });
    return next(error);
  }
}

module.exports = {
  analyzeContract,
  analyzeContractPdf,
  analyzeContractImage,
  getAnalysisHistory,
  getAnalysisAuditTrail,
  analyzeContractUpload,
};
