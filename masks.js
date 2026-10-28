// Mask skins players can choose. Add a PNG to masks/ and list it here to add a skin.
const MASKS = Array.from({ length: 42 }, (_, i) => `masks/mask-${String(i + 1).padStart(2, "0")}.png`);
