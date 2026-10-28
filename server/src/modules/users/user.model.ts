import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { Streak } from '../tokens/engine';

export interface IUser {
  email: string;
  passwordHash?: string;
  authProvider: 'local' | 'google';
  displayName: string;
  avatar: { base: string; equipped: Map<string, Types.ObjectId> };
  timezone: string;
  tokenBalance: number;
  xp: number;
  level: number;
  streak: Streak;
  settings: { dailyFocusGoalMin: number; dailyScreenLimitMin: number; breakReminders: boolean };
  inviteCode: string;
  friends: Types.ObjectId[];
  fcmTokens: string[];
  /** Last local day the nightly rollover job processed for this user. */
  lastRolloverDate: string | null;
}

export type UserDoc = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: String,
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    displayName: { type: String, required: true, trim: true, maxlength: 40 },
    avatar: {
      base: { type: String, default: 'fox' },
      equipped: { type: Map, of: Schema.Types.ObjectId, default: {} },
    },
    timezone: { type: String, default: 'UTC' },
    tokenBalance: { type: Number, default: 0, min: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: { type: String, default: null },
      freezes: { type: Number, default: 0 },
    },
    settings: {
      dailyFocusGoalMin: { type: Number, default: 120 },
      dailyScreenLimitMin: { type: Number, default: 240 },
      breakReminders: { type: Boolean, default: true },
    },
    inviteCode: { type: String, required: true, unique: true },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    fcmTokens: [String],
    lastRolloverDate: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      flattenMaps: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.passwordHash;
        delete ret.fcmTokens;
        delete ret.lastRolloverDate;
        return ret;
      },
    },
  },
);

export const User = model<IUser>('User', userSchema);
