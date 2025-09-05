"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = __importStar(require("mongoose"));
const validator_1 = __importDefault(require("validator"));
const env_1 = require("../config/env");
const SALT_ROUNDS = env_1.ENV.BCRYPT_SALT_ROUNDS;
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (v) => validator_1.default.isEmail(v),
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
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform(_doc, ret) {
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
        transform(_doc, ret) {
            delete ret.password;
            delete ret.avatarPublicId;
            delete ret.tokenVersion;
            delete ret.passwordUpdatedAt;
            return ret;
        },
    },
});
// --- Virtual id (nicer for clients) ---
UserSchema.virtual("id").get(function () {
    return this._id.toString();
});
// --- Indexes ---
UserSchema.index({ email: 1 }, { unique: true });
// --- Hash on save ---
UserSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!this.isModified("password"))
            return next();
        const salt = yield bcrypt_1.default.genSalt(SALT_ROUNDS);
        // @ts-ignore
        this.password = yield bcrypt_1.default.hash(this.password, salt);
        // track rotation for token invalidation
        // @ts-ignore
        this.passwordUpdatedAt = new Date();
        // @ts-ignore
        this.tokenVersion = ((_a = this.tokenVersion) !== null && _a !== void 0 ? _a : 0) + 1;
        next();
    });
});
// --- (Defence-in-depth) Hash if password is changed via findOneAndUpdate ---
// Prefer using .save() flow, but this prevents accidents.
UserSchema.pre("findOneAndUpdate", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const update = this.getUpdate() || {};
        const nextPwd = (_c = (_a = update.password) !== null && _a !== void 0 ? _a : (_b = update.$set) === null || _b === void 0 ? void 0 : _b.password) !== null && _c !== void 0 ? _c : (update.$setOnInsert && update.$setOnInsert.password);
        if (!nextPwd)
            return next();
        const salt = yield bcrypt_1.default.genSalt(SALT_ROUNDS);
        const hashed = yield bcrypt_1.default.hash(nextPwd, salt);
        if (update.password)
            update.password = hashed;
        if ((_d = update.$set) === null || _d === void 0 ? void 0 : _d.password)
            update.$set.password = hashed;
        if ((_e = update.$setOnInsert) === null || _e === void 0 ? void 0 : _e.password)
            update.$setOnInsert.password = hashed;
        // bump token version & timestamp too
        update.$set = Object.assign(Object.assign({}, (update.$set || {})), { tokenVersion: (((_g = (_f = update.$set) === null || _f === void 0 ? void 0 : _f.tokenVersion) !== null && _g !== void 0 ? _g : 0) + 1), passwordUpdatedAt: new Date() });
        next();
    });
});
// --- Methods ---
UserSchema.methods.comparePassword = function (candidate) {
    return __awaiter(this, void 0, void 0, function* () {
        return bcrypt_1.default.compare(candidate, this.password);
    });
};
exports.User = mongoose_1.default.models.User || mongoose_1.default.model("User", UserSchema);
exports.default = exports.User;
