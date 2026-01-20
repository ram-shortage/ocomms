/**
 * XHR-based file upload utility with progress tracking.
 * Uses XMLHttpRequest instead of fetch to support upload progress events.
 */

import { MAX_FILE_SIZE } from "./file-validation";

export interface UploadResult {
  id: string;
  path: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
}

export interface UploadOptions {
  /** Callback with upload progress percentage (0-100) */
  onProgress?: (percent: number) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface UploadError extends Error {
  code?: "FILE_TOO_LARGE" | "UNAUTHORIZED" | "INVALID_TYPE" | "NETWORK_ERROR" | "SERVER_ERROR";
}

/**
 * Upload a file with progress tracking.
 *
 * @param file - File to upload
 * @param options - Upload options including progress callback and abort signal
 * @returns Promise resolving to upload result with file metadata
 * @throws UploadError with code for specific error types
 */
export function uploadFile(
  file: File,
  options?: UploadOptions
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    // Client-side size check (fail fast)
    if (file.size > MAX_FILE_SIZE) {
      const error = new Error(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      ) as UploadError;
      error.code = "FILE_TOO_LARGE";
      reject(error);
      return;
    }

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    // Track upload progress
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && options?.onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress(percent);
      }
    });

    // Handle successful response
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response as UploadResult);
        } catch {
          const error = new Error("Invalid server response") as UploadError;
          error.code = "SERVER_ERROR";
          reject(error);
        }
      } else if (xhr.status === 401) {
        const error = new Error("Unauthorized") as UploadError;
        error.code = "UNAUTHORIZED";
        reject(error);
      } else if (xhr.status === 400) {
        // Parse server error message
        try {
          const response = JSON.parse(xhr.responseText);
          const error = new Error(response.error || "Invalid file") as UploadError;
          error.code = response.code || "INVALID_TYPE";
          reject(error);
        } catch {
          const error = new Error("Invalid file") as UploadError;
          error.code = "INVALID_TYPE";
          reject(error);
        }
      } else {
        const error = new Error(`Upload failed: ${xhr.status}`) as UploadError;
        error.code = "SERVER_ERROR";
        reject(error);
      }
    });

    // Handle network errors
    xhr.addEventListener("error", () => {
      const error = new Error("Network error during upload") as UploadError;
      error.code = "NETWORK_ERROR";
      reject(error);
    });

    // Handle abort
    xhr.addEventListener("abort", () => {
      const error = new Error("Upload cancelled") as UploadError;
      reject(error);
    });

    // Set up abort signal listener
    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        xhr.abort();
      });
    }

    // Send request
    xhr.open("POST", "/api/upload/attachment");
    xhr.send(formData);
  });
}
