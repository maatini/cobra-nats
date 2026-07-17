# Data Flows

## Primary flow: Feature operation (e.g., "list streams")

```mermaid
sequenceDiagram
    participant Browser
    participant NextServer as Next.js Server
    participant NatsMgr as NatsManager (singleton)
    participant NATS as NATS Server

    Browser->>NextServer: listStreams(config)
    Note over Browser,NextServer: Server Action (RPC)
    NextServer->>NatsMgr: getConnection(config)
    NatsMgr-->>NextServer: NatsConnection (cached or new)
    NextServer->>NatsMgr: getJetStreamManager(config)
    NatsMgr-->>NextServer: JetStreamManager (cached or new)
    NextServer->>NATS: jsm.streams.list()
    NATS-->>NextServer: StreamInfo[] (iterator)
    NextServer-->>Browser: ActionResponse<StreamInfo[]>
    Browser->>Browser: if (!res.success) toast.error(); else render
```

## SSE flow: Live subject monitor

```mermaid
sequenceDiagram
    participant Browser
    participant API as /api/monitor (SSE)
    participant NatsMgr as NatsManager (singleton)
    participant NATS as NATS Server

    Browser->>API: GET /api/monitor?connectionId=X&subject=orders.>
    Note over Browser,API: EventSource connection
    API->>NatsMgr: getConnection({id: "monitor-X-ts"})
    NatsMgr-->>API: Dedicated NatsConnection
    API->>NATS: nc.subscribe("orders.>")
    NATS-->>API: event: connected (via SSE)
    API-->>Browser: event: connected {subject}
    loop Every 15s
        API-->>Browser: event: ping
    end
    NATS-->>API: incoming message
    API-->>Browser: event: message {data}
    Browser->>Browser: Append to message buffer (max 500)
    Browser->>API: Abort signal (user navigates away)
    API->>NATS: unsubscribe + close()
```

## Connection lifecycle

```mermaid
sequenceDiagram
    participant Browser
    participant Store as Zustand Store
    participant LS as localStorage
    participant NextServer as Next.js Server
    participant NatsMgr as NatsManager
    participant NATS

    Browser->>Store: addConnection(config)
    Store->>LS: persist("cobra-nats-storage")
    Store->>Browser: activeConnectionId = new ID
    Browser->>NextServer: getServerInfo(activeConnection)
    NextServer->>NatsMgr: getConnection(config)
    NatsMgr->>NATS: connect(config.servers, auth)
    NATS-->>NatsMgr: NatsConnection
    NatsMgr-->>NextServer: NatsConnection (cached)
    NextServer-->>Browser: ServerInfo

    Note over Browser,LS: On page reload: Zustand persist rehydrates from localStorage
    Note over Browser,LS: On "Disconnect": removeConnection(id) → store updates → localStorage syncs
    Note over NatsMgr,NATS: closeConnection(id) → nc.close() → evict from Map
```

## Form submission flow (e.g., "create stream")

```mermaid
sequenceDiagram
    participant User
    participant Form as Form (React Hook Form + Zod)
    participant Component as Feature Component
    participant SA as Server Action
    participant NatsMgr as NatsManager
    participant NATS

    User->>Form: Fill fields + Submit
    Form->>Form: Zod validation
    alt Validation fails
        Form-->>User: Field errors
    else Validation passes
        Form->>Component: onSubmit({values})
        Component->>SA: createStream(activeConnection, config)
        SA->>NatsMgr: withJetStream(config, ...)
        NatsMgr->>NATS: jsm.streams.add(config)
        NATS-->>NatsMgr: StreamInfo
        NatsMgr-->>SA: StreamInfo
        SA-->>Component: ActionResponse<StreamInfo>
        alt success
            Component->>Component: toast.success("Stream created")
            Component->>Component: router.refresh() or navigate
        else failure
            Component->>Component: toast.error(res.error)
        end
    end
```

## Confirm dialog flow (destructive actions)

```mermaid
sequenceDiagram
    participant User
    participant Feature as Feature Component
    participant Confirm as ConfirmProvider
    participant Dialog as ConfirmDialog (modal)

    User->>Feature: Click "Delete"
    Feature->>Confirm: confirm({title, typedName: "streamName"})
    Confirm->>Dialog: Open modal
    Dialog-->>User: "Type 'streamName' to confirm"
    User->>Dialog: Type exact name + press Confirm
    Dialog->>Confirm: resolve(true)
    Confirm-->>Feature: Promise resolves → true
    Feature->>Feature: Execute destructive Server Action
```
