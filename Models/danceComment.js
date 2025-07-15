const { Schema, model } = require("mongoose");

const danceCommentSchema = new Schema(
    {
       content: {
         type: String,
         required: true,
       },
       danceId: {
         type: Schema.Types.ObjectId,
         ref: "dance",
       },
       createdBy: {
         type: Schema.Types.ObjectId,
         ref: "user",
       },
    },{ timestamps: true}
);

const danceComment = model("danceComment", danceCommentSchema);

module.exports = danceComment;