const express = require('express');
const multer = require('multer');

const { apiKeyAuth } = require('../middleware/auth');
const { createRateLimitByApiKey } = require('../middleware/rateLimit');
const {
  analyzeContract,
  analyzeContractPdf,
  analyzeContractImage,
  getAnalysisHistory,
  getAnalysisAuditTrail,
} = require('../controllers/contract.controller');

// Multer configurado para receber PDF em memoria (sem gravar em disco).

// Multer para PDF, DOCX e imagens (upload geral)
const uploadGeneral = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    const allowed = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    if (!allowed.has(file.mimetype)) {
      const err = new Error('Apenas PDF, DOCX ou imagens sao aceitos.');
      err.statusCode = 400;
      return cb(err, false);
    }
    cb(null, true);
  },
});

// Multer configurado para receber imagens em memoria.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) {
      const err = new Error('Apenas imagens JPEG, PNG ou WEBP sao aceitas.');
      err.statusCode = 400;
      return cb(err, false);
    }
    cb(null, true);
  },
});

const router = express.Router();
const rateLimitByApiKey = createRateLimitByApiKey();

// Todas as rotas de contratos exigem autenticacao por API Key.
router.use(apiKeyAuth);

router.post('/analyze', rateLimitByApiKey, analyzeContract);
router.post('/analyze/pdf', rateLimitByApiKey, upload.single('file'), analyzeContractPdf);
router.post('/analyze/image', rateLimitByApiKey, uploadImage.single('file'), analyzeContractImage);
// Nova rota para upload geral (PDF, DOCX, imagens)
const { analyzeContractUpload } = require('../controllers/contract.controller');
router.post('/analyze/upload', rateLimitByApiKey, uploadGeneral.single('file'), analyzeContractUpload);
router.get('/history', getAnalysisHistory);
router.get('/history/audit', getAnalysisAuditTrail);

module.exports = router;
