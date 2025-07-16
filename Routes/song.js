const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Song = require("../Models/song");
const SongComment = require("../Models/songComment");

const router = Router();

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve("./Public/Uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// Render add-song page
router.get("/add", (req, res) => {
  res.render("addSong", {
    user: req.user,
  });
});

// Handle song creation
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

      const song = await Song.create({
        title,
        body,
        createdBy: req.user._id,
        coverImageURL: coverImage
          ? `/Uploads/${coverImage.filename}`
          : `/Uploads/default.jpg`,
        videoFile: videoFile ? `/Uploads/${videoFile.filename}` : null,
      });

      res.redirect("/");
    } catch (err) {
      console.error("Song upload error:", err);
      res.status(500).send("Something went wrong while uploading the song.");
    }
  }
);

// View song by ID
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

// Delete song entry
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

// Add comment
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