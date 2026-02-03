import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  plan: { type: String, default: "mensal" },
  status: validatedEnum(["inactive", "active", "past_due", "canceled"], "inactive"),
  renovacaoAutomatica: { type: Boolean, default: true },
  currentPeriodEnd: { type: Date, default: null }
}, { _id: false });

function validatedEnum(values, def) {
  return { type: String, enum: values, default: def };
}

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true, minlength: 2, maxlength: 80, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true },
  passwordHash: { type: String, required: true },

  affiliateCode: { type: String, unique: true, required: true },
  referrerCode: { type: String, default: null },

  subscription: { type: SubscriptionSchema, default: () => ({}) },

  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model("User", UserSchema);
