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

import * as path from 'path';

import {
  IdempotencyStrategy,
  PredefinedAcl,
  Storage,
  StorageOptions,
  UploadOptions,
} from '@google-cloud/storage';
import { errorMessage, toPlatformPath, toPosixPath } from '@google-github-actions/actions-utils';

import { Metadata } from './headers';
import { deepClone } from './util';

// Do not listen to the linter - this can NOT be rewritten as an ES6 import statement.
const { version: appVersion } = require('../package.json');

// userAgent is the default user agent.
const userAgent = `google-github-actions:upload-cloud-storage/${appVersion}`;

/**
 * Available options to create the client.
 *
 * @param projectID GCP Project ID.
 */
export type ClientOptions = {
  projectID?: string;
  universe?: string;
};

/**
 * ClientFileUpload represents a file to upload. It keeps track of the local
 * source path and remote destination.
 */
export type ClientFileUpload = {
  /**
   * source is the absolute, local path on disk to the file.
   */
  source: string;

  /**
   * destination is the remote location for the file, relative to the bucket
   * root.
   */
  destination: string;
};

/**
 * ClientUploadOptions is the list of available options during file upload.
 */
export interface ClientUploadOptions {
  /**
   * bucket is the name of the bucket in which to upload.
   */
  bucket: string;

  /**
   * files is the list of absolute file paths on local disk to upload. This list
   * must use posix path separators for files.
   */
  files: ClientFileUpload[];

  /**
   * concurrency is the maximum number of parallel upload operations that will
   * take place.
   */
  concurrency?: number;

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
export interface FOnUploadObject {
  // eslint-disable-next-line no-unused-vars
  (source: string, destination: string, opts: UploadOptions): void;
}

/**
 * ClientComputeDestinationOptions is the list of options to compute file
 * destinations in a target bucket.
 */
export interface ClientComputeDestinationOptions {
  /**
   * givenRoot is the root given by the input to the function.
   */
  givenRoot: string;

  /**
   * absoluteRoot is the absolute root path, used for resolving the files.
   */
  absoluteRoot: string;

  /**
   * files is a list of filenames, for a glob expansion. All files are relative
   * to absoluteRoot.
   */
  files: string[];

  /**
   * prefix is an optional prefix to predicate on all paths.
   */
  prefix?: string;

  /**
   * includeParent indicates whether the local directory parent name (dirname of
   * givenRoot) should be included in the destination path in the bucket.
   */
  includeParent?: boolean;
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
      universeDomain: opts?.universe,
      userAgent: userAgent,

      retryOptions: {
        autoRetry: true,
        idempotencyStrategy: IdempotencyStrategy.RetryAlways,
        maxRetries: 5,
        maxRetryDelay: 30,
        retryDelayMultiplier: 2,
        totalTimeout: 500,
      },
    };

    this.storage = new Storage(options);
  }

  /**
   * computeDestinations builds a collection of files to their intended upload
   * paths in a Cloud Storage bucket, based on the given options.
   *
   * @param opts List of inputs and files to compute.
   * @return List of files to upload with the source as a local file path and
   * the remote destination path.
   */
  static computeDestinations(opts: ClientComputeDestinationOptions): ClientFileUpload[] {
    const list: ClientFileUpload[] = [];
    for (let i = 0; i < opts.files.length; i++) {
      const name = opts.files[i];

      // Calculate destination by joining the prefix (if one exists), the parent
      // directory name (if includeParent is true), and the file name. path.join
      // ignores empty strings. We only want to do this if
      const base = opts.includeParent ? path.posix.basename(toPosixPath(opts.givenRoot)) : '';
      const destination = path.posix.join(opts.prefix || '', base, name);

      // Compute the absolute path of the file.
      const source = path.resolve(opts.absoluteRoot, toPlatformPath(name));

      list.push({
        source: source,
        destination: destination,
      });
    }

    return list;
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
    const bucket = opts.bucket;
    const storageBucket = this.storage.bucket(bucket);

    const tasks = opts.files.map((file) => async (): Promise<string> => {
      const source = file.source;
      const destination = file.destination;

      // Apparently the Cloud Storage SDK modifies this object, so we need to
      // make our own deep copy before passing it to upload. See #258 for more
      // information.
      const shadowedUploadOpts: UploadOptions = {
        destination: destination,
        metadata: opts.metadata || {},
        gzip: opts.gzip,
        predefinedAcl: opts.predefinedAcl,
        resumable: opts.resumable,
      };
      const uploadOpts = deepClone(shadowedUploadOpts);

      // Execute callback if defined
      if (opts.onUploadObject) {
        opts.onUploadObject(source, path.posix.join(bucket, destination), uploadOpts);
      }

      // Do the upload
      const response = await storageBucket.upload(source, uploadOpts);
      const name = response[0].name;
      return name;
    });

    const results = await inParallel(tasks, opts.concurrency);
    return results;
  }
}

/**
 * TODO(sethvargo): move into actions-utils
 */
import { cpus as oscpus } from 'os';

export async function inParallel<F extends () => Promise<Awaited<R>>, R extends ReturnType<F>>(
  tasks: (() => Promise<R> | Promise<R>)[],
  concurrency: number | undefined,
): Promise<R[]> {
  // Concurrency is the minimum of the number of arguments or concurrency. This
  // prevents additional undefined entries in the results array.
  concurrency = Math.min(concurrency || oscpus().length - 1);
  if (concurrency < 1) {
    throw new Error(`concurrency must be at least 1`);
  }

  const results: R[] = [];
  const errors: string[] = [];

  const runTasks = async (iter: IterableIterator<[number, () => Promise<R> | Promise<R>]>) => {
    for (const [idx, task] of iter) {
      try {
        results[idx] = await task();
      } catch (err) {
        errors[idx] = errorMessage(err);
      }
    }
  };

  const workers = new Array(concurrency).fill(tasks.entries()).map(runTasks);
  await Promise.allSettled(workers);

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return results;
}
