import { AlertCircle } from "lucide-react";

import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

/**
 * The one shared "a failed fetch shows a stock Alert with a Retry button"
 * pattern (rule 9), built entirely from stock shadcn Alert and Button so
 * every route's error state looks and behaves the same way.
 */
export function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{message}</AlertTitle>
      <AlertAction>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {copy.common.retry}
        </Button>
      </AlertAction>
    </Alert>
  );
}
