require("dotenv").config();
const express = require("express");
const path = require("path");

// Rotes
const userRoute = require("./Routes/user");
const songRoute = require("./Routes/song");
const danceRoute  = require("./Routes/dance");
const paintingRoute  = require("./Routes/painting");
const gamingRoute = require("./Routes/gaming");
const codingRoute = require("./Routes/coding");
const photoRoute = require("./Routes/photo");

const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { checkForAuthenticationCookie, logedInChecker } = require("./Middlewares/authentication");

// Models
const Song = require("./Models/song");
const Dance = require("./Models/dance");
const Painting = require("./Models/painting");
const Gaming = require("./Models/gaming")
const Coding = require("./Models/coding");
const Photo = require("./Models/photo");
const User = require("./Models/user");

const app = express();
const PORT = process.env.PORT;

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_URL)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("Mongo Error:", err));

// Server Side Renderring    
app.set("view engine", "ejs");
app.set("views", path.resolve("./Views"));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(checkForAuthenticationCookie("token"));
app.use(express.static(path.resolve("./Public")));

// HomePage
app.get("/", async (req, res) => {
    const songs = await Song.find({});
    const dances = await Dance.find({});
    const paintings = await Painting.find({});
    const games = await Gaming.find({});
    const codes = await Coding.find({});
    const photos = await Photo.find({});
    res.render("home", {
        user: req.user? await User.findById(req.user._id) : req.user,
        songs,
        dances,
        paintings,
        games,
        codes,
        photos,
    });
});

// Just for awake backend
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// Routes
app.use("/user", userRoute);
app.use("/song", logedInChecker, songRoute);
app.use("/dance", logedInChecker, danceRoute);
app.use("/painting", logedInChecker, paintingRoute);
app.use("/game", logedInChecker, gamingRoute);
app.use("/code", logedInChecker, codingRoute);
app.use("/photo", logedInChecker, photoRoute);

// Server Started
app.listen(PORT, () => console.log(`Server Started at PORT:${PORT}`));