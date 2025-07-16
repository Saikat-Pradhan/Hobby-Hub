const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const Coding = require("../Models/coding");
const CodingComment = require("../Models/codingComment");

const router = Router();

// 🔧 Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve("./Public/Uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// 📝 Render coding creation page
router.get("/add", (req, res) => {
  res.render("addCoding", { user: req.user });
});

// 📤 Handle coding submission
router.post("/add", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "codeFile", maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, body } = req.body;

    const coverImage = req.files?.["coverImage"]?.[0];
    const codeFile = req.files?.["codeFile"]?.[0];

    if (!codeFile) {
      return res.status(400).send("Code file is required.");
    }

    // 📄 PDF creation
    const codeFilePath = path.resolve("./Public/Uploads", codeFile.filename);
    const pdfFilename = `${Date.now()}-converted.pdf`;
    const pdfPath = path.resolve("./Public/Uploads", pdfFilename);

    const doc = new PDFDocument();
    const pdfStream = fs.createWriteStream(pdfPath);
    doc.pipe(pdfStream);

    doc.fontSize(18).text(title, { align: "center" }).moveDown();
    doc.fontSize(12).text(body, { align: "left" }).moveDown();
    const codeContent = fs.readFileSync(codeFilePath, "utf8");
    doc.fontSize(10).text(codeContent, { lineGap: 4 });
    doc.end();

    pdfStream.on("finish", async () => {
      await Coding.create({
        title,
        body,
        createdBy: req.user._id,
        coverImageURL: coverImage
          ? `/Uploads/${coverImage.filename}`
          : `/Uploads/default.jpg`,
        codeFile: `/Uploads/${codeFile.filename}`,
        codePDF: `/Uploads/${pdfFilename}`,
      });

      res.redirect("/");
    });
  } catch (err) {
    console.error("Upload/PDF error:", err);
    res.status(500).send("Something went wrong while processing your submission.");
  }
});

// 📂 View coding entry
router.get("/:id", async (req, res) => {
  try {
    const coding = await Coding.findById(req.params.id).populate("createdBy");
    const codingComments = await CodingComment.find({ codingId: req.params.id }).populate("createdBy");

    res.render("coding", { user: req.user, coding, codingComments });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 🗑️ Delete coding entry
router.get("/delete/:id", async (req, res) => {
  try {
    await Coding.findByIdAndDelete(req.params.id);
    await CodingComment.deleteMany({ codingId: req.params.id });
    res.redirect("/user/profile");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(404).send("Entry not found.");
  }
});

// 💬 Submit comment
router.post("/codingComment/:codingId", async (req, res) => {
  try {
    await CodingComment.create({
      content: req.body.content,
      codingId: req.params.codingId,
      createdBy: req.user._id,
    });
    res.redirect(`/code/${req.params.codingId}`);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).send("Could not post your comment.");
  }
});

module.exports = router;