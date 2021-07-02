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

import * as core from '@actions/core';
import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import { parseHeadersInput } from '../src/headers';

/**
 * Unit Test parseHeadersInput method in headers.
 */
describe('Unit Test parseHeadersInput', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('parse settable fields', async function() {
    const warningStub = sinon.stub(core, 'warning');
    const input = `
            cache-control: public, max-age=3600
            content-disposition: attachment; filename=file.json;
            content-encoding: gzip
            content-language: en
            content-type: application/json
            custom-time: 1985-04-12T23:20:50.52Z
        `;
    const metadata = parseHeadersInput(input);
    expect(metadata.cacheControl).eq('public, max-age=3600');
    expect(metadata.contentDisposition).eq('attachment; filename=file.json;');
    expect(metadata.contentEncoding).eq('gzip');
    expect(metadata.contentLanguage).eq('en');
    expect(metadata.contentType).eq('application/json');
    expect(metadata.customTime).eq('1985-04-12T23:20:50.52Z');
    expect(warningStub.notCalled);
  });

  it('parse custom metadata', async function() {
    const warningStub = sinon.stub(core, 'warning');
    const input = `
            x-goog-meta-foo: value1
            x-goog-meta-bar: value2
            x-goog-meta-baz: 🚀:to:the:moon
        `;

    const metadata = parseHeadersInput(input);
    expect(metadata.metadata).not.undefined;
    if (metadata.metadata) {
      expect(metadata.metadata.foo).eq('value1');
      expect(metadata.metadata.bar).eq('value2');
      expect(metadata.metadata.baz).eq('🚀:to:the:moon');
    }
    expect(warningStub.notCalled);
  });

  it('invalid fields are ignored', async function() {
    const warningStub = sinon.stub(core, 'warning');
    const input = `
            invalid: value
            Content-Length: 123
        `;
    const metadata = parseHeadersInput(input);
    expect(metadata.metadata).undefined;
    expect(warningStub.calledTwice);
  });
});
