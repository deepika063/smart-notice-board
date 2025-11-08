// models/Notice.js
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['academic', 'events', 'exams', 'circulars'],
    required: true
  },
  department: {
    type: String,
    required: true
  },
  targetYear: {
    type: String,
    default: null
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['published', 'scheduled', 'draft'],
    default: 'published'
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  attachments: [{
    name: String,
    type: String,
    url: String,
    size: Number
  }],
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  acknowledged: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now
    }
  }],
  expiresAt: {
    type: Date,
    default: null
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
noticeSchema.index({ category: 1, department: 1, status: 1 });
noticeSchema.index({ createdAt: -1 });
noticeSchema.index({ author: 1 });

// Virtual for view count
noticeSchema.virtual('viewCount').get(function() {
  return this.views.length;
});

// Virtual for acknowledgment count
noticeSchema.virtual('acknowledgedCount').get(function() {
  return this.acknowledged.length;
});

// Virtual for comment count (populated from Comment model)
noticeSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'notice'
});

noticeSchema.set('toJSON', { virtuals: true });
noticeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notice', noticeSchema);
