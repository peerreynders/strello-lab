// file src/components/add-column.tsx
import { Show, createSignal, untrack } from 'solid-js';
import { BsPlus } from './icons';
import { makeFocusRef } from '../shared/shame';

const CLASS = 'c-add-column';

const Activate = (props: {
	initRef: (el: HTMLButtonElement) => void;
	onClick: () => void;
}) => (
	<button ref={props.initRef} class={CLASS} onClick={props.onClick}>
		<BsPlus />
	</button>
);

export function AddColumn(props: { appendColumn: (title: string) => void }) {
	const input = makeFocusRef<HTMLInputElement>();
	const button = makeFocusRef<HTMLButtonElement>(false);
	const [active, setActive] = createSignal(false);
	const openNewColumn = () => setActive(true);
	const closeNewColumn = () => {
		/* transfer focus to button after closing */
		button.enable(true);
		setActive(false);
		input.dispose();
	};

	const dismissNewColumn = (
		e: FocusEvent & { currentTarget: HTMLFormElement }
	) => {
		// focus is going to a descendent node of "new column" form
		if (
			e.currentTarget.contains(
				e.relatedTarget instanceof Node ? e.relatedTarget : null
			)
		)
			return;

		closeNewColumn();
	};

	const submitColumn = (
		e: SubmitEvent & { currentTarget: HTMLFormElement; target: Element }
	) => {
		e.preventDefault();
		if (!input.ref) return;

		const title = input.ref.value.trim();
		untrack(() => props.appendColumn(title));
		input.ref.value = '';
	};

	return (
		<Show
			when={active()}
			fallback={
				<Activate initRef={button.initialize} onClick={openNewColumn} />
			}
		>
			<form class={CLASS} onSubmit={submitColumn} onFocusOut={dismissNewColumn}>
				<input ref={input.initialize} placeholder="Add a Column" required />
				<div>
					<button type="submit">Add</button>
					<button type="reset" onClick={closeNewColumn}>
						Cancel
					</button>
				</div>
			</form>
		</Show>
	);
}
