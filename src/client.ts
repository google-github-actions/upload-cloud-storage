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

import * as core from '@actions/core';
import * as path from 'path';

import { Storage, StorageOptions, PredefinedAcl } from '@google-cloud/storage';
import {
  parseCredential,
  randomFilepath,
  inParallel,
  toPlatformPath,
} from '@google-github-actions/actions-utils';

import { Metadata } from './headers';
import { parseBucketNameAndPrefix } from './util';

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
  projectID?: string;
};

/**
 * ClientUploadOptions is the list of available options during file upload.
 */
export interface ClientUploadOptions {
  /**
   * destination is the name of the bucket and optionally the path within the
   * bucket in which to upload. This value is split on the first instance of a
   * slash character. Everything preceeding of the first slash is the bucket
   * name, everything following the first slash is the path.
   */
  destination: string;

  /**
   * root is the parent directory from which all files originated on local disk.
   * This must be the platform-specific path separators.
   */
  root: string;

  /**
   * files is the list of absolute file paths on local disk to upload. This list
   * must use posix path separators for files.
   */
  files: string[];

  /**
   * concurrency is the maximum number of parallel upload operations that will
   * take place.
   */
  concurrency?: number;

  /**
   * includeParent indicates whether the local directory parent name (dirname of
   * root) should be included in the destination path in the bucket.
   */
  includeParent?: boolean;

  /**
   * metadata is object metadata to set. These are usually populated from
   * headers.
   */
  metadata?: Metadata;

  /**
   * gzip indicates whether to gzip the object when uploading.
   */
  gzip?: boolean;

  /**
   * resumable indicates whether the upload should be resumable after interrupt.
   */
  resumable?: boolean;

  /**
   * predefinedAcl defines the default ACL to apply to new objects.
   */
  predefinedAcl?: PredefinedAcl;

  /**
   * onUploadObject is called each time an object upload begins.
   **/
  onUploadObject?: FOnUploadObject;
}

/**
 * FOnUploadObject is the function interface for the upload callback signature.
 */
interface FOnUploadObject {
  (source: string, destination: string, opts?: Record<string, unknown>): void;
}

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
      projectId: opts?.projectID,
      userAgent: userAgent,
    };

    if (opts?.credentials) {
      options.credentials = parseCredential(opts.credentials);
    }
    this.storage = new Storage(options);
  }

  /**
   * upload puts the given collection of files into the bucket. It will
   * overwrite any existing objects with the same name and create any new
   * objects. It does not delete any existing objects.
   *
   * @param opts ClientUploadOptions
   *
   * @return The list of files uploaded.
   */
  async upload(opts: ClientUploadOptions): Promise<string[]> {
    const clonedOpts = { ...opts };

    const [bucket, prefix] = parseBucketNameAndPrefix(clonedOpts.destination);

    const storageBucket = this.storage.bucket(bucket);

    const uploadOne = async (file: string): Promise<string> => {
      // Calculate destination by joining the prefix (if one exists), the parent
      // directory name (if includeParent is true), and the file name. path.join
      // ignores empty strings.
      const base = clonedOpts.includeParent ? path.basename(clonedOpts.root) : '';
      const destination = path.posix.join(prefix, base, file);

      // Build options
      const abs = path.resolve(clonedOpts.root, toPlatformPath(file));
      const uploadOpts = JSON.parse(
        JSON.stringify({
          destination: destination,
          metadata: clonedOpts.metadata || {},
          gzip: clonedOpts.gzip,
          predefinedAcl: clonedOpts.predefinedAcl,
          resumable: clonedOpts.resumable,
          configPath: randomFilepath(),
        }),
      );

      // Execute callback if defined
      if (clonedOpts.onUploadObject) {
        clonedOpts.onUploadObject(abs, path.posix.join(bucket, destination), uploadOpts);
      }

      core.info(`file: ${file}`);
      core.info(`uploadOpts: ${JSON.stringify(uploadOpts, null, 2)}`);

      // Do the upload
      const response = await storageBucket.upload(abs, uploadOpts);
      core.info(`response: ${JSON.stringify(response[0].metadata, null, 2)}`);
      const name = response[0].name;
      return name;
    };

    const args: [file: string][] = clonedOpts.files.map((file) => [file]);
    const results = await inParallel(uploadOne, args, {
      concurrency: clonedOpts.concurrency,
    });
    return results;
  }
}
