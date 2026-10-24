import mongoose, { Document, Schema } from 'mongoose';
import { IQuestion } from '../types/question.types.js';

export interface IQuestionDocument extends Omit<IQuestion, '_id' | 'id'>, Document {
  id: string;
}

const OptionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const SourceSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['PYQ', 'AI_GENERATED', 'MANUAL', 'PRACTICE'],
      default: 'MANUAL',
      required: true,
      index: true,
    },
    provider: { type: String, default: 'OFFICIAL_GATE' },
    exam: { type: String, default: 'GATE' },
    year: { type: Schema.Types.Mixed },
    paper: { type: String },
    section: { type: String },
    questionNumber: { type: Number },
    sourceUrl: { type: String },
    fetchedAt: { type: String },
    checksum: { type: String },
    notes: { type: String },
    questionPaperSourceId: { type: String },
    answerKeySourceId: { type: String },
    questionPaperChecksum: { type: String },
    answerKeyChecksum: { type: String },
  },
  { _id: false }
);

const AIAnalysisSchema = new Schema(
  {
    analyzed: { type: Boolean, default: false, index: true },
    subject: { type: String },
    topic: { type: String },
    subtopic: { type: String },
    concepts: { type: [String], default: [] },
    subConcepts: { type: [String], default: [] },
    reasoningType: { type: [String], default: [] },
    cognitiveSkill: { type: String },
    questionPattern: { type: String },
    solutionApproach: { type: String },
    difficultyAssessment: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
    distractorPatterns: { type: [String], default: [] },
    commonTraps: { type: [String], default: [] },
    requiredKnowledge: { type: [String], default: [] },
    gateCharacteristics: { type: [String], default: [] },
    analysisVersion: { type: String, default: '3b-v1' },
    analyzedAt: { type: String },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestionDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    question: { type: String, required: true },
    subject: { type: String, required: false, index: true },
    topic: { type: String, required: false, index: true },
    subtopic: { type: String },
    concepts: { type: [String], default: [], index: true },
    year: { type: Schema.Types.Mixed, required: true, default: 2024, index: true },
    exam: { type: String, required: true, default: 'GATE CS' },
    paper: { type: String, default: 'CS' },
    section: { type: String },
    questionNumber: { type: Number },
    questionType: {
      type: String,
      enum: ['MCQ', 'MSQ', 'NAT'],
      default: 'MCQ',
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: false,
      index: true,
    },
    options: { type: [OptionSchema], default: [] },
    correctAnswer: { type: Schema.Types.Mixed, required: false },
    explanation: { type: String, required: false, default: 'Explanation not available yet.' },
    numericalAnswer: { type: Schema.Types.Mixed },
    numericalTolerance: { type: Number, default: 0.01 },
    marks: { type: Number },
    requiresFigure: { type: Boolean, default: false },
    imageUrl: { type: String, required: false },
    extractionConfidence: { type: Number },
    source: { type: SourceSchema, required: true, default: () => ({ type: 'MANUAL', exam: 'GATE' }) },
    reasoningType: { type: [String], default: [] },
    aiAnalysis: { type: AIAnalysisSchema },
  },
  {
    timestamps: true,
  }
);

// Text index for search
QuestionSchema.index({ question: 'text', topic: 'text', concepts: 'text' });

export const QuestionModel = mongoose.model<IQuestionDocument>('Question', QuestionSchema);
