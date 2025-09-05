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
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = uploadImage;
const cloudinary_1 = require("../config/cloudinary");
function baseName(filename) {
    const i = filename.lastIndexOf(".");
    return (i >= 0 ? filename.slice(0, i) : filename).replace(/[^\w\-]+/g, "-").toLowerCase();
}
function uploadImage(buffer_1, filename_1) {
    return __awaiter(this, arguments, void 0, function* (buffer, filename, opts = {}) {
        const { folder = "posts", publicIdBase } = opts;
        const base = (publicIdBase !== null && publicIdBase !== void 0 ? publicIdBase : baseName(filename)).slice(0, 100);
        const public_id = `${base}-${Date.now()}`;
        return new Promise((resolve, reject) => {
            const stream = cloudinary_1.cloudinary.uploader.upload_stream({ folder, public_id, resource_type: "image" }, (err, res) => {
                if (err)
                    return reject(err);
                if (err || !(res === null || res === void 0 ? void 0 : res.secure_url) || !res.public_id)
                    return reject(err || new Error("Upload failed"));
                resolve({ url: res.secure_url, publicId: res.public_id });
            });
            stream.end(buffer);
        });
    });
}
