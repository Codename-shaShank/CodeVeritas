const mongoose = require('mongoose')

const SubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  language: String,
  code: String,
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' }, // track which question this submission answers
  status: { type: String, default: 'pending' },
  analysis: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
})

const QuestionSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  text: String,
  languageHint: String,
  createdAt: { type: Date, default: Date.now },
})

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String,
      socketId: String,
      online: { type: Boolean, default: false },
    },
  ],
  // store multiple questions instead of single question
  questions: [QuestionSchema],
  currentQuestionId: { type: mongoose.Schema.Types.ObjectId, default: null }, // track current question being worked on
  // store generated codes per question and language to avoid re-generation
  generatedCodes: [
    {
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      language: String,
      generated_codes: { type: Object, default: {} },
      generatedAt: Date,
    },
  ],
  submissions: [SubmissionSchema],
}, { timestamps: true })

module.exports = mongoose.model('Room', RoomSchema)
