export class HttpError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export class VersioningError extends Error {}

export class DuplicatePropertyError extends VersioningError {}

export class RegistryConflictError extends VersioningError {}

export class VersionConflictError extends VersioningError {
  readonly currentVersionNumber: number;

  constructor(currentVersionNumber: number) {
    super(
      `Event has changed since this view was loaded. Current version is ${currentVersionNumber}.`,
    );
    this.currentVersionNumber = currentVersionNumber;
  }
}

export class InvalidEventStateError extends VersioningError {}
