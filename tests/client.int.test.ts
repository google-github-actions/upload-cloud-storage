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

import 'mocha';
import { expect } from 'chai';

import { errorMessage, inParallel } from '@google-github-actions/actions-utils';
import { randomBytes } from 'crypto';
import { Storage } from '@google-cloud/storage';

import { getFilesInBucket, getFileNamesInBucket } from './util.test';
import { Client } from '../src/client';

const projectID = process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT;

describe('Client (integration)', () => {
  describe('#upload', () => {
    before(async function () {
      if (!projectID) this.skip();

      // Create storage handler.
      const storage = new Storage({
        projectId: projectID,
      });
      this.storage = storage;

      // Create a dedicated bucket for each run.
      const testBucketName = `client-${randomBytes(6).toString('hex')}-${
        process.env.GITHUB_SHA || 'unknown'
      }`;
      const [bucket] = await this.storage.createBucket(testBucketName, {
        location: 'US',
      });
      this.testBucket = bucket.name;
    });

    beforeEach(async function () {
      if (!projectID) this.skip();
    });

    afterEach(async function () {
      if (!projectID) this.skip();

      const storage: Storage = this.storage;
      const bucket = storage.bucket(this.testBucket);
      const [files] = await bucket.getFiles();
      const deleteOne = async (name: string): Promise<void> => {
        await bucket.file(name).delete();
      };

      const args: [name: string][] = files.map((file) => [file.name]);
      await inParallel(deleteOne, args);
    });

    after(async function () {
      if (!projectID) return;

      const storage: Storage = this.storage;
      const bucket = storage.bucket(this.testBucket);
      await bucket.delete();
    });

    it('throws an error on a non-existent bucket', async function () {
      const client = new Client({ projectID: projectID });

      try {
        await client.upload({
          root: './tests/testdata',
          files: ['test1.txt'],
          destination: 'definitely-not-a-real-bucket',
        });
        throw new Error('expected error');
      } catch (err: unknown) {
        const msg = errorMessage(err);
        expect(msg).to.include('bucket does not exist');
      }
    });

    it('throws an error on a non-existent directory', async function () {
      const client = new Client({ projectID: projectID });

      try {
        await client.upload({
          root: '/not/a/real/path',
          files: ['test1.txt'],
          destination: this.testBucket,
        });
        throw new Error('expected error');
      } catch (err: unknown) {
        const msg = errorMessage(err);
        expect(msg).to.include('ENOENT');
      }
    });

    it('throws an error on a non-existent file', async function () {
      const client = new Client({ projectID: projectID });

      try {
        await client.upload({
          root: './tests/testdata',
          files: ['not-a-real-file.txt'],
          destination: this.testBucket,
        });
        throw new Error('expected error');
      } catch (err: unknown) {
        const msg = errorMessage(err);
        expect(msg).to.include('ENOENT');
      }
    });

    it('uploads a single file', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt'],
        destination: this.testBucket,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql(['test1.txt']);
    });

    it('uploads files with the correct mime type', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test.css', 'test.js', 'test.json', 'test1.txt'],
        destination: this.testBucket,
      });

      const list = await getFilesInBucket(this.storage, this.testBucket);
      const names = list.map((file) => file.name);
      expect(names).to.eql(['test.css', 'test.js', 'test.json', 'test1.txt']);

      const css = list[0];
      expect(css?.metadata.contentType).to.eql('text/css');

      const js = list[1];
      expect(js?.metadata.contentType).to.eql('application/javascript');

      const json = list[2];
      expect(json?.metadata.contentType).to.eql('application/json');

      const txt = list[3];
      expect(txt?.metadata.contentType).to.eql('text/plain');
    });

    it('uploads a single file with prefix', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt'],
        destination: `${this.testBucket}/my/prefix`,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql(['my/prefix/test1.txt']);
    });

    it('uploads a single file without an extension', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['testfile'],
        destination: this.testBucket,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql(['testfile']);
    });

    it('uploads a single file with special characters in the filename', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['🚀'],
        destination: this.testBucket,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql(['🚀']);
    });

    it('uploads a single file with metadata', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt'],
        destination: this.testBucket,
        metadata: {
          contentType: 'application/json',
          metadata: {
            foo: 'bar',
          },
        },
      });

      const list = await getFilesInBucket(this.storage, this.testBucket);
      const metadata = list[0]?.metadata;
      expect(metadata?.contentType).to.eql('application/json');
      expect(metadata?.metadata?.foo).to.eql('bar');
    });

    it('uploads multiple files', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt', '🚀', 'nested1/test1.txt', 'nested1/nested2/test3.txt'],
        destination: this.testBucket,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql(['nested1/nested2/test3.txt', 'nested1/test1.txt', 'test1.txt', '🚀']);
    });

    it('uploads multiple files with parent set', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt', '🚀', 'nested1/test1.txt', 'nested1/nested2/test3.txt'],
        destination: this.testBucket,
        includeParent: true,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql([
        'testdata/nested1/nested2/test3.txt',
        'testdata/nested1/test1.txt',
        'testdata/test1.txt',
        'testdata/🚀',
      ]);
    });

    it('uploads multiple files with a prefix', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt', '🚀', 'nested1/test1.txt', 'nested1/nested2/test3.txt'],
        destination: `${this.testBucket}/prefix`,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql([
        'prefix/nested1/nested2/test3.txt',
        'prefix/nested1/test1.txt',
        'prefix/test1.txt',
        'prefix/🚀',
      ]);
    });

    it('uploads multiple files with parent set and a prefix', async function () {
      const client = new Client({ projectID: projectID });
      await client.upload({
        root: './tests/testdata',
        files: ['test1.txt', '🚀', 'nested1/test1.txt', 'nested1/nested2/test3.txt'],
        destination: `${this.testBucket}/prefix`,
        includeParent: true,
      });

      const list = await getFileNamesInBucket(this.storage, this.testBucket);
      expect(list).to.eql([
        'prefix/testdata/nested1/nested2/test3.txt',
        'prefix/testdata/nested1/test1.txt',
        'prefix/testdata/test1.txt',
        'prefix/testdata/🚀',
      ]);
    });
  });
});
