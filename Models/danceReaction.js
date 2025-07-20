const mongoose = require("mongoose");

const danceReactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["like", "love", "care", "angry", "sad"],
    required: true
  },
  postType: {
    type: String,
    enum: ["dance"],
    required: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Dance"
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  }
}, { timestamps: true });

// Ensure one reaction per user per song
danceReactionSchema.index({ userId: 1, postId: 1, postType: 1 }, { unique: true });

module.exports = mongoose.model("danceReaction", danceReactionSchema);