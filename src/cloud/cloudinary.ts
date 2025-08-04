import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handleUpload = async (file: any) => {
  const res = await cloudinary.uploader.upload(file, {
    resource_type: 'image',
    folder: 'reccomendations',
  });
  return res;
};

export const handleDeleteImage = async (imageId: string) => {
  await cloudinary.uploader.destroy(imageId);
};
