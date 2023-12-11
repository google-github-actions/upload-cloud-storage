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
import * as os from 'os';
import { promises as fs } from 'fs';

import * as core from '@actions/core';
import { clearEnv, forceRemove, setInputs } from '@google-github-actions/actions-utils';
import { Bucket, UploadOptions } from '@google-cloud/storage';

import { mockUpload } from './helpers.test';

import { run } from '../src/main';

/**
 * These are ONLY meant to be the highest-level tests that exercise the entire
 * workflow up to but not including the actual uploading of files.
 */
test('#run', { concurrency: true }, async (suite) => {
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
  });

  suite.beforeEach(async () => {
    // Create a temporary directory to serve as the actions workspace
    githubWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
    await fs.cp('tests/testdata', path.join(githubWorkspace, 'testdata'), {
      recursive: true,
      force: true,
    });
    process.env.GITHUB_WORKSPACE = githubWorkspace;
  });

  suite.afterEach(async () => {
    await forceRemove(githubWorkspace);

    clearEnv((key) => {
      return key.startsWith(`INPUT_`) || key.startsWith(`GITHUB_`);
    });
  });

  await suite.test('uploads all files', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: './testdata',
      destination: 'my-bucket/sub/path',
      gzip: 'true',
      resumable: 'true',
      parent: 'true',
      glob: '**/*',
      concurrency: '10',
      process_gcloudignore: 'false',
      predefinedAcl: 'authenticatedRead',
      headers: 'content-type: application/json',
    });

    await run();

    // Check call sites
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0)).sort();
    assert.deepStrictEqual(uploadedFiles, [
      path.join(githubWorkspace, 'testdata', 'nested1', 'nested2', 'test3.txt'),
      path.join(githubWorkspace, 'testdata', 'nested1', 'test1.txt'),
      path.join(githubWorkspace, 'testdata', 'test.css'),
      path.join(githubWorkspace, 'testdata', 'test.js'),
      path.join(githubWorkspace, 'testdata', 'test.json'),
      path.join(githubWorkspace, 'testdata', 'test1.txt'),
      path.join(githubWorkspace, 'testdata', 'test2.txt'),
      path.join(githubWorkspace, 'testdata', 'testfile'),
    ]);

    // Check arguments
    const call = uploadMock.mock.calls.at(0)?.arguments?.at(1) as UploadOptions;
    assert.deepStrictEqual(call?.destination, 'sub/path/testdata/nested1/nested2/test3.txt');
    assert.deepStrictEqual(call?.metadata, { contentType: 'application/json' });
    assert.deepStrictEqual(call?.gzip, true);
    assert.deepStrictEqual(call?.predefinedAcl, 'authenticatedRead');
    assert.deepStrictEqual(call?.resumable, true);
  });

  await suite.test('uploads all files without a parent', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: './testdata',
      destination: 'my-bucket/sub/path',
      gzip: 'true',
      resumable: 'true',
      parent: 'false',
      glob: '**/*',
      concurrency: '10',
      process_gcloudignore: 'false',
      predefinedAcl: 'authenticatedRead',
      headers: 'content-type: application/json',
    });

    await run();

    // Check call sites
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0)).sort();
    assert.deepStrictEqual(uploadedFiles, [
      path.join(githubWorkspace, 'testdata', 'nested1', 'nested2', 'test3.txt'),
      path.join(githubWorkspace, 'testdata', 'nested1', 'test1.txt'),
      path.join(githubWorkspace, 'testdata', 'test.css'),
      path.join(githubWorkspace, 'testdata', 'test.js'),
      path.join(githubWorkspace, 'testdata', 'test.json'),
      path.join(githubWorkspace, 'testdata', 'test1.txt'),
      path.join(githubWorkspace, 'testdata', 'test2.txt'),
      path.join(githubWorkspace, 'testdata', 'testfile'),
    ]);

    // Check upload paths
    const paths = uploadMock.mock.calls.map(
      (call) => (call.arguments?.at(1) as UploadOptions)?.destination,
    );
    assert.deepStrictEqual(paths, [
      'sub/path/nested1/nested2/test3.txt',
      'sub/path/nested1/test1.txt',
      'sub/path/test.css',
      'sub/path/test.js',
      'sub/path/test.json',
      'sub/path/test1.txt',
      'sub/path/test2.txt',
      'sub/path/testfile',
    ]);
  });

  await suite.test('uploads a single file', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: './testdata/test.css',
      destination: 'my-bucket/sub/path',
      gzip: 'true',
      resumable: 'true',
      // Even though this is true, the parent directory shouldn't be included
      // for direct file paths.
      parent: 'true',
      concurrency: '10',
      process_gcloudignore: 'false',
    });

    await run();

    // Check call sites
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0)).sort();
    assert.deepStrictEqual(uploadedFiles, [path.join(githubWorkspace, 'testdata', 'test.css')]);

    // Check arguments
    const call = uploadMock.mock.calls.at(0)?.arguments?.at(1) as UploadOptions;
    assert.deepStrictEqual(call?.destination, 'sub/path/test.css');
  });

  await suite.test('processes a gcloudignore', async (t) => {
    const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);

    setInputs({
      path: './testdata',
      destination: 'my-bucket/sub/path',
      gzip: 'true',
      resumable: 'true',
      parent: 'true',
      concurrency: '10',
      process_gcloudignore: 'true',
    });

    // Add gcloudignore
    await fs.writeFile(path.join(githubWorkspace, '.gcloudignore'), '*.txt');

    await run();

    // Check call sites
    const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0));
    assert.deepStrictEqual(uploadedFiles, [
      path.join(githubWorkspace, 'testdata', 'test.css'),
      path.join(githubWorkspace, 'testdata', 'test.js'),
      path.join(githubWorkspace, 'testdata', 'test.json'),
      path.join(githubWorkspace, 'testdata', 'testfile'),
    ]);

    // Check arguments
    const call = uploadMock.mock.calls.at(0)?.arguments?.at(1) as UploadOptions;
    assert.deepStrictEqual(call?.destination, 'sub/path/testdata/test.css');
  });
});
