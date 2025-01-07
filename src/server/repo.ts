// file: src/server/repo.ts

import { createStorage } from 'unstorage';
import fsLiteDriver from 'unstorage/drivers/fs-lite';

import { byRankAsc, makeId, msSinceEpoch } from '../shared/shame.js';
import { LEXRANK, between, makeForward } from '../shared/lex-rank.js';

import type { BoardInfo, ColumnInfo, NoteInfo } from '../client-types';
import type { LexRank } from '../shared/lex-rank';

// Assume when account is offline:
// `interimIds` will be deleted
// `rank` may be updated to rebalance notes, columns and/or boards.

type BoardRecord = Pick<BoardInfo, 'updatedAt' | 'title' | 'color'> & {
	id: string;
	interimId?: string;
};

type ColumnRecord = Pick<ColumnInfo, 'updatedAt' | 'title' | 'rank'> & {
	id: string;
	boardId: string;
	interimId?: string;
};

type NoteRecord = Pick<NoteInfo, 'updatedAt' | 'body' | 'rank'> & {
	id: string;
	columnId: string;
	interimId?: string;
};

export type BoardResult = {
	board: BoardRecord;
	columns: Array<ColumnRecord>;
	notes: Array<NoteRecord>;
};

const storage = createStorage({
	driver: fsLiteDriver({
		base: '.data',
	}),
});

const boardsKey = (accountId: string) => `${accountId}:boards`;
const columnsKey = (accountId: string) => `${accountId}:columns`;
const notesKey = (accountId: string) => `${accountId}:notes`;

const noneToEmpty = <T>(result: Array<T> | null | undefined): Array<T> =>
	result || [];
const readBoards = (accountId: string) =>
	storage.getItem<Array<BoardRecord>>(boardsKey(accountId)).then(noneToEmpty);
const readColumns = (accountId: string) =>
	storage.getItem<Array<ColumnRecord>>(columnsKey(accountId)).then(noneToEmpty);
const readNotes = (accountId: string) =>
	storage.getItem<Array<NoteRecord>>(notesKey(accountId)).then(noneToEmpty);

const writeBoards = (accountId: string, boards: Array<BoardRecord>) =>
	storage.setItem(boardsKey(accountId), boards);
const writeColumns = (accountId: string, columns: Array<ColumnRecord>) =>
	storage.setItem(columnsKey(accountId), columns);
const writeNotes = (accountId: string, notes: Array<NoteRecord>) =>
	storage.setItem(notesKey(accountId), notes);

const boardsByAccount = (accountId: string): Promise<Array<BoardRecord>> =>
	readBoards(accountId);

async function boardById(
	accountId: string,
	id: string
): Promise<BoardResult | undefined> {
	const boardsRead = readBoards(accountId);
	const columnsRead = readColumns(accountId);
	const notesRead = readNotes(accountId);

	const allBoards = await boardsRead;
	const board = allBoards.find((b) => b.id === id);
	if (!board) return undefined;

	const columns: Array<ColumnRecord> = [];
	const columnIds: Array<string> = [];
	const allColumns = await columnsRead;
	for (const c of allColumns) {
		if (c.boardId !== id) continue;

		columns.push(c);
		columnIds.push(c.id);
	}

	const notes: Array<NoteRecord> = [];
	const allNotes = await notesRead;
	for (const n of allNotes) {
		if (!columnIds.includes(n.columnId)) continue;

		notes.push(n);
	}

	return {
		board,
		columns,
		notes,
	};
}

async function appendBoard(
	accountId: string,
	interimId: string | undefined,
	title: string,
	color: string
) {
	const boards = await readBoards(accountId);
	const id = makeId();
	const updatedAt = msSinceEpoch();

	const board = interimId
		? {
				id,
				updatedAt,
				title,
				color,
				interimId,
			}
		: {
				id,
				updatedAt,
				title,
				color,
			};
	boards.push(board);

	await writeBoards(accountId, boards);
	return board;
}

async function deleteBoard(accountId: string, id: string, updatedAt: number) {
	const notesRead = readNotes(accountId);
	const columnsRead = readColumns(accountId);
	const boards = await readBoards(accountId);
	const index = boards.findIndex((b) => b.id === id);
	if (index < 0) return 0;

	if (boards[index].updatedAt !== updatedAt)
		throw new Error('Stale board delete');

	// Remove associated columns and track removed columns
	const [columns, cascadeIds] = (await columnsRead).reduce<
		[Array<ColumnRecord>, Array<string>]
	>(
		(collect, column) => {
			if (column.boardId !== id) collect[0].push(column);
			else collect[1].push(column.id);
			return collect;
		},
		[[], []]
	);

	// Remove notes associated with removed columns
	const notes = (await notesRead).filter(
		(n) => !cascadeIds.includes(n.columnId)
	);

	boards.splice(index, 1);

	await Promise.all([
		writeBoards(accountId, boards),
		writeColumns(accountId, columns),
		writeNotes(accountId, notes),
	]);
	return 1;
}

function selectBracketRank<T extends { rank: LexRank }>(
	ranked: Array<T>,
	fromIndex: number,
	before: boolean
) {
	if (before) {
		const index = fromIndex - 1;
		return index > 0 ? ranked[index].rank : undefined;
	}
	const index = fromIndex + 1;
	return index < ranked.length ? ranked[index].rank : undefined;
}

async function appendColumn(
	accountId: string,
	interimId: string,
	boardId: string,
	title: string
) {
	const columns = await readColumns(accountId);

	// last note in the column for rank
	let lastBoardColumn: ColumnRecord | undefined;
	for (let i = 0; i < columns.length; i += 1) {
		const c = columns[i];
		if (
			c.boardId === boardId &&
			(!lastBoardColumn || lastBoardColumn.rank < c.rank)
		) {
			lastBoardColumn = c;
		}
	}

	const rank = lastBoardColumn
		? between(lastBoardColumn.rank)
		: LEXRANK.initialMin;
	const column = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		rank,
		title,
		boardId,
		interimId,
	};
	columns.push(column);

	await writeColumns(accountId, columns);
	return column;
}

async function deleteColumn(accountId: string, id: string, updatedAt: number) {
	const notesRead = readNotes(accountId);
	const columns = await readColumns(accountId);
	const index = columns.findIndex((c) => c.id === id);
	if (index < 0) return 0;

	if (columns[index].updatedAt !== updatedAt)
		throw new Error('Stale column delete');

	const notes = (await notesRead).filter((n) => n.columnId !== id);
	columns.splice(index, 1);

	await Promise.all([
		writeColumns(accountId, columns),
		writeNotes(accountId, notes),
	]);
	return 1;
}

async function editColumn(
	accountId: string,
	id: string,
	updatedAt: number,
	title: string
) {
	const columns = await readColumns(accountId);
	const column = columns.find((c) => c.id === id);
	if (!column) throw new Error('Column does not exist');
	if (column.updatedAt !== updatedAt) throw new Error('Stale column edit');
	column.title = title;
	column.updatedAt = msSinceEpoch();
	await writeColumns(accountId, columns);
	return column;
}

async function moveColumn(
	accountId: string,
	id: string,
	updatedAt: number,
	boardId: string,
	before: boolean,
	otherId: string
) {
	const columns = await readColumns(accountId);
	const boardColumns: Array<ColumnRecord> = [];
	let column: ColumnRecord | undefined;

	for (let i = 0; i < columns.length; i += 1) {
		const c = columns[i];
		if (!column && c.id === id) column = c;

		if (c.boardId === boardId) boardColumns.push(c);
	}

	if (!column) throw new Error('Column does not exist');
	if (column.updatedAt !== updatedAt) throw new Error('Stale column move');

	boardColumns.sort(byRankAsc);

	const otherIndex = boardColumns.findIndex((c) => c.id === otherId);
	if (otherIndex < 0) throw new Error('Other note not associated with column');

	// update moved column
	const bracketRank = selectBracketRank(boardColumns, otherIndex, before);
	const [beforeRank, afterRank] = before
		? [bracketRank, boardColumns[otherIndex].rank]
		: [boardColumns[otherIndex].rank, bracketRank];
	column.rank = between(beforeRank, afterRank);
	column.boardId = boardId;
	column.updatedAt = msSinceEpoch();

	await writeColumns(accountId, columns);
	return column;
}

async function appendNote(
	accountId: string,
	interimId: string,
	columnId: string,
	body: string
) {
	const notes = await readNotes(accountId);

	// last note in the column for rank
	let lastColumnNote: NoteRecord | undefined;
	for (let i = 0; i < notes.length; i += 1) {
		const n = notes[i];
		if (
			n.columnId === columnId &&
			(!lastColumnNote || lastColumnNote.rank < n.rank)
		) {
			lastColumnNote = n;
		}
	}

	const rank = lastColumnNote
		? between(lastColumnNote.rank)
		: LEXRANK.initialMin;
	const note = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		rank,
		body,
		columnId,
		interimId,
	};
	notes.push(note);

	await writeNotes(accountId, notes);
	return note;
}

async function deleteNote(accountId: string, id: string, updatedAt: number) {
	const notes = await readNotes(accountId);
	const index = notes.findIndex((n) => n.id === id);
	if (index < 0) return 0;
	if (notes[index].updatedAt !== updatedAt)
		throw new Error('Stale note delete');
	notes.splice(index, 1);
	await writeNotes(accountId, notes);
	return 1;
}

async function editNote(
	accountId: string,
	id: string,
	updatedAt: number,
	body: string
) {
	const notes = await readNotes(accountId);
	const note = notes.find((n) => n.id === id);
	if (!note) throw new Error('Note does not exist');
	if (note.updatedAt !== updatedAt) throw new Error('Stale note edit');
	note.body = body;
	note.updatedAt = msSinceEpoch();
	await writeNotes(accountId, notes);
	return note;
}

async function _moveNote(
	accountId: string,
	id: string,
	updatedAt: number,
	columnId: string,
	before?: boolean,
	otherId?: string
) {
	const notes = await readNotes(accountId);
	const columnNotes: Array<NoteRecord> = [];
	let note: NoteRecord | undefined;

	for (let i = 0; i < notes.length; i += 1) {
		const n = notes[i];
		if (!note && n.id === id) note = n;

		if (n.columnId === columnId) columnNotes.push(n);
	}

	if (!note) throw new Error('Note does not exist');
	if (note.updatedAt !== updatedAt) throw new Error('Stale note move');

	columnNotes.sort(byRankAsc);

	if (otherId !== undefined && before !== undefined) {
		// `note` is moved before/after `otherId`
		const otherIndex = columnNotes.findIndex((n) => n.id === otherId);
		if (otherIndex < 0)
			throw new Error('Other note not associated with column');

		// update moved note
		const bracketRank = selectBracketRank(columnNotes, otherIndex, before);
		const [beforeRank, afterRank] = before
			? [bracketRank, columnNotes[otherIndex].rank]
			: [columnNotes[otherIndex].rank, bracketRank];
		note.rank = between(beforeRank, afterRank);
		note.columnId = columnId;
		note.updatedAt = msSinceEpoch();
	} else {
		// `note` is moved into `column`
		const lastNote = columnNotes.at(-1);
		// update moved note
		note.rank = lastNote ? between(lastNote.rank) : LEXRANK.initialMin;
		note.columnId = columnId;
		note.updatedAt = msSinceEpoch();
	}

	await writeNotes(accountId, notes);
	return note;
}

function moveNoteToColumn(
	accountId: string,
	id: string,
	updatedAt: number,
	columnId: string
) {
	return _moveNote(accountId, id, updatedAt, columnId);
}

function moveNote(
	accountId: string,
	id: string,
	updatedAt: number,
	columnId: string,
	before: boolean,
	otherNoteId: string
) {
	return _moveNote(accountId, id, updatedAt, columnId, before, otherNoteId);
}

const ACCOUNT_ID = 'TQo9FY5r5Xqiaozly8odF';

// TS treats IterableResult as a discriminated union
function nextFrom(i: IterableIterator<LexRank>) {
	const next = i.next();
	return !next.done ? next.value : LEXRANK.initialMax;
}

function initialize() {
	const boards: Array<BoardRecord> = [];
	const columns: Array<ColumnRecord> = [];
	const notes: Array<NoteRecord> = [];

	let board = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'backlog',
		color: '#a2deff',
	};
	boards.push(board);

	let crIter = makeForward();
	let column = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'test',
		rank: nextFrom(crIter),
		boardId: board.id,
	};
	columns.push(column);

	let nrIter = makeForward();
	let note = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		rank: nextFrom(nrIter),
		body: 'abc',
		columnId: column.id,
	};
	notes.push(note);

	note = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		rank: nextFrom(nrIter),
		body: 'def',
		columnId: column.id,
	};
	notes.push(note);

	board = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'In progress',
		color: '#a2deff',
	};
	boards.push(board);

	board = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'qwe',
		color: '#702a56',
	};
	boards.push(board);

	crIter = makeForward();
	column = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'test 123',
		rank: nextFrom(crIter),
		boardId: board.id,
	};
	columns.push(column);

	column = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'test 456',
		rank: nextFrom(crIter),
		boardId: board.id,
	};
	columns.push(column);

	column = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		title: 'test 789',
		rank: nextFrom(crIter),
		boardId: board.id,
	};
	columns.push(column);

	nrIter = makeForward();
	note = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		rank: nextFrom(nrIter),
		body: 'abc',
		columnId: column.id,
	};
	notes.push(note);

	note = {
		id: makeId(),
		updatedAt: msSinceEpoch(),
		rank: nextFrom(nrIter),
		body: 'def',
		columnId: column.id,
	};
	notes.push(note);

	return Promise.all([
		writeBoards(ACCOUNT_ID, boards),
		writeColumns(ACCOUNT_ID, columns),
		writeNotes(ACCOUNT_ID, notes),
	]);
}

export {
	initialize,
	appendBoard,
	appendColumn,
	appendNote,
	boardById,
	boardsByAccount,
	deleteBoard,
	deleteColumn,
	deleteNote,
	editColumn,
	moveColumn,
	editNote,
	moveNote,
	moveNoteToColumn,
};
