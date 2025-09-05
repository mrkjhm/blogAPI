// scripts/verify-jwt.ts
import 'dotenv/config';            // loads .env (optional kung env.ts mo na ang naglo-load)
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env';

const token = process.argv[2];
if (!token) {
  console.error('Usage: npx ts-node scripts/verify-jwt.ts <JWT>');
  process.exit(1);
}

try {
  const decoded = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as jwt.JwtPayload;
  console.log('VALID ✅\n', decoded);
} catch (e: any) {
  console.error('INVALID ❌:', e.message);
  process.exit(1);
}
