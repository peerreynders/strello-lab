// file src/components/board.tsx
import { For, batch, createEffect, createMemo, on, untrack } from 'solid-js';
import { useAction, useSubmissions } from '@solidjs/router';
import { createStore, produce, reconcile } from 'solid-js/store';
import { Column } from './column.js';
import { ColumnGap } from './column-gap.js';
import { AddColumn } from './add-column.js';
import { transformBoard } from '~/server/api.js';
import {
	byRankAsc,
	makeId,
	msSinceEpoch,
	msSinceStart,
} from '~/shared/shame.js';
import { LEXRANK, between } from '~/shared/lex-rank.js';

import type { Submission } from '@solidjs/router';
import type {
	BoardData,
	BoardCommand,
	ColumnInfo,
	ColumnMoveInfo,
	NoteInfo,
	NoteMove,
	NoteMoveInfo,
} from '~/client-types';

type Props = {
	data: BoardData;
};

const bySubmittedAsc = (a: BoardCommand, b: BoardCommand) =>
	a.submitted - b.submitted;
const alwaysKeepCommand = (_c: BoardCommand) => true;

function selectPending(
	i: IterableIterator<Submission<[BoardCommand], boolean>>,
	keep = alwaysKeepCommand
) {
	const commands: Array<BoardCommand> = [];
	for (const submission of i) {
		const c = submission.input[0];
		if (!(submission.pending && keep(c))) continue;

		commands.push(c);
	}

	return commands.sort(bySubmittedAsc);
}

function applyCommands(
	commands: Array<BoardCommand>,
	columns: Array<ColumnInfo>,
	notes: Array<NoteInfo>
) {
	for (const c of commands) {
		switch (c.kind) {
			case 'columnAppend': {
				const index = columns.findIndex((col) => col.id === c.id);
				if (index === -1)
					columns.push({
						id: c.id,
						updatedAt: msSinceEpoch(),
						title: c.title,
						rank: c.rank,
					});

				break;
			}

			case 'columnDelete': {
				const index = columns.findIndex((col) => col.refId === c.refId);
				if (index !== -1) columns.splice(index, 1);

				for (let i = notes.length - 1; i >= 0; i -= 1) {
					if (notes[i].columnRefId !== c.refId) continue;

					notes.splice(i, 1);
				}
				break;
			}

			case 'columnEdit': {
				const index = columns.findIndex((col) => col.refId === c.refId);
				if (index !== -1) columns[index].title = c.title;
				break;
			}

			case 'columnMove': {
				const index = columns.findIndex((col) => col.refId === c.refId);
				if (index !== -1) columns[index].rank = c.rank;
				break;
			}

			case 'noteAppend': {
				const index = notes.findIndex((n) => n.id === c.id);
				if (index === -1)
					notes.push({
						id: c.id,
						updatedAt: msSinceEpoch(),
						columnRefId: c.columnRefId,
						body: c.body,
						rank: c.rank,
					});

				break;
			}

			case 'noteDelete': {
				const index = notes.findIndex((n) => n.refId === c.refId);
				if (index !== -1) notes.splice(index, 1);
				break;
			}

			case 'noteEdit': {
				const index = notes.findIndex((n) => n.refId === c.refId);
				if (index !== -1) notes[index].body = c.body;
				break;
			}

			case 'noteMove': {
				const index = notes.findIndex((n) => n.refId === c.refId);
				if (index !== -1) {
					const note = notes[index];
					note.columnRefId = c.columnRefId;
					note.rank = c.rank;
				}
				break;
			}

			default: {
				const _exhaustiveCheck: never = c;
				return _exhaustiveCheck;
			}
		}
	}
}

function lastColumn(columns: Array<ColumnInfo>) {
	let last: ColumnInfo | undefined;
	for (let i = 0; i < columns.length; i += 1) {
		const c = columns[i];
		if (!last || last.rank < c.rank) {
			last = c;
		}
	}
	return last;
}

function lastColumnNote(notes: Array<NoteInfo>, columnRefId: string) {
	let last: NoteInfo | undefined;
	for (let i = 0; i < notes.length; i += 1) {
		const n = notes[i];
		if (n.columnRefId === columnRefId && (!last || last.rank < n.rank)) {
			last = n;
		}
	}
	return last;
}

export function Board(props: Props) {
	const submitChange = useAction(transformBoard);
	const submissions = useSubmissions(transformBoard);

	const [boardStore, setBoardStore] = createStore({
		columns: props.data.columns,
		notes: props.data.notes,
		synchronized: msSinceStart(),
	});

	const columnServices = {
		deleteColumn: (column: ColumnInfo) => {
			if (!column.refId) throw new Error('delete on optimistic note');

			submitChange({
				kind: 'columnDelete',
				refId: column.refId,
				updatedAt: column.updatedAt,
				submitted: msSinceStart(),
			});
		},
		editColumn: (column: ColumnInfo, title: string) => {
			if (!column.refId) throw new Error('edit on optimistic note');

			submitChange({
				kind: 'columnEdit',
				refId: column.refId,
				updatedAt: column.updatedAt,
				title,
				submitted: msSinceStart(),
			});
		},
		appendNote: (c: ColumnInfo, body: string) => {
			if (!c.refId) throw new Error('append on optimistic column');

			const columnRefId = c.refId;
			const lastRank = lastColumnNote(boardStore.notes, columnRefId)?.rank;
			const rank = lastRank ? between(lastRank) : LEXRANK.initialMin;

			submitChange({
				kind: 'noteAppend',
				columnRefId,
				id: makeId(),
				body,
				rank,
				submitted: msSinceStart(),
			});
		},
		deleteNote: (note: NoteInfo) => {
			if (!note.refId) throw new Error('delete on optimistic note');

			submitChange({
				kind: 'noteDelete',
				refId: note.refId,
				updatedAt: note.updatedAt,
				submitted: msSinceStart(),
			});
		},
		editNote: (note: NoteInfo, body: string) => {
			if (!note.refId) throw new Error('edit on optimistic note');

			submitChange({
				kind: 'noteEdit',
				refId: note.refId,
				updatedAt: note.updatedAt,
				body,
				submitted: msSinceStart(),
			});
		},
		moveNote: (
			column: ColumnInfo,
			refId: string,
			updatedAt: number,
			info?: NoteMoveInfo
		) => {
			const columnRefId = column.refId;
			if (!columnRefId) throw new Error('Move note to optimistic column');

			let rank = LEXRANK.initialMin;
			let relation: NoteMove['relation'] | undefined;
			if (info) {
				if (!info.relationNote.refId)
					throw new Error('move relative to optimistic note');
				// Note: Moving note `refId` is moved before/after `info.relationNote`
				relation = {
					refId: info.relationNote.refId,
					before: info.before,
				};

				const bracketRank = info.bracketNote?.rank;
				const [beforeRank, afterRank] = info.before
					? [bracketRank, info.relationNote.rank]
					: [info.relationNote.rank, bracketRank];
				rank = between(beforeRank, afterRank);
			}

			const submitted = msSinceStart();
			submitChange(
				relation
					? {
							kind: 'noteMove',
							refId,
							updatedAt,
							relation,
							columnRefId,
							rank,
							submitted,
						}
					: {
							kind: 'noteMove',
							refId,
							updatedAt,
							columnRefId,
							rank,
							submitted,
						}
			);
		},
	};

	let columnsScrollToEnd = false;
	const appendColumn = (title: string) => {
		const boardRefId = props.data.board.refId;
		// Not going to happen here
		// (board won't be optimistic in this component) but keeps TS happy
		if (!boardRefId) throw new Error('append column on optimistic board');

		const lastRank = lastColumn(boardStore.columns)?.rank;
		const rank = lastRank ? between(lastRank) : LEXRANK.initialMin;

		submitChange({
			kind: 'columnAppend',
			boardRefId,
			id: makeId(),
			title,
			rank,
			submitted: msSinceStart(),
		});

		columnsScrollToEnd = true;
	};

	const moveColumn = (
		refId: string,
		updatedAt: number,
		info: ColumnMoveInfo
	) => {
		const boardRefId = props.data.board.refId;
		// Not going to happen here
		// (board won't be optimistic in this component) but keeps TS happy
		if (!boardRefId) throw new Error('move column on optimistic board');
		if (!info.relationColumn.refId)
			throw new Error('move relative to optimistic column');
		// Note: Moving column `refId` is moved before/after `info.relationColumn`
		const relation = {
			refId: info.relationColumn.refId,
			before: info.before,
		};
		const bracketRank = info.bracketColumn?.rank;
		const [beforeRank, afterRank] = info.before
			? [bracketRank, info.relationColumn.rank]
			: [info.relationColumn.rank, bracketRank];
		const rank = between(beforeRank, afterRank);
		const submitted = msSinceStart();
		submitChange({
			kind: 'columnMove',
			refId,
			updatedAt,
			boardRefId,
			relation,
			rank,
			submitted,
		});
	};

	const rankedColumns = createMemo(() =>
		boardStore.columns.slice().sort(byRankAsc)
	);

	let columnsContainer: HTMLDivElement | undefined;
	createEffect(
		on(rankedColumns, () => {
			if (!columnsScrollToEnd) return;

			columnsScrollToEnd = false;
			if (columnsContainer)
				columnsContainer.scrollLeft = columnsContainer.scrollWidth;
		})
	);

	const columnAfter = (fromIndex: number) => {
		const index = fromIndex + 1;
		if (index < 0 || rankedColumns().length <= index) return undefined;
		return rankedColumns()[index];
	};

	createEffect(() => {
		// When props.data changes
		// (i.e. refreshes, due to any completed mutation) …
		const columns = structuredClone(props.data.columns);
		const notes = structuredClone(props.data.notes);

		// … optimistically (re-)apply any remaining, pending
		// mutations with reference to the fresh data.
		const commands = untrack(() => selectPending(submissions.values()));
		applyCommands(commands, columns, notes);
		batch(() => {
			setBoardStore('columns', reconcile(columns));
			setBoardStore('notes', reconcile(notes));
			setBoardStore('synchronized', msSinceStart());
		});
	});

	createEffect(() => {
		const lastSynchronized = untrack(() => boardStore.synchronized);
		// When submissions changes …
		const commands = selectPending(
			submissions.values(),
			(c) => c.submitted > lastSynchronized
		);
		// … optimistically apply any new mutation(s)
		// directly against the intermediate BoardStore …
		setBoardStore(
			produce((b) => {
				applyCommands(commands, b.columns, b.notes);
				b.synchronized = msSinceStart();
			})
		);
	});

	return (
		<div class="c-board" ref={columnsContainer}>
			<ColumnGap
				moveColumn={moveColumn}
				before={undefined}
				after={columnAfter(-1)}
			/>
			<For each={rankedColumns()}>
				{(column, i) => (
					<>
						<Column
							column={column}
							boardNotes={props.data.notes}
							services={columnServices}
						/>
						<ColumnGap
							moveColumn={moveColumn}
							before={column}
							after={columnAfter(i())}
						/>
					</>
				)}
			</For>
			<AddColumn appendColumn={appendColumn} />
		</div>
	);
}
