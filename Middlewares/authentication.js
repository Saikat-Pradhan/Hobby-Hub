const { validateToken } = require("../Services/authentication");

function checkForAuthenticationCookie(cookieName) {
    return (req, res, next) => {
        const tokenCookieValue = req.cookies[cookieName];

        if (!tokenCookieValue) {
            return next();
        }

        try {
            const userPayload = validateToken(tokenCookieValue);
            req.user = userPayload;
        } catch (error) {
            console.error("Invalid token:", error.message);
        }

        return next();
    };
}

// 🔐 Middleware to enforce login
function logedInChecker(req, res, next) {
    if (!req.user) {
        return res.render("signIn", {error: "You are not logged in!!"});
    }
    next();
}



module.exports = {
    checkForAuthenticationCookie,
    logedInChecker
};