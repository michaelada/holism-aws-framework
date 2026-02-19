import { ApplicationFormService } from '../application-form.service';
import { FormSubmissionService } from '../form-submission.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('ApplicationFormService', () => {
  let service: ApplicationFormService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new ApplicationFormService();
    jest.clearAllMocks();
  });

  describe('getApplicationFormsByOrganisation', () => {
    it('should return all application forms for an organisation', async () => {
      const mockForms = [
        {
          id: 'form-1',
          organisation_id: 'org-1',
          name: 'Event Registration Form',
          description: 'Form for event registration',
          status: 'published',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockForms } as any);

      const result = await service.getApplicationFormsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Event Registration Form');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });
  });

  describe('getApplicationFormById', () => {
    it('should return an application form by ID', async () => {
      const mockForm = {
        id: 'form-1',
        organisation_id: 'org-1',
        name: 'Event Registration Form',
        description: 'Form for event registration',
        status: 'published',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockForm] } as any);

      const result = await service.getApplicationFormById('form-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Event Registration Form');
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM application_forms WHERE id = $1',
        ['form-1']
      );
    });

    it('should return null if form not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getApplicationFormById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getApplicationFormWithFields', () => {
    it('should return form with all fields', async () => {
      const mockForm = {
        id: 'form-1',
        organisation_id: 'org-1',
        name: 'Event Registration Form',
        description: 'Form for event registration',
        status: 'published',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockFields = [
        {
          id: 'field-1',
          organisation_id: 'org-1',
          name: 'first_name',
          label: 'First Name',
          datatype: 'text',
          required: true,
          validation: null,
          options: null,
          allowed_file_types: null,
          max_file_size: null,
          created_at: new Date(),
          updated_at: new Date(),
          order: 1,
          group_name: null,
          group_order: null,
          wizard_step: null,
          wizard_step_title: null,
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockForm] } as any)
        .mockResolvedValueOnce({ rows: mockFields } as any);

      const result = await service.getApplicationFormWithFields('form-1');

      expect(result).not.toBeNull();
      expect(result?.fields).toHaveLength(1);
      expect(result?.fields[0].name).toBe('first_name');
    });
  });

  describe('createApplicationForm', () => {
    it('should create a new application form', async () => {
      const mockForm = {
        id: 'form-1',
        organisation_id: 'org-1',
        name: 'Event Registration Form',
        description: 'Form for event registration',
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockForm] } as any);

      const result = await service.createApplicationForm({
        organisationId: 'org-1',
        name: 'Event Registration Form',
        description: 'Form for event registration',
      });

      expect(result.name).toBe('Event Registration Form');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO application_forms'),
        expect.arrayContaining(['org-1', 'Event Registration Form'])
      );
    });
  });

  describe('updateApplicationForm', () => {
    it('should update an application form', async () => {
      const mockForm = {
        id: 'form-1',
        organisation_id: 'org-1',
        name: 'Updated Form',
        description: 'Updated description',
        status: 'published',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockForm] } as any);

      const result = await service.updateApplicationForm('form-1', {
        name: 'Updated Form',
        status: 'published',
      });

      expect(result.name).toBe('Updated Form');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE application_forms'),
        expect.any(Array)
      );
    });

    it('should throw error if form not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.updateApplicationForm('non-existent', { name: 'Updated' })
      ).rejects.toThrow('Application form not found');
    });
  });

  describe('deleteApplicationForm', () => {
    it('should delete an application form', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteApplicationForm('form-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM application_forms WHERE id = $1',
        ['form-1']
      );
    });

    it('should throw error if form not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(service.deleteApplicationForm('non-existent')).rejects.toThrow(
        'Application form not found'
      );
    });
  });

  describe('createApplicationField', () => {
    it('should create a text field', async () => {
      const mockField = {
        id: 'field-1',
        organisation_id: 'org-1',
        name: 'first_name',
        label: 'First Name',
        datatype: 'text',
        required: true,
        validation: null,
        options: null,
        allowed_file_types: null,
        max_file_size: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockField] } as any);

      const result = await service.createApplicationField({
        organisationId: 'org-1',
        name: 'first_name',
        label: 'First Name',
        datatype: 'text',
        validation: { required: true },
      });

      expect(result.name).toBe('first_name');
      expect(result.datatype).toBe('text');
    });

    it('should create a document_upload field with required attributes', async () => {
      const mockField = {
        id: 'field-1',
        organisation_id: 'org-1',
        name: 'resume',
        label: 'Resume',
        datatype: 'document_upload',
        required: true,
        validation: null,
        options: null,
        allowed_file_types: ['application/pdf', 'application/msword'],
        max_file_size: 5242880,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockField] } as any);

      const result = await service.createApplicationField({
        organisationId: 'org-1',
        name: 'resume',
        label: 'Resume',
        datatype: 'document_upload',
        validation: { required: true },
        allowedFileTypes: ['application/pdf', 'application/msword'],
        maxFileSize: 5242880,
      });

      expect(result.datatype).toBe('document_upload');
      expect(result.allowedFileTypes).toEqual(['application/pdf', 'application/msword']);
      expect(result.maxFileSize).toBe(5242880);
    });

    it('should throw error if document_upload field missing allowedFileTypes', async () => {
      await expect(
        service.createApplicationField({
          organisationId: 'org-1',
          name: 'resume',
          label: 'Resume',
          datatype: 'document_upload',
          validation: { required: true },
          maxFileSize: 5242880,
        })
      ).rejects.toThrow('document_upload field must have allowedFileTypes');
    });

    it('should throw error if document_upload field missing maxFileSize', async () => {
      await expect(
        service.createApplicationField({
          organisationId: 'org-1',
          name: 'resume',
          label: 'Resume',
          datatype: 'document_upload',
          validation: { required: true },
          allowedFileTypes: ['application/pdf'],
        })
      ).rejects.toThrow('document_upload field must have maxFileSize');
    });
  });

  describe('updateApplicationField', () => {
    it('should update a field', async () => {
      const existingField = {
        id: 'field-1',
        organisation_id: 'org-1',
        name: 'first_name',
        label: 'First Name',
        datatype: 'text',
        required: true,
        validation: null,
        options: null,
        allowed_file_types: null,
        max_file_size: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedField = {
        ...existingField,
        label: 'Full First Name',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [existingField] } as any)
        .mockResolvedValueOnce({ rows: [updatedField] } as any);

      const result = await service.updateApplicationField('field-1', {
        label: 'Full First Name',
      });

      expect(result.label).toBe('Full First Name');
    });

    it('should validate document_upload field on update', async () => {
      const existingField = {
        id: 'field-1',
        organisation_id: 'org-1',
        name: 'resume',
        label: 'Resume',
        datatype: 'document_upload',
        required: true,
        validation: null,
        options: null,
        allowed_file_types: ['application/pdf'],
        max_file_size: 5242880,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValueOnce({ rows: [existingField] } as any);

      await expect(
        service.updateApplicationField('field-1', {
          allowedFileTypes: [],
        })
      ).rejects.toThrow('document_upload field must have allowedFileTypes');
    });
  });

  describe('addFieldToForm', () => {
    it('should add a field to a form', async () => {
      const mockFormField = {
        id: 'ff-1',
        form_id: 'form-1',
        field_id: 'field-1',
        order: 1,
        group_name: null,
        group_order: null,
        wizard_step: null,
        wizard_step_title: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockFormField] } as any);

      const result = await service.addFieldToForm({
        formId: 'form-1',
        fieldId: 'field-1',
        order: 1,
      });

      expect(result.formId).toBe('form-1');
      expect(result.fieldId).toBe('field-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO application_form_fields'),
        expect.any(Array)
      );
    });
  });

  describe('removeFieldFromForm', () => {
    it('should remove a field from a form', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.removeFieldFromForm('form-1', 'field-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM application_form_fields WHERE form_id = $1 AND field_id = $2',
        ['form-1', 'field-1']
      );
    });

    it('should throw error if field not found in form', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(
        service.removeFieldFromForm('form-1', 'non-existent')
      ).rejects.toThrow('Field not found in form');
    });
  });
});

describe('FormSubmissionService', () => {
  let service: FormSubmissionService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new FormSubmissionService();
    jest.clearAllMocks();
  });

  describe('getSubmissionsByOrganisation', () => {
    it('should return all submissions for an organisation', async () => {
      const mockSubmissions = [
        {
          id: 'sub-1',
          form_id: 'form-1',
          organisation_id: 'org-1',
          user_id: 'user-1',
          submission_type: 'event_entry',
          context_id: 'event-1',
          submission_data: { firstName: 'John', lastName: 'Doe' },
          status: 'pending',
          submitted_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockSubmissions } as any);

      const result = await service.getSubmissionsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].submissionType).toBe('event_entry');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });

    it('should filter submissions by type', async () => {
      const mockSubmissions = [
        {
          id: 'sub-1',
          form_id: 'form-1',
          organisation_id: 'org-1',
          user_id: 'user-1',
          submission_type: 'membership_application',
          context_id: 'membership-1',
          submission_data: { firstName: 'Jane', lastName: 'Smith' },
          status: 'pending',
          submitted_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockSubmissions } as any);

      const result = await service.getSubmissionsByOrganisation('org-1', {
        submissionType: 'membership_application',
      });

      expect(result).toHaveLength(1);
      expect(result[0].submissionType).toBe('membership_application');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('submission_type = $2'),
        ['org-1', 'membership_application']
      );
    });

    it('should filter submissions by context', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getSubmissionsByOrganisation('org-1', {
        submissionType: 'event_entry',
        contextId: 'event-1',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('context_id = $3'),
        ['org-1', 'event_entry', 'event-1']
      );
    });

    it('should filter submissions by status', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.getSubmissionsByOrganisation('org-1', {
        status: 'approved',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        ['org-1', 'approved']
      );
    });
  });

  describe('getSubmissionsByContext', () => {
    it('should return submissions for a specific context', async () => {
      const mockSubmissions = [
        {
          id: 'sub-1',
          form_id: 'form-1',
          organisation_id: 'org-1',
          user_id: 'user-1',
          submission_type: 'event_entry',
          context_id: 'event-1',
          submission_data: { firstName: 'John' },
          status: 'pending',
          submitted_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockSubmissions } as any);

      const result = await service.getSubmissionsByContext('event_entry', 'event-1');

      expect(result).toHaveLength(1);
      expect(result[0].contextId).toBe('event-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE submission_type = $1 AND context_id = $2'),
        ['event_entry', 'event-1']
      );
    });
  });

  describe('createSubmission', () => {
    it('should create a new submission', async () => {
      const mockSubmission = {
        id: 'sub-1',
        form_id: 'form-1',
        organisation_id: 'org-1',
        user_id: 'user-1',
        submission_type: 'event_entry',
        context_id: 'event-1',
        submission_data: { firstName: 'John', lastName: 'Doe' },
        status: 'pending',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockSubmission] } as any);

      const result = await service.createSubmission({
        formId: 'form-1',
        organisationId: 'org-1',
        userId: 'user-1',
        submissionType: 'event_entry',
        contextId: 'event-1',
        submissionData: { firstName: 'John', lastName: 'Doe' },
      });

      expect(result.submissionType).toBe('event_entry');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO form_submissions'),
        expect.arrayContaining(['form-1', 'org-1', 'user-1', 'event_entry', 'event-1'])
      );
    });

    it('should throw error for invalid submission type', async () => {
      await expect(
        service.createSubmission({
          formId: 'form-1',
          organisationId: 'org-1',
          userId: 'user-1',
          submissionType: 'invalid_type' as any,
          contextId: 'context-1',
          submissionData: {},
        })
      ).rejects.toThrow('Invalid submission type');
    });
  });

  describe('updateSubmission', () => {
    it('should update a submission', async () => {
      const mockSubmission = {
        id: 'sub-1',
        form_id: 'form-1',
        organisation_id: 'org-1',
        user_id: 'user-1',
        submission_type: 'event_entry',
        context_id: 'event-1',
        submission_data: { firstName: 'John', lastName: 'Updated' },
        status: 'approved',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockSubmission] } as any);

      const result = await service.updateSubmission('sub-1', {
        status: 'approved',
      });

      expect(result.status).toBe('approved');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE form_submissions'),
        expect.any(Array)
      );
    });
  });

  describe('getSubmissionWithFiles', () => {
    it('should return submission with all files', async () => {
      const mockSubmission = {
        id: 'sub-1',
        form_id: 'form-1',
        organisation_id: 'org-1',
        user_id: 'user-1',
        submission_type: 'event_entry',
        context_id: 'event-1',
        submission_data: { firstName: 'John' },
        status: 'pending',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockFiles = [
        {
          id: 'file-1',
          submission_id: 'sub-1',
          field_id: 'field-1',
          file_name: 'resume.pdf',
          file_size: 1024,
          file_type: 'application/pdf',
          s3_key: 'org-1/form-1/field-1/resume.pdf',
          s3_bucket: 'my-bucket',
          uploaded_at: new Date(),
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockSubmission] } as any)
        .mockResolvedValueOnce({ rows: mockFiles } as any);

      const result = await service.getSubmissionWithFiles('sub-1');

      expect(result).not.toBeNull();
      expect(result?.files).toHaveLength(1);
      expect(result?.files[0].fileName).toBe('resume.pdf');
    });
  });

  describe('createSubmissionFile', () => {
    it('should create a submission file record', async () => {
      const mockFile = {
        id: 'file-1',
        submission_id: 'sub-1',
        field_id: 'field-1',
        file_name: 'resume.pdf',
        file_size: 1024,
        file_type: 'application/pdf',
        s3_key: 'org-1/form-1/field-1/resume.pdf',
        s3_bucket: 'my-bucket',
        uploaded_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockFile] } as any);

      const result = await service.createSubmissionFile({
        submissionId: 'sub-1',
        fieldId: 'field-1',
        fileName: 'resume.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        s3Key: 'org-1/form-1/field-1/resume.pdf',
        s3Bucket: 'my-bucket',
      });

      expect(result.fileName).toBe('resume.pdf');
      expect(result.s3Key).toBe('org-1/form-1/field-1/resume.pdf');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO form_submission_files'),
        expect.any(Array)
      );
    });
  });

  describe('getSubmissionCountByType', () => {
    it('should return count of submissions by type', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] } as any);

      const result = await service.getSubmissionCountByType('org-1', 'event_entry');

      expect(result).toBe(5);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['org-1', 'event_entry']
      );
    });
  });
});
