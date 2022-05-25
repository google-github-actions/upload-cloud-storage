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

import { Client, ClientComputeDestinationOptions, ClientFileUpload } from '../src/client';
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

  describe('.computeDestinations', () => {
    const cases: {
      only?: boolean;
      name: string;
      input: ClientComputeDestinationOptions;
      exp: ClientFileUpload[];
    }[] = [
      {
        name: 'no files',
        input: {
          givenRoot: '',
          absoluteRoot: '',
          files: [],
        },
        exp: [],
      },

      // relative
      {
        name: 'relative given root',
        input: {
          givenRoot: 'foo/bar',
          absoluteRoot: path.join(process.cwd(), 'foo', 'bar'),
          files: ['file1', 'nested/sub/file2'],
        },
        exp: [
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
        exp: [
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
        exp: [
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
        exp: [
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
        exp: [
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
        exp: [
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
        exp: [
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
        exp: [
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

    cases.forEach((tc) => {
      const fn = tc.only ? it.only : it;
      fn(tc.name, () => {
        const result = Client.computeDestinations(tc.input);
        expect(result).to.eql(tc.exp);
      });
    });
  });

  describe('#upload', () => {
    it('calls uploadFile', async () => {
      const stub = stubUpload();

      // Do the upload
      const client = new Client();
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
      const uploadedFiles = stub.getCalls().map((call) => call.args[0]);
      expect(uploadedFiles).to.eql([
        path.join(process.cwd(), 'nested', 'file2'),
        path.join(process.cwd(), 'file1'),
      ]);

      const call = stub.getCall(0).args[1];
      if (!call) {
        throw new Error('expected first call to be defined');
      }
      expect(call.destination).to.eql('sub/path/to/nested/file2');
      expect(call.metadata).to.eql({ contentType: 'application/json' });
      expect(call.gzip).to.eql(true);
      expect(call.predefinedAcl).to.eql('authenticatedRead');
      expect(call.resumable).to.eql(true);
    });
  });
});
