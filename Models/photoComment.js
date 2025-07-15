const { Schema, model } = require("mongoose");

const photoCommentSchema = new Schema(
    {
       content: {
         type: String,
         required: true,
       },
       photoId: {
         type: Schema.Types.ObjectId,
         ref: "photo",
       },
       createdBy: {
         type: Schema.Types.ObjectId,
         ref: "user",
       },
    },{ timestamps: true}
);

const photoComment = model("photoComment", photoCommentSchema);

module.exports = photoComment;