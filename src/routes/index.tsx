// file: src/router/index.tsx
import { For, Show, createMemo, untrack } from 'solid-js';
import { createAsync, useSubmission, useSubmissions } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import {
	appendBoard,
	boardsByAccount,
	deleteBoard,
	getAccount,
} from '../server/api.js';
import { BsTrash } from '~/components/icons.js';
import { makeFocusRef } from '~/shared/shame.js';

import type { RouteDefinition } from '@solidjs/router';
import type { BoardInfo } from '~/client-types';

function AppendBoard() {
	const title = makeFocusRef<HTMLInputElement>();
	const appendSubmission = useSubmission(appendBoard);

	return (
		<form action={appendBoard} class="c-board-add" method="post">
			<div class="c-board-add__title">
				<h2>New Board</h2>
				<label for="title">Name</label>
				<div>
					<input
						ref={title.initialize}
						id="title"
						name="title"
						type="text"
						required
						disabled={appendSubmission.pending}
					/>
				</div>
			</div>
			<div class="c-board-add__submit">
				<div>
					<label for="board-color">Color</label>
					<input
						id="board-color"
						name="color"
						type="color"
						value="#A2DEFF"
						disabled={appendSubmission.pending}
					/>
				</div>
				<button type="submit" disabled={appendSubmission.pending}>
					{appendSubmission.pending ? 'Creating…' : 'Create'}
				</button>
			</div>
		</form>
	);
}

const boardHref = (boardId: string) => `/board/${boardId}`;

function BoardList(props: { data: Array<BoardInfo> }) {
	const deleteSubmissions = useSubmissions(deleteBoard);

	const boards = createMemo(() => {
		// Intentional reactive dependencies:
		// - props.data
		// - deleteSubmissions.pending
		let remain = props.data;
		if (deleteSubmissions.pending) {
			untrack(() => {
				const deletedRefIds: Array<string> = [];
				for (const s of deleteSubmissions) {
					if (!s.pending) continue;
					deletedRefIds.push(s.input[0].refId);
				}
				remain = remain.filter(
					(b) => b.refId && !deletedRefIds.includes(b.refId)
				);
			});
		}

		return remain;
	});

	return (
		<div class="c-board-list">
			<h2>Boards</h2>
			<nav>
				<Show when={boards()?.length} fallback="No boards found.">
					<For each={boards()}>
						{(board) => (
							<div class="c-board-list__board">
								<a
									href={boardHref(board.id)}
									style={`border-color: ${board.color};`}
								>
									<div class="c-board-list__board-title">{board.title}</div>
								</a>
								<Show when={board.refId}>
									{(refId) => (
										<form
											action={deleteBoard.with({
												refId: refId(),
												updatedAt: board.updatedAt,
											})}
											method="post"
											class="c-board-list__board-delete"
										>
											<button aria-label="Delete board" type="submit">
												<BsTrash />
											</button>
										</form>
									)}
								</Show>
							</div>
						)}
					</For>
				</Show>
			</nav>
		</div>
	);
}

export const route = {
	preload: () => {
		getAccount();
		boardsByAccount();
	},
} satisfies RouteDefinition;

export default function Home() {
	const account = createAsync(() => getAccount());
	const serverBoards = createAsync(() => boardsByAccount(), {
		deferStream: true,
	});

	return (
		<main class="p-board-list">
			<Title>Boards | Strello</Title>
			<Show when={account() && serverBoards()}>
				{(boards) => (
					<div>
						<AppendBoard />
						<BoardList data={boards()} />
					</div>
				)}
			</Show>
		</main>
	);
}
