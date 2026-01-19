const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sanitizeSlug = (value) => value
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const extractProfileSlug = (urlString, host) => {
  try {
    const url = new URL(urlString);
    if (host && url.hostname !== host) {
      return "";
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0] !== "in") {
      return "";
    }
    const rawSlug = decodeURIComponent(parts.slice(1).join("_"));
    return sanitizeSlug(rawSlug);
  } catch {
    return "";
  }
};

const normalizeLinkedInUrl = (urlString) => {
  try {
    const url = new URL(urlString);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return urlString;
  }
};
