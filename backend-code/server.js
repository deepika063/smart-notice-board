// server.js - Main Express Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');
const socketService = require('./utils/socketService');

dotenv.config();

const app = express();
const server = http.createServer(app);

// ======================
// 🟢 Import Routes FIRST
// ======================
const authRoutes = require('./routes/auth');
const noticeRoutes = require('./routes/notices');
const commentRoutes = require('./routes/comments');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');

// ======================
// 🟢 Middleware
// ======================
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// 🟢 MongoDB Connection
// ======================
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scnbcp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};
connectWithRetry();

// ======================
// 🟢 Socket.io Initialization
// ======================
const io = socketService.initSocket(server);
app.set('io', io);

// ======================
// 🟢 Mount Routes (Now Safe)
// ======================
app.use('/api/auth', authRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ======================
// 🟢 Health Check
// ======================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'SCNBCP Server Running' });
});

// ======================
// 🟢 Error Handler
// ======================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// ======================
// 🟢 Start Server
// ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, io };
