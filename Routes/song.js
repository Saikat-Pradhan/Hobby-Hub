const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");

const Song = require("../Models/song");
const SongComment = require("../Models/songComment");
const { cloudinary } = require("../Utils/cloudinary");

const router = Router();

// 🔧 Memory storage for uploads
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// 🎵 Render add-song page
router.get("/add", (req, res) => {
  res.render("addSong", {
    user: req.user,
  });
});

// 📤 Handle song creation
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
            { folder: "hobbyhub_song_images" },
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
            { folder: "hobbyhub_song_videos", resource_type: "video" },
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
      await Song.create({
        title,
        body,
        createdBy: req.user._id,
        coverImageURL,
        videoFile: videoFileURL,
      });

      res.redirect("/");
    } catch (err) {
      console.error("Song upload error:", err);
      res.status(500).send("Something went wrong while uploading the song.");
    }
  }
);

// 🎧 View song by ID
router.get("/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).populate("createdBy");
    const songComments = await SongComment.find({ songId: req.params.id }).populate("createdBy");

    res.render("song", {
      user: req.user,
      song,
      songComments,
    });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Song not found.");
  }
});

// 🗑️ Delete song entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Song.findByIdAndDelete(req.params.id);
    await SongComment.deleteMany({ songId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Add comment
router.post("/comment/:songId", async (req, res) => {
  try {
    await SongComment.create({
      content: req.body.content,
      songId: req.params.songId,
      createdBy: req.user._id,
    });
    res.redirect(`/song/${req.params.songId}`);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).send("Failed to add comment.");
  }
});

module.exports = router;