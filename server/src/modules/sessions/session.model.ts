import { Schema, model, type Types } from 'mongoose';
import type { Award } from '../tokens/engine';

export const BREAK_KINDS = ['breathing', 'stretch', 'walk', 'eye_rest'] as const;
export const PLATFORMS = ['web', 'android', 'ios'] as const;

export interface ISession {
  userId: Types.ObjectId;
  type: 'focus' | 'break';
  breakKind?: (typeof BREAK_KINDS)[number];
  /** For breaks: the focus session this break follows. */
  afterSessionId?: Types.ObjectId;
  plannedMin: number;
  actualMin: number;
  status: 'active' | 'completed' | 'abandoned';
  interruptions: number;
  startedAt: Date;
  endedAt?: Date;
  platform: (typeof PLATFORMS)[number];
  tokensAwarded: number;
  awards: Award[];
}

const schema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['focus', 'break'], required: true },
    breakKind: { type: String, enum: BREAK_KINDS },
    afterSessionId: Schema.Types.ObjectId,
    plannedMin: { type: Number, required: true },
    actualMin: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    interruptions: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    endedAt: Date,
    platform: { type: String, enum: PLATFORMS, default: 'web' },
    tokensAwarded: { type: Number, default: 0 },
    awards: [{ _id: false, amount: Number, reason: String }],
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

schema.index({ userId: 1, startedAt: -1 });
schema.index({ type: 1, status: 1, startedAt: -1 });
schema.index({ afterSessionId: 1 });

export const Session = model<ISession>('Session', schema);
