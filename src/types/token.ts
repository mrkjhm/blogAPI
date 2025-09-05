import { Types } from "mongoose";

// types/token.ts
export interface TokenPayload {
  id: string | Types.ObjectId;
  email: string;
  isAdmin: boolean;
}
