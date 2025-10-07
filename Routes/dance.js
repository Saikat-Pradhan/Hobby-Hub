const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Dance = require("../Models/dance");
const DanceComment = require("../Models/danceComment");
const DanceReactions = require("../Models/danceReaction");
const { cloudinary } = require("../Utils/cloudinary");
const transporter = require("../Config/mailer");
const Reaction = require("../Models/danceReaction");
const mongoose = require("mongoose");

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
    const danceId = req.params.id;

    // 🔒 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(danceId)) {
      throw new Error("Invalid dance ID");
    }

    // Fetch dance post and creator
    const dance = await Dance.findById(danceId).populate("createdBy");
    if (!dance) throw new Error("Dance post not found");

    // Fetch comments
    const danceComments = await DanceComment.find({ danceId }).populate("createdBy");

    // Aggregate reaction counts
    const reactions = await Reaction.aggregate([
      {
        $match: {
          postType: "dance",
          postId: new mongoose.Types.ObjectId(danceId)
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

    // Render view
    res.render("dance", {
      user: req.user,
      dance,
      danceComments,
      reactionCounts
    });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send(err.message || "Dance post not found.");
  }
});

// 💃 Handle reactions to dance posts
router.post("/reactions", async (req, res) => {
  const { reactionType, postId, postType } = req.body;
  const userId = req.user._id;
  const reaction = Array.isArray(reactionType) ? reactionType[0] : reactionType;

  const validTypes = ["like", "love", "care", "angry", "sad"];
  const validPostTypes = ["dance"];

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

    res.redirect(`/dance/${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).send("Server error");
  }
});

// 🗑️ Delete a dance post
router.get("/delete/:id", async (req, res) => {
  try {
    await Dance.findByIdAndDelete(req.params.id);
    await DanceComment.deleteMany({ danceId: req.params.id });
    await DanceReactions.deleteMany({ postId: req.params.id });

    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment
router.post("/comment/:danceId", async (req, res) => {
  try {
    const commentText = req.body?.content?.trim();
    if (!commentText) {
      return res.status(400).send("Comment cannot be empty.");
    }

    // Create the comment
    await DanceComment.create({
      content: commentText,
      danceId: req.params.danceId,
      createdBy: req.user._id,
    });

    // Redirect after comment
    res.redirect(`/dance/${req.params.danceId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;