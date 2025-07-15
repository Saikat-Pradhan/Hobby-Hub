const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Song = require("../Models/song");
const SongComment = require("../Models/songComment");

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve("./Public/Uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

router.get("/add", (req, res) => {
  res.render("addSong", {
    user: req.user,
  });
});

router.post("/add", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "videoFile", maxCount: 1 }
]), async (req, res) => {
  const { title, body } = req.body;

  const coverImage = req.files["coverImage"][0];
  const videoFile = req.files["videoFile"][0];

  const song = await Song.create({
    title,
    body,
    createdBy: req.user._id,
    coverImageURL: `/uploads/${coverImage.filename}`,
    videoFile: `/uploads/${videoFile.filename}`,
  });

  res.redirect("/");
});

router.get("/:id", async (req, res) => {
  const song = await Song.findById(req.params.id).populate("createdBy");
  const songComments = await SongComment.find({ songId: req.params.id }).populate("createdBy");

  res.render("song", {
    user: req.user,
    song,
    songComments,
  });
});

router.post("/comment/:songId", async (req, res) => {
  await SongComment.create({
    content: req.body.content,
    songId: req.params.songId,
    createdBy: req.user._id,
  });

  res.redirect(`/song/${req.params.songId}`);
});

module.exports = router;