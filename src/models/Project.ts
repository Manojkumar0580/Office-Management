import mongoose, { type InferSchemaType } from "mongoose";

export type ProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

const projectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: false },
    clientName: { type: String, required: false, trim: true },

    status: {
      type: String,
      required: true,
      enum: ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] satisfies ProjectStatus[],
      default: "PLANNED",
      index: true,
    },

    budget: { type: Number, required: false, min: 0 },
    revenue: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, required: true, default: "INR", trim: true },

    startDate: { type: Date, required: false, index: true },
    endDate: { type: Date, required: false, index: true },

    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: false, index: true },
    /** Project lead — TL or CAPTAIN responsible for delivery & progress updates. */
    tlUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    managerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    /** Staff actively working on this project. */
    memberUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    workProgress: {
      percent: { type: Number, required: true, default: 0, min: 0, max: 100 },
      note: { type: String, required: false },
      updatedAt: { type: Date, required: false },
      updatedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
      },
    },

    isActive: { type: Boolean, required: true, default: true, index: true },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

export type ProjectDoc = InferSchemaType<typeof projectSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProjectModel = mongoose.models.Project ?? mongoose.model("Project", projectSchema);
