// routes/comments.js
const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Notice = require('../models/Notice');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

// Get Comments for a Notice
router.get('/notice/:noticeId', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    // Get top-level comments first (not replies)
    const comments = await Comment.find({ 
      notice: noticeId,
      parentComment: null 
    })
    .populate('author', 'name role department')
    .populate({
      path: 'replies',
      populate: {
        path: 'author',
        select: 'name role department'
      }
    })
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Get Comments Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch comments' 
    });
  }
});

// Create Comment
const User = require('../models/User');

// Allow unauthenticated comment posting in development
router.post('/', async (req, res) => {
  try {
    const { noticeId, content } = req.body;

    // Basic validation
    if (!noticeId) {
      return res.status(400).json({ success: false, message: 'noticeId is required' });
    }
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content is required' });
    }

    // Check if notice exists and validate id
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(noticeId)) {
      return res.status(400).json({ success: false, message: 'Invalid noticeId' });
    }

    const notice = await Notice.findById(noticeId).populate('author');
    if (!notice) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notice not found' 
      });
    }

    // Determine author: try to authenticate via Bearer token if provided
    let authorUser = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        authorUser = await User.findById(decoded.userId);
      }
    } catch (authErr) {
      // ignore here; fallback below
    }

    // Development fallback: create/find a dev author user when no token present
    if (!authorUser && process.env.NODE_ENV !== 'production') {
      const devEmail = req.body._devAuthorEmail || 'dev-commenter@local';
      authorUser = await User.findOne({ email: devEmail });
      if (!authorUser) {
        const devRole = req.body._devAuthorRole || 'student';
        const baseUser = {
          name: req.body._devAuthorName || (devRole === 'faculty' ? 'Dev Faculty' : 'Anonymous Student'),
          email: devEmail,
          role: devRole,
          department: req.body._devAuthorDepartment || 'General',
          password: 'devpassword',
          isActive: true,
          profilePicture: '',
          lastLogin: new Date(),
          createdAt: new Date()
        };

        if (devRole === 'student') {
          baseUser.studentId = `dev-stu-${Date.now()}`;
          baseUser.year = req.body._devAuthorYear || '2025';
        } else {
          // faculty or admin
          baseUser.employeeId = req.body._devAuthorEmployeeId || `dev-emp-${Date.now()}`;
        }

        authorUser = new User(baseUser);
        await authorUser.save();
      }
    }

    if (!authorUser) {
      return res.status(401).json({ success: false, message: 'Access denied. No valid token provided.' });
    }

    const comment = new Comment({
      notice: noticeId,
      author: authorUser._id,
      content
    });

    // If this is a reply to another comment, we'll validate the parent id
    const { parentCommentId } = req.body;

    // Save the comment first to ensure it has an _id
    await comment.save();
    await comment.populate('author', 'name role department');

    if (parentCommentId) {
      // Validate parentCommentId shape
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parentCommentId' });
      }

      // Attach to parent comment (if exists and belongs to same notice)
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }

      if (parentComment.notice.toString() !== noticeId.toString()) {
        return res.status(400).json({ success: false, message: 'Parent comment does not belong to this notice' });
      }

      try {
        parentComment.replies.push(comment._id);
        await parentComment.save();
      } catch (attachErr) {
        console.error('Failed to attach reply to parent comment:', attachErr);
        // Do not fail the whole request; respond with partial success
      }
    }

    // Create notification for notice author if we have both authors
    try {
      if (notice.author && notice.author._id && notice.author._id.toString() !== authorUser._id.toString()) {
        const notification = new Notification({
          user: notice.author._id,
          type: 'comment',
          message: `${authorUser.name} commented on your notice: ${notice.title}`,
          relatedNotice: notice._id,
          relatedComment: comment._id
        });
        await notification.save();

        // Emit real-time notification if io available
        const io = req.app.get('io');
        if (io && typeof io.to === 'function') {
          try {
            io.to(`user-${notice.author._id}`).emit('new-comment', {
              comment: comment.toObject(),
              notice: notice.toObject(),
              message: `New comment on your notice`
            });
          } catch (emitErr) {
            console.error('Failed emitting new-comment to notice author:', emitErr);
          }
        }
      }
    } catch (notifyErr) {
      console.error('Notification generation error (notice author):', notifyErr);
    }

    // If this was a reply, notify the parent comment's author (if different)
    if (comment.parentComment) {
      try {
        const parent = await Comment.findById(comment.parentComment).populate('author');
        if (parent && parent.author && parent.author._id.toString() !== authorUser._id.toString()) {
          try {
            const replyNotification = new Notification({
              user: parent.author._id,
              type: 'comment',
              message: `${authorUser.name} replied to your comment on: ${notice.title}`,
              relatedNotice: notice._id,
              relatedComment: comment._id
            });
            await replyNotification.save();
          } catch (saveNotifyErr) {
            console.error('Failed saving reply notification:', saveNotifyErr);
          }

          const io = req.app.get('io');
          if (io && typeof io.to === 'function') {
            try {
              io.to(`user-${parent.author._id}`).emit('new-comment', {
                comment: comment.toObject(),
                notice: notice.toObject(),
                message: `${authorUser.name} replied to your comment`
              });
            } catch (emitErr) {
              console.error('Failed emitting new-comment to parent author:', emitErr);
            }
          }
        }
      } catch (notifyErr) {
        console.error('Failed to notify parent comment author:', notifyErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: comment
    });
  } catch (error) {
    console.error('Create Comment Error:', error);
    console.error('Request body:', req.body);
    console.error('Full error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add comment',
      error: error.message 
    });
  }
});

// Update Comment
router.put('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found' 
      });
    }

    // Development mode: Find or create author user
    let authorUser = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        authorUser = await User.findById(decoded.userId);
      }
    } catch (authErr) {
      // ignore here; fallback below
    }

    // Development fallback: find/create dev user
    if (!authorUser && process.env.NODE_ENV !== 'production') {
      const devEmail = req.body._devAuthorEmail || 'dev-commenter@local';
      authorUser = await User.findOne({ email: devEmail });
      if (!authorUser) {
        const devRole = req.body._devAuthorRole || 'student';
        const baseUser = {
          name: req.body._devAuthorName || (devRole === 'faculty' ? 'Dev Faculty' : 'Anonymous Student'),
          email: devEmail,
          role: devRole,
          department: req.body._devAuthorDepartment || 'General',
          password: 'devpassword',
          isActive: true,
          profilePicture: '',
          lastLogin: new Date(),
          createdAt: new Date()
        };

        if (devRole === 'student') {
          baseUser.studentId = `dev-stu-${Date.now()}`;
          baseUser.year = req.body._devAuthorYear || '2025';
        } else {
          baseUser.employeeId = req.body._devAuthorEmployeeId || `dev-emp-${Date.now()}`;
        }

        authorUser = new User(baseUser);
        await authorUser.save();
      }
    }

    // Check if user is the author or admin
    const isAdmin = authorUser?.role === 'admin';
    const isAuthor = comment.author.toString() === authorUser?._id.toString();

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only edit your own comments' 
      });
    }

    const { content } = req.body;
    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();
    await comment.populate('author', 'name role department');

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('comment-edited', comment);

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: comment
    });
  } catch (error) {
    console.error('Update Comment Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update comment' 
    });
  }
});

// Delete Comment
router.delete('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found' 
      });
    }

    // Development mode: Find or create author user
    let authorUser = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        authorUser = await User.findById(decoded.userId);
      }
    } catch (authErr) {
      // ignore here; fallback below
    }

    // Development fallback: find/create dev user
    if (!authorUser && process.env.NODE_ENV !== 'production') {
      const devEmail = req.body._devAuthorEmail || 'dev-commenter@local';
      authorUser = await User.findOne({ email: devEmail });
      if (!authorUser) {
        const devRole = req.body._devAuthorRole || 'student';
        const baseUser = {
          name: req.body._devAuthorName || (devRole === 'faculty' ? 'Dev Faculty' : 'Anonymous Student'),
          email: devEmail,
          role: devRole,
          department: req.body._devAuthorDepartment || 'General',
          password: 'devpassword',
          isActive: true,
          profilePicture: '',
          lastLogin: new Date(),
          createdAt: new Date()
        };

        if (devRole === 'student') {
          baseUser.studentId = `dev-stu-${Date.now()}`;
          baseUser.year = req.body._devAuthorYear || '2025';
        } else {
          baseUser.employeeId = req.body._devAuthorEmployeeId || `dev-emp-${Date.now()}`;
        }

        authorUser = new User(baseUser);
        await authorUser.save();
      }
    }

    // Check if user is the author or admin
    const isAdmin = authorUser?.role === 'admin';
    const isAuthor = comment.author.toString() === authorUser?._id.toString();

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only delete your own comments' 
      });
    }

    // If it's a parent comment, delete all replies too
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: comment._id });
    } else {
      // If it's a reply, remove it from parent's replies array
      const parentComment = await Comment.findById(comment.parentComment);
      if (parentComment) {
        parentComment.replies = parentComment.replies.filter(
          replyId => replyId.toString() !== comment._id.toString()
        );
        await parentComment.save();
      }
    }

    await comment.deleteOne();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('comment-deleted', comment._id);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete Comment Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete comment' 
    });
  }
});

module.exports = router;
