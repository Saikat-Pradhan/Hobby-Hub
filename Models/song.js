const { Schema, model } = require("mongoose");

const songSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    videoFile: {
      type: String,
      required: true,
    },
    coverImageURL: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);

const Song = model("song", songSchema);

module.exports = Song;