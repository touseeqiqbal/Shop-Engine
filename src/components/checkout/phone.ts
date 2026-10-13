/** Formats a Pakistani mobile number while typing: "03001234567" / "+92 300…" → "0300-1234567". */
export function formatPhoneInput(value: string) {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("92")) d = "0" + d.slice(2);
  else if (d.startsWith("3")) d = "0" + d;
  d = d.slice(0, 11);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}
