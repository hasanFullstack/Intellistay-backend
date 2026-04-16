import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

const ensureCloudinaryConfigured = () => {
  if (isConfigured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Missing Cloudinary configuration. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  isConfigured = true;
};

const isHttpUrl = (value = "") => /^https?:\/\//i.test(String(value).trim());

const isBase64ImageDataUri = (value = "") =>
  /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(String(value).trim());

const uploadDataUriToCloudinary = async (dataUri, folder) => {
  ensureCloudinaryConfigured();

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    overwrite: false,
    unique_filename: true,
  });

  return result.secure_url;
};

export const resolveImageUrls = async (rawImages, folder = "intellistay/general") => {
  if (!Array.isArray(rawImages) || rawImages.length === 0) return [];

  const normalized = rawImages
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (normalized.length === 0) return [];

  const uploaded = await Promise.all(
    normalized.map(async (img) => {
      if (isHttpUrl(img)) return img;
      if (isBase64ImageDataUri(img)) {
        return uploadDataUriToCloudinary(img, folder);
      }
      return null;
    }),
  );

  return uploaded.filter(Boolean);
};
