import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export async function connectMongo() {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000
  });

  logger.info("✅ MongoDB conectado");
}
