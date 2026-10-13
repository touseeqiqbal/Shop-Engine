import sanitize from "sanitize-html";

/**
 * Cleans HTML written in /cms (Markdown, rich text) before it is put on the page – staff text is shown on the same
 * site as /cms, so a script in a product description could act as whoever is viewing it (e.g. the Owner).
 * Keeps normal formatting (headings, lists, tables, links, images, YouTube embeds); removes scripts, event
 * handlers (onerror=…), styles and javascript: links.
 */
const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre", "code", "span", "div",
    "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sub", "sup", "small",
    "ul", "ol", "li", "dl", "dt", "dd", "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    iframe: ["src", "title", "width", "height", "allow", "allowfullscreen", "loading"],
    th: ["colspan", "rowspan", "align"],
    td: ["colspan", "rowspan", "align"],
    ol: ["start"],
    "*": ["id"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com"],
  transformTags: {
    // links to other sites open safely in a new tab
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return { tagName, attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs };
    },
  },
};

export const sanitizeHtml = (html: string) => sanitize(html, OPTIONS);
