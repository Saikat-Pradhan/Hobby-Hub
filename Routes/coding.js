const { Router } = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const streamifier = require("streamifier");

const Coding = require("../Models/coding");
const CodingComment = require("../Models/codingComment");
const { cloudinary, upload: imageUpload } = require("../Utils/cloudinary"); // ✅ renamed to avoid conflict

const router = Router();

// 🔧 Memory storage for code file
const memoryStorage = multer.memoryStorage();
const codeUpload = multer({ storage: memoryStorage });

// 📝 Render coding creation page
router.get("/add", (req, res) => {
  res.render("addCoding", { user: req.user });
});

// 📤 Handle coding submission
router.post(
  "/add",
  imageUpload.single("coverImage"), // ✅ Cloudinary image upload
  codeUpload.single("codeFile"),    // ✅ Local memory upload for code file
  async (req, res) => {
    try {
      const { title, body } = req.body;
      const coverImage = req.file; // This will be the image file from Cloudinary

      const codeFile = req.files?.codeFile || req.file;

      if (!codeFile || !codeFile.buffer) {
        return res.status(400).send("Code file is required.");
      }

      const codeText = codeFile.buffer.toString("utf8");

      // 📄 Generate PDF in memory
      const doc = new PDFDocument();
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);

        // 📤 Upload PDF to Cloudinary
        const cloudinaryStream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "hobbyhub_code_pdfs" },
          async (error, result) => {
            if (error) {
              console.error("Cloudinary PDF upload error:", error);
              return res.status(500).send("PDF upload failed.");
            }

            // ✅ Save entry to MongoDB
            await Coding.create({
              title,
              body,
              createdBy: req.user._id,
              coverImageURL: coverImage?.path || "https://images.ctfassets.net/zykafdb0ssf5/68qzkHjCboFfCsSxV2v9S6/4da75033db02c1339de2a3effb461f7a/missing.png",
              codeFile: codeText,
              codePDF: result.secure_url,
            });

            res.redirect("/");
          }
        );

        streamifier.createReadStream(pdfBuffer).pipe(cloudinaryStream);
      });

      doc.fontSize(18).text(title, { align: "center" }).moveDown();
      doc.fontSize(12).text(body, { align: "left" }).moveDown();
      doc.fontSize(10).text(codeText, { lineGap: 4 });
      doc.end();
    } catch (err) {
      console.error("Upload/PDF error:", err);
      res.status(500).send("Something went wrong while processing your submission.");
    }
  }
);

// 📂 View coding entry
router.get("/:id", async (req, res) => {
  try {
    const coding = await Coding.findById(req.params.id).populate("createdBy");
    const codingComments = await CodingComment.find({ codingId: req.params.id }).populate("createdBy");

    res.render("coding", { user: req.user, coding, codingComments });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 🗑️ Delete coding entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Coding.findByIdAndDelete(req.params.id);
    await CodingComment.deleteMany({ codingId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit comment
router.post("/codingComment/:codingId", async (req, res) => {
  try {
    await CodingComment.create({
      content: req.body.content,
      codingId: req.params.codingId,
      createdBy: req.user._id,
    });
    res.redirect(`/code/${req.params.codingId}`);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).send("Could not post your comment.");
  }
});

module.exports = router;