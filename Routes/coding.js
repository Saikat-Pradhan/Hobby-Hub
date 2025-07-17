const { Router } = require("express");
const streamifier = require("streamifier");

const Coding = require("../Models/coding");
const CodingComment = require("../Models/codingComment");
const { cloudinary } = require("../Utils/support");
const uploadFields = require("../Middlewares/fileUpload");

const router = Router();

// 🔧 Helper: Upload buffer to Cloudinary
const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

// 📝 Render coding creation page
router.get("/add", (req, res) => {
  res.render("addCoding", { user: req.user });
});

// 📤 Handle coding submission
router.post("/add", uploadFields, async (req, res) => {
  try {
    const { title, body } = req.body;
    const coverImage = req.files?.coverImage?.[0];
    const codeFile = req.files?.codeFile?.[0];

    // ✅ Validate inputs
    if (!title || !body) {
      return res.status(400).send("Title and body are required.");
    }

    if (!codeFile || codeFile.mimetype !== "application/pdf") {
      return res.status(400).send("Only PDF files are allowed.");
    }

    const pdfBuffer = codeFile.buffer;

    // ✅ Upload PDF to Cloudinary
    const codePDF = await uploadBufferToCloudinary(pdfBuffer, {
      resource_type: "raw",
      folder: "hobbyhub_code_pdfs",
    });

    // ✅ Upload cover image to Cloudinary (if provided)
    let coverImageURL =
      "https://images.ctfassets.net/zykafdb0ssf5/68qzkHjCboFfCsSxV2v9S6/4da75033db02c1339de2a3effb461f7a/missing.png";

    if (coverImage) {
      coverImageURL = await uploadBufferToCloudinary(coverImage.buffer, {
        folder: "hobbyhub_cover_images",
      });
    }

    // ✅ Save to MongoDB
    await Coding.create({
      title,
      body,
      createdBy: req.user._id,
      coverImageURL,
      codeFile: pdfBuffer,
      codePDF,
    });

    res.redirect("/");
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Something went wrong while processing your submission.");
  }
});

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

// 📥 Download PDF file
router.get("/download/:id", async (req, res) => {
  try {
    const coding = await Coding.findById(req.params.id);
    if (!coding || !coding.codeFile) return res.status(404).send("PDF not found");

    const filename = `${coding.title.replace(/\s+/g, "_")}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(coding.codeFile);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send("Could not download PDF file.");
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
    if (!req.body.content) {
      return res.status(400).send("Comment content is required.");
    }

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