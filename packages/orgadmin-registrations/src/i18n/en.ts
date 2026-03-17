/**
 * English translation keys for the Registrations Module.
 *
 * This is a reference file documenting every translation key used across the
 * module's components and pages.  The actual translations are loaded at runtime
 * by the shell's i18n system; this file serves as the canonical catalogue so
 * that property tests can verify full coverage.
 */

const registrationsTranslationKeys = {
  // ── Module-level (card / menu) ──────────────────────────────────────
  'modules.registrations.name': 'Registrations',
  'modules.registrations.title': 'Registrations',
  'modules.registrations.description': 'Manage entity registrations',
  'modules.registrations.menu.registrationsDatabase': 'Registrations Database',
  'modules.registrations.menu.registrationTypes': 'Registration Types',
  'modules.registrations.menu.discounts': 'Discounts',

  // ── Page titles / headings ──────────────────────────────────────────
  'registrations.registrationsDatabase': 'Registrations Database',
  'registrations.registrationTypes': 'Registration Types',
  'registrations.createRegistrationType': 'Create Registration Type',
  'registrations.editRegistrationType': 'Edit Registration Type',

  // ── Loading / empty states ──────────────────────────────────────────
  'registrations.loadingRegistrations': 'Loading registrations…',
  'registrations.loadingTypes': 'Loading registration types…',
  'registrations.loadingType': 'Loading registration type…',
  'registrations.loadingRegistration': 'Loading registration…',
  'registrations.noRegistrationsFound': 'No registrations found',
  'registrations.noTypesFound': 'No registration types yet. Create your first registration type to get started.',
  'registrations.noMatchingTypes': 'No matching registration types found',
  'registrations.typeNotFound': 'Registration type not found',
  'registrations.registrationNotFound': 'Registration not found',
  'registrations.failedToLoad': 'Failed to load registration',
  'registrations.failedToSave': 'Failed to save registration type',

  // ── Search ──────────────────────────────────────────────────────────
  'registrations.searchPlaceholder': 'Search…',

  // ── Table headers ───────────────────────────────────────────────────
  'registrations.table.name': 'Name',
  'registrations.table.entityName': 'Entity Name',
  'registrations.table.ownerName': 'Owner Name',
  'registrations.table.registrationNumber': 'Registration Number',
  'registrations.table.dateLastRenewed': 'Date Last Renewed',
  'registrations.table.status': 'Status',
  'registrations.table.validUntil': 'Valid Until',
  'registrations.table.labels': 'Labels',
  'registrations.table.processed': 'Processed',
  'registrations.table.actions': 'Actions',
  'registrations.table.registrationType': 'Registration Type',
  'registrations.table.createdAt': 'Created At',

  // ── Status labels ───────────────────────────────────────────────────
  'registrations.status.active': 'Active',
  'registrations.status.pending': 'Pending',
  'registrations.status.elapsed': 'Elapsed',
  'registrations.statusOptions.all': 'All',
  'registrations.statusOptions.current': 'Current',
  'registrations.statusOptions.elapsed': 'Elapsed',
  'registrations.statusOptions.open': 'Open',
  'registrations.statusOptions.closed': 'Closed',

  // ── Processed flag ──────────────────────────────────────────────────
  'registrations.processedStatus.processed': 'Processed',
  'registrations.processedStatus.unprocessed': 'Unprocessed',

  // ── Actions / buttons ───────────────────────────────────────────────
  'registrations.actions.exportToExcel': 'Export to Excel',
  'registrations.actions.addRegistration': 'Add Registration',
  'registrations.actions.markProcessed': 'Mark Processed',
  'registrations.actions.markUnprocessed': 'Mark Unprocessed',
  'registrations.actions.addLabels': 'Add Labels',
  'registrations.actions.removeLabels': 'Remove Labels',
  'registrations.actions.add': 'Add',
  'registrations.actions.execute': 'Execute',
  'registrations.actions.cancel': 'Cancel',
  'registrations.actions.saveAsDraft': 'Save as Draft',
  'registrations.actions.saveAndPublish': 'Save and Publish',
  'registrations.actions.update': 'Update',

  // ── Tooltips ────────────────────────────────────────────────────────
  'registrations.tooltips.viewDetails': 'View details',
  'registrations.tooltips.edit': 'Edit',
  'registrations.tooltips.markProcessed': 'Mark as processed',
  'registrations.tooltips.markUnprocessed': 'Mark as unprocessed',

  // ── Detail page sections ────────────────────────────────────────────
  'registrations.sections.registrationInfo': 'Registration Information',
  'registrations.sections.statusAndDates': 'Status & Dates',
  'registrations.sections.labels': 'Labels',
  'registrations.sections.paymentInfo': 'Payment Information',
  'registrations.sections.formSubmissionData': 'Form Submission Data',
  'registrations.sections.basicInfo': 'Basic Information',
  'registrations.sections.discounts': 'Discounts',

  // ── Detail page field labels ────────────────────────────────────────
  'registrations.fields.registrationNumber': 'Registration Number',
  'registrations.fields.entityName': 'Entity Name',
  'registrations.fields.ownerName': 'Owner Name',
  'registrations.fields.registrationType': 'Registration Type',
  'registrations.fields.status': 'Status',
  'registrations.fields.validUntil': 'Valid Until',
  'registrations.fields.dateLastRenewed': 'Date Last Renewed',
  'registrations.fields.processed': 'Processed',
  'registrations.fields.paymentStatus': 'Payment Status',
  'registrations.fields.paymentMethod': 'Payment Method',

  // ── Labels section ──────────────────────────────────────────────────
  'registrations.labels.noLabelsAssigned': 'No labels assigned',

  // ── Back navigation ─────────────────────────────────────────────────
  'registrations.details.backToRegistrations': 'Back to Registrations',
  'registrations.details.backToTypes': 'Back to Registration Types',

  // ── Delete confirmation ─────────────────────────────────────────────
  'registrations.delete.title': 'Delete Registration Type',
  'registrations.delete.message': 'Are you sure you want to delete this registration type? This action cannot be undone.',

  // ── Batch operations ────────────────────────────────────────────────
  'registrations.batch.title': 'Batch Operation',
  'registrations.batch.markProcessed.title': 'Mark as Processed',
  'registrations.batch.markProcessed.message': 'Mark {{count}} registration(s) as processed?',
  'registrations.batch.markUnprocessed.title': 'Mark as Unprocessed',
  'registrations.batch.markUnprocessed.message': 'Mark {{count}} registration(s) as unprocessed?',
  'registrations.batch.addLabels.title': 'Add Labels',
  'registrations.batch.addLabels.message': 'Add labels to {{count}} registration(s)',
  'registrations.batch.addLabels.labelsToAdd': 'Labels to add',
  'registrations.batch.removeLabels.title': 'Remove Labels',
  'registrations.batch.removeLabels.message': 'Remove labels from {{count}} registration(s)',
  'registrations.batch.removeLabels.labelsToRemove': 'Labels to remove',
  'registrations.batch.labelPlaceholder': 'Type a label and press Enter',
  'registrations.batch.processing': 'Processing…',
  'registrations.batch.error': 'Batch operation failed. Please try again.',

  // ── Filters ─────────────────────────────────────────────────────────
  'registrations.filters.customFilter': 'Custom Filter',
  'registrations.filters.none': 'None',
  'registrations.filters.createFilter': 'Create Filter',
  'registrations.filters.createTitle': 'Create Custom Filter',
  'registrations.filters.name': 'Filter Name',
  'registrations.filters.save': 'Save Filter',
  'registrations.filters.status': 'Status',
  'registrations.filters.registrationTypes': 'Registration Types',
  'registrations.filters.labels': 'Labels',
  'registrations.filters.addLabel': 'Add Label',
  'registrations.filters.dateLastRenewed': 'Date Last Renewed',
  'registrations.filters.validUntil': 'Valid Until',
  'registrations.filters.afterDate': 'After',
  'registrations.filters.beforeDate': 'Before',
  'registrations.filters.validation.nameRequired': 'Filter name is required',
  'registrations.filters.validation.criteriaRequired': 'At least one filter criterion is required',
  'registrations.filters.validation.dateRangeInvalid': 'The "after" date must not be later than the "before" date',

  // ── Registration creation ───────────────────────────────────────────
  'registrations.creation.selectType': 'Select Registration Type',
  'registrations.creation.title': 'Create Registration',
  'registrations.creation.entityName': 'Entity Name',
  'registrations.creation.name': 'Name',
  'registrations.creation.ownerName': 'Owner Name',
  'registrations.creation.loadingFields': 'Loading form fields…',
  'registrations.creation.statusActive': 'This registration will be automatically approved (Active)',
  'registrations.creation.statusPending': 'This registration will require manual approval (Pending)',
  'registrations.creation.submit': 'Create Registration',
  'registrations.creation.submitting': 'Creating…',
  'registrations.creation.success': 'Registration created successfully',
  'registrations.creation.error': 'Failed to create registration',
  'registrations.creation.validationError': 'Please fill in all required fields',
  'registrations.creation.noTypesAvailable': 'No registration types available',
  'registrations.creation.fieldRequired': '{{field}} is required',
  'registrations.creation.invalidEmail': 'Invalid email format',
  'registrations.creation.invalidNumber': 'Invalid number',

  // ── Validation messages ─────────────────────────────────────────────
  'registrations.validation.nameRequired': 'Name is required',
  'registrations.validation.descriptionRequired': 'Description is required',
  'registrations.validation.entityNameRequired': 'Entity Name is required',
  'registrations.validation.formRequired': 'Registration form is required',
  'registrations.validation.validUntilRequired': 'Valid until date is required for fixed-period registrations',
  'registrations.validation.numberOfMonthsRequired': 'Number of months is required for rolling registrations',
  'registrations.validation.paymentMethodRequired': 'At least one payment method is required',
  'registrations.validation.termsRequired': 'Terms and conditions text is required when enabled',

  // ── Discounts ───────────────────────────────────────────────────────
  'registrations.discounts.selectorHelperText': 'Associate discounts with this registration type',
  'registrations.discounts.selectLabel': 'Select Discounts',
  'registrations.discounts.selectHelperText': 'Choose applicable discounts for this registration type',

  // ── Common actions (shared across modules) ──────────────────────────
  'common.actions.back': 'Back',
  'common.actions.edit': 'Edit',
  'common.actions.delete': 'Delete',
  'common.actions.cancel': 'Cancel',
  'common.actions.save': 'Save',
} as const;

export type TranslationKey = keyof typeof registrationsTranslationKeys;

export default registrationsTranslationKeys;
