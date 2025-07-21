const mongoose = require("mongoose");

const gameReactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["like", "love", "care", "angry", "sad"],
    required: true
  },
  postType: {
    type: String,
    enum: ["game"],
    required: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Game"
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  }
}, { timestamps: true });

// Ensure one reaction per user per song
gameReactionSchema.index({ userId: 1, postId: 1, postType: 1 }, { unique: true });

module.exports = mongoose.model("gameReaction", gameReactionSchema);