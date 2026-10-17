/** How an unsubscribed contact is kept: emails in lower case, phone numbers as checkout normalised them. */
export const optOutKey = (contact: unknown) => {
  const c = String(contact ?? "").trim().slice(0, 160);
  return c.includes("@") ? c.toLowerCase() : c;
};
