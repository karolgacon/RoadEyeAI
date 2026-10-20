import type { ApiErrorCode } from "@/types/analysis";

export class SatelliteError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "SatelliteError";
    this.code = code;
  }
}

export class SatelliteConfigError extends SatelliteError {
  constructor(message: string) {
    super("CONFIG", message);
    this.name = "SatelliteConfigError";
  }
}

export class CloudBlockedError extends SatelliteError {
  readonly cloudCoverage: number;

  constructor(cloudCoverage: number, threshold: number) {
    super(
      "CLOUD_BLOCKED",
      `Zachmurzenie ${(cloudCoverage * 100).toFixed(0)}% przekracza próg ${(threshold * 100).toFixed(0)}%`,
    );
    this.name = "CloudBlockedError";
    this.cloudCoverage = cloudCoverage;
  }
}

export class NoSceneAvailableError extends SatelliteError {
  constructor(message = "Brak dostępnych scen Sentinel-2 w podanym zakresie dat") {
    super("NO_SCENE", message);
    this.name = "NoSceneAvailableError";
  }
}

export class RateLimitError extends SatelliteError {
  constructor(message = "Przekroczono limit zapytań API satelitarnego") {
    super("RATE_LIMIT", message);
    this.name = "RateLimitError";
  }
}
