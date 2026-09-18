// ---------------- WHAT TO MATCH ----------------
const SUBJECT_KEYWORDS = [
  'receipt',
  'payment processed',
  'your invoice is available'
];

const EXCLUDE_SUBJECT_KEYWORDS = [
  // 'EXCLUDETHISSUBJECT'
];

const EXCLUDE_SENDERS = [
  // 'spam@example.com'
];

const ATTACHMENT_PDF_NAME_CONTAINS = '.pdf';

// ---------------- OTHER SETTINGS ----------------
const DRIVE_FOLDER_NAME = 'Receipts - App Scripts';
const RECIPIENT_EMAIL = 'ADDTHEEMAILADDRESSYOUWANTTOSENDRECEIPTSTOHERE';
const EMAIL_SUBJECT_PREFIX = 'New receipt: ';
const MAX_ID_HISTORY = 200; 

// ---------------- MAIN ----------------
function runAllReceiptRules() {
  const props = PropertiesService.getScriptProperties();
  const lastRunIso = props.getProperty('LAST_RUN_TIMESTAMP');
  
  const now = new Date();
  const lastRunDate = lastRunIso ? new Date(lastRunIso) : new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  let processedIds = [];
  try {
    processedIds = JSON.parse(props.getProperty('PROCESSED_MESSAGE_IDS') || '[]');
  } catch (e) {
    processedIds = [];
  }

  const folder = getOrCreateFolder();
  const threads = GmailApp.search(buildQuery());
  let count = 0;

  try {
    threads.forEach(thread => {
      thread.getMessages().forEach(message => {
        const msgId = message.getId();
        const msgDate = message.getDate();

        if (processedIds.includes(msgId)) return;
        if (msgDate <= lastRunDate) return;
        if (!subjectAndSenderMatch(message)) return;

        const pdfBlob = getReceiptPdf(message);
        folder.createFile(pdfBlob);

        if (RECIPIENT_EMAIL) {
          MailApp.sendEmail({
            to: RECIPIENT_EMAIL,
            subject: EMAIL_SUBJECT_PREFIX + pdfBlob.getName(),
            body: `Receipt "${pdfBlob.getName()}" is attached.`,
            attachments: [pdfBlob]
          });
        }

        processedIds.push(msgId);
        count++;
      });
    });
  } finally {
    if (processedIds.length > MAX_ID_HISTORY) {
      processedIds = processedIds.slice(-MAX_ID_HISTORY);
    }
    props.setProperty('PROCESSED_MESSAGE_IDS', JSON.stringify(processedIds));
    props.setProperty('LAST_RUN_TIMESTAMP', now.toISOString());
  }

  console.log(`Processed ${count} new receipt(s).`);
}

function buildQuery() {
  const subjectPart = `subject:(${SUBJECT_KEYWORDS.map(k => `"${k}"`).join(' OR ')})`;
  return `in:inbox -from:me newer_than:2d ${subjectPart}`;
}

function subjectAndSenderMatch(message) {
  const subject = message.getSubject().toLowerCase();
  const from = message.getFrom().toLowerCase();

  if (!SUBJECT_KEYWORDS.some(k => subject.includes(k.toLowerCase()))) return false;
  if (EXCLUDE_SUBJECT_KEYWORDS.some(s => subject.includes(s.toLowerCase()))) return false;
  if (EXCLUDE_SENDERS.some(s => from.includes(s.toLowerCase()))) return false;
  return true;
}

function getReceiptPdf(message) {
  const attachment = message.getAttachments().find(att =>
    att.getContentType() === 'application/pdf' &&
    att.getName().toLowerCase().includes(ATTACHMENT_PDF_NAME_CONTAINS.toLowerCase())
  );
  
  if (attachment) {
    const rawName = attachment.getName().replace(/\.pdf$/i, '');
    const cleanName = `${sanitizeFilename(rawName)}.pdf`;
    const blob = attachment.copyBlob();
    blob.setName(cleanName);
    return blob;
  }

  const timeZone = Session.getScriptTimeZone();
  const dateStr = Utilities.formatDate(message.getDate(), timeZone, 'yyyyMMdd_HHmmss');
  // Includes time zone name and offset (e.g., "Sep 18, 2026, 3:56:00 PM EDT (UTC-04:00)")
  const formattedDate = Utilities.formatDate(message.getDate(), timeZone, "MMM d, yyyy, h:mm:ss a z ('UTC'Z)");
  
  const rfcMessageId = getRfcMessageId(message);
  const internalId = message.getId();

  const cleanSubject = sanitizeFilename(message.getSubject() || 'Receipt');
  const fileName = `${cleanSubject}_${dateStr}.pdf`;

  const htmlHeader = `
    <div style="font-family: Arial, sans-serif; font-size: 11px; color: #222; margin-bottom: 15px; border-bottom: 2px solid #ccc; padding-bottom: 12px;">
      <p style="font-size: 10px; color: #555; font-style: italic; margin: 0 0 10px 0;">
        [This email was saved as a PDF and automatically forwarded.]
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; line-height: 1.5; color: #333;">
        <tr><td style="width: 120px; font-weight: bold; vertical-align: top;">From:</td><td>${escapeHtml(message.getFrom())}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">To:</td><td>${escapeHtml(message.getTo())}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Date:</td><td>${formattedDate}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Subject:</td><td>${escapeHtml(message.getSubject())}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Message-ID (Header):</td><td>${escapeHtml(rfcMessageId)}</td></tr>
        <tr><td style="font-weight: bold; vertical-align: top;">Gmail Internal ID:</td><td>${escapeHtml(internalId)}</td></tr>
      </table>
    </div>
  `;

  const fullHtml = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: letter; margin: 0.5in; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 0; padding: 0; }
        div.email-body { margin-top: 15px; word-wrap: break-word; }
      </style>
    </head>
    <body>
      ${htmlHeader}
      <div class="email-body">${message.getBody()}</div>
    </body>
  </html>`;

  const blob = Utilities.newBlob(fullHtml, 'text/html', fileName).getAs('application/pdf');
  blob.setName(fileName);
  return blob;
}

function getRfcMessageId(message) {
  try {
    const raw = message.getRawContent();
    const match = raw.match(/^Message-ID:\s*(<[^>]+>)/mi);
    return match ? match[1] : message.getId();
  } catch (e) {
    return message.getId();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(name) {
  if (!name) return 'Receipt';
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Receipt';
}

function getOrCreateFolder() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty('FOLDER_ID');
  if (storedId) {
    try { return DriveApp.getFolderById(storedId); } catch (e) {}
  }
  const folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runAllReceiptRules') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runAllReceiptRules').timeBased().everyDays(1).atHour(6).create();
  console.log('Daily trigger created.');
}
