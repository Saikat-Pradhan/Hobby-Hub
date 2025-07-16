const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const Photo = require("../Models/photo");
const PhotoComment = require("../Models/photoComment");

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve("./Public/Uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

router.get("/add", (req, res) => {
  res.render("addPhoto", {
    user: req.user,
  });
});

router.post("/add", upload.single("coverImage"), async (req, res) => {
  const { title, body } = req.body;

  const photo = await Photo.create({
    title,
    body,
    createdBy: req.user._id,
    coverImageURL: `/Uploads/${req.file.filename}`,
  });

  res.redirect("/");
});

router.get("/:id", async (req, res) => {
  const photo = await Photo.findById(req.params.id).populate("createdBy");
  const photoComments = await PhotoComment.find({ photoId: req.params.id }).populate("createdBy");

  res.render("photo", {
    user: req.user,
    photo,
    photoComments,
  });
});

// Delete coding entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Photo.findByIdAndDelete(req.params.id);
    await PhotoComment.deleteMany({ photoId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Entry not found.");
  }
});

router.post("/photoComment/:photoId", async (req, res) => {
  await PhotoComment.create({
    content: req.body.content,
    photoId: req.params.photoId,
    createdBy: req.user._id,
  });

  res.redirect(`/photo/${req.params.photoId}`);
});

module.exports = router;