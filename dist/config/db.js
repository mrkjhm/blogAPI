"use strict";
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
exports.default = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
function connectDB() {
    return __awaiter(this, void 0, void 0, function* () {
        const uri = env_1.ENV.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI is missing in environment");
        }
        yield mongoose_1.default.connect(uri, {
        // You can add options here if needed
        });
        mongoose_1.default.connection.on("connected", () => {
            console.log("MongoDB connected");
        });
        mongoose_1.default.connection.on("error", (err) => {
            console.error("MongoDB connection error:", err);
        });
    });
}
