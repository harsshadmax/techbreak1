import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required env var ${name}`);
  return devFallback;
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/techbreak?directConnection=true'),
  jwtSecret: required('JWT_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT ?? '',
  dailyEarnCap: Number(process.env.DAILY_EARN_CAP ?? 400),
};
