// file: src/server/api.ts
import { action, json, query, redirect } from '@solidjs/router';
import { getAccount as getAccountId } from './session.js';
import {
	boardById as bById,
	boardsByAccount as bByAccount,
	appendBoard as appendBoardRepo,
	appendColumn,
	appendNote,
	deleteBoard as deleteBoardRepo,
	deleteColumn,
	deleteNote,
	editColumn,
	editNote,
	moveColumn,
	moveNote,
	moveNoteToColumn,
} from './repo.js';

import type {
	BoardCommand,
	BoardData,
	BoardDelete,
	BoardInfo,
	ColumnInfo,
	NoteInfo,
} from '~/client-types';
import type { BoardResult } from './repo';

type BoardRecord = BoardResult['board'];
type ColumnRecord = BoardResult['columns'][number];
type NoteRecord = BoardResult['notes'][number];

const getAccount = query(async () => {
	'use server';
	const accountId = await getAccountId();
	return { id: accountId, email: 'start@solidjs.com' };
}, 'account');

const fromBoardRecord = (r: BoardRecord): BoardInfo => ({
	id: r.interimId ? r.interimId : r.id,
	updatedAt: r.updatedAt,
	title: r.title,
	color: r.color,
	refId: r.id,
});

const fromColumnRecord = (r: ColumnRecord): ColumnInfo => ({
	id: r.interimId ? r.interimId : r.id,
	updatedAt: r.updatedAt,
	title: r.title,
	rank: r.rank,
	refId: r.id,
});

const fromNoteRecord = (r: NoteRecord): NoteInfo => ({
	id: r.interimId ? r.interimId : r.id,
	updatedAt: r.updatedAt,
	body: r.body,
	rank: r.rank,
	columnRefId: r.columnId,
	refId: r.id,
});

const boardsByAccount = query(async () => {
	'use server';
	const accountId = await getAccountId();
	const boards = await bByAccount(accountId);
	return boards.map(fromBoardRecord);
}, 'boards-by-account');

const appendBoard = action(async (data: FormData) => {
	'use server';
	const accountId = await getAccountId();
	const title = String(data.get('title'));
	const color = String(data.get('color'));

	const board = await appendBoardRepo(accountId, undefined, title, color);

	// Compel client to change to new board route
	throw redirect(`/board/${board.id}`);
}, 'append-board');

const deleteBoard = action(async (c: BoardDelete) => {
	'use server';
	const accountId = await getAccountId();

	// TODO this can throw for
	// non-existent board (stale post-delete)
	// delete based on stale data
	const result = await deleteBoardRepo(accountId, c.refId, c.updatedAt);

	return json(result, { revalidate: boardsByAccount.key });
}, 'delete-board');

const boardById = query(async (id: string) => {
	'use server';
	const accountId = await getAccountId();
	const result = await bById(accountId, id);

	if (!result) {
		// TODO: force logout first
		throw redirect('/login');
	}

	const boardData: BoardData = {
		board: fromBoardRecord(result.board),
		columns: result.columns.map(fromColumnRecord),
		notes: result.notes.map(fromNoteRecord),
	};

	return boardData;
}, 'board-by-id');

const transformBoard = action(async (c: BoardCommand) => {
	'use server';
	const accountId = await getAccountId();
	switch (c.kind) {
		case 'columnAppend': {
			await appendColumn(accountId, c.id, c.boardRefId, c.title);
			return json(true, { revalidate: boardById.key });
		}

		case 'columnDelete': {
			// TODO this can throw for (refId, updatedAt)
			await deleteColumn(accountId, c.refId, c.updatedAt);
			return json(true, { revalidate: boardById.key });
		}

		case 'columnEdit': {
			// TODO this can throw for
			// non-existent column (stale post-delete)
			// edit based on stale data
			await editColumn(accountId, c.refId, c.updatedAt, c.title);
			return json(true, { revalidate: boardById.key });
		}

		case 'columnMove': {
			// TODO this can throw for
			// non-existent column (stale post-delete)
			// edit based on stale data
			moveColumn(
				accountId,
				c.refId,
				c.updatedAt,
				c.boardRefId,
				c.relation.before,
				c.relation.refId
			);
			return json(true, { revalidate: boardById.key });
		}

		case 'noteAppend': {
			await appendNote(accountId, c.id, c.columnRefId, c.body);
			return json(true, { revalidate: boardById.key });
		}

		case 'noteDelete': {
			// TODO this can throw for (refId, updatedAt)
			await deleteNote(accountId, c.refId, c.updatedAt);
			return json(true, { revalidate: boardById.key });
		}

		case 'noteEdit': {
			// TODO this can throw for
			// non-existent note (stale post-delete)
			// edit based on stale data
			await editNote(accountId, c.refId, c.updatedAt, c.body);
			return json(true, { revalidate: boardById.key });
		}

		case 'noteMove': {
			// TODO this can throw for
			// non-existent note (stale post-delete)
			// move based on stale data
			// etc
			await (c.relation
				? moveNote(
						accountId,
						c.refId,
						c.updatedAt,
						c.columnRefId,
						c.relation.before,
						c.relation.refId
					)
				: moveNoteToColumn(accountId, c.refId, c.updatedAt, c.columnRefId));
			return json(true, { revalidate: boardById.key });
		}

		default: {
			const _exhaustiveCheck: never = c;
			return _exhaustiveCheck;
		}
	}
}, 'transform-board');

export {
	appendBoard,
	boardById,
	boardsByAccount,
	deleteBoard,
	getAccount,
	transformBoard,
};
