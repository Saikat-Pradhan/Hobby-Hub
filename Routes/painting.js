const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Painting = require("../Models/painting");
const PaintingComment = require("../Models/paintingComment");

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve("./Public/Uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

router.get("/add", (req, res) => {
  res.render("addPainting", {
    user: req.user,
  });
});

router.post("/add", upload.single("coverImage"), async (req, res) => {
  const { title, body } = req.body;

  const painting = await Painting.create({
    title,
    body,
    createdBy: req.user._id,
    coverImageURL: `/uploads/${req.file.filename}`,
  });

  res.redirect("/");
});

router.get("/:id", async (req, res) => {
  const painting = await Painting.findById(req.params.id).populate("createdBy");
  const paintingComments = await PaintingComment.find({ paintingId: req.params.id }).populate("createdBy");

  res.render("painting", {
    user: req.user,
    painting,
    paintingComments,
  });
});

// Delete coding entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Painting.findByIdAndDelete(req.params.id).populate("createdBy");

    res.redirect("/user/profile");
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Entry not found.");
  }
});

router.post("/comment/:paintingId", async (req, res) => {
  await PaintingComment.create({
    content: req.body.content,
    paintingId: req.params.paintingId,
    createdBy: req.user._id,
  });

  res.redirect(`/painting/${req.params.paintingId}`);
});

module.exports = router;