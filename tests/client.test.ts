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

import { describe, test } from 'node:test';
import assert from 'node:assert';

import * as path from 'path';

import { forceRemove, randomFilepath, writeSecureFile } from '@google-github-actions/actions-utils';

import { Client } from '../src/client';
import { Bucket, UploadOptions } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';

import { mockUpload } from './helpers.test';

describe('Client', { concurrency: true }, async () => {
  test('.build', async (suite) => {
    const originalEnv = Object.assign({}, process.env);
    const appCreds = {
      client_email: 'test-email@example.com',
      private_key: 'test-private-key',
    };
    const appCredsJSON = await writeSecureFile(randomFilepath(), JSON.stringify(appCreds));

    suite.beforeEach(async () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = appCredsJSON;
    });

    suite.afterEach(async () => {
      await forceRemove(appCredsJSON);
      process.env = originalEnv;
    });

    await suite.test('initializes with ADC', async () => {
      const client = await Client.build();
      const result = client?.storage?.authClient?.jsonContent;
      assert.deepStrictEqual(result, appCreds);
    });
  });

  test('.computeDestinations', async (suite) => {
    const cases = [
      {
        name: 'no files',
        input: {
          givenRoot: '',
          absoluteRoot: '',
          files: [],
        },
        expected: [],
      },

      // relative
      {
        name: 'relative given root',
        input: {
          givenRoot: 'foo/bar',
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'nested/sub/file2',
          },
        ],
      },
      {
        name: 'relative given root with parent',
        input: {
          givenRoot: 'foo/bar',
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
          includeParent: true,
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'bar/file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'bar/nested/sub/file2',
          },
        ],
      },
      {
        name: 'relative given root with prefix',
        input: {
          givenRoot: 'foo/bar',
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
          prefix: 'prefix',
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'prefix/file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'prefix/nested/sub/file2',
          },
        ],
      },
      {
        name: 'relative given root with parent and prefix',
        input: {
          givenRoot: 'foo/bar',
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
          prefix: 'prefix',
          includeParent: true,
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'prefix/bar/file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'prefix/bar/nested/sub/file2',
          },
        ],
      },

      // absolute
      {
        name: 'absolute given root',
        input: {
          givenRoot: path.join(process.cwd(), 'foo', 'bar'),
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'nested/sub/file2',
          },
        ],
      },
      {
        name: 'absolute given root with parent',
        input: {
          givenRoot: path.join(process.cwd(), 'foo', 'bar'),
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
          includeParent: true,
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'bar/file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'bar/nested/sub/file2',
          },
        ],
      },
      {
        name: 'absolute given root with prefix',
        input: {
          givenRoot: path.join(process.cwd(), 'foo', 'bar'),
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
          prefix: 'prefix',
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'prefix/file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'prefix/nested/sub/file2',
          },
        ],
      },
      {
        name: 'absolute given root with parent and prefix',
        input: {
          givenRoot: path.join(process.cwd(), 'foo', 'bar'),
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
          prefix: 'prefix',
          includeParent: true,
        },
        expected: [
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'file1'),
            destination: 'prefix/bar/file1',
          },
          {
            source: path.join(process.cwd(), 'foo', 'bar', 'nested', 'sub', 'file2'),
            destination: 'prefix/bar/nested/sub/file2',
          },
        ],
      },
    ];

    for (const tc of cases) {
      await suite.test(tc.name, async () => {
        const result = Client.computeDestinations(tc.input);
        assert.deepStrictEqual(result, tc.expected);
      });
    }
  });

  test('#upload', async (suite) => {
    await suite.test('calls uploadFile', async (t) => {
      const uploadMock = t.mock.method(Bucket.prototype, 'upload', mockUpload);
      t.mock.method(GoogleAuth.prototype, 'getClient', () => {});

      // Do the upload
      const client = await Client.build();
      await client.upload({
        bucket: 'my-bucket',
        files: [
          {
            source: path.join(process.cwd(), 'file1'),
            destination: 'sub/path/to/file1',
          },
          {
            source: path.join(process.cwd(), 'nested', 'file2'),
            destination: 'sub/path/to/nested/file2',
          },
        ],
        concurrency: 10,
        metadata: {
          contentType: 'application/json',
        },
        gzip: true,
        resumable: true,
        predefinedAcl: 'authenticatedRead',
      });

      // Check call sites
      const uploadedFiles = uploadMock.mock.calls.map((call) => call?.arguments?.at(0));
      assert.deepStrictEqual(uploadedFiles, [
        path.join(process.cwd(), 'file1'),
        path.join(process.cwd(), 'nested', 'file2'),
      ]);

      const call = uploadMock.mock.calls.at(0)?.arguments?.at(1) as UploadOptions;
      assert.deepStrictEqual(call?.destination, 'sub/path/to/file1');
      assert.deepStrictEqual(call?.metadata, { contentType: 'application/json' });
      assert.deepStrictEqual(call?.gzip, true);
      assert.deepStrictEqual(call?.predefinedAcl, 'authenticatedRead');
      assert.deepStrictEqual(call?.resumable, true);
    });
  });
});
