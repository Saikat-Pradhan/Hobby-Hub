const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Photo = require("../Models/photo");
const PhotoComment = require("../Models/photoComment");
const PhotoReactions = require("../Models/photoReaction");
const { cloudinary } = require("../Utils/cloudinary");
const transporter = require("../Config/mailer");
const Reaction = require("../Models/photoReaction");
const mongoose = require("mongoose");

const router = Router();

// 🔧 Memory storage for cover image
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// 📸 Render photo creation form
router.get("/add", (req, res) => {
  res.render("addPhoto", {
    user: req.user,
  });
});

// 📤 Handle photo submission
router.post("/add", upload.single("coverImage"), async (req, res) => {
  try {
    const { title, body } = req.body;
    const coverImage = req.file;

    let coverImageURL = "https://res.cloudinary.com/your_cloud_name/image/upload/v1234567890/default.jpg";

    // 📤 Upload cover image to Cloudinary
    if (coverImage) {
      const imageUpload = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "hobbyhub_photos" },
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
    await Photo.create({
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

// 📷 View a photo post with reactions
router.get("/:id", async (req, res) => {
  try {
    const photoId = req.params.id;

    // 🔒 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      throw new Error("Invalid photo ID");
    }

    // Fetch photo and creator
    const photo = await Photo.findById(photoId).populate("createdBy");
    if (!photo) throw new Error("Photo not found");

    // Fetch comments
    const photoComments = await PhotoComment.find({ photoId }).populate("createdBy");

    // Aggregate reactions
    const reactions = await Reaction.aggregate([
      {
        $match: {
          postType: "photo",
          postId: new mongoose.Types.ObjectId(photoId)
        }
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    const reactionCounts = {};
    reactions.forEach(r => {
      reactionCounts[r._id] = r.count;
    });

    // Render EJS view
    res.render("photo", {
      user: req.user,
      photo,
      photoComments,
      reactionCounts
    });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send(err.message || "Photo not found.");
  }
});

// ❤️ Add reactions to photo post
router.post("/reactions", async (req, res) => {
  const { reactionType, postId, postType } = req.body;
  const userId = req.user._id;
  const reaction = Array.isArray(reactionType) ? reactionType[0] : reactionType;

  const validTypes = ["like", "love", "care", "angry", "sad"];
  const validPostTypes = ["photo"];

  if (!validTypes.includes(reaction) || !validPostTypes.includes(postType)) {
    return res.status(400).send("Invalid reaction or post type");
  }

  try {
    const existing = await Reaction.findOne({ userId, postId, postType });

    if (existing) {
      if (existing.type === reaction) {
        await existing.deleteOne(); // Toggle off
      } else {
        existing.type = reaction;   // Switch type
        await existing.save();
      }
    } else {
      await Reaction.create({ type: reaction, postType, postId, userId });
    }

    res.redirect(`/photo/${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).send("Server error");
  }
});

// 🗑️ Delete a photo post
router.get("/delete/:id", async (req, res) => {
  try {
    await Photo.findByIdAndDelete(req.params.id);
    await PhotoComment.deleteMany({ photoId: req.params.id });
    await PhotoReactions.deleteMany({ postId: req.params.id });

    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment
router.post("/photoComment/:photoId", async (req, res) => {
  try {
    const commentText = req.body?.content?.trim();
    if (!commentText) {
      return res.status(400).send("Comment cannot be empty.");
    }

    // Create the comment
    await PhotoComment.create({
      content: commentText,
      photoId: req.params.photoId,
      createdBy: req.user._id,
    });

    // Redirect to photo post
    res.redirect(`/photo/${req.params.photoId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;