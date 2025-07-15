const { Router } = require("express");
const multer = require("multer");
const User = require("../Models/user");
const Song = require("../Models/song");
const Dance = require("../Models/dance");
const Painting = require("../Models/painting");
const Coding = require("../Models/coding");
const Photo = require("../Models/photo");
const path = require("path");

const router = Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        return cb(null, path.resolve("./Public/Images"));
    },
    filename: function (req, file, cb) {
        return cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

router.get("/add", (req, res) => {
    return res.render("addBlog", {
        user: req.user,
    });
});

router.get("/signin", (req, res) => {
    return res.render("signIn");
});

router.get("/signup", (req, res) => {
    return res.render("signUp");
});

router.get("/profile", async (req, res) => {
    const createdSongs = await Song.find({ createdBy: req.user._id });
    const createdDances = await Dance.find({ createdBy: req.user._id });
    const createdPaintings = await Painting.find({ createdBy: req.user._id });
    const createdCodes = await Coding.find({ createdBy: req.user._id });
    const createdPhotos = await Photo.find({ createdBy: req.user._id });
    return res.render("profile", {
        songs: createdSongs,
        dances: createdDances,
        paintings: createdPaintings,
        codes: createdCodes,
        photos: createdPhotos,
        user: await User.findById(req.user._id),
    });
});

router.post("/signup", upload.single('profileImage'), async (req, res) => {
    const body = req.body;

    if (!body || !body.fullName || !body.email || !body.password) {
        return res.render("signUp", { error: "All fields are required." });
    }

    const result = await User.create({
        fullName: body.fullName,
        email: body.email,
        interestedFields: body.interestedFields ? body.interestedFields : ["ALL"],
        password: body.password,
        profileImageURL: req.file
            ? `/Images/${req.file.filename}`
            : `/Images/default.png`,
    });

    console.log("Result", result);
    return res.redirect("/");
});

router.post("/signin", async (req, res) => {
    const { email, password } = req.body;

    try {
        const token = await User.matchPasswordAndGenerateToken(email, password);

        if (!token) {
            return res.render("signUp", { error: "Please, create an account" });
        }

        console.log("✅ Login Successfully!!");

        return res.cookie("token", token).redirect("/");
    } catch (err) {
        console.error(err.message);
        return res.render("signIn", { error: "Incorrect Email or Password!!" });
    }
});

router.get("/logout", (req, res) => {
    res.clearCookie("token").redirect("/");
});

module.exports = router;