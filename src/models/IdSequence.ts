import mongoose, { type InferSchemaType } from "mongoose";

export type SequenceKey =
  | "EMPLOYEE"
  | "TRAINEE"
  | "ADMIN"
  | "HR"
  | "MANAGER"
  | "TL"
  | "CASHIER"
  | "CAPTAIN"
  | "ACCOUNTANT";

const idSequenceSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "EMPLOYEE",
        "TRAINEE",
        "ADMIN",
        "HR",
        "MANAGER",
        "TL",
        "CASHIER",
        "CAPTAIN",
        "ACCOUNTANT",
      ] satisfies SequenceKey[],
    },
    nextValue: { type: Number, required: true, default: 1, min: 1 },
  },
  { timestamps: true },
);

export type IdSequenceDoc = InferSchemaType<typeof idSequenceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const IdSequenceModel =
  mongoose.models.IdSequence ?? mongoose.model("IdSequence", idSequenceSchema);
