# gmail-receipt-download-bookkeeping
Autodownload receipts from Gmail, save them to Drive, and forward them to your bookkeeper, QuickBooks, or a receipt management tool.

This is a basic script, but it includes instructions to customize it 
to download & forward receipts using more complex logic than the examples.

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

Automated Gmail Receipt Forwarder for QuickBooks & Google Drive

An automated Google Apps Script solution that monitors your Gmail inbox for incoming receipts, saves the documents to a designated Google Drive folder, and forwards them directly to QuickBooks Online for expense matching—without requiring elevated Gmail write permissions or custom labels.
Key Features

    Strictly Read-Only Security (gmail.readonly): Requires no label management or gmail.modify permissions.

    Zero Duplication Loop: Filters out outgoing messages (-from:me) to prevent self-forwarding loops and tracks processed message IDs in PropertiesService.

    Smart PDF Generation: Automatically converts email body receipts into clean, OCR-friendly PDFs complete with a metadata header containing the exact sender, recipient, explicit time zone timestamp, standard RFC 822 Message-ID, and Gmail Internal ID.

    QuickBooks OCR Compatible: Sanitizes file names to strictly alphanumeric characters to prevent QuickBooks "Invalid document" import errors.

    Daily Automation: Integrated trigger setup to run automatically every day.

Prerequisites & Required OAuth Scopes

This script requires the following Google OAuth scopes defined in your project's appsscript.json:
JSON

{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}

Configuration

Customize the global constants at the top of Code.gs to match your workflow:
Variable	Description	Default / Example
SUBJECT_KEYWORDS	Array of subject strings to match incoming receipt emails.	['receipt', 'payment processed', 'your invoice is available']
EXCLUDE_SUBJECT_KEYWORDS	Subject strings to skip (e.g., refunds, notifications).	[]
EXCLUDE_SENDERS	Email addresses or domains to ignore.	[]
DRIVE_FOLDER_NAME	Name of the target Google Drive folder.	'Receipts - App Scripts'
RECIPIENT_EMAIL	Your QuickBooks Online custom expense forwarding email address.	'yourcompany+expenses@______.com'
EMAIL_SUBJECT_PREFIX	Prefix added to outgoing forwarded emails.	'New receipt: '
Setup & Installation

    Create Apps Script Project:

        Open Google Apps Script and create a new project.

        Enable the manifest view in Project Settings > Show "appsscript.json" manifest file in editor.

    Paste Code:

        Replace appsscript.json with the manifest configuration provided above.

        Replace Code.gs with the project code and update RECIPIENT_EMAIL to your QuickBooks forwarding address.

    Baseline Run & Authorization:

        Run runAllReceiptRules() manually once from the toolbar.

        Grant the required permissions when prompted.

        This initial run sets the baseline timestamp (LAST_RUN_TIMESTAMP) to look back exactly 24 hours.

    Enable Daily Automation:

        Select createDailyTrigger from the function dropdown in the Apps Script editor.

        Click Run to schedule the script automatically every morning between 6:00 AM and 7:00 AM.

How Duplicate Prevention Works

[ Gmail Inbox ] 
      │
      ├── 1. Query: in:inbox -from:me newer_than:2d subject:(...)
      │
      ├── 2. Check: Was Message ID processed in PROCESSED_MESSAGE_IDS array? ──► Yes ──► Skip
      │                                 │
      │                                No
      │                                 ▼
      └── 3. Check: Received Date <= LAST_RUN_TIMESTAMP? ─────────────► Yes ──► Skip
                                        │
                                       No
                                        ▼
                   [ Save PDF to Drive & Forward to QuickBooks ]
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

