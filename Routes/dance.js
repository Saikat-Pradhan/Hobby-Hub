const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Dance = require("../Models/dance");
const DanceComment = require("../Models/danceComment");

const router = Router();

// 📁 Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve("./Public/Uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

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

      const dance = await Dance.create({
        title,
        body,
        createdBy: req.user._id,
        coverImageURL: coverImage
          ? `/Uploads/${coverImage.filename}`
          : `/Uploads/default.jpg`,
        videoFile: videoFile
          ? `/uploads/${videoFile.filename}`
          : null,
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