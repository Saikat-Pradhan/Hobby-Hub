const { Schema, model } = require("mongoose");

const gameCommentSchema = new Schema(
    {
       content: {
         type: String,
         required: true,
       },
       gameId: {
         type: Schema.Types.ObjectId,
         ref: "game",
       },
       createdBy: {
         type: Schema.Types.ObjectId,
         ref: "user",
       },
    },{ timestamps: true}
);

const gameComment = model("gameComment", gameCommentSchema);

module.exports = gameComment;