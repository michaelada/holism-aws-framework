/**
 * Discount Service
 * 
 * API client for discount management operations.
 * Handles all HTTP requests to the discount backend API.
 * 
 * Note: This service requires a token provider function to be passed to methods.
 * Use with the useDiscountService hook for automatic token injection.
 */

import axios, { AxiosInstance } from 'axios';
import type {
  Discount,
  CreateDiscountDto,
  UpdateDiscountDto,
  DiscountUsage,
  UsageStats,
  GetDiscountsParams,
  ApplyDiscountRequest,
  ValidateDiscountRequest,
  ValidateCodeRequest,
  CalculateDiscountRequest,
  CalculateCartRequest,
  GetUsageParams,
  ValidationResult,
  DiscountResult,
  CartDiscountResult,
  ModuleType,
} from '../types/discount.types';

/**
 * Token provider function type
 */
type TokenProvider = () => string | null;

class DiscountService {
  private api: AxiosInstance;
  private tokenProvider: TokenProvider | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.api.interceptors.request.use((config) => {
      const token = this.tokenProvider?.();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Set the token provider function
   */
  setTokenProvider(provider: TokenProvider) {
    this.tokenProvider = provider;
  }

  /**
   * Get all discounts for an organization
   */
  async getDiscounts(params: GetDiscountsParams): Promise<Discount[]> {
    try {
      const { organisationId, moduleType, status, search, page, limit } = params;
      
      const queryParams = new URLSearchParams();
      if (status) queryParams.append('status', status);
      if (search) queryParams.append('search', search);
      if (page) queryParams.append('page', page.toString());
      if (limit) queryParams.append('limit', limit.toString());

      const url = moduleType
        ? `/api/orgadmin/organisations/${organisationId}/discounts/${moduleType}`
        : `/api/orgadmin/organisations/${organisationId}/discounts`;

      const response = await this.api.get(`${url}?${queryParams.toString()}`);
      return this.transformDiscounts(response.data);
    } catch (error) {
      console.error('Failed to get discounts:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a single discount by ID
   */
  async getDiscountById(id: string, organisationId: string): Promise<Discount> {
    try {
      const response = await this.api.get(`/api/orgadmin/discounts/${id}?organisationId=${organisationId}`);
      return this.transformDiscount(response.data);
    } catch (error) {
      console.error('Failed to get discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a new discount
   */
  async createDiscount(
    organisationId: string,
    moduleType: ModuleType,
    data: CreateDiscountDto
  ): Promise<Discount> {
    try {
      const response = await this.api.post('/api/orgadmin/discounts', {
        ...data,
        organisationId,
        moduleType,
      });
      return this.transformDiscount(response.data);
    } catch (error) {
      console.error('Failed to create discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing discount
   */
  async updateDiscount(id: string, data: UpdateDiscountDto): Promise<Discount> {
    try {
      const response = await this.api.put(`/api/orgadmin/discounts/${id}`, data);
      return this.transformDiscount(response.data);
    } catch (error) {
      console.error('Failed to update discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete a discount
   */
  async deleteDiscount(id: string): Promise<void> {
    try {
      await this.api.delete(`/api/orgadmin/discounts/${id}`);
    } catch (error) {
      console.error('Failed to delete discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Apply a discount to a target entity
   */
  async applyDiscount(
    discountId: string,
    request: ApplyDiscountRequest
  ): Promise<void> {
    try {
      await this.api.post(`/api/orgadmin/discounts/${discountId}/apply`, request);
    } catch (error) {
      console.error('Failed to apply discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Remove a discount from a target entity
   */
  async removeDiscount(
    discountId: string,
    targetType: string,
    targetId: string
  ): Promise<void> {
    try {
      await this.api.delete(
        `/api/orgadmin/discounts/${discountId}/apply/${targetType}/${targetId}`
      );
    } catch (error) {
      console.error('Failed to remove discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get all discounts applied to a target entity
   */
  async getDiscountsForTarget(
    targetType: string,
    targetId: string
  ): Promise<Discount[]> {
    try {
      const response = await this.api.get(
        `/api/orgadmin/discounts/target/${targetType}/${targetId}`
      );
      return this.transformDiscounts(response.data);
    } catch (error) {
      console.error('Failed to get discounts for target:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate a discount for a user and amount
   */
  async validateDiscount(request: ValidateDiscountRequest): Promise<ValidationResult> {
    try {
      const response = await this.api.post('/api/orgadmin/discounts/validate', request);
      return response.data;
    } catch (error) {
      console.error('Failed to validate discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate a discount code
   */
  async validateCode(request: ValidateCodeRequest): Promise<Discount> {
    try {
      const response = await this.api.post('/api/orgadmin/discounts/validate-code', request);
      return this.transformDiscount(response.data);
    } catch (error) {
      console.error('Failed to validate code:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Calculate discount for an item
   */
  async calculateDiscount(request: CalculateDiscountRequest): Promise<DiscountResult> {
    try {
      const response = await this.api.post('/api/orgadmin/discounts/calculate', request);
      return response.data;
    } catch (error) {
      console.error('Failed to calculate discount:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Calculate discounts for a cart
   */
  async calculateCart(request: CalculateCartRequest): Promise<CartDiscountResult> {
    try {
      const response = await this.api.post('/api/orgadmin/discounts/calculate-cart', request);
      return response.data;
    } catch (error) {
      console.error('Failed to calculate cart:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get usage history for a discount
   */
  async getUsage(params: GetUsageParams): Promise<DiscountUsage[]> {
    try {
      const { discountId, startDate, endDate, userId, page, limit } = params;
      
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      if (userId) queryParams.append('userId', userId);
      if (page) queryParams.append('page', page.toString());
      if (limit) queryParams.append('limit', limit.toString());

      const response = await this.api.get(
        `/api/orgadmin/discounts/${discountId}/usage?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get usage:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get usage statistics for a discount
   */
  async getUsageStats(discountId: string): Promise<UsageStats> {
    try {
      const response = await this.api.get(`/api/orgadmin/discounts/${discountId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Transform discount dates from strings to Date objects
   */
  private transformDiscount(discount: any): Discount {
    return {
      ...discount,
      validFrom: discount.validFrom ? new Date(discount.validFrom) : undefined,
      validUntil: discount.validUntil ? new Date(discount.validUntil) : undefined,
      createdAt: new Date(discount.createdAt),
      updatedAt: new Date(discount.updatedAt),
    };
  }

  /**
   * Transform array of discounts
   */
  private transformDiscounts(discounts: any[]): Discount[] {
    return discounts.map(discount => this.transformDiscount(discount));
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error?.message || error.message;
      return new Error(message);
    }
    return error instanceof Error ? error : new Error('An unknown error occurred');
  }
}

// Export singleton instance
export const discountService = new DiscountService();
export default discountService;
