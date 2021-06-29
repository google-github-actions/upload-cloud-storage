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

import { expect } from 'chai';
import 'mocha';
import { GetDestinationFromPath } from '../src/util';

/**
 * Unit Test GetDestinationFromPath method in utils.
 */
describe('Unit Test GetDestinationFromPath', function() {
  const tests = [
    {
      name: 'returns correct destination for a file',
      input: {
        filePath: 'foo/bar.txt',
        directory: 'foo',
        parent: true,
        prefix: '',
      },
      output: 'foo/bar.txt',
    },
    {
      name: 'returns correct destination for a file within dir',
      input: {
        filePath: 'foo/bar/bar.txt',
        directory: 'foo',
        parent: true,
        prefix: '',
      },
      output: 'foo/bar/bar.txt',
    },
    {
      name: 'returns correct destination for a file with two dirs in path',
      input: {
        filePath: 'foo/bar/bar.txt',
        directory: 'foo/bar',
        parent: true,
        prefix: '',
      },
      output: 'foo/bar/bar.txt',
    },
    {
      name: 'returns correct destination for a file with prefix',
      input: {
        filePath: 'foo/bar.txt',
        directory: 'foo',
        parent: true,
        prefix: 'prfx',
      },
      output: 'prfx/foo/bar.txt',
    },
    {
      name: 'returns correct destination for a file with two prefixes',
      input: {
        filePath: 'foo/bar.txt',
        directory: 'foo',
        parent: true,
        prefix: 'prfx1/prfx2',
      },
      output: 'prfx1/prfx2/foo/bar.txt',
    },
    {
      name:
        'returns correct destination for a file with relative path with two prefixes',
      input: {
        filePath: './foo/bar.txt',
        directory: 'foo',
        parent: true,
        prefix: 'prfx1/prfx2',
      },
      output: 'prfx1/prfx2/foo/bar.txt',
    },
    {
      name: 'returns correct destination for a file without parent',
      input: {
        filePath: 'foo/bar.txt',
        directory: 'foo',
        parent: false,
        prefix: '',
      },
      output: 'bar.txt',
    },
    {
      name: 'returns correct destination for a file without parent within dir',
      input: {
        filePath: 'foo/bar/bar.txt',
        directory: 'foo',
        parent: false,
        prefix: '',
      },
      output: 'bar/bar.txt',
    },
    {
      name:
        'returns correct destination for a file without parent with two dirs in path',
      input: {
        filePath: 'foo/bar/bar.txt',
        directory: 'foo/bar',
        parent: false,
        prefix: '',
      },
      output: 'bar.txt',
    },
    {
      name:
        'returns correct destination for a file with relative path without parent with two dirs in path',
      input: {
        filePath: './foo/bar/bar.txt',
        directory: 'foo/bar',
        parent: false,
        prefix: '',
      },
      output: 'bar.txt',
    },
    {
      name: 'returns correct destination for a file without parent with prefix',
      input: {
        filePath: 'foo/bar.txt',
        directory: 'foo',
        parent: false,
        prefix: 'prfx',
      },
      output: 'prfx/bar.txt',
    },
    {
      name:
        'returns correct destination for a file without parent with two prefixes',
      input: {
        filePath: 'foo/bar.txt',
        directory: 'foo',
        parent: false,
        prefix: 'prfx1/prfx2',
      },
      output: 'prfx1/prfx2/bar.txt',
    },
    {
      name:
        'returns correct destination for a file with relative path without parent with two prefixes',
      input: {
        filePath: './foo/bar.txt',
        directory: 'foo',
        parent: false,
        prefix: 'prfx1/prfx2',
      },
      output: 'prfx1/prfx2/bar.txt',
    },
  ];
  tests.forEach((test) => {
    it(test.name, async function() {
      const { filePath, directory, parent, prefix } = test.input;
      const destination = await GetDestinationFromPath(
        filePath,
        directory,
        parent,
        prefix,
      );
      expect(destination).eq(test.output);
    });
  });
});
