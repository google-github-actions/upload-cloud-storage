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

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import * as path from 'path';

import { Client } from '../src/client';
import { stubUpload } from './util.test';

describe('Client', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('#new', () => {
    it('initializes with JSON creds', function () {
      const client = new Client({
        credentials: `{"foo":"bar"}`,
      });
      expect(client.storage.authClient.jsonContent).eql({ foo: 'bar' });
    });

    it('initializes with ADC', function () {
      const client = new Client();
      expect(client.storage.authClient.jsonContent).eql(null);
    });
  });

  describe('#upload', () => {
    it('calls uploadFile', async () => {
      const stub = stubUpload();

      // Do the upload
      const client = new Client();
      await client.upload({
        destination: 'bucket/prefix/sub',
        root: 'my-root',
        files: ['file1', 'file2', 'nested/file3'],
        concurrency: 10,
        includeParent: true,
        metadata: {
          contentType: 'application/json',
        },
        gzip: true,
        resumable: true,
        predefinedAcl: 'authenticatedRead',
      });

      // Check call sites
      const uploadedFiles = stub.getCalls().map((call) => call.args[0]);
      expect(uploadedFiles).to.eql([
        path.join(process.cwd(), 'my-root', 'nested', 'file3'),
        path.join(process.cwd(), 'my-root', 'file2'),
        path.join(process.cwd(), 'my-root', 'file1'),
      ]);

      const call = stub.getCall(0).args[1];
      if (!call) {
        throw new Error('expected first call to be defined');
      }
      expect(call.destination).to.eql('prefix/sub/my-root/nested/file3');
      expect(call.metadata).to.eql({ contentType: 'application/json' });
      expect(call.gzip).to.eql(true);
      expect(call.predefinedAcl).to.eql('authenticatedRead');
      expect(call.resumable).to.eql(true);
      expect(call.configPath).to.be;
    });

    it('respects includeParent as false', async () => {
      const stub = stubUpload();

      // Do the upload
      const client = new Client();
      await client.upload({
        destination: 'bucket',
        root: 'my-root',
        files: ['file1', 'file2', 'nested/file3'],
        concurrency: 10,
        includeParent: false,
      });

      // Check call sites
      const uploadedFiles = stub.getCalls().map((call) => call.args[0]);
      expect(uploadedFiles).to.eql([
        path.join(process.cwd(), 'my-root', 'nested', 'file3'),
        path.join(process.cwd(), 'my-root', 'file2'),
        path.join(process.cwd(), 'my-root', 'file1'),
      ]);

      const call = stub.getCall(0).args[1];
      if (!call) {
        throw new Error('expected first call to be defined');
      }
      expect(call.destination).to.eql('nested/file3');
    });
  });
});
