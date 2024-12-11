// file: src/component/column.tsx
import { For, createMemo, createSignal } from 'solid-js';
import { DRAG_TYPES } from '~/client-types.js';
import { byRankAsc, fromMoveInfo } from '~/shared/shame.js';
import { BsTrash, RiEditorDraggable } from './icons.js';
import { Note } from './note.js';
import { AddNote } from './add-note.js';

import type {
	ColumnInfo,
	ColumnServices,
	NoteInfo,
	NoteMoveInfo,
} from '~/client-types';

type Props = {
	column: ColumnInfo;
	boardNotes: Array<NoteInfo>;
	services: ColumnServices;
};

const toPayload = (column: ColumnInfo) => `${column.refId}:${column.updatedAt}`;

const isNotePayload = (e: DragEvent) =>
	e.dataTransfer ? e.dataTransfer.types[0] === DRAG_TYPES.note : false;

export function Column(props: Props) {
	const refId = () => props.column.refId;

	const notes = createMemo<Array<NoteInfo>>(() => {
		const keepColumnNote = (n: NoteInfo) =>
			n.columnRefId === props.column.refId;
		return props.boardNotes.filter(keepColumnNote).sort(byRankAsc);
	});

	const noteBefore = (fromIndex: number) => {
		const index = fromIndex - 1;
		if (index < 0 || notes().length <= index) return undefined;
		return notes()[index];
	};
	const noteAfter = (fromIndex: number) => {
		const index = fromIndex + 1;
		if (index < 0 || notes().length <= index) return undefined;
		return notes()[index];
	};

	// props for nested components
	const noteServices = {
		editNote: (note: NoteInfo, body: string) =>
			props.services.editNote(note, body),
		deleteNote: (note: NoteInfo) => props.services.deleteNote(note),
		moveNote: (moveRefId: string, updatedAt: number, info: NoteMoveInfo) =>
			props.services.moveNote(props.column, moveRefId, updatedAt, info),
	};
	const appendNote = (body: string) =>
		props.services.appendNote(props.column, body);
	const disabled = () => !props.column.refId;

	// local
	const deleteColumn = (_e: MouseEvent) =>
		props.services.deleteColumn(props.column);
	const editColumn = (e: FocusEvent & { currentTarget: HTMLInputElement }) => {
		const newTitle = e.currentTarget.value;
		const changed = newTitle !== props.column.title;
		if (changed && e.currentTarget.reportValidity())
			props.services.editColumn(props.column, newTitle);
	};
	const blurOnEnter = (
		e: KeyboardEvent & { currentTarget: HTMLInputElement }
	) => {
		if (e.key === 'Enter') e.currentTarget.blur();
	};

	// For column drag
	const [dragEnabled, setDragEnabled] = createSignal(false);
	const draggable = () =>
		dragEnabled() && props.column.refId ? 'true' : 'false';
	const enableDrag = (_e: PointerEvent) => {
		if (!dragEnabled()) setDragEnabled(true);
	};
	const disableDrag = (_e: PointerEvent) => {
		if (dragEnabled()) setDragEnabled(false);
	};

	// For column drag source
	const [isDragSource, setIsDragSource] = createSignal(false);
	const initializeColumnDrag = (
		e: DragEvent & { currentTarget: HTMLDivElement; target: Element }
	) => {
		if (refId() && e.dataTransfer && e.target === e.currentTarget) {
			e.stopPropagation();
			e.dataTransfer.setData(DRAG_TYPES.column, toPayload(props.column));
		}
	};
	const maintainColumnDrag = (
		e: DragEvent & { currentTarget: HTMLDivElement; target: Element }
	) => {
		if (e.target === e.currentTarget) {
			e.stopPropagation();
			setIsDragSource(true);
		}
	};
	const cleanupColumnDrag = (
		e: DragEvent & { currentTarget: HTMLDivElement; target: Element }
	) => {
		if (e.target === e.currentTarget) {
			e.stopPropagation();
			setIsDragSource(false);
			setDragEnabled(false);
		}
	};

	// For note drop target
	const [dropTarget, setDropTarget] = createSignal(false);

	const narrowNoteDropTarget = (e: DragEvent) => {
		if (isNotePayload(e)) {
			e.preventDefault();
			e.stopPropagation();
		}
	};
	const updateNoteDropTarget = (
		e: DragEvent & { currentTarget: HTMLDivElement }
	) => {
		if (isNotePayload(e)) {
			e.preventDefault();
			e.stopPropagation();

			if (refId()) {
				setDropTarget(true);
				return;
			}
		}
		setDropTarget(false);
	};
	const cleanupNoteDropTarget = (_e: DragEvent) => setDropTarget(false);

	const moveDroppedNote = (e: DragEvent) => {
		if (isNotePayload(e)) {
			e.preventDefault();
			e.stopPropagation();
			if (refId()) {
				// Note: `getData` only works within `onDrop` handler
				const moveInfo = e.dataTransfer?.getData(DRAG_TYPES.note);
				if (moveInfo) {
					const [moveRefId, updatedAt] = fromMoveInfo(moveInfo);
					const lastNote = notes().at(-1);
					props.services.moveNote(
						props.column,
						moveRefId,
						updatedAt,
						lastNote
							? {
									before: false,
									relationNote: lastNote,
								}
							: undefined
					);
				}
			}
		}
		setDropTarget(false);
	};

	const classDragDrop = () => {
		if (isDragSource()) return ' c-column--drag-source';

		return dropTarget() ? ' c-column--drop-target' : '';
	};

	return (
		<div
			class={`c-column${classDragDrop()}`}
			draggable={draggable()}
			onDragStart={initializeColumnDrag}
			onDrag={maintainColumnDrag}
			onDragEnd={cleanupColumnDrag}
			onDragEnter={narrowNoteDropTarget}
			onDragOver={updateNoteDropTarget}
			onDragLeave={cleanupNoteDropTarget}
			onDrop={moveDroppedNote}
		>
			<div class="c-column__header">
				<div
					onPointerDown={enableDrag}
					onPointerUp={disableDrag}
					onPointerOut={disableDrag}
				>
					<RiEditorDraggable />
				</div>
				<input
					value={props.column.title}
					onBlur={editColumn}
					onKeyDown={blurOnEnter}
					required
				/>
				<button onClick={deleteColumn} disabled={disabled()}>
					<BsTrash />
				</button>
			</div>
			<div class="c-column__items">
				<For each={notes()}>
					{(note, i) => (
						<Note
							note={note}
							services={noteServices}
							before={noteBefore(i())}
							after={noteAfter(i())}
						/>
					)}
				</For>
			</div>
			<AddNote appendNote={appendNote} disabled={disabled()} />
		</div>
	);
}
