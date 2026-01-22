const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clickByAriaLabel = (label) => {
  const element = document.querySelector(`[aria-label="${label}"]`);
  if (!element) {
    throw new Error(`Could not find element with aria-label="${label}".`);
  }
  element.click();
};

const downloadProfilePdf = async () => {
  clickByAriaLabel("More actions");
  await wait(100);
  clickByAriaLabel("Save to PDF");
};

const downloadProfilePdfWithRetry = async () => {
  try {
    await downloadProfilePdf();
  } catch (error) {
    // Retry once in case the SPA UI has not finished rendering yet.
    await wait(2000);
    try {
      await downloadProfilePdf();
    } catch (retryError) {
      const message = retryError && retryError.message ? retryError.message : String(retryError);
      const slug = extractProfileSlug(window.location.href, "www.linkedin.com") || "unknown";
      throw new Error(`${message} (profile: ${slug})`);
    }
  }
};

const getText = (selector) => {
  const element = document.querySelector(selector);
  if (!element) {
    return "";
  }
  return (element.innerText || "").trim();
};

const extractProfileFields = () => ({
  cx_level: getText(".dist-value"),
  name: getText("h1"),
  // LinkedIn often duplicates the mutual-connection line; keep only the first line.
  mutuals: getText('a[href^="https://www.linkedin.com/search/results/people/"]')
    .split("\n")[0]
    .trim()
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "downloadProfilePdf") {
    downloadProfilePdfWithRetry()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        const errorMessage = error && error.message ? error.message : String(error);
        void logError("content downloadProfilePdf", error);
        sendResponse({ ok: false, error: errorMessage });
      });
    return true;
  }

  if (message.type === "extractProfileFields") {
    Promise.resolve()
      .then(() => extractProfileFields())
      .then((fields) => sendResponse({ ok: true, fields }))
      .catch((error) => {
        const errorMessage = error && error.message ? error.message : String(error);
        void logError("content extractProfileFields", error);
        sendResponse({ ok: false, error: errorMessage });
      });
    return true;
  }

  return true;
});
