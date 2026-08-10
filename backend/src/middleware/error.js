function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
