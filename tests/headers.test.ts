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

import { parseHeadersInput } from '../src/headers';

describe('#parseHeadersInput', () => {
  const cases = [
    {
      name: 'empty string',
      input: ``,
      expected: {},
    },
    {
      name: 'empty string padded',
      input: `

      `,
      expected: {},
    },
    {
      name: 'empty string padded',
      input: `
        cache-control: public, max-age=3600
        content-disposition: attachment; filename=file.json;
        content-encoding: gzip
        content-language: en
        content-type: application/json
        custom-time: 1985-04-12T23:20:50.52Z
      `,
      expected: {
        cacheControl: 'public, max-age=3600',
        contentDisposition: 'attachment; filename=file.json;',
        contentEncoding: 'gzip',
        contentLanguage: 'en',
        contentType: 'application/json',
        customTime: '1985-04-12T23:20:50.52Z',
      },
    },
    {
      name: 'custom data',
      input: `
        x-goog-meta-foo: value1
        x-goog-meta-bar: value2
        x-goog-meta-baz: 🚀:to:the:moon
      `,
      expected: {
        metadata: {
          foo: 'value1',
          bar: 'value2',
          baz: '🚀:to:the:moon',
        },
      },
    },
    {
      name: 'value multiple colons',
      input: `
        x-goog-meta-foo: it::has:::fun
      `,
      expected: {
        metadata: {
          foo: 'it::has:::fun',
        },
      },
    },
    {
      name: 'no key',
      input: 'value',
      error: 'Failed to parse header',
    },
    {
      name: 'no value',
      input: 'value',
      error: 'Failed to parse header',
    },
    {
      name: 'duplicate',
      input: `
        one: two
        one: three
      `,
      error: 'key "one" already exists',
    },
    {
      name: 'invalid custom',
      input: 'invalid: value',
      error: 'must be prefixed with',
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, () => {
      if (tc.expected) {
        expect(parseHeadersInput(tc.input)).to.eql(tc.expected);
      } else if (tc.error) {
        expect(() => {
          parseHeadersInput(tc.input);
        }).to.throw(tc.error);
      }
    });
  });
});
