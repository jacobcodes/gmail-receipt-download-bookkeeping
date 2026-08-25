/**
 * ============================================================
 *  SCRIPT 1: Receipt Download Rules (rule engine)
 * ============================================================
 *  What this does, in plain English:
 *  Once a day, this script goes through a list of "rules" you
 *  define in the RULES array below. Each rule describes one kind
 *  of email to look for in Gmail, and what to save to Drive when
 *  it's found. Two rules are included to start:
 *
 *    1. anthropic-invoice — finds emails starting with "Your
 *       receipt from Anthropic" that have a PDF attachment named
 *       with "invoice", and saves that attachment.
 *    2. generic-receipt — finds emails with "receipt" in the
 *       subject (skipping the Anthropic ones above) that do NOT
 *       already have a PDF attachment named with "receipt", and
 *       saves the whole email as a PDF instead.
 *
 *  To add a new rule later (e.g. for a different client or a new
 *  vendor), you only need to add a new entry to the RULES array —
 *  no other code needs to change. See the README's "Going
 *  further" section for more field options.
 *
 *  All rules share one Drive folder and one "memory" of which
 *  emails have already been handled, so nothing is ever saved
 *  twice.
 * ============================================================
 */

// ----------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------

// The Drive folder all rules save into. The script creates this
// folder itself the first time it runs (see getOrCreateFolder
// below) — you don't need to create it by hand.
const DRIVE_FOLDER_NAME = 'Receipts - App Scripts';

const SEARCH_WINDOW_DAYS = 30;
const MAX_REMEMBERED_IDS = 2000;

// Email new PDFs here as they're saved. Leave blank ('') to disable.
const RECIPIENT_EMAIL = 'PASTE_RECIPIENT_EMAIL_HERE';
const EMAIL_SUBJECT_PREFIX = 'New receipt: ';

const RULES = [
  {
    id: 'anthropic-invoice',
    subjectStartsWith: 'Your receipt from Anthropic',
    attachmentPdfNameContains: 'invoice',
    whenAttachmentFound: 'save',      // save the matching attachment
    whenAttachmentNotFound: 'skip',   // do nothing
  },
  {
    id: 'generic-receipt',
    subjectContains: 'receipt',
    excludeSubjectStartsWith: ['Your receipt from Anthropic'],
    attachmentPdfNameContains: 'receipt',
    whenAttachmentFound: 'skip',            // leave it alone
    whenAttachmentNotFound: 'saveEmailAsPdf', // convert the email to a PDF
  },
  // Add more rules here — copy one of the objects above as a
  // starting point.
];

// ----------------------------------------------------------------
// MAIN FUNCTION — runs every rule, once a day
// ----------------------------------------------------------------
function runAllReceiptRules() {
  const folder = getOrCreateFolder();
  RULES.forEach(rule => processRule(rule, folder));
  if (RECIPIENT_EMAIL) emailNewReceipts(folder);
}

// ----------------------------------------------------------------
// EMAILER — emails any PDF added to the folder since the last run
// ----------------------------------------------------------------
function emailNewReceipts(folder) {
  const props = PropertiesService.getScriptProperties();
  const lastRunIso = props.getProperty('LAST_EMAIL_RUN');
  const lastRunDate = lastRunIso ? new Date(lastRunIso) : new Date(0);
  const runStartedAt = new Date();

  const files = folder.getFilesByType(MimeType.PDF);
  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated() > lastRunDate) {
      MailApp.sendEmail({
        to: RECIPIENT_EMAIL,
        subject: EMAIL_SUBJECT_PREFIX + file.getName(),
        body: `A new receipt PDF, "${file.getName()}", was added to your Drive folder. It is attached to this email.`,
        attachments: [file.getAs(MimeType.PDF)],
      });
    }
  }
  props.setProperty('LAST_EMAIL_RUN', runStartedAt.toISOString());
}

// ----------------------------------------------------------------
// RULE ENGINE — the same logic runs for every rule in RULES
// ----------------------------------------------------------------
function processRule(rule, folder) {
  const processedIds = getProcessedIds(rule.id);
  const query = buildQuery(rule);
  const threads = GmailApp.search(query);
  let count = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const messageId = message.getId();
      if (processedIds.has(messageId)) return;

      const subject = message.getSubject();
      if (!subjectMatchesRule(subject, rule)) {
        processedIds.add(messageId);
        return;
      }

      const matchingAttachment = message.getAttachments().find(att =>
        att.getContentType() === 'application/pdf' &&
        att.getName().toLowerCase().includes(rule.attachmentPdfNameContains.toLowerCase())
      );

      if (matchingAttachment) {
        if (rule.whenAttachmentFound === 'save') {
          folder.createFile(matchingAttachment.copyBlob());
          count++;
        }
      } else if (rule.whenAttachmentNotFound === 'saveEmailAsPdf') {
        saveEmailAsPdf(message, folder);
        count++;
      }

      processedIds.add(messageId);
    });
  });

  saveProcessedIds(rule.id, processedIds);
  console.log(`[${rule.id}] Saved ${count} new file(s).`);
}

// Builds a Gmail search query from a rule's subject fields.
function buildQuery(rule) {
  const parts = [`newer_than:${SEARCH_WINDOW_DAYS}d`];
  if (rule.subjectStartsWith) parts.push(`subject:"${rule.subjectStartsWith}"`);
  if (rule.subjectContains) parts.push(`subject:${rule.subjectContains}`);
  (rule.excludeSubjectStartsWith || []).forEach(text => parts.push(`-subject:"${text}"`));
  return parts.join(' ');
}

// Gmail's search is a loose match, so this double-checks the
// subject really satisfies the rule before acting on it.
function subjectMatchesRule(subject, rule) {
  if (rule.subjectStartsWith && !subject.startsWith(rule.subjectStartsWith)) return false;
  if (rule.subjectContains && !subject.toLowerCase().includes(rule.subjectContains.toLowerCase())) return false;
  if ((rule.excludeSubjectStartsWith || []).some(text => subject.startsWith(text))) return false;
  return true;
}

// ----------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------

// Finds (or creates, the first time ever) the shared Drive folder,
// and remembers its ID so future runs reuse the same folder.
function getOrCreateFolder() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty('FOLDER_ID');
  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (e) {
      // Stored ID is no longer valid (e.g. folder was deleted) — recreate below.
    }
  }
  const folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  console.log(`Created folder "${DRIVE_FOLDER_NAME}" — ID: ${folder.getId()}`);
  console.log('Copy this ID into the New Receipt Emailer script (Script 2) if you use it.');
  return folder;
}

// Turns an email's contents into a PDF file and drops it in the
// given folder, for rules whose whenAttachmentNotFound is
// 'saveEmailAsPdf'.
function saveEmailAsPdf(message, folder) {
  const fileName = sanitizeFilename(message.getSubject()) || 'receipt-email';
  const htmlBody = message.getBody();
  const pdfBlob = Utilities.newBlob(htmlBody, 'text/html', fileName).getAs('application/pdf');
  pdfBlob.setName(fileName + '.pdf');
  folder.createFile(pdfBlob);
}

// Removes characters that aren't safe to use in a file name.
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 120);
}

// Each rule gets its own "memory" of processed message IDs, keyed
// by the rule's id, so rules never interfere with each other.
function getProcessedIds(ruleId) {
  const stored = PropertiesService.getScriptProperties().getProperty(`PROCESSED_IDS_${ruleId}`);
  return new Set(stored ? JSON.parse(stored) : []);
}

function saveProcessedIds(ruleId, idsSet) {
  const idsArray = Array.from(idsSet).slice(-MAX_REMEMBERED_IDS);
  PropertiesService.getScriptProperties().setProperty(`PROCESSED_IDS_${ruleId}`, JSON.stringify(idsArray));
}

// ----------------------------------------------------------------
// ONE-TIME SETUP — run this once to schedule the script to run
// automatically every day. You do NOT need to run this more than once.
// ----------------------------------------------------------------
function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runAllReceiptRules') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runAllReceiptRules')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  console.log('Daily trigger created.');
}
