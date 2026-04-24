const express = require('express');
const cors = require('cors');
const path = require('path');

const contractRoutes = require('./routes/contract.routes');

const app = express();

// Middlewares globais da API.
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Contract Insight API is running',
  });
});

app.use('/contracts', contractRoutes);

// Resposta padrao para rotas inexistentes.
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: 'Rota nao encontrada',
  });
});

// Handler centralizado para manter o formato de erro em JSON.
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(statusCode).json({
    error: true,
    message,
  });
});

module.exports = app;
