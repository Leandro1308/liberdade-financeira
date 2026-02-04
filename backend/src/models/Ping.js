import mongoose from "mongoose";

const PingSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ping", PingSchema);
