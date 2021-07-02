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
import { Client } from './client';
import { parseHeadersInput } from './headers';

async function run(): Promise<void> {
  try {
    const path = core.getInput('path', { required: true });
    const destination = core.getInput('destination', { required: true });
    const gzip =
      core.getInput('gzip', { required: false }) === 'false' ? false : true;
    const resumable =
      core.getInput('resumable', { required: false }) === 'false'
        ? false
        : true;
    const predefinedAclInput = core.getInput('predefinedAcl', {
      required: false,
    });
    const parent =
      core.getInput('parent', { required: false }).toLowerCase() === 'false'
        ? false
        : true;
    const glob = core.getInput('glob');
    const concurrency = Number(core.getInput('concurrency')) || 100;
    const predefinedAcl =
      predefinedAclInput === ''
        ? undefined
        : (predefinedAclInput as PredefinedAcl);
    const headersInput = core.getInput('headers', {
      required: false,
    });
    const metadata =
      headersInput === '' ? undefined : parseHeadersInput(headersInput);
    const serviceAccountKey = core.getInput('credentials');
    const client = new Client({ credentials: serviceAccountKey });
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
    );

    core.setOutput(
      'uploaded',
      uploadResponses
        .map((uploadResponse) => uploadResponse[0].name)
        .toString(),
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
