const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateGameCode(length = 4) {
  let code = "";

  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[index];
  }

  return code;
}

function normalizeGameCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

module.exports = {
  ALPHABET,
  generateGameCode,
  normalizeGameCode
};
