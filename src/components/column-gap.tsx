// file: src/components/column-gap.tsx
import { createSignal } from 'solid-js';
import { DRAG_TYPES } from '~/client-types.js';
import { fromMoveInfo } from '~/shared/shame.js';

import type { ColumnInfo, ColumnMoveInfo } from '~/client-types.js';

type Props = {
	before: ColumnInfo | undefined;
	after: ColumnInfo | undefined;
	moveColumn: (
		moveRefId: string,
		updatedAt: number,
		info: ColumnMoveInfo
	) => void;
};

const isColumnPayload = (e: DragEvent) =>
	e.dataTransfer ? e.dataTransfer.types[0] === DRAG_TYPES.column : false;

const isAdjacentColumn = (
	refId: string,
	before: ColumnInfo | undefined,
	after: ColumnInfo | undefined
) => (before && before.refId === refId) || (after && after.refId === refId);

function makeColumnMoveInfo(
	columnBefore: ColumnInfo | undefined,
	columnAfter: ColumnInfo | undefined
): ColumnMoveInfo | undefined {
	const [before, relationColumn, bracketColumn] = columnBefore
		? [false, columnBefore, columnAfter]
		: columnAfter
			? [true, columnAfter, columnBefore]
			: [undefined, undefined, undefined];

	return before === undefined
		? undefined
		: bracketColumn
			? {
					before,
					relationColumn,
					bracketColumn,
				}
			: {
					before,
					relationColumn,
				};
}

export function ColumnGap(props: Props) {
	// For drop target
	const [dropTarget, setDropTarget] = createSignal(false);

	const narrowDropTarget = (e: DragEvent) => {
		if (isColumnPayload(e)) {
			e.preventDefault();
			e.stopPropagation();
		}
	};
	const updateDropTarget = (
		e: DragEvent & { currentTarget: HTMLDivElement }
	) => {
		if (isColumnPayload(e)) {
			e.preventDefault();
			e.stopPropagation();

			setDropTarget(true);
			return;
		}
		setDropTarget(false);
	};
	const cleanupDropTarget = (_e: DragEvent) => setDropTarget(false);
	const moveDroppedColumn = (e: DragEvent) => {
		if (isColumnPayload(e)) {
			e.preventDefault();
			e.stopPropagation();
			// Note: `getData` only works within `onDrop` handler
			const moveInfo = e.dataTransfer?.getData(DRAG_TYPES.column);
			if (moveInfo) {
				const [moveRefId, updatedAt] = fromMoveInfo(moveInfo);
				if (!isAdjacentColumn(moveRefId, props.before, props.after)) {
					const info = makeColumnMoveInfo(props.before, props.after);
					// referenced column has to have a refId
					if (info && info.relationColumn.refId) {
						props.moveColumn(moveRefId, updatedAt, info);
					}
				}
			}
		}
		setDropTarget(false);
	};

	const classDragDrop = () => {
		return dropTarget() ? ' c-column-gap--drop-target' : '';
	};

	return (
		<div
			class={`c-column-gap${classDragDrop()}`}
			onDragEnter={narrowDropTarget}
			onDragOver={updateDropTarget}
			onDragLeave={cleanupDropTarget}
			onDrop={moveDroppedColumn}
		/>
	);
}
