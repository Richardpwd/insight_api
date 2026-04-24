// Middleware de autenticacao por API Key.
// Se a variavel API_KEY nao estiver configurada no .env,
// a autenticacao e ignorada (util para desenvolvimento local).
function apiKeyAuth(req, res, next) {
  const validKey = process.env.API_KEY;

  if (!validKey) {
    return next();
  }

  const providedKey = req.headers['x-api-key'];

  if (!providedKey || providedKey !== validKey) {
    return res.status(401).json({
      error: true,
      message: 'API Key invalida ou ausente. Envie o header x-api-key.',
    });
  }

  return next();
}

module.exports = { apiKeyAuth };
