import { Suspense } from "react";
import { PublishView } from "@/features/publish/components/publish-view";
import { Loader2 } from "lucide-react";

export default function PublishPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-24 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mr-2" /> Loading…
                </div>
            }
        >
            <PublishView />
        </Suspense>
    );
}
