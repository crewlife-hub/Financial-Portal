/**
 * Custom error classes for Crew Finance Portal
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 404, 'NOT_FOUND');
  }
}

export class DuplicateError extends AppError {
  public readonly idempotencyKey: string;

  constructor(idempotencyKey: string) {
    super(`Duplicate entry detected with idempotency key: ${idempotencyKey}`, 409, 'DUPLICATE_ENTRY');
    this.idempotencyKey = idempotencyKey;
  }
}

export class IntegrationError extends AppError {
  public readonly integration: string;
  public readonly originalError?: Error;

  constructor(integration: string, message: string, originalError?: Error) {
    super(`${integration} integration error: ${message}`, 502, 'INTEGRATION_ERROR');
    this.integration = integration;
    this.originalError = originalError;
  }
}

export class QuickBooksError extends IntegrationError {
  constructor(message: string, originalError?: Error) {
    super('QuickBooks', message, originalError);
  }
}

export class SmartsheetError extends IntegrationError {
  constructor(message: string, originalError?: Error) {
    super('Smartsheet', message, originalError);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class PhaseRestrictionError extends AppError {
  public readonly requiredPhase: number;
  public readonly currentPhase: number;

  constructor(feature: string, requiredPhase: number, currentPhase: number) {
    super(
      `Feature "${feature}" requires Phase ${requiredPhase}, current phase is ${currentPhase}`,
      403,
      'PHASE_RESTRICTION'
    );
    this.requiredPhase = requiredPhase;
    this.currentPhase = currentPhase;
  }
}
