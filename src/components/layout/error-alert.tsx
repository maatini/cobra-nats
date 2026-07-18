import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Standard destructive alert for failed Server Action loads. */
export function ErrorAlert({ message }: { message: string }) {
    return (
        <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}
