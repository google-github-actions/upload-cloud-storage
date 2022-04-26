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
import { PredefinedAcl } from '@google-cloud/storage';
import {
  errorMessage,
  isPinnedToHead,
  parseGcloudIgnore,
  pinnedToHeadWarning,
} from '@google-github-actions/actions-utils';
import ignore from 'ignore';

import * as path from 'path';

import { Client } from './client';
import { parseHeadersInput } from './headers';
import { absoluteRootAndComputedGlob, expandGlob } from './util';

const NO_FILES_WARNING =
  `There are no files to upload! Make sure the workflow uses the "checkout"` +
  `step before uploading files:\n` +
  `\n` +
  `    - uses: 'actions/checkout@v3'\n` +
  `    # ...\n` +
  `    - uses: 'google-github-actions/upload-cloud-storage@v0'\n` +
  `\n` +
  `Check that the "path" points to a valid destination on disk, relative to ` +
  `the GitHub Workspace. Make sure your files are not being ignored via a ` +
  `.gcloudignore file in the repository.`;

export async function run(): Promise<void> {
  try {
    // Warn if pinned to HEAD
    if (isPinnedToHead()) {
      core.warning(pinnedToHeadWarning('v0'));
    }

    const root = core.getInput('path', { required: true });
    const destination = core.getInput('destination', { required: true });
    const gzip = core.getBooleanInput('gzip');
    const resumable = core.getBooleanInput('resumable');
    const parent = core.getBooleanInput('parent');
    const glob = core.getInput('glob');
    const concurrency = Number(core.getInput('concurrency'));
    const predefinedAclInput = core.getInput('predefinedAcl');
    const predefinedAcl =
      predefinedAclInput === '' ? undefined : (predefinedAclInput as PredefinedAcl);
    const headersInput = core.getInput('headers');
    const processGcloudIgnore = core.getBooleanInput('process_gcloudignore');
    const metadata = headersInput === '' ? {} : parseHeadersInput(headersInput);
    const credentials = core.getInput('credentials');

    // Add warning if using credentials.
    if (credentials) {
      core.warning(
        'The "credentials" input is deprecated. ' +
          'Please switch to using google-github-actions/auth which supports both Workload Identity Federation and JSON Key authentication. ' +
          'For more details, see https://github.com/google-github-actions/upload-cloud-storage#authorization',
      );
    }

    // Compute the absolute root and compute the glob.
    const [absoluteRoot, computedGlob] = await absoluteRootAndComputedGlob(root, glob);
    core.debug(`computed absoluteRoot from "${root}" to "${absoluteRoot}"`);
    core.debug(`computed computedGlob from "${glob}" to "${computedGlob}"`);

    // Build complete file list.
    const files = await expandGlob(absoluteRoot, computedGlob);
    core.debug(`found ${files.length} files: ${JSON.stringify(files)}`);

    // Process ignores:
    //
    // - Find ignore file
    // - Format all files to be posix relative to input.path
    // - Filter out items that match
    if (processGcloudIgnore) {
      core.debug(`processing gcloudignore`);

      const ignores = ignore();

      // Look for a .gcloudignore in the repository root.
      if (process.env.GITHUB_WORKSPACE) {
        const gcloudIgnorePath = path.join(process.env.GITHUB_WORKSPACE, '.gcloudignore');
        const ignoreList = await parseGcloudIgnore(gcloudIgnorePath);

        if (ignoreList.length) {
          core.debug(`using .gcloudignore at: ${gcloudIgnorePath}`);
          core.debug(`parsed ignore list: ${JSON.stringify(ignoreList)}`);

          ignores.add(ignoreList);
        }

        for (let i = 0; i < files.length; i++) {
          const name = files[i];
          try {
            if (ignores.ignores(name)) {
              core.debug(`ignoring ${name} because of ignore file`);
              files.splice(i, 1);
              i--;
            }
          } catch (err) {
            const msg = errorMessage(err);
            core.error(`failed to process ignore for ${name}, skipping: ${msg}`);
          }
        }
      }
    }

    core.debug(`uploading ${files.length} files: ${JSON.stringify(files)}`);

    // Emit a helpful warning in case people specify the wrong directory.
    if (files.length === 0) {
      core.warning(NO_FILES_WARNING);
    }

    // Create the client and upload files.
    const client = new Client({ credentials: credentials });
    const uploadResponses = await client.upload({
      destination: destination,
      root: absoluteRoot,
      files: files,
      concurrency: concurrency,
      includeParent: parent,
      metadata: metadata,
      gzip: gzip,
      resumable: resumable,
      predefinedAcl: predefinedAcl,

      onUploadObject: (source: string, destination: string) => {
        core.info(`Uploading ${source} to gs://${destination}`);
      },
    });

    core.setOutput('uploaded', uploadResponses.join(','));
  } catch (err) {
    const msg = errorMessage(err);
    core.setFailed(`google-github-actions/upload-cloud-storage failed with: ${msg}`);
  }
}

// Execute this as the entrypoint when requested.
if (require.main === module) {
  run();
}
