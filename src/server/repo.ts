// file: src/server/repo.ts

import { createStorage } from 'unstorage';
import fsLiteDriver from 'unstorage/drivers/fs-lite';

import { byRankAsc, makeId, msSinceEpoch } from '../shared/shame.js';
import { LEXRANK, between } from '../shared/lex-rank.js';

import type {
	AccountInfo,
	BoardInfo,
	ColumnInfo,
	NoteInfo,
} from '../client-types';
import type { LexRank } from '../shared/lex-rank';

type AccountRecord = AccountInfo & {
	updatedAt: number;
};

type PasswordRecord = {
	accountId: string;
	salt: string;
	hash: string;
	updatedAt: number;
};

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

const ACCOUNTS_KEY = 'accounts';
const PASSWORDS_KEY = 'passwords';
const boardsKey = (accountId: string) => `${accountId}:boards`;
const columnsKey = (accountId: string) => `${accountId}:columns`;
const notesKey = (accountId: string) => `${accountId}:notes`;

const noneToEmpty = <T>(result: Array<T> | null | undefined): Array<T> =>
	result || [];
const readAccounts = () =>
	storage.getItem<Array<AccountRecord>>(ACCOUNTS_KEY).then(noneToEmpty);
const readPasswords = () =>
	storage.getItem<Array<PasswordRecord>>(PASSWORDS_KEY).then(noneToEmpty);
const readBoards = (accountId: string) =>
	storage.getItem<Array<BoardRecord>>(boardsKey(accountId)).then(noneToEmpty);
const readColumns = (accountId: string) =>
	storage.getItem<Array<ColumnRecord>>(columnsKey(accountId)).then(noneToEmpty);
const readNotes = (accountId: string) =>
	storage.getItem<Array<NoteRecord>>(notesKey(accountId)).then(noneToEmpty);

const writeAccounts = (accounts: Array<AccountRecord>) =>
	storage.setItem(ACCOUNTS_KEY, accounts);
const writePasswords = (accounts: Array<PasswordRecord>) =>
	storage.setItem(PASSWORDS_KEY, accounts);
const writeBoards = (accountId: string, boards: Array<BoardRecord>) =>
	storage.setItem(boardsKey(accountId), boards);
const writeColumns = (accountId: string, columns: Array<ColumnRecord>) =>
	storage.setItem(columnsKey(accountId), columns);
const writeNotes = (accountId: string, notes: Array<NoteRecord>) =>
	storage.setItem(notesKey(accountId), notes);

async function accountByEmail(
	email: string,
	password: string,
	hashPassword: (salt: string, password: string) => string
) {
	const passwordsRead = readPasswords();
	const accounts = await readAccounts();
	const accountIndex = accounts.findIndex((record) => record.email === email);
	if (accountIndex < 0) return undefined;

	const account = accounts[accountIndex];
	const passwords = await passwordsRead;
	const passwordIndex = passwords.findIndex(
		(record) => record.accountId === account.id
	);
	if (passwordIndex < 0) return undefined;

	const record = passwords[passwordIndex];
	const hash = hashPassword(record.salt, password);
	return hash === record.hash ? account : false;
}

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

async function createAccount(
	email: string,
	password: string,
	fromPassword: (password: string) => [salt: string, hash: string]
) {
	const accounts = await readAccounts();
	const existingIndex = accounts.findIndex((record) => record.email === email);
	if (existingIndex > -1) return undefined;

	const passwordsRead = readPasswords();

	const account = { id: makeId(), email, updatedAt: msSinceEpoch() };
	accounts.push(account);

	const [salt, hash] = fromPassword(password);
	const passwords = await passwordsRead;
	passwords.push({
		accountId: account.id,
		salt,
		hash,
		updatedAt: account.updatedAt,
	});

	await Promise.all([
		writeAccounts(accounts),
		writePasswords(passwords),
		writeBoards(account.id, []),
		writeColumns(account.id, []),
		writeNotes(account.id, []),
	]);

	return account;
}

async function removeAccount(accountId: string) {
	const accounts = await readAccounts();
	const accountIndex = accounts.findIndex((record) => record.id === accountId);
	if (accountIndex < 0) return 0;

	const passwords = await readPasswords();
	const passwordIndex = passwords.findIndex(
		(record) => record.accountId === accountId
	);
	if (passwordIndex > -1) {
		passwords.splice(passwordIndex, 1);
	}
	accounts.splice(accountIndex, 1);

	await Promise.all([
		writeAccounts(accounts),
		writePasswords(passwords),
		writeBoards(accountId, []),
		writeColumns(accountId, []),
		writeNotes(accountId, []),
	]);

	return 1;
}

async function appendBoard(
	accountId: string,
	title: string,
	color: string,
	interimId?: string
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
	boardId: string,
	title: string,
	interimId?: string
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
	const id = makeId();
	const updatedAt = msSinceEpoch();
	const column = interimId
		? {
				id,
				updatedAt,
				rank,
				title,
				boardId,
				interimId,
			}
		: {
				id,
				updatedAt,
				rank,
				title,
				boardId,
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
	columnId: string,
	body: string,
	interimId?: string
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
	const id = makeId();
	const updatedAt = msSinceEpoch();
	const note = interimId
		? {
				id,
				updatedAt,
				rank,
				body,
				columnId,
				interimId,
			}
		: {
				id,
				updatedAt,
				rank,
				body,
				columnId,
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

export {
	accountByEmail,
	appendBoard,
	appendColumn,
	appendNote,
	boardById,
	boardsByAccount,
	createAccount,
	deleteBoard,
	deleteColumn,
	deleteNote,
	editColumn,
	editNote,
	moveColumn,
	moveNote,
	moveNoteToColumn,
	removeAccount,
};
