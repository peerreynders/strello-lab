// file: src/components/layout.tsx
import { Show } from 'solid-js';
import { DiscordIcon, GitHubIcon, Logo } from './logo';
import type { ParentProps } from 'solid-js';

const Login = () => <a href="/login">Login</a>;

export function Layout(props: ParentProps) {
	const user = () => true;

	return (
		<div class="c-layout">
			<header>
				<div class="c-layout__content">
					<div class="c-layout__content-start">
						<div class="c-layout__logo">
							<a aria-label="Home page" href="/">
								<Logo />
							</a>
						</div>
					</div>
					<div class="c-layout__content-end">
						<a
							href="https://github.com/solidjs-community/strello"
							class="c-layout__github"
							aria-label="GitHub"
							target="_blank"
							rel="noopener noreferrer"
						>
							<GitHubIcon />
						</a>
						<a
							href="https://discord.com/invite/solidjs"
							class="c-layout__discord"
							aria-label="Discord"
							target="_blank"
							rel="noopener noreferrer"
						>
							<DiscordIcon />
						</a>
						<Show when={user()} fallback={<Login />}>
							<form>
								<button name="logout" type="submit">
									Logout
								</button>
							</form>
						</Show>
					</div>
				</div>
			</header>
			{props.children}
		</div>
	);
}
