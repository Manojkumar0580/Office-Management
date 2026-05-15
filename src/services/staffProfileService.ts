import { ApiError } from "../utils/apiError";
import { StaffProfileModel } from "../models/StaffProfile";
import { ProfileChangeRequestModel } from "../models/ProfileChangeRequest";
import { recordStatusChange } from "./statusLogService";
import { saveBase64Image, type Base64ImageInput } from "../utils/base64Image";

export async function getOrCreateProfile(userId: string) {
  const existing = await StaffProfileModel.findOne({ userId });
  if (existing) return existing;
  return await StaffProfileModel.create({ userId });
}

export async function requestProfileUpdate(input: {
  userId: string;
  requestedByUserId: string;
  changes: unknown;
}) {
  // Only allow one pending request at a time per user
  const pending = await ProfileChangeRequestModel.findOne({
    userId: input.userId,
    status: "PENDING",
  });
  if (pending) throw new ApiError(409, "A profile update request is already pending");

  const created = await ProfileChangeRequestModel.create({
    userId: input.userId,
    requestedByUserId: input.requestedByUserId,
    status: "PENDING",
    changes: input.changes,
  });

  await recordStatusChange({
    entityType: "PROFILE_CHANGE_REQUEST",
    entityId: created._id.toString(),
    toStatus: "PENDING",
    changedByUserId: input.requestedByUserId,
    metadata: { userId: input.userId },
  });

  return created;
}

export async function reviewProfileUpdate(input: {
  requestId: string;
  approved: boolean;
  reviewedByUserId: string;
  reason?: string;
}) {
  const req = await ProfileChangeRequestModel.findById(input.requestId);
  if (!req) throw new ApiError(404, "Profile change request not found");
  if (req.status !== "PENDING") throw new ApiError(409, "Request already reviewed");

  const fromStatus = req.status as string;

  if (!input.approved) {
    req.status = "REJECTED";
    req.reason = input.reason;
    req.reviewedByUserId = input.reviewedByUserId;
    req.reviewedAt = new Date();
    await req.save();

    await recordStatusChange({
      entityType: "PROFILE_CHANGE_REQUEST",
      entityId: req._id.toString(),
      fromStatus,
      toStatus: "REJECTED",
      changedByUserId: input.reviewedByUserId,
      note: input.reason,
    });

    return { message: "Profile change request was rejected." };
  }

  // Apply changes (simple merge). We keep this conservative and only allow specific paths in controller validation.
  const profile = await getOrCreateProfile(req.userId.toString());
  const changes = req.changes as Record<string, unknown>;
  profile.set(changes);
  await profile.save();

  req.status = "APPROVED";
  req.reviewedByUserId = input.reviewedByUserId;
  req.reviewedAt = new Date();
  await req.save();

  await recordStatusChange({
    entityType: "PROFILE_CHANGE_REQUEST",
    entityId: req._id.toString(),
    fromStatus,
    toStatus: "APPROVED",
    changedByUserId: input.reviewedByUserId,
  });

  return { message: "Profile change request was approved and applied." };
}

export async function setLivePhoto(userId: string, filePath: string) {
  const profile = await getOrCreateProfile(userId);
  profile.livePhotoPath = filePath;
  await profile.save();
  return profile;
}

export async function setLivePhotoFromBase64(userId: string, image: Base64ImageInput) {
  const saved = saveBase64Image(image);
  return await setLivePhoto(userId, saved.filePath);
}

export async function addCertificate(userId: string, input: { name: string; filePath: string }) {
  const profile = await getOrCreateProfile(userId);
  const existing = profile.professional?.certificates ?? [];
  profile.professional = {
    ...(profile.professional ?? {}),
    certificates: [
      ...existing,
      { name: input.name, filePath: input.filePath, uploadedAt: new Date() },
    ],
  };
  await profile.save();
  return profile;
}

export async function addCertificateFromBase64(
  userId: string,
  input: { name: string; image: Base64ImageInput },
) {
  const saved = saveBase64Image(input.image);
  return await addCertificate(userId, { name: input.name, filePath: saved.filePath });
}

export async function setCV(userId: string, filePath: string) {
  const profile = await getOrCreateProfile(userId);
  profile.professional = {
    ...(profile.professional ?? {}),
    cvPath: filePath,
  };
  await profile.save();
  return profile;
}

export async function setCVFromBase64(userId: string, image: Base64ImageInput) {
  const saved = saveBase64Image(image);
  return await setCV(userId, saved.filePath);
}
