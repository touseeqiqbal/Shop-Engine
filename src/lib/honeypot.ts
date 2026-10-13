/**
 * Anti-spam trap field on public forms: hidden from people, but simple bots fill every field. Its name must mean
 * nothing to browsers and password managers – they autofill fields called "website", "url", "company"… even with
 * autocomplete="off", which used to make real people's forms fail ("Could not create account").
 */
export const HONEYPOT = "hp_7c1";
export const honeypotProps = {
  name: HONEYPOT,
  type: "text",
  tabIndex: -1,
  autoComplete: "off",
  "aria-hidden": true,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
  defaultValue: "",
} as const;
