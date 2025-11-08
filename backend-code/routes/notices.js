// routes/notices.js
const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { authenticate, isAdminOrFaculty } = require('../middleware/auth');

// Get All Notices (with filters)
// NOTE: made public so frontend can load notices in dev without auth. If req.user exists
// the response will be filtered based on role/department as before.
router.get('/', async (req, res) => {
  try {
    const { category, department, status, search, page = 1, limit = 20 } = req.query;
    
    let query = { isArchived: false };

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by department
    if (department && department !== 'all') {
      query.department = { $in: [department, 'All Departments'] };
    } else if (req.user && (req.user.role === 'student' || req.user.role === 'faculty')) {
      // Students and faculty see their department notices and global notices
      query.department = { $in: [req.user.department, 'All Departments'] };
    }

    // Filter by status
    if (status) {
      query.status = status;
    } else {
      query.status = 'published';
    }

    // Search in title and content
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by target year for students (only if we have a logged in user)
    if (req.user && req.user.role === 'student' && req.user.year) {
      query.$or = [
        { targetYear: { $in: [null, '', req.user.year] } }
      ];
    }

    const skip = (page - 1) * limit;

    const notices = await Notice.find(query)
      .populate('author', 'name role department')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get comment counts
    const noticesWithComments = await Promise.all(
      notices.map(async (notice) => {
        const commentCount = await Comment.countDocuments({ notice: notice._id });
        return {
          ...notice.toObject(),
          commentCount
        };
      })
    );

    const total = await Notice.countDocuments(query);

    res.json({
      success: true,
      data: noticesWithComments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get Notices Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notices' 
    });
  }
});

// Get Single Notice
// Public read: if user is present (authenticated middleware earlier in pipeline),
// we'll record views; otherwise just return the notice.
router.get('/:id', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id)
      .populate('author', 'name role department employeeId');

    if (!notice) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notice not found' 
      });
    }

    // Add view if user is available and hasn't viewed before
    if (req.user) {
      const hasViewed = notice.views.some(
        view => view.user.toString() === req.user._id.toString()
      );

      if (!hasViewed) {
        notice.views.push({ user: req.user._id });
        await notice.save();
      }
    }

    // Get comments
    const comments = await Comment.find({ notice: notice._id })
      .populate('author', 'name role department')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        ...notice.toObject(),
        comments
      }
    });
  } catch (error) {
    console.error('Get Notice Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notice' 
    });
  }
});

// Create Notice (Admin & Faculty only)
// This route supports a development fallback when no Authorization header is present.
router.post('/', async (req, res) => {
  try {
    const { 
      title, 
      content, 
      category, 
      department, 
      targetYear, 
      priority, 
      status,
      scheduledDate,
      attachments
    } = req.body;

    // Determine author: try to authenticate via Bearer token if provided
    let authorUser = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        authorUser = await User.findById(decoded.userId);
      }
    } catch (authErr) {
      // ignore here; we'll either fallback in dev or reject below
      console.warn('Token verification failed or not provided for notice creation');
    }

    // Development fallback: create/find a dev author user when no token present
    if (!authorUser && process.env.NODE_ENV !== 'production') {
      const devEmail = req.body._devAuthorEmail || 'dev-admin@local';
      authorUser = await User.findOne({ email: devEmail });
      if (!authorUser) {
        // Create a dev user with all required fields
        authorUser = new User({
          name: req.body._devAuthorName || 'Dev Admin',
          email: devEmail,
          role: req.body._devAuthorRole || 'admin',
          department: req.body.department || 'All Departments',
          password: 'devpassword',
          isActive: true,
          employeeId: 'dev-emp-001'
        });
        await authorUser.save();
      }
      console.warn('Using development fallback author for notice creation:', authorUser.email);
    }

    // Require author to be admin or faculty
    if (!authorUser) {
      return res.status(401).json({ success: false, message: 'Access denied. No valid token provided.' });
    }

    if (authorUser.role !== 'admin' && authorUser.role !== 'faculty') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin or Faculty only.' });
    }

    const notice = new Notice({
      title,
      content,
      category,
      department,
      targetYear,
      author: authorUser._id,
      priority,
      status,
      scheduledDate,
      attachments
    });

    await notice.save();
    await notice.populate('author', 'name role department');

    // Create notifications for relevant users
    if (status === 'published') {
      // Find users who should receive this notification
      let targetUsers = {};
      if (department === 'All Departments') {
        targetUsers = await User.find({ role: 'student', isActive: true });
      } else {
        targetUsers = await User.find({ 
          role: 'student', 
          department, 
          isActive: true 
        });
      }

      // Create notifications
      const notifications = targetUsers.map(user => ({
        user: user._id,
        type: 'new_notice',
        message: `New ${category} notice: ${title}`,
        relatedNotice: notice._id
      }));

      await Notification.insertMany(notifications);

      // Notify all connected clients using socketService
      const socketService = require('../utils/socketService');
      socketService.notifyNewNotice(notice);
    }

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice
    });
  } catch (error) {
    console.error('Create Notice Error:', error);
    console.error('Request body:', req.body);
    console.error('Full error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create notice',
      error: error.message 
    });
  }
});

// Update Notice (Admin & Faculty only)
router.put('/:id', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notice not found' 
      });
    }

    // Determine acting user (token or dev fallback)
    let actingUser = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        actingUser = await User.findById(decoded.userId);
      }
    } catch (e) {
      console.warn('Token verify failed for update');
    }

    if (!actingUser && process.env.NODE_ENV !== 'production') {
      const devEmail = req.body._devAuthorEmail || 'dev-admin@local';
      actingUser = await User.findOne({ email: devEmail });
      if (!actingUser) {
        actingUser = new User({ name: req.body._devAuthorName || 'Dev Admin', email: devEmail, role: req.body._devAuthorRole || 'admin', isActive: true });
        await actingUser.save();
      }
      console.warn('Using development fallback actor for notice update:', actingUser.email);
    }

    if (!actingUser) {
      return res.status(401).json({ success: false, message: 'Access denied. No valid token provided.' });
    }

    // Check if acting user is the author or admin
    if (notice.author.toString() !== actingUser._id.toString() && actingUser.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only edit your own notices' 
      });
    }

    const {
      title,
      content,
      category,
      department,
      targetYear,
      priority,
      status,
      scheduledDate,
      attachments
    } = req.body;

    notice.title = title || notice.title;
    notice.content = content || notice.content;
    notice.category = category || notice.category;
    notice.department = department || notice.department;
    notice.targetYear = targetYear !== undefined ? targetYear : notice.targetYear;
    notice.priority = priority || notice.priority;
    notice.status = status || notice.status;
    notice.scheduledDate = scheduledDate || notice.scheduledDate;
    notice.attachments = attachments || notice.attachments;

    await notice.save();
    await notice.populate('author', 'name role department');

    // Notify all connected clients about the notice update
    const socketService = require('../utils/socketService');
    socketService.notifyUpdatedNotice(notice);

    res.json({
      success: true,
      message: 'Notice updated successfully',
      data: notice
    });
  } catch (error) {
    console.error('Update Notice Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update notice' 
    });
  }
});

// Delete Notice (Admin & Faculty only)
router.delete('/:id', authenticate, isAdminOrFaculty, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notice not found' 
      });
    }

    // Check if user is the author or admin
    if (notice.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own notices' 
      });
    }

    // Delete associated comments
    await Comment.deleteMany({ notice: notice._id });

    // Delete associated notifications
    await Notification.deleteMany({ relatedNotice: notice._id });

    await notice.deleteOne();

    // Notify all connected clients about the notice deletion
    const socketService = require('../utils/socketService');
    socketService.notifyDeletedNotice(req.params.id);

    res.json({
      success: true,
      message: 'Notice deleted successfully'
    });
  } catch (error) {
    console.error('Delete Notice Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete notice' 
    });
  }
});

// Acknowledge Notice
router.post('/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notice not found' 
      });
    }

    // Check if already acknowledged
    const hasAcknowledged = notice.acknowledged.some(
      ack => ack.user.toString() === req.user._id.toString()
    );

    if (!hasAcknowledged) {
      notice.acknowledged.push({ user: req.user._id });
      await notice.save();
    }

    res.json({
      success: true,
      message: 'Notice acknowledged',
      acknowledgedCount: notice.acknowledged.length
    });
  } catch (error) {
    console.error('Acknowledge Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to acknowledge notice' 
    });
  }
});

module.exports = router;
