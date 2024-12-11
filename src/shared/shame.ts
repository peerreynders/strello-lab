// file: src/shared/shame.ts
//
// `shame` as in ashamed for not thinking
// of a better name (or place) than "utils" or "helpers".
// credit: https://csswizardry.com/2013/04/shame-css/

import { nanoid } from 'nanoid';

import type { LexRank } from './lex-rank';

export type FocusRef<T extends HTMLElement> = {
	ref: T | undefined;
	focus(timestamp?: number): void;
	initialize(el: T): void;
	dispose(): void;
	enable(setting: boolean): void;
};

const msSinceStart = () => performance.now();

const msSinceEpoch = () => Date.now();

const makeId = nanoid;

const byRankAsc = <T extends Record<'rank', LexRank>>(a: T, b: T) =>
	a.rank < b.rank ? -1 : b.rank < a.rank ? 1 : 0;

function makeFocusRef<T extends HTMLElement>(enabled = true) {
	const element: FocusRef<T> = {
		ref: undefined,
		focus(timestamp) {
			if (!element.ref) return;

			if (timestamp === undefined)
				return void (
					element.ref.isConnected ? requestAnimationFrame : setTimeout
				)(element.focus);

			element.ref.focus();
		},
		initialize(el) {
			element.ref = el;
			if (enabled) element.focus();
		},
		dispose() {
			element.ref = undefined;
		},
		enable(setting) {
			enabled = setting;
		},
	};

	return element;
}

function fromMoveInfo(info: string): [refId: string, updatedAt: number] {
	if (info.charAt(21) !== ':')
		throw new Error('Non-standard ID length in moveInfo string');
	const refId = info.slice(0, 21);
	const updatedAt = Number(info.slice(22));

	// https://tc39.es/ecma262/#sec-time-values-and-time-range
	if (Number.isNaN(updatedAt) || updatedAt > 8.64e15 || updatedAt < -8.64e15)
		throw new Error('moveInfo does not supply an epoch timestamp');

	return [refId, updatedAt];
}

export {
	byRankAsc,
	fromMoveInfo,
	makeId,
	msSinceEpoch,
	msSinceStart,
	makeFocusRef,
};
