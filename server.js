import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectToDatabase } from './lib/mongo.js';
import mongoose from 'mongoose';
import { authenticate } from './lib/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://campusserve.onrender.com',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Check if origin matches Vercel pattern (*.vercel.app)
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Check if origin matches Render pattern (*.onrender.com)
    if (origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    
    // Check if origin is localhost or LAN IP (any port) for development
    try {
      const url = new URL(origin);
      if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname.startsWith('192.168.') ||
        url.hostname.startsWith('10.') ||
        url.hostname.startsWith('172.')
      ) {
        return callback(null, true);
      }
    } catch (e) { /* invalid URL, fall through */ }
    
    const msg = `CORS not allowed for origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-User-Role', 'X-User-Email'],
  maxAge: 86400
}));

// Global CORS is already applied above, explicit OPTIONS handler removed

// Add CORS logging for debugging (remove in production if too verbose)
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && req.method === 'OPTIONS') {
    console.log(`[CORS] Preflight request from: ${origin}`);
  }
  next();
});

// Increase JSON payload limit to handle large base64-encoded signatures
// Default is 100KB which is too small for signatures + batch operations
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lightweight timing middleware to log slow requests (helps diagnose slow deployed API)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Log only slower requests to avoid noise
    if (ms > 500) {
      console.warn(`Slow request: ${req.method} ${req.originalUrl} - ${ms}ms`);
    }
  });
  next();
});

// Cache control for static assets (CSS, JS, images)
app.use((req, res, next) => {
  // For hashed assets (CSS/JS with [hash] in filename), use aggressive caching
  if (req.url.match(/\.(css|js)$/) && req.url.includes('-')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // For HTML files, no caching to ensure users get latest version
  else if (req.url.match(/\.html$/) || req.url === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // For images and other assets, moderate caching
  else if (req.url.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  next();
});

// JWT authentication middleware — applied to all /api routes except login
app.use('/api', (req, res, next) => {
  // Skip auth for OPTIONS preflight, login endpoint, and health/debug
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/auth' && req.method === 'POST') return next();
  if (req.path === '/health') return next();
  if (req.path === '/debug') return next();
  authenticate(req, res, next);
});

// Security headers
app.use((req, res, next) => {
  // Require HTTPS in production via HSTS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  // Basic CSP (tweak for your needs)
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' data: https:; img-src 'self' data: https:; connect-src 'self' https: ws:;")
  next()
})

// Serve static files from /public at the site root (ensures /service-worker.js is available)
import path from 'path';
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    // Ensure service worker and HTML are not aggressively cached
    if (filePath.endsWith('service-worker.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Health check
app.get('/', (req, res) => {
  res.send('Backend API Server is running!');
});

// API routes
import authHandler from './api/auth.js';
import usersHandler from './api/users.js';
import requestsHandler from './api/requests.js';
import quotationsHandler from './api/quotations.js';
import workOrdersHandler from './api/work-orders.js';
import invoicesHandler from './api/invoices.js';
import paymentsHandler from './api/payments.js';
import reportsHandler from './api/reports.js';
import generatePdfHandler from './api/generate-pdf.js';
import notificationsRouter from './api/notifications.js';
import vendorsHandler from './api/vendors.js';
import purchaseOrdersHandler from './api/purchase-orders.js';
import deliveriesHandler from './api/deliveries.js';
import gateHandler from './api/gate.js';
import grnHandler from './api/grn.js';

// Debug endpoint to verify server is updated
app.get('/api/debug', (req, res) => {
  res.json({ 
    message: 'CampusServe Pro Server is running!', 
    timestamp: new Date().toISOString(),
    campusServeSystem: true,
    version: '1.0.0'
  });
});

// Health endpoint: quick DB connection state and server timestamp
app.get('/api/health', (req, res) => {
  const dbState = mongoose?.connection?.readyState ?? 0;
  res.json({ ok: true, timestamp: new Date().toISOString(), dbState });
});

app.all('/api/auth', authLimiter, authHandler);
app.all('/api/users', usersHandler);
app.all('/api/requests', requestsHandler);
app.all('/api/quotations', quotationsHandler);
app.all('/api/work-orders', workOrdersHandler);
app.all('/api/invoices', invoicesHandler);
app.all('/api/payments', paymentsHandler);
app.all('/api/reports', reportsHandler);
app.all('/api/generate-pdf', generatePdfHandler);
app.use('/api/notifications', notificationsRouter);
app.all('/api/vendors', vendorsHandler);
app.all('/api/purchase-orders', purchaseOrdersHandler);
app.all('/api/deliveries', deliveriesHandler);
app.all('/api/gate', gateHandler);
app.all('/api/grn', grnHandler);

// Connect to MongoDB and start server
connectToDatabase()
  .then(() => {
    console.log(`📊 MongoDB connected successfully`);
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    console.error('\n⚠️  TROUBLESHOOTING STEPS:');
    console.error('   1. Check your MongoDB Atlas IP whitelist settings');
    console.error('   2. Go to: https://cloud.mongodb.com/');
    console.error('   3. Navigate to: Network Access → IP Access List');
    console.error('   4. Add your current IP or use 0.0.0.0/0 for testing');
    console.error('   5. Verify your connection string in .env file');
    console.error('\n   Server will start anyway, but database operations will fail.\n');
  });

// Start server regardless of MongoDB connection
// Support optional TLS if certs are provided (useful for testing HTTPS locally or in certain deploys)
import fs from 'fs'
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH && fs.existsSync(process.env.SSL_KEY_PATH) && fs.existsSync(process.env.SSL_CERT_PATH)) {
  const https = await import('https')
  const key = fs.readFileSync(process.env.SSL_KEY_PATH)
  const cert = fs.readFileSync(process.env.SSL_CERT_PATH)
  https.createServer({ key, cert }, app).listen(PORT, () => {
    console.log(`🚀 MSEC CampusServe API Server (HTTPS) listening on https://localhost:${PORT}`)
  })
} else {
  app.listen(PORT, () => {
    console.log(`🚀 MSEC CampusServe API Server listening on http://localhost:${PORT}`);
    console.log(`🔧 Service request management ready`);
    console.log(`📊 Quotation, work order, and invoicing enabled`);
  });
}

// Global error handlers
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
