/*
 * Copyright 2021 Google LLC
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

import { inParallel } from '@google-github-actions/actions-utils';
import { randomBytes } from 'crypto';
import { Storage } from '@google-cloud/storage';

import { Client } from '../src/client';

const projectID = process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT;

test(
  'integration/Client#upload',
  {
    concurrency: true,
    skip: ((): string | undefined => {
      if (!projectID) return `missing $UPLOAD_CLOUD_STORAGE_TEST_PROJECT`;
    })(),
  },
  async (suite) => {
    let storage: Storage;
    let testBucket: string;

    suite.before(async () => {
      storage = new Storage({
        projectId: projectID,
      });

      // Create a dedicated bucket for each run.
      const testBucketName = `client-${randomBytes(6).toString('hex')}-${
        process.env.GITHUB_SHA || 'unknown'
      }`;
      const [bucket] = await storage.createBucket(testBucketName, {
        location: 'US',
      });
      testBucket = bucket.name;
    });

    suite.afterEach(async () => {
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

    await suite.test('throws an error on a non-existent bucket', async () => {
      const client = new Client({ projectID: projectID });
      await assert.rejects(async () => {
        await client.upload({
          bucket: 'definitely-not-a-real-bucket',
          files: [{ source: './tests/testdata/test1.txt', destination: 'test1.txt' }],
        });
      }, 'dafdaf');
    });

    await suite.test('throws an error on a non-existent file', async () => {
      const client = new Client({ projectID: projectID });
      await assert.rejects(async () => {
        await client.upload({
          bucket: testBucket,
          files: [{ source: 'test1.txt', destination: 'test1.txt' }],
        });
      }, /ENOENT/);
    });

    await suite.test('uploads a single file', async () => {
      const client = new Client({ projectID: projectID });
      await client.upload({
        bucket: testBucket,
        files: [{ source: './tests/testdata/test1.txt', destination: 'test1.txt' }],
      });

      const [files] = await storage.bucket(testBucket).getFiles();
      const list = files.map((file) => file.name);
      assert.deepStrictEqual(list, ['test1.txt']);
    });

    await suite.test('uploads files with the correct mime type', async () => {
      const client = new Client({ projectID: projectID });
      await client.upload({
        bucket: testBucket,
        files: [
          { source: './tests/testdata/test.css', destination: 'test.css' },
          { source: './tests/testdata/test.js', destination: 'test.js' },
          { source: './tests/testdata/test.json', destination: 'test.json' },
          { source: './tests/testdata/test1.txt', destination: 'test1.txt' },
        ],
      });

      const [files] = await storage.bucket(testBucket).getFiles();
      const list = files.map((file) => file.name);
      assert.deepStrictEqual(list, ['test.css', 'test.js', 'test.json', 'test1.txt']);

      const css = files[0];
      assert.deepStrictEqual(css?.metadata?.contentType, 'text/css');

      const js = files[1];
      assert.deepStrictEqual(js?.metadata?.contentType, 'application/javascript');

      const json = files[2];
      assert.deepStrictEqual(json?.metadata?.contentType, 'application/json');

      const txt = files[3];
      assert.deepStrictEqual(txt?.metadata?.contentType, 'text/plain');
    });

    await suite.test('uploads a single file with prefix', async () => {
      const client = new Client({ projectID: projectID });
      await client.upload({
        bucket: testBucket,
        files: [{ source: './tests/testdata/test1.txt', destination: 'my/prefix/test1.txt' }],
      });

      const [files] = await storage.bucket(testBucket).getFiles();
      const list = files.map((file) => file.name);
      assert.deepStrictEqual(list, ['my/prefix/test1.txt']);
    });

    await suite.test('uploads a single file without an extension', async () => {
      const client = new Client({ projectID: projectID });
      await client.upload({
        bucket: testBucket,
        files: [{ source: './tests/testdata/testfile', destination: 'testfile' }],
      });

      const [files] = await storage.bucket(testBucket).getFiles();
      const list = files.map((file) => file.name);
      assert.deepStrictEqual(list, ['testfile']);
    });

    await suite.test(
      'uploads a file with unicode characters in the filename',
      { skip: process.platform === 'win32' },
      async () => {
        const client = new Client({ projectID: projectID });
        await client.upload({
          bucket: testBucket,
          files: [{ source: './tests/testdata-unicode/🚀', destination: '🚀' }],
        });

        const [files] = await storage.bucket(testBucket).getFiles();
        const list = files.map((file) => file.name);
        assert.deepStrictEqual(list, ['🚀']);
      },
    );

    await suite.test('uploads a single file with metadata', async () => {
      const client = new Client({ projectID: projectID });
      await client.upload({
        bucket: testBucket,
        files: [{ source: './tests/testdata/test1.txt', destination: 'test1.txt' }],
        metadata: {
          contentType: 'application/json',
          metadata: {
            foo: 'bar',
          },
        },
      });

      const [files] = await storage.bucket(testBucket).getFiles();
      const metadata = files[0]?.metadata;

      assert.deepStrictEqual(metadata?.contentType, 'application/json');
      assert.deepStrictEqual(metadata?.metadata?.foo, 'bar');
    });
  },
);
