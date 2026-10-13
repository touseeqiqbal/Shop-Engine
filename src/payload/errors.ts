import { APIError } from "payload";

/**
 * An error whose message staff should see (e.g. "Check the online payment first…").
 * The production build shortens class names, and Payload only shows a message when the error has a name or data –
 * so both are set explicitly.
 */
export function userError(message: string, status = 400): APIError {
  const e = new APIError(message, status, { message }, true);
  e.name = "APIError";
  return e;
}
