// file: src/router/index.tsx
import { For } from 'solid-js';
import { createAsync } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { boardsByAccount } from '../server/api.js';

const boardHref = (boardId: string) => `/board/${boardId}`;

export default function Home() {
	const boards = createAsync(() => boardsByAccount(), { deferStream: true });
	return (
		<main style="padding-inline: 2rem;">
			<Title>Boards | Strello</Title>
			<h1>Boards</h1>
			<ul>
				<For each={boards()}>
					{(board) => (
						<li>
							<a href={boardHref(board.id)}>{board.title}</a>
						</li>
					)}
				</For>
			</ul>
		</main>
	);
}
