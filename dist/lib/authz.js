"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canModify = canModify;
function canModify(req, ownerId) {
    var _a, _b;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isAdmin)
        return true;
    return String(ownerId) === ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
}
