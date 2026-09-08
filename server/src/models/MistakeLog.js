import mongoose from 'mongoose';

export const ERROR_CATEGORIES = [
  'off-by-one',
  'wrong-data-structure',
  'syntax',
  'logic-error',
  'bad-complexity',
  'type-error',
  'boundary-error',
  'null-reference',
  'scope-error',
  'other'
];

const mistakeLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    errorType: {
      type: String,
      enum: ERROR_CATEGORIES,
      required: true,
      index: true
    },
    description: {
      type: String,
      default: ''
    },
    snippet: {
      type: String,
      default: ''
    },
    line: {
      type: Number
    },
    language: {
      type: String,
      default: 'javascript'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Helpful index for aggregating recurring patterns per user/session
mistakeLogSchema.index({ userId: 1, errorType: 1, timestamp: -1 });

const MistakeLog = mongoose.model('MistakeLog', mistakeLogSchema);
export default MistakeLog;
