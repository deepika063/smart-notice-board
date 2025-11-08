const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics based on user role
// @access  Private
router.get('/stats', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    let stats = {};

    // Filter for department-specific visibility
    const departmentFilter = {
      $or: [
        { department: 'All Departments' },
        { department: user.department }
      ]
    };

    // ============================
    // ADMIN DASHBOARD STATS
    // ============================
    if (user.role === 'admin') {
      const [
        totalNotices,
        activeNotices,
        pendingApprovals,
        totalUsers,
        totalComments,
        currentNotices,
        upcomingNotices,
        pastNotices
      ] = await Promise.all([
        Notice.countDocuments({}),
        Notice.countDocuments({ status: 'published' }),
        User.countDocuments({ status: 'pending' }),
        User.countDocuments({}),
        Comment.countDocuments({}),
        // Current (published notices)
        Notice.find({ status: 'published' })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('author', 'name role'),
        // Upcoming (scheduled notices)
        Notice.find({ status: 'scheduled', scheduledDate: { $gt: now } })
          .sort({ scheduledDate: 1 })
          .limit(5)
          .populate('author', 'name role'),
        // Past (old published notices)
        Notice.find({
          status: 'published',
          scheduledDate: { $lt: now }
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('author', 'name role')
      ]);

      stats = {
        totalNotices,
        activeNotices,
        pendingApprovals,
        totalUsers,
        totalComments,
        currentNotices,
        upcomingNotices,
        pastNotices
      };
    }

    // ============================
    // FACULTY DASHBOARD STATS
    // ============================
    else if (user.role === 'faculty') {
      const [
        myNotices,
        publishedNotices,
        scheduledNotices,
        myComments,
        unreadNotifications,
        currentNotices,
        upcomingNotices,
        pastNotices
      ] = await Promise.all([
        Notice.countDocuments({ author: user._id }),
        Notice.countDocuments({ author: user._id, status: 'published' }),
        Notice.countDocuments({
          author: user._id,
          status: 'scheduled',
          scheduledDate: { $exists: true, $ne: null }
        }),
        Comment.countDocuments({ author: user._id }),
        Notification.countDocuments({ user: user._id, read: false }),
        // Current
        Notice.find({ author: user._id, status: 'published' })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('author', 'name role'),
        // Upcoming
        Notice.find({
          author: user._id,
          status: 'scheduled',
          scheduledDate: { $gt: now }
        })
          .sort({ scheduledDate: 1 })
          .limit(5)
          .populate('author', 'name role'),
        // Past
        Notice.find({
          author: user._id,
          status: 'published',
          scheduledDate: { $lt: now }
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('author', 'name role')
      ]);

      stats = {
        myNotices,
        publishedNotices,
        scheduledNotices,
        myComments,
        unreadNotifications,
        currentNotices,
        upcomingNotices,
        pastNotices
      };
    }

    // ============================
    // STUDENT DASHBOARD STATS
    // ============================
    else {
      const [
        unreadNotifications,
        myComments,
        currentNotices,
        upcomingNotices,
        pastNotices
      ] = await Promise.all([
        Notification.countDocuments({ user: user._id, read: false }),
        Comment.countDocuments({ author: user._id }),

        // Current (published)
        Notice.find({
          ...departmentFilter,
          status: 'published'
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('author', 'name role'),

        // Upcoming (scheduled for future)
        Notice.find({
          ...departmentFilter,
          status: 'scheduled',
          scheduledDate: { $gt: now }
        })
          .sort({ scheduledDate: 1 })
          .limit(5)
          .populate('author', 'name role'),

        // Past (old published)
        Notice.find({
          ...departmentFilter,
          status: 'published',
          scheduledDate: { $lt: now }
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('author', 'name role')
      ]);

      stats = {
        unreadNotifications,
        myComments,
        currentNotices,
        upcomingNotices,
        pastNotices,
        currentCount: currentNotices.length,
        upcomingCount: upcomingNotices.length,
        pastCount: pastNotices.length
      };
    }

    // Send response
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

module.exports = router;
