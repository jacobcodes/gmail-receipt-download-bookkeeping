# gmail-receipt-download-bookkeeping
Autodownload receipts from Gmail, save them to Drive, and forward them to your bookkeeper, QuickBooks, or a receipt management tool.

# Gmail Receipt Saver (Google Apps Script)

One Google Apps Script project that finds receipts/invoices in Gmail, saves
them as PDFs to a Drive folder it creates itself, and (optionally) emails
you each new PDF — all in one daily run. This is a v1 - use at your own risk.

Read full README and disclaimer at the bottom before continuing.

Built by [Orderly Bookkeeping, LLC](https://orderlybookkeeping.com). 

## What is Google Apps Script?

A free way to write small JavaScript programs that run on Google's servers
and can read/control your own Gmail, Drive, etc. Manage projects at
[script.google.com](https://script.google.com). A project holds one or
more `.gs` code files plus one `appsscript.json` manifest (permissions).

## What it does

Runs daily via `runAllReceiptRules()`:
1. Creates (once) or reuses the "Receipts - App Scripts" Drive folder.
2. Runs each rule in the `RULES` array against Gmail — ships with an
   Anthropic-invoice rule and a generic-receipt rule.
3. If `RECIPIENT_EMAIL` is set, emails any PDF added to the folder since
   the last run.

Everything remembers what it's already handled (via `PropertiesService`),
so nothing is ever processed or emailed twice.

## Setup

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Paste in `Code.gs`. Edit the CONFIGURATION block: set `RECIPIENT_EMAIL`
   (leave `''` to skip emailing).
3. Project Settings → check **"Show `appsscript.json` manifest file"** →
   paste this repo's `appsscript.json` scopes into it.
4. Save. Run `createDailyTrigger` once. Authorize when prompted (click
   **Advanced → Go to [project] (unsafe) → Allow** — expected for your own
   script).
5. Check **View → Executions** for the printed Drive folder ID/log output.

Run `runAllReceiptRules` manually any time to test instead of waiting for
the trigger.

## How it works

- **`RULES`** — each object: `subjectStartsWith`/`subjectContains`,
  `excludeSubjectStartsWith`, `attachmentPdfNameContains`, and
  `whenAttachmentFound`/`whenAttachmentNotFound` (`'save'`,
  `'saveEmailAsPdf'`, or `'skip'`). Add new email patterns by adding new
  rule objects — no other code changes needed.
- **`processRule`** — searches Gmail per rule, skips already-processed
  message IDs (stored per-rule so rules never collide), saves matching
  attachments or converts the email to PDF.
- **`getOrCreateFolder`** — creates the shared folder once and remembers
  its ID.
- **`emailNewReceipts`** — after the rules run, emails any PDF in the
  folder created since its own last-run timestamp.

## Permissions

| Scope | Why |
|---|---|
| `gmail.readonly` | Search/read email and attachments only — can't send, delete, or modify mail. |
| `drive` | Needed for `DriveApp.createFolder` (Apps Script requires this even for a folder the script owns — `drive.file` isn't sufficient for folder creation). |
| `script.scriptapp` | Lets the script schedule its own daily run. |
| `script.send_mail` | Only allows sending email as you — no inbox/contacts access. |

This is the minimum needed for one project to create the folder, read
Gmail, and send email — no separate Drive-wide read scope is needed since
the script already owns the folder from the `drive` scope above.

## Troubleshooting

- **"Not sufficient permissions"** — scope in `appsscript.json` doesn't
  match; re-check step 3, then re-run and re-authorize.
- **Duplicate `const` / syntax errors** — another file in the project
  still has old code; delete extra `.gs` files, keep only one.
- **Re-process an email** — delete its ID from Script Properties
  (Project Settings → Script Properties).

## Going further

Extend a rule's matching logic directly in `processRule`/
`subjectMatchesRule`:

```js
// exclude a sender domain
if (message.getFrom().includes('@example.com')) return;

// require two phrases in the body
const body = message.getPlainBody().toLowerCase();
if (!(body.includes('your receipt') && body.includes('amount paid'))) return;
```

--

## Disclaimer

This tool is provided for **educational purposes only**. 
This project is not affiliated with or endorsed by Anthropic, or Google. 
It is not tax, legal, accounting, or financial advice, and using it 
does not create any advisor relationship. 
It is provided **"as is," without warranty of any kind, express or implied**, 
including without limitation any warranty of merchantability, 
fitness for a particular purpose, accuracy, or non-infringement. 
You are responsible for reviewing and verifying any output 
before relying on it. Always consult a qualified developer,
tax advisor, or attorney for advice specific to your situation.

## License

Licensed under the **GNU Affero General Public License v3.0** (see
[`LICENSE`](./LICENSE)). You're free to use, modify, and redistribute
this, including for commercial purposes -- but if you distribute a
modified version, or run it as a hosted/network service that others
interact with, you must make the corresponding source code (including
your modifications) available under the same license.

## Need a hand?

If you'd rather have someone handle your QuickBooks Online bookkeeping
for you, [Orderly Bookkeeping](https://orderlybookkeeping.com) offers
full-service bookkeeping. We also work with larger clients on CFO-level
and consulting engagements -- optimizing profitability, modeling out
cash flow and growth scenarios.*

