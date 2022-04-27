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

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import * as path from 'path';
import { randomBytes } from 'crypto';

import * as core from '@actions/core';
import { clearEnv, inParallel, setInputs } from '@google-github-actions/actions-utils';
import { Storage } from '@google-cloud/storage';

import { getFilesInBucket } from './util.test';
import { run } from '../src/main';

const projectID = process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT;

describe('main (integration)', () => {
  describe('#run', () => {
    before(async function () {
      if (!projectID) this.skip();

      // Create storage handler.
      const storage = new Storage({
        projectId: projectID,
      });
      this.storage = storage;

      // Create a dedicated bucket for each run.
      const testBucketName = `main-${randomBytes(6).toString('hex')}-${
        process.env.GITHUB_SHA || 'unknown'
      }`;
      const [bucket] = await this.storage.createBucket(testBucketName, {
        location: 'US',
      });
      this.testBucket = bucket.name;

      process.env.GITHUB_WORKSPACE = path.join(path.dirname(__dirname), 'tests');
    });

    beforeEach(async function () {
      if (!projectID) this.skip();

      // Stub somewhat annoying logs
      const doNothing = () => {
        /** do nothing */
      };
      sinon.stub(core, 'debug').callsFake(doNothing);
      sinon.stub(core, 'info').callsFake(doNothing);
      sinon.stub(core, 'warning').callsFake(doNothing);
      sinon.stub(core, 'setOutput').callsFake(doNothing);
    });

    afterEach(async function () {
      if (!projectID) this.skip();

      sinon.restore();

      clearEnv((key) => {
        return key.startsWith(`INPUT_`) || key.startsWith(`GITHUB_`);
      });

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

    it('uploads all files', async function () {
      setInputs({
        // project_id cannot actually be undefined if we got here, but
        // TypeScript doesn't know about Mocha's skip().
        project_id: projectID || '',
        path: './testdata',
        destination: `${this.testBucket}/sub/path`,
        gzip: 'true',
        resumable: 'true',
        parent: 'false',
        glob: '**/*',
        concurrency: '10',
        process_gcloudignore: 'false',
        predefinedAcl: 'authenticatedRead',
      });

      await run();

      const list = await getFilesInBucket(this.storage, this.testBucket);
      const names = list.map((file) => [file.name, file.metadata.contentType]);
      expect(names).to.eql([
        ['sub/path/nested1/nested2/test3.txt', 'text/plain'],
        ['sub/path/nested1/test1.txt', 'text/plain'],
        ['sub/path/test.css', 'text/css'],
        ['sub/path/test.js', 'application/javascript'],
        ['sub/path/test.json', 'application/json'],
        ['sub/path/test1.txt', 'text/plain'],
        ['sub/path/test2.txt', 'text/plain'],
        ['sub/path/testfile', undefined],
        ['sub/path/🚀', undefined],
      ]);
    });
  });
});
