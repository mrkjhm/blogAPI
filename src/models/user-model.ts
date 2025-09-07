import bcrypt from "bcrypt";
import mongoose, { Model, Schema } from "mongoose";
import validator from "validator";
import { ENV } from "../config/env";
import { IUser } from "../types/user";

const SALT_ROUNDS = ENV.BCRYPT_SALT_ROUNDS;

const UserSchema: Schema<IUser & {
  comparePassword(candidate: string): Promise<boolean>;
}> = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => validator.isEmail(v),
        message: "Invalid email",
      },
    },

    avatarUrl: { type: String, required: true, trim: true },
    avatarPublicId: { type: String, required: true, trim: true, select: false },

    password: { type: String, required: true, minlength: 8, select: false },

    isAdmin: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    emailVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },

    tokenVersion: { type: Number, default: 0, select: false },
    passwordUpdatedAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc: unknown, ret: Record<string, any>) {
        // Never leak sensitive internals
        delete ret.password;
        delete ret.avatarPublicId;
        delete ret.tokenVersion;
        delete ret.passwordUpdatedAt;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc: unknown, ret: Record<string, any>) {
        delete ret.password;
        delete ret.avatarPublicId;
        delete ret.tokenVersion;
        delete ret.passwordUpdatedAt;
        return ret;
      },
    },
  }
);


UserSchema.virtual("id").get(function (this: any) {
  return this._id.toString();
});


UserSchema.pre("save", async function (this: IUser, next: () => void) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordUpdatedAt = new Date();
  this.tokenVersion = (this.tokenVersion ?? 0) + 1;
  next();
});


UserSchema.pre("findOneAndUpdate", async function (next) {
  const update: any = this.getUpdate() as Record<string, any> || {};
  const nextPwd =
    update.password ??
    update.$set?.password ??
    update.$setOnInsert?.password;

  if (!nextPwd) return next();

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashed = await bcrypt.hash(nextPwd, salt);

  if (update.password) update.password = hashed;
  if (update.$set?.password) update.$set.password = hashed;
  if (update.$setOnInsert?.password) update.$setOnInsert.password = hashed;


  update.$set = {
    ...(update.$set || {}),
    tokenVersion: ((update.$set?.tokenVersion ?? 0) + 1),
    passwordUpdatedAt: new Date(),
  };

  next();
});

// --- Methods ---
UserSchema.methods.comparePassword = async function (
  this: IUser, candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;