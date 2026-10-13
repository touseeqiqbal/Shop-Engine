/** Website order numbers: UTS-YYMMDD-NNNNNN (older orders: 4 digits). Client-safe. */
export const ORDER_NUMBER_RE = /^UTS-\d{6}-(?:\d{4}|\d{6})$/;
export const ORDER_NUMBER_EXAMPLE = "UTS-260512-482193";
