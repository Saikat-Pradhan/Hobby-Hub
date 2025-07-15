const { Schema, model } = require("mongoose");

const paintingCommentSchema = new Schema(
    {
       content: {
         type: String,
         required: true,
       },
       paintingId: {
         type: Schema.Types.ObjectId,
         ref: "painting",
       },
       createdBy: {
         type: Schema.Types.ObjectId,
         ref: "user",
       },
    },{ timestamps: true}
);

const paintingComment = model("paintingComment", paintingCommentSchema);

module.exports = paintingComment;