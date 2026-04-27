const express = require('express');
const multer = require('multer');

const { apiKeyAuth } = require('../middleware/auth');
const { createRateLimitByApiKey } = require('../middleware/rateLimit');
const {
  analyzeContract,
  analyzeContractPdf,
  analyzeContractImage,
  getAnalysisHistory,
} = require('../controllers/contract.controller');

// Multer configurado para receber PDF em memoria (sem gravar em disco).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Apenas arquivos PDF sao aceitos.');
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
router.get('/history', getAnalysisHistory);

module.exports = router;
