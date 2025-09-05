import { Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  avatarUrl: string;
  avatarPublicId: string;
  password: string;
  isAdmin: boolean;
  role: "user" | "admin";
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  tokenVersion: number;
  passwordUpdatedAt: Date;

  // instance methods
  comparePassword(candidate: string): Promise<boolean>;
}
