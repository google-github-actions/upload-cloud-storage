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
import { UploadHelper } from './upload-helper';
import { Metadata } from './headers';
import {
  Storage,
  UploadResponse,
  StorageOptions,
  PredefinedAcl,
} from '@google-cloud/storage';

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
    const options: StorageOptions = {
      userAgent: 'github-actions-upload-cloud-storage/0.3.0',
    };
    if (opts?.credentials) {
      // If the credentials are not JSON, they are probably base64-encoded. Even
      // though we don't instruct users to provide base64-encoded credentials,
      // sometimes they still do.
      if (!opts.credentials.trim().startsWith('{')) {
        const creds = opts.credentials;
        opts.credentials = Buffer.from(creds, 'base64').toString('utf8');
      }
      const creds = JSON.parse(opts.credentials);
      options.credentials = creds;
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
