import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/token", (req, res) => {
  const { client_id, client_secret } = req.body || {};

  if (!client_id || !client_secret) {
    return res.status(400).json({ error: "Missing client credentials" });
  }

  if (
    client_id !== process.env.OAUTH_CLIENT_ID ||
    client_secret !== process.env.OAUTH_CLIENT_SECRET
  ) {
    return res.status(401).json({ error: "Invalid client credentials" });
  }

  const accessToken = jwt.sign(
    { clientId: client_id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
  });
});

export default router;
