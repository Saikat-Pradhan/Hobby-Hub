const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
require("dotenv").config();

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Create Cloudinary storage engine
const cloudStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "hobbyhub_uploads",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

module.exports = { cloudinary, cloudStorage };