export const BRASS_SIZE_CODES = ['2/4', '2/6', '2/8', '2/10'];

export const BRASS_OK_LENGTHS_MM = Object.freeze({
  KADA: Object.freeze([215, 234, 244, 253]),
  BB: Object.freeze([216, 223, 231, 243]),
  CP: Object.freeze([204, 218, 224.5, 235]),
  CHURI: Object.freeze([202, 216, 223, 233])
});

export function getBrassOkLength(product, sizeCode) {
  const productLengths = BRASS_OK_LENGTHS_MM[product];
  const sizeIndex = BRASS_SIZE_CODES.indexOf(sizeCode);
  if (!productLengths || sizeIndex < 0) return null;
  return productLengths[sizeIndex];
}

export function getGridSizeKey(sizeCode) {
  if (!BRASS_SIZE_CODES.includes(sizeCode)) return null;
  return sizeCode.replace('/', '.');
}
