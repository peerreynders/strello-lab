// file: src/client-types.ts
import type { LexRank } from '~/shared/lex-rank';

export type BoardInfo = {
	id: string;
	updatedAt: number;
	title: string;
	color: string;
	refId?: string;
};

export type ColumnInfo = {
	id: string;
	updatedAt: number;
	title: string;
	rank: LexRank;
	refId?: string;
};

export type NoteInfo = {
	id: string;
	updatedAt: number;
	body: string;
	rank: LexRank;
	columnRefId: string;
	refId?: string;
};

export type BoardData = {
	board: BoardInfo;
	columns: Array<ColumnInfo>;
	notes: Array<NoteInfo>;
};

export type ColumnAppend = {
	kind: 'columnAppend';
	id: string;
	boardRefId: string;
	title: string;
	rank: LexRank;
	submitted: number;
};

export type ColumnDelete = {
	kind: 'columnDelete';
	refId: string;
	updatedAt: number;
	submitted: number;
};

export type ColumnEdit = {
	kind: 'columnEdit';
	refId: string;
	updatedAt: number;
	title: string;
	submitted: number;
};

export type ColumnMove = {
	kind: 'columnMove';
	refId: string;
	updatedAt: number;
	boardRefId: string;
	relation: MoveRelation;
	rank: LexRank;
	submitted: number;
};

export type NoteAppend = {
	kind: 'noteAppend';
	id: string;
	columnRefId: string;
	body: string;
	rank: LexRank;
	submitted: number;
};

export type NoteDelete = {
	kind: 'noteDelete';
	refId: string;
	updatedAt: number;
	submitted: number;
};

export type NoteEdit = {
	kind: 'noteEdit';
	refId: string;
	updatedAt: number;
	body: string;
	submitted: number;
};

export type MoveRelation = {
	refId: string;
	before: boolean;
};

export type NoteMove = {
	kind: 'noteMove';
	refId: string;
	updatedAt: number;
	columnRefId: string;
	relation?: MoveRelation;
	rank: LexRank;
	submitted: number;
};

export type BoardCommand =
	| ColumnAppend
	| ColumnDelete
	| ColumnEdit
	| ColumnMove
	| NoteAppend
	| NoteEdit
	| NoteDelete
	| NoteMove;

export type NoteMoveInfo = {
	before: boolean; // before/after relationNote
	relationNote: NoteInfo; // before ? (moving note places before relationNote) : (moving note places after relationNote)
	bracketNote?: NoteInfo; // before ? (bracketNote places before moving note) : (bracketNote places after moving note)
}; // relationNote is required though bracketNote may not exist

export type NoteServices = {
	deleteNote(note: NoteInfo): void;
	editNote(note: NoteInfo, body: string): void;
	moveNote(moveRefId: string, updatedAt: number, info: NoteMoveInfo): void;
};

export type ColumnServices = {
	deleteColumn(column: ColumnInfo): void;
	editColumn(column: ColumnInfo, title: string): void;
	appendNote(column: ColumnInfo, body: string): void;
	deleteNote(note: NoteInfo): void;
	editNote(note: NoteInfo, body: string): void;
	moveNote(
		column: ColumnInfo,
		moveRefId: string,
		updatedAt: number,
		info?: NoteMoveInfo
	): void;
};

export type ColumnMoveInfo = {
	before: boolean; // before/after relationColumn
	relationColumn: ColumnInfo; // before ? (moving column places before relationColumn) : (moving column places after relationColumn)
	bracketColumn?: ColumnInfo; // before ? (bracketColumn places before moving column) : (bracketColumn places after moving column)
}; // relationNote is required though bracketNote may not exist

export type BoardDelete = {
	refId: string;
	updatedAt: number;
};

const DRAG_TYPES = {
	note: 'application/note',
	column: 'application/column',
} as const;

export type DragTypes = (typeof DRAG_TYPES)[keyof typeof DRAG_TYPES];

export { DRAG_TYPES };
