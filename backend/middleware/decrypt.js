import { decryptAesKey, decryptPayload } from "../utils/crypto.js";

const decrypt = (req, res, next) => {
  const { encryptedKey, encryptedData, iv } = req.body || {};

  if (!encryptedKey || !encryptedData || !iv) {
    return res.status(400).json({ error: "Missing encrypted payload" });
  }

  try {
    const aesKey = decryptAesKey(encryptedKey);
    if (aesKey.length !== 32) {
      return res.status(400).json({ error: "Invalid AES key length" });
    }
    const decryptedJson = decryptPayload({ encryptedData, iv, aesKey });
    req.decryptedData = JSON.parse(decryptedJson);
    return next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid encrypted payload" });
  }
};

export default decrypt;
