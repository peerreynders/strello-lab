// file: src/server/session.ts
import crypto from 'crypto';
import { useSession } from 'vinxi/http';

type SessionConfig = Parameters<typeof useSession>[0];

const config = (() => {
	// $ head -c32 /dev/urandom | base64
	if (
		typeof process.env.SESSION_SECRET !== 'string' ||
		process.env.SESSION_SECRET.length < 32
	)
		throw Error('SESSION_SECRET must be set and at least 32 characters long');

	const cfg: SessionConfig = {
		// - Private key used to encrypt session tokens
		password: process.env.SESSION_SECRET,
		// - Session expiration time in seconds
		// maxAge?: number;
		// - default is h3
		// name?: string;
		// - Default is secure, httpOnly,
		// cookie?: false | CookieSerializeOptions;
		// 	{
		//		domain?: string | undefined;
		//		encode?(value: string): string;
		//		expires?: Date | undefined;
		//		httpOnly?: boolean | undefined;
		//		maxAge?: number | undefined;
		//		path?: string | undefined;
		//		priority?: 'low' | 'medium' | 'high' | undefined;
		//		sameSite?: true | false | 'lax' | 'strict' | 'none';
		//		secure?: boolean | undefined;
		//		partitioned?: boolean;
		//	}
		//	https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes
		// - Default is x-h3-session / x-{name}-session
		// sessionHeader?: false | string;
		// seal?: SealOptions;
		// crypto?: Crypto;
		// - Default is Crypto.randomUUID
		// generateId?: () => string;
	};

	return cfg;
})();

export type SessionRecord = {
	accountId: string;
};

export type SessionManager = Awaited<
	ReturnType<typeof useSession<SessionRecord>>
>;

function getSession() {
	return useSession<SessionRecord>(config);
}

function hashPassword(salt: string, password: string) {
	return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
}

function fromPassword(password: string): [salt: string, hash: string] {
	const salt = crypto.randomBytes(16).toString('hex');
	return [salt, hashPassword(salt, password)];
}

export { fromPassword, getSession, hashPassword };
