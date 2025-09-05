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
exports.requireSelfOrAdmin = exports.requireAdmin = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const user_model_1 = __importDefault(require("../models/user-model"));
// Single source of truth: read Bearer and verify { sub, tv }
const requireAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) {
            res.status(401).json({ message: "No token" });
            return;
        }
        const payload = jsonwebtoken_1.default.verify(token, env_1.ENV.ACCESS_TOKEN_SECRET);
        const u = yield user_model_1.default.findById(payload.sub).select("+tokenVersion");
        if (!u || u.tokenVersion !== payload.tv) {
            res.status(401).json({ message: "Session expired" });
            return;
        }
        // attach normalized user info
        req.user = { id: u.id, email: u.email, isAdmin: u.isAdmin, tv: u.tokenVersion };
        next();
    }
    catch (e) {
        const msg = e.name === "TokenExpiredError" ? "Access token expired" : "Unauthorized";
        res.status(401).json({ message: msg });
    }
});
exports.requireAuth = requireAuth;
const requireAdmin = (req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isAdmin)
        return next();
    res.status(403).json({ message: "Forbidden" });
};
exports.requireAdmin = requireAdmin;
// Owner-or-admin guard (useful for PUT /users/:id/...)
const requireSelfOrAdmin = (paramKey = "id") => (req, res, next) => {
    const me = req.user;
    const targetId = req.params[paramKey];
    if (!me)
        return res.status(401).json({ message: "Unauthorized" });
    if (me.isAdmin || me.id === targetId)
        return next();
    return res.status(403).json({ message: "Forbidden: only owner or admin" });
};
exports.requireSelfOrAdmin = requireSelfOrAdmin;
