const { Schema, model } = require("mongoose");

const songCommentSchema = new Schema(
    {
       content: {
         type: String,
         required: true,
       },
       songId: {
         type: Schema.Types.ObjectId,
         ref: "song",
       },
       createdBy: {
         type: Schema.Types.ObjectId,
         ref: "user",
       },
    },{ timestamps: true}
);

const songComment = model("songComment", songCommentSchema);

module.exports = songComment;