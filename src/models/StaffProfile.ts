import mongoose, { type InferSchemaType } from "mongoose";

const staffProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    livePhotoPath: { type: String, required: false },

    aadharNumberLast4: { type: String, required: false, minlength: 4, maxlength: 4 },
    aadharVerified: { type: Boolean, required: true, default: false },

    additionalDetails: {
      address: { type: String, required: false },
      emergencyContactName: { type: String, required: false },
      emergencyContactPhone: { type: String, required: false },
    },

    professional: {
      qualification: { type: String, required: false },
      experienceSummary: { type: String, required: false },
      cvPath: { type: String, required: false },
      certificates: [
        {
          name: { type: String, required: true },
          filePath: { type: String, required: true },
          uploadedAt: { type: Date, required: true, default: () => new Date() },
        },
      ],
    },
  },
  { timestamps: true },
);

export type StaffProfileDoc = InferSchemaType<typeof staffProfileSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StaffProfileModel =
  mongoose.models.StaffProfile ?? mongoose.model("StaffProfile", staffProfileSchema);
