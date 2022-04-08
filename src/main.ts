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
import { errorMessage, parseGcloudIgnore } from '@google-github-actions/actions-utils';
import ignore from 'ignore';

import { Client } from './client';
import { parseHeadersInput } from './headers';

async function run(): Promise<void> {
  try {
    const path = core.getInput('path', { required: true });
    const destination = core.getInput('destination', { required: true });
    const gzip = core.getBooleanInput('gzip');
    const resumable = core.getBooleanInput('resumable');
    const parent = core.getBooleanInput('parent');
    const glob = core.getInput('glob');
    const concurrency = Number(core.getInput('concurrency')) || 100;
    const predefinedAclInput = core.getInput('predefinedAcl');
    const predefinedAcl =
      predefinedAclInput === '' ? undefined : (predefinedAclInput as PredefinedAcl);
    const headersInput = core.getInput('headers');
    const processGcloudIgnore = core.getBooleanInput('process_gcloudignore');
    const metadata = headersInput === '' ? undefined : parseHeadersInput(headersInput);
    const credentials = core.getInput('credentials');

    // Add warning if using credentials
    if (credentials) {
      core.warning(
        'The "credentials" input is deprecated. ' +
          'Please switch to using google-github-actions/auth which supports both Workload Identity Federation and JSON Key authentication. ' +
          'For more details, see https://github.com/google-github-actions/upload-cloud-storage#authorization',
      );
    }

    const ignores = ignore();
    if (processGcloudIgnore) {
      const ignoreList = await parseGcloudIgnore('.gcloudignore');
      ignores.add(ignoreList);
    }

    const client = new Client({ credentials: credentials });
    const uploadResponses = await client.upload(
      destination,
      path,
      glob,
      gzip,
      resumable,
      parent,
      predefinedAcl,
      concurrency,
      metadata,
      ignores,
    );

    core.setOutput(
      'uploaded',
      uploadResponses.map((uploadResponse) => uploadResponse[0].name).toString(),
    );
  } catch (err) {
    const msg = errorMessage(err);
    core.setFailed(`google-github-actions/upload-cloud-storage failed with: ${msg}`);
  }
}

run();
