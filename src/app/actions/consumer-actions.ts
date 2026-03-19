"use server";

import { NatsConnectionConfig } from "@/lib/nats/nats-types";
import { ConsumerConfig, ConsumerInfo } from "nats";
import { withJetStream, ActionResponse } from "./action-helpers";

export async function listConsumers(config: NatsConnectionConfig, stream: string): Promise<ActionResponse<{ consumers: ConsumerInfo[] }>> {
    return withJetStream(config, "listConsumers", async ({ jsm }) => {
        const iter = await jsm.consumers.list(stream);
        const consumerList: ConsumerInfo[] = [];
        for await (const c of iter) {
            consumerList.push(c);
        }
        return { consumers: consumerList };
    });
}

export async function createConsumer(config: NatsConnectionConfig, stream: string, consumerConfig: ConsumerConfig): Promise<ActionResponse<{ info: ConsumerInfo }>> {
    return withJetStream(config, "createConsumer", async ({ jsm }) => {
        const info = await jsm.consumers.add(stream, consumerConfig);
        return { info };
    });
}

export async function deleteConsumer(config: NatsConnectionConfig, stream: string, consumer: string): Promise<ActionResponse<void>> {
    return withJetStream(config, "deleteConsumer", async ({ jsm }) => {
        await jsm.consumers.delete(stream, consumer);
    });
}
