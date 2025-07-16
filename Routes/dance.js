const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");

const Dance = require("../Models/dance");
const DanceComment = require("../Models/danceComment");
const { cloudinary } = require("../Utils/cloudinary");

const router = Router();

// 🔧 Memory storage for uploads
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// 🎭 Render dance creation form
router.get("/add", (req, res) => {
  res.render("addDance", {
    user: req.user,
  });
});

// 📤 Handle dance submission
router.post(
  "/add",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "videoFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, body } = req.body;
      const coverImage = req.files?.["coverImage"]?.[0];
      const videoFile = req.files?.["videoFile"]?.[0];

      // 🖼️ Default image fallback
      let coverImageURL = "https://images.ctfassets.net/zykafdb0ssf5/68qzkHjCboFfCsSxV2v9S6/4da75033db02c1339de2a3effb461f7a/missing.png";
      let videoFileURL = null;

      // 📤 Upload cover image to Cloudinary
      if (coverImage) {
        const imageUpload = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "hobbyhub_dance_images" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(coverImage.buffer).pipe(stream);
        });
        coverImageURL = imageUpload.secure_url;
      }

      // 📤 Upload video to Cloudinary
      if (videoFile) {
        const videoUpload = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "hobbyhub_dance_videos", resource_type: "video" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(videoFile.buffer).pipe(stream);
        });
        videoFileURL = videoUpload.secure_url;
      }

      // 🧾 Save to MongoDB
      await Dance.create({
        title,
        body,
        createdBy: req.user._id,
        coverImageURL,
        videoFile: videoFileURL,
      });

      res.redirect("/");
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).send("Something went wrong during upload.");
    }
  }
);

// 🕺 View a dance post
router.get("/:id", async (req, res) => {
  try {
    const dance = await Dance.findById(req.params.id).populate("createdBy");
    const danceComments = await DanceComment.find({ danceId: req.params.id }).populate("createdBy");

    res.render("dance", {
      user: req.user,
      dance,
      danceComments,
    });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Dance post not found.");
  }
});

// 🗑️ Delete a dance post
router.get("/delete/:id", async (req, res) => {
  try {
    await Dance.findByIdAndDelete(req.params.id);
    await DanceComment.deleteMany({ danceId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment
router.post("/comment/:danceId", async (req, res) => {
  try {
    await DanceComment.create({
      content: req.body.content,
      danceId: req.params.danceId,
      createdBy: req.user._id,
    });

    res.redirect(`/dance/${req.params.danceId}`);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;