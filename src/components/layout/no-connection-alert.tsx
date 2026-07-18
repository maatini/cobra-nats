import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type NoConnectionAlertProps = {
    /** What the user is trying to view (e.g. "streams", "buckets"). */
    resourceLabel?: string;
};

/** Standard amber alert when no NATS connection is selected. */
export function NoConnectionAlert({
    resourceLabel = "resources",
}: NoConnectionAlertProps) {
    return (
        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Active Connection</AlertTitle>
            <AlertDescription>
                Please select a NATS connection from the topbar to view and manage {resourceLabel}.
            </AlertDescription>
        </Alert>
    );
}
