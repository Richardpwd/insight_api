const pdfParse = require('pdf-parse');

const { analyzeContractRequest } = require('../utils/validators');
const { analyzeContractText } = require('../services/contract.service');
const { saveAnalysis, getHistory } = require('../store/history');

// Analisa contrato enviado como texto JSON.
function analyzeContract(req, res, next) {
  try {
    const validation = analyzeContractRequest(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        error: true,
        message: validation.message,
      });
    }

    const { contractText, contractType } = req.body;
    const analysis = analyzeContractText(contractText, contractType);

    saveAnalysis({
      contractType: analysis.summary.contractType,
      riskScore: analysis.summary.riskScore,
      riskLevel: analysis.summary.riskLevel,
      executiveSummary: analysis.summary.executiveSummary,
      source: 'texto',
    });

    return res.status(200).json(analysis);
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

    const entry = saveAnalysis({
      contractType: analysis.summary.contractType,
      riskScore: analysis.summary.riskScore,
      riskLevel: analysis.summary.riskLevel,
      executiveSummary: analysis.summary.executiveSummary,
      source: 'pdf',
      fileName: req.file.originalname,
    });

    return res.status(200).json({ ...analysis, historyId: entry.id });
  } catch (error) {
    return next(error);
  }
}

// Retorna o historico de analises armazenado em memoria.
function getAnalysisHistory(req, res) {
  res.json({ history: getHistory() });
}

module.exports = {
  analyzeContract,
  analyzeContractPdf,
  getAnalysisHistory,
};
