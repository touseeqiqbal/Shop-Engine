/**
 * Inline script (in <head>) that applies the saved theme before first paint – avoids a flash.
 * When shoppers may not switch modes (Theme settings), the admin's default mode always wins.
 */
export const themeInitScript = (allowToggle = true) =>
  `(function(){try{${allowToggle ? "var t=localStorage.getItem('urko-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}" : ""}var l=localStorage.getItem('urko-lang');if(l==='ur'){document.documentElement.lang='ur'}}catch(e){}})();`;
