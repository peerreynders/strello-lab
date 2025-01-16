// file: src/routes/login.tsx
import { Show, createSignal } from 'solid-js';
import { useSubmission } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import {
	AUTHENTICATE_KIND,
	authenticate,
	redirectIfAccount,
} from '~/server/api.js';
import { makeFocusRef } from '~/shared/shame.js';

import type { RouteDefinition, RouteSectionProps } from '@solidjs/router';

const INITIAL_IS_LOGIN = true;

export const route = {
	preload: () => redirectIfAccount(),
} satisfies RouteDefinition;

export default function Login(props: RouteSectionProps) {
	const redirectTo = () => {
		const target = props.location.query['redirect-to'];
		return target ? target : '/';
	};

	const loggingIn = useSubmission(authenticate);

	const emailInput = makeFocusRef();
	const [isLogin, setIsLogin] = createSignal(INITIAL_IS_LOGIN);
	const selectKind = (e: Event & { currentTarget: HTMLInputElement }) => {
		setIsLogin(e.currentTarget.value === AUTHENTICATE_KIND.login);
	};

	const classKindSelected = (forLogin: boolean) =>
		forLogin === isLogin() ? ' c-login__kind--selected' : '';

	return (
		<main class="p-login">
			<Title>Login/Register | Strello</Title>
			<h2>Sign in to Strello</h2>
			<form action={authenticate} class="c-login" method="post">
				<input type="hidden" name="redirect-to" value={redirectTo()} />
				<fieldset class="c-login__kind">
					<label class={classKindSelected(true)}>
						<input
							type="radio"
							name="kind"
							value={AUTHENTICATE_KIND.login}
							checked={INITIAL_IS_LOGIN}
							onChange={selectKind}
						/>
						Login
					</label>
					<label class={classKindSelected(false)}>
						<input
							type="radio"
							name="kind"
							value={AUTHENTICATE_KIND.register}
							onChange={selectKind}
						/>
						Register
					</label>
				</fieldset>
				<div class="c-login__entry">
					<div>
						<label for="email-input">Email</label>
						<input
							ref={emailInput.initialize}
							id="email-input"
							name="email"
							placeholder="start@solidjs.com"
							autocomplete="email"
						/>
					</div>
					<div>
						<label for="password-input">Password</label>
						<input
							id="password-input"
							name="password"
							type="password"
							placeholder="password"
							autocomplete="current-password"
						/>
					</div>
					<button type="submit">
						{loggingIn.pending ? (
							<span class="loader"></span>
						) : isLogin() ? (
							'Login'
						) : (
							'Register'
						)}
					</button>
					<Show when={loggingIn.result}>
						{(result) => (
							<p role="alert" id="error-message">
								{result().message}
							</p>
						)}
					</Show>
				</div>
			</form>
		</main>
	);
}
