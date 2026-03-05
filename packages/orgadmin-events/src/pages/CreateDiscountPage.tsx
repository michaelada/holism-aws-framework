/**
 * Create/Edit Discount Page
 * 
 * Multi-step wizard for creating or editing discounts
 * Steps: Basic Information -> Discount Configuration -> Eligibility Criteria -> Validity & Limits -> Review & Confirm
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  Checkbox,
  Chip,
  OutlinedInput,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import { usePageHelp, useOnboarding } from '@aws-web-framework/orgadmin-shell';
import type { CreateDiscountDto, DiscountStatus, ApplicationScope } from '../../../backend/src/types/discount.types';

interface DiscountFormData {
  name: string;
  description: string;
  code: string;
  status: DiscountStatus;
  // Step 2 fields
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  applicationScope: 'item' | 'category' | 'cart' | 'quantity-based';
  minimumQuantity?: number;
  applyToQuantity?: number;
  applyEveryN?: number;
  // Step 3 fields
  requiresCode: boolean;
  membershipTypeIds: string[];
  minimumPurchaseAmount?: number;
  maximumDiscountAmount?: number;
  // Step 4 fields
  validFrom?: Date;
  validUntil?: Date;
  totalUsageLimit?: number;
  perUserLimit?: number;
  combinable: boolean;
  priority: number;
}

interface CreateDiscountPageProps {
  moduleType?: 'events' | 'memberships';
}

const CreateDiscountPage: React.FC<CreateDiscountPageProps> = ({ moduleType = 'events' }) => {
  // Register help content for this page
  usePageHelp('discounts');

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const { setCurrentModule } = useOnboarding();
  const isEditMode = Boolean(id);

  // State for membership types loaded from API
  const [membershipTypes, setMembershipTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingMembershipTypes, setLoadingMembershipTypes] = useState(true);

  const steps = [
    'Basic Information',
    'Discount Configuration',
    'Eligibility Criteria',
    'Validity & Limits',
    'Review & Confirm'
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<DiscountFormData>({
    name: '',
    description: '',
    code: '',
    status: 'active',
    discountType: 'percentage',
    discountValue: 0,
    applicationScope: 'item',
    requiresCode: false,
    membershipTypeIds: [],
    combinable: true,
    priority: 0,
  });

  // Set current module for help context
  useEffect(() => {
    setCurrentModule(moduleType === 'memberships' ? 'memberships' : 'events');
  }, [setCurrentModule, moduleType]);

  // Load membership types from API
  useEffect(() => {
    loadMembershipTypes();
  }, []);

  useEffect(() => {
    if (isEditMode && id) {
      loadDiscount(id);
    }
  }, [id, isEditMode]);

  const loadMembershipTypes = async () => {
    try {
      setLoadingMembershipTypes(true);
      const types = await execute({
        method: 'GET',
        url: '/api/orgadmin/membership-types',
      });
      const typesArray = Array.isArray(types) ? types : [];
      setMembershipTypes(typesArray);
    } catch (error) {
      console.error('Failed to load membership types:', error);
      setMembershipTypes([]);
    } finally {
      setLoadingMembershipTypes(false);
    }
  };

  const loadDiscount = async (discountId: string) => {
    if (!organisation?.id) {
      setError('Organisation context not available');
      return;
    }
    
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/discounts/${discountId}?organisationId=${organisation.id}`,
      });

      setFormData({
        name: response.name || '',
        description: response.description || '',
        code: response.code || '',
        status: response.status || 'active',
        discountType: response.discountType || 'percentage',
        discountValue: response.discountValue || 0,
        applicationScope: response.applicationScope || 'item',
        minimumQuantity: response.quantityRules?.minimumQuantity,
        applyToQuantity: response.quantityRules?.applyToQuantity,
        applyEveryN: response.quantityRules?.applyEveryN,
        requiresCode: response.eligibilityCriteria?.requiresCode || false,
        membershipTypeIds: response.eligibilityCriteria?.membershipTypeIds || [],
        minimumPurchaseAmount: response.eligibilityCriteria?.minimumPurchaseAmount,
        maximumDiscountAmount: response.eligibilityCriteria?.maximumDiscountAmount,
        validFrom: response.validFrom ? new Date(response.validFrom) : undefined,
        validUntil: response.validUntil ? new Date(response.validUntil) : undefined,
        totalUsageLimit: response.usageLimits?.totalUsageLimit,
        perUserLimit: response.usageLimits?.perUserLimit,
        combinable: response.combinable ?? true,
        priority: response.priority ?? 0,
      });
    } catch (error) {
      console.error('Failed to load discount:', error);
      setError('Failed to load discount');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof DiscountFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Discount name is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.discountValue === undefined || formData.discountValue === null) {
      errors.discountValue = 'Discount value is required';
    } else if (formData.discountType === 'percentage') {
      if (formData.discountValue < 0 || formData.discountValue > 100) {
        errors.discountValue = 'Percentage discount must be between 0 and 100';
      }
    } else if (formData.discountType === 'fixed') {
      if (formData.discountValue <= 0) {
        errors.discountValue = 'Fixed amount discount must be greater than 0';
      }
    }

    if (formData.applicationScope === 'quantity-based') {
      if (!formData.minimumQuantity || formData.minimumQuantity < 1) {
        errors.minimumQuantity = 'Minimum quantity must be at least 1';
      }
      if (formData.applyToQuantity && formData.applyToQuantity < 1) {
        errors.applyToQuantity = 'Apply to quantity must be at least 1';
      }
      if (formData.applyEveryN && formData.applyEveryN < 1) {
        errors.applyEveryN = 'Apply every N must be at least 1';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate discount code when requiresCode is checked
    if (formData.requiresCode) {
      if (!formData.code || !formData.code.trim()) {
        errors.code = 'Discount code is required when "Requires code entry" is enabled';
      } else if (formData.code.length < 3 || formData.code.length > 50) {
        errors.code = 'Discount code must be between 3 and 50 characters';
      }
    }

    if (formData.minimumPurchaseAmount !== undefined && formData.minimumPurchaseAmount < 0) {
      errors.minimumPurchaseAmount = 'Minimum purchase amount must be 0 or greater';
    }

    if (formData.maximumDiscountAmount !== undefined && formData.maximumDiscountAmount <= 0) {
      errors.maximumDiscountAmount = 'Maximum discount amount must be greater than 0';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep4 = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate date range: validFrom must be before validUntil
    if (formData.validFrom && formData.validUntil) {
      if (formData.validFrom >= formData.validUntil) {
        errors.validFrom = 'Valid from date must be before valid until date';
        errors.validUntil = 'Valid until date must be after valid from date';
      }
    }

    // Validate total usage limit
    if (formData.totalUsageLimit !== undefined && formData.totalUsageLimit < 1) {
      errors.totalUsageLimit = 'Total usage limit must be at least 1';
    }

    // Validate per-user limit
    if (formData.perUserLimit !== undefined && formData.perUserLimit < 1) {
      errors.perUserLimit = 'Per-user limit must be at least 1';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (activeStep === 0 && !validateStep1()) {
      return;
    }
    if (activeStep === 1 && !validateStep2()) {
      return;
    }
    if (activeStep === 2 && !validateStep3()) {
      return;
    }
    if (activeStep === 3 && !validateStep4()) {
      return;
    }

    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setFieldErrors({});
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleSave = async () => {
    if (!organisation?.id) {
      setError('Organisation context not available');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setFieldErrors({});

      // Final validation
      if (!validateStep1()) {
        setActiveStep(0);
        return;
      }

      // TODO: Add validation for other steps

      const quantityRules = formData.applicationScope === 'quantity-based' && formData.minimumQuantity
        ? {
            minimumQuantity: formData.minimumQuantity,
            applyToQuantity: formData.applyToQuantity,
            applyEveryN: formData.applyEveryN,
          }
        : undefined;

      const eligibilityCriteria = {
        requiresCode: formData.requiresCode,
        membershipTypeIds: formData.membershipTypeIds.length > 0 ? formData.membershipTypeIds : undefined,
        minimumPurchaseAmount: formData.minimumPurchaseAmount,
        maximumDiscountAmount: formData.maximumDiscountAmount,
      };

      const usageLimits = (formData.totalUsageLimit !== undefined || formData.perUserLimit !== undefined)
        ? {
            totalUsageLimit: formData.totalUsageLimit,
            perUserLimit: formData.perUserLimit,
          }
        : undefined;

      const dataToSave: CreateDiscountDto = {
        organisationId: organisation.id,
        moduleType: moduleType,
        name: formData.name,
        description: formData.description || undefined,
        code: formData.code || undefined,
        status: formData.status,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        applicationScope: formData.applicationScope,
        quantityRules,
        eligibilityCriteria,
        validFrom: formData.validFrom,
        validUntil: formData.validUntil,
        usageLimits,
        combinable: formData.combinable,
        priority: formData.priority,
      };

      if (isEditMode && id) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/discounts/${id}`,
          data: dataToSave,
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/discounts',
          data: dataToSave,
        });
      }

      navigate(moduleType === 'memberships' ? '/members/discounts' : '/events/discounts');
    } catch (error) {
      console.error('Failed to save discount:', error);
      setError('Failed to save discount');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(moduleType === 'memberships' ? '/members/discounts' : '/events/discounts');
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderDiscountConfiguration();
      case 2:
        return renderEligibilityCriteria();
      case 3:
        return renderValidityAndLimits();
      case 4:
        return renderReviewConfirm();
      default:
        return null;
    }
  };

  const renderBasicInformation = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Enter the basic details for your discount
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label="Discount Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name || 'Enter a descriptive name for this discount'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="A clear, descriptive name that helps identify this discount" arrow placement="top">
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              helperText="Provide additional details about this discount (optional)"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Optional description to explain the purpose or terms of this discount" arrow placement="top">
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as DiscountStatus)}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                Only active discounts can be applied to items
              </Typography>
            </FormControl>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderDiscountConfiguration = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Discount Configuration
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Configure the discount type, value, and how it should be applied
        </Typography>

        <Grid container spacing={3}>
          {/* Discount Type */}
          <Grid item xs={12}>
            <FormControl component="fieldset" error={!!fieldErrors.discountType}>
              <FormLabel component="legend">Discount Type *</FormLabel>
              <RadioGroup
                row
                value={formData.discountType}
                onChange={(e) => handleChange('discountType', e.target.value as 'percentage' | 'fixed')}
              >
                <FormControlLabel
                  value="percentage"
                  control={<Radio />}
                  label="Percentage (%)"
                />
                <FormControlLabel
                  value="fixed"
                  control={<Radio />}
                  label="Fixed Amount"
                />
              </RadioGroup>
              <FormHelperText>
                Choose whether the discount is a percentage off or a fixed amount off
              </FormHelperText>
            </FormControl>
          </Grid>

          {/* Discount Value */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              required
              type="number"
              label={formData.discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}
              value={formData.discountValue}
              onChange={(e) => handleChange('discountValue', parseFloat(e.target.value) || 0)}
              error={!!fieldErrors.discountValue}
              helperText={
                fieldErrors.discountValue ||
                (formData.discountType === 'percentage'
                  ? 'Enter a percentage between 0 and 100'
                  : 'Enter a fixed amount greater than 0')
              }
              InputProps={{
                startAdornment: formData.discountType === 'fixed' ? (
                  <InputAdornment position="start">$</InputAdornment>
                ) : undefined,
                endAdornment: (
                  <InputAdornment position="end">
                    {formData.discountType === 'percentage' && '%'}
                    <Tooltip
                      title={
                        formData.discountType === 'percentage'
                          ? 'The percentage to discount from the item price'
                          : 'The fixed amount to subtract from the item price'
                      }
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: 0,
                max: formData.discountType === 'percentage' ? 100 : undefined,
                step: formData.discountType === 'percentage' ? 1 : 0.01,
              }}
            />
          </Grid>

          {/* Application Scope */}
          <Grid item xs={12}>
            <FormControl fullWidth error={!!fieldErrors.applicationScope}>
              <InputLabel>Application Scope *</InputLabel>
              <Select
                value={formData.applicationScope}
                onChange={(e) => handleChange('applicationScope', e.target.value as ApplicationScope)}
                label="Application Scope *"
              >
                <MenuItem value="item">Item Level - Apply to specific items</MenuItem>
                <MenuItem value="category">Category Level - Apply to groups of items</MenuItem>
                <MenuItem value="cart">Cart Level - Apply to entire cart total</MenuItem>
                <MenuItem value="quantity-based">Quantity-Based - Apply based on quantity purchased</MenuItem>
              </Select>
              <FormHelperText>
                {fieldErrors.applicationScope ||
                  'Choose how this discount should be applied'}
              </FormHelperText>
            </FormControl>
          </Grid>

          {/* Quantity Rules - Only shown when scope is quantity-based */}
          {formData.applicationScope === 'quantity-based' && (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
                  Quantity Rules
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Configure the quantity-based discount rules
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Minimum Quantity"
                  value={formData.minimumQuantity || ''}
                  onChange={(e) => handleChange('minimumQuantity', parseInt(e.target.value) || undefined)}
                  error={!!fieldErrors.minimumQuantity}
                  helperText={
                    fieldErrors.minimumQuantity ||
                    'Minimum items required to activate discount'
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip
                          title="The minimum number of items that must be purchased for this discount to apply"
                          arrow
                          placement="top"
                        >
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Apply to Quantity"
                  value={formData.applyToQuantity || ''}
                  onChange={(e) => handleChange('applyToQuantity', parseInt(e.target.value) || undefined)}
                  error={!!fieldErrors.applyToQuantity}
                  helperText={
                    fieldErrors.applyToQuantity ||
                    'Number of items to discount (optional)'
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip
                          title="How many items should receive the discount (e.g., for 'buy 2 get 1 free', set this to 1)"
                          arrow
                          placement="top"
                        >
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Apply Every N Items"
                  value={formData.applyEveryN || ''}
                  onChange={(e) => handleChange('applyEveryN', parseInt(e.target.value) || undefined)}
                  error={!!fieldErrors.applyEveryN}
                  helperText={
                    fieldErrors.applyEveryN ||
                    'Repeat discount every N items (optional)'
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip
                          title="Apply the discount repeatedly every N items (e.g., for 'every 3rd item free', set this to 3)"
                          arrow
                          placement="top"
                        >
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ min: 1, step: 1 }}
                />
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>
    </Card>
  );

  const renderEligibilityCriteria = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Eligibility Criteria
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Set eligibility requirements for this discount
        </Typography>

        <Grid container spacing={3}>
          {/* Requires Code Entry */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.requiresCode}
                  onChange={(e) => handleChange('requiresCode', e.target.checked)}
                />
              }
              label="Requires code entry"
            />
            <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
              When enabled, users must enter the discount code to activate this discount
            </Typography>
          </Grid>

          {/* Discount Code - Only shown when requiresCode is checked */}
          {formData.requiresCode && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Discount Code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                error={!!fieldErrors.code}
                helperText={fieldErrors.code || 'Enter the code that users must provide to activate this discount (3-50 characters)'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="The alphanumeric code (3-50 characters) that users must enter to apply this discount" arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          {/* Membership Types - Only shown if membership types exist */}
          {!loadingMembershipTypes && membershipTypes.length > 0 && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="membership-types-label">Membership Types</InputLabel>
                <Select
                  labelId="membership-types-label"
                  multiple
                  value={formData.membershipTypeIds}
                  onChange={(e) => handleChange('membershipTypeIds', e.target.value as string[])}
                  input={<OutlinedInput label="Membership Types" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((id) => {
                        const type = membershipTypes.find(t => t.id === id);
                        return type ? <Chip key={id} label={type.name} size="small" /> : null;
                      })}
                    </Box>
                  )}
                >
                  {membershipTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      <Checkbox checked={formData.membershipTypeIds.indexOf(type.id) > -1} />
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Select membership types that are eligible for this discount (optional)
                </FormHelperText>
              </FormControl>
            </Grid>
          )}

          {/* Minimum Purchase Amount */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Minimum Purchase Amount"
              value={formData.minimumPurchaseAmount ?? ''}
              onChange={(e) => handleChange('minimumPurchaseAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
              error={!!fieldErrors.minimumPurchaseAmount}
              helperText={
                fieldErrors.minimumPurchaseAmount ||
                'Minimum cart total required to apply this discount (optional)'
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="The minimum purchase amount required for this discount to be applicable"
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: 0,
                step: 0.01,
              }}
            />
          </Grid>

          {/* Maximum Discount Amount */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Maximum Discount Amount"
              value={formData.maximumDiscountAmount ?? ''}
              onChange={(e) => handleChange('maximumDiscountAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
              error={!!fieldErrors.maximumDiscountAmount}
              helperText={
                fieldErrors.maximumDiscountAmount ||
                'Maximum discount amount that can be applied (optional)'
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="Cap the discount at this maximum amount, regardless of the calculated discount"
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: 0.01,
                step: 0.01,
              }}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderValidityAndLimits = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Validity & Limits
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Set validity period and usage limits for this discount
        </Typography>

        <Grid container spacing={3}>
          {/* Validity Period */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 1, fontWeight: 'bold' }}>
              Validity Period
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Set when this discount is valid (optional)
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Valid From"
              value={formData.validFrom ? formData.validFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('validFrom', e.target.value ? new Date(e.target.value) : undefined)}
              error={!!fieldErrors.validFrom}
              helperText={
                fieldErrors.validFrom ||
                'Discount will be valid starting from this date (optional)'
              }
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="The date from which this discount becomes valid. Leave empty for no start date restriction."
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Valid Until"
              value={formData.validUntil ? formData.validUntil.toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('validUntil', e.target.value ? new Date(e.target.value) : undefined)}
              error={!!fieldErrors.validUntil}
              helperText={
                fieldErrors.validUntil ||
                'Discount will expire after this date (optional)'
              }
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="The date after which this discount expires. Leave empty for no end date restriction."
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Usage Limits */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
              Usage Limits
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Control how many times this discount can be used (optional)
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Total Usage Limit"
              value={formData.totalUsageLimit ?? ''}
              onChange={(e) => handleChange('totalUsageLimit', e.target.value ? parseInt(e.target.value) : undefined)}
              error={!!fieldErrors.totalUsageLimit}
              helperText={
                fieldErrors.totalUsageLimit ||
                'Maximum total number of times this discount can be used (optional)'
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="The total number of times this discount can be used across all users. Leave empty for unlimited usage."
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: 1,
                step: 1,
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Per-User Limit"
              value={formData.perUserLimit ?? ''}
              onChange={(e) => handleChange('perUserLimit', e.target.value ? parseInt(e.target.value) : undefined)}
              error={!!fieldErrors.perUserLimit}
              helperText={
                fieldErrors.perUserLimit ||
                'Maximum times each user can use this discount (optional)'
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="The maximum number of times a single user can use this discount. Leave empty for unlimited per-user usage."
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: 1,
                step: 1,
              }}
            />
          </Grid>

          {/* Combination Rules */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
              Combination Rules
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Control how this discount combines with other discounts
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.combinable}
                  onChange={(e) => handleChange('combinable', e.target.checked)}
                />
              }
              label="Combinable with other discounts"
            />
            <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
              When enabled, this discount can be combined with other combinable discounts. When disabled, this discount will be applied alone.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', parseInt(e.target.value) || 0)}
              helperText="Higher priority discounts are applied first (default: 0)"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="When multiple discounts apply, they are sorted by priority (highest first). Higher priority discounts are applied before lower priority ones."
                      arrow
                      placement="top"
                    >
                      <IconButton size="small" edge="end">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                step: 1,
              }}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderReviewConfirm = () => (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Review & Confirm
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Review your discount settings before saving
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Basic Information
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Discount Name:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">{formData.name}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Description:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">{formData.description || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Discount Code:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">{formData.code || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Status:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                  {formData.status}
                </Typography>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Discount Configuration
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Discount Type:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Discount Value:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.discountType === 'percentage'
                    ? `${formData.discountValue}%`
                    : `$${formData.discountValue.toFixed(2)}`}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Application Scope:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.applicationScope === 'item' && 'Item Level'}
                  {formData.applicationScope === 'category' && 'Category Level'}
                  {formData.applicationScope === 'cart' && 'Cart Level'}
                  {formData.applicationScope === 'quantity-based' && 'Quantity-Based'}
                </Typography>
              </Grid>
              {formData.applicationScope === 'quantity-based' && (
                <>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">Minimum Quantity:</Typography>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Typography variant="body2">{formData.minimumQuantity || 'Not set'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">Apply to Quantity:</Typography>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Typography variant="body2">{formData.applyToQuantity || 'Not set'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">Apply Every N Items:</Typography>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Typography variant="body2">{formData.applyEveryN || 'Not set'}</Typography>
                  </Grid>
                </>
              )}
            </Grid>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Eligibility Criteria
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Requires Code Entry:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">{formData.requiresCode ? 'Yes' : 'No'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Membership Types:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                {formData.membershipTypeIds.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {formData.membershipTypeIds.map((id) => {
                      const type = membershipTypes.find(t => t.id === id);
                      return type ? <Chip key={id} label={type.name} size="small" /> : null;
                    })}
                  </Box>
                ) : (
                  <Typography variant="body2">Not set</Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Minimum Purchase Amount:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.minimumPurchaseAmount !== undefined
                    ? `$${formData.minimumPurchaseAmount.toFixed(2)}`
                    : 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Maximum Discount Amount:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.maximumDiscountAmount !== undefined
                    ? `$${formData.maximumDiscountAmount.toFixed(2)}`
                    : 'Not set'}
                </Typography>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Validity & Limits
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Valid From:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.validFrom ? formatDate(formData.validFrom) : 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Valid Until:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.validUntil ? formatDate(formData.validUntil) : 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Total Usage Limit:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.totalUsageLimit !== undefined ? formData.totalUsageLimit : 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Per-User Limit:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">
                  {formData.perUserLimit !== undefined ? formData.perUserLimit : 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Combinable:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">{formData.combinable ? 'Yes' : 'No'}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">Priority:</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="body2">{formData.priority}</Typography>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {isEditMode ? 'Edit Discount' : 'Create Discount'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Box sx={{ mb: 3 }}>
        {renderStepContent(activeStep)}
      </Box>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={handleCancel}
          disabled={loading}
        >
          Cancel
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {activeStep > 0 && (
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={handleBack}
              disabled={loading}
            >
              Back
            </Button>
          )}

          {/* Show Save button on all steps when editing */}
          {isEditMode && activeStep < steps.length - 1 && (
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
            >
              Save
            </Button>
          )}

          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              endIcon={<NextIcon />}
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
            >
              {isEditMode ? 'Update Discount' : 'Create Discount'}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CreateDiscountPage;
