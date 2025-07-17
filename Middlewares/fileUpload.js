const multer = require("multer");

// ✅ Memory storage for PDF file
const memoryStorage = multer.memoryStorage();

// ✅ Multer instance with strict PDF-only filter
const uploadFields = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    const allowedFields = ["codeFile", "coverImage"];
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedFields.includes(file.fieldname)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.originalname}`));
    }

    cb(null, true);
  },
}).fields([
  { name: "codeFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

module.exports = uploadFields;