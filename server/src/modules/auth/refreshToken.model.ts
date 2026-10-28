import { Schema, model, type Types } from 'mongoose';

export interface IRefreshToken {
  userId: Types.ObjectId;
  /** sha256 of the raw token; the raw value is only ever held by the client. */
  tokenHash: string;
  expiresAt: Date;
}

const schema = new Schema<IRefreshToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

// MongoDB deletes expired tokens automatically.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', schema, 'refresh_tokens');
