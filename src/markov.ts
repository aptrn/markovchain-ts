/**
 * Constant used to pad the beginning of runs in a corpus
 * @private
 * @constant
 * @type string
 */
export const BEGIN = "@@MARKOV_CHAIN_BEGIN";

/**
 * Constant used to pad the end of runs in a corpus
 * @private
 * @constant
 * @type string
 */
export const END = "@@MARKOV_CHAIN_END";

/**
 * The default state size
 * @private
 * @constant
 * @type number
 */
export const DEFAULT_STATE_SIZE = 1;

/**
 * A Markov chain representing processes that have both beginnings and ends.
 * For example: Sentences.
 */
export class Chain {
  model: any;
  stateSize: number;

  constructor(corpusOrModel: any, options: { stateSize?: number } = {}) {
    this.stateSize = options.stateSize || DEFAULT_STATE_SIZE;

    if (corpusOrModel instanceof Object && !Array.isArray(corpusOrModel)) {
      this.model = corpusOrModel;
    } else {
      this.model = Chain.build(corpusOrModel, { stateSize: this.stateSize });
    }
  }

  /**
   * Creates an object where the keys represent all possible states,
   * and point to another object representing all possibilities for the 'next' item in the chain,
   * along with the count of times it appears.
   *
   * @param {any[][]} corpus The corpus to use to build the chain
   * @param {Object} [opts] Options object
   * @param {number} [opts.stateSize=1] The state size of the object
   * @return {Object}
   */
  static build(
    corpus: any[][],
    options: { stateSize: number } = { stateSize: 1 }
  ): any {
    if (!Array.isArray(corpus)) {
      throw new Error("Corpus must be a List or an Array");
    }

    const model: any = {};
    const beginPadding = createBeginState(
      options.stateSize || DEFAULT_STATE_SIZE
    );

    for (let i = 0; i < corpus.length; i++) {
      const run = corpus[i];
      if (!Array.isArray(run)) {
        throw new Error("Invalid run in corpus: Must be an array");
      }

      const paddedRun = new Array(beginPadding.length + run.length + 1);
      for (let j = 0; j < beginPadding.length; j++) {
        paddedRun[j] = beginPadding[j];
      }
      for (let j = 0; j < run.length; j++) {
        paddedRun[j + beginPadding.length] = run[j];
      }
      paddedRun[paddedRun.length - 1] = END;

      for (let ngramStart = 0; ngramStart < run.length + 1; ngramStart++) {
        const ngramEnd = ngramStart + options.stateSize || DEFAULT_STATE_SIZE;
        const stateKey = createStateKey(paddedRun.slice(ngramStart, ngramEnd));
        const follow = paddedRun[ngramEnd];

        if (!model[stateKey]) {
          model[stateKey] = {};
        }

        const followKey = JSON.stringify(follow);
        if (!model[stateKey][followKey]) {
          model[stateKey][followKey] = { value: follow, count: 0 };
        }

        model[stateKey][followKey].count += 1;
      }
    }

    return model;
  }

  /**
   * Creates a Chain instance by hydrating the model from a JSON string
   *
   * @param {string} jsonData A serialized chain to hydrate
   * @return {Chain} A hydrated Chain instance
   */
  static fromJSON(jsonData: string): Chain {
    const parsedData = JSON.parse(jsonData);
    const states: any[] = [];

    // Extract stateSize from parsed data
    const stateSize = parsedData.stateSize;

    for (let i = 0; i < parsedData.model.length; i++) {
      const [stateKey, follow] = parsedData.model[i];
      const followMap: any = {};
      for (let j = 0; j < follow.length; j++) {
        const [followKey, followData] = follow[j];
        followMap[followKey] = Object.assign({}, followData);
      }
      states.push([stateKey, followMap]);
    }

    // Pass stateSize when creating a new Chain instance
    return new Chain(
      states.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
      { stateSize } // Include stateSize here
    );
  }

  /**
   * Serialize the Chain.
   *
   * @return {any[]} A multidimensional array that can be consumed and stringified by JSON.stringify.
   */
  toJSON(): any {
    const serialized: any[] = [];
    for (const state in this.model) {
      const followEntries: any[] = [];
      for (const follow in this.model[state]) {
        followEntries.push([follow, this.model[state][follow]]);
      }
      serialized.push([state, followEntries]);
    }
    return {
      stateSize: this.stateSize, // Include stateSize in serialized output
      model: serialized, // Include model as well
    };
  }

  /**
   * Given a state, chooses the next item at random, with a bias towards next states with higher weights.
   *
   * @param {any} [fromState] The state to move from
   * @return {any} A next item from the chain
   */
  move(fromState: any): any {
    const stateKey = createStateKey(fromState);
    const state = this.model[stateKey];

    if (!state) {
      return undefined;
    }

    const choices: any[] = [];
    const weights: number[] = [];

    for (const key in state) {
      choices.push(state[key].value);
      weights.push(state[key].count);
    }

    const cumulativeDistribution: number[] = [];
    let cumSum = 0;

    for (let i = 0; i < weights.length; i++) {
      cumSum += weights[i];
      cumulativeDistribution.push(cumSum);
    }

    const r = Math.random() * cumSum;

    let randomIndex;
    for (
      randomIndex = 0;
      randomIndex < cumulativeDistribution.length &&
      r >= cumulativeDistribution[randomIndex];
      randomIndex++
    );

    return choices[randomIndex];
  }

  /**
   * Performs a single run of the Markov model, optionally starting from the provided `fromState`
   *
   * @param fromState {any} [fromState] The state to begin generating from
   */
  walk(fromState?: any): any[] {
    const steps: any[] = [];

    let state = fromState || createBeginState(this.stateSize);

    while (true) {
      const step = this.move(state);
      if (step === undefined || step === END) break;

      steps.push(step);
      state.shift();
      state.push(step);
    }

    return steps;
  }
}

/**
 * Creates a state that can be used to look up transitions in the model.
 *
 * @private
 * @param {any|any[]} originalState The original state object
 * @return {string} The stringified state object, suitable for use as a Map key
 */
export function createStateKey(originalState: any): string {
  const stateArray: any[] = Array.isArray(originalState)
    ? originalState
    : [originalState];
  return JSON.stringify(stateArray);
}

/**
 * Creates initial `BEGIN` states to use for padding at the beginning of runs.
 *
 * @private
 * @param {number} stateSize How many states to create
 */
export function createBeginState(stateSize: number): string[] {
  var beginStates: string[] = [];
  for (var i = 0; i < stateSize; i++) {
    beginStates.push(BEGIN);
  }
  return beginStates;
}

/**
 * Returns the last item in an array
 * @private
 * @param {any[]} arr The array to get the last item from
 * @return {any} The last item in the array
 */
export function last(arr: any[]): any {
  return arr[arr.length - 1];
}

/**
 * A port of Python's `bisect.bisect_right`, similar to lodash's `sortedIndex`
 */
export function bisect(list: any[], num: number, high: number = list.length) {
  let currLow = 0;
  let currHigh = high;

  while (currLow < currHigh) {
    const mid = Math.floor((currLow + currHigh) / 2);
    if (num < list[mid]) {
      currHigh = mid;
    } else {
      currLow = mid + 1;
    }
  }

  return currLow;
}
