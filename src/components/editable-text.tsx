// file: src/components/editable-text.tsx
import { Show, createSignal } from 'solid-js';
import { makeFocusRef } from '../shared/shame';

const Activate = (props: { text: string; onClick: () => void }) => (
	<button
		class="c-editable-text"
		aria-label={`Edit ${props.text}`}
		type="button"
		onClick={props.onClick}
	>
		{props.text}
	</button>
);

export function EditableText(props: { text: string }) {
	const input = makeFocusRef<HTMLInputElement>();
	const [active, setActive] = createSignal(false);
	const openEdit = () => setActive(true);
	const closeEdit = () => {
		setActive(false);
		input.dispose();
	};

	const dismissEdit = (
		e: FocusEvent & {
			currentTarget: HTMLInputElement;
			target: HTMLInputElement;
		}
	) => {
		if (e.currentTarget.checkValidity() && input.ref) {
			console.log('edited text', input.ref.value);
			// TODO saveAction
			closeEdit();
		}
	};

	const submitText = (
		e: SubmitEvent & { currentTarget: HTMLFormElement; target: Element }
	) => {
		e.preventDefault();
		if (input.ref) {
			console.log('edited text', input.ref.value);
			// TODO saveAction
		}
		closeEdit();
	};

	return (
		<Show
			when={active()}
			fallback={<Activate text={props.text} onClick={openEdit} />}
		>
			<form class="c-editable-text" onSubmit={submitText}>
				<input
					ref={input.initialize}
					value={props.text}
					onBlur={dismissEdit}
					type="text"
					required
				/>
			</form>
		</Show>
	);
}
