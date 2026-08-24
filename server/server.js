const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const { TEAMS } = require('./teamsData');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Frontend Static Build if available
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Simple Profanity / Bad words filter
const BANNED_WORDS = ['küfür1', 'küfür2']; // extensible blacklist
const sanitize = (text) => {
  if (!text) return '';
  return text.toString().substring(0, 80).replace(/<[^>]*>?/gm, '');
};

// REST Endpoints
app.get('/api/teams', (req, res) => {
  res.json({ success: true, teams: TEAMS });
});

app.get('/api/provinces', (req, res) => {
  res.json({ success: true, provinces: db.getAllProvinces() });
});

app.get('/api/activity', (req, res) => {
  res.json({ success: true, activity: db.getActivityFeed() });
});

app.get('/api/stats', (req, res) => {
  res.json({ success: true, stats: db.getStats() });
});

// Place Bid (Instant / Demo / Authorized)
app.post('/api/bid', (req, res) => {
  try {
    const { provinceId, teamId, amount, bidder, note } = req.body;
    const sanitizedBidder = sanitize(bidder) || 'Anonim Taraftar';
    const sanitizedNote = sanitize(note);

    const result = db.placeBid({
      provinceId,
      teamId,
      amount: Number(amount),
      bidder: sanitizedBidder,
      note: sanitizedNote
    });
    
    // Broadcast real-time update to all connected clients
    io.emit('province_updated', {
      province: result.updatedProvince,
      activity: result.activity,
      stats: result.stats
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// PAYMENT GATEWAY INTEGRATIONS (Shopier / PayTR / Papara / Webhook)
// -------------------------------------------------------------

// 1. Create Payment Order / Checkout Link
app.post('/api/payment/create', (req, res) => {
  try {
    const { provinceId, teamId, amount, bidder, note, paymentMethod } = req.body;
    const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // Save pending transaction (In prod: save to db.pendingOrders)
    // If Shopier / PayTR credentials exist, return their checkout URL
    const shopierLink = `https://www.shopier.com/ShowProductNew/products.php?id=YOUR_PRODUCT_ID&custom=${orderId}`;

    res.json({
      success: true,
      orderId,
      amount: Number(amount),
      provinceId,
      teamId,
      bidder,
      note,
      paymentUrl: shopierLink,
      message: 'Ödeme emri hazırlandı.'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Payment Webhook Callback (Shopier / PayTR / Papara calls this after user pays)
app.post('/api/payment/webhook', (req, res) => {
  try {
    // Extract metadata sent from payment gateway
    const { provinceId, teamId, amount, bidder, note, status, order_id } = req.body;
    
    console.log(`[Payment Webhook] Received successful payment for ${provinceId}: ${amount} ₺ by ${bidder}`);

    // Automatically apply the bid upon confirmed payment!
    const result = db.placeBid({
      provinceId,
      teamId,
      amount: Number(amount),
      bidder: sanitize(bidder) || 'Cömert Taraftar',
      note: sanitize(note) || 'Gerçek Ödeme ile Alındı! 💳'
    });

    io.emit('province_updated', {
      province: result.updatedProvince,
      activity: result.activity,
      stats: result.stats
    });

    res.send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send('FAIL');
  }
});

// Real-time WebSockets
io.on('connection', (socket) => {
  // Send initial snapshot on connect
  socket.emit('initial_state', {
    provinces: db.getAllProvinces(),
    teams: TEAMS,
    activity: db.getActivityFeed(),
    stats: db.getStats()
  });

  socket.on('place_bid', (data, callback) => {
    try {
      const sanitizedBidder = sanitize(data.bidder) || 'Anonim Taraftar';
      const sanitizedNote = sanitize(data.note);

      const result = db.placeBid({
        provinceId: data.provinceId,
        teamId: data.teamId,
        amount: Number(data.amount),
        bidder: sanitizedBidder,
        note: sanitizedNote
      });
      
      // Broadcast to EVERYONE
      io.emit('province_updated', {
        province: result.updatedProvince,
        activity: result.activity,
        stats: result.stats
      });

      if (typeof callback === 'function') {
        callback({ success: true, data: result });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });
});

// Fallback to React index.html for any frontend SPA routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`⚽ Outbid Türkiye Full-Stack Server is running on http://localhost:${PORT}`);
});
