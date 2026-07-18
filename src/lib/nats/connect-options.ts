import {
    connect,
    credsAuthenticator,
    jwtAuthenticator,
    nkeyAuthenticator,
    type ConnectionOptions,
    type NatsConnection,
} from "nats";
import type { NatsConnectionConfig } from "@/types/nats";

/**
 * Map a Cobra connection config to nats.js `ConnectionOptions`.
 * Handles user/pass, token, nkey, JWT, creds, and TLS PEM fields.
 * Safe to call only on the server (uses authenticators + TLS secrets).
 */
export function buildConnectionOptions(
    config: Pick<
        NatsConnectionConfig,
        | "name"
        | "servers"
        | "authType"
        | "user"
        | "pass"
        | "token"
        | "nkeySeed"
        | "jwt"
        | "creds"
        | "tls"
    >,
    overrides?: Partial<ConnectionOptions>
): ConnectionOptions {
    const opts: ConnectionOptions = {
        servers: config.servers,
        name: `Cobra NATS - ${config.name}`,
        ...overrides,
    };

    switch (config.authType) {
        case "user_pass":
            opts.user = config.user;
            opts.pass = config.pass;
            break;
        case "token":
            opts.token = config.token;
            break;
        case "nkey":
            if (config.nkeySeed) {
                const seed = new TextEncoder().encode(config.nkeySeed.trim());
                opts.authenticator = nkeyAuthenticator(seed);
            }
            break;
        case "jwt":
            if (config.jwt) {
                const jwt = config.jwt.trim();
                const seed = config.nkeySeed
                    ? new TextEncoder().encode(config.nkeySeed.trim())
                    : undefined;
                opts.authenticator = jwtAuthenticator(jwt, seed);
            }
            break;
        case "creds":
            if (config.creds) {
                const creds = new TextEncoder().encode(config.creds);
                opts.authenticator = credsAuthenticator(creds);
            }
            break;
        case "none":
        default:
            break;
    }

    const wantsTls =
        config.tls?.enabled === true ||
        config.servers.some((s) => /^tls:\/\//i.test(s) || /^wss:\/\//i.test(s));

    if (wantsTls) {
        opts.tls = {
            ca: config.tls?.ca || undefined,
            cert: config.tls?.cert || undefined,
            key: config.tls?.key || undefined,
        };
    }

    return opts;
}

/** Open a short-lived NATS connection using the shared option builder. */
export async function connectWithConfig(
    config: Pick<
        NatsConnectionConfig,
        | "name"
        | "servers"
        | "authType"
        | "user"
        | "pass"
        | "token"
        | "nkeySeed"
        | "jwt"
        | "creds"
        | "tls"
    >,
    overrides?: Partial<ConnectionOptions>
): Promise<NatsConnection> {
    return connect(buildConnectionOptions(config, overrides));
}
