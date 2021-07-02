/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from '@actions/core';

const customMetadataPrefix = 'x-goog-meta-';

interface CustomMetadata {
  [key: string]: string;
}

export interface Metadata {
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  contentType?: string;
  customTime?: string;
  metadata?: CustomMetadata;
}

function parseSingleHeaderLine(input: string): [string, string] {
  const parts = input.split(':');
  const name = parts[0].trim().toLowerCase();
  const value = parts
    .splice(1)
    .join(':')
    .trim();
  return [name, value];
}

function parseHeaderLines(input: string): Map<string, string> {
  const headerPairs = input
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => parseSingleHeaderLine(line));
  return new Map<string, string>(headerPairs);
}

/**
 * Parses multiline headers input to the expected metadata object
 * by the GCS library.
 *
 * Custom metadata must be prefixed with `x-goog-meta-`. Invalid
 * headers are ignored and logged as warnings.
 *
 * @param input multiline string with headers.
 * @returns The parsed metadata object.
 */
export function parseHeadersInput(input: string): Metadata {
  const headers = parseHeaderLines(input);
  const metadata: Metadata = {};
  headers.forEach((value, key) => {
    if (key.startsWith(customMetadataPrefix)) {
      if (!metadata.metadata) {
        metadata.metadata = {};
      }
      metadata.metadata[key.slice(customMetadataPrefix.length)] = value;
    } else {
      switch (key) {
        case 'cache-control':
          metadata.cacheControl = value;
          break;
        case 'content-disposition':
          metadata.contentDisposition = value;
          break;
        case 'content-encoding':
          metadata.contentEncoding = value;
          break;
        case 'content-language':
          metadata.contentLanguage = value;
          break;
        case 'content-type':
          metadata.contentType = value;
          break;
        case 'custom-time':
          metadata.customTime = value;
          break;
        default:
          core.warning(`Invalid header specified: ${key}`);
          break;
      }
    }
  });
  return metadata;
}
