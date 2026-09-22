function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'This file is over 40MB. Compress the PDF or upload a PDF of 40MB or less.',
      });
    }
    return res.status(400).json({ error: err.message });
  }
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };
