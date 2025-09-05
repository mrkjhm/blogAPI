// utils/upload-image.ts
import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import { cloudinary } from "../config/cloudinary";

type Opts = { folder?: string; publicIdBase?: string };

function baseName(filename: string) {
  const i = filename.lastIndexOf(".");
  return (i >= 0 ? filename.slice(0, i) : filename).replace(/[^\w\-]+/g, "-").toLowerCase();
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  opts: Opts = {}
): Promise<{ url: string, publicId: string }> {
  const { folder = "posts", publicIdBase } = opts;
  const base = (publicIdBase ?? baseName(filename)).slice(0, 100);
  const public_id = `${base}-${Date.now()}`;

  return new Promise<{ url: string, publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id, resource_type: "image" },
      (err?: UploadApiErrorResponse, res?: UploadApiResponse) => {
        if (err) return reject(err);
        if (err || !res?.secure_url || !res.public_id) return reject(err || new Error("Upload failed"));
        resolve({ url: res.secure_url, publicId: res.public_id });
      }
    );
    stream.end(buffer);
  });
}
