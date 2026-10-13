// Console tools run outside Next.js: cache revalidation from Payload hooks is a no-op there
// (the storefront picks changes up on its next revalidate window).
export const revalidateTag = () => {};
export const revalidatePath = () => {};
export const updateTag = () => {};
export const unstable_cache = (fn) => fn;
