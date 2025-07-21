const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Game = require("../Models/gaming");
const GameComment = require("../Models/gamingComment");
const Reaction = require("../Models/gamingReaction");
const { cloudinary } = require("../Utils/cloudinary");
const transporter = require("../Config/mailer");
const mongoose = require("mongoose");

const router = Router();

// Memory storage for uploads
const upload = multer({ storage: multer.memoryStorage() });

// Render game creation form
router.get("/add", (req, res) => {
  res.render("addGaming", { user: req.user });
});

// Handle game submission
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
            { folder: "hobbyhub_game_images" },
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
            { folder: "hobbyhub_game_videos", resource_type: "video" },
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
      await Game.create({
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

// View a game post
router.get("/:id", async (req, res) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(gameId)) throw new Error("Invalid ID");

    const game = await Game.findById(gameId).populate("createdBy");
    if (!game) throw new Error("Game not found");

    const gameComments = await GameComment.find({ gameId }).populate("createdBy");

    const reactions = await Reaction.aggregate([
      { $match: { postType: "game", postId: new mongoose.Types.ObjectId(gameId) } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);

    const reactionCounts = {};
    reactions.forEach(r => {
      reactionCounts[r._id] = r.count;
    });

    res.render("gaming", {
      user: req.user,
      game,
      gameComments,
      reactionCounts
    });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send(err.message || "Game not found.");
  }
});

// Handle reactions to game posts
router.post("/reactions", async (req, res) => {
  const { reactionType, postId, postType } = req.body;
  const userId = req.user._id;
  const reaction = Array.isArray(reactionType) ? reactionType[0] : reactionType;

  const validTypes = ["like", "love", "care", "angry", "sad"];
  const validPostTypes = ["game"];

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

    res.redirect(`/game/${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).send("Server error");
  }
});

// Delete a game post
router.get("/delete/:id", async (req, res) => {
  try {
    await Game.findByIdAndDelete(req.params.id);
    await GameComment.deleteMany({ gameId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// Submit a comment
router.post("/comment/:gameId", async (req, res) => {
  try {
    const commentText = req.body?.content?.trim();
    if (!commentText) return res.status(400).send("Comment cannot be empty.");

    await GameComment.create({
      content: commentText,
      gameId: req.params.gameId,
      createdBy: req.user._id,
    });

    const commenter = await User.findById(req.user._id).select("fullName");
    const gamePost = await Game.findById(req.params.gameId).populate({
      path: "createdBy",
      select: "fullName email",
    });

    if (!commenter || !gamePost?.createdBy?.email) {
      throw new Error("User or game post info missing.");
    }

    const recipientFirstName = gamePost.createdBy.fullName?.split(" ")[0] || "there";
    const commenterName = commenter.fullName;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: gamePost.createdBy.email,
      subject: "💬 New Comment on Your Game Post!",
      text: `
Hey ${recipientFirstName},

${commenterName} commented on your game post:

"${commentText}"

Check it out:
${req.protocol}://${req.get("host")}/game/${req.params.gameId}

Cheers,  
GameHub Team
      `,
    };

    await transporter.sendMail(mailOptions);
    res.redirect(`/game/${req.params.gameId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;