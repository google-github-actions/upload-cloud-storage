/*
 * Copyright 2022 Google LLC
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

import { test } from 'node:test';
import assert from 'node:assert';

import * as path from 'path';
import { randomBytes } from 'crypto';

import * as core from '@actions/core';
import {
  clearEnv,
  inParallel,
  setInputs,
  skipIfMissingEnv,
} from '@google-github-actions/actions-utils';
import { Storage } from '@google-cloud/storage';

import { run } from '../src/main';

const projectID = process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT;

test(
  'integration/main#run',
  {
    concurrency: true,
    skip: skipIfMissingEnv('UPLOAD_CLOUD_STORAGE_TEST_PROJECT'),
  },
  async (suite) => {
    let storage: Storage;
    let testBucket: string;

    suite.before(async () => {
      storage = new Storage({
        projectId: projectID,
      });

      // Create a dedicated bucket for each run.
      const testBucketName = `main-${randomBytes(6).toString('hex')}-${
        process.env.GITHUB_SHA || 'unknown'
      }`;
      const [bucket] = await storage.createBucket(testBucketName, {
        location: 'US',
      });
      testBucket = bucket.name;

      process.env.GITHUB_WORKSPACE = path.join(path.dirname(__dirname), 'tests');

      suite.mock.method(core, 'debug', () => {});
      suite.mock.method(core, 'info', () => {});
      suite.mock.method(core, 'warning', () => {});
      suite.mock.method(core, 'setOutput', () => {});
      suite.mock.method(core, 'setSecret', () => {});
      suite.mock.method(core, 'group', () => {});
      suite.mock.method(core, 'startGroup', () => {});
      suite.mock.method(core, 'endGroup', () => {});
      suite.mock.method(core, 'addPath', () => {});
      suite.mock.method(core, 'exportVariable', () => {});
    });

    suite.afterEach(async () => {
      clearEnv((key) => {
        return key.startsWith(`INPUT_`) || key.startsWith(`GITHUB_`);
      });

      const bucket = storage.bucket(testBucket);
      const [files] = await bucket.getFiles();
      const tasks = files.map((file) => async (): Promise<void> => {
        await bucket.file(file.name).delete();
      });
      await inParallel(tasks, 50);
    });

    suite.after(async () => {
      const bucket = storage.bucket(testBucket);
      await bucket.delete();
    });

    await suite.test('uploads all files', async () => {
      setInputs({
        // project_id cannot actually be undefined if we got here, but
        // TypeScript doesn't know about Mocha's skip().
        project_id: projectID || '',
        path: './testdata',
        destination: `${testBucket}/sub/path`,
        gzip: 'true',
        resumable: 'true',
        parent: 'false',
        glob: '**/*',
        concurrency: '10',
        process_gcloudignore: 'false',
        predefinedAcl: 'authenticatedRead',
      });

      await run();

      const [list] = await storage.bucket(testBucket).getFiles();
      const names = list.map((file) => [file.name, file.metadata.contentType]);
      assert.deepStrictEqual(names, [
        ['sub/path/nested1/nested2/test3.txt', 'text/plain'],
        ['sub/path/nested1/test1.txt', 'text/plain'],
        ['sub/path/test.css', 'text/css'],
        ['sub/path/test.js', 'application/javascript'],
        ['sub/path/test.json', 'application/json'],
        ['sub/path/test1.txt', 'text/plain'],
        ['sub/path/test2.txt', 'text/plain'],
        ['sub/path/testfile', undefined],
      ]);
    });
  },
);
