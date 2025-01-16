// file: src/server/api.ts
import { getRequestEvent } from 'solid-js/web';
import { action, json, query, redirect } from '@solidjs/router';
import { fromPassword, getSession, hashPassword } from './session.js';
import {
	accountByEmail,
	accountById,
	boardById as bById,
	boardsByAccount as bByAccount,
	appendBoard as appendBoardRepo,
	appendColumn,
	appendNote,
	deleteBoard as deleteBoardRepo,
	deleteColumn,
	deleteNote,
	createAccount,
	editColumn,
	editNote,
	moveColumn,
	moveNote,
	moveNoteToColumn,
} from './repo.js';
import { getSessionAccount } from './internal.js';
import { validateEmailFormat, validatePasswordFormat } from '~/shared/shame.js';

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

const AUTHENTICATE_KIND = {
	login: 'login',
	register: 'register',
};

const authenticate = action(async (formData: FormData) => {
	'use server';
	const event = getRequestEvent();
	if (!event) return new Error('Server error.');

	// Speed Bump!
	// Moving this in front of the later session.update
	// risks flushing headers too early when an error is simply
	// and quickly returned before other
	// concurrent ( getAccount, redirectIfAccount) operations
	// progress
	let session = event.locals.session;
	if (!session) {
		event.locals.session = session = await getSession();
	}

	const redirectTo = formData.get('redirect-to');
	if (typeof redirectTo !== 'string')
		return new Error(
			`Malformed authenticate action. "redirect-to" parameter: :${redirectTo}.`
		);

	const kind = formData.get('kind');
	if (
		typeof kind !== 'string' ||
		(kind !== AUTHENTICATE_KIND.login && kind !== AUTHENTICATE_KIND.register)
	)
		return new Error(
			`Malformed authenticate action. "kind" parameter: :${kind}.`
		);

	let error: string | undefined;
	const email = formData.get('email');
	if (typeof email !== 'string' || (error = validateEmailFormat(email)))
		return new Error(error);

	const password = formData.get('password');
	if (
		typeof password !== 'string' ||
		(error = validatePasswordFormat(password))
	)
		return new Error(error);

	let account: Awaited<ReturnType<typeof accountByEmail>>;
	if (kind === AUTHENTICATE_KIND.login) {
		account = await accountByEmail(email, password, hashPassword);
		if (typeof account !== 'object')
			return new Error("Email or password doesn't match.");
	} else {
		account = await createAccount(email, password, fromPassword);
		if (!account) return new Error('Account already exists');
	}

	await session.update((record) => {
		record.accountId = account.id;
		return record;
	});

	throw redirect(redirectTo);
}, 'authenticate');

const logout = action(async () => {
	'use server';
	const event = getRequestEvent();
	if (!event) throw new Error('logout: request event unavailable');

	let session = event.locals.session;
	if (!session) {
		event.locals.session = session = await getSession();
	}
	await session.clear();

	throw redirect('/login');
}, 'logout');

// For `/login` preload
const redirectIfAccount = query(async () => {
	'use server';
	const accountId = await getSessionAccount('redirectIfAccount');
	if (accountId) throw redirect('/');

	return null;
}, 'redirect-account');

const hasAccountSession = query(async () => {
	'use server';
	const accountId = await getSessionAccount('hasAccountSession');
	return Boolean(accountId);
}, 'session-account');

const getAccount = query(async () => {
	'use server';
	const accountId = await getSessionAccount('getAccount');
	if (!accountId) throw redirect('/login');

	const record = await accountById(accountId);
	if (!record) throw redirect('/login');

	return { id: record.id, email: record.email };
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
	const accountId = await getSessionAccount('boardsByAccount');
	if (!accountId) throw redirect('/login');

	const boards = await bByAccount(accountId);
	return boards.map(fromBoardRecord);
}, 'boards-by-account');

const appendBoard = action(async (data: FormData) => {
	'use server';
	const accountId = await getSessionAccount('appendBoard');
	if (!accountId) throw redirect('/login');

	const title = String(data.get('title'));
	const color = String(data.get('color'));

	const board = await appendBoardRepo(accountId, title, color);

	// Compel client to change to new board route
	throw redirect(`/board/${board.id}`);
}, 'append-board');

const deleteBoard = action(async (c: BoardDelete) => {
	'use server';
	const accountId = await getSessionAccount('deleteBoard');
	if (!accountId) throw redirect('/login');

	// TODO this can throw for
	// non-existent board (stale post-delete)
	// delete based on stale data
	const result = await deleteBoardRepo(accountId, c.refId, c.updatedAt);

	return json(result, { revalidate: boardsByAccount.key });
}, 'delete-board');

const boardById = query(async (id: string) => {
	'use server';
	const accountId = await getSessionAccount('boardById');
	if (!accountId) throw redirect('/login');

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
	const accountId = await getSessionAccount('transformBoard');
	if (!accountId) throw redirect('/login');

	switch (c.kind) {
		case 'columnAppend': {
			await appendColumn(accountId, c.boardRefId, c.title, c.id);
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
			await appendNote(accountId, c.columnRefId, c.body, c.id);
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
	AUTHENTICATE_KIND,
	appendBoard,
	authenticate,
	boardById,
	boardsByAccount,
	deleteBoard,
	getAccount,
	hasAccountSession,
	logout,
	redirectIfAccount,
	transformBoard,
};
