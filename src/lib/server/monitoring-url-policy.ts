import "server-only";

import { isIP } from "node:net";
import type { HttpMonitoringEndpoint } from "@/types/nats";

const MONITORING_ENDPOINTS = new Set<HttpMonitoringEndpoint>(["varz", "jsz", "connz"]);
const METADATA_HOSTS = ["metadata", "instance-data"];

export type MonitoringUrlPolicyResult =
    | { success: true; url: string }
    | { success: false; error: string };

function isLinkLocalAddress(hostname: string): boolean {
    const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const ipVersion = isIP(host);

    if (ipVersion === 4) {
        const octets = host.split(".").map(Number);
        return octets[0] === 169 && octets[1] === 254;
    }

    if (ipVersion === 6) {
        // IPv6 link-local addresses are fe80::/10. Also catch IPv4-mapped link-local addresses.
        if (/^fe[89ab][0-9a-f]:/i.test(host)) return true;
        const mappedIpv4 = host.match(/(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
        if (mappedIpv4) return isLinkLocalAddress(mappedIpv4);
    }

    return false;
}

function isMetadataHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    return (
        host === "metadata.google.internal" ||
        host === "metadata.google" ||
        host === "metadata.azure.com" ||
        host === "metadata.azure.internal" ||
        host === "metadata.aws" ||
        METADATA_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
    );
}

/** Validate a user-configured monitoring base URL and build only an allowed NATS endpoint URL. */
export function createMonitoringEndpointUrl(
    monitoringUrl: string,
    endpoint: HttpMonitoringEndpoint,
): MonitoringUrlPolicyResult {
    if (!MONITORING_ENDPOINTS.has(endpoint)) {
        return { success: false, error: "Monitoring endpoint must be varz, jsz, or connz" };
    }

    let url: URL;
    try {
        url = new URL(monitoringUrl.trim());
    } catch {
        return { success: false, error: "Monitoring URL is invalid" };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { success: false, error: "Monitoring URL must use http or https" };
    }
    if (url.username || url.password) {
        return { success: false, error: "Monitoring URL must not contain credentials" };
    }
    if (url.search || url.hash) {
        return { success: false, error: "Monitoring URL must not contain a query or fragment" };
    }

    const path = url.pathname.replace(/\/$/, "") || "/";
    if (path !== "/" && ![...MONITORING_ENDPOINTS].some((allowed) => path === `/${allowed}`)) {
        return { success: false, error: "Monitoring URL path must be /varz, /jsz, or /connz" };
    }

    if (isLinkLocalAddress(url.hostname) || isMetadataHostname(url.hostname)) {
        return { success: false, error: "Monitoring URL cannot target a link-local or cloud metadata host" };
    }

    // The selected endpoint always determines the final path; user-provided path never extends it.
    url.pathname = `/${endpoint}`;
    return { success: true, url: url.toString() };
}
