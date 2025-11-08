// routes/analytics.js
const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { authenticate, isAdminOrFaculty } = require('../middleware/auth');

// Get Analytics Dashboard Data
router.get('/dashboard', authenticate, isAdminOrFaculty, async (req, res) => {
  try {
    const { timeRange = '7' } = req.query; // days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));

    let query = { createdAt: { $gte: daysAgo } };

    // Faculty can only see their own notices
    if (req.user.role === 'faculty') {
      query.author = req.user._id;
    }

    // Total notices
    const totalNotices = await Notice.countDocuments(query);
    
    // Published notices
    const publishedNotices = await Notice.countDocuments({ 
      ...query, 
      status: 'published' 
    });

    // Total views
    const notices = await Notice.find(query);
    const totalViews = notices.reduce((sum, notice) => sum + notice.views.length, 0);
    
    // Total acknowledgments
    const totalAcknowledgments = notices.reduce(
      (sum, notice) => sum + notice.acknowledged.length, 
      0
    );

    // Total comments
    const noticeIds = notices.map(n => n._id);
    const totalComments = await Comment.countDocuments({ 
      notice: { $in: noticeIds } 
    });

    // Category breakdown
    const categoryBreakdown = await Notice.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Department breakdown
    const departmentBreakdown = await Notice.aggregate([
      { $match: query },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    // Daily activity (last 7 days)
    const dailyActivity = await Notice.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Engagement rate
    const engagementRate = totalNotices > 0 
      ? ((totalAcknowledgments + totalComments) / (totalNotices * 2) * 100).toFixed(2)
      : 0;

    // Top performing notices
    const topNotices = await Notice.find(query)
      .populate('author', 'name role')
      .sort({ 'views.length': -1 })
      .limit(5)
      .select('title category views acknowledged comments createdAt');

    res.json({
      success: true,
      data: {
        overview: {
          totalNotices,
          publishedNotices,
          totalViews,
          totalAcknowledgments,
          totalComments,
          engagementRate: parseFloat(engagementRate)
        },
        categoryBreakdown: categoryBreakdown.map(item => ({
          category: item._id,
          count: item.count
        })),
        departmentBreakdown: departmentBreakdown.map(item => ({
          department: item._id,
          count: item.count
        })),
        dailyActivity: dailyActivity.map(item => ({
          date: item._id,
          count: item.count
        })),
        topNotices: topNotices.map(notice => ({
          id: notice._id,
          title: notice.title,
          category: notice.category,
          views: notice.views.length,
          acknowledged: notice.acknowledged.length,
          comments: notice.comments?.length || 0,
          author: notice.author,
          createdAt: notice.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get Analytics Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics data',
      error: error.message 
    });
  }
});

// Get Engagement Metrics
router.get('/engagement', authenticate, isAdminOrFaculty, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'faculty') {
      query.author = req.user._id;
    }

    const notices = await Notice.find(query);

    const metrics = {
      totalNotices: notices.length,
      averageViews: 0,
      averageAcknowledgments: 0,
      averageComments: 0,
      highEngagementNotices: 0
    };

    if (notices.length > 0) {
      const totalViews = notices.reduce((sum, n) => sum + n.views.length, 0);
      const totalAck = notices.reduce((sum, n) => sum + n.acknowledged.length, 0);
      
      metrics.averageViews = (totalViews / notices.length).toFixed(2);
      metrics.averageAcknowledgments = (totalAck / notices.length).toFixed(2);
      
      // Count high engagement (>50% acknowledgment rate)
      metrics.highEngagementNotices = notices.filter(n => {
        const ackRate = n.views.length > 0 ? (n.acknowledged.length / n.views.length) : 0;
        return ackRate > 0.5;
      }).length;
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Get Engagement Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch engagement metrics' 
    });
  }
});

module.exports = router;
