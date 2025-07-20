const { Router } = require("express");
const multer = require("multer");
const streamifier = require("streamifier");
const User = require("../Models/user");
const Photo = require("../Models/photo");
const PhotoComment = require("../Models/photoComment");
const { cloudinary } = require("../Utils/cloudinary");
const transporter = require("../Config/mailer");

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

// 🖼️ View a photo post
router.get("/:id", async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id).populate("createdBy");
    const photoComments = await PhotoComment.find({ photoId: req.params.id }).populate("createdBy");

    res.render("photo", {
      user: req.user,
      photo,
      photoComments,
    });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Photo post not found.");
  }
});

// 🗑️ Delete a photo post
router.get("/delete/:id", async (req, res) => {
  try {
    await Photo.findByIdAndDelete(req.params.id);
    await PhotoComment.deleteMany({ photoId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit a comment and notify post owner
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

    // Get commenter info
    const commenter = await User.findById(req.user._id).select("fullName");
    if (!commenter || !commenter.fullName) {
      throw new Error("Commenter info missing.");
    }

    // Get photo post and owner info
    const photoPost = await Photo.findById(req.params.photoId).populate({
      path: "createdBy",
      select: "fullName email",
    });
    if (!photoPost || !photoPost.createdBy || !photoPost.createdBy.email) {
      throw new Error("Photo or owner info missing.");
    }

    // Extract first name from owner's full name
    const recipientFirstName = photoPost.createdBy.fullName?.split(" ")[0] || "there";
    const commenterName = commenter.fullName;

    // Prepare email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: photoPost.createdBy.email,
      subject: "📸 New Comment on Your Photo!",
      text: `
Hi ${recipientFirstName},

${commenterName} just commented on your photo:

"${commentText}"

View the photo and reply:
${req.protocol}://${req.get("host")}/photo/${req.params.photoId}

Best,  
PhotoBoard Team
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Redirect to photo post
    res.redirect(`/photo/${req.params.photoId}`);
  } catch (err) {
    console.error("Comment error:", err.message);
    res.status(500).send("Failed to post comment.");
  }
});

module.exports = router;