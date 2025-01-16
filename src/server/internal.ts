// file: src/server/internal.ts
import { getRequestEvent } from 'solid-js/web';
import { getSession } from './session.js';

async function getSessionAccount(name: string) {
	const event = getRequestEvent();
	if (!event) throw new Error(`${name}: RequestEvent unavailable.`);

	let session = event.locals.session;
	if (!session) event.locals.session = session = await getSession();

	return session.data.accountId as string | undefined;
}

export { getSessionAccount };
