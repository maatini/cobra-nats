"use server";

import { NatsConnectionConfig } from "@/lib/nats/nats-types";
import { StreamConfig, StreamInfo } from "nats";
import { withJetStream, ActionResponse } from "./action-helpers";

export async function listStreams(config: NatsConnectionConfig): Promise<ActionResponse<StreamInfo[]>> {
    return withJetStream(config, "listStreams", async ({ jsm }) => {
        const streamList: StreamInfo[] = [];
        const iter = await jsm.streams.list();
        for await (const s of iter) {
            streamList.push(s);
        }
        return streamList;
    });
}

export async function createStream(config: NatsConnectionConfig, streamConfig: StreamConfig): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "createStream", async ({ jsm }) => {
        return await jsm.streams.add(streamConfig);
    });
}

export async function deleteStream(config: NatsConnectionConfig, streamName: string): Promise<ActionResponse<boolean>> {
    return withJetStream(config, "deleteStream", async ({ jsm }) => {
        return await jsm.streams.delete(streamName);
    });
}

export async function getStreamInfo(config: NatsConnectionConfig, streamName: string): Promise<ActionResponse<StreamInfo>> {
    return withJetStream(config, "getStreamInfo", async ({ jsm }) => {
        return await jsm.streams.info(streamName);
    });
}
