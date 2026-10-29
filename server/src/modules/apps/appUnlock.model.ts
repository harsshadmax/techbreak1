import { Schema, model, type Types } from 'mongoose';

export interface IAppUnlock {
  userId: Types.ObjectId;
  appId: string;
  tokens: number;
  startedAt: Date;
  expiresAt: Date;
}

const appUnlockSchema = new Schema<IAppUnlock>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appId: { type: String, required: true },
    tokens: { type: Number, required: true },
    startedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { toJSON: { virtuals: true, versionKey: false } },
);
appUnlockSchema.index({ userId: 1, appId: 1, expiresAt: -1 });

export const AppUnlock = model<IAppUnlock>('AppUnlock', appUnlockSchema, 'app_unlocks');
