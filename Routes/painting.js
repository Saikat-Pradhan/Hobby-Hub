const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");

const Painting = require("../Models/painting");
const PaintingComment = require("../Models/paintingComment");
const { cloudinary } = require("../Utils/cloudinary");

const router = Router();

// 🔧 Memory storage for cover image
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// 🎨 Render painting creation form
router.get("/add", (req, res) => {
  res.render("addPainting", {
    user: req.user,
  });
});

// 📤 Handle painting submission
router.post("/add", upload.single("coverImage"), async (req, res) => {
  try {
    const { title, body } = req.body;
    const coverImage = req.file;

    let coverImageURL = "https://res.cloudinary.com/your_cloud_name/image/upload/v1234567890/default.jpg";

    // 📤 Upload cover image to Cloudinary
    if (coverImage) {
      const imageUpload = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "hobbyhub_paintings" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(coverImage.buffer).pipe(stream);
      });
      coverImageURL = imageUpload.secure_url;
    }

    // 🧾 Save to MongoDB
    await Painting.create({
      title,
      body,
      createdBy: req.user._id,
      coverImageURL,
    });

    res.redirect("/");
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Something went wrong during upload.");
  }
});

// 🖼️ View a painting post
router.get("/:id", async (req, res) => {
  try {
    const painting = await Painting.findById(req.params.id).populate("createdBy");
    const paintingComments = await PaintingComment.find({ paintingId: req.params.id }).populate("createdBy");

    res.render("painting", {
      user: req.user,
      painting,
      paintingComments,
    });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 🗑️ Delete a painting post
router.get("/delete/:id", async (req, res) => {
  try {
    await Painting.findByIdAndDelete(req.params.id);
    await PaintingComment.deleteMany({ paintingId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment
router.post("/comment/:paintingId", async (req, res) => {
  try {
    await PaintingComment.create({
      content: req.body.content,
      paintingId: req.params.paintingId,
      createdBy: req.user._id,
    });

    res.redirect(`/painting/${req.params.paintingId}`);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;