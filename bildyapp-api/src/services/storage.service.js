import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { config } from '../config/index.js';

// Cloudinary reads CLOUDINARY_URL env var automatically.
// Only configure explicitly if the env var is not set (e.g. tests with a mock).
if (config.storage.cloudinaryUrl && !process.env.CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: config.storage.cloudinaryUrl });
}

const optimizeImage = async (buffer) => {
  return sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
};

/**
 * Uploads a buffer to Cloudinary.
 * Images are resized to max 800 px and converted to WebP before upload.
 * PDFs are uploaded as raw files.
 *
 * @param {Buffer} buffer
 * @param {string} publicId  Cloudinary public_id (path without extension)
 * @param {string} mimetype  MIME type of the original file
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export const uploadBuffer = async (buffer, publicId, mimetype) => {
  const isPdf = mimetype === 'application/pdf';
  const uploadData = isPdf ? buffer : await optimizeImage(buffer);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: isPdf ? 'raw' : 'image',
        format: isPdf ? undefined : 'webp',
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(uploadData);
  });
};
