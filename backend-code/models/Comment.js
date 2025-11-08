// models/Comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  notice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notice',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isReply: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
commentSchema.index({ notice: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
