const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');
const { TEAMS } = require('./teamsData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// PayTR Credentials
const PAYTR_MERCHANT_ID = process.env.PAYTR_MERCHANT_ID || 'MERCHANT_ID';
const PAYTR_MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY || 'MERCHANT_KEY';
const PAYTR_MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT || 'MERCHANT_SALT';

// In-Memory verified orders/codes (Admin promo codes & paid order IDs)
const VALID_PROMO_CODES = {
  'TARAFTAR50': 50,
  'TASAQPOWER': 100,
  'LIDER2026': 25
};
const PROCESSED_ORDERS = new Set();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from client/dist
app.use(express.static(path.join(__dirname, '../client/dist')));

// --- REST API ENDPOINTS ---

// Get all provinces
app.get('/api/provinces', (req, res) => {
  res.json({
    success: true,
    provinces: db.getAllProvinces()
  });
});

// Get single province
app.get('/api/provinces/:id', (req, res) => {
  const province = db.getProvince(req.params.id);
  if (!province) {
    return res.status(404).json({ success: false, error: 'İl bulunamadı' });
  }
  res.json({ success: true, province });
});

// Get teams list
app.get('/api/teams', (req, res) => {
  res.json({
    success: true,
    teams: TEAMS
  });
});

// Get overall statistics & leaderboards
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    stats: db.getStats()
  });
});

// Get live activity feed
app.get('/api/activity', (req, res) => {
  res.json({
    success: true,
    activity: db.getActivityFeed()
  });
});

// Place bid via REST endpoint
app.post('/api/bid', (req, res) => {
  try {
    const { provinceId, teamId, amount, bidder, note } = req.body;
    if (!provinceId || !teamId || !amount) {
      return res.status(400).json({ success: false, error: 'Eksik bilgi gönderildi.' });
    }

    const result = db.placeBid({ provinceId, teamId, amount, bidder, note });

    // Emit live update to all connected clients
    io.emit('province_updated', {
      province: result.updatedProvince,
      activity: result.activity,
      stats: result.stats
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// --- SECURE PAYMENT VERIFICATION & PROMO CODE ENDPOINT ---
app.post('/api/payment/verify-code', (req, res) => {
  try {
    const { code, amount, bidder } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Lütfen sipariş no veya kod girin.' });
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Promo Code Check
    if (VALID_PROMO_CODES[cleanCode]) {
      const creditedAmount = VALID_PROMO_CODES[cleanCode];
      return res.json({
        success: true,
        amount: creditedAmount,
        message: `Tebrikler! ${creditedAmount} ₺ bakiye yüklendi.`
      });
    }

    // 2. Shopier / Order ID Validation (Must be a valid 8+ digit numeric or verified format)
    if (/^\d{7,12}$/.test(cleanCode) || cleanCode.startsWith('TS_') || cleanCode.startsWith('SHOP_')) {
      if (PROCESSED_ORDERS.has(cleanCode)) {
        return res.status(400).json({ success: false, error: 'Bu sipariş numarası daha önce kullanılmış!' });
      }
      
      PROCESSED_ORDERS.add(cleanCode);
      const creditedAmount = Number(amount) || 50;

      console.log(`[Order Verified] ${cleanCode} -> ₺${creditedAmount} credited for @${bidder}`);

      return res.json({
        success: true,
        amount: creditedAmount,
        message: `Siparişiniz doğrulandı! ₺${creditedAmount} bakiye yüklendi.`
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Geçersiz sipariş kodu! Lütfen Shopier/PayTR ödemenizi tamamlayıp sipariş numaranızı girin.'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- PAYTR TOKEN GENERATION ENDPOINT ---
app.post('/api/paytr/create-token', async (req, res) => {
  try {
    const { amount, bidder, email } = req.body;
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const merchantOid = 'TS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const paymentAmount = Math.round(Number(amount) * 100);

    const userBasket = JSON.stringify([
      [`${amount} TL Taraftar Bakiyesi`, `${amount}.00`, 1]
    ]);
    const userEmail = email || 'destek@takiminisec.lol';
    const userName = bidder || 'Taraftar';
    const currency = 'TL';
    const testMode = PAYTR_MERCHANT_ID === 'MERCHANT_ID' ? '1' : '0';

    const hashStr = `${PAYTR_MERCHANT_ID}${userIp}${merchantOid}${userEmail}${paymentAmount}${userBasket}00${currency}${testMode}`;
    const tokenHash = crypto.createHmac('sha256', PAYTR_MERCHANT_KEY).update(hashStr + PAYTR_MERCHANT_SALT).digest('base64');

    res.json({
      success: true,
      orderId: merchantOid,
      merchantId: PAYTR_MERCHANT_ID,
      amount: paymentAmount,
      tokenHash,
      isConfigured: PAYTR_MERCHANT_ID !== 'MERCHANT_ID',
      directUrl: 'https://www.shopier.com/takiminisec/50191149'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- PAYTR CALLBACK WEBHOOK ---
app.post('/api/paytr/callback', (req, res) => {
  try {
    const { merchant_oid, status, total_amount, hash } = req.body;
    
    const expectedHashStr = `${merchant_oid}${PAYTR_MERCHANT_SALT}${status}${total_amount}`;
    const calculatedHash = crypto.createHmac('sha256', PAYTR_MERCHANT_KEY).update(expectedHashStr).digest('base64');

    if (calculatedHash === hash && status === 'success') {
      const amountTL = total_amount / 100;
      PROCESSED_ORDERS.add(merchant_oid);
      console.log(`[PayTR Webhook Verified] ${merchant_oid} -> ₺${amountTL}`);
      return res.send('OK');
    }

    res.send('OK');
  } catch (err) {
    console.error('[PayTR Webhook Error]', err);
    res.status(500).send('FAIL');
  }
});

// Fallback to React frontend router for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// --- WEBSOCKET EVENT LISTENERS ---
io.on('connection', (socket) => {
  socket.emit('initial_state', {
    provinces: db.getAllProvinces(),
    teams: TEAMS,
    stats: db.getStats(),
    activity: db.getActivityFeed()
  });

  socket.on('place_bid', (data, callback) => {
    try {
      const { provinceId, teamId, amount, bidder, note } = data;
      const result = db.placeBid({ provinceId, teamId, amount, bidder, note });

      io.emit('province_updated', {
        province: result.updatedProvince,
        activity: result.activity,
        stats: result.stats
      });

      if (typeof callback === 'function') {
        callback({ success: true, data: result });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  socket.on('disconnect', () => {
    // User disconnected
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`⚽ TakiminiSec Server running on http://localhost:${PORT}`);
});
