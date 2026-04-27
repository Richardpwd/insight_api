const pdfParse = require('pdf-parse');

const { analyzeContractRequest } = require('../utils/validators');
const { analyzeContractText } = require('../services/contract.service');
const {
  analyzeContractWithAI,
  analyzeContractWithVision,
  MAX_AI_CONTRACT_TEXT_LENGTH,
} = require('../services/aiAnalysisService');
const { saveAnalysis, getHistory } = require('../store/history');

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
  try {
    const validation = analyzeContractRequest(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: true,
        message: validation.message,
      });
    }

    const { contractText, contractType } = req.body;

    if (!contractText || !String(contractText).trim()) {
      return res.status(400).json({
        error: true,
        message: 'O campo contractText e obrigatorio.',
      });
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
        contractType: fallbackResponse.contractType,
        riskScore: fallbackResponse.riskScore,
        riskLevel: fallbackResponse.riskLevel,
        executiveSummary: fallbackResponse.summary,
        source: 'texto',
        analysisEngine: 'rules-fallback',
      });

      return res.status(200).json(fallbackResponse);
    }
  } catch (error) {
    return next(error);
  }
}

// Analisa contrato enviado como arquivo PDF.
async function analyzeContractPdf(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'Envie um arquivo PDF no campo file.',
      });
    }

    let contractText;

    try {
      const parsed = await pdfParse(req.file.buffer);
      contractText = parsed.text;
    } catch (_) {
      return res.status(422).json({
        error: true,
        message: 'Nao foi possivel extrair texto do PDF enviado.',
      });
    }

    if (!contractText || contractText.trim().length < 200) {
      return res.status(400).json({
        error: true,
        message: 'O PDF nao continha texto suficiente para analise (minimo 200 caracteres).',
      });
    }

    const contractType =
      typeof req.body.contractType === 'string' ? req.body.contractType : undefined;

    const analysis = analyzeContractText(contractText, contractType);
    const response = buildApiResponseFromRuleAnalysis(analysis, 'rules-pdf');

    const entry = await saveAnalysis({
      contractType: response.contractType,
      riskScore: response.riskScore,
      riskLevel: response.riskLevel,
      executiveSummary: response.summary,
      source: 'pdf',
      fileName: req.file.originalname,
      analysisEngine: 'rules-pdf',
    });

    return res.status(200).json({ ...response, historyId: entry.id });
  } catch (error) {
    return next(error);
  }
}

// Analisa contrato enviado como imagem (foto).
async function analyzeContractImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'Envie uma imagem no campo file.',
      });
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
      contractType: response.contractType,
      riskScore: response.riskScore,
      riskLevel: response.riskLevel,
      executiveSummary: response.summary,
      source: 'imagem',
      analysisEngine: 'ai-vision',
    });

    return res.status(200).json({ ...response, historyId: entry?.id });
  } catch (error) {
    return next(error);
  }
}

// Retorna o historico de analises persistido no banco.
async function getAnalysisHistory(req, res, next) {
  try {
    const history = await getHistory();
    res.json({ history });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  analyzeContract,
  analyzeContractPdf,
  analyzeContractImage,
  getAnalysisHistory,
};
