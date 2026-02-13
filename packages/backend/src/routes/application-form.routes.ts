import { Router, Request, Response } from 'express';
import { applicationFormService } from '../services/application-form.service';
import { formSubmissionService } from '../services/form-submission.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// ============================================================================
// Application Forms Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/application-forms:
 *   get:
 *     summary: Get all application forms for an organisation
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of application forms
 */
router.get(
  '/organisations/:organisationId/application-forms',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const forms = await applicationFormService.getApplicationFormsByOrganisation(organisationId);
      res.json(forms);
    } catch (error) {
      logger.error('Error in GET /application-forms:', error);
      res.status(500).json({ error: 'Failed to fetch application forms' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-forms/{id}:
 *   get:
 *     summary: Get application form by ID
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application form details
 *       404:
 *         description: Application form not found
 */
router.get(
  '/application-forms/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const form = await applicationFormService.getApplicationFormById(id);
      
      if (!form) {
        return res.status(404).json({ error: 'Application form not found' });
      }
      
      return res.json(form);
    } catch (error) {
      logger.error('Error in GET /application-forms/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch application form' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-forms/{id}/with-fields:
 *   get:
 *     summary: Get application form with all fields
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application form with fields
 *       404:
 *         description: Application form not found
 */
router.get(
  '/application-forms/:id/with-fields',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const form = await applicationFormService.getApplicationFormWithFields(id);
      
      if (!form) {
        return res.status(404).json({ error: 'Application form not found' });
      }
      
      return res.json(form);
    } catch (error) {
      logger.error('Error in GET /application-forms/:id/with-fields:', error);
      return res.status(500).json({ error: 'Failed to fetch application form with fields' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-forms:
 *   post:
 *     summary: Create a new application form
 *     tags: [Application Forms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Application form created
 */
router.post(
  '/application-forms',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const form = await applicationFormService.createApplicationForm(req.body);
      res.status(201).json(form);
    } catch (error) {
      logger.error('Error in POST /application-forms:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create application form' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-forms/{id}:
 *   put:
 *     summary: Update an application form
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Application form updated
 *       404:
 *         description: Application form not found
 */
router.put(
  '/application-forms/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const form = await applicationFormService.updateApplicationForm(id, req.body);
      res.json(form);
    } catch (error) {
      logger.error('Error in PUT /application-forms/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update application form' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-forms/{id}:
 *   delete:
 *     summary: Delete an application form
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Application form deleted
 *       404:
 *         description: Application form not found
 */
router.delete(
  '/application-forms/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await applicationFormService.deleteApplicationForm(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /application-forms/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete application form' });
      }
    }
  }
);

// ============================================================================
// Application Fields Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/application-fields:
 *   get:
 *     summary: Get all application fields for an organisation
 *     tags: [Application Fields]
 *     responses:
 *       200:
 *         description: List of application fields
 */
router.get(
  '/application-fields',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const fields = await applicationFormService.getAllApplicationFields();
      res.json(fields);
    } catch (error) {
      logger.error('Error in GET /application-fields:', error);
      res.status(500).json({ error: 'Failed to fetch application fields' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-fields:
 *   post:
 *     summary: Create a new application field
 *     tags: [Application Fields]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Application field created
 */
router.post(
  '/application-fields',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      // Extract organisationId from request body
      const organisationId = req.body.organisationId;
      
      if (!organisationId) {
        return res.status(400).json({ error: 'organisationId is required' });
      }

      const field = await applicationFormService.createApplicationField(req.body);
      res.status(201).json(field);
    } catch (error) {
      logger.error('Error in POST /application-fields:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create application field' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-fields/{id}:
 *   get:
 *     summary: Get application field by ID
 *     tags: [Application Fields]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application field details
 *       404:
 *         description: Application field not found
 */
router.get(
  '/application-fields/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const field = await applicationFormService.getApplicationFieldById(id);
      
      if (!field) {
        return res.status(404).json({ error: 'Application field not found' });
      }
      
      return res.json(field);
    } catch (error) {
      logger.error('Error in GET /application-fields/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch application field' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-fields/{id}:
 *   put:
 *     summary: Update an application field
 *     tags: [Application Fields]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Application field updated
 *       404:
 *         description: Application field not found
 */
router.put(
  '/application-fields/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Extract organisationId from request body if provided
      const organisationId = req.body.organisationId;
      
      if (!organisationId) {
        return res.status(400).json({ error: 'organisationId is required' });
      }

      const field = await applicationFormService.updateApplicationField(id, req.body);
      res.json(field);
    } catch (error) {
      logger.error('Error in PUT /application-fields/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update application field' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-fields/{id}:
 *   delete:
 *     summary: Delete an application field
 *     tags: [Application Fields]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Application field deleted
 *       404:
 *         description: Application field not found
 */
router.delete(
  '/application-fields/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await applicationFormService.deleteApplicationField(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /application-fields/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete application field' });
      }
    }
  }
);

// ============================================================================
// Form Field Association Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/application-forms/{formId}/fields:
 *   post:
 *     summary: Add a field to a form
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Field added to form
 */
router.post(
  '/application-forms/:formId/fields',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { formId } = req.params;
      const data = { ...req.body, formId };
      const formField = await applicationFormService.addFieldToForm(data);
      res.status(201).json(formField);
    } catch (error) {
      logger.error('Error in POST /application-forms/:formId/fields:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to add field to form' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/application-forms/{formId}/fields/{fieldId}:
 *   delete:
 *     summary: Remove a field from a form
 *     tags: [Application Forms]
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fieldId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Field removed from form
 *       404:
 *         description: Field not found in form
 */
router.delete(
  '/application-forms/:formId/fields/:fieldId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { formId, fieldId } = req.params;
      await applicationFormService.removeFieldFromForm(formId, fieldId);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /application-forms/:formId/fields/:fieldId:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to remove field from form' });
      }
    }
  }
);

// ============================================================================
// Form Submissions Routes (Unified)
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/form-submissions:
 *   get:
 *     summary: Get all form submissions for an organisation with filters
 *     tags: [Form Submissions]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: submissionType
 *         schema:
 *           type: string
 *           enum: [event_entry, membership_application, calendar_booking, merchandise_order, registration]
 *       - in: query
 *         name: contextId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: formId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of form submissions
 */
router.get(
  '/organisations/:organisationId/form-submissions',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { submissionType, contextId, status, userId, formId, startDate, endDate } = req.query;
      
      const filters = {
        submissionType: submissionType as any,
        contextId: contextId as string,
        status: status as any,
        userId: userId as string,
        formId: formId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };
      
      const submissions = await formSubmissionService.getSubmissionsByOrganisation(
        organisationId,
        filters
      );
      res.json(submissions);
    } catch (error) {
      logger.error('Error in GET /form-submissions:', error);
      res.status(500).json({ error: 'Failed to fetch form submissions' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submissions/{id}:
 *   get:
 *     summary: Get form submission by ID
 *     tags: [Form Submissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form submission details
 *       404:
 *         description: Form submission not found
 */
router.get(
  '/form-submissions/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const submission = await formSubmissionService.getSubmissionById(id);
      
      if (!submission) {
        return res.status(404).json({ error: 'Form submission not found' });
      }
      
      return res.json(submission);
    } catch (error) {
      logger.error('Error in GET /form-submissions/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch form submission' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submissions/{id}/with-files:
 *   get:
 *     summary: Get form submission with all files
 *     tags: [Form Submissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form submission with files
 *       404:
 *         description: Form submission not found
 */
router.get(
  '/form-submissions/:id/with-files',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const submission = await formSubmissionService.getSubmissionWithFiles(id);
      
      if (!submission) {
        return res.status(404).json({ error: 'Form submission not found' });
      }
      
      return res.json(submission);
    } catch (error) {
      logger.error('Error in GET /form-submissions/:id/with-files:', error);
      return res.status(500).json({ error: 'Failed to fetch form submission with files' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submissions:
 *   post:
 *     summary: Create a new form submission
 *     tags: [Form Submissions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Form submission created
 */
router.post(
  '/form-submissions',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const submission = await formSubmissionService.createSubmission(req.body);
      res.status(201).json(submission);
    } catch (error) {
      logger.error('Error in POST /form-submissions:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create form submission' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submissions/{id}:
 *   put:
 *     summary: Update a form submission
 *     tags: [Form Submissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Form submission updated
 *       404:
 *         description: Form submission not found
 */
router.put(
  '/form-submissions/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const submission = await formSubmissionService.updateSubmission(id, req.body);
      res.json(submission);
    } catch (error) {
      logger.error('Error in PUT /form-submissions/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update form submission' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submissions/{id}:
 *   delete:
 *     summary: Delete a form submission
 *     tags: [Form Submissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Form submission deleted
 *       404:
 *         description: Form submission not found
 */
router.delete(
  '/form-submissions/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await formSubmissionService.deleteSubmission(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /form-submissions/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete form submission' });
      }
    }
  }
);

// ============================================================================
// Form Submission Files Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/form-submissions/{submissionId}/files:
 *   get:
 *     summary: Get all files for a submission
 *     tags: [Form Submission Files]
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of submission files
 */
router.get(
  '/form-submissions/:submissionId/files',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const files = await formSubmissionService.getFilesBySubmission(submissionId);
      res.json(files);
    } catch (error) {
      logger.error('Error in GET /form-submissions/:submissionId/files:', error);
      res.status(500).json({ error: 'Failed to fetch submission files' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submission-files:
 *   post:
 *     summary: Create a form submission file record
 *     tags: [Form Submission Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Form submission file created
 */
router.post(
  '/form-submission-files',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const file = await formSubmissionService.createSubmissionFile(req.body);
      res.status(201).json(file);
    } catch (error) {
      logger.error('Error in POST /form-submission-files:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create form submission file' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submission-files/{id}:
 *   get:
 *     summary: Get form submission file by ID
 *     tags: [Form Submission Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form submission file details
 *       404:
 *         description: Form submission file not found
 */
router.get(
  '/form-submission-files/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const file = await formSubmissionService.getFileById(id);
      
      if (!file) {
        return res.status(404).json({ error: 'Form submission file not found' });
      }
      
      return res.json(file);
    } catch (error) {
      logger.error('Error in GET /form-submission-files/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch form submission file' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/form-submission-files/{id}:
 *   delete:
 *     summary: Delete a form submission file
 *     tags: [Form Submission Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Form submission file deleted
 *       404:
 *         description: Form submission file not found
 */
router.delete(
  '/form-submission-files/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await formSubmissionService.deleteSubmissionFile(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /form-submission-files/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete form submission file' });
      }
    }
  }
);

export default router;
