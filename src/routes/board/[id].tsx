// file: src/routes/board/[id].tsx
import { Show } from 'solid-js';
import { createAsync } from '@solidjs/router';
import { boardById } from '~/server/api.js';
import { EditableText } from '~/components/editable-text.js';
import { Board } from '~/components/board.js';

import type { RouteDefinition, RouteSectionProps } from '@solidjs/router';

export const route: RouteDefinition = {
	preload: (props) => boardById(props.params.id),
};

export default function BoardPage(props: RouteSectionProps) {
	const boardData = createAsync(() => boardById(props.params.id), {
		deferStream: true,
	});

	return (
		<Show when={boardData()}>
			{(data) => (
				<main class="p-board">
					<h1>
						<EditableText text={data().board.title} />
					</h1>
					<div>
						<Board data={data()} />
					</div>
				</main>
			)}
		</Show>
	);
}
