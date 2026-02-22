import crypto from "crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

const getPublicKey = () => publicKey;
console.log(publicKey)
const decryptAesKey = (encryptedKeyBase64) => {
  const encryptedKey = Buffer.from(encryptedKeyBase64, "base64");
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedKey
  );
};

const decryptPayload = ({ encryptedData, iv, aesKey }) => {
  const ivBuffer = Buffer.from(iv, "base64");
  const encryptedBuffer = Buffer.from(encryptedData, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, ivBuffer);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

export { decryptAesKey, decryptPayload, getPublicKey };

