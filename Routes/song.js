const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Song = require("../Models/song");
const SongComment = require("../Models/songComment");
const SongReactions = require("../Models/photoReaction");
const transporter = require("../Config/mailer");
const { cloudinary } = require("../Utils/cloudinary");
const Reaction = require("../Models/songReaction");
const mongoose = require("mongoose");

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

// View song by ID
router.get("/:id", async (req, res) => {
  try {
    const songId = req.params.id;

    // 🔒 Validate ObjectId before using in aggregation
    if (!mongoose.Types.ObjectId.isValid(songId)) {
      throw new Error("Invalid song ID");
    }

    // 🎵 Fetch song and creator
    const song = await Song.findById(songId).populate("createdBy");
    if (!song) throw new Error("Song not found");

    // 💬 Fetch comments
    const songComments = await SongComment.find({ songId }).populate("createdBy");

    // 📊 Aggregate reaction counts
    const reactions = await Reaction.aggregate([
      {
        $match: {
          postType: "song",
          postId: new mongoose.Types.ObjectId(songId)
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

    // 🖼️ Render view with all data
    res.render("song", {
      user: req.user,
      song,
      songComments,
      reactionCounts
    });

  } catch (err) {
    console.error("Full error:", err);
    res.status(404).send(err.message || "Song not found.");
  }
});

// Add Reactions
router.post("/reactions", async (req, res) => {
  const { reactionType, postId, postType } = req.body;
  const userId = req.user._id;
  const reaction = reactionType[0];

  const validTypes = ["like", "love", "care", "angry", "sad"];
  if (!validTypes.includes(reaction) || postType !== "song") {
    return res.status(400).send("Invalid reaction or post type");
  }

  try {
    const existing = await Reaction.findOne({ userId, postId, postType });

    if (existing) {
      if (existing.type === reaction) {
        await existing.deleteOne(); // Remove reaction
      } else {
        existing.type = reaction; // Update type
        await existing.save();
      }
    } else {
      await Reaction.create({ type: reaction, postType, postId, userId });
    }

    res.redirect(`/song/${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).send("Server error");
  }
});

// 🗑️ Delete song entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Song.findByIdAndDelete(req.params.id);
    await SongComment.deleteMany({ songId: req.params.id });
    await SongReactions.deleteMany({ postId: req.params.id });

    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Add comment
router.post("/comment/:songId", async (req, res) => {
  try {
    const commentText = req.body?.content?.trim();
    if (!commentText) {
      return res.status(400).send("Comment cannot be empty.");
    }

    // Create comment
    await SongComment.create({
      content: commentText,
      songId: req.params.songId,
      createdBy: req.user._id,
    });

    // Get commenter info from database
    const commenter = await User.findById(req.user._id).select("fullName");
    if (!commenter || !commenter.fullName) throw new Error("Commenter info missing");

    // Get song and its owner info
    const songPost = await Song.findById(req.params.songId).populate({
      path: "createdBy",
      select: "fullName email",
    });
    if (!songPost || !songPost.createdBy || !songPost.createdBy.email) {
      throw new Error("Song owner info missing");
    }
    const recipientFirstName = songPost.createdBy.fullName?.split(" ")[0] || "there";

    // Prepare email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: songPost.createdBy.email,
      subject: "🎵 New Comment on Your Song!",
      text: `
Hi ${recipientFirstName},

${commenter.fullName} just commented on your song:

"${commentText}"

You can listen to the song and reply here:
${req.protocol}://${req.get("host")}/song/${req.params.songId}

Keep the music flowing,  
TuneBoard Team
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Redirect after success
    res.redirect(`/song/${req.params.songId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Failed to add comment.");
  }
});

module.exports = router;