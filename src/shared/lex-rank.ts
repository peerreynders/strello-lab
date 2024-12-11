// file: src/lex-rank
declare const validLexRank: unique symbol;

export type LexRank = string & {
	[validLexRank]: true;
};

const BASE = 36;
const BASE_N = BigInt(BASE);

const LEX_RANK_MIN_CORE = '0000000000' as LexRank;
const LEX_RANK_MAX_CORE = 'zzzzzzzzzz' as LexRank;
const CORE_LENGTH = LEX_RANK_MAX_CORE.length;

const CORE_MIN = parseInt(LEX_RANK_MIN_CORE, BASE);
const CORE_INITIAL_MIN = parseInt('1' + LEX_RANK_MIN_CORE.slice(1), BASE);
const CORE_MAX = parseInt(LEX_RANK_MAX_CORE, BASE);
const CORE_INITIAL_MAX = CORE_MAX - CORE_INITIAL_MIN - CORE_INITIAL_MIN + 1;
const DEFAULT_STEP = 8;

const fromNumber = (value: number) =>
	value.toString(BASE).padStart(CORE_LENGTH, '0') as LexRank;

const LEXRANK = (() => {
	const lr = {
		initialMin: fromNumber(CORE_INITIAL_MIN),
		mid: fromNumber(Math.trunc(CORE_MIN + (CORE_MAX - CORE_MIN) / 2)),
		initialMax: fromNumber(CORE_INITIAL_MAX),
	};
	return Object.freeze(lr);
})();

// A required CORE value consisting of exactly 10 base 36 digits
// An optional SUFFIX of a variable number of base 36 digits WITHOUT trailing zeros
const lexRankPattern = /^[0-9a-z]{10}([0-9a-z]*[1-9a-z])?$/;

const isLexRank = (maybeLexRank: string): maybeLexRank is LexRank =>
	lexRankPattern.test(maybeLexRank);

function assertIsLexRank(
	maybeLexRank: string
): asserts maybeLexRank is LexRank {
	if (!isLexRank(maybeLexRank)) {
		throw new Error(`The string: ${maybeLexRank} is not a valid LexRank value`);
	}
}

const TRAILING_ZEROS = /0+$/;

function fromRank(rank: bigint, scale: number) {
	const text = rank.toString(BASE).padStart(CORE_LENGTH + scale, '0');
	const core = text.slice(0, CORE_LENGTH);
	// eliminate trailing zeros from a potential suffix
	return (
		scale < 1 ? core : core + text.slice(-scale).replace(TRAILING_ZEROS, '')
	) as LexRank;
}

const BASE_FACTOR = (() => {
	let factor = 1n;
	const factors: Array<bigint> = [];
	for (let i = 0; i <= 10; i += 1, factor *= BASE_N) factors[i] = factor;

	return Object.freeze(factors);
})();

function fromString(base36: string) {
	const maxIndex = BASE_FACTOR.length - 1;
	let value = 0n;
	for (
		let start = 0, end = maxIndex;
		start < base36.length;
		start = end, end += maxIndex
	) {
		const part = base36.slice(start, end);
		value = value * BASE_FACTOR[part.length] + BigInt(parseInt(part, BASE));
	}
	return value;
}

const toScaled = (coreAndSuffix: string, scale: number) =>
	coreAndSuffix.padEnd(CORE_LENGTH + scale, '0');

function _between(beforeRank: LexRank, afterRank: LexRank) {
	let scale =
		(beforeRank.length < afterRank.length
			? afterRank.length
			: beforeRank.length) - CORE_LENGTH;
	let before = fromString(toScaled(beforeRank, scale));
	let after = fromString(toScaled(afterRank, scale));
	if (after - before <= 1) {
		scale += 1;
		before *= BASE_N;
		after *= BASE_N;
	}
	return fromRank(before + (after - before) / 2n, scale);
}

function _decrement(lexRank: LexRank, step: number, rank?: number) {
	if (rank !== undefined) {
		// attempt to just decrement
		rank -= step;
		if (rank > CORE_MIN) return rank;
	}

	return _between(LEX_RANK_MIN_CORE, lexRank);
}

function _increment(lexRank: LexRank, step: number, rank?: number) {
	if (rank !== undefined) {
		// attempt to just increment
		rank += step;
		if (rank < CORE_MAX) return rank;
	}

	return _between(lexRank, LEX_RANK_MAX_CORE);
}

function makeForward(
	initial: number = CORE_INITIAL_MIN,
	step: number = DEFAULT_STEP
) {
	let prepared = fromNumber(initial);
	const result: IteratorResult<LexRank, undefined> = {
		value: prepared,
		done: false,
	};
	let rank: number | undefined = initial;

	const iterator: IterableIterator<LexRank> = {
		next() {
			result.value = prepared;
			const next = _increment(prepared, step, rank);
			if (typeof next === 'number') {
				rank = next;
				prepared = fromNumber(rank);
				return result;
			}

			rank = undefined;
			prepared = next;
			return result;
		},
		[Symbol.iterator](): IterableIterator<LexRank> {
			return iterator;
		},
	};

	return iterator;
}

function makeReverse(
	initial: number = CORE_INITIAL_MAX,
	step: number = DEFAULT_STEP
) {
	let prepared = fromNumber(initial);
	const result: IteratorResult<LexRank, undefined> = {
		value: prepared,
		done: false,
	};
	let rank: number | undefined = initial;
	const iterator: IterableIterator<LexRank> = {
		next() {
			result.value = prepared;
			const next = _decrement(prepared, step, rank);
			if (typeof next === 'number') {
				rank = next;
				prepared = fromNumber(rank);
				return result;
			}

			rank = undefined;
			prepared = next;
			return result;
		},
		[Symbol.iterator](): IterableIterator<LexRank> {
			return iterator;
		},
	};

	return iterator;
}

function decrement(lexRank: LexRank, step: number = DEFAULT_STEP) {
	const next = _decrement(
		lexRank,
		step,
		Number.parseInt(lexRank.slice(0, CORE_LENGTH), BASE)
	);
	return typeof next === 'number' ? fromNumber(next) : next;
}

function increment(lexRank: LexRank, step: number = DEFAULT_STEP) {
	const next = _increment(
		lexRank,
		step,
		Number.parseInt(lexRank.slice(0, CORE_LENGTH), BASE)
	);
	return typeof next === 'number' ? fromNumber(next) : next;
}

function between(
	before: LexRank | undefined,
	after?: LexRank,
	step: number = DEFAULT_STEP
) {
	if (before === undefined)
		return after !== undefined ? decrement(after, step) : LEXRANK.mid;

	if (after === undefined) return increment(before, step);

	return _between(before, after);
}

export {
	LEXRANK,
	assertIsLexRank,
	between,
	decrement,
	increment,
	isLexRank,
	makeForward,
	makeReverse,
};
