const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Dance = require("../Models/dance");
const DanceComment = require("../Models/danceComment");

const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve("./Public/Uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.get("/add", (req, res) => {
  res.render("addDance", {
    user: req.user,
  });
});

router.post("/add", upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'videoFile', maxCount: 1 }
]), async (req, res) => {
  const { title, body } = req.body;

  const coverImage = req.files['coverImage'][0];
  const videoFile = req.files['videoFile'][0];

  const dance = await Dance.create({
    title,
    body,
    createdBy: req.user._id,
    coverImageURL: `/uploads/${coverImage.filename}`,
    videoFile: `/uploads/${videoFile.filename}`,
  });

  res.redirect("/");
});

router.get("/:id", async (req, res) => {
  const dance = await Dance.findById(req.params.id).populate("createdBy");
  const danceComments = await DanceComment.find({ danceId: req.params.id }).populate("createdBy");

  res.render("dance", {
    user: req.user,
    dance,
    danceComments,
  });
});

router.post("/comment/:danceId", async (req, res) => {
  await DanceComment.create({
    content: req.body.content,
    danceId: req.params.danceId,
    createdBy: req.user._id,
  });

  res.redirect(`/dance/${req.params.danceId}`);
});

module.exports = router;