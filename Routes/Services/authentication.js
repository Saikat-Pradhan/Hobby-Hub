const JWT = require("jsonwebtoken");

const secret = "$saikatllmn27";

function createTokenForUser(user) {
    const payload = {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        profileImageURL: user.profileImageURL,
    };

    const token = JWT.sign(payload, secret);

    return token;
}

function validateToken(token) {
    const payload = JWT.verify(token, secret);

    return payload;
}

module.exports = {
    createTokenForUser,
    validateToken,
}