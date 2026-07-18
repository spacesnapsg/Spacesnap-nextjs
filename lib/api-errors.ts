import { NextResponse } from "next/server";

// Mirrors Laravel's default ValidationException JSON shape ({ message, errors })
// so the API contract stays consistent with the old backend's error format.
export class ApiValidationError extends Error {
  errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    super("The given data was invalid.");
    this.errors = errors;
  }
}

export function validationErrorResponse(error: ApiValidationError) {
  return NextResponse.json({ message: error.message, errors: error.errors }, { status: 422 });
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: "Authentication required." }, { status: 401 });
}

export function forbiddenResponse(message: string) {
  return NextResponse.json({ message }, { status: 403 });
}

export function notFoundResponse(message: string) {
  return NextResponse.json({ message }, { status: 404 });
}
