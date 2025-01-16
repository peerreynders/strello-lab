import { fromPassword } from './src/server/session.js';
import {
	appendBoard,
	appendColumn,
	appendNote,
	createAccount,
} from './src/server/repo.js';

async function initialize() {
	const account = await createAccount(
		'start@solidjs.com',
		'password',
		fromPassword
	);
	if (!account) throw Error('Failed to create account');

	let board = await appendBoard(account.id, 'backlog', '#a2deff');
	let column = await appendColumn(account.id, board.id, 'test');
	await appendNote(account.id, column.id, 'abc');
	await appendNote(account.id, column.id, 'def');

	board = await appendBoard(account.id, 'In progress', '#a2deff');

	board = await appendBoard(account.id, 'qwe', '#702a56');
	column = await appendColumn(account.id, board.id, 'test 123');
	column = await appendColumn(account.id, board.id, 'test 456');
	column = await appendColumn(account.id, board.id, 'test 789');
	await appendNote(account.id, column.id, 'abc');
	await appendNote(account.id, column.id, 'def');
}

initialize();
