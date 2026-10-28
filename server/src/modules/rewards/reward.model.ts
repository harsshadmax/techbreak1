import { Schema, model, type Types } from 'mongoose';

export const REWARD_KINDS = ['avatar_item', 'donation', 'perk'] as const;
export const AVATAR_SLOTS = ['hat', 'outfit', 'background'] as const;

export interface IReward {
  slug: string;
  kind: (typeof REWARD_KINDS)[number];
  name: string;
  description: string;
  slot?: (typeof AVATAR_SLOTS)[number];
  cost: number;
  imageUrl?: string;
  /** For donations: the cause the pledge supports. */
  cause?: string;
  active: boolean;
}

const rewardSchema = new Schema<IReward>(
  {
    slug: { type: String, required: true, unique: true },
    kind: { type: String, enum: REWARD_KINDS, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    slot: { type: String, enum: AVATAR_SLOTS },
    cost: { type: Number, required: true, min: 1 },
    imageUrl: String,
    cause: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

export const Reward = model<IReward>('Reward', rewardSchema);

export interface IInventoryItem {
  userId: Types.ObjectId;
  rewardId: Types.ObjectId;
  acquiredAt: Date;
}

const inventorySchema = new Schema<IInventoryItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rewardId: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
    acquiredAt: { type: Date, default: () => new Date() },
  },
  { toJSON: { virtuals: true, versionKey: false } },
);
inventorySchema.index({ userId: 1, rewardId: 1 }, { unique: true });

export const InventoryItem = model<IInventoryItem>('InventoryItem', inventorySchema, 'inventory');

export interface IDonation {
  userId: Types.ObjectId;
  rewardId: Types.ObjectId;
  cause: string;
  tokens: number;
  status: 'pledged' | 'fulfilled';
  pledgedAt: Date;
}

const donationSchema = new Schema<IDonation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rewardId: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
    cause: { type: String, required: true },
    tokens: { type: Number, required: true },
    status: { type: String, enum: ['pledged', 'fulfilled'], default: 'pledged' },
    pledgedAt: { type: Date, default: () => new Date() },
  },
  { toJSON: { virtuals: true, versionKey: false } },
);

export const Donation = model<IDonation>('Donation', donationSchema);
