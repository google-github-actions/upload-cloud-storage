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

import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import { PredefinedAcl, Storage, UploadOptions, UploadResponse } from '@google-cloud/storage';
import { Ignore } from 'ignore';
import globby from 'globby';
import * as core from '@actions/core';
import pMap from 'p-map';

import { Metadata } from './headers';
import { getDestinationFromPath } from './util';

/**
 * Wraps interactions with the the GCS library.
 *
 * @param storage The GCS Storage client.
 */
export class UploadHelper {
  readonly storage: Storage;
  /**
   * Create an UploadHelper.
   *
   * @param storage The GCS Storage client.
   */
  constructor(storage: Storage) {
    this.storage = storage;
  }

  /**
   * Uploads a file to a bucket. Based on
   * https://github.com/googleapis/nodejs-storage/blob/main/samples/uploadFile.js
   *
   * @param bucketName The name of the bucket.
   * @param filename The file path.
   * @param gzip Gzip files on upload.
   * @param resumable Allow resuming uploads.
   * @param destination The destination in GCS to upload file to.
   * @param predefinedAcl Predefined ACL config.
   * @returns The UploadResponse which contains the file and metadata, or null
   * if the file was ignored.
   */
  async uploadFile(
    bucketName: string,
    filename: string,
    gzip: boolean,
    resumable: boolean,
    destination?: string,
    predefinedAcl?: PredefinedAcl,
    metadata?: Metadata,
    ignores?: Ignore,
  ): Promise<UploadResponse | null> {
    const options: UploadOptions = { gzip, predefinedAcl };
    const normalizedFilePath = path.posix.normalize(filename);

    // check ignores
    if (ignores?.ignores(normalizedFilePath)) {
      core.info(`Ignoring file: ${normalizedFilePath}`);
      return null;
    }

    // set destination if defined
    if (destination) {
      options.destination = destination;
    }
    if (!process.env.UPLOAD_ACTION_NO_LOG) {
      core.info(
        `Uploading file: ${normalizedFilePath} to gs://${bucketName}/${
          destination ? destination : normalizedFilePath
        }`,
      );
    }
    if (resumable) {
      options.resumable = true;
      options.configPath = path.join(
        os.tmpdir(),
        `upload-cloud-storage-${process.hrtime.bigint()}.json`,
      );
    }
    if (metadata) {
      options.metadata = metadata;
    }

    const uploadedFile = await this.storage.bucket(bucketName).upload(normalizedFilePath, options);
    return uploadedFile;
  }

  /**
   * Uploads a specified directory to a GCS bucket. Based on
   *
   * @param bucketName The name of the bucket.
   * @param directoryPath The path of the directory to upload.
   * @param glob Glob pattern if any.
   * @param gzip Gzip files on upload.
   * @param resumable Allow resuming uploads.
   * @param parent Flag to enable parent dir in destination path.
   * @param predefinedAcl Predefined ACL config.
   * @param concurrency Number of files simultaneously uploaded.
   * @returns The list of UploadResponses which contains the file and metadata.
   */
  async uploadDirectory(
    bucketName: string,
    directoryPath: string,
    glob = '',
    gzip: boolean,
    resumable: boolean,
    prefix = '',
    parent = true,
    predefinedAcl?: PredefinedAcl,
    concurrency = 100,
    metadata?: Metadata,
    ignores?: Ignore,
  ): Promise<UploadResponse[]> {
    // by default we just use directoryPath with empty glob '', which globby evaluates to directory/**/*
    const filesList = await expandGlob(directoryPath, glob);
    const uploader = async (filePath: string): Promise<UploadResponse | null> => {
      const destination = await getDestinationFromPath(filePath, directoryPath, parent, prefix);
      const uploadResp = await this.uploadFile(
        bucketName,
        filePath,
        gzip,
        resumable,
        destination,
        predefinedAcl,
        Object.assign({}, metadata),
        ignores,
      );
      return uploadResp;
    };

    const resp = await pMap(filesList, uploader, { concurrency });

    // Remove nulls
    const result: UploadResponse[] = [];
    for (let i = 0; i < resp.length; i++) {
      const val = resp[i];
      if (val) {
        result.push(val);
      }
    }
    return result;
  }
}

/**
 * expandGlob compiles the list of all files in the given directory for
 * the provided glob.
 *
 * @param directoryPath The path to the directory.
 * @param glob Glob pattern to use for searching. If the empty string, a
 * match-all pattern is used instead.
 * @return Sorted list of files in posix form.
 */
export async function expandGlob(directoryPath: string, glob: string): Promise<string[]> {
  const pth = toPosixPath(path.posix.join(directoryPath, glob));
  const filesList = await globby([pth], {
    dot: true,
  });
  return filesList.sort();
}

/**
 * toPosixPath converts the given path to the posix form. On Windows, \\ will be
 * replaced with /.
 *
 * @param pth. Path to transform.
 * @return Posix-path.
 */
export function toPosixPath(pth: string): string {
  return pth.split(path.sep).join(path.posix.sep);
}
