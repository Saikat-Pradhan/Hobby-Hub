const { Schema, model } = require("mongoose");

const codingCommentSchema = new Schema(
    {
       content: {
         type: String,
         required: true,
       },
       codingId: {
         type: Schema.Types.ObjectId,
         ref: "coding",
       },
       createdBy: {
         type: Schema.Types.ObjectId,
         ref: "user",
       },
    },{ timestamps: true}
);

const codingComment = model("codingComment", codingCommentSchema);

module.exports = codingComment;