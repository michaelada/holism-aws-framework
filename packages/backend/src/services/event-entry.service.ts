import { db } from '../database/pool';
import { logger } from '../config/logger';
/*
 * The **named** export, not the default one.
 *
 * `exceljs`'s typings declare `export default Workbook` and its CommonJS module
 * exports a namespace with no `default` at all — so `new ExcelJS()` type-checked
 * and threw "is not a constructor" at runtime, and every Excel export in this
 * application produced a file the operating system refuses to open. It survived
 * because the suites mock `exceljs` with a class of their own, which is exactly
 * the shape the real module does not have.
 */
import { Workbook } from 'exceljs';
import { formSummariesFor, formatAnswer, FormAnswer } from '../utils/form-summary';
import { validateSubmissionData } from '../utils/application-field-validation';
import { splitName } from './entrant.service';
import { applicationFormService } from './application-form.service';
import { formSubmissionService } from './form-submission.service';
import { NotFoundError, ValidationError } from '../middleware/errors';

/**
 * EventEntry interface matching database schema
 */
export interface EventEntry {
  id: string;
  eventId: string;
  eventActivityId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  formSubmissionId?: string;
  quantity: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
  /**
   * `active`, or `removed` where the entry was withdrawn with a refund.
   *
   * A withdrawn entry is off the entrant list and still in the system: it
   * happened, it was paid for, and it was refunded, and all three are worth
   * keeping.
   */
  entryStatus: string;
  removedAt?: Date | null;
  removalReason?: string | null;
  // Populated fields from joins
  activityName?: string;
  eventName?: string;
  /**
   * The account holder who made the entry.
   *
   * Not the entrant: a parent enters three children, a secretary enters half
   * the club. `email` on the entry is this person's too — it is where the club
   * writes about the entry — so the two belong together wherever they are
   * shown.
   */
  enteredByName?: string | null;
  memberId?: string | null;
}

/**
 * One entry, with everything the club needs to answer a question about it.
 *
 * The list gives a name and a status. A secretary taking a phone call needs the
 * rest: which class, what it cost, what the entrant wrote on the form, and
 * which payment it came in on — none of which the list can carry and all of
 * which used to require the database.
 */
export interface EventEntryDetail extends EventEntry {
  activityDescription: string | null;
  activityFee: number | null;
  eventStartDate: Date | null;
  eventEndDate: Date | null;
  /** What the entrant filled in. Empty where the activity asked nothing. */
  formSummary: FormAnswer[];
  /**
   * The activity's form, and the answers as they are stored.
   *
   * `formSummary` is for reading — labelled, formatted, and with the blanks
   * left out. An editor needs the opposite: the form's **every** field, and the
   * raw values keyed by field name, so a question nobody answered is a blank
   * box rather than a question the club cannot see.
   */
  applicationFormId: string | null;
  formValues: Record<string, unknown>;
  /** The payment this entry was part of, where it came through a basket. */
  paymentId: string | null;
  paymentAmount: number | null;
  paymentDate: Date | null;
  paymentReference: string | null;
  /** The member record behind the entrant, where they entered as one. */
  memberName: string | null;
}

/**
 * Filter options for event entries
 */
export interface EventEntryFilters {
  eventActivityId?: string;
  searchName?: string;
  /**
   * Include entries withdrawn with a refund. Off by default: the entrant list
   * is what a club prints on the day, and somebody who has been refunded is
   * not coming.
   */
  includeRemoved?: boolean;
}

/**
 * Service for managing event entries
 */
export class EventEntryService {
  /**
   * Convert database row to EventEntry object
   */
  private rowToEventEntry(row: any): EventEntry {
    return {
      id: row.id,
      eventId: row.event_id,
      eventActivityId: row.event_activity_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      formSubmissionId: row.form_submission_id,
      quantity: row.quantity,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      entryDate: row.entry_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activityName: row.activity_name,
      eventName: row.event_name,
      enteredByName: row.entered_by_name ?? null,
      memberId: row.member_id ?? null,
      entryStatus: row.entry_status ?? 'active',
      removedAt: row.removed_at ?? null,
      removalReason: row.removal_reason ?? null,
    };
  }

  /**
   * Get all entries for an event
   */
  async getEntriesByEvent(eventId: string, filters?: EventEntryFilters): Promise<EventEntry[]> {
    try {
      let query = `
        SELECT 
          ee.*,
          ea.name as activity_name,
          e.name as event_name,
          -- Who made the entry, which is not who it is for.
          NULLIF(TRIM(CONCAT_WS(' ', ou.first_name, ou.last_name)), '') AS entered_by_name
        FROM event_entries ee
        JOIN event_activities ea ON ee.event_activity_id = ea.id
        JOIN events e ON ee.event_id = e.id
        LEFT JOIN organization_users ou ON ou.id = ee.user_id
        WHERE ee.event_id = $1
      `;
      const params: any[] = [eventId];
      let paramCount = 2;

      /*
       * Withdrawn entries are out unless asked for. Refunding an entry used to
       * leave the rider on the class list, so a club printing it on the day got
       * somebody who had been refunded weeks earlier.
       */
      if (!filters?.includeRemoved) {
        query += ` AND ee.entry_status <> 'removed'`;
      }

      // Apply activity filter
      if (filters?.eventActivityId) {
        query += ` AND ee.event_activity_id = $${paramCount++}`;
        params.push(filters.eventActivityId);
      }

      // Apply name search filter
      if (filters?.searchName) {
        query += ` AND (
          LOWER(ee.first_name) LIKE LOWER($${paramCount}) OR 
          LOWER(ee.last_name) LIKE LOWER($${paramCount})
        )`;
        params.push(`%${filters.searchName}%`);
        paramCount++;
      }

      query += ' ORDER BY ee.entry_date DESC';

      const result = await db.query(query, params);
      return result.rows.map(row => this.rowToEventEntry(row));
    } catch (error) {
      logger.error('Error getting entries by event:', error);
      throw error;
    }
  }

  /**
   * One entry, in full.
   *
   * The activity and the event it belongs to, the fee, the answers the entrant
   * gave, the payment it arrived on and the member behind it — everything the
   * entry detail screen shows. The screen replaced a link that led to the
   * entrant *list*, which answered none of it.
   *
   * The payment is found through `payment_transactions.fulfilment_ref`, the
   * same link the payment screen follows in the other direction. An entry
   * created before baskets existed, or one added by hand, simply has none.
   */
  async getEntryById(id: string): Promise<EventEntryDetail | null> {
    try {
      const result = await db.query(
        `SELECT 
          ee.*,
          ea.name as activity_name,
          ea.description as activity_description,
          ea.fee as activity_fee,
          ea.application_form_id,
          e.name as event_name,
          e.start_date, e.end_date,
          NULLIF(TRIM(CONCAT_WS(' ', mem.first_name, mem.last_name)), '') AS member_name,
          fs.submission_data,
          p.id AS payment_id,
          p.amount AS payment_amount,
          p.payment_date AS payment_date,
          p.provider_transaction_id AS payment_reference
        FROM event_entries ee
        JOIN event_activities ea ON ee.event_activity_id = ea.id
        JOIN events e ON ee.event_id = e.id
        LEFT JOIN members mem ON mem.id = ee.member_id
        LEFT JOIN form_submissions fs ON fs.id = ee.form_submission_id
        LEFT JOIN payment_transactions pt
               ON pt.item_type = 'event_entry' AND pt.fulfilment_ref = ee.id
        LEFT JOIN payments p ON p.id = pt.payment_id
        WHERE ee.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      /*
       * The answers, joined to their labels. `submission_data` is keyed by
       * field name and holds raw values, so on its own it is unreadable — the
       * same helper the member's own screens use, rather than a second
       * implementation free to disagree with them about how an unanswered
       * optional field looks.
       */
      const answers = await formSummariesFor([row.form_submission_id]);

      return {
        ...this.rowToEventEntry(row),
        activityDescription: row.activity_description ?? null,
        activityFee: row.activity_fee === null ? null : Number(row.activity_fee),
        eventStartDate: row.start_date ?? null,
        eventEndDate: row.end_date ?? null,
        formSummary: answers.get(row.form_submission_id) ?? [],
        applicationFormId: row.application_form_id ?? null,
        formValues: row.submission_data ?? {},
        paymentId: row.payment_id ?? null,
        paymentAmount: row.payment_amount === null ? null : Number(row.payment_amount),
        paymentDate: row.payment_date ?? null,
        paymentReference: row.payment_reference ?? null,
        memberName: row.member_name ?? null,
      };
    } catch (error) {
      logger.error('Error getting entry by ID:', error);
      throw error;
    }
  }

  /**
   * Filter entries by activity and name
   */
  async filterEntries(eventId: string, filters: EventEntryFilters): Promise<EventEntry[]> {
    return this.getEntriesByEvent(eventId, filters);
  }

  /**
   * Correct the answers on an entry.
   *
   * The club's own remedy for a member's mistake — a pony's name spelled wrong,
   * a vaccination date a year out — which until now meant the database. The
   * entry itself is untouched: this is about what was *said* on the form, not
   * about who is entered or what they paid.
   *
   * Three things it insists on:
   *
   *  - **The entry belongs to the event named in the URL.** The guard on the
   *    route authorises the event; without this an entry id from another club
   *    could be corrected by naming one of your own events.
   *  - **The answers are checked against the form's own fields**, by the same
   *    validator the member's submission went through. An administrator typing
   *    into a date box is as able to produce nonsense as anybody else, and a
   *    bad submission is a bad record rather than a bad screen.
   *  - **A missing submission is created, not refused.** An entry made before
   *    the club added a form to the activity has answers to give and nowhere to
   *    put them; refusing would leave the screen offering an edit that cannot
   *    be saved.
   */
  async updateEntryAnswers(
    eventId: string,
    entryId: string,
    answers: Record<string, unknown>,
    /**
     * The entrant's name, where the club is correcting that too.
     *
     * One string, as it was typed — split here with the same helper fulfilment
     * splits it with, so a correction and an entry are stored the same way.
     * The membership link is deliberately left alone: a club fixing a spelling
     * has not said the entry is for somebody else.
     */
    name?: string
  ): Promise<EventEntryDetail> {
    const entry = await this.getEntryById(entryId);

    if (!entry || entry.eventId !== eventId) {
      throw new NotFoundError('Entry not found');
    }
    if (typeof name === 'string' && name.trim().length === 0) {
      // An empty name would leave the entrant list with a blank row, which is
      // the one thing that list cannot be.
      throw new ValidationError('Enter the name of the person this entry is for');
    }
    const renaming = typeof name === 'string';

    /*
     * An activity with no form can still have its name corrected — that is the
     * commoner mistake — so this is refused only when there are answers to
     * store and nowhere to put them.
     */
    if (!entry.applicationFormId && Object.keys(answers).length > 0) {
      throw new ValidationError('This activity has no form to correct');
    }

    /*
     * Everything is checked before anything is written.
     *
     * The name and the answers are corrected in one sitting, so a refusal has
     * to leave the entry as it was: renaming first and validating afterwards
     * meant a rejected form still renamed the entrant, and the club saw an
     * error over a screen that had already half-changed underneath it.
     */
    const form = entry.applicationFormId
      ? await applicationFormService.getApplicationFormWithFields(entry.applicationFormId)
      : null;

    if (entry.applicationFormId && !form) {
      throw new NotFoundError('The form for this activity could not be found');
    }

    if (form) {
      const fieldErrors = validateSubmissionData(form.fields as any, answers);
      if (fieldErrors.length > 0) {
        throw new ValidationError('Some answers need correcting', fieldErrors);
      }
    }

    if (renaming) {
      const { firstName, lastName } = splitName(name!);
      await db.query(
        `UPDATE event_entries SET first_name = $1, last_name = $2, updated_at = NOW()
          WHERE id = $3`,
        [firstName, lastName, entryId]
      );
    }

    if (!form) return (await this.getEntryById(entryId))!;

    if (entry.formSubmissionId) {
      await formSubmissionService.updateSubmission(entry.formSubmissionId, {
        submissionData: answers,
      });
    } else {
      const created = await formSubmissionService.createSubmission({
        formId: entry.applicationFormId!,
        organisationId: form.organisationId,
        userId: entry.userId,
        submissionType: 'event_entry',
        contextId: entry.eventActivityId,
        submissionData: answers,
        status: 'approved',
      });

      await db.query(`UPDATE event_entries SET form_submission_id = $1, updated_at = NOW() WHERE id = $2`, [
        created.id,
        entryId,
      ]);
    }

    logger.info('Entry answers corrected', { entryId, eventId });

    return (await this.getEntryById(entryId))!;
  }

  /**
   * The fields each activity's form asks for, in the order it asks them.
   *
   * The **form's** fields, not the answered ones: a column has to exist for a
   * question nobody answered, or the sheet's columns change shape with its
   * rows and two entries stop lining up. `formSummariesFor` drops blanks, which
   * is right for a summary and wrong for a table.
   */
  private async formFieldsByActivity(
    eventId: string
  ): Promise<Map<string, Array<{ name: string; label: string }>>> {
    const result = await db.query(
      `SELECT a.id AS activity_id, af.name AS field_name, af.label
         FROM event_activities a
         JOIN application_form_fields aff ON aff.form_id = a.application_form_id
         JOIN application_fields af ON af.id = aff.field_id
        WHERE a.event_id = $1
        ORDER BY a.id, aff."order"`,
      [eventId]
    );

    const fields = new Map<string, Array<{ name: string; label: string }>>();
    for (const row of result.rows) {
      const forActivity = fields.get(row.activity_id) ?? [];
      forActivity.push({ name: row.field_name, label: row.label || row.field_name });
      fields.set(row.activity_id, forActivity);
    }
    return fields;
  }

  /** What each entry's form submission holds, by submission id. */
  private async submissionsFor(
    submissionIds: Array<string | null | undefined>
  ): Promise<Map<string, Record<string, unknown>>> {
    const ids = [...new Set(submissionIds.filter(Boolean))] as string[];
    if (ids.length === 0) return new Map();

    const result = await db.query(
      `SELECT id, submission_data FROM form_submissions WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    return new Map(result.rows.map((row: any) => [row.id, row.submission_data ?? {}]));
  }

  /**
   * Export entries to Excel, one sheet per activity.
   *
   * Each sheet carries **a column for every field of that activity's form**, and
   * a row per entry with what that entrant answered. A club exporting a class
   * list is nearly always after the answers — the horse's name, the vaccination
   * date, the emergency contact — and the export used to carry eight fixed
   * columns and none of them.
   *
   * Per activity rather than per event because the columns belong to the *form*,
   * and two activities of one event may ask entirely different questions.
   */
  async exportEntriesToExcel(eventId: string): Promise<Buffer> {
    try {
      // Get event details
      const eventResult = await db.query(
        'SELECT name FROM events WHERE id = $1',
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        throw new Error('Event not found');
      }

      const eventName = eventResult.rows[0].name;

      const entries = await this.getEntriesByEvent(eventId);
      const fieldsByActivity = await this.formFieldsByActivity(eventId);
      const submissions = await this.submissionsFor(entries.map((entry) => entry.formSubmissionId));

      /*
       * Grouped by activity **id**, not name. A two-day event runs "80cm" on
       * both days: merging them produces a class list no class ever had, and —
       * since the columns come from the form — potentially one whose columns
       * belong to neither.
       */
      const byActivity = new Map<string, { name: string; entries: EventEntry[] }>();
      for (const entry of entries) {
        const group = byActivity.get(entry.eventActivityId) ?? {
          name: entry.activityName || 'Unknown Activity',
          entries: [],
        };
        group.entries.push(entry);
        byActivity.set(entry.eventActivityId, group);
      }

      const workbook = new Workbook();
      workbook.creator = 'ItsPlainSailing';
      workbook.created = new Date();

      /*
       * A workbook with no sheets cannot be opened. An event nobody has entered
       * is a perfectly ordinary thing to export — a club checking the form
       * before entries open — so it gets a sheet saying so.
       */
      if (byActivity.size === 0) {
        const empty = workbook.addWorksheet('Entries');
        empty.addRow([eventName]).font = { bold: true, size: 14 };
        empty.addRow([]);
        empty.addRow(['No entries yet.']);
      }

      /*
       * Sheet names have to be unique, and two activities may share one.
       *
       * A two-day event running "80cm" on both days produced two sheets of
       * that name — and exceljs *throws* on the second, so the whole export
       * failed rather than losing a sheet. Numbered, and re-trimmed: the
       * limit is 31 characters including the suffix.
       */
      const usedNames = new Set<string>();

      for (const [activityId, activity] of byActivity) {
        // Excel forbids : \ / ? * [ ] in a sheet name, and caps it at 31.
        const base = activity.name.substring(0, 31).replace(/[:\\/?*[\]]/g, '_');
        let sheetName = base;
        for (let suffix = 2; usedNames.has(sheetName); suffix += 1) {
          const tail = ` (${suffix})`;
          sheetName = `${base.substring(0, 31 - tail.length)}${tail}`;
        }
        usedNames.add(sheetName);

        const worksheet = workbook.addWorksheet(sheetName);

        const formFields = fieldsByActivity.get(activityId) ?? [];
        /*
         * What the sheet is *about* on the left, the administration on the
         * right.
         *
         * A club reading a class list wants the date, the name and the answers
         * to its own questions; the email, how it was paid and by whom are
         * there to be looked up rather than scanned, and were sitting between
         * the name and the first thing the club actually asked for. Status is
         * last because it is the column most often sorted on.
         */
        const headers = [
          'Entry Date',
          /*
           * One name column, not two.
           *
           * The name is **typed as one string** into "Who is this entry for?"
           * and split at the first space only so the schema has somewhere to
           * put it. Two columns present that split as though the club had
           * asked for it: "Áine de Búrca" arrives as a surname of "de Búrca",
           * and a single-word name — which an open activity accepts — arrives
           * as a first name with an empty column beside it.
           *
           * Rejoining is lossless: `splitName` cuts at the first space and
           * normalises the whitespace, so the two halves put back together are
           * the name as it was given.
           */
          'Name',
          ...formFields.map((field) => field.label),
          'Email',
          'Payment Method',
          /** The account holder who made the entry, which is not the entrant. */
          'Entered By',
          'Entry ID',
          'Status',
        ];

        const titleRow = worksheet.addRow([`${eventName} - ${activity.name}`]);
        titleRow.font = { bold: true, size: 14 };
        worksheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));
        titleRow.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        for (const entry of activity.entries) {
          const answers = entry.formSubmissionId
            ? (submissions.get(entry.formSubmissionId) ?? {})
            : {};

          worksheet.addRow([
            entry.entryDate,
            [entry.firstName, entry.lastName].filter(Boolean).join(' '),
            /*
             * Blank where a question was not answered — the same helper the
             * member's own screens format answers with, so a "Yes" here and a
             * "Yes" there mean the same thing rather than being `true` in one
             * place and "Yes" in the other.
             */
            ...formFields.map((field) => formatAnswer(answers[field.name])),
            entry.email,
            entry.paymentMethod || 'N/A',
            entry.enteredByName ?? '',
            entry.id,
            entry.paymentStatus,
          ]);
        }

        worksheet.columns = [
          { width: 20 },
          { width: 28 },
          ...formFields.map(() => ({ width: 22 })),
          { width: 28 },
          { width: 15 },
          { width: 24 },
          { width: 36 },
          { width: 14 },
        ];

        worksheet.getColumn(1).numFmt = 'yyyy-mm-dd hh:mm:ss';

        worksheet.eachRow((row: any, rowNumber: number) => {
          if (rowNumber > 2) {
            row.eachCell((cell: any) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            });
          }
        });

        worksheet.addRow([]);
        // The count alone. "Total Quantity" summed a column that is no longer
        // there — a quantity of one on every entry, which said nothing.
        const summaryRow = worksheet.addRow(['Total Entries:', activity.entries.length]);
        summaryRow.font = { bold: true };
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      logger.info(`Excel export generated for event: ${eventId}`);
      /*
       * `Buffer.from`, not a cast: `writeBuffer` answers exceljs's own `Buffer`
       * interface, which is not Node's. Casting between them compiled only
       * because a hand-written `exceljs.d.ts` in this repo declared the library
       * as something it is not.
       */
      return Buffer.from(buffer as ArrayBuffer);
    } catch (error) {
      logger.error('Error exporting entries to Excel:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const eventEntryService = new EventEntryService();
