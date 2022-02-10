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

/**
 * WorkerPool represents a generic class for handling concurrent processing of
 * asyncronous functions and/or promises, with control over the maximum
 * concurrency.
 *
 * To prevent premature execution, the pool accepts a function of promise(s).
 *
 */
export class WorkerPool<T> {
  /**
   * queue is the currently processing queue.
   */
  #queue: { (): PromiseLike<T> }[];
  #started: boolean;

  /**
   * sem is the semaphore.
   */
  #sem: Semaphore;

  constructor(opts = { concurrency: 50 }) {
    this.#queue = [];
    this.#sem = new Semaphore(opts.concurrency);
    this.#queue = [];
    this.#started = false;
  }

  /**
   * queue adds a new function to the queue. It will not be processed until
   * process() begins. It is invalid to call queue() after process().
   */
  async queue(fn: { (): PromiseLike<T> }) {
    if (this.#started) {
      throw new Error('Cannot queue - already started');
    }
    this.#queue.push(fn);
  }

  /**
   * process begins processing the queue and returns the result. It is invalid
   * to push more messages onto the queue once processing has started.
   */
  async process(): Promise<T[]> {
    const results: T[] = [];
    const errors: string[] = [];

    for (const fn of this.#queue) {
      await this.#sem.acquire(1);

      (async () => {
        try {
          const result = await fn();
          results.push(result);
        } catch (err) {
          errors.push(`${err}`);
        } finally {
          this.#sem.release();
        }
      })();
    }

    // Wait for any background promises to resolve.
    await this.#sem.wait();

    if (errors.length > 0) {
      throw new Error(
        `${errors.length} error(s) occured:\n` +
          errors.map((err) => `- ${err}`).join('\n'),
      );
    }

    return results;
  }
}

/**
 * Semaphore is a semaphore implementation.
 */
class Semaphore {
  #max: number;
  #active: number;
  #interval: number;

  constructor(max = 1) {
    this.#max = max;
    this.#active = 0;
    this.#interval = 50;
  }

  /**
   * acquire attempts to acquire the number of items from the semaphore. It
   * blocks until the semaphore can be acquired. If the number requested exceeds
   * the maximum allowed, it throws an error.
   *
   * @param num Number of items to acquire. Defaults to 1.
   */
  async acquire(num = 1) {
    if (num < 1) {
      throw new Error(`semaphore must acquire at least 1`);
    }
    if (num > this.#max) {
      throw new Error(`semaphore acquire ${num} exceeds max of ${this.#max}`);
    }

    await new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.#active + num <= this.#max) {
          this.#active += num;
          resolve(this.#active);
          return true;
        }
        return false;
      };

      if (!tryAcquire()) {
        const int = setInterval(() => {
          if (tryAcquire()) {
            clearInterval(int);
          }
        }, this.#interval);
      }
    });
  }

  /**
   * Release removes the number of items from the semaphore.
   *
   * @param Number of items to release. Defaults to 1.
   */
  release(num = 1) {
    this.#active -= num;
    if (this.#active <= 0) {
      this.#active = 0;
    }
  }

  /**
   * wait waits until all semaphores have been acquired.
   */
  async wait() {
    await this.acquire(this.#max);
  }
}
