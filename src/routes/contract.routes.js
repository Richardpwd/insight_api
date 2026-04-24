const express = require('express');
const multer = require('multer');

const { apiKeyAuth } = require('../middleware/auth');
const {
  analyzeContract,
  analyzeContractPdf,
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

const router = express.Router();

// Todas as rotas de contratos exigem autenticacao por API Key.
router.use(apiKeyAuth);

router.post('/analyze', analyzeContract);
router.post('/analyze/pdf', upload.single('file'), analyzeContractPdf);
router.get('/history', getAnalysisHistory);

module.exports = router;
