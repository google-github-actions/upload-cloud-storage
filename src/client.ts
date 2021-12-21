/*
 * Copyright 2020 Google LLC
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

import * as fs from 'fs';
import * as path from 'path';

import {
  Storage,
  UploadResponse,
  StorageOptions,
  PredefinedAcl,
} from '@google-cloud/storage';
import { parseCredential } from '@google-github-actions/actions-utils';

import { UploadHelper } from './upload-helper';
import { Metadata } from './headers';

// Do not listen to the linter - this can NOT be rewritten as an ES6 import statement.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: appVersion } = require('../package.json');

// userAgent is the default user agent.
const userAgent = `google-github-actions:upload-cloud-storage/${appVersion}`;

/**
 * Available options to create the client.
 *
 * @param credentials GCP JSON credentials (default uses ADC).
 */

type ClientOptions = {
  credentials?: string;
};

/**
 * Handles credential lookup, registration and wraps interactions with the GCS
 * Helper.
 *
 * @param opts List of ClientOptions.
 */
export class Client {
  readonly storage: Storage;

  constructor(opts?: ClientOptions) {
    const options: StorageOptions = { userAgent: userAgent };

    if (opts?.credentials) {
      options.credentials = parseCredential(opts.credentials);
    }
    this.storage = new Storage(options);
  }

  /**
   * Invokes GCS Helper for uploading file or directory.
   * @param destination Name of bucket and optional prefix to upload file/dir.
   * @param filePath FilePath of the file/dir to upload.
   * @param glob Glob pattern if any.
   * @param gzip Gzip files on upload.
   * @param resumable Allow resuming uploads.
   * @param parent Flag to enable parent dir in destination path.
   * @param predefinedAcl Predefined ACL config.
   * @param concurrency Number of files to simultaneously upload.
   * @returns List of uploaded file(s).
   */
  async upload(
    destination: string,
    filePath: string,
    glob = '',
    gzip = true,
    resumable = true,
    parent = true,
    predefinedAcl?: PredefinedAcl,
    concurrency = 100,
    metadata?: Metadata,
  ): Promise<UploadResponse[]> {
    let bucketName = destination;
    let prefix = '';
    // If destination of the form my-bucket/subfolder get bucket and prefix.
    const idx = destination.indexOf('/');
    if (idx > -1) {
      bucketName = destination.substring(0, idx);
      prefix = destination.substring(idx + 1);
    }

    const stat = await fs.promises.stat(filePath);
    const uploader = new UploadHelper(this.storage);
    if (stat.isFile()) {
      destination = '';
      // If obj prefix is set, then extract filename and append to prefix to create destination
      if (prefix) {
        destination = path.posix.join(prefix, path.posix.basename(filePath));
      }
      const uploadedFile = await uploader.uploadFile(
        bucketName,
        filePath,
        gzip,
        resumable,
        destination,
        predefinedAcl,
        metadata,
      );
      return [uploadedFile];
    } else {
      const uploadedFiles = await uploader.uploadDirectory(
        bucketName,
        filePath,
        glob,
        gzip,
        resumable,
        prefix,
        parent,
        predefinedAcl,
        concurrency,
        metadata,
      );
      return uploadedFiles;
    }
  }
}
