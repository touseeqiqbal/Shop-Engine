/** Website order numbers: <STORE PREFIX>-YYMMDD-NNNNNN, e.g. UTS-… (older orders: 4 digits). Client-safe. */
export const ORDER_NUMBER_RE = /^[A-Z0-9]{2,6}-\d{6}-(?:\d{4}|\d{6})$/;
export const ORDER_NUMBER_EXAMPLE = "UTS-260512-482193";
