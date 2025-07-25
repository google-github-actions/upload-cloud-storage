/*
 * Copyright 2025 Google LLC
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
import * as os from 'os';
import { promises as fs } from 'fs';

import * as core from '@actions/core';
import { clearEnv, forceRemove, setInputs } from '@google-github-actions/actions-utils';
import { Bucket, UploadOptions } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';

import { mockUpload } from './helpers.test';
import { run } from '../src/main';

/**
 * Test multiple paths functionality
 */
test('#run multiple paths', { concurrency: true }, async (suite) => {
  let githubWorkspace: string;

  suite.before(() => {
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

    // We do not care about authentication in the unit tests
    suite.mock.method(GoogleAuth.prototype, 'getClient', () => {});
  });

  suite.beforeEach(async () => {
    // Create a temporary directory to serve as the actions workspace
    githubWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
    
    // Create test files directly in the workspace 
    await fs.writeFile(path.join(githubWorkspace, 'file1.json'), '{"test": 1}');
    await fs.writeFile(path.join(githubWorkspace, 'file2.json'), '{"test": 2}');
    await fs.writeFile(path.join(githubWorkspace, 'other.txt'), 'not a json file');
    
    process.env.GITHUB_WORKSPACE = githubWorkspace;
  });

  suite.afterEach(async () => {
    await forceRemove(githubWorkspace);

    clearEnv((key) => {
      return key.startsWith(`INPUT_`) || key.startsWith(`GITHUB_`);
    });
  });

  await suite.test('uploads multiple specific files', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: `file1.json
file2.json`,
      destination: 'my-bucket',
      parent: 'false',
      process_gcloudignore: 'false',
    });

    await run();

    // Check that both files were uploaded
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0) as string).sort();
    assert.strictEqual(uploadedFiles.length, 2);
    assert.deepStrictEqual(uploadedFiles, [
      path.join(githubWorkspace, 'file1.json'),
      path.join(githubWorkspace, 'file2.json'),
    ]);

    // Check call sites - should be called twice
    assert.strictEqual(uploadMock.mock.calls.length, 2);
  });

  await suite.test('uploads multiple specific files with pipe syntax', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: `file1.json
file2.json`,
      destination: 'my-bucket',
      parent: 'false', 
      process_gcloudignore: 'false',
    });

    await run();

    // Check that both files were uploaded and not the .txt file
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0) as string).sort();
    assert.strictEqual(uploadedFiles.length, 2);
    
    // Verify that only JSON files were uploaded, not the .txt file
    assert.deepStrictEqual(uploadedFiles, [
      path.join(githubWorkspace, 'file1.json'),
      path.join(githubWorkspace, 'file2.json'),
    ]);
  });

  await suite.test('handles single path normally', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: 'file1.json',
      destination: 'my-bucket',
      parent: 'false',
      process_gcloudignore: 'false',
    });

    await run();

    // Check that only one file was uploaded
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0) as string);
    assert.strictEqual(uploadedFiles.length, 1);
    assert.deepStrictEqual(uploadedFiles, [path.join(githubWorkspace, 'file1.json')]);
  });

  await suite.test('ignores empty lines in multiple paths', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: `file1.json

file2.json

`,
      destination: 'my-bucket',
      parent: 'false',
      process_gcloudignore: 'false',
    });

    await run();

    // Check that both files were uploaded despite empty lines
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0) as string).sort();
    assert.strictEqual(uploadedFiles.length, 2);
    assert.deepStrictEqual(uploadedFiles, [
      path.join(githubWorkspace, 'file1.json'),
      path.join(githubWorkspace, 'file2.json'),
    ]);
  });
});
