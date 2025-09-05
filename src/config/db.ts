import mongoose from "mongoose";
import { ENV } from "./env";

export default async function connectDB(): Promise<void> {
  const uri = ENV.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment");
  }

  await mongoose.connect(uri, {
    // You can add options here if needed
  });

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });
}
