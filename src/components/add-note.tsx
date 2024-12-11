// file: src/components/add-note.tsx
import { Show, createSignal, untrack } from 'solid-js';
import { BsPlus } from './icons';
import { makeFocusRef } from '../shared/shame';

const Activate = (props: { onClick: () => void }) => (
	<button onClick={props.onClick}>
		<BsPlus /> Add a card
	</button>
);

export function AddNote(props: {
	appendNote: (body: string) => void;
	disabled: boolean;
}) {
	const input = makeFocusRef<HTMLInputElement>();
	const [active, setActive] = createSignal(false);
	const openNewNote = () => setActive(true);
	const closeNewNote = () => {
		setActive(false);
		input.dispose();
	};

	const dismissNewNote = (
		e: FocusEvent & { currentTarget: HTMLFormElement }
	) => {
		// focus is going to a descendent node of "new note" form
		if (
			e.currentTarget.contains(
				e.relatedTarget instanceof Node ? e.relatedTarget : null
			)
		)
			return;

		closeNewNote();
	};

	const submitNote = (
		e: SubmitEvent & { currentTarget: HTMLFormElement; target: Element }
	) => {
		e.preventDefault();
		if (!input.ref) return;

		const body = input.ref.value.trim();
		if (body === '') {
			input.ref.setCustomValidity('Please fill out this field.');
			input.ref.reportValidity();
			return;
		}
		untrack(() => props.appendNote(body));
		input.ref.value = '';
	};

	return (
		<div class="c-add-note">
			<Show when={active()} fallback={<Activate onClick={openNewNote} />}>
				<form onSubmit={submitNote} onFocusOut={dismissNewNote}>
					<input ref={input.initialize} placeholder="Add a Note" required />
					<div>
						<button type="submit" disabled={props.disabled}>
							Add
						</button>
						<button type="reset" onClick={closeNewNote}>
							Cancel
						</button>
					</div>
				</form>
			</Show>
		</div>
	);
}
