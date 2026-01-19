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

const getText = (selector) => {
  const element = document.querySelector(selector);
  if (!element) {
    return "";
  }
  return (element.textContent || "").trim();
};

const extractProfileFields = () => ({
  cx_level: getText(".dist-value"),
  name: getText("h1"),
  mutuals: getText('a[href^="https://www.linkedin.com/search/results/people/"]')
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "downloadProfilePdf") {
    downloadProfilePdf()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        const errorMessage = error && error.message ? error.message : String(error);
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
        sendResponse({ ok: false, error: errorMessage });
      });
    return true;
  }

  return true;
});
