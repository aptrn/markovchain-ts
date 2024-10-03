import * as Markov from "../src/markov";

// private constants & helper functions (imported via babel-plugin-rewire)
const BEGIN = Markov.BEGIN;
const END = Markov.END;

const last = Markov.last;
const createStateKey = Markov.createStateKey;

// ============================================================================

const corpus = ["foo bar baz qux.", "foo baz qux bar."].map(function (str) {
  return str.split(" ");
});
const mixedCorpus = [
  [[1, 2, 3], { foo: "bar" }, "qux", 0, { end: true }],
  [[1, 2, 3], { foo: "baz" }, "qux", 1, { end: true }],
  [[1, 2, 3], { foo: "bar" }, "bar", 0, { end: true }],
  [[4, 5, 6], { foo: "baz" }, "bar", 1, { end: true }],
];

// ============================================================================
describe("markov", () => {
  it("building models from text corpora", () => {
    const testModel = Markov.Chain.build(corpus, { stateSize: 2 });

    const expectedModel: any = {};

    expectedModel[createStateKey([BEGIN, BEGIN])] = {};
    expectedModel[createStateKey([BEGIN, "foo"])] = {};
    expectedModel[createStateKey(["foo", "bar"])] = {};
    expectedModel[createStateKey(["bar", "baz"])] = {};
    expectedModel[createStateKey(["baz", "qux."])] = {};
    expectedModel[createStateKey(["foo", "baz"])] = {};
    expectedModel[createStateKey(["baz", "qux"])] = {};
    expectedModel[createStateKey(["qux", "bar."])] = {};

    expectedModel[createStateKey([BEGIN, BEGIN])][JSON.stringify("foo")] = {
      value: "foo",
      count: 2,
    };

    expectedModel[createStateKey([BEGIN, "foo"])][JSON.stringify("bar")] = {
      value: "bar",
      count: 1,
    };
    expectedModel[createStateKey([BEGIN, "foo"])][JSON.stringify("baz")] = {
      value: "baz",
      count: 1,
    };

    expectedModel[createStateKey(["foo", "bar"])][JSON.stringify("baz")] = {
      value: "baz",
      count: 1,
    };

    expectedModel[createStateKey(["bar", "baz"])][JSON.stringify("qux.")] = {
      value: "qux.",
      count: 1,
    };

    expectedModel[createStateKey(["baz", "qux."])][JSON.stringify(END)] = {
      value: END,
      count: 1,
    };

    expectedModel[createStateKey(["foo", "baz"])][JSON.stringify("qux")] = {
      value: "qux",
      count: 1,
    };

    expectedModel[createStateKey(["baz", "qux"])][JSON.stringify("bar.")] = {
      value: "bar.",
      count: 1,
    };

    expectedModel[createStateKey(["qux", "bar."])][JSON.stringify(END)] = {
      value: END,
      count: 1,
    };

    expect(testModel).toBeInstanceOf(Object);

    expect(testModel).toEqual(expectedModel);
  });
  // ============================================================================

  it("serializing chains", function () {
    const original = new Markov.Chain(corpus, { stateSize: 2 });
    const serialized = JSON.stringify(original);
    const hydrated = Markov.Chain.fromJSON(serialized);

    expect(typeof serialized).toBe("string");
    expect(hydrated.stateSize).toEqual(original.stateSize);
    expect(hydrated.model).toEqual(original.model);
  });

  // ============================================================================

  it("moving on chains (stateSize = 1)", function () {
    const testChain = new Markov.Chain(corpus);
    const expectedWords = ["bar", "baz"];

    const steps: any = [];
    for (var i = 0; i < 255; i++) {
      steps.push(testChain.move("foo"));
    }

    expect(
      steps.every(function (step: any) {
        return expectedWords.indexOf(step) !== -1;
      })
    ).toBe(true);

    var wordCounts = steps.reduce(function (counts: any, word: any) {
      counts[word] = (counts[word] || 0) + 1;
      return counts;
    }, {});

    expect(
      expectedWords.every(function (word) {
        return wordCounts[word];
      })
    ).toBe(true);
  });

  // ============================================================================

  it("moving on chains (stateSize = 2)", function () {
    const testChain = new Markov.Chain(corpus, { stateSize: 2 });
    const expectedWords = ["bar", "baz"];

    const steps: any = [];
    for (var i = 0; i < 255; i++) {
      steps.push(testChain.move([BEGIN, "foo"]));
    }

    expect(
      steps.every(function (step: any) {
        return expectedWords.indexOf(step) !== -1;
      })
    ).toBe(true);

    var wordCounts = steps.reduce(function (counts: any, word: any) {
      counts[word] = (counts[word] || 0) + 1;
      return counts;
    }, {});

    expect(
      expectedWords.every(function (word) {
        return wordCounts[word];
      })
    ).toBe(true);
  });

  // ============================================================================

  it("walking chains (string corpus)", function () {
    const testChain = new Markov.Chain(corpus);

    const walkResult = testChain.walk();
    const firstItems = corpus.map(function (row) {
      return row[0];
    });

    const lastItems = corpus.map(last);

    expect(Array.isArray(walkResult)).toBe(true);

    expect(firstItems.indexOf(walkResult[0]) !== -1).toBe(true);

    expect(lastItems.indexOf(last(walkResult)) !== -1).toBe(true);
  });

  // ============================================================================

  it("walking chains (mixed corpus)", function () {
    const testChain = new Markov.Chain(mixedCorpus);

    const walkResult = testChain.walk();

    const firstItems = mixedCorpus.map(function (row) {
      return row[0];
    });

    const lastItems = mixedCorpus.map(last);

    expect(Array.isArray(walkResult)).toBe(true);

    expect(firstItems.indexOf(walkResult[0]) !== -1).toBe(true);

    expect(lastItems.indexOf(last(walkResult)) !== -1).toBe(true);
  });
});
