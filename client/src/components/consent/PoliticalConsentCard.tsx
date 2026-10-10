/** The profile's view of the user's consent to store political answers: give it, or take it back. */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { usePoliticalConsent } from "@/contexts/ConsentContext";

export function PoliticalConsentCard() {
  const { state, grantedAt, ensureConsent, withdraw } = usePoliticalConsent();
  const { toast } = useToast();
  const [withdrawing, setWithdrawing] = useState(false);

  const onWithdraw = async () => {
    setWithdrawing(true);
    try {
      await withdraw();
      toast({ title: "Consent withdrawn", description: "Your quiz results, votes and pledge priorities are deleted." });
    } catch {
      toast({ title: "Not withdrawn", description: "Nothing was deleted. Try again.", variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Your political answers</CardTitle>
        <CardDescription>
          {state === "granted"
            ? `You agreed to store your quiz results, votes and pledge priorities${grantedAt ? ` on ${new Date(grantedAt).toLocaleDateString()}` : ""}.`
            : state === "missing"
              ? "You have not agreed to store them, so none are saved."
              : "Checking…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        We use them only for your profile and your matches, and in totals that never show any one person.
      </CardContent>
      <CardFooter>
        {state === "missing" && <Button onClick={() => void ensureConsent()}>Read and agree</Button>}
        {state === "granted" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={withdrawing}>
                {withdrawing && <Loader2 className="animate-spin" aria-hidden="true" />}
                Withdraw consent
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Withdraw your consent?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes your quiz results, daily votes, pledge priorities and political profile. Your account
                  stays. You cannot undo this.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onWithdraw()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Withdraw and delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}
