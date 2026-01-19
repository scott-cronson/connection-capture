# Connection Capture

Connection Capture is a Chrome extension that helps you understand your LinkedIn
connections and download profile data. When you visit a LinkedIn profile, the
extension triggers a "Save to PDF" click, stores basic visit metadata, and
records a few profile fields. You can export everything to CSV from the popup.

## Features
- Auto-detect LinkedIn profile pages and trigger "Save to PDF".
- Rename profile PDF downloads into `linkedin_profiles/`.
- Store visit data in `chrome.storage.local` with daily `lastSeen`.
- Extract profile fields: `name`, `cx_level`, and `mutuals`.
- Export all stored data to CSV or clear storage from the popup.

## Install
1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked" and select this entire directory.
4. Visit a LinkedIn profile page and allow notifications/downloads if prompted.

## Usage
- Visit a profile URL like `https://www.linkedin.com/in/<handle>/`.
- A PDF download should start and be saved under `linkedin_profiles/`.
- A notification appears with the current storage snapshot.
- Click the extension icon to download a CSV or clear stored data.

## Data stored
Each profile is stored under a key like `profile:<url>` with this shape:
```
{
  "url": "https://www.linkedin.com/in/jane-doe",
  "lastSeen": "YYYY-MM-DD",
  "name": "Jane Doe",
  "cx_level": "2nd",
  "mutuals": "5 mutual connections"
}
```

## CSV export format
The first column uses the key prefix (for example, `profile`), and the first
value in each row is the URL. Additional columns are the stored fields, such as
`name`, `cx_level`, `mutuals`, `lastSeen`.

## Notes
- The extension relies on LinkedIn page structure (ARIA labels and selectors).
  If the UI changes, selectors may need updates in `content.js`.
- Chrome does not allow auto-opening action popups. All visible UI is either a
  notification or the popup you open manually.
