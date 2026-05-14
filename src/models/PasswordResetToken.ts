import mongoose, { type InferSchemaType } from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** SHA-256 of server pepper + userId + email + OTP (OTP never stored plain). */
    otpHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    /** Wrong OTP submissions; after max, record is deleted. */
    attempts: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PasswordResetTokenModel =
  mongoose.models.PasswordResetToken ??
  mongoose.model("PasswordResetToken", passwordResetTokenSchema);
