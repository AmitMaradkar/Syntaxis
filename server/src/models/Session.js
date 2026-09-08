import mongoose from 'mongoose';

const hintHistorySchema = new mongoose.Schema({
  tier: {
    type: Number,
    required: true,
    min: 1,
    max: 3
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    language: {
      type: String,
      enum: ['javascript', 'python', 'java', 'cpp'],
      default: 'javascript'
    },
    title: {
      type: String,
      default: 'Coding Session'
    },
    problemDescription: {
      type: String,
      default: ''
    },
    code: {
      type: String,
      default: ''
    },
    hintTier: {
      type: Number,
      default: 0,
      min: 0,
      max: 3
    },
    hintsUsed: {
      type: Number,
      default: 0
    },
    hintsHistory: [hintHistorySchema],
    solved: {
      type: Boolean,
      default: false
    },
    submissions: {
      type: Number,
      default: 0
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    solvedAt: {
      type: Date
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    latestReview: {
      errors: [
        {
          errorType: String,
          line: Number,
          description: String,
          snippet: String
        }
      ],
      passed: Boolean,
      summary: String,
      timestamp: Date
    }
  },
  {
    timestamps: true
  }
);

const Session = mongoose.model('Session', sessionSchema);
export default Session;
