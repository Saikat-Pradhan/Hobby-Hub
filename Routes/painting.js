const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Painting = require("../Models/painting");
const PaintingComment = require("../Models/paintingComment");
const PaintingReactions = require("../Models/paintingReaction")
const { cloudinary } = require("../Utils/cloudinary");
const transporter = require("../Config/mailer");
const Reaction = require("../Models/paintingReaction");
const mongoose = require("mongoose");

const router = Router();

// 🔧 Memory storage for cover image
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// 🎨 Render painting creation form
router.get("/add", (req, res) => {
  res.render("addPainting", {
    user: req.user,
  });
});

// 📤 Handle painting submission
router.post("/add", upload.single("coverImage"), async (req, res) => {
  try {
    const { title, body } = req.body;
    const coverImage = req.file;

    let coverImageURL = "https://res.cloudinary.com/your_cloud_name/image/upload/v1234567890/default.jpg";

    // 📤 Upload cover image to Cloudinary
    if (coverImage) {
      const imageUpload = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "hobbyhub_paintings" },
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
    await Painting.create({
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

// 🖼️ View a painting post with reaction counts
router.get("/:id", async (req, res) => {
  try {
    const paintingId = req.params.id;

    // 🔒 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(paintingId)) {
      throw new Error("Invalid painting ID");
    }

    // Fetch painting and creator
    const painting = await Painting.findById(paintingId).populate("createdBy");
    if (!painting) throw new Error("Painting not found");

    // Fetch comments
    const paintingComments = await PaintingComment.find({ paintingId }).populate("createdBy");

    // Aggregate reaction counts
    const reactions = await Reaction.aggregate([
      {
        $match: {
          postType: "painting",
          postId: new mongoose.Types.ObjectId(paintingId)
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
    res.render("painting", {
      user: req.user,
      painting,
      paintingComments,
      reactionCounts
    });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send(err.message || "Painting not found.");
  }
});

// 🎨 Handle reactions to painting posts
router.post("/reactions", async (req, res) => {
  const { reactionType, postId, postType } = req.body;
  const userId = req.user._id;
  const reaction = Array.isArray(reactionType) ? reactionType[0] : reactionType;

  const validTypes = ["like", "love", "care", "angry", "sad"];
  const validPostTypes = ["painting"];

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

    res.redirect(`/painting/${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).send("Server error");
  }
});

// 🗑️ Delete a painting post
router.get("/delete/:id", async (req, res) => {
  try {
    await Painting.findByIdAndDelete(req.params.id);
    await PaintingComment.deleteMany({ paintingId: req.params.id });
    await PaintingReactions.deleteMany({ postId: req.params.id });

    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment
router.post("/comment/:paintingId", async (req, res) => {
  try {
    const commentText = req.body?.content?.trim();
    if (!commentText) {
      return res.status(400).send("Comment cannot be empty.");
    }

    // Create the comment
    await PaintingComment.create({
      content: commentText,
      paintingId: req.params.paintingId,
      createdBy: req.user._id,
    });

    // Redirect back to the painting post
    res.redirect(`/painting/${req.params.paintingId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;