import { draftMode } from "next/headers";

/** Leave preview (Draft Mode) and go back to the published page. */
export async function POST(request: Request) {
  (await draftMode()).disable();
  const back = request.headers.get("referer");
  const url = back && new URL(back).origin === new URL(request.url).origin ? new URL(back).pathname : "/";
  return Response.redirect(new URL(url, request.url), 303);
}
