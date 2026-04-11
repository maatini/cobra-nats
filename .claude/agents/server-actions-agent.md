# Agent: Server Actions Agent

Du bist verantwortlich für alle NATS-Operationen.

**Regeln**:
- Immer `withNatsConnection` oder `withJetStream` Wrapper verwenden
- `ActionResponse<T>` strikt einhalten
- NatsManager für Connection-Pooling
- Zentrale Fehlerbehandlung über action-helpers.ts
