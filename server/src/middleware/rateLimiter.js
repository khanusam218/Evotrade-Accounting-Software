const rateLimit = require('express-rate-limit');

const general = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,                 // 2000 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,                  // 100 login attempts per 15 min
  message: { error: 'Too many login attempts, try again later.' },
});

module.exports = { general, authLimiter };
