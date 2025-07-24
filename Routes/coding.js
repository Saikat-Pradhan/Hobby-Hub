const { Router } = require("express");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Coding = require("../Models/coding");
const CodingComment = require("../Models/codingComment");
const CodingReactions = require("../Models/codingReaction");
const { cloudinary } = require("../Utils/support");
const uploadFields = require("../Middlewares/fileUpload");
const transporter = require("../Config/mailer");
const Reaction = require("../Models/codingReaction");
const mongoose = require("mongoose");

const router = Router();

// 🔧 Helper: Upload buffer to Cloudinary
const uploadBufferToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

// 📝 Render coding creation page
router.get("/add", (req, res) => {
  res.render("addCoding", { user: req.user });
});

// 📤 Handle coding submission
router.post("/add", uploadFields, async (req, res) => {
  try {
    const { title, body } = req.body;
    const coverImage = req.files?.coverImage?.[0];
    const codeFile = req.files?.codeFile?.[0];

    // ✅ Validate inputs
    if (!title || !body) {
      return res.status(400).send("Title and body are required.");
    }

    if (!codeFile || codeFile.mimetype !== "application/pdf") {
      return res.status(400).send("Only PDF files are allowed.");
    }

    const pdfBuffer = codeFile.buffer;

    // ✅ Upload PDF to Cloudinary
    const codePDF = await uploadBufferToCloudinary(pdfBuffer, {
      resource_type: "raw",
      folder: "hobbyhub_code_pdfs",
    });

    // ✅ Upload cover image to Cloudinary (if provided)
    let coverImageURL =
      "https://images.ctfassets.net/zykafdb0ssf5/68qzkHjCboFfCsSxV2v9S6/4da75033db02c1339de2a3effb461f7a/missing.png";

    if (coverImage) {
      coverImageURL = await uploadBufferToCloudinary(coverImage.buffer, {
        folder: "hobbyhub_cover_images",
      });
    }

    // ✅ Save to MongoDB
    await Coding.create({
      title,
      body,
      createdBy: req.user._id,
      coverImageURL,
      codeFile: pdfBuffer,
      codePDF,
    });

    res.redirect("/");
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Something went wrong while processing your submission.");
  }
});

// 📂 View coding entry
router.get("/:id", async (req, res) => {
  try {
    const codingId = req.params.id;

    // 🔒 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(codingId)) {
      throw new Error("Invalid coding ID");
    }

    // 📂 Fetch coding entry and author
    const coding = await Coding.findById(codingId).populate("createdBy");
    if (!coding) throw new Error("Coding entry not found");

    // 💬 Fetch comments
    const codingComments = await CodingComment.find({ codingId }).populate("createdBy");

    // 📊 Aggregate reaction counts
    const reactions = await Reaction.aggregate([
      {
        $match: {
          postType: "code",
          postId: new mongoose.Types.ObjectId(codingId)
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

    // 🖼️ Render coding.ejs view
    res.render("coding", {
      user: req.user,
      coding,
      codingComments,
      reactionCounts
    });

  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send(err.message || "Entry not found.");
  }
});

// 😍 Add reactions to coding entries
router.post("/reactions", async (req, res) => {
  const { reactionType, postId, postType } = req.body;
  const userId = req.user._id;
  const reaction = Array.isArray(reactionType) ? reactionType[0] : reactionType;

  const validTypes = ["like", "love", "care", "angry", "sad"];
  const validPostTypes = ["code"];

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

    res.redirect(`/code/${postId}`);
  } catch (err) {
    console.error("Reaction error:", err);
    res.status(500).send("Server error");
  }
});

// 📥 Download PDF file
router.get("/download/:id", async (req, res) => {
  try {
    const coding = await Coding.findById(req.params.id);
    if (!coding || !coding.codeFile) return res.status(404).send("PDF not found");

    const filename = `${coding.title.replace(/\s+/g, "_")}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.send(coding.codeFile);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).send("Could not download PDF file.");
  }
});

// 🗑️ Delete coding entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Coding.findByIdAndDelete(req.params.id);
    await CodingComment.deleteMany({ codingId: req.params.id });
    await CodingReactions.deleteMany({ postId: req.params.id});
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment and notify post owner
router.post("/codingComment/:codingId", async (req, res) => {
  try {
    const commentText = req.body?.content?.trim();
    if (!commentText) {
      return res.status(400).send("Comment cannot be empty.");
    }

    // Create the comment
    await CodingComment.create({
      content: commentText,
      codingId: req.params.codingId,
      createdBy: req.user._id,
    });

    // Fetch full commenter details
    const commenter = await User.findById(req.user._id).select("fullName");
    if (!commenter || !commenter.fullName) {
      throw new Error("Commenter info missing.");
    }

    // Find the post and owner info
    const codingPost = await Coding.findById(req.params.codingId).populate({
      path: "createdBy",
      select: "fullName email",
    });
    if (!codingPost || !codingPost.createdBy || !codingPost.createdBy.email) {
      throw new Error("Post or owner info missing.");
    }

    // Extract first name from owner's full name
    const recipientFirstName = codingPost.createdBy.fullName.split(" ")[0] || "there";
    const commenterName = commenter.fullName;

    // Build the email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: codingPost.createdBy.email,
      subject: "💬 New Comment on Your Code!",
      text: `
Hey ${recipientFirstName},

${commenterName} just commented on your code:

"${commentText}"

Check it out here:
${req.protocol}://${req.get("host")}/code/${req.params.codingId}

Cheers,  
Your App Team
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    // Redirect back to the post
    res.redirect(`/code/${req.params.codingId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Could not post your comment.");
  }
});

module.exports = router;