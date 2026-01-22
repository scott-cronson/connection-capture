const LOGS_KEY = "actionLogs";
const LOG_VISIBILITY_KEY = "showLogs";
const LOGS_LIMIT = 50;

const padTwo = (value) => String(value).padStart(2, "0");

const formatLogTimestamp = (date = new Date()) => {
  const year = date.getFullYear();
  const month = padTwo(date.getMonth() + 1);
  const day = padTwo(date.getDate());
  const hour = padTwo(date.getHours());
  const minute = padTwo(date.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const formatErrorMessage = (error) => {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const appendLogEntry = async (entry) => {
  try {
    const existing = await chrome.storage.local.get(LOGS_KEY);
    const logs = Array.isArray(existing[LOGS_KEY]) ? existing[LOGS_KEY] : [];
    const next = [entry, ...logs].slice(0, LOGS_LIMIT);
    await chrome.storage.local.set({ [LOGS_KEY]: next });
  } catch {
    // Logging should never break the primary workflow.
  }
};

const logInfo = (message) => appendLogEntry({
  timestamp: formatLogTimestamp(),
  level: "info",
  message
});

const logError = (context, error) => {
  const details = formatErrorMessage(error);
  const prefix = context ? `Error (${context}): ` : "Error: ";
  return appendLogEntry({
    timestamp: formatLogTimestamp(),
    level: "error",
    message: `${prefix}${details}`
  });
};
