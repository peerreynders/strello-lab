// file: src/components/note.tsx
import { createSignal } from 'solid-js';
import { DRAG_TYPES } from '~/client-types.js';
import { fromMoveInfo } from '~/shared/shame';
import { BsTrash, RiEditorDraggable } from './icons';

import type { NoteInfo, NoteServices } from '~/client-types';

type DropRelation = 'before' | 'after' | undefined;

type Props = {
	note: NoteInfo;
	services: NoteServices;
	before: NoteInfo | undefined;
	after: NoteInfo | undefined;
};

const toPayload = (note: NoteInfo) => `${note.refId}:${note.updatedAt}`;

const isNotePayload = (e: DragEvent) =>
	e.dataTransfer ? e.dataTransfer.types[0] === DRAG_TYPES.note : false;

const isBefore = (relation: DropRelation) => relation === 'before';

function toDropRelation(e: DragEvent & { currentTarget: HTMLElement }) {
	const rect = e.currentTarget.getBoundingClientRect();
	const midY = (rect.top + rect.bottom) / 2;
	return e.clientY < midY ? 'before' : 'after';
}

function Note(props: Props) {
	const refId = () => props.note.refId;
	const moveNote = (
		moveRefId: string,
		updatedAt: number,
		before: boolean,
		bracketNote: NoteInfo | undefined
	) => {
		const relationNote = props.note;
		props.services.moveNote(
			moveRefId,
			updatedAt,
			bracketNote
				? {
						before,
						relationNote,
						bracketNote,
					}
				: {
						before,
						relationNote,
					}
		);
	};

	const deleteNote = (_e: MouseEvent) => props.services.deleteNote(props.note);
	const editNote = (e: FocusEvent & { currentTarget: HTMLTextAreaElement }) =>
		props.services.editNote(props.note, e.currentTarget.value);

	const [dragEnabled, setDragEnabled] = createSignal(false);
	const draggable = () =>
		dragEnabled() && props.note?.refId ? 'true' : 'false';
	const enableDrag = (_e: PointerEvent) => {
		if (!dragEnabled()) setDragEnabled(true);
	};
	const disableDrag = (_e: PointerEvent) => {
		if (dragEnabled()) setDragEnabled(false);
	};

	// For drag source
	const [isDragSource, setIsDragSource] = createSignal(false);
	const initializeDrag = (
		e: DragEvent & { currentTarget: HTMLDivElement; target: Element }
	) => {
		if (refId() && e.dataTransfer && e.currentTarget === e.target) {
			e.stopPropagation();
			e.dataTransfer.setData(DRAG_TYPES.note, toPayload(props.note));
		}
	};
	const maintainDrag = (
		e: DragEvent & { currentTarget: HTMLDivElement; target: Element }
	) => {
		if (e.currentTarget === e.target) {
			e.stopPropagation();
			setIsDragSource(true);
		}
	};
	const cleanupDrag = (
		e: DragEvent & { currentTarget: HTMLDivElement; target: Element }
	) => {
		if (e.currentTarget === e.target) {
			e.stopPropagation();
			setIsDragSource(false);
			setDragEnabled(false);
		}
	};

	// For drop target
	const [dropRelation, setDropRelation] = createSignal<DropRelation>(undefined);

	const narrowDropRelation = (e: DragEvent) => {
		if (isNotePayload(e)) {
			e.preventDefault();
			e.stopPropagation();
		}
	};
	const updateDropRelation = (
		e: DragEvent & { currentTarget: HTMLDivElement }
	) => {
		if (isNotePayload(e)) {
			e.preventDefault();
			e.stopPropagation();

			if (refId() && !isDragSource()) {
				setDropRelation(toDropRelation(e));
				return;
			}
		}
		setDropRelation(undefined);
	};
	const cleanupDropRelation = (_e: DragEvent) => setDropRelation(undefined);

	const moveDroppedNote = (e: DragEvent) => {
		if (isNotePayload(e)) {
			e.preventDefault();
			e.stopPropagation();

			const id = refId();
			if (!isDragSource() && id) {
				// Note: `getData` only works within `onDrop` handler
				const moveInfo = e.dataTransfer?.getData(DRAG_TYPES.note);
				if (moveInfo) {
					const [moveRefId, updatedAt] = fromMoveInfo(moveInfo);
					const before = isBefore(dropRelation());
					const bracketNote = before ? props.before : props.after;
					// There is nothing to do when the
					// bracketing note is the dropped note
					if (!(bracketNote && bracketNote.refId === moveRefId))
						moveNote(moveRefId, updatedAt, before, bracketNote);
				}
			}
		}
		setDropRelation(undefined);
	};

	const classDragDrop = () => {
		if (isDragSource()) return ' c-note--drag-source';

		const relation = dropRelation();
		return relation !== undefined ? ` c-note--drop-${relation}` : '';
	};

	const classMoveHint = () => (refId() ? ' c-note--move-hint' : '');

	return (
		<div
			class={`c-note${classDragDrop()}`}
			draggable={draggable()}
			onDragStart={initializeDrag}
			onDrag={maintainDrag}
			onDragEnd={cleanupDrag}
			onDragEnter={narrowDropRelation}
			onDragOver={updateDropRelation}
			onDragLeave={cleanupDropRelation}
			onDrop={moveDroppedNote}
		>
			<div
				class={`c-note__move${classMoveHint()}`}
				onPointerDown={enableDrag}
				onPointerUp={disableDrag}
				onPointerOut={disableDrag}
			>
				<RiEditorDraggable />
			</div>
			<textarea onBlur={editNote}>{props.note.body}</textarea>
			<button class="c-note__remove" onClick={deleteNote}>
				<BsTrash />
			</button>
		</div>
	);
}

export { Note };
